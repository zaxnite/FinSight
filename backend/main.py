import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# ── Startup env var check — fail fast with a clear message ────────────────────
REQUIRED_ENV_VARS = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "PINECONE_API_KEY",
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
]
missing = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing:
    raise RuntimeError(
        f"Missing required environment variables: {', '.join(missing)}\n"
        f"Check your .env file and make sure all keys are set."
    )

import uuid
import json
import traceback
import time
from contextlib import asynccontextmanager

START_TIME = time.time()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from agent.graph import run_graph
from agent.state import AgentState
from agent.nodes import (
    stream_responder,
    guardrail_node,
    reasoner_node,
    tool_node,
    responder_llm,
    RESPONDER_PROMPT,
    confidence_fallback,
)
from observability.langfuse_client import flush as langfuse_flush, trace_request


# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": "Too many requests. Please wait a moment before trying again.",
            "retry_after": "60 seconds",
        },
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    langfuse_flush()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinSight API",
    description="AI-powered personal finance advisor for UAE residents",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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


# ── Request Models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: list[dict] | None = None


class ScoreRequest(BaseModel):
    session_id: str
    value: float  # 1.0 = thumbs up, 0.0 = thumbs down


# ── Helpers ───────────────────────────────────────────────────────────────────
def validate_message(message: str) -> None:
    """Raise 422 if message is empty or whitespace only."""
    if not message or not message.strip():
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty."
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    uptime_seconds = int(time.time() - START_TIME)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    docs_indexed = 0
    try:
        ingested_log = os.path.join(os.path.dirname(__file__), "data", "ingested.json")
        if os.path.exists(ingested_log):
            with open(ingested_log) as f:
                docs_indexed = len(json.load(f))
    except Exception:
        pass

    return {
        "status": "ok",
        "version": "1.0.0",
        "model": "claude-haiku-4-5-20251001",
        "docs_indexed": docs_indexed,
        "uptime": uptime_str,
    }


@app.post("/score")
@limiter.limit("30/minute")
def score(request: Request, body: ScoreRequest):
    try:
        from observability.langfuse_client import score_response
        score_response(session_id=body.session_id, value=body.value)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
@limiter.limit("10/minute")
def chat(request: Request, body: ChatRequest):
    validate_message(body.message)
    try:
        session_id = body.session_id or str(uuid.uuid4())
        result = run_graph(message=body.message, session_id=session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(request: Request, body: ChatRequest):
    validate_message(body.message)

    session_id = body.session_id or str(uuid.uuid4())

    messages = []
    if body.history:
        for msg in body.history[-6:]:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=body.message))

    async def event_stream():
        full_text = ""
        tool_used = "none"

        try:
            state = AgentState(messages=messages, session_id=session_id)

            # ── Guardrail ─────────────────────────────────────────────────────
            state = guardrail_node(state)

            if state.blocked:
                yield f"data: {json.dumps({'type': 'text', 'content': state.blocked_message})}\n\n"
                yield f"data: {json.dumps({'type': 'meta', 'tool_used': 'none', 'confidence': 1.0, 'risk_level': 'low', 'sources': [], 'follow_up': ['What are the SCA regulations for investing in UAE?', 'How does the 50/30/20 rule work?', 'What is the current AAPL stock price?']})}\n\n"
                yield "data: [DONE]\n\n"
                try:
                    trace_request(session_id=session_id, user_message=body.message, tool_used="none", response_summary="[BLOCKED]")
                    langfuse_flush()
                except Exception:
                    pass
                return

            # ── Reasoner + Tool ───────────────────────────────────────────────
            state = reasoner_node(state)
            state = tool_node(state)
            tool_used = state.tool_to_use

            yield f"data: {json.dumps({'type': 'tool', 'tool_used': state.tool_to_use})}\n\n"

            # ── Stream response ───────────────────────────────────────────────
            try:
                for chunk in stream_responder(state, session_id=session_id):
                    full_text += chunk
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
            except Exception as e:
                err = traceback.format_exc()
                print(f"[stream_responder error] {err}")
                yield f"data: {json.dumps({'type': 'text', 'content': f'Error during streaming: {str(e)}'})}\n\n"

            # ── Metadata + confidence fallback ────────────────────────────────
            try:
                context = (
                    f"Tool used: {state.tool_to_use}\n\nTool output:\n{state.tool_output}"
                    if state.tool_output else "No tool was used."
                )
                meta_messages = [
                    SystemMessage(content=RESPONDER_PROMPT),
                    HumanMessage(content=(
                        f"User question: {body.message}\n\n"
                        f"Context:\n{context}\n\n"
                        f"The advice has already been given as: {full_text[:300]}...\n\n"
                        f"Now provide ONLY the metadata: confidence score, risk level, sources, and follow-up questions. Do not repeat the advice."
                    )),
                ]
                meta = responder_llm.invoke(meta_messages)

                if meta.confidence < 0.6:
                    fallback_result = confidence_fallback(
                        question=body.message,
                        original_tool=state.tool_to_use,
                        session_id=session_id,
                    )
                    if fallback_result["answered"]:
                        yield f"data: {json.dumps({'type': 'correction', 'content': fallback_result['text']})}\n\n"
                        meta.confidence = fallback_result["confidence"]
                        meta.sources = fallback_result["sources"]
                    else:
                        yield f"data: {json.dumps({'type': 'correction', 'content': fallback_result['text']})}\n\n"
                        meta.confidence = fallback_result["confidence"]
                        meta.sources = []

                yield f"data: {json.dumps({'type': 'meta', 'tool_used': tool_used, 'confidence': meta.confidence, 'risk_level': meta.risk_level, 'sources': meta.sources, 'follow_up': meta.follow_up})}\n\n"

            except Exception as e:
                err = traceback.format_exc()
                print(f"[meta error] {err}")
                yield f"data: {json.dumps({'type': 'meta', 'tool_used': tool_used, 'confidence': 0.7, 'risk_level': 'low', 'sources': [], 'follow_up': []})}\n\n"

            yield "data: [DONE]\n\n"

            try:
                trace_request(session_id=session_id, user_message=body.message, tool_used=tool_used, response_summary=full_text[:150])
                langfuse_flush()
            except Exception:
                pass

        except HTTPException:
            raise
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
        },
    )