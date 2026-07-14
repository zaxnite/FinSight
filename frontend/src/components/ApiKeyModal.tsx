import { useState } from "react";
import { saveApiKey } from "../services/api";

interface Props {
  onKeySubmitted: () => void;
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ApiKeyModal({ onKeySubmitted }: Props) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "success">("idle");

  const handleSubmit = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your Anthropic API key.");
      return;
    }
    if (!trimmed.startsWith("sk-ant-")) {
      setError("Invalid format — Anthropic keys start with sk-ant-");
      return;
    }

    setStatus("validating");
    setError("");

    try {
      const res = await fetch(`${BASE_URL}/api-key/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: trimmed }),
      });

      if (!res.ok) {
        setStatus("idle");
        setError("Could not reach the FinSight backend. Make sure it's running.");
        return;
      }

      const data: { valid: boolean; error?: string } = await res.json();

      if (!data.valid) {
        setStatus("idle");
        setError(data.error || "Key validation failed.");
        return;
      }

      setStatus("success");
      saveApiKey(trimmed);
      setTimeout(onKeySubmitted, 600); // brief success flash before closing
    } catch {
      setStatus("idle");
      setError("Cannot reach the FinSight backend. Make sure it's running.");
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Icon */}
        <div style={iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent, #00d4aa)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={title}>Anthropic API Key Required</h2>
        <p style={subtitle}>
          FinSight runs on Claude. Enter your Anthropic API key below — it's
          stored only in your browser and sent directly to the FinSight backend.
        </p>

        <div style={inputWrap}>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && status === "idle" && handleSubmit()}
            style={{
              ...inputStyle,
              borderColor: error ? "#f87171" : status === "success" ? "#4ade80" : "var(--border, #1e2433)",
            }}
            autoFocus
            spellCheck={false}
            disabled={status !== "idle"}
          />
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        {status === "success" && (
          <p style={successStyle}>✓ Key validated successfully</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status !== "idle"}
          style={{
            ...btn,
            ...(status !== "idle" ? btnDisabled : {}),
            ...(status === "success" ? btnSuccess : {}),
          }}
        >
          {status === "validating" ? "Validating..." : status === "success" ? "Verified ✓" : "Validate & Save"}
        </button>

        <p style={hint}>
          Get your key at{" "}
          <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer" style={link}>
            console.anthropic.com
          </a>
        </p>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px",
};

const modal: React.CSSProperties = {
  background: "var(--bg-surface, #0f1117)",
  border: "1px solid var(--border, #1e2433)",
  borderRadius: "16px",
  padding: "40px 36px",
  maxWidth: "440px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
};

const iconWrap: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "14px",
  background: "rgba(0, 212, 170, 0.1)",
  border: "1px solid rgba(0, 212, 170, 0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "4px",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600,
  color: "var(--text-primary, #e2e8f0)",
  textAlign: "center",
  fontFamily: "var(--font-mono, monospace)",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--text-secondary, #8892a4)",
  textAlign: "center",
  lineHeight: "1.6",
};

const inputWrap: React.CSSProperties = {
  width: "100%",
  marginTop: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--bg-base, #080b10)",
  border: "1px solid",
  borderRadius: "8px",
  color: "var(--text-primary, #e2e8f0)",
  fontSize: "13px",
  fontFamily: "var(--font-mono, monospace)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "#f87171",
  textAlign: "center",
};

const successStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "#4ade80",
  textAlign: "center",
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "var(--accent, #00d4aa)",
  color: "#000",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  fontFamily: "var(--font-mono, monospace)",
  cursor: "pointer",
  transition: "opacity 0.15s, background 0.2s",
};

const btnDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const btnSuccess: React.CSSProperties = {
  background: "#4ade80",
};

const hint: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "var(--text-secondary, #8892a4)",
};

const link: React.CSSProperties = {
  color: "var(--accent, #00d4aa)",
  textDecoration: "none",
};