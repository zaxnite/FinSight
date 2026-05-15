import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Message, Conversation } from "../types";
import { sendMessage } from "../services/api";

export const useChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  const newConversation = useCallback(() => {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      title: "New Conversation",
      starred: false,
      messages: [],
      createdAt: new Date(),
    };
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const send = useCallback(async (content: string) => {
    let sessionId = activeId;
    if (!sessionId) {
      sessionId = newConversation();
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === sessionId
          ? {
              ...c,
              title: c.messages.length === 0
                ? content.slice(0, 42) + (content.length > 42 ? "..." : "")
                : c.title,
              messages: [...c.messages, userMessage],
            }
          : c
      )
    );

    setLoading(true);
    setError(null);

    try {
      const result = await sendMessage(content, sessionId);
      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: result.response.advice,
        agentOutput: result,
        timestamp: new Date(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === sessionId
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c
        )
      );
    } catch {
      setError("Failed to connect to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [activeId, newConversation]);

  return {
    conversations,
    setConversations,
    activeConversation,
    activeId,
    loading,
    setLoading,
    error,
    send,
    newConversation,
    setActiveId,
  };
};