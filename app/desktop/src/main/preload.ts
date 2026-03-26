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
    list: (filters?: Record<string, unknown>) =>
      ipcRenderer.invoke('db:projects:list', filters),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:projects:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:projects:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:projects:delete', id),
  },
  dev: {
    tasks: {
      list: (projectId: string, status?: string) =>
        ipcRenderer.invoke('db:dev:tasks:list', projectId, status),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:dev:tasks:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:dev:tasks:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:dev:tasks:delete', id),
      reorder: (projectId: string, taskIds: string[]) =>
        ipcRenderer.invoke('db:dev:tasks:reorder', projectId, taskIds),
    },
    time: {
      list: (taskId?: string, projectId?: string) =>
        ipcRenderer.invoke('db:dev:time:list', taskId, projectId),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:dev:time:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:dev:time:update', id, data),
    },
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
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:subjects:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:subjects:delete', id),
  },
  assignments: {
    list: (subjectId?: string) =>
      ipcRenderer.invoke('db:assignments:list', subjectId),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:assignments:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:assignments:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:assignments:delete', id),
  },
  exams: {
    list: (subjectId?: string) =>
      ipcRenderer.invoke('db:exams:list', subjectId),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:exams:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:exams:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:exams:delete', id),
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
  health: {
    workouts: {
      list: (dateFrom?: string, dateTo?: string) =>
        ipcRenderer.invoke('db:health:workouts:list', dateFrom, dateTo),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:workouts:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:workouts:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:workouts:delete', id),
    },
    exercises: {
      list: (workoutId: string) =>
        ipcRenderer.invoke('db:health:exercises:list', workoutId),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:exercises:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:exercises:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:exercises:delete', id),
    },
    logs: {
      list: (type?: string, dateFrom?: string, dateTo?: string) =>
        ipcRenderer.invoke('db:health:logs:list', type, dateFrom, dateTo),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:logs:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:logs:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:logs:delete', id),
    },
    goals: {
      list: () =>
        ipcRenderer.invoke('db:health:goals:list'),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:goals:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:goals:update', id, data),
    },
    programs: {
      list: () =>
        ipcRenderer.invoke('db:health:programs:list'),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:programs:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:programs:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:programs:delete', id),
    },
    programDays: {
      list: (programId: string) =>
        ipcRenderer.invoke('db:health:program-days:list', programId),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:program-days:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:program-days:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:program-days:delete', id),
    },
    mealPlans: {
      list: () =>
        ipcRenderer.invoke('db:health:meal-plans:list'),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:meal-plans:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:meal-plans:update', id, data),
    },
    meals: {
      list: (date?: string, dateFrom?: string, dateTo?: string) =>
        ipcRenderer.invoke('db:health:meals:list', date, dateFrom, dateTo),
      create: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:meals:create', data),
      update: (id: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:meals:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('db:health:meals:delete', id),
    },
    checklist: {
      get: (date: string) =>
        ipcRenderer.invoke('db:health:checklist:get', date),
      upsert: (date: string, data: Record<string, unknown>) =>
        ipcRenderer.invoke('db:health:checklist:upsert', date, data),
      refresh: (date: string) =>
        ipcRenderer.invoke('db:health:checklist:refresh', date),
    },
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
  reminders: {
    list: (filters?: { dateFrom?: string; dateTo?: string; status?: string; sphere?: string }) =>
      ipcRenderer.invoke('db:reminders:list', filters),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:reminders:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('db:reminders:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('db:reminders:delete', id),
    complete: (id: string) =>
      ipcRenderer.invoke('db:reminders:complete', id),
    uncomplete: (id: string) =>
      ipcRenderer.invoke('db:reminders:uncomplete', id),
  },
};

const tasksApi = {
  getAggregated: (date: string) =>
    ipcRenderer.invoke('tasks:aggregated:get', date),
};

const studyApi = {
  files: {
    list: (subjectSlug: string, folder: string) =>
      ipcRenderer.invoke('study:files:list', subjectSlug, folder),
    read: (filePath: string) =>
      ipcRenderer.invoke('study:files:read', filePath),
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke('study:files:write', filePath, content),
    create: (subjectSlug: string, folder: string, filename: string) =>
      ipcRenderer.invoke('study:files:create', subjectSlug, folder, filename),
    delete: (filePath: string) =>
      ipcRenderer.invoke('study:files:delete', filePath),
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
contextBridge.exposeInMainWorld('study', studyApi);
contextBridge.exposeInMainWorld('tasks', tasksApi);
contextBridge.exposeInMainWorld('dataEvents', dataEvents);
