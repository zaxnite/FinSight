import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
from agent.state import AgentState
from agent.nodes import guardrail_node, reasoner_node, tool_node, responder_node
from observability.langfuse_client import get_langfuse_config, trace_request
from structured.output_schema import AgentOutput, FinanceResponse


def route_after_guardrail(state: AgentState) -> str:
    return "blocked" if state.blocked else "reasoner"


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("guardrail", guardrail_node)
    graph.add_node("reasoner", reasoner_node)
    graph.add_node("tool", tool_node)
    graph.add_node("responder", responder_node)

    graph.set_entry_point("guardrail")

    graph.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {
            "blocked": END,
            "reasoner": "reasoner",
        }
    )

    graph.add_edge("reasoner", "tool")
    graph.add_edge("tool", "responder")
    graph.add_edge("responder", END)

    return graph.compile()


app = build_graph()


def run_graph(message: str, session_id: str) -> AgentOutput:
    initial_state = AgentState(
        messages=[HumanMessage(content=message)],
        session_id=session_id,
    )

    langfuse_config = get_langfuse_config(session_id=session_id)
    result = app.invoke(initial_state, config=langfuse_config)
    final_state = AgentState(**result)

    # If blocked by guardrail, return a clean response
    if final_state.blocked:
        blocked_response = FinanceResponse(
            advice=final_state.blocked_message,
            confidence=1.0,
            risk_level="low",
            sources=[],
            follow_up=[
                "What are the SCA regulations for investing in UAE?",
                "How does the 50/30/20 budgeting rule work?",
                "What is the current price of AAPL stock?",
            ]
        )
        return AgentOutput(
            response=blocked_response,
            tool_used="none",
            session_id=session_id,
        )

    trace_request(
        session_id=session_id,
        user_message=message,
        tool_used=final_state.tool_to_use,
        response_summary=final_state.final_response.advice[:100] if final_state.final_response else "",
    )

    return AgentOutput(
        response=final_state.final_response,
        tool_used=final_state.tool_to_use,
        session_id=session_id,
    )