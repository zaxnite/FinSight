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

FOLLOW-UP QUESTIONS RULES:
- Suggest 3 follow-up questions the USER can ask YOU (the AI) to learn more.
- Questions must be things the AI can answer, NOT things only the user knows about themselves.
- Questions must be directly related to the topic just discussed.
- BAD: "What is my risk tolerance?", "What are your financial goals?", "How much do you earn?"
- GOOD: "How do I calculate my net worth?", "What are the best ETFs on DFM?", "How does inflation affect savings in the UAE?"
- Keep questions short, specific, and genuinely useful."""

STREAMING_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.

Provide clear, helpful, and actionable financial advice. Be concise and direct.
Use UAE context where relevant (AED, DFM, ADGM, DIFC, SCA, expat considerations).
Always use markdown bullet points (- item) not bullet characters. Never use the bullet character.
Do not use markdown headers. Use bold text where helpful.
Do not add unnecessary preamble. Get straight to the answer."""

MEMORY_WINDOW = 6


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