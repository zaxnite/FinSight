import sys
import os
import time
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from typing import Literal
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from pydantic import BaseModel, Field
from agent.state import AgentState
from structured.output_schema import FinanceResponse
from tools.doc_search import doc_search
from tools.stock_price import stock_price
from tools.budget_calc import budget_calc
from observability.langfuse_client import get_callback

llm = ChatAnthropic(
    model="claude-haiku-4-5-20251001",
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    max_tokens=1500,
    timeout=30,      # fail after 30s instead of hanging forever
    max_retries=2,   # auto-retry twice on transient errors
)

# ── Structured output schemas ─────────────────────────────────────────────────
class GuardrailDecision(BaseModel):
    is_finance_related: bool = Field(
        description="True if the question is related to finance, investing, budgeting, banking, economics, stock markets, or UAE financial topics. False otherwise."
    )
    reason: str = Field(
        description="One sentence explaining why this is or is not finance-related."
    )

class ToolDecision(BaseModel):
    tool: Literal["doc_search", "stock_price", "budget_calc", "none"] = Field(
        description="The tool to use based on the user's message"
    )
    input: str = Field(
        description="The input to pass to the tool, or empty string if tool is none"
    )

# ── Structured LLMs ───────────────────────────────────────────────────────────
guardrail_llm = llm.with_structured_output(GuardrailDecision)
reasoner_llm = llm.with_structured_output(ToolDecision)
responder_llm = llm.with_structured_output(FinanceResponse)

# ── Streaming LLM ─────────────────────────────────────────────────────────────
streaming_llm = ChatAnthropic(
    model="claude-haiku-4-5-20251001",
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    max_tokens=1500,
    streaming=True,
    timeout=30,      # same timeout for streaming
    max_retries=2,
)

TOOLS = {
    "doc_search": doc_search,
    "stock_price": stock_price,
    "budget_calc": budget_calc,
}

GUARDRAIL_PROMPT = """You are a finance assistant guardrail. Your only job is to decide whether the user's message is related to finance or not.

Finance-related topics include:
- Investing, stocks, crypto, bonds, ETFs, mutual funds
- Budgeting, saving, spending, personal finance
- UAE financial regulations, SCA, DIFC, ADGM, DFM, NASDAQ Dubai
- Banking, loans, mortgages, credit cards
- Economic concepts, inflation, interest rates, compound interest
- Retirement planning, wealth management
- Any financial product, service, or institution

Not finance-related:
- Creative writing, poems, stories
- Cooking, recipes, food
- Sports, entertainment, pop culture
- Technology unrelated to fintech
- Medical or legal advice
- General knowledge questions with no financial angle

Be generous in your interpretation. If there is any reasonable financial angle, mark it as finance-related."""

REASONER_PROMPT = """You are a financial AI assistant. Based on the user's message, decide which tool to use.

Available tools:
- doc_search: For general financial knowledge, UAE regulations, investing basics, budgeting concepts
- stock_price: For live stock or cryptocurrency prices. Use this when the user mentions ANY company name (Apple, Tesla, Microsoft, Emirates NBD, Aramco) OR ticker symbol (AAPL, TSLA, MSFT). Always use this for any stock or crypto price question.
- budget_calc: For budget calculations (user must provide their income or salary figures)
- none: If no tool is needed and you can answer directly from knowledge

Pick the most appropriate tool. When in doubt, use doc_search."""

RESPONDER_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.

Your job is to provide clear, helpful, and actionable financial advice based on the user's question and any context retrieved from financial documents or tools.

RULES:
- Be concise and direct. Do not pad responses with unnecessary caveats.
- Use UAE context where relevant (AED, DFM, ADGM, DIFC, SCA, expat considerations).
- Set confidence between 0.0 and 1.0 based on how certain you are of the advice.
- Set risk_level based on the financial risk of the subject matter:
  "low" = informational answers, price lookups, budgeting, savings, general knowledge
  "medium" = advice about investing in diversified funds, ETFs, or real estate
  "high" = advice about individual stocks, active trading, crypto, or leveraged products
  A stock price lookup should reflect the risk of that stock as an investment.
