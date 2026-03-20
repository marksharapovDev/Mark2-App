interface ChatResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
  sessionTitle?: string;
}

interface ChatHistoryItem {
  id: string;
  agent: string;
  session_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  engine: 'api' | 'claude-code';
  created_at: string;
}

interface ChatSessionItem {
  id: string;
  agent: string;
  title: string;
  summary: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ChatAPI {
  send: (agent: string, sessionId: string, message: string) => Promise<ChatResponse>;
  createSession: (agent: string) => Promise<ChatSessionItem>;
  getSessions: (agent: string) => Promise<ChatSessionItem[]>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchSession: (fromSessionId: string | null, toSessionId: string) => Promise<ChatHistoryItem[]>;
  getSessionMessages: (sessionId: string) => Promise<ChatHistoryItem[]>;
  popout: (agent: string) => Promise<boolean>;
  popin: () => Promise<boolean>;
  onPoppedIn: (callback: () => void) => () => void;
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
