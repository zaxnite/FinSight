export interface FinanceResponse {
  advice: string;
  confidence: number;
  risk_level: "low" | "medium" | "high";
  sources: string[];
  follow_up: string[];
}

export interface AgentOutput {
  response: FinanceResponse;
  tool_used: "doc_search" | "stock_price" | "budget_calc" | "none";
  session_id: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentOutput?: AgentOutput;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}