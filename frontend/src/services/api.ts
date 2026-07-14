import axios from "axios";
import type { AgentOutput } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── API key helpers ────────────────────────────────────────────────────────────
const KEY_STORAGE = "finsight_anthropic_key";

export function getStoredApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function saveApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

/** Returns the headers object with X-Anthropic-Key when a key is stored locally. */
function authHeaders(): Record<string, string> {
  const key = getStoredApiKey();
  return key ? { "X-Anthropic-Key": key } : {};
}

const api = axios.create({ baseURL: BASE_URL });

// Attach the stored key automatically to every axios request
api.interceptors.request.use((config) => {
  const key = getStoredApiKey();
  if (key) config.headers["X-Anthropic-Key"] = key;
  return config;
});

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

/**
 * Asks the backend whether it already has an Anthropic key set server-side.
 * Returns true  → no modal needed (key is in the environment).
 * Returns false → frontend must ask the user for a key.
 */
export const checkApiKeyStatus = async (): Promise<boolean> => {
  try {
    const { data } = await api.get<{ has_key: boolean }>("/api-key/status");
    return data.has_key;
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
      headers: { "Content-Type": "application/json", ...authHeaders() },
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