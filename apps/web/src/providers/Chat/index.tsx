'use client';

import { ChatMessage } from '@/types/chat';
import { createContext, useCallback, useContext, useState } from 'react';

interface ChatContextValue {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: '1', type: 'ai', content: 'Hi! How can I help you?' },
];

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, addMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatHistory() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatHistory must be used inside ChatProvider');
  return ctx;
}
