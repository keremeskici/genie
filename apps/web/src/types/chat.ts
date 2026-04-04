export interface AiInsight {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  insights?: AiInsight[];
}