- For sources, list only the document filenames actually referenced in the context. If no documents were used, return an empty list.
- IMPORTANT: If the retrieved context does not contain sufficient information to answer the question confidently, set confidence below 0.6 and do NOT fabricate an answer. It is better to be honest about uncertainty than to generate misleading financial advice.
- NEVER end your advice with a question or offer to help further. The follow_up field handles that separately.

FOLLOW-UP QUESTIONS RULES:
- Suggest exactly 3 follow-up questions the user can ask YOU next.
- Every question MUST be answerable using your tools: doc_search (UAE financial documents), stock_price (live prices), or budget_calc (income/expense calculations).
- Questions must be factual and specific — not open-ended or conversational.
- BANNED phrases in questions: "Would you like", "Can you help", "How do I find out", "What should I do", "Tell me more about"
- BAD: "Would you like help comparing savings products?", "What are your financial goals?"
- BAD: "How do I find the best bank rate?" (requires external research, not answerable by the agent)
- GOOD: "How does the UAE Central Bank base rate affect savings account returns?", "What does the CBUAE say about fixed deposit regulations?", "How much would AED 10,000 grow at 5% over 10 years?"
- The question must be something FinSight can answer RIGHT NOW with its tools and knowledge base."""

STREAMING_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.

Provide clear, helpful, and actionable financial advice. Be concise and direct.
Use UAE context where relevant (AED, DFM, ADGM, DIFC, SCA, expat considerations).
Always use markdown bullet points (- item) not bullet characters. Never use the bullet character.
Do not use markdown headers. Use bold text where helpful.
Do not add unnecessary preamble. Get straight to the answer.

IMPORTANT: If you do not have reliable information to answer the question, say so clearly and honestly.
Do NOT fabricate financial data, regulations, or statistics. Financial misinformation causes real harm.

CRITICAL: Never end your response with a question. Never write phrases like:
- "Would you like help with..."
- "Is this helping you..."
- "Do you need help understanding..."
- "Shall I explain..."
- "Would you like me to..."
End with your advice or conclusion. The follow-up questions are handled separately."""

FALLBACK_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.

A previous attempt to answer the user's question returned a low confidence score, meaning the initial retrieval did not find sufficient information.

You have been given a broader set of retrieved documents as a second attempt.

