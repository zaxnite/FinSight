from typing import Annotated, Literal
from langgraph.graph.message import add_messages
from pydantic import BaseModel
from structured.output_schema import FinanceResponse


class AgentState(BaseModel):
    messages: Annotated[list, add_messages] = []
    session_id: str = ""
    anthropic_key: str = ""   # per-request key, falls back to env var in each node
    blocked: bool = False
    blocked_message: str = ""
    tool_to_use: Literal["doc_search", "stock_price", "budget_calc", "none"] = "none"
    tool_input: str = ""
    tool_output: str = ""
    final_response: FinanceResponse | None = None

    class Config:
        arbitrary_types_allowed = True