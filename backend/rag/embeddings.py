import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

load_dotenv()

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        dimensions=EMBEDDING_DIMENSIONS,
        api_key=os.getenv("OPENAI_API_KEY"),
    )