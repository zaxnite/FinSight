import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.graph import run_graph
from observability.langfuse_client import flush

app = FastAPI(
    title="FinSight API",
    description="AI-powered personal finance advisor for UAE residents",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


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


@app.on_event("shutdown")
def shutdown():
    flush()