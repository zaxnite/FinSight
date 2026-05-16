# FinSight
### AI-Powered Personal Finance Advisor for UAE Residents

A production-grade AI finance assistant built with **Claude API**, **LangGraph**, **LangChain**, **Pinecone**, and **LangFuse** — demonstrating agentic RAG pipelines, real-time streaming, structured outputs, input guardrails, rate limiting, confidence-based fallbacks, and LLM observability on real-world fintech use cases.

**Frontend:** React + TypeScript + Vite  
**Backend:** Python + FastAPI

---

## Features

- **Agentic AI** — LangGraph-powered agent with a guardrail, reasoner, tool, and responder node. Decides whether to search documents, fetch live market data, or run budget calculations
- **Input Guardrails** — Pre-flight check blocks non-financial questions before they reach the agent, saving tokens and improving reliability
- **RAG Pipeline** — 3,250 vectors from 12 UAE financial documents indexed in Pinecone. Semantic search retrieves the most relevant context for every question
- **Confidence Fallback** — If response confidence is below 0.6, automatically retries with a broader retrieval strategy. If still low, returns an honest "insufficient information" message rather than hallucinating
- **Rate Limiting** — SlowAPI rate limiter: 10 requests/minute on chat endpoints, 30/minute on scoring. Returns clean 429 JSON responses
- **Live Market Data** — Real-time stock and crypto prices via yfinance. Supports any company name or ticker symbol (TSLA, AAPL, BTC-USD, Emirates NBD)
- **Budget Calculator** — 50/30/20 rule applied to user income and expenses with AED-denominated breakdowns
- **Streaming Responses** — Server-sent events stream Claude's answer word by word with a typing animation
- **Conversation Memory** — Last 6 messages passed as context so Claude remembers salary, goals, and prior advice within a session
- **Structured Outputs** — Every response validated against a Pydantic schema returning advice, confidence score, risk level, sources, and follow-up questions
- **LangFuse Observability** — Every LLM call traced end-to-end with token usage, latency, and cost tracking per session
- **User Feedback Scores** — Thumbs up/down on every response sends a score to LangFuse for model evaluation
- **Source Tooltips** — Hovering over source chips shows a description of each document. Clicking opens the PDF directly in the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Claude API (Anthropic) — claude-haiku-4-5-20251001 |
| Orchestration | LangChain + LangGraph |
| Vector Database | Pinecone (3,250 vectors) |
| Embeddings | OpenAI text-embedding-3-small |
| Observability | LangFuse v4 |
| Rate Limiting | SlowAPI |
| Backend | FastAPI + Uvicorn |
| Frontend | React + TypeScript + Vite |
| Streaming | Server-Sent Events (SSE) |
| Language | Python 3.11+ / Node.js 18+ |

---

## Project Structure

```
FinSight/
│
├── backend/
│   ├── main.py                     # FastAPI entry point — /chat/stream, /score, /health, /docs-files
│   │                               # Rate limiting via SlowAPI
│   ├── agent/
│   │   ├── graph.py                # LangGraph compiled graph with conditional guardrail edge
│   │   ├── nodes.py                # guardrail, reasoner, tool, responder, stream_responder
│   │   │                           # confidence_fallback() for low-confidence retry logic
│   │   └── state.py                # AgentState Pydantic schema
│   │
│   ├── rag/
│   │   ├── pipeline.py             # Pinecone similarity search + retrieval
│   │   ├── ingest.py               # Batched PDF ingestion with deduplication log
│   │   └── embeddings.py           # OpenAI embedding model setup
│   │
│   ├── tools/
│   │   ├── doc_search.py           # Pinecone RAG retrieval tool
│   │   ├── stock_price.py          # Live price fetcher with company name → ticker resolution
│   │   └── budget_calc.py          # 50/30/20 budget calculator
│   │
│   ├── structured/
│   │   └── output_schema.py        # FinanceResponse, AgentInput, AgentOutput (Pydantic)
│   │
│   ├── observability/
│   │   └── langfuse_client.py      # LangFuse v4 tracing, scoring, and callback setup
│   │
│   ├── data/
│   │   ├── docs/                   # 12 UAE financial PDFs (3,250 indexed chunks)
│   │   └── ingested.json           # Deduplication log — tracks ingested filenames
│   │
│   └── requirements.txt
│
└── frontend/
    ├── public/
    │   └── logo.png
    │
    └── src/
        ├── App.tsx                 # React Router setup with lazy-loaded ChatPage
        ├── main.tsx                # Entry point
        │
        ├── pages/
        │   ├── LandingPage.tsx     # Animated landing page with stats, features, tech stack
        │   └── ChatPage.tsx        # Full chat UI — sidebar, streaming, source tooltips, modals
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
# Ingest financial documents into Pinecone (run once, ~5 minutes)
python rag/ingest.py

# Start the backend server
uvicorn main:app --reload
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

| URL | What you should see |
|---|---|
| `http://localhost:5173` | Landing page |
| `http://localhost:5173/chat` | Chat interface |
| `http://localhost:8000/health` | `{"status":"ok","version":"1.0.0",...}` |
| `http://localhost:8000/docs` | FastAPI Swagger UI |

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
    ├── doc_search    → Pinecone semantic search across 3,250 UAE financial chunks
    ├── stock_price   → live price for any company name or ticker via yfinance
    └── budget_calc   → 50/30/20 rule applied to user income and expenses
    │
    ▼
