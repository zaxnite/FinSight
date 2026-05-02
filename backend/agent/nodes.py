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

# ── Base LLM ──────────────────────────────────────────────────────────────────
llm = ChatAnthropic(
    model="claude-haiku-4-5-20251001",
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    max_tokens=1000,
)

# ── Structured output schemas ─────────────────────────────────────────────────
class ToolDecision(BaseModel):
    tool: Literal["doc_search", "stock_price", "budget_calc", "none"] = Field(
        description="The tool to use based on the user's message"
    )
    input: str = Field(
        description="The input to pass to the tool, or empty string if tool is none"
    )

# ── Structured LLMs ───────────────────────────────────────────────────────────
reasoner_llm = llm.with_structured_output(ToolDecision)
responder_llm = llm.with_structured_output(FinanceResponse)

# ── Tools registry ────────────────────────────────────────────────────────────
TOOLS = {
    "doc_search": doc_search,
    "stock_price": stock_price,
    "budget_calc": budget_calc,
}

# ── Prompts ───────────────────────────────────────────────────────────────────
REASONER_PROMPT = """You are a financial AI assistant. Based on the user's message, decide which tool to use.

Available tools:
- doc_search: For general financial knowledge, UAE regulations, investing basics, budgeting concepts
- stock_price: For live stock or cryptocurrency prices (user must mention a specific ticker or company)
- budget_calc: For budget calculations (user must provide income or salary figures)
- none: If no tool is needed and you can answer directly from knowledge"""

RESPONDER_PROMPT = """You are FinSight, an AI-powered personal finance advisor for UAE residents.
Provide clear, actionable financial advice based on the user's question and any context provided.
Always be helpful, accurate, and consider the UAE financial context where relevant.
Set confidence between 0.0-1.0 based on how certain you are.
Set risk_level based on the financial risk of the advice given."""


# ── Nodes ─────────────────────────────────────────────────────────────────────
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