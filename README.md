# FinSight
### AI-Powered Personal Finance Advisor for UAE Residents

A production-grade AI finance assistant built with **Claude API**, **LangGraph**, **LangChain**, **Pinecone**, and **LangFuse** — demonstrating agentic RAG pipelines, real-time streaming, structured outputs, input guardrails, and LLM observability on real-world fintech use cases.

**Frontend:** React + TypeScript + Vite  
**Backend:** Python + FastAPI

---

## Features

- **Agentic AI** — LangGraph-powered agent with a guardrail, reasoner, tool, and responder node. Decides whether to search documents, fetch live market data, or run budget calculations
- **Input Guardrails** — Pre-flight check blocks non-financial questions before they reach the agent, saving tokens and improving reliability
- **RAG Pipeline** — 1,733 chunks from 8 UAE financial documents indexed in Pinecone. Semantic search retrieves the most relevant context for every question
- **Live Market Data** — Real-time stock and crypto prices via yfinance. Supports any company name or ticker symbol (TSLA, AAPL, BTC-USD, Emirates NBD)
- **Budget Calculator** — 50/30/20 rule applied to user income and expenses with AED-denominated breakdowns
- **Streaming Responses** — Server-sent events stream Claude's answer word by word with a typing animation
- **Conversation Memory** — Last 6 messages passed as context so Claude remembers salary, goals, and prior advice within a session
- **Structured Outputs** — Every response validated against a Pydantic schema returning advice, confidence score, risk level, sources, and follow-up questions
- **LangFuse Observability** — Every LLM call traced end-to-end with token usage, latency, and cost tracking per session
- **User Feedback Scores** — Thumbs up/down on every response sends a score to LangFuse for model evaluation
- **Clickable Sources** — Source PDFs open directly in the browser from the response card

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Claude API (Anthropic) — claude-haiku-4-5 |
| Orchestration | LangChain + LangGraph |
| Vector Database | Pinecone (1,733 vectors) |
| Embeddings | OpenAI text-embedding-3-small |
| Observability | LangFuse |
| Backend | FastAPI + Uvicorn |
| Frontend | React + TypeScript + Vite |
| Streaming | Server-Sent Events (SSE) |
| Language | Python 3.11+ / Node.js 22+ |

---

## Project Structure

```
FinSight/
│
├── backend/
│   ├── main.py                     # FastAPI entry point + /chat/stream, /score, /docs-files
│   │
│   ├── agent/
│   │   ├── graph.py                # LangGraph compiled graph with conditional guardrail edge
│   │   ├── nodes.py                # guardrail, reasoner, tool, responder, stream_responder
│   │   └── state.py                # AgentState schema
│   │
│   ├── rag/
│   │   ├── pipeline.py             # Pinecone similarity search + retrieval
│   │   ├── ingest.py               # Batched PDF ingestion with deduplication log
│   │   └── embeddings.py           # OpenAI embedding model setup
│   │
│   ├── tools/
│   │   ├── doc_search.py           # Pinecone RAG retrieval tool
│   │   ├── stock_price.py          # Live price fetcher with company name resolution
│   │   └── budget_calc.py          # 50/30/20 budget calculator
│   │
│   ├── structured/
│   │   └── output_schema.py        # FinanceResponse, AgentInput, AgentOutput (Pydantic)
│   │
│   ├── observability/
│   │   └── langfuse_client.py      # LangFuse tracing, scoring, and callback setup
│   │
│   ├── data/
│   │   ├── docs/                   # 8 UAE financial PDFs (1,733 indexed chunks)
│   │   └── ingested.json           # Deduplication log
│   │
│   └── requirements.txt
│
└── frontend/
    ├── public/
    │   └── logo.png
    │
    └── src/
        ├── App.tsx                 # React Router setup
        ├── main.tsx                # Entry point
        │
        ├── pages/
        │   ├── LandingPage.tsx     # Animated landing page with stats, features, tech stack
        │   └── ChatPage.tsx        # Full chat UI with sidebar, streaming, modals
        │
        ├── hooks/
        │   └── useChat.ts          # Conversation state management
        │
        ├── services/
        │   └── api.ts              # streamMessage(), sendMessage(), scoreResponse()
        │
        ├── types/
        │   └── index.ts            # Shared TypeScript interfaces
        │
        └── styles/
            └── globals.css         # Design system — dark fintech theme
```

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- API keys for: Anthropic, OpenAI, Pinecone, LangFuse

