interface PendingConfirmation {
  action: string;
  params: Record<string, unknown>;
  description: string;
}

interface ChatResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
  sessionTitle?: string;
  changedEntities?: string[];
  pendingConfirmation?: PendingConfirmation;
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
  createSession: (agent: string, fromSessionId?: string) => Promise<ChatSessionItem>;
  getSessions: (agent: string) => Promise<ChatSessionItem[]>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchSession: (fromSessionId: string | null, toSessionId: string) => Promise<ChatHistoryItem[]>;
  getSessionMessages: (sessionId: string) => Promise<ChatHistoryItem[]>;
  agentSwitch: (fromAgent: string) => Promise<void>;
  backfillSummaries: () => Promise<number>;
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

interface CalendarAPI {
  popout: () => Promise<boolean>;
  popin: () => Promise<boolean>;
  onPoppedIn: (callback: () => void) => () => void;
}

interface DbAPI {
  tasks: {
    list: (sphere?: string) => Promise<import('@mark2/shared').Task[]>;
    get: (id: string) => Promise<import('@mark2/shared').Task>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Task>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Task>;
    delete: (id: string) => Promise<void>;
  };
  events: {
    list: (startDate: string, endDate: string) => Promise<import('@mark2/shared').CalendarEvent[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').CalendarEvent>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').CalendarEvent>;
    delete: (id: string) => Promise<void>;
  };
  projects: {
    list: () => Promise<import('@mark2/shared').DevProject[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DevProject>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').DevProject>;
  };
  students: {
    list: () => Promise<import('@mark2/shared').Student[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Student>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Student>;
    delete: (id: string) => Promise<void>;
  };
  subjects: {
    list: (semester?: number) => Promise<import('@mark2/shared').Subject[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Subject>;
  };
  transactions: {
    list: (month?: string) => Promise<import('@mark2/shared').Transaction[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Transaction>;
    delete: (id: string) => Promise<void>;
  };
  workouts: {
    list: () => Promise<import('@mark2/shared').Workout[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Workout>;
  };
  notes: {
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DailyNote>;
  };
}

interface DataEventsAPI {
  onDataChanged: (callback: (entities: string[]) => void) => () => void;
  emitDataChanged: (entities: string[]) => void;
}

interface Window {
  chat: ChatAPI;
  claude: ClaudeAPI;
  calendar: CalendarAPI;
  db: DbAPI;
  dataEvents: DataEventsAPI;
}
