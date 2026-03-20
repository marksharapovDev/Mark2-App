import type { Sphere } from './task.js';

export type AgentName = Sphere | 'general';

export type ChatEngine = 'api' | 'claude-code';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  agent: AgentName;
  role: ChatRole;
  content: string;
  engine: ChatEngine;
  createdAt: Date;
}
