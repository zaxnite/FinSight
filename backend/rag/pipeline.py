import os
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore
from rag.embeddings import get_embeddings

load_dotenv()

TOP_K = 5


def get_vectorstore() -> PineconeVectorStore:
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index_name = os.getenv("PINECONE_INDEX_NAME", "finsight")
    embeddings = get_embeddings()

    return PineconeVectorStore(
        index=pc.Index(index_name),
        embedding=embeddings,
    )


def retrieve(query: str, top_k: int = TOP_K) -> str:
    vectorstore = get_vectorstore()
    docs = vectorstore.similarity_search(query, k=top_k)

    if not docs:
        return "No relevant documents found."

    results = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "Unknown")
        page = doc.metadata.get("page", "?")
        results.append(f"[{i}] Source: {source} (page {page})\n{doc.page_content}")

    return "\n\n".join(results)