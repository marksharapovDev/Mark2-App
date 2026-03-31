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
  send: (agent: string, sessionId: string, message: string, filePaths?: string[]) => Promise<ChatResponse>;
  abort: (sessionId: string) => Promise<void>;
  isThinking: (sessionId: string) => Promise<boolean>;
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
  onStreamStart: (callback: (sessionId: string) => void) => () => void;
  onStreamUpdate: (callback: (sessionId: string, text: string) => void) => () => void;
  onStreamEnd: (callback: (sessionId: string) => void) => () => void;
  onStatusUpdate: (callback: (sessionId: string, status: string) => void) => () => void;
  transcribeAudio: (audioData: ArrayBuffer) => Promise<{ text: string; error?: string }>;
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

interface TimerAPI {
  popout: () => Promise<boolean>;
  popin: () => Promise<boolean>;
  onPoppedIn: (callback: () => void) => () => void;
  onAutoStart: (callback: (data: { eventId: string; title: string; startAt: string; endAt: string; sphere?: string }) => void) => () => void;
  onTimerControl: (callback: (action: string, params: Record<string, unknown>) => void) => () => void;
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
    list: (filters?: Record<string, unknown>) => Promise<import('@mark2/shared').DevProjectV2[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DevProjectV2>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').DevProjectV2>;
    delete: (id: string) => Promise<void>;
  };
  dev: {
    tasks: {
      list: (projectId: string, status?: string) => Promise<import('@mark2/shared').DevTask[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DevTask>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').DevTask>;
      delete: (id: string) => Promise<void>;
      reorder: (projectId: string, taskIds: string[]) => Promise<void>;
    };
    time: {
      list: (taskId?: string, projectId?: string) => Promise<import('@mark2/shared').DevTimeEntry[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DevTimeEntry>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').DevTimeEntry>;
    };
    files: {
      tree: (localPath: string) => Promise<FileTreeNode[]>;
      read: (filePath: string) => Promise<string>;
      write: (filePath: string, content: string) => Promise<void>;
      openInEditor: (filePath: string) => Promise<void>;
      showInFinder: (filePath: string) => Promise<void>;
      watchStart: (localPath: string) => Promise<void>;
      watchStop: (localPath: string) => Promise<void>;
      onWatchUpdate: (callback: (localPath: string) => void) => () => void;
    };
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
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Subject>;
    delete: (id: string) => Promise<void>;
  };
  assignments: {
    list: (subjectId?: string) => Promise<import('@mark2/shared').StudyAssignment[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').StudyAssignment>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').StudyAssignment>;
    delete: (id: string) => Promise<void>;
  };
  exams: {
    list: (subjectId?: string) => Promise<import('@mark2/shared').StudyExam[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').StudyExam>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').StudyExam>;
    delete: (id: string) => Promise<void>;
  };
  transactions: {
    list: (filters?: { type?: string; category?: string; dateFrom?: string; dateTo?: string; studentId?: string; month?: string }) => Promise<import('@mark2/shared').Transaction[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Transaction>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Transaction>;
    delete: (id: string) => Promise<void>;
  };
  finance: {
    summary: (dateFrom?: string, dateTo?: string) => Promise<import('@mark2/shared').FinanceSummary>;
    savings: {
      list: () => Promise<import('@mark2/shared').SavingsGoal[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').SavingsGoal>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').SavingsGoal>;
    };
    rates: {
      get: (studentId: string) => Promise<import('@mark2/shared').StudentRate | null>;
      set: (studentId: string, rate: number, currency?: string, notes?: string) => Promise<import('@mark2/shared').StudentRate>;
    };
  };
  workouts: {
    list: () => Promise<import('@mark2/shared').Workout[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Workout>;
  };
  health: {
    workouts: {
      list: (dateFrom?: string, dateTo?: string) => Promise<import('@mark2/shared').WorkoutV2[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').WorkoutV2>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').WorkoutV2>;
      delete: (id: string) => Promise<void>;
    };
    exercises: {
      list: (workoutId: string) => Promise<import('@mark2/shared').WorkoutExercise[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').WorkoutExercise>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').WorkoutExercise>;
      delete: (id: string) => Promise<void>;
    };
    logs: {
      list: (type?: string, dateFrom?: string, dateTo?: string) => Promise<import('@mark2/shared').HealthLog[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').HealthLog>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').HealthLog>;
      delete: (id: string) => Promise<void>;
    };
    goals: {
      list: () => Promise<import('@mark2/shared').HealthGoal[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').HealthGoal>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').HealthGoal>;
    };
    programs: {
      list: () => Promise<import('@mark2/shared').TrainingProgram[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').TrainingProgram>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').TrainingProgram>;
      delete: (id: string) => Promise<void>;
    };
    programDays: {
      list: (programId: string) => Promise<import('@mark2/shared').TrainingProgramDay[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').TrainingProgramDay>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').TrainingProgramDay>;
      delete: (id: string) => Promise<void>;
    };
    mealPlans: {
      list: () => Promise<import('@mark2/shared').MealPlan[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').MealPlan>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').MealPlan>;
    };
    meals: {
      list: (date?: string, dateFrom?: string, dateTo?: string) => Promise<import('@mark2/shared').Meal[]>;
      create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Meal>;
      update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Meal>;
      delete: (id: string) => Promise<void>;
    };
    checklist: {
      get: (date: string) => Promise<import('@mark2/shared').DailyChecklist | null>;
      upsert: (date: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').DailyChecklist>;
      refresh: (date: string) => Promise<import('@mark2/shared').DailyChecklist>;
    };
  };
  notes: {
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').DailyNote>;
  };
  files: {
    list: (entityType: string, entityId?: string) => Promise<import('@mark2/shared').AttachedFile[]>;
    homework: (topicId?: string | null, studentId?: string | null) => Promise<import('@mark2/shared').AttachedFile[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').AttachedFile>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').AttachedFile>;
  };
  lessons: {
    list: (studentId?: string) => Promise<import('@mark2/shared').Lesson[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Lesson>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Lesson>;
    delete: (id: string) => Promise<void>;
  };
  learningPath: {
    list: (studentId: string) => Promise<import('@mark2/shared').LearningPathTopic[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').LearningPathTopic>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').LearningPathTopic>;
    delete: (id: string) => Promise<void>;
    reorder: (studentId: string, topicIds: string[]) => Promise<void>;
  };
  reminders: {
    list: (filters?: { dateFrom?: string; dateTo?: string; status?: string; sphere?: string }) => Promise<import('@mark2/shared').Reminder[]>;
    create: (data: Record<string, unknown>) => Promise<import('@mark2/shared').Reminder>;
    update: (id: string, data: Record<string, unknown>) => Promise<import('@mark2/shared').Reminder>;
    delete: (id: string) => Promise<void>;
    complete: (id: string) => Promise<import('@mark2/shared').Reminder>;
    uncomplete: (id: string) => Promise<import('@mark2/shared').Reminder>;
  };
}

interface TasksAPI {
  getAggregated: (date: string) => Promise<Array<{
    id: string;
    title: string;
    time: string | null;
    sphere: string;
    priority: string;
    status: string;
    sourceType: string;
    sourceId: string | null;
    isReminder: boolean;
  }>>;
}

interface DataEventsAPI {
  onDataChanged: (callback: (entities: string[]) => void) => () => void;
  emitDataChanged: (entities: string[]) => void;
}

interface ElectronAPI {
  openFile: (filePath: string) => Promise<string>;
  openFiles: () => Promise<string[]>;
  openDirectory: () => Promise<string | null>;
  getFileInfo: (filePath: string) => Promise<{ size: number; isFile: boolean } | null>;
  readFileBase64: (filePath: string) => Promise<string | null>;
}

interface StudyFileEntry {
  name: string;
  path: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
}

interface TeachingAPI {
  files: {
    tree: (studentSlug: string) => Promise<FileTreeNode[]>;
    allTree: () => Promise<FileTreeNode[]>;
    read: (filePath: string) => Promise<string>;
    write: (filePath: string, content: string) => Promise<void>;
    create: (studentSlug: string, folder: string, filename: string) => Promise<StudyFileEntry>;
    delete: (filePath: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    copy: (sourcePath: string, destFolder: string) => Promise<StudyFileEntry>;
    ensureStudent: (studentSlug: string) => Promise<void>;
    watchStart: (studentSlug: string) => Promise<void>;
    watchStop: (studentSlug: string) => Promise<void>;
    onWatchUpdate: (callback: (studentSlug: string) => void) => () => void;
  };
}

interface StudyAPI {
  files: {
    list: (subjectSlug: string, folder: string) => Promise<StudyFileEntry[]>;
    read: (filePath: string) => Promise<string>;
    write: (filePath: string, content: string) => Promise<void>;
    create: (subjectSlug: string, folder: string, filename: string) => Promise<StudyFileEntry>;
    delete: (filePath: string) => Promise<void>;
    tree: (subjectSlug: string) => Promise<FileTreeNode[]>;
    allTree: () => Promise<FileTreeNode[]>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    copy: (sourcePath: string, destFolder: string) => Promise<StudyFileEntry>;
    watchStart: (subjectSlug: string) => Promise<void>;
    watchStop: (subjectSlug: string) => Promise<void>;
    onWatchUpdate: (callback: (subjectSlug: string) => void) => () => void;
  };
}

interface Window {
  chat: ChatAPI;
  claude: ClaudeAPI;
  calendar: CalendarAPI;
  timer: TimerAPI;
  db: DbAPI;
  tasks: TasksAPI;
  study: StudyAPI;
  teaching: TeachingAPI;
  dataEvents: DataEventsAPI;
  electronAPI: ElectronAPI;
}
