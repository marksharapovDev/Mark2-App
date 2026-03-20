interface ChatResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
}

interface ChatHistoryItem {
  id: string;
  agent: string;
  role: 'user' | 'assistant';
  content: string;
  engine: 'api' | 'claude-code';
  createdAt: string;
}

interface ChatAPI {
  send: (agent: string, message: string) => Promise<ChatResponse>;
  history: (agent: string) => Promise<ChatHistoryItem[]>;
  clear: (agent: string) => Promise<void>;
}

interface ClaudeAPI {
  run: (agent: string, prompt: string) => Promise<string>;
  startSession: (agent: string) => Promise<string>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  onStream: (callback: (sessionId: string, chunk: string) => void) => () => void;
  onSessionError: (callback: (sessionId: string, error: string) => void) => () => void;
  onSessionEnd: (callback: (sessionId: string) => void) => () => void;
}

interface Window {
  chat: ChatAPI;
  claude: ClaudeAPI;
}
