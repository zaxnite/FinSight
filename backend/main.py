import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import uuid
import json
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from agent.graph import run_graph
from agent.state import AgentState
from agent.nodes import stream_responder, guardrail_node, reasoner_node, tool_node, responder_llm, RESPONDER_PROMPT
from observability.langfuse_client import flush as langfuse_flush, trace_request


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    langfuse_flush()


app = FastAPI(
    title="FinSight API",
    description="AI-powered personal finance advisor for UAE residents",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve PDFs statically
docs_path = os.path.join(os.path.dirname(__file__), "data", "docs")
if os.path.exists(docs_path):
    app.mount("/docs-files", StaticFiles(directory=docs_path), name="docs")


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: list[dict] | None = None

class ScoreRequest(BaseModel):
    session_id: str
    value: float  # 1.0 = thumbs up, 0.0 = thumbs down

@app.post("/score")
def score(request: ScoreRequest):
    try:
        from observability.langfuse_client import score_response
        score_response(
            session_id=request.session_id,
            value=request.value,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "service": "FinSight API"}


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        result = run_graph(message=request.message, session_id=session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())

    messages = []
    if request.history:
        for msg in request.history[-6:]:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=request.message))

    async def event_stream():
        full_text = ""
        tool_used = "none"

        try:
            state = AgentState(
                messages=messages,
                session_id=session_id,
            )

            # Guardrail
            state = guardrail_node(state)

            if state.blocked:
                yield f"data: {json.dumps({'type': 'text', 'content': state.blocked_message})}\n\n"
                yield f"data: {json.dumps({'type': 'meta', 'tool_used': 'none', 'confidence': 1.0, 'risk_level': 'low', 'sources': [], 'follow_up': ['What are the SCA regulations for investing in UAE?', 'How does the 50/30/20 rule work?', 'What is the current AAPL stock price?']})}\n\n"
                yield "data: [DONE]\n\n"
                try:
                    trace_request(session_id=session_id, user_message=request.message, tool_used="none", response_summary="[BLOCKED]")
                    langfuse_flush()
                except Exception:
                    pass
                return

            # Reasoner and tool
            state = reasoner_node(state)
            state = tool_node(state)
            tool_used = state.tool_to_use

            yield f"data: {json.dumps({'type': 'tool', 'tool_used': state.tool_to_use})}\n\n"

            # Stream response
            try:
                for chunk in stream_responder(state, session_id=session_id):
                    full_text += chunk
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
            except Exception as e:
                err = traceback.format_exc()
                print(f"[stream_responder error] {err}")
                yield f"data: {json.dumps({'type': 'text', 'content': f'Error during streaming: {str(e)}'})}\n\n"

            # Metadata
            try:
                context = (
                    f"Tool used: {state.tool_to_use}\n\nTool output:\n{state.tool_output}"
                    if state.tool_output else "No tool was used."
                )
                meta_messages = [
                    SystemMessage(content=RESPONDER_PROMPT),
                    HumanMessage(content=(
                        f"User question: {request.message}\n\n"
                        f"Context:\n{context}\n\n"
                        f"The advice has already been given as: {full_text[:300]}...\n\n"
                        f"Now provide ONLY the metadata: confidence score, risk level, sources, and follow-up questions. Do not repeat the advice."
                    )),
                ]
                meta = responder_llm.invoke(meta_messages)
                yield f"data: {json.dumps({'type': 'meta', 'tool_used': tool_used, 'confidence': meta.confidence, 'risk_level': meta.risk_level, 'sources': meta.sources, 'follow_up': meta.follow_up})}\n\n"
            except Exception as e:
                err = traceback.format_exc()
                print(f"[meta error] {err}")
                yield f"data: {json.dumps({'type': 'meta', 'tool_used': tool_used, 'confidence': 0.7, 'risk_level': 'low', 'sources': [], 'follow_up': []})}\n\n"

            yield "data: [DONE]\n\n"

            try:
                trace_request(session_id=session_id, user_message=request.message, tool_used=tool_used, response_summary=full_text[:150])
                langfuse_flush()
            except Exception:
                pass

        except Exception as e:
            err = traceback.format_exc()
            print(f"[event_stream error] {err}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )