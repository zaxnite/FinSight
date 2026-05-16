import os
from dotenv import load_dotenv
from langfuse import Langfuse, get_client
from langfuse.langchain import CallbackHandler

load_dotenv()

Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)

_langfuse = get_client()

langfuse_handler = CallbackHandler()


def get_langfuse_callback() -> CallbackHandler:
    return langfuse_handler


def get_callback(session_id: str = ""):
    """Return a LangChain callback handler with session tracking."""
    handler = CallbackHandler()
    if session_id:
        handler.session_id = session_id
    return handler


def get_langfuse_config(session_id: str, user_id: str = "anonymous") -> dict:
    return {
        "callbacks": [langfuse_handler],
        "metadata": {
            "langfuse_session_id": session_id,
            "langfuse_user_id": user_id,
        },
    }


def score_response(session_id: str, value: float) -> None:
    try:
        _langfuse.create_score(
            name="user_feedback",
            value=value,
            session_id=session_id,
            comment="thumbs up" if value == 1.0 else "thumbs down",
        )
        _langfuse.flush()
    except Exception as e:
        print(f"[LangFuse score error] {e}")


def trace_request(session_id: str, user_message: str, tool_used: str, response_summary: str) -> None:
    try:
        with _langfuse.start_as_current_observation(
            as_type="span",
            name="finsight-request",
            input={"message": user_message},
        ) as span:
            span.update(
                output={"summary": response_summary},
                metadata={"tool_used": tool_used, "session_id": session_id},
            )
    except Exception as e:
        print(f"[LangFuse trace error] {e}")


def flush() -> None:
    _langfuse.flush()