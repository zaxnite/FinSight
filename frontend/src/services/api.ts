import axios from "axios";
import type { AgentOutput } from "../types/index.js";

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