import { contextBridge, ipcRenderer } from 'electron';

export interface PendingConfirmation {
  action: string;
  params: Record<string, unknown>;
  description: string;
}

export interface ChatResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
  sessionTitle?: string;
  changedEntities?: string[];
  pendingConfirmation?: PendingConfirmation;
}

export interface ChatHistoryItem {
  id: string;
  agent: string;
  session_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  engine: 'api' | 'claude-code';
  created_at: string;
}

export interface ChatSessionItem {
  id: string;
  agent: string;
  title: string;
  summary: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatAPI {
  send: (agent: string, sessionId: string, message: string) => Promise<ChatResponse>;
  setContext: (sessionId: string, ctx: Record<string, unknown>) => Promise<void>;
  setAgentContext: (agent: string, ctx: Record<string, unknown>) => Promise<void>;
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

export interface ClaudeAPI {
  run: (agent: string, prompt: string) => Promise<string>;
  startSession: (agent: string) => Promise<string>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  onStream: (callback: (sessionId: string, chunk: string) => void) => () => void;
  onSessionError: (callback: (sessionId: string, error: string) => void) => () => void;
  onSessionEnd: (callback: (sessionId: string) => void) => () => void;
}

const chatApi: ChatAPI = {
  send: (agent, sessionId, message) =>
    ipcRenderer.invoke('chat:send', agent, sessionId, message),

  setContext: (sessionId, ctx) =>
    ipcRenderer.invoke('chat:set-context', sessionId, ctx),

  setAgentContext: (agent, ctx) =>
    ipcRenderer.invoke('chat:set-agent-context', agent, ctx),

  createSession: (agent, fromSessionId?) =>
    ipcRenderer.invoke('chat:create-session', agent, fromSessionId),

  getSessions: (agent) =>
    ipcRenderer.invoke('chat:get-sessions', agent),

  deleteSession: (sessionId) =>
    ipcRenderer.invoke('chat:delete-session', sessionId),

  switchSession: (fromSessionId, toSessionId) =>
    ipcRenderer.invoke('chat:switch-session', fromSessionId, toSessionId),

  getSessionMessages: (sessionId) =>
    ipcRenderer.invoke('chat:get-session-messages', sessionId),

  agentSwitch: (fromAgent) =>
    ipcRenderer.invoke('chat:agent-switch', fromAgent),

  backfillSummaries: () =>
    ipcRenderer.invoke('chat:backfill-summaries'),

  popout: (agent) =>
    ipcRenderer.invoke('chat:popout', agent),

  popin: () =>
    ipcRenderer.invoke('chat:popin'),

  onPoppedIn: (callback) => {
    const handler = () => { callback(); };
    ipcRenderer.on('chat:popped-in', handler);
    return () => { ipcRenderer.removeListener('chat:popped-in', handler); };
  },
};

const claudeApi: ClaudeAPI = {
  run: (agent, prompt) =>
    ipcRenderer.invoke('claude:run', agent, prompt),

  startSession: (agent) =>
    ipcRenderer.invoke('claude:start-session', agent),

  sendMessage: (sessionId, message) =>
    ipcRenderer.invoke('claude:send-message', sessionId, message),

  stopSession: (sessionId) =>
    ipcRenderer.invoke('claude:stop-session', sessionId),

  onStream: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, chunk: string) => {
      callback(sessionId, chunk);
    };
    ipcRenderer.on('claude:stream', handler);
    return () => { ipcRenderer.removeListener('claude:stream', handler); };
  },

  onSessionError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, error: string) => {
      callback(sessionId, error);
    };
    ipcRenderer.on('claude:session-error', handler);
    return () => { ipcRenderer.removeListener('claude:session-error', handler); };
  },

  onSessionEnd: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string) => {
      callback(sessionId);
    };
    ipcRenderer.on('claude:session-end', handler);
    return () => { ipcRenderer.removeListener('claude:session-end', handler); };
  },
};

export interface CalendarAPI {
  popout: () => Promise<boolean>;
  popin: () => Promise<boolean>;
  onPoppedIn: (callback: () => void) => () => void;
}

