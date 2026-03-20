import type { Sphere } from './task.js';

export type AgentName = Sphere | 'general';

export type ChatEngine = 'api' | 'claude-code';

export type ChatRole = 'user' | 'assistant';

export interface ChatSession {
  id: string;
  agent: AgentName;
  title: string;
  summary: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  agent: AgentName;
  sessionId: string | null;
  role: ChatRole;
  content: string;
  engine: ChatEngine;
  createdAt: Date;
}