### 1. Clone the repo

```bash
git clone https://github.com/zaxnite/finsight.git
cd finsight
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Edit `.env` and fill in your keys:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=finsight
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

```bash
# Ingest financial documents into Pinecone (run once, takes ~2 minutes)
python rag/ingest.py

# Start the backend server
python -m uvicorn main:app --reload --app-dir backend
```

Backend runs at `http://localhost:8000`  
API docs available at `http://localhost:8000/docs`

### 3. Frontend

Open a second terminal:

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# .env should contain: VITE_API_URL=http://localhost:8000

# Start the dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

### 4. Verify everything is running

- Landing page: `http://localhost:5173`
- Chat: `http://localhost:5173/chat`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

---

## Agent Flow

```
User Input
    │
    ▼
[Guardrail Node] — blocks non-financial questions
    │
    ▼ (finance-related only)
[Reasoner Node] — decides which tool to use
    │
    ├── doc_search    → Pinecone semantic search across 1,733 UAE financial chunks
    ├── stock_price   → live price for any company name or ticker via yfinance
    └── budget_calc   → 50/30/20 rule applied to user income and expenses
    │
    ▼
[Responder Node] — Claude generates structured FinanceResponse
    │
    ▼
{ advice, confidence, risk_level, sources, follow_up }
    │
    ▼
SSE Stream → React UI (word by word with typing animation)
    │
    ▼
LangFuse — traces all LLM calls, token usage, cost, latency
```

---

## Structured Output Schema

```python
class FinanceResponse(BaseModel):
    advice: str           # Financial advice
    confidence: float     # 0.0 to 1.0
    risk_level: str       # "low" | "medium" | "high"
    sources: list[str]    # Referenced document filenames
    follow_up: list[str]  # Suggested follow-up questions
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/chat` | Non-streaming chat |
| POST | `/chat/stream` | Streaming chat via SSE with memory and guardrails |
| POST | `/score` | Submit user feedback score to LangFuse |
| GET | `/docs-files/{filename}` | Serve source PDFs for in-browser viewing |

---

## Financial Documents Indexed

| Document | Coverage |
|---|---|
| CBUAE Financial Stability Report 2025 | UAE banking system, monetary policy |
| UAE Federal Budget 2026 | Government finance, sector allocations |
| UAE Investment Guide | Investment laws, foreign ownership, free zones |
| CT Guide — Investment Funds 2024 | UAE corporate tax, fund taxation |
| DLA Piper — UAE Investment Rules | Securities law, SCA regulations |
| Navigating SCA Amendments 2024 | Latest UAE securities governance |
| SEC Savings and Investing Guide | Personal finance fundamentals |
| Savings Investing for Students | Beginner investing concepts |

---

## Roadmap

- [x] LangGraph agentic orchestration with guardrails
- [x] RAG pipeline with Pinecone (1,733 vectors)
- [x] Claude structured outputs via Pydantic
- [x] Real-time SSE streaming with typing animation
- [x] Conversation memory (6-message window)
- [x] LangFuse observability with cost and token tracking
- [x] User feedback scores (thumbs up/down)
- [x] Company name to ticker resolution for stock lookups
- [x] Clickable source PDFs served via FastAPI
- [ ] Mem0 persistent cross-session memory
- [ ] PDF upload via UI
- [ ] Multi-currency support

---

## Author

**Aathif Khan** — AI Engineer  
[LinkedIn](https://www.linkedin.com/in/aathif-khan-042214201/) · [GitHub](https://github.com/zaxnite)  
Dubai, UAE