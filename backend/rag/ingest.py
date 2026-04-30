import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import time
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from rag.embeddings import get_embeddings

load_dotenv()

DOCS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "docs")
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
BATCH_SIZE = 50


def load_pdfs(docs_path: str) -> list:
    documents = []
    pdf_files = [f for f in os.listdir(docs_path) if f.endswith(".pdf")]

    if not pdf_files:
        print("❌ No PDF files found in data/docs/")
        sys.exit(1)

    for filename in pdf_files:
        filepath = os.path.join(docs_path, filename)
        loader = PyPDFLoader(filepath)
        pages = loader.load()
        for page in pages:
            page.metadata["source"] = filename
        documents.extend(pages)
        print(f"  📄 Loaded: {filename} ({len(pages)} pages)")

    return documents


def split_documents(documents: list) -> list:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", " "],
    )
    chunks = splitter.split_documents(documents)
    print(f"  ✂️  Split into {len(chunks)} chunks")
    return chunks


def ingest():
    print("\n🚀 Starting FinSight document ingestion...\n")

    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index_name = os.getenv("PINECONE_INDEX_NAME", "finsight")

    available = [i.name for i in pc.list_indexes()]
    if index_name not in available:
        print(f"❌ Index '{index_name}' not found in Pinecone. Create it first.")
        sys.exit(1)

    print("📂 Loading PDFs...")
    documents = load_pdfs(DOCS_PATH)

    print("\n✂️  Splitting documents...")
    chunks = split_documents(documents)

    print("\n📤 Embedding and uploading to Pinecone...")
    embeddings = get_embeddings()
    total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    vectorstore = None

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"  📦 Batch {batch_num}/{total_batches} ({len(batch)} chunks)...")

        if vectorstore is None:
            vectorstore = PineconeVectorStore.from_documents(
                documents=batch,
                embedding=embeddings,
                index_name=index_name,
            )
        else:
            vectorstore.add_documents(batch)

        time.sleep(3)

    print(f"\n✅ Ingestion complete — {len(chunks)} chunks uploaded to '{index_name}'")
    return vectorstore


if __name__ == "__main__":
    ingest()