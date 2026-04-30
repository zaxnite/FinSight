from pydantic import BaseModel, Field
from typing import Literal


class FinanceResponse(BaseModel):
    advice: str = Field(description="The financial advice or answer to the user's question")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    risk_level: Literal["low", "medium", "high"] = Field(description="Risk level associated with the advice")
    sources: list[str] = Field(default_factory=list, description="Document sources referenced in the response")
    follow_up: list[str] = Field(default_factory=list, description="Suggested follow-up questions for the user")


class AgentInput(BaseModel):
    message: str = Field(description="The user's message or question")
    session_id: str = Field(description="Unique session identifier for conversation tracking")


class AgentOutput(BaseModel):
    response: FinanceResponse
    tool_used: Literal["doc_search", "stock_price", "budget_calc", "none"] = Field(
        description="Which tool the agent decided to use"
    )
    session_id: str