import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { streamMessage } from "../services/api";
import type { AgentOutput } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const scoreResponse = async (session_id: string, value: number) => {
  try {
    await fetch(`${BASE_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, value }),
    });
  } catch (e) {
    console.error("Score error:", e);
  }
};

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatContent = (text: string) =>
  text
    .replace(/^•\s+/gm, "- ")
    .replace(/(?<!\n)•\s+/g, "\n- ")
    .replace(/\s•\s/g, "\n- ");

// ── Modal Base ────────────────────────────────────────────────────────────────
const Modal = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div onClick={onClose} style={{
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(0,0,0,0.6)", display: "flex",
    alignItems: "center", justifyContent: "center",
    backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease",
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      background: "var(--bg-surface)", border: "1px solid var(--border-light)",
      borderRadius: "var(--radius)", padding: "24px", width: "360px",
      boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "slideUp 0.15s ease",
    }}>
      {children}
    </div>
  </div>
);

// ── Rename Modal ──────────────────────────────────────────────────────────────
const RenameModal = ({ currentTitle, onConfirm, onClose }: {
  currentTitle: string; onConfirm: (title: string) => void; onClose: () => void;
}) => {
  const [value, setValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const handleConfirm = () => { if (value.trim()) onConfirm(value.trim()); };
  return (
    <Modal onClose={onClose}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>Rename Conversation</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Enter a new name for this conversation</div>
      </div>
      <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onClose(); }}
        style={{
          width: "100%", padding: "10px 12px",
          background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
          fontSize: "14px", fontFamily: "var(--font)", outline: "none",
          marginBottom: "16px", boxSizing: "border-box", transition: "border-color var(--transition)",
        }}
        onFocus={e => (e.target.style.borderColor = "#00D08450")}
        onBlur={e => (e.target.style.borderColor = "var(--border-light)")}
      />
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{
          padding: "8px 16px", background: "transparent",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          color: "var(--text-secondary)", fontSize: "13px", transition: "var(--transition)",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >Cancel</button>
        <button onClick={handleConfirm} disabled={!value.trim()} style={{
          padding: "8px 16px",
          background: value.trim() ? "var(--accent)" : "var(--bg-hover)",
          border: "none", borderRadius: "var(--radius-sm)",
          color: value.trim() ? "#080B10" : "var(--text-muted)",
          fontSize: "13px", fontWeight: 600, transition: "var(--transition)",
        }}>Rename</button>
      </div>
    </Modal>
  );
};

// ── Delete Modal ──────────────────────────────────────────────────────────────
const DeleteModal = ({ title, onConfirm, onClose }: {
  title: string; onConfirm: () => void; onClose: () => void;
}) => (
  <Modal onClose={onClose}>
    <div style={{ marginBottom: "20px" }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "50%",
        background: "#FF475718", border: "1px solid #FF475733",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px", marginBottom: "12px",
      }}>🗑</div>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>Delete Conversation</div>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Are you sure you want to delete <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>"{title}"</span>? This action cannot be undone.
      </div>
    </div>
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
      <button onClick={onClose} style={{
        padding: "8px 16px", background: "transparent",
        border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        color: "var(--text-secondary)", fontSize: "13px", transition: "var(--transition)",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
      >Cancel</button>
      <button onClick={onConfirm} style={{
        padding: "8px 16px", background: "#FF4757", border: "none",
        borderRadius: "var(--radius-sm)", color: "#fff",
        fontSize: "13px", fontWeight: 600, transition: "var(--transition)",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "#FF6B6B"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#FF4757"; }}
      >Delete</button>
    </div>
  </Modal>
);

// ── ResponseCard ──────────────────────────────────────────────────────────────
// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setShow(true);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "fixed",
          left: pos.x,
          top: pos.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#1A2233", border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-xs)", padding: "7px 12px",
          fontSize: "11px", color: "var(--text-primary)",
          whiteSpace: "normal", zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          pointerEvents: "none", lineHeight: 1.6,
          maxWidth: "220px",
        }}>
          {text}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid var(--border-light)",
          }} />
        </div>
      )}
    </div>
  );
};

// ── ResponseCard ──────────────────────────────────────────────────────────────
const ResponseCard = ({ output, onFollowUp }: { output: AgentOutput; onFollowUp: (q: string) => void }) => {
  const { response, tool_used, session_id } = output;
  const color = riskColor[response.risk_level];
  const [scored, setScored] = useState<number | null>(null);

  const handleScore = async (value: number) => {
    setScored(value);
    await scoreResponse(session_id, value);
  };
  return (
    <div style={{
      marginTop: "8px", background: "var(--bg-surface)",
      border: "1px solid var(--border)", borderRadius: "var(--radius)",
      animation: "fadeUp 0.3s ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)", overflow: "visible", position: "relative", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {toolIcon[tool_used]} {toolLabel[tool_used]}
          </span>
          <Tooltip text={
            response.risk_level === "low"
              ? "This is safe advice like budgeting, saving, or general knowledge, no risky moves."
              : response.risk_level === "medium"
              ? "It involves investing money, there is some risk as values can go up or down."
              : "These include stocks, crypto, or active trading. Only invest what you can afford to lose."
          }>
            <span style={{
              fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 500,
              color, background: color + "18", border: `1px solid ${color}33`,
              padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase",
              letterSpacing: "0.05em", cursor: "default",
            }}>{response.risk_level} risk</span>
          </Tooltip>
        </div>
        <Tooltip text="How sure FinSight is about this answer. Higher means it's backed by strong sources. Lower means you may want to double-check.">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "default" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>confidence</span>
            <div style={{ width: "56px", height: "3px", background: "var(--border)", borderRadius: "2px" }}>
              <div style={{ width: `${Math.round(response.confidence * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: "2px", transition: "width 0.6s ease" }} />
            </div>
            <span style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)", minWidth: "28px" }}>
              {Math.round(response.confidence * 100)}%
            </span>
          </div>
        </Tooltip>
      </div>
      {response.sources.length > 0 && (
        <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: "5px", borderBottom: "1px solid var(--border)" }}>
          {response.sources.map((src, i) => (
            <a key={i}
              href={`http://localhost:8000/docs-files/${encodeURIComponent(src)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "10px", color: "var(--text-muted)",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                padding: "2px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)",
                textDecoration: "none", cursor: "pointer", transition: "var(--transition)",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >{src}</a>
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

      {/* Feedback row */}
      <div style={{
        padding: "8px 14px", borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Helpful?
        </span>
        <button
          onClick={() => !scored && handleScore(1)}
          disabled={scored !== null}
          style={{
            background: scored === 1 ? "#00D08420" : "transparent",
            border: scored === 1 ? "1px solid #00D08440" : "1px solid transparent",
            borderRadius: "6px", padding: "3px 8px", cursor: scored ? "default" : "pointer",
            fontSize: "14px", transition: "var(--transition)",
          }}
          onMouseEnter={e => { if (!scored) e.currentTarget.style.background = "#00D08420"; }}
          onMouseLeave={e => { if (!scored && scored !== 1) e.currentTarget.style.background = "transparent"; }}
          title="Helpful"
        >👍</button>
        <button
          onClick={() => !scored && handleScore(0)}
          disabled={scored !== null}
          style={{
            background: scored === 0 ? "#FF475720" : "transparent",
            border: scored === 0 ? "1px solid #FF475740" : "1px solid transparent",
            borderRadius: "6px", padding: "3px 8px", cursor: scored ? "default" : "pointer",
            fontSize: "14px", transition: "var(--transition)",
          }}
          onMouseEnter={e => { if (!scored) e.currentTarget.style.background = "#FF475720"; }}
          onMouseLeave={e => { if (scored !== 0) e.currentTarget.style.background = "transparent"; }}
          title="Not helpful"
        >👎</button>
        {scored !== null && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Thanks for the feedback!
          </span>
        )}
      </div>
    </div>
  );
};

// ── ActionBtn ─────────────────────────────────────────────────────────────────
const ActionBtn = ({ onClick, title, icon, defaultColor, hoverColor }: {
  onClick: () => void; title: string; icon: string; defaultColor: string; hoverColor: string;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: "transparent", border: "none",
        color: hovered ? hoverColor : defaultColor,
        fontSize: "11px", padding: "3px 5px", borderRadius: "3px",
        cursor: "pointer", transition: "color var(--transition)", lineHeight: 1,
      }}
    >{icon}</button>
  );
};

// ── ConvItem ──────────────────────────────────────────────────────────────────
const ConvItem = ({ c, activeId, onSelect, onDelete, onStar, onRename }: {
  c: { id: string; title: string; starred: boolean };
  activeId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
  onStar: (id: string) => void; onRename: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "2px" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <button onClick={() => onSelect(c.id)} style={{
        flex: 1, padding: "8px 10px", paddingRight: hovered ? "76px" : "10px",
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
      >{c.title}</button>
      {hovered && (
        <div style={{
          position: "absolute", right: "4px",
          display: "flex", gap: "1px", alignItems: "center",
          background: "var(--bg-elevated)", borderRadius: "4px",
          padding: "2px", border: "1px solid var(--border)",
        }}>
          <ActionBtn onClick={() => onStar(c.id)} title="Star" icon="★"
            defaultColor={c.starred ? "#FFB300" : "var(--text-muted)"} hoverColor="#FFB300" />
          <ActionBtn onClick={() => onRename(c.id)} title="Rename" icon="✎"
            defaultColor="var(--text-muted)" hoverColor="var(--cyan)" />
          <ActionBtn onClick={() => onDelete(c.id)} title="Delete" icon="✕"
            defaultColor="var(--text-muted)" hoverColor="var(--red)" />
        </div>
      )}
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ conversations, activeId, onSelect, onNew, onHome, onDelete, onStar, onRename }: {
  conversations: { id: string; title: string; starred: boolean; createdAt: Date }[];
  activeId: string | null;
  onSelect: (id: string) => void; onNew: () => void; onHome: () => void;
  onDelete: (id: string) => void; onStar: (id: string) => void; onRename: (id: string) => void;
}) => (
  <div style={{
    width: "240px", flexShrink: 0, background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)", display: "flex",
    flexDirection: "column", height: "100%",
  }}>
    <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img src="/logo.png" alt="FinSight" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.01em" }}>
            <span style={{ color: "#00B8D9" }}>Fin</span><span style={{ color: "#00D084" }}>Sight</span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>AI Finance Advisor</div>
        </div>
      </div>
    </div>
    <div style={{ padding: "12px" }}>
      <button onClick={onNew} style={{
        width: "100%", padding: "9px 14px",
        background: "var(--accent-dim)", border: "1px solid #00D08430",
        borderRadius: "var(--radius-sm)", color: "var(--accent)",
        fontSize: "13px", fontWeight: 600,
        display: "flex", alignItems: "center", gap: "8px", transition: "var(--transition)",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "#00D08425"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-dim)"; }}
      >
        <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> New Chat
      </button>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
      {conversations.length === 0 ? (
        <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>No conversations yet</div>
      ) : (
        <>
          {conversations.some(c => c.starred) && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "8px 8px 4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Starred</div>
              {conversations.filter(c => c.starred).map(c => (
                <ConvItem key={c.id} c={c} activeId={activeId} onSelect={onSelect} onDelete={onDelete} onStar={onStar} onRename={onRename} />
              ))}
            </>
          )}
          {conversations.some(c => !c.starred) && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "8px 8px 4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent</div>
              {conversations.filter(c => !c.starred).map(c => (
                <ConvItem key={c.id} c={c} activeId={activeId} onSelect={onSelect} onDelete={onDelete} onStar={onStar} onRename={onRename} />
              ))}
            </>
          )}
        </>
      )}
    </div>
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
      >Back to Home</button>
    </div>
  </div>
);

// ── ChatPage ──────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const navigate = useNavigate();
  const { conversations, setConversations, activeConversation, activeId, newConversation, setActiveId } = useChat();
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamingTool, setStreamingTool] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, streamingText, isStreaming]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let sessionId = activeId;
    if (!sessionId) sessionId = newConversation();

    const { v4: uuidv4 } = await import("uuid");
    const userMsgId = uuidv4();
    setConversations(prev => prev.map(c =>
      c.id === sessionId ? {
        ...c,
        title: c.messages.length === 0 ? msg.slice(0, 42) + (msg.length > 42 ? "..." : "") : c.title,
        messages: [...c.messages, { id: userMsgId, role: "user" as const, content: msg, timestamp: new Date() }],
      } : c
    ));

    const history = (activeConversation?.messages || []).map(m => ({
      role: m.role,
      content: m.content,
    }));

    setIsStreaming(true);
    setStreamingText("");
    setStreamingTool(null);

    let fullText = "";
    const assistantMsgId = uuidv4();

    await streamMessage(
      msg,
      sessionId,
      history,
      (chunk) => {
        if (chunk.type === "tool") {
          setStreamingTool(chunk.tool_used || null);
        } else if (chunk.type === "text" && chunk.content) {
          fullText += chunk.content;
          setStreamingText(fullText);
        } else if (chunk.type === "meta") {
          const agentOutput: AgentOutput = {
            response: {
              advice: fullText,
              confidence: chunk.confidence || 0.8,
              risk_level: chunk.risk_level || "low",
              sources: chunk.sources || [],
              follow_up: chunk.follow_up || [],
            },
            tool_used: (chunk.tool_used as AgentOutput["tool_used"]) || "none",
            session_id: sessionId!,
          };
          setConversations(prev => prev.map(c =>
            c.id === sessionId ? {
              ...c,
              messages: [...c.messages, {
                id: assistantMsgId,
                role: "assistant" as const,
                content: fullText,
                agentOutput,
                timestamp: new Date(),
              }],
            } : c
          ));
          setStreamingText("");
          setStreamingTool(null);
          setIsStreaming(false);
        } else if (chunk.type === "error") {
          setStreamingText("");
          setStreamingTool(null);
          setIsStreaming(false);
        }
      },
      () => { setIsStreaming(false); setStreamingText(""); setStreamingTool(null); },
      (error) => { console.error("Stream error:", error); setIsStreaming(false); setStreamingText(""); setStreamingTool(null); }
    );
  }, [input, isStreaming, activeId, activeConversation, newConversation, setConversations]);

  const handleTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleDelete = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) setDeleteModal({ id, title: conv.title });
  }, [conversations]);

  const confirmDelete = useCallback(() => {
    if (!deleteModal) return;
    setConversations(prev => prev.filter(c => c.id !== deleteModal.id));
    if (activeId === deleteModal.id) setActiveId(null);
    setDeleteModal(null);
  }, [deleteModal, activeId, setActiveId, setConversations]);

  const handleStar = useCallback((id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
  }, [setConversations]);

  const handleRename = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) setRenameModal({ id, title: conv.title });
  }, [conversations]);

  const confirmRename = useCallback((newTitle: string) => {
    if (!renameModal) return;
    setConversations(prev => prev.map(c => c.id === renameModal.id ? { ...c, title: newTitle } : c));
    setRenameModal(null);
  }, [renameModal, setConversations]);

  const messages = activeConversation?.messages || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdComponents: any = {
    p: ({ children }: { children: React.ReactNode }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
    strong: ({ children }: { children: React.ReactNode }) => <strong style={{ color: "var(--accent)", fontWeight: 600 }}>{children}</strong>,
    ul: ({ children }: { children: React.ReactNode }) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>,
    ol: ({ children }: { children: React.ReactNode }) => <ol style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ol>,
    li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
    h1: ({ children }: { children: React.ReactNode }) => <h1 style={{ fontSize: "16px", fontWeight: 700, margin: "8px 0 4px" }}>{children}</h1>,
    h2: ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "8px 0 4px" }}>{children}</h2>,
    h3: ({ children }: { children: React.ReactNode }) => <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "6px 0 4px" }}>{children}</h3>,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>

      {renameModal && <RenameModal currentTitle={renameModal.title} onConfirm={confirmRename} onClose={() => setRenameModal(null)} />}
      {deleteModal && <DeleteModal title={deleteModal.title} onConfirm={confirmDelete} onClose={() => setDeleteModal(null)} />}

      <Sidebar
        conversations={conversations} activeId={activeId}
        onSelect={setActiveId} onNew={newConversation}
        onHome={() => navigate("/")}
        onDelete={handleDelete} onStar={handleStar} onRename={handleRename}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>claude-haiku-4-5</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column" }}>

          {messages.length === 0 && !isStreaming && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: "480px" }}>
              <img src="/logo.png" alt="FinSight" style={{ width: "100px", height: "100px", objectFit: "contain", marginBottom: "20px" }} />
              <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>How can I help you today?</div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: 1.6 }}>
                Ask me about UAE finance, investing, budgeting,<br />or live stock and crypto prices.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => handleSend(s)} style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", padding: "8px 14px",
                    borderRadius: "20px", fontSize: "12px", transition: "var(--transition)",
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
              marginBottom: "20px", animation: "fadeUp 0.2s ease",
            }}>
              <div style={{ maxWidth: "74%" }}>
                <div style={{
                  background: msg.role === "user" ? "var(--accent-dim)" : "var(--bg-elevated)",
                  border: `1px solid ${msg.role === "user" ? "#00D08430" : "var(--border)"}`,
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "12px 16px", fontSize: "14px", lineHeight: "1.7",
                  color: msg.role === "user" ? "var(--accent)" : "var(--text-primary)",
                }}>
                  <ReactMarkdown components={mdComponents}>
                    {formatContent(msg.content)}
                  </ReactMarkdown>
                </div>
                {msg.agentOutput && <ResponseCard output={msg.agentOutput} onFollowUp={handleSend} />}
                <div style={{
                  fontSize: "10px", color: "var(--text-muted)", marginTop: "4px",
                  fontFamily: "var(--font-mono)", textAlign: msg.role === "user" ? "right" : "left",
                }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "20px", animation: "fadeUp 0.2s ease" }}>
              <div style={{ maxWidth: "74%" }}>
                {streamingTool && (
                  <div style={{
                    fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                    marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", animation: "bounce 1s ease-in-out infinite" }} />
                    {toolIcon[streamingTool]} {toolLabel[streamingTool]}
                  </div>
                )}
                <div style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "14px 14px 14px 4px", padding: "12px 16px",
                  fontSize: "14px", lineHeight: "1.7", color: "var(--text-primary)",
                  minWidth: "60px",
                }}>
                  {streamingText ? (
                    <>
                      <ReactMarkdown components={mdComponents}>
                        {formatContent(streamingText)}
                      </ReactMarkdown>
                      <span style={{
                        display: "inline-block", width: "2px", height: "14px",
                        background: "var(--accent)", marginLeft: "2px", verticalAlign: "middle",
                        animation: "blink 1s ease-in-out infinite",
                      }} />
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                          width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)",
                          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
          <div style={{
            display: "flex", gap: "10px", alignItems: "center",
            background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
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
              disabled={isStreaming}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--text-primary)", fontSize: "14px",
                fontFamily: "var(--font)", lineHeight: "24px", resize: "none",
                maxHeight: "120px", overflowY: "auto", padding: "0",
              }}
            />
            <button onClick={() => handleSend()} disabled={isStreaming || !input.trim()} style={{
              background: input.trim() && !isStreaming ? "var(--accent)" : "var(--bg-hover)",
              color: input.trim() && !isStreaming ? "#080B10" : "var(--text-muted)",
              border: "none", borderRadius: "var(--radius-sm)",
              width: "36px", height: "36px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", fontWeight: 700, transition: "var(--transition)",
              boxShadow: input.trim() && !isStreaming ? "var(--glow)" : "none",
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
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}