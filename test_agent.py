import sys
sys.path.append("backend")

from backend.agent.graph import run_graph
import uuid

result = run_graph(
    message="What is the 50/30/20 budgeting rule?",
    session_id=str(uuid.uuid4())
)

print("Tool used:", result.tool_used)
print("Advice:", result.response.advice)
print("Confidence:", result.response.confidence)
print("Risk:", result.response.risk_level)
print("Sources:", result.response.sources)
print("Follow-up:", result.response.follow_up)