RULES:
- Answer ONLY from the provided context. Do not fabricate.
- If the context still does not contain enough information to answer confidently, you MUST say so honestly.
- Set confidence honestly: above 0.6 only if the context clearly supports the answer.
- Never invent financial regulations, statistics, or product details.
- Be direct. If you don't know, say: "I don't have enough information in my knowledge base to answer this accurately. For this topic, I'd recommend checking the SCA website (sca.gov.ae) or consulting a licensed financial advisor in the UAE."
"""

MEMORY_WINDOW = 6
CONFIDENCE_THRESHOLD = 0.6


def _get_callback(session_id: str = ""):
    return get_callback(session_id=session_id)


def _build_memory_context(state: AgentState) -> list:
    messages = state.messages[:-1]
    recent = messages[-(MEMORY_WINDOW):]
    history = []
    for msg in recent:
        if hasattr(msg, "type"):
            if msg.type == "human":
                history.append(HumanMessage(content=msg.content))
            elif msg.type == "ai":
                history.append(AIMessage(content=msg.content))
    return history


# ── Nodes ─────────────────────────────────────────────────────────────────────
def guardrail_node(state: AgentState) -> AgentState:
    user_message = state.messages[-1].content if state.messages else ""
    cb = _get_callback(state.session_id)

    decision: GuardrailDecision = guardrail_llm.invoke(
        [SystemMessage(content=GUARDRAIL_PROMPT), HumanMessage(content=user_message)],
        config={"callbacks": [cb]},
    )

    if not decision.is_finance_related:
        state.blocked = True
        state.blocked_message = (
            "I'm FinSight, a personal finance advisor built for UAE residents. "
            "I can only help with financial topics like investing, budgeting, UAE regulations, "
            "and live stock prices. Could you ask me something finance-related?"
        )

    return state


def reasoner_node(state: AgentState) -> AgentState:
    user_message = state.messages[-1].content if state.messages else ""
    cb = _get_callback(state.session_id)

    decision: ToolDecision = reasoner_llm.invoke(
        [SystemMessage(content=REASONER_PROMPT), HumanMessage(content=user_message)],
        config={"callbacks": [cb]},
    )

    state.tool_to_use = decision.tool
    state.tool_input = decision.input or user_message
    return state


def tool_node(state: AgentState) -> AgentState:
    tool_name = state.tool_to_use

    if tool_name == "none" or tool_name not in TOOLS:
        state.tool_output = ""
        return state

    state.tool_output = TOOLS[tool_name].invoke(state.tool_input)
    return state


def responder_node(state: AgentState) -> AgentState:
    user_message = state.messages[-1].content if state.messages else ""
    history = _build_memory_context(state)
    cb = _get_callback(state.session_id)

    context = (
        f"Tool used: {state.tool_to_use}\n\nTool output:\n{state.tool_output}"
        if state.tool_output
        else "No tool was used. Answer from your financial knowledge."
    )

    messages = [SystemMessage(content=RESPONDER_PROMPT)]
    messages.extend(history)
    messages.append(HumanMessage(content=f"User question: {user_message}\n\nContext:\n{context}"))

    response: FinanceResponse = responder_llm.invoke(
        messages,
        config={"callbacks": [cb]},
    )
    state.final_response = response
    return state


def stream_responder(state: AgentState, session_id: str = ""):
    """Generator used for /chat/stream endpoint. Yields text chunks with delay for typing effect."""
    user_message = state.messages[-1].content if state.messages else ""
    history = _build_memory_context(state)
    cb = _get_callback(session_id or state.session_id)

    context = (
        f"Tool used: {state.tool_to_use}\n\nTool output:\n{state.tool_output}"
        if state.tool_output
        else "No tool was used. Answer from your financial knowledge."
    )

    messages = [SystemMessage(content=STREAMING_PROMPT)]
    messages.extend(history)
    messages.append(HumanMessage(content=f"User question: {user_message}\n\nContext:\n{context}"))

    for chunk in streaming_llm.stream(messages, config={"callbacks": [cb]}):
        if chunk.content:
            time.sleep(0.015)
            yield chunk.content


# ── Confidence Fallback ───────────────────────────────────────────────────────
def confidence_fallback(question: str, original_tool: str, session_id: str = "") -> dict:
    """
    Called when the initial response confidence is below CONFIDENCE_THRESHOLD (0.6).

    Strategy:
    1. Re-run doc_search with a broader/rephrased query as a second retrieval attempt.
    2. Ask the LLM to answer using the new context, with strict instructions not to fabricate.
    3. If the new confidence is still below threshold, return an honest "I don't know" message.

    Returns a dict with: answered (bool), text (str), confidence (float), sources (list).
    """
    cb = _get_callback(session_id)

    broader_query = f"UAE finance: {question}"
    try:
        fallback_context = doc_search.invoke(broader_query)
    except Exception as e:
        fallback_context = f"Retrieval failed: {str(e)}"

    fallback_messages = [
        SystemMessage(content=FALLBACK_PROMPT),
        HumanMessage(content=(
            f"User question: {question}\n\n"
            f"Retrieved context (broader search):\n{fallback_context}\n\n"
            f"Based ONLY on the above context, answer the question. "
            f"If the context is insufficient, say so honestly."
        )),
    ]

    try:
        fallback_response: FinanceResponse = responder_llm.invoke(
            fallback_messages,
            config={"callbacks": [cb]},
        )

        if fallback_response.confidence >= CONFIDENCE_THRESHOLD:
            return {
                "answered": True,
                "text": fallback_response.advice,
                "confidence": fallback_response.confidence,
                "sources": fallback_response.sources,
            }
        else:
            return {
                "answered": False,
                "text": (
                    "I wasn't able to find reliable information in my knowledge base to answer this accurately. "
                    "For this topic, I'd recommend checking the SCA website (sca.gov.ae), "
                    "the DIFC or ADGM portals, or consulting a licensed financial advisor in the UAE."
                ),
                "confidence": fallback_response.confidence,
                "sources": [],
            }

    except Exception as e:
        print(f"[confidence_fallback error] {e}")
        return {
            "answered": False,
            "text": (
                "I wasn't able to retrieve sufficient information to answer this question confidently. "
                "Please try rephrasing, or consult the SCA website (sca.gov.ae) for authoritative guidance."
            ),
            "confidence": 0.0,
            "sources": [],
        }