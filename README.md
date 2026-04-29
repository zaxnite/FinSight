# FinSight 💡
### AI-Powered Personal Finance Advisor

A production-grade AI finance assistant built with **Claude API**, **LangGraph**, **LangChain**, **Pinecone**, and **LangFuse** — demonstrating agentic RAG pipelines, structured outputs, and LLM observability on real-world fintech use cases.

**Frontend:** React + TypeScript  
**Backend:** Python FastAPI  

---

## 🚀 Features

- **Agentic AI** — LangGraph-powered agent that decides whether to search documents, fetch live data, or calculate budgets
- **RAG Pipeline** — Financial documents indexed in Pinecone for grounded, accurate responses
- **Structured Outputs** — Claude returns validated JSON with advice, confidence score, and risk level
- **LLM Observability** — Every Claude call traced and monitored via LangFuse dashboard
- **Conversational Memory** — LangChain memory maintains context across the conversation
- **Modern UI** — React + TypeScript frontend with real-time streaming responses
- **(Optional) Persistent Memory** — Mem0 integration for cross-session user memory

---

## 🧠 Tech Stack

| Layer | Technology |
|---|---|
| LLM | Claude API (Anthropic) |
| Orchestration | LangChain + LangGraph |
| Vector Database | Pinecone |
| Observability | LangFuse |
| Backend | FastAPI + Uvicorn |
| Frontend | React + TypeScript |
| Language | Python 3.11+ / Node.js 18+ |
| Optional Memory | Mem0 |

---

## 📁 Project Structure

```
finsight/
│
├── backend/                        # Python FastAPI server
│   │
│   ├── main.py                     # FastAPI app entry point + routes
│   │
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── graph.py                # LangGraph agent graph definition
│   │   ├── nodes.py                # Graph nodes (reasoner, responder)
│   │   └── state.py                # Agent state schema
│   │
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── pipeline.py             # RAG query pipeline
│   │   ├── ingest.py               # Document ingestion + Pinecone indexing
│   │   └── embeddings.py           # Embedding model setup
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── doc_search.py           # Pinecone document retrieval tool
│   │   ├── stock_price.py          # Live stock/crypto price fetcher tool
│   │   └── budget_calc.py          # Budget and savings calculator tool
│   │
│   ├── structured/
│   │   ├── __init__.py
│   │   └── output_schema.py        # Claude structured output schemas (Pydantic)
│   │
│   ├── observability/
│   │   ├── __init__.py
│   │   └── langfuse_client.py      # LangFuse tracing setup
│   │
│   ├── memory/                     # Optional — Mem0 integration
│   │   ├── __init__.py
│   │   └── mem0_client.py
│   │
│   ├── data/
│   │   └── docs/                   # Sample financial PDFs for ingestion
│   │       ├── investing_basics.pdf
│   │       ├── budgeting_guide.pdf
│   │       └── uae_finance_guide.pdf
│   │
│   ├── .env.example
│   ├── .gitignore
│   └── requirements.txt
│
└── frontend/                       # React + TypeScript app
    │
    ├── public/
    │   └── index.html
    │
    ├── src/
    │   ├── main.tsx                # React entry point
    │   ├── App.tsx                 # Root component + routing
    │   │
    │   ├── components/
    │   │   ├── Chat/
    │   │   │   ├── ChatWindow.tsx  # Main chat interface
    │   │   │   ├── MessageBubble.tsx
    │   │   │   ├── InputBar.tsx
    │   │   │   └── TypingIndicator.tsx
    │   │   │
    │   │   ├── Sidebar/
    │   │   │   ├── Sidebar.tsx     # Conversation history
    │   │   │   └── ConversationItem.tsx
    │   │   │
    │   │   ├── ResponseCard/
    │   │   │   ├── ResponseCard.tsx    # Structured output display
    │   │   │   ├── ConfidenceBadge.tsx # Confidence score indicator
    │   │   │   └── RiskBadge.tsx       # Risk level indicator
    │   │   │
    │   │   └── ui/                 # Shared UI components
    │   │       ├── Button.tsx
    │   │       ├── Input.tsx
    │   │       └── Spinner.tsx
    │   │
    │   ├── hooks/
    │   │   ├── useChat.ts          # Chat state + API calls
    │   │   └── useStream.ts        # SSE streaming hook
    │   │
    │   ├── services/
    │   │   └── api.ts              # FastAPI client
    │   │
    │   ├── types/
    │   │   └── index.ts            # Shared TypeScript types
    │   │
    │   └── styles/
    │       └── globals.css
    │
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── .env.example
```

---

## ⚙️ Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- API keys for Anthropic, Pinecone, LangFuse

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Fill in your API keys in .env

# Ingest financial documents into Pinecone
python rag/ingest.py

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000

# Start the dev server
npm run dev
```

App runs at `http://localhost:5173`

---

## 🔁 Agent Flow (LangGraph)

```
User Input (React)
      │
      ▼
  FastAPI /chat endpoint
      │
      ▼
  [Reasoner Node] ── decides which tool to use
      │
      ├──► [doc_search]     → searches Pinecone RAG index
      ├──► [stock_price]    → fetches live market data
      └──► [budget_calc]    → runs financial calculations
      │
      ▼
  [Responder Node] ── Claude generates structured output
      │
      ▼
  { advice, confidence, risk_level, sources, follow_up }
      │
      ▼
  [LangFuse] ── traces entire run
      │
      ▼
  SSE Stream → React UI
```

---

## 📊 Structured Output Schema

Every response from Claude is validated against:

```python
{
  "advice": str,           # The financial advice
  "confidence": float,     # 0.0 - 1.0
  "risk_level": str,       # "low" | "medium" | "high"
  "sources": list[str],    # Documents referenced
  "follow_up": list[str]   # Suggested follow-up questions
}
```

---

## 🔍 LangFuse Observability

All LLM calls are automatically traced. Access your LangFuse dashboard to monitor:
- Token usage per query
- Latency per node in the graph
- Full prompt and response logs
- Cost tracking per session

---

## 🌐 Deployment

**Backend** — Railway or Render (free tier)

**Frontend** — Vercel (free tier)
```bash
vercel deploy
```

---

## 📦 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` | Send a message, returns SSE stream |
| POST | `/ingest` | Upload a PDF to the RAG index |
| GET | `/history` | Get conversation history |
| DELETE | `/history` | Clear conversation history |

---

## 🗺️ Roadmap

- [x] LangGraph agentic orchestration
- [x] RAG pipeline with Pinecone
- [x] Claude structured outputs
- [x] LangFuse observability
- [x] React + TypeScript frontend
- [x] FastAPI streaming backend
- [ ] Mem0 persistent memory (optional)
- [ ] PDF upload via UI
- [ ] Multi-currency support

---

## 👤 Author

**Aathif Khan** — AI Engineer  
[LinkedIn](https://linkedin.com/in/yourprofile) · [GitHub](https://github.com/yourusername)  
Dubai, UAE