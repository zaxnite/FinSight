import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
from agent.state import AgentState
from agent.nodes import reasoner_node, tool_node, responder_node
from observability.langfuse_client import get_langfuse_config, trace_request
from structured.output_schema import AgentOutput


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("reasoner", reasoner_node)
    graph.add_node("tool", tool_node)
    graph.add_node("responder", responder_node)

    graph.set_entry_point("reasoner")
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