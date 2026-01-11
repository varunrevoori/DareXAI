export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: Date;
}

export interface VoiceBot {
  _id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  voiceId: string;
  voiceModel?: string;
  llmModel?: string;
  temperature?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  _id: string;
  botId: string | VoiceBot;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: Date;
  metadata?: {
    duration?: number;
    model?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: string;
}
