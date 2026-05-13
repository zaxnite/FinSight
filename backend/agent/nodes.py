import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from typing import Literal
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from agent.state import AgentState
from structured.output_schema import FinanceResponse
from tools.doc_search import doc_search
from tools.stock_price import stock_price
from tools.budget_calc import budget_calc

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

# ── Tools registry ────────────────────────────────────────────────────────────
TOOLS = {
    "doc_search": doc_search,
    "stock_price": stock_price,
    "budget_calc": budget_calc,
}

# ── Prompts ───────────────────────────────────────────────────────────────────
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
- stock_price: For live stock or cryptocurrency prices (user must mention a specific ticker or company name)
- budget_calc: For budget calculations (user must provide their income or salary figures)
- none: If no tool is needed and you can answer directly from knowledge

Pick the most appropriate tool. When in doubt, use doc_search."""

RESPONDER_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.

Your job is to provide clear, helpful, and actionable financial advice based on the user's question and any context retrieved from financial documents or tools.

RULES:
- Be concise and direct. Do not pad responses with unnecessary caveats.
- Use UAE context where relevant (AED, DFM, ADGM, DIFC, SCA, expat considerations).
- Set confidence between 0.0 and 1.0 based on how certain you are of the advice.
- Set risk_level based on the financial risk of the advice: "low" for savings/budgeting, "medium" for investing, "high" for trading/speculation.
- For sources, list only the document filenames that were actually referenced in the context. If no documents were used, return an empty list.

FOLLOW-UP QUESTIONS RULES:
- Suggest 3 follow-up questions the USER can ask YOU (the AI) to learn more.
- Questions must be things the AI can answer, NOT things only the user knows about themselves.
- Questions must be directly related to the topic just discussed.
- BAD examples (do not use these): "What is my risk tolerance?", "What are your financial goals?", "How much do you earn?"
- GOOD examples: "How do I calculate my net worth?", "What are the best ETFs available on DFM?", "How does inflation affect savings in the UAE?"
- Keep questions short, specific, and genuinely useful for someone learning about finance."""


# ── Nodes ─────────────────────────────────────────────────────────────────────
def guardrail_node(state: AgentState) -> AgentState:
    user_message = state.messages[-1].content if state.messages else ""

    decision: GuardrailDecision = guardrail_llm.invoke([
        SystemMessage(content=GUARDRAIL_PROMPT),
        HumanMessage(content=user_message),
    ])

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

    decision: ToolDecision = reasoner_llm.invoke([
        SystemMessage(content=REASONER_PROMPT),
        HumanMessage(content=user_message),
    ])

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

    context = (
        f"Tool used: {state.tool_to_use}\n\nTool output:\n{state.tool_output}"
        if state.tool_output
        else "No tool was used. Answer from your financial knowledge."
    )

    response: FinanceResponse = responder_llm.invoke([
        SystemMessage(content=RESPONDER_PROMPT),
        HumanMessage(content=f"User question: {user_message}\n\nContext:\n{context}"),
    ])

    state.final_response = response
    return state