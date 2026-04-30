import os
from dotenv import load_dotenv
from langfuse import Langfuse
from langfuse.langchain import CallbackHandler


load_dotenv()

_langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)


def get_langfuse_callback(session_id: str, user_id: str = "anonymous") -> CallbackHandler:
    return CallbackHandler(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        session_id=session_id,
        user_id=user_id,
    )


def trace_request(session_id: str, user_message: str, tool_used: str, response_summary: str) -> None:
    trace = _langfuse.trace(
        name="finsight-request",
        session_id=session_id,
        input=user_message,
        output=response_summary,
        metadata={"tool_used": tool_used},
    )
    trace.update(status="success")


def flush() -> None:
    _langfuse.flush()