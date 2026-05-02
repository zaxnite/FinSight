import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain.tools import tool
from rag.pipeline import retrieve


@tool
def doc_search(query: str) -> str:
    """Search the financial knowledge base for information about investing,
    budgeting, UAE financial regulations, and personal finance topics.
    Use this for general financial questions and advice."""
    result = retrieve(query)
    return result