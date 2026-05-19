import axios from "axios";
import type { AgentOutput } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

export const sendMessage = async (
  message: string,
  session_id: string
): Promise<AgentOutput> => {
  const { data } = await api.post<AgentOutput>("/chat", { message, session_id });
  return data;
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    await api.get("/health");
    return true;
  } catch {
    return false;
  }
};

export interface StreamChunk {
  type: "text" | "tool" | "meta" | "error" | "done";
  content?: string;
  tool_used?: string;
  confidence?: number;
  risk_level?: "low" | "medium" | "high";
  sources?: string[];
  follow_up?: string[];
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Human-readable error messages ─────────────────────────────────────────────
function parseHttpError(status: number): string {
  if (status === 422) return "Please type a message before sending.";
  if (status === 429) return "Too many requests — please wait a moment before trying again.";
  if (status === 500) return "FinSight encountered an error. Please try again.";
  if (status === 0 || status === undefined) return "Cannot reach FinSight. Make sure the backend is running.";
  return `Unexpected error (${status}). Please try again.`;
}

export async function streamMessage(
  message: string,
  session_id: string,
  history: HistoryMessage[],
  onChunk: (chunk: StreamChunk) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  // Client-side empty message guard — catches it before hitting the network
  if (!message || !message.trim()) {
    onError("Please type a message before sending.");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id, history }),
    });

    if (!response.ok) {
      onError(parseHttpError(response.status));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { onError("No response body"); return; }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") { onDone(); return; }
        try {
          const chunk: StreamChunk = JSON.parse(raw);
          onChunk(chunk);
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone();
  } catch (err) {
    // Network-level errors (backend down, CORS, timeout)
    if (err instanceof TypeError && err.message.includes("fetch")) {
      onError("Cannot reach FinSight. Make sure the backend is running.");
      return;
    }
    onError(err instanceof Error ? err.message : "Stream error");
  }
}