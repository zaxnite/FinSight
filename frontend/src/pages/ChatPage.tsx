import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import type { AgentOutput } from "../types";

const toolLabel: Record<string, string> = {
  doc_search: "Knowledge Base",
  stock_price: "Live Market",
  budget_calc: "Calculator",
  none: "Direct",
};

const toolIcon: Record<string, string> = {
  doc_search: "📚",
  stock_price: "📈",
  budget_calc: "🧮",
  none: "💡",
};

const riskColor: Record<string, string> = {
  low: "#00D084",
  medium: "#FFB300",
  high: "#FF4757",
};

const suggestions = [
  "What are the SCA regulations for investing in UAE?",
  "What is AAPL stock price?",
  "I earn AED 15,000/month, help me budget",
  "How does compound interest work?",
];

// ── ResponseCard ──────────────────────────────────────────────────────────────
const ResponseCard = ({ output, onFollowUp }: { output: AgentOutput; onFollowUp: (q: string) => void }) => {
  const { response, tool_used } = output;
  const color = riskColor[response.risk_level];

  return (
    <div style={{
      marginTop: "8px",
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {toolIcon[tool_used]} {toolLabel[tool_used]}
          </span>
          <span style={{
            fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 500,
            color, background: color + "18",
            border: `1px solid ${color}33`,
            padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {response.risk_level} risk
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>confidence</span>
          <div style={{ width: "56px", height: "3px", background: "var(--border)", borderRadius: "2px" }}>
            <div style={{
              width: `${Math.round(response.confidence * 100)}%`,
              height: "100%", background: "var(--accent)", borderRadius: "2px",
              transition: "width 0.6s ease",
            }} />
          </div>
          <span style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)", minWidth: "28px" }}>
            {Math.round(response.confidence * 100)}%
          </span>
        </div>
      </div>

      {response.sources.length > 0 && (
        <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: "5px", borderBottom: "1px solid var(--border)" }}>
          {response.sources.map((src, i) => (
            <span key={i} style={{
              fontSize: "10px", color: "var(--text-muted)",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              padding: "2px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)",
            }}>{src}</span>
          ))}
        </div>
      )}

      {response.follow_up.length > 0 && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {response.follow_up.map((q, i) => (
            <button key={i} onClick={() => onFollowUp(q)} style={{
              fontSize: "11px", color: "var(--accent)",
              background: "var(--accent-dim)", border: "1px solid #00D08430",
              padding: "4px 12px", borderRadius: "20px",
              fontFamily: "var(--font)", transition: "var(--transition)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#00D08425"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-dim)"; }}
            >{q}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({
  conversations, activeId, onSelect, onNew, onHome, onDelete, onStar, onRename,
}: {
  conversations: { id: string; title: string; starred: boolean; createdAt: Date }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onHome: () => void;
  onDelete: (id: string) => void;
  onStar: (id: string) => void;
  onRename: (id: string) => void;
}) => (
  <div style={{
    width: "240px", flexShrink: 0,
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
    height: "100%",
  }}>
    {/* Logo */}
    <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img src="/logo2.png" alt="FinSight" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.01em" }}>FinSight</div>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            AI Finance Advisor
          </div>
        </div>
      </div>
    </div>

    {/* New Chat */}
    <div style={{ padding: "12px" }}>
      <button onClick={onNew} style={{
        width: "100%", padding: "9px 14px",
        background: "var(--accent-dim)", border: "1px solid #00D08430",
        borderRadius: "var(--radius-sm)", color: "var(--accent)",
        fontSize: "13px", fontWeight: 600,
        display: "flex", alignItems: "center", gap: "8px",
        transition: "var(--transition)",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "#00D08425"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-dim)"; }}
      >
        <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
        New Chat
      </button>
    </div>

    {/* Conversations */}
    <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
      {conversations.length === 0 ? (
        <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          No conversations yet
        </div>
      ) : (
        <>
          {/* Starred */}
          {conversations.some(c => c.starred) && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "8px 8px 4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Starred
              </div>
              {conversations.filter(c => c.starred).map(c => (
                <ConvItem key={c.id} c={c} activeId={activeId} onSelect={onSelect} onDelete={onDelete} onStar={onStar} onRename={onRename} />
              ))}
            </>
          )}

          {/* Recent */}
          {conversations.some(c => !c.starred) && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "8px 8px 4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Recent
              </div>
              {conversations.filter(c => !c.starred).map(c => (
                <ConvItem key={c.id} c={c} activeId={activeId} onSelect={onSelect} onDelete={onDelete} onStar={onStar} onRename={onRename} />
              ))}
            </>
          )}
        </>
      )}
    </div>

    {/* Back to Home */}
    <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
      <button onClick={onHome} style={{
        width: "100%", padding: "8px 14px",
        background: "transparent", border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
        fontSize: "12px", transition: "var(--transition)",
        display: "flex", alignItems: "center", gap: "6px",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
      >
        ← Back to Home
      </button>
    </div>
  </div>
);

// ── ConvItem ──────────────────────────────────────────────────────────────────
const ConvItem = ({ c, activeId, onSelect, onDelete, onStar, onRename }: {
  c: { id: string; title: string; starred: boolean };
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStar: (id: string) => void;
  onRename: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "2px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button onClick={() => onSelect(c.id)} style={{
        flex: 1, padding: "8px 10px",
        paddingRight: hovered ? "72px" : "10px",
        background: activeId === c.id ? "var(--bg-elevated)" : "transparent",
        border: "none",
        borderLeft: activeId === c.id ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: "0 var(--radius-xs) var(--radius-xs) 0",
        color: activeId === c.id ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: "12px", textAlign: "left",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "var(--transition)", width: "100%",
      }}
        onMouseEnter={e => { if (activeId !== c.id) e.currentTarget.style.background = "var(--bg-elevated)"; }}
        onMouseLeave={e => { if (activeId !== c.id) e.currentTarget.style.background = "transparent"; }}
      >
        {c.title}
      </button>

      {hovered && (
        <div style={{
          position: "absolute", right: "4px",
          display: "flex", gap: "1px", alignItems: "center",
          background: "var(--bg-elevated)",
          borderRadius: "4px", padding: "2px",
          border: "1px solid var(--border)",
        }}>
          {/* Star */}
          <ActionBtn
            onClick={() => onStar(c.id)}
            title="Star"
            icon="★"
            defaultColor={c.starred ? "#FFB300" : "var(--text-muted)"}
            hoverColor="#FFB300"
          />
          {/* Rename */}
          <ActionBtn
            onClick={() => onRename(c.id)}
            title="Rename"
            icon="✎"
            defaultColor="var(--text-muted)"
            hoverColor="var(--cyan)"
          />
          {/* Delete */}
          <ActionBtn
            onClick={() => onDelete(c.id)}
            title="Delete"
            icon="✕"
            defaultColor="var(--text-muted)"
            hoverColor="var(--red)"
          />
        </div>
      )}
    </div>
  );
};

// ── ActionBtn ─────────────────────────────────────────────────────────────────
const ActionBtn = ({ onClick, title, icon, defaultColor, hoverColor }: {
  onClick: () => void;
  title: string;
  icon: string;
  defaultColor: string;
  hoverColor: string;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "transparent", border: "none",
        color: hovered ? hoverColor : defaultColor,
        fontSize: "11px", padding: "3px 5px",
        borderRadius: "3px", cursor: "pointer",
        transition: "color var(--transition)",
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  );
};

// ── ChatPage ──────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const navigate = useNavigate();
  const { conversations, setConversations, activeConversation, activeId, loading, send, newConversation, setActiveId } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, loading]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await send(msg);
  }, [input, loading, send]);

  const handleTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId, setActiveId, setConversations]);

  const handleStar = useCallback((id: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c)
    );
  }, [setConversations]);

  const handleRename = useCallback((id: string) => {
    const current = conversations.find(c => c.id === id);
    const newTitle = window.prompt("Rename conversation:", current?.title);
    if (newTitle?.trim()) {
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title: newTitle.trim() } : c)
      );
    }
  }, [conversations, setConversations]);

  const messages = activeConversation?.messages || [];

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newConversation}
        onHome={() => navigate("/")}
        onDelete={handleDelete}
        onStar={handleStar}
        onRename={handleRename}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{
          padding: "12px 20px", borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {activeConversation ? activeConversation.title : "New Conversation"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              claude-haiku-4-5
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column" }}>

          {messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: "480px" }}>
              <img src="/logo.png" alt="FinSight" style={{ width: "220px", height: "220px", objectFit: "contain", marginBottom: "20px" }} />
              <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
                How can I help you today?
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: 1.6 }}>
                Ask me about UAE finance, investing, budgeting,<br />or live stock and crypto prices.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => handleSend(s)} style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", padding: "8px 14px",
                    borderRadius: "20px", fontSize: "12px",
                    transition: "var(--transition)",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "20px",
              animation: "fadeUp 0.2s ease",
            }}>
              <div style={{ maxWidth: "74%" }}>
                <div style={{
                  background: msg.role === "user" ? "var(--accent-dim)" : "var(--bg-elevated)",
                  border: `1px solid ${msg.role === "user" ? "#00D08430" : "var(--border)"}`,
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "12px 16px",
                  fontSize: "14px", lineHeight: "1.7",
                  color: msg.role === "user" ? "var(--accent)" : "var(--text-primary)",
                }}>
                  <ReactMarkdown components={{
                    p: ({ children }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ color: "var(--accent)", fontWeight: 600 }}>{children}</strong>,
                    ul: ({ children }) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                    h1: ({ children }) => <h1 style={{ fontSize: "16px", fontWeight: 700, margin: "8px 0 4px" }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "8px 0 4px" }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "6px 0 4px" }}>{children}</h3>,
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {msg.agentOutput && (
                  <ResponseCard output={msg.agentOutput} onFollowUp={handleSend} />
                )}

                <div style={{
                  fontSize: "10px", color: "var(--text-muted)",
                  marginTop: "4px", fontFamily: "var(--font-mono)",
                  textAlign: msg.role === "user" ? "right" : "left",
                }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", animation: "fadeUp 0.2s ease" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: "var(--accent)",
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                FinSight is thinking...
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", gap: "10px", alignItems: "center",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius)", padding: "10px 14px",
            transition: "border-color var(--transition)",
          }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = "#00D08450")}
            onBlurCapture={e => (e.currentTarget.style.borderColor = "var(--border-light)")}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextarea}
              onKeyDown={handleKey}
              placeholder="Ask about UAE finance, stocks, or budgeting..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--text-primary)", fontSize: "14px",
                fontFamily: "var(--font)", lineHeight: "24px", resize: "none",
                maxHeight: "120px", overflowY: "auto", padding: "0",
              }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{
              background: input.trim() && !loading ? "var(--accent)" : "var(--bg-hover)",
              color: input.trim() && !loading ? "#080B10" : "var(--text-muted)",
              border: "none", borderRadius: "var(--radius-sm)",
              width: "36px", height: "36px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", fontWeight: 700,
              transition: "var(--transition)",
              boxShadow: input.trim() && !loading ? "var(--glow)" : "none",
            }}>↑</button>
          </div>
          <div style={{ textAlign: "center", marginTop: "6px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}