[Tool Node] — executes selected tool
    │
    ▼
[Responder Node] — Claude generates structured FinanceResponse via SSE stream
    │
    ▼
Confidence check — if score < 0.6:
    ├── Retry with broader doc_search query
    └── If still low → honest "insufficient information" message
    │
    ▼
{ advice, confidence, risk_level, sources, follow_up }
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
| GET | `/health` | Health check — returns version, model, uptime, docs indexed |
| POST | `/chat` | Non-streaming chat (10 req/min) |
| POST | `/chat/stream` | Streaming chat via SSE — memory, guardrails, confidence fallback (10 req/min) |
| POST | `/score` | Submit user feedback score to LangFuse (30 req/min) |
| GET | `/docs-files/{filename}` | Serve source PDFs for in-browser viewing |

---

## Financial Documents Indexed (12 documents — 3,250 vectors)

| Document | Coverage |
|---|---|
| CBUAE Guidance Note — AI/ML Consumer Protection | Central Bank principles for responsible AI use by financial institutions |
| CBUAE Consumer Protection Regulation (Circular 8-2020) | Foundational UAE consumer protection framework for financial services |
| CBUAE Consumer Protection Standards (Circular 8-2020) | Detailed standards on disclosure, conduct, and complaint resolution |
| CBUAE Financial Stability Report 2024 | UAE banking system health, macro-financial resilience, emerging risks |
| UAE Federal Budget Yearbook 2026 | Government finance, strategic investments in people and infrastructure |
| Baker McKenzie — Doing Business in UAE 2025 | Corporate structures, taxation, free zones, compliance |
| Pannike+Partners — UAE Investment Guide 2025 | Foreign investment, free zones, business structures, sector compliance |
| DLA Piper — UAE Investment Rules Guide | Capital markets, securities law, SCA regulations, FinTech compliance |
| PwC — SCA Corporate Governance Amendments 2024 | UAE Securities Authority 2024 governance reforms |
| UAE FTA — Corporate Tax Guide for Investment Funds 2024 | Corporate tax, fund taxation, REIT rules, Investment Manager Exemption |
| SEC — Investor Roadmap to Financial Security | Step-by-step personal finance and investing fundamentals |
| SEC — Student Guide: Saving & Investing Basics | Beginner investing concepts and investor protection |

---

## Roadmap

- [x] LangGraph agentic orchestration with guardrails
- [x] RAG pipeline with Pinecone (3,250 vectors, 12 documents)
- [x] Claude structured outputs via Pydantic
- [x] Real-time SSE streaming with typing animation
- [x] Conversation memory (6-message window)
- [x] LangFuse v4 observability — cost, token, and latency tracking
- [x] User feedback scores (thumbs up/down → LangFuse)
- [x] Company name → ticker resolution for stock lookups
- [x] Clickable source PDFs with hover description tooltips
- [x] Confidence threshold fallback with honest low-confidence messaging
- [x] Rate limiting via SlowAPI (429 with clean JSON response)
- [x] Enhanced /health endpoint — version, uptime, model, docs indexed
- [ ] PDF upload via UI
- [ ] Multi-currency support
- [ ] Persistent cross-session memory

---

## Author

**Aathif Khan** — AI Engineer  
[LinkedIn](https://www.linkedin.com/in/aathif-khan-042214201/) · [GitHub](https://github.com/zaxnite)  
Dubai, UAE