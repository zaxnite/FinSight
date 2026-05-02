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


def get_langfuse_config(session_id: str, user_id: str = "anonymous") -> dict:
    return {
        "callbacks": [langfuse_handler],
        "metadata": {
            "langfuse_session_id": session_id,
            "langfuse_user_id": user_id,
        },
    }


def trace_request(session_id: str, user_message: str, tool_used: str, response_summary: str) -> None:
    with _langfuse.start_as_current_observation(
        as_type="span",
        name="finsight-request",
        input={"message": user_message},
    ) as span:
        span.update(
            output={"summary": response_summary},
            metadata={"tool_used": tool_used, "session_id": session_id},
        )


def flush() -> None:
    _langfuse.flush()