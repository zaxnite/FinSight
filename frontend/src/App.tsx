import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { sendMessage } from "./services/api";
import type { AgentOutput } from "./types/index.ts";

interface Message {
  role: "user" | "assistant";
  content: string;
  output?: AgentOutput;
}

const suggestions = [
  "What is the 50/30/20 rule?",
  "What is AAPL stock price?",
  "I earn AED 15,000/month, help me budget",
  "How do I start investing in UAE?",
];

const toolLabel: Record<string, string> = {
  doc_search: "📚 Knowledge Base",
  stock_price: "📈 Live Market",
  budget_calc: "🧮 Calculator",
  none: "💡 Direct",
};

const riskColor: Record<string, string> = {
  low: "#00c07f",
  medium: "#f5c842",
  high: "#ff4d4d",
};

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = "demo-session";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const result = await sendMessage(userMsg, sessionId);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: result.response.advice,
        output: result,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Error connecting to backend. Make sure the server is running on port 8000.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", flexDirection: "column", background: "var(--bg-base)" }}>

      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "12px",
        background: "var(--bg-surface)", flexShrink: 0,
      }}>
        <div style={{
          width: "34px", height: "34px", background: "var(--accent)",
          borderRadius: "8px", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "18px", flexShrink: 0,
        }}>
          💡
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.02em" }}>FinSight</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            AI Finance Advisor · UAE
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            Live
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column" }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", margin: "auto", maxWidth: "500px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
            <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
              Welcome to FinSight
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "28px", lineHeight: 1.6 }}>
              Your AI-powered personal finance advisor for UAE residents.<br />
              Ask about budgeting, investing, live stock prices, and more.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => handleSend(s)} style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)", padding: "8px 16px", borderRadius: "20px",
                  cursor: "pointer", fontSize: "12px", fontFamily: "var(--font-display)",
                  transition: "var(--transition)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: "20px",
            animation: "fadeUp 0.2s ease",
          }}>
            <div style={{ maxWidth: "72%" }}>

              {/* Bubble */}
              <div style={{
                background: msg.role === "user" ? "var(--accent-dim)" : "var(--bg-elevated)",
                border: `1px solid ${msg.role === "user" ? "#00c07f33" : "var(--border)"}`,
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "12px 16px",
                fontSize: "14px", lineHeight: "1.7",
                color: msg.role === "user" ? "var(--accent)" : "var(--text-primary)",
              }}>
                <ReactMarkdown components={{
                  p: ({ children }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ color: msg.role === "user" ? "var(--accent)" : "var(--accent)", fontWeight: 600 }}>{children}</strong>,
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

              {/* Metadata row */}
              {msg.output && (
                <div style={{
                  marginTop: "8px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  display: "flex", flexDirection: "column", gap: "8px",
                }}>
                  {/* Tool + Risk + Confidence */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {toolLabel[msg.output.tool_used]}
                    </span>
                    <span style={{
                      fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 600,
                      color: riskColor[msg.output.response.risk_level],
                      background: riskColor[msg.output.response.risk_level] + "18",
                      border: `1px solid ${riskColor[msg.output.response.risk_level]}33`,
                      padding: "1px 8px", borderRadius: "10px", textTransform: "uppercase",
                    }}>
                      {msg.output.response.risk_level} risk
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "60px", height: "3px", background: "var(--border)", borderRadius: "2px" }}>
                        <div style={{
                          width: `${Math.round(msg.output.response.confidence * 100)}%`,
                          height: "100%", background: "var(--accent)", borderRadius: "2px",
                        }} />
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                        {Math.round(msg.output.response.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Sources */}
                  {msg.output.response.sources.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {msg.output.response.sources.map((src, j) => (
                        <span key={j} style={{
                          fontSize: "10px", color: "var(--text-muted)",
                          background: "var(--bg-hover)", border: "1px solid var(--border)",
                          padding: "2px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)",
                        }}>
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Follow-up */}
                  {msg.output.response.follow_up.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {msg.output.response.follow_up.map((q, j) => (
                        <button key={j} onClick={() => handleSend(q)} style={{
                          fontSize: "11px", color: "var(--accent)",
                          background: "var(--accent-dim)", border: "1px solid #00c07f33",
                          padding: "4px 10px", borderRadius: "20px", cursor: "pointer",
                          fontFamily: "var(--font-display)", transition: "var(--transition)",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#00c07f33")}
                          onMouseLeave={e => (e.currentTarget.style.background = "var(--accent-dim)")}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", gap: "5px", alignItems: "center", marginBottom: "16px" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: "var(--accent)",
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginLeft: "6px" }}>
              FinSight is thinking...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        {/* Suggestion chips */}
        {messages.length === 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => handleSend(s)} style={{
                fontSize: "11px", color: "var(--text-secondary)",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                padding: "4px 12px", borderRadius: "20px", cursor: "pointer",
                fontFamily: "var(--font-display)",
              }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: "flex", gap: "10px", alignItems: "center",
          background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
          borderRadius: "12px", padding: "10px 14px",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about budgeting, investing, UAE finance, or stock prices..."
            disabled={loading}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: "14px",
              fontFamily: "var(--font-display)",
            }}
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{
            background: input.trim() && !loading ? "var(--accent)" : "var(--bg-hover)",
            color: input.trim() && !loading ? "#0a0c0f" : "var(--text-muted)",
            border: "none", borderRadius: "8px", width: "36px", height: "36px",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            fontSize: "18px", fontWeight: 700, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "var(--transition)",
          }}>↑</button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}