const calendarApi: CalendarAPI = {
  popout: () =>
    ipcRenderer.invoke('calendar:popout'),

  popin: () =>
    ipcRenderer.invoke('calendar:popin'),

  onPoppedIn: (callback) => {
    const handler = () => { callback(); };
    ipcRenderer.on('calendar:popped-in', handler);
    return () => { ipcRenderer.removeListener('calendar:popped-in', handler); };
  },
};

const electronAPI = {
  openFile: (filePath: string) =>
    ipcRenderer.invoke('file:open', filePath),
};

const dbApi = {
  tasks: {
    list: (sphere?: string) =>
      ipcRenderer.invoke('db:tasks:list', sphere),
    get: (id: string) =>
      ipcRenderer.invoke('db:tasks:get', id),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:tasks:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:tasks:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:tasks:delete', id),
  },
  events: {
    list: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('db:events:list', startDate, endDate),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:events:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:events:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:events:delete', id),
  },
  projects: {
    list: () =>
      ipcRenderer.invoke('db:projects:list'),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:projects:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:projects:update', id, data),
  },
  students: {
    list: () =>
      ipcRenderer.invoke('db:students:list'),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:students:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:students:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:students:delete', id),
  },
  subjects: {
    list: (semester?: number) =>
      ipcRenderer.invoke('db:subjects:list', semester),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:subjects:create', data),
  },
  transactions: {
    list: (filters?: { type?: string; category?: string; dateFrom?: string; dateTo?: string; studentId?: string; month?: string }) =>
      ipcRenderer.invoke('db:transactions:list', filters),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:transactions:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:transactions:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:transactions:delete', id),
  },
  finance: {
    summary: (dateFrom?: string, dateTo?: string) =>
      ipcRenderer.invoke('db:finance:summary', dateFrom, dateTo),
    savings: {
      list: () =>
        ipcRenderer.invoke('db:finance:savings:list'),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:finance:savings:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:finance:savings:update', id, data),
    },
    rates: {
      get: (studentId: string) =>
        ipcRenderer.invoke('db:finance:rates:get', studentId),
      set: (studentId: string, rate: number, currency?: string, notes?: string) =>
        ipcRenderer.invoke('db:finance:rates:set', studentId, rate, currency, notes),
    },
  },
  workouts: {
    list: () =>
      ipcRenderer.invoke('db:workouts:list'),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:workouts:create', data),
  },
  notes: {
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:notes:create', data),
  },
  files: {
    list: (entityType: string, entityId?: string) =>
      ipcRenderer.invoke('db:files:list', entityType, entityId),
    homework: (topicId?: string | null, studentId?: string | null) =>
      ipcRenderer.invoke('db:files:homework', topicId, studentId),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:files:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:files:update', id, data),
  },
  lessons: {
    list: (studentId?: string) =>
      ipcRenderer.invoke('db:lessons:list', studentId),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:lessons:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:lessons:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:lessons:delete', id),
  },
  learningPath: {
    list: (studentId: string) =>
      ipcRenderer.invoke('db:learning-path:list', studentId),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:learning-path:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:learning-path:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:learning-path:delete', id),
    reorder: (studentId: string, topicIds: string[]) =>
      ipcRenderer.invoke('db:learning-path:reorder', studentId, topicIds),
  },
};

const dataEvents = {
  onDataChanged: (callback: (entities: string[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entities: string[]) => {
      callback(entities);
    };
    ipcRenderer.on('data-changed', handler);
    return () => { ipcRenderer.removeListener('data-changed', handler); };
  },
  emitDataChanged: (entities: string[]) => {
    ipcRenderer.send('data-changed', entities);
  },
};

contextBridge.exposeInMainWorld('chat', chatApi);
contextBridge.exposeInMainWorld('claude', claudeApi);
contextBridge.exposeInMainWorld('calendar', calendarApi);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('db', dbApi);
contextBridge.exposeInMainWorld('dataEvents', dataEvents);
