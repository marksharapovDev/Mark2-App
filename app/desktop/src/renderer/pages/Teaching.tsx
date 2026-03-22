import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus, LearningPathTopic, LearningPathStatus } from '@mark2/shared';
import { CheckCircle2, RefreshCw, Clock, XCircle, FileText, FileType, FileCode, PenLine, ClipboardList, BarChart3, Loader2 } from 'lucide-react';

// --- Types ---

type StudentLevel = 'beginner' | 'intermediate' | 'advanced';
type HomeworkStatus = 'done' | 'upcoming' | 'overdue';
type LessonStatus = 'planned' | 'completed';
type TopicStatus = 'done' | 'current' | 'upcoming';
type Priority = 'low' | 'medium' | 'high';
type SidebarTab = 'students' | 'general';

interface ScheduleSlot {
  day: string;
  time: string;
}

interface MockStudent {
  id: string;
  name: string;
  subject: string;
  level: StudentLevel;
  schedule: ScheduleSlot[];
  startDate: string;
  totalLessons: number;
}

interface MockLesson {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  status: LessonStatus;
  notes: string;
  homeworkGiven?: string;
  files?: MockFile[];
}

interface MockHomework {
  id: string;
  studentId: string;
  lessonId: string;
  title: string;
  description: string;
  dueDate: string;
  status: HomeworkStatus;
  grade?: string;
  comment?: string;
  file?: MockFile;
}

interface MockTopic {
  id: string;
  studentId: string;
  title: string;
  status: TopicStatus;
}

interface MockFile {
  id: string;
  name: string;
  type: 'docx' | 'pdf' | 'py' | 'txt';
}

interface TeachingTask {
  id: string;
  studentId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Mock Data ---

const MOCK_STUDENTS: MockStudent[] = [
  {
    id: 'misha',
    name: 'Миша Козлов',
    subject: 'Информатика (ЕГЭ)',
    level: 'intermediate',
    schedule: [
      { day: 'Вт', time: '17:00' },
      { day: 'Сб', time: '11:00' },
    ],
    startDate: '2025-12-10',
    totalLessons: 12,
  },
  {
    id: 'anya',
    name: 'Аня Смирнова',
    subject: 'Python',
    level: 'beginner',
    schedule: [{ day: 'Ср', time: '15:00' }],
    startDate: '2026-02-05',
    totalLessons: 6,
  },
];

const MOCK_FILES: MockFile[] = [
  { id: 'f1', name: 'ege5_tasks.docx', type: 'docx' },
  { id: 'f2', name: 'python_loops_homework.docx', type: 'docx' },
  { id: 'f3', name: 'plan_lesson_15mar.pdf', type: 'pdf' },
  { id: 'f4', name: 'logic_tables_examples.pdf', type: 'pdf' },
];

const MOCK_LESSONS: MockLesson[] = [
  {
    id: 'l1',
    studentId: 'misha',
    date: '2026-03-15',
    topic: 'Системы счисления — перевод из 10 в 2, 8, 16',
    status: 'completed',
    notes: 'Разобрали алгоритм перевода. Миша быстро понял двоичную систему, восьмеричная далась сложнее.',
    homeworkGiven: 'Перевести 10 чисел между системами счисления',
    files: [MOCK_FILES[2]!],
  },
  {
    id: 'l2',
    studentId: 'misha',
    date: '2026-03-18',
    topic: 'Логические выражения — таблицы истинности',
    status: 'completed',
    notes: 'Таблицы истинности для AND, OR, NOT, XOR. Начали составлять выражения по таблицам.',
    homeworkGiven: 'Составить таблицы истинности для 5 выражений',
    files: [MOCK_FILES[3]!],
  },
  {
    id: 'l3',
    studentId: 'misha',
    date: '2026-03-22',
    topic: 'Задание 5 ЕГЭ — анализ алгоритмов',
    status: 'completed',
    notes: 'Разбирали типичные задачи на анализ алгоритмов из ЕГЭ. Трассировка циклов.',
    homeworkGiven: 'Решить 8 задач из сборника',
    files: [MOCK_FILES[0]!],
  },
  {
    id: 'l4',
    studentId: 'misha',
    date: '2026-03-25',
    topic: 'Рекурсия — базовые понятия',
    status: 'planned',
    notes: '',
  },
  {
    id: 'l5',
    studentId: 'misha',
    date: '2026-03-29',
    topic: 'Массивы — сортировка, поиск',
    status: 'planned',
    notes: '',
  },
  {
    id: 'l6',
    studentId: 'anya',
    date: '2026-03-12',
    topic: 'Переменные и типы данных',
    status: 'completed',
    notes: 'Разобрали int, float, str, bool. Аня хорошо поняла разницу типов.',
    homeworkGiven: 'Написать программу-калькулятор',
  },
  {
    id: 'l7',
    studentId: 'anya',
    date: '2026-03-19',
    topic: 'Условия if/elif/else',
    status: 'completed',
    notes: 'Условные конструкции, вложенные условия. Практика на простых задачах.',
    homeworkGiven: 'Написать программу с меню из 3 пунктов',
  },
  {
    id: 'l8',
    studentId: 'anya',
    date: '2026-03-26',
    topic: 'Циклы while и for',
    status: 'planned',
    notes: '',
  },
];

const MOCK_HOMEWORKS: MockHomework[] = [
  {
    id: 'h1',
    studentId: 'misha',
    lessonId: 'l1',
    title: 'Перевод чисел между системами',
    description: 'Перевести 10 чисел между двоичной, восьмеричной, десятичной и шестнадцатеричной системами счисления.',
    dueDate: '2026-03-18',
    status: 'done',
    grade: '5',
    comment: 'Всё верно, отличная работа!',
  },
  {
    id: 'h2',
    studentId: 'misha',
    lessonId: 'l2',
    title: 'Таблицы истинности',
    description: 'Составить таблицы истинности для 5 логических выражений с 2-3 переменными.',
    dueDate: '2026-03-22',
    status: 'done',
    grade: '4',
    comment: 'В 4-м выражении ошибка в приоритете операций, остальное верно.',
  },
  {
    id: 'h3',
    studentId: 'misha',
    lessonId: 'l3',
    title: 'Задачи на анализ алгоритмов',
    description: 'Решить 8 задач формата задания 5 ЕГЭ из сборника Полякова.',
    dueDate: '2026-03-25',
    status: 'done',
    grade: '4',
    comment: 'Решено 7 из 8, в последней задаче ошибка в трассировке цикла.',
    file: MOCK_FILES[0],
  },
  {
    id: 'h4',
    studentId: 'misha',
    lessonId: 'l4',
    title: 'Рекурсивные функции',
    description: 'Написать 3 рекурсивные функции: факториал, Фибоначчи, степень числа.',
    dueDate: '2026-03-29',
    status: 'upcoming',
  },
  {
    id: 'h5',
    studentId: 'misha',
    lessonId: 'l3',
    title: 'Дополнительные задачи ЕГЭ',
    description: 'Решить задачи 6-10 из демоверсии ЕГЭ 2026.',
    dueDate: '2026-03-20',
    status: 'overdue',
  },
  {
    id: 'h6',
    studentId: 'anya',
    lessonId: 'l6',
    title: 'Программа-калькулятор',
    description: 'Написать программу, которая принимает два числа и операцию (+, -, *, /) и выводит результат.',
    dueDate: '2026-03-19',
    status: 'done',
    grade: '5',
    comment: 'Отлично! Даже добавила проверку деления на ноль.',
  },
  {
    id: 'h7',
    studentId: 'anya',
    lessonId: 'l7',
    title: 'Программа с меню',
    description: 'Написать программу с меню из 3 пунктов, использовать if/elif/else.',
    dueDate: '2026-03-26',
    status: 'done',
    grade: '5',
    comment: 'Хорошо структурированный код.',
  },
  {
    id: 'h8',
    studentId: 'anya',
    lessonId: 'l8',
    title: 'Задачи на циклы',
    description: 'Решить 5 задач на циклы while и for из учебника.',
    dueDate: '2026-04-02',
    status: 'upcoming',
    file: MOCK_FILES[1],
  },
];

const MOCK_TOPICS: MockTopic[] = [
  { id: 'tp1', studentId: 'misha', title: 'Системы счисления', status: 'done' },
  { id: 'tp2', studentId: 'misha', title: 'Логика', status: 'done' },
  { id: 'tp3', studentId: 'misha', title: 'Алгоритмы', status: 'current' },
  { id: 'tp4', studentId: 'misha', title: 'Программирование', status: 'upcoming' },
  { id: 'tp5', studentId: 'misha', title: 'Базы данных', status: 'upcoming' },
  { id: 'tp6', studentId: 'misha', title: 'Сети и интернет', status: 'upcoming' },
  { id: 'tp7', studentId: 'anya', title: 'Переменные', status: 'done' },
  { id: 'tp8', studentId: 'anya', title: 'Условия', status: 'done' },
  { id: 'tp9', studentId: 'anya', title: 'Циклы', status: 'current' },
  { id: 'tp10', studentId: 'anya', title: 'Функции', status: 'upcoming' },
  { id: 'tp11', studentId: 'anya', title: 'Списки', status: 'upcoming' },
  { id: 'tp12', studentId: 'anya', title: 'Словари', status: 'upcoming' },
];

// --- Helpers ---

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string; label: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400', label: 'Low' },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  done: 'Done',
  in_progress: 'In Progress',
  todo: 'Todo',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  done: 'text-emerald-400',
  in_progress: 'text-blue-400',
  todo: 'text-yellow-400',
  cancelled: 'text-red-400',
};

const HW_STATUS_ICON: Record<HomeworkStatus, React.ReactNode> = {
  done: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />,
  upcoming: <Clock size={14} strokeWidth={1.5} className="text-yellow-400" />,
  overdue: <XCircle size={14} strokeWidth={1.5} className="text-red-400" />,
};

const HW_STATUS_LABEL: Record<HomeworkStatus, string> = {
  done: 'Выполнена',
  upcoming: 'Предстоит',
  overdue: 'Не сдана',
};

const TOPIC_ICON: Record<TopicStatus, React.ReactNode> = {
  done: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />,
  current: <RefreshCw size={14} strokeWidth={1.5} className="text-blue-400" />,
  upcoming: <Clock size={14} strokeWidth={1.5} className="text-yellow-400" />,
};

const LP_STATUS_ICON: Record<LearningPathStatus, React.ReactNode> = {
  completed: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />,
  in_progress: <RefreshCw size={14} strokeWidth={1.5} className="text-blue-400" />,
  planned: <Clock size={14} strokeWidth={1.5} className="text-neutral-500" />,
  skipped: <XCircle size={14} strokeWidth={1.5} className="text-yellow-400" />,
};

const LP_STATUS_COLOR: Record<LearningPathStatus, string> = {
  completed: 'border-emerald-800/50 bg-emerald-900/20 text-emerald-400',
  in_progress: 'border-blue-800/50 bg-blue-900/20 text-blue-400',
  planned: 'border-neutral-800 bg-neutral-900/30 text-neutral-500',
  skipped: 'border-yellow-800/50 bg-yellow-900/20 text-yellow-400',
};

const LEVEL_LABEL: Record<StudentLevel, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

const LEVEL_COLOR: Record<StudentLevel, string> = {
  beginner: 'bg-green-900/40 text-green-300',
  intermediate: 'bg-yellow-900/40 text-yellow-300',
  advanced: 'bg-purple-900/40 text-purple-300',
};

const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  hw: <PenLine size={14} strokeWidth={1.5} />,
  check: <CheckCircle2 size={14} strokeWidth={1.5} />,
  plan: <ClipboardList size={14} strokeWidth={1.5} />,
  test: <BarChart3 size={14} strokeWidth={1.5} />,
};

const FILE_ICON: Record<string, React.ReactNode> = {
  docx: <FileText size={16} strokeWidth={1.5} />,
  pdf: <FileType size={16} strokeWidth={1.5} className="text-red-400" />,
  py: <FileCode size={16} strokeWidth={1.5} className="text-green-400" />,
  txt: <FileText size={16} strokeWidth={1.5} className="text-neutral-400" />,
};

const PRIORITY_FROM_INT: Record<number, Priority> = { 0: 'low', 1: 'medium', 2: 'high' };

function mapDbStudentToMock(s: Record<string, unknown>): MockStudent {
  const sched = s.schedule as Record<string, unknown> | null;
  const schedArr = Array.isArray(sched) ? (sched as ScheduleSlot[]) : [];
  const stats = (s.stats ?? {}) as Record<string, unknown>;
  return {
    id: String(s.id),
    name: String(s.name),
    subject: String(s.subject ?? ''),
    level: (s.level as StudentLevel) ?? 'beginner',
    schedule: schedArr,
    startDate: stats.startDate ? String(stats.startDate) : new Date(s.createdAt as string).toISOString().slice(0, 10),
    totalLessons: (stats.totalLessons as number) ?? 0,
  };
}

function mapDbTaskToTeaching(t: Record<string, unknown>): TeachingTask {
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const dueDate = t.dueDate ? new Date(t.dueDate as string).toISOString().slice(0, 10) : null;
  return {
    id: String(t.id),
    studentId: String(meta.studentId ?? ''),
    title: String(t.title),
    status: (t.status as TaskStatus) ?? 'todo',
    priority: PRIORITY_FROM_INT[t.priority as number] ?? 'low',
    context: String(t.description ?? ''),
    deadline: dueDate,
  };
}

function getStudentLessons(studentId: string): MockLesson[] {
  return MOCK_LESSONS.filter((l) => l.studentId === studentId);
}

function getStudentHomeworks(studentId: string): MockHomework[] {
  return MOCK_HOMEWORKS.filter((h) => h.studentId === studentId);
}

function getStudentTopics(studentId: string): MockTopic[] {
  return MOCK_TOPICS.filter((t) => t.studentId === studentId);
}

function getStudentName(studentId: string): string {
  return MOCK_STUDENTS.find((s) => s.id === studentId)?.name ?? studentId;
}

function getTaskTypeIcon(title: string): React.ReactNode {
  if (title.includes('Проверить')) return TASK_TYPE_ICON.check;
  if (title.includes('план')) return TASK_TYPE_ICON.plan;
  if (title.includes('тест') || title.includes('Тест')) return TASK_TYPE_ICON.test;
  return TASK_TYPE_ICON.hw;
}

function hwStats(homeworks: MockHomework[]) {
  const counts: Record<string, number> = { done: 0, upcoming: 0, overdue: 0 };
  for (const h of homeworks) counts[h.status] = (counts[h.status] ?? 0) + 1;
  return counts;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)] ?? ''}`;
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'all-homeworks'; filter: HomeworkStatus | 'all' }
  | { kind: 'lesson-detail'; lessonId: string }
  | { kind: 'homework-detail'; homeworkId: string }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'add-student' };

// --- Component ---

export function Teaching() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('students');
  const [activeStudentId, setActiveStudentId] = useState<string>('');
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-teaching-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});
  const [newStudent, setNewStudent] = useState({ name: '', subject: '', level: 'beginner' as StudentLevel, days: '', time: '' });
  const isDraggingSidebar = useRef(false);

  // DB state
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [teachingTasks, setTeachingTasks] = useState<TeachingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  // Load data from DB
  const reloadData = useCallback(async () => {
    try {
      const [dbStudents, dbTasks] = await Promise.all([
        window.db.students.list(),
        window.db.tasks.list('teaching'),
      ]);
      const mapped = dbStudents.map((s) => mapDbStudentToMock(s as unknown as Record<string, unknown>));
      const mappedTasks = dbTasks.map((t) => mapDbTaskToTeaching(t as unknown as Record<string, unknown>));
      setStudents(mapped);
      setTeachingTasks(mappedTasks);
      if (mapped.length > 0 && mapped[0]) {
        setActiveStudentId(mapped[0].id);
        window.chat.setAgentContext('teaching', { studentId: mapped[0].id });
      }
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка подключения к БД');
    }
  }, []);

  // Initial load
  useEffect(() => {
    reloadData().finally(() => setLoading(false));
  }, [reloadData]);

  // Reload on data-changed from AI
  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('tasks') || entities.includes('students')) {
        reloadData();
      }
    });
  }, [reloadData]);

  const student = students.find((s) => s.id === activeStudentId);
  const lessons = student ? getStudentLessons(student.id) : [];
  const homeworks = student ? getStudentHomeworks(student.id) : [];
  const topics = student ? getStudentTopics(student.id) : [];
  const studentTasks = student ? teachingTasks.filter((t) => t.studentId === student.id) : [];

  // DB attached homework files for sidebar
  const [sidebarHomeworkFiles, setSidebarHomeworkFiles] = useState<Array<{id: string; filename: string; filepath: string; status: string; createdAt: string}>>([]);

  const loadHomeworkFiles = useCallback((studentId: string) => {
    window.db.files.list('student', studentId).then((files) => {
      const hwFiles = files
        .filter((f) => f.category === 'homework')
        .map((f) => ({ id: f.id, filename: f.filename, filepath: f.filepath, status: (f as Record<string, unknown>).status as string ?? 'pending', createdAt: f.createdAt ? String(f.createdAt) : '' }));
      setSidebarHomeworkFiles(hwFiles);
    }).catch((err) => console.error('[Teaching] Failed to load sidebar files:', err));
  }, []);

  useEffect(() => {
    if (!student) { setSidebarHomeworkFiles([]); return; }
    loadHomeworkFiles(student.id);
  }, [student?.id, loadHomeworkFiles]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('files') && student) {
        loadHomeworkFiles(student.id);
      }
    });
  }, [student?.id, loadHomeworkFiles]);

  // DB lessons for current student
  const [dbLessons, setDbLessons] = useState<Array<{id: string; studentId: string; date: string; topic: string; status: string; notes: string; homeworkGiven: string | null}>>([]);

  const loadLessons = useCallback((studentId: string) => {
    window.db.lessons.list(studentId).then((rows) => {
      setDbLessons(rows.map((r) => ({
        id: r.id,
        studentId: r.studentId ?? studentId,
        date: typeof r.date === 'string' ? r.date : String(r.date),
        topic: r.topic ?? '',
        status: r.status ?? 'planned',
        notes: r.notes ?? '',
        homeworkGiven: r.homeworkGiven ?? null,
      })));
    }).catch((err) => console.error('[Teaching] Failed to load lessons:', err));
  }, []);

  useEffect(() => {
    if (!student) { setDbLessons([]); return; }
    loadLessons(student.id);
  }, [student?.id, loadLessons]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('lessons') && student) {
        loadLessons(student.id);
      }
    });
  }, [student?.id, loadLessons]);

  // DB learning path topics for current student
  const [dbLearningPath, setDbLearningPath] = useState<LearningPathTopic[]>([]);

  const loadLearningPath = useCallback((studentId: string) => {
    window.db.learningPath.list(studentId).then((rows) => {
      setDbLearningPath(rows);
    }).catch((err) => console.error('[Teaching] Failed to load learning path:', err));
  }, []);

  useEffect(() => {
    if (!student) { setDbLearningPath([]); return; }
    loadLearningPath(student.id);
  }, [student?.id, loadLearningPath]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('learning-path') && student) {
        loadLearningPath(student.id);
      }
    });
  }, [student?.id, loadLearningPath]);

  // Computed real stats
  const realLessonCount = dbLessons.length;
  const realHwDone = sidebarHomeworkFiles.filter((f) => f.status === 'completed').length;
  const realHwPending = sidebarHomeworkFiles.filter((f) => f.status === 'pending').length;

  // All-students data for General tab
  const allUpcomingLessons = MOCK_LESSONS
    .filter((l) => l.status === 'planned')
    .sort((a, b) => a.date.localeCompare(b.date));
  const allRecentLessons = MOCK_LESSONS
    .filter((l) => l.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));
  const allOverdueHw = MOCK_HOMEWORKS.filter((h) => h.status === 'overdue').length;
  const lessonsThisWeek = MOCK_LESSONS.filter((l) => {
    const d = l.date;
    return d >= '2026-03-17' && d <= '2026-03-23';
  }).length;

  const selectStudent = useCallback((id: string) => {
    setActiveStudentId(id);
    window.chat.setAgentContext('teaching', { studentId: id });
    setSidebarTab('students');
    setMainView({ kind: 'overview' });
  }, []);

  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-teaching-sidebar-width', String(w));
    };
    const onUp = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const toggleTaskChecked = useCallback((taskId: string) => {
    setTaskChecked((prev) => {
      const newChecked = !prev[taskId];
      const newStatus = newChecked ? 'done' : 'todo';
      window.db.tasks.update(taskId, { status: newStatus }).catch(() => {});
      return { ...prev, [taskId]: newChecked };
    });
  }, []);

  const getEffectiveStatus = useCallback((task: TeachingTask): TaskStatus => {
    if (taskChecked[task.id]) return 'done';
    return task.status;
  }, [taskChecked]);

  const sendTaskToChat = useCallback((task: TeachingTask) => {
    const text = `Выполни задачу: ${task.title}\n${task.context}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, []);

  return (
    <MainLayout agent="teaching" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Tabs */}
          <div className="flex border-b border-neutral-800">
            <button
              onClick={() => setSidebarTab('students')}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sidebarTab === 'students'
                  ? 'text-neutral-200 border-b-2 border-blue-500'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Ученики
            </button>
            <button
              onClick={() => setSidebarTab('general')}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sidebarTab === 'general'
                  ? 'text-neutral-200 border-b-2 border-blue-500'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Общее
            </button>
          </div>

          {sidebarTab === 'students' && (
            <>
              {/* Students header + add button */}
              <div className="px-3 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Students</span>
                <button
                  onClick={() => setMainView({ kind: 'add-student' })}
                  className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-sm"
                  title="Добавить ученика"
                >
                  +
                </button>
              </div>
              <nav className="px-2 space-y-0.5">
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s.id)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                      activeStudentId === s.id
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                    }`}
                  >
                    <span className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                    {s.name}
                  </button>
                ))}
              </nav>

              {/* Student detail sections */}
              {student && (
                <div className="flex-1 overflow-hidden flex flex-col mt-2">
                  <div className="mx-3 border-t border-neutral-800" />
                  <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                    {/* Info */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Информация
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="text-neutral-300 font-medium">{student.name}</div>
                        <div className="text-neutral-400">{student.subject}</div>
                        <div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LEVEL_COLOR[student.level]}`}>
                            {LEVEL_LABEL[student.level]}
                          </span>
                        </div>
                        <div className="text-neutral-500 text-[11px] mt-1">
                          {student.schedule.map((s) => `${s.day} ${s.time}`).join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Tasks for this student */}
                    {studentTasks.length > 0 && (
                      <>
                        <div className="px-3 pt-3 pb-2">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Задачи
                          </div>
                          <div className="space-y-1">
                            {studentTasks.map((task) => {
                              const effectiveStatus = getEffectiveStatus(task);
                              const pColor = PRIORITY_COLORS[task.priority];
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => setMainView({ kind: 'task-detail', taskId: task.id })}
                                  className={`w-full text-left flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors ${
                                    mainView.kind === 'task-detail' && 'taskId' in mainView && mainView.taskId === task.id
                                      ? 'bg-neutral-800/50' : ''
                                  }`}
                                >
                                  <span className={`shrink-0 ${STATUS_COLORS[effectiveStatus]}`}>
                                    {effectiveStatus === 'done' ? <CheckCircle2 size={14} strokeWidth={1.5} /> : effectiveStatus === 'in_progress' ? <RefreshCw size={14} strokeWidth={1.5} /> : <Clock size={14} strokeWidth={1.5} />}
                                  </span>
                                  <span className={`truncate ${effectiveStatus === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-400'}`}>
                                    {task.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mx-3 border-t border-neutral-800" />
                      </>
                    )}

                    {/* Upcoming lessons */}
                    {lessons.filter((l) => l.status === 'planned').length > 0 && (
                      <>
                        <div className="px-3 pt-3 pb-2">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Ближайшие уроки
                          </div>
                          <div className="space-y-1.5">
                            {lessons.filter((l) => l.status === 'planned').slice(0, 3).map((lesson) => (
                              <button
                                key={lesson.id}
                                onClick={() => setMainView({ kind: 'lesson-detail', lessonId: lesson.id })}
                                className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-neutral-600 text-[10px] shrink-0">{lesson.date.slice(5)}</span>
                                  <span className="text-[10px] text-blue-400/70">запланирован</span>
                                </div>
                                <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                                  {lesson.topic}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mx-3 border-t border-neutral-800" />
                      </>
                    )}

                    {/* Homeworks — DB files */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Домашки
                      </div>
                      <div className="space-y-1">
                        {sidebarHomeworkFiles.map((file) => (
                          <button
                            key={file.id}
                            onClick={() => window.electronAPI.openFile(file.filepath)}
                            className="w-full text-left flex items-center gap-1.5 text-xs text-neutral-400 py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                          >
                            <span className="text-[11px] shrink-0">{FILE_ICON.docx}</span>
                            <span className="truncate group-hover:text-neutral-200 transition-colors">{file.filename}</span>
                          </button>
                        ))}
                        {homeworks.slice(0, 4).map((hw) => (
                          <button
                            key={hw.id}
                            onClick={() => setMainView({ kind: 'homework-detail', homeworkId: hw.id })}
                            className="w-full text-left flex items-center gap-1.5 text-xs text-neutral-400 py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                          >
                            <span className="text-[11px] shrink-0">{HW_STATUS_ICON[hw.status]}</span>
                            <span className="truncate group-hover:text-neutral-200 transition-colors">{hw.title}</span>
                            <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">{hw.dueDate.slice(5)}</span>
                          </button>
                        ))}
                        {sidebarHomeworkFiles.length === 0 && homeworks.length === 0 && (
                          <div className="text-[11px] text-neutral-600">Пока пусто</div>
                        )}
                      </div>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Learning path */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Путь обучения
                      </div>
                      <div className="space-y-1">
                        {dbLearningPath.length > 0 ? dbLearningPath.map((topic) => (
                          <div
                            key={topic.id}
                            className={`flex items-center gap-1.5 text-xs ${
                              topic.status === 'in_progress' ? 'text-neutral-200' : 'text-neutral-400'
                            }`}
                          >
                            <span className="text-[11px] shrink-0">{LP_STATUS_ICON[topic.status]}</span>
                            <span className="truncate">{topic.title}</span>
                          </div>
                        )) : topics.map((topic) => (
                          <div
                            key={topic.id}
                            className={`flex items-center gap-1.5 text-xs ${
                              topic.status === 'current' ? 'text-neutral-200' : 'text-neutral-400'
                            }`}
                          >
                            <span className="text-[11px] shrink-0">{TOPIC_ICON[topic.status]}</span>
                            <span className="truncate">{topic.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Lesson history */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        История уроков
                      </div>
                      <div className="space-y-0.5">
                        {lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setMainView({ kind: 'lesson-detail', lessonId: lesson.id })}
                            className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                          >
                            <span className="text-neutral-600 mr-1.5 text-[10px]">{lesson.date.slice(5)}</span>
                            <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors">
                              {lesson.topic}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {sidebarTab === 'general' && (
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
              {/* Stats */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Статистика
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-blue-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-blue-400">{students.length}</div>
                    <div className="text-[10px] text-blue-400/70 uppercase">Учеников</div>
                  </div>
                  <div className="bg-emerald-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-emerald-400">{lessonsThisWeek}</div>
                    <div className="text-[10px] text-emerald-400/70 uppercase">Уроков/нед</div>
                  </div>
                  <div className="bg-red-400/10 rounded px-2 py-1.5 col-span-2">
                    <div className="text-sm font-bold text-red-400">{allOverdueHw}</div>
                    <div className="text-[10px] text-red-400/70 uppercase">Невыполненных ДЗ</div>
                  </div>
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* My tasks (all students) */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Мои задачи
                </div>
                <div className="space-y-1">
                  {teachingTasks.map((task) => {
                    const effectiveStatus = getEffectiveStatus(task);
                    const pColor = PRIORITY_COLORS[task.priority];
                    const isDone = effectiveStatus === 'done';
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors`}
                      >
                        <button
                          onClick={() => toggleTaskChecked(task.id)}
                          className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                            isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
                          }`}
                        >
                          {isDone && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="shrink-0">{getTaskTypeIcon(task.title)}</span>
                        <button
                          onClick={() => setMainView({ kind: 'task-detail', taskId: task.id })}
                          className={`truncate text-left flex-1 ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-400 hover:text-neutral-200'}`}
                        >
                          {task.title}
                        </button>
                        <button
                          onClick={() => sendTaskToChat(task)}
                          className="text-neutral-600 hover:text-blue-400 transition-colors shrink-0"
                          title="Отправить боту"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* Upcoming lessons (all students) */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Ближайшие уроки
                </div>
                <div className="space-y-1.5">
                  {allUpcomingLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        setActiveStudentId(lesson.studentId);
                        window.chat.setAgentContext('teaching', { studentId: lesson.studentId });
                        setMainView({ kind: 'lesson-detail', lessonId: lesson.id });
                      }}
                      className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(lesson.date)}</span>
                        <span className="text-blue-400/70 text-[10px]">{getStudentName(lesson.studentId)}</span>
                      </div>
                      <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                        {lesson.topic}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* Recent lessons (all students) */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Последние уроки
                </div>
                <div className="space-y-0.5 max-h-40 overflow-y-auto scrollbar-thin">
                  {allRecentLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        setActiveStudentId(lesson.studentId);
                        window.chat.setAgentContext('teaching', { studentId: lesson.studentId });
                        setMainView({ kind: 'lesson-detail', lessonId: lesson.id });
                      }}
                      className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                    >
                      <span className="text-neutral-600 text-[10px] mr-1">{lesson.date.slice(5)}</span>
                      <span className="text-neutral-500 text-[10px] mr-1">{getStudentName(lesson.studentId).split(' ')[0]}</span>
                      <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors">
                        {lesson.topic}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={handleSidebarDragStart}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
        />

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-neutral-500" />
            </div>
          )}
          {dbError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {dbError}
            </div>
          )}
          {!loading && students.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <p className="text-lg mb-2">Нет учеников</p>
              <p className="text-sm">Добавьте первого!</p>
            </div>
          )}
          {!loading && student && mainView.kind === 'overview' && (
            <StudentOverview
              student={student}
              lessons={lessons}
              homeworks={homeworks}
              topics={topics}
              dbLearningPath={dbLearningPath}
              tasks={studentTasks}
              realLessonCount={realLessonCount}
              realHwDone={realHwDone}
              realHwPending={realHwPending}
              onLessonClick={(id) => setMainView({ kind: 'lesson-detail', lessonId: id })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
              onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
              getEffectiveStatus={getEffectiveStatus}
            />
          )}
          {!loading && student && mainView.kind === 'all-homeworks' && (
            <AllHomeworksView
              student={student}
              homeworks={homeworks}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'all-homeworks', filter: f })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
          {mainView.kind === 'lesson-detail' && (
            <LessonDetailView
              lesson={MOCK_LESSONS.find((l) => l.id === mainView.lessonId)}
              homeworks={MOCK_HOMEWORKS.filter((h) => h.lessonId === mainView.lessonId)}
              onBack={() => setMainView({ kind: 'overview' })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
            />
          )}
          {mainView.kind === 'homework-detail' && (
            <HomeworkDetailView
              homework={MOCK_HOMEWORKS.find((h) => h.id === mainView.homeworkId)}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
          {!loading && mainView.kind === 'task-detail' && (
            <TaskDetailView
              task={teachingTasks.find((t) => t.id === mainView.taskId)}
              onBack={() => setMainView({ kind: 'overview' })}
              toggleTaskChecked={toggleTaskChecked}
              getEffectiveStatus={getEffectiveStatus}
              sendTaskToChat={sendTaskToChat}
            />
          )}
          {!loading && mainView.kind === 'add-student' && (
            <AddStudentView
              form={newStudent}
              onChange={setNewStudent}
              onBack={() => setMainView({ kind: 'overview' })}
              onSave={async () => {
                if (!newStudent.name.trim()) return;
                const schedule = newStudent.days
                  ? newStudent.days.split(',').map((d) => ({ day: d.trim(), time: newStudent.time || '17:00' }))
                  : [];
                try {
                  const created = await window.db.students.create({
                    name: newStudent.name,
                    subject: newStudent.subject || null,
                    level: newStudent.level,
                    schedule,
                    stats: {},
                  });
                  const mapped = mapDbStudentToMock(created as unknown as Record<string, unknown>);
                  setStudents((prev) => [mapped, ...prev]);
                  setActiveStudentId(mapped.id);
                  window.chat.setAgentContext('teaching', { studentId: mapped.id });
                } catch {
                  // DB unavailable, skip
                }
                setNewStudent({ name: '', subject: '', level: 'beginner', days: '', time: '' });
                setMainView({ kind: 'overview' });
              }}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function StudentOverview({
  student,
  lessons,
  homeworks,
  topics,
  dbLearningPath,
  tasks,
  realLessonCount,
  realHwDone,
  realHwPending,
  onLessonClick,
  onHomeworkClick,
  onTaskClick,
  getEffectiveStatus,
}: {
  student: MockStudent;
  lessons: MockLesson[];
  homeworks: MockHomework[];
  topics: MockTopic[];
  dbLearningPath: LearningPathTopic[];
  tasks: TeachingTask[];
  realLessonCount: number;
  realHwDone: number;
  realHwPending: number;
  onLessonClick: (id: string) => void;
  onHomeworkClick: (id: string) => void;
  onTaskClick: (id: string) => void;
  getEffectiveStatus: (task: TeachingTask) => TaskStatus;
}) {
  const stats = hwStats(homeworks);
  const upcomingLessons = lessons.filter((l) => l.status === 'planned').slice(0, 3);
  const lastDoneHomework = homeworks.filter((h) => h.status === 'done').at(-1);

  const [dbFiles, setDbFiles] = useState<Array<{id: string; filename: string; filepath: string; fileType: string; category: string; createdAt: string}>>([]);

  const loadFiles = useCallback(() => {
    console.log('[Teaching] Loading files for student:', student.id);
    window.db.files.list('student', student.id).then((files) => {
      console.log('[Teaching] Files result:', files);
      setDbFiles(files.map((f) => ({
        id: f.id,
        filename: f.filename,
        filepath: f.filepath,
        fileType: f.fileType ?? 'md',
        category: f.category ?? 'material',
        createdAt: f.createdAt ? String(f.createdAt) : '',
      })));
    }).catch((err) => {
      console.error('[Teaching] Failed to load files:', err);
    });
  }, [student.id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('files')) {
        loadFiles();
      }
    });
  }, [student.id]);

  // Collect all files from lessons and homeworks
  const attachedFiles: Array<{ file: MockFile; source: string }> = [];
  for (const l of lessons) {
    if (l.files) {
      for (const f of l.files) {
        attachedFiles.push({ file: f, source: `Урок: ${l.topic}` });
      }
    }
  }
  for (const h of homeworks) {
    if (h.file) {
      attachedFiles.push({ file: h.file, source: `ДЗ: ${h.title}` });
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Student card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
            <p className="text-neutral-400 text-sm">{student.subject}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded font-medium ${LEVEL_COLOR[student.level]}`}>
            {LEVEL_LABEL[student.level]}
          </span>
        </div>
        <div className="text-xs text-neutral-500">
          Занимаемся с {formatDate(student.startDate)}
          <span className="mx-2">&middot;</span>
          {student.schedule.map((s) => `${s.day} ${s.time}`).join(', ')}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatBadge label="Уроков" count={realLessonCount} color="text-blue-400 bg-blue-400/10" />
        <StatBadge label="ДЗ выполнено" count={realHwDone} color="text-emerald-400 bg-emerald-400/10" />
        <StatBadge label="ДЗ предстоит" count={realHwPending} color="text-yellow-400 bg-yellow-400/10" />
        {(stats.overdue ?? 0) > 0 && (
          <StatBadge label="Просрочено" count={stats.overdue ?? 0} color="text-red-400 bg-red-400/10" />
        )}
      </div>

      {/* Tasks for this student */}
      {tasks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Задачи</h2>
          <div className="space-y-1.5">
            {tasks.map((task) => {
              const pColor = PRIORITY_COLORS[task.priority];
              const effectiveStatus = getEffectiveStatus(task);
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border-l-2 ${pColor.border} bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors`}
                >
                  <span className={`text-sm shrink-0 ${STATUS_COLORS[effectiveStatus]}`}>
                    {effectiveStatus === 'done' ? <CheckCircle2 size={14} strokeWidth={1.5} /> : effectiveStatus === 'in_progress' ? <RefreshCw size={14} strokeWidth={1.5} /> : <Clock size={14} strokeWidth={1.5} />}
                  </span>
                  <span className={`text-sm flex-1 ${effectiveStatus === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>
                    {task.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${pColor.badge}`}>{pColor.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Материалы</h2>
          <div className="space-y-1.5">
            {attachedFiles.map(({ file, source }) => (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5"
              >
                <span className="text-sm shrink-0">{FILE_ICON[file.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-neutral-300 truncate">{file.name}</div>
                  <div className="text-[10px] text-neutral-600 truncate">{source}</div>
                </div>
                <button className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                  Открыть
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DB Attached Files — by category */}
      {dbFiles.length > 0 && (() => {
        const CATEGORY_LABELS: Record<string, string> = {
          homework: 'Домашние задания',
          lesson_plan: 'Планы уроков',
          material: 'Материалы',
          notes: 'Заметки',
          test: 'Тесты',
          solution: 'Решения',
        };
        const categories = [...new Set(dbFiles.map((f) => f.category))];
        return categories.map((cat) => {
          const catFiles = dbFiles.filter((f) => f.category === cat);
          return (
            <div key={cat} className="mb-6">
              <h2 className="text-sm font-semibold text-neutral-300 mb-3">{CATEGORY_LABELS[cat] ?? cat}</h2>
              <div className="space-y-1.5">
                {catFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                    onClick={() => window.electronAPI.openFile(file.filepath)}
                  >
                    <span className="text-sm shrink-0">{FILE_ICON[file.fileType] ?? FILE_ICON.txt}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-300 truncate">{file.filename}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.electronAPI.openFile(file.filepath); }}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
                    >
                      Открыть
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        });
      })()}

      {/* Upcoming lessons */}
      {upcomingLessons.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Ближайшие уроки</h2>
          <div className="space-y-2">
            {upcomingLessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onLessonClick(lesson.id)}
                className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
              >
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="text-neutral-500 text-xs shrink-0">{formatDate(lesson.date)}</span>
                  <span className="text-neutral-300">{lesson.topic}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Last homework */}
      {lastDoneHomework && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последнее ДЗ</h2>
          <button
            onClick={() => onHomeworkClick(lastDoneHomework.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{HW_STATUS_ICON[lastDoneHomework.status]}</span>
              <span className="text-sm text-neutral-300">{lastDoneHomework.title}</span>
            </div>
            <p className="text-xs text-neutral-500">{lastDoneHomework.description}</p>
            {lastDoneHomework.grade && (
              <div className="mt-2 text-xs">
                <span className="text-neutral-600 mr-1">Оценка:</span>
                <span className="text-neutral-300">{lastDoneHomework.grade}</span>
                {lastDoneHomework.comment && (
                  <span className="text-neutral-500 ml-2">— {lastDoneHomework.comment}</span>
                )}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Learning path */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Путь обучения</h2>
        {dbLearningPath.length > 0 ? (
          <div className="space-y-2">
            {dbLearningPath.map((topic, idx) => (
              <div
                key={topic.id}
                className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border ${LP_STATUS_COLOR[topic.status]}`}
              >
                <span className="shrink-0 mt-0.5">{LP_STATUS_ICON[topic.status]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-600 font-mono">{idx + 1}</span>
                    <span className="text-sm font-medium">{topic.title}</span>
                  </div>
                  {topic.description && (
                    <p className="text-xs text-neutral-500 mt-0.5">{topic.description}</p>
                  )}
                  {topic.notes && (
                    <p className="text-[11px] text-neutral-600 mt-1 italic">{topic.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic.id}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  topic.status === 'done'
                    ? 'border-emerald-800/50 bg-emerald-900/20 text-emerald-400'
                    : topic.status === 'current'
                      ? 'border-blue-800/50 bg-blue-900/20 text-blue-400'
                      : 'border-neutral-800 bg-neutral-900/30 text-neutral-500'
                }`}
              >
                {TOPIC_ICON[topic.status]} {topic.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg shadow-sm shadow-black/10 ${color}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function AllHomeworksView({
  student,
  homeworks,
  filter,
  onFilterChange,
  onHomeworkClick,
  onBack,
}: {
  student: MockStudent;
  homeworks: MockHomework[];
  filter: HomeworkStatus | 'all';
  onFilterChange: (f: HomeworkStatus | 'all') => void;
  onHomeworkClick: (id: string) => void;
  onBack: () => void;
}) {
  const filtered = filter === 'all' ? homeworks : homeworks.filter((h) => h.status === filter);
  const filters: Array<{ value: HomeworkStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'done', label: 'Выполнено' },
    { value: 'upcoming', label: 'Предстоит' },
    { value: 'overdue', label: 'Просрочено' },
  ];

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к обзору
      </button>
      <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">Все домашние задания</h2>

      <div className="flex gap-1 mb-6">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((hw) => (
          <button
            key={hw.id}
            onClick={() => onHomeworkClick(hw.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0">{HW_STATUS_ICON[hw.status]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{hw.title}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  Срок: {formatDate(hw.dueDate)}
                  {hw.grade && <span className="ml-2">Оценка: {hw.grade}</span>}
                </div>
              </div>
              <span className="text-[10px] text-neutral-600 uppercase shrink-0">{HW_STATUS_LABEL[hw.status]}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет домашек с таким статусом</div>
        )}
      </div>
    </div>
  );
}

function LessonDetailView({
  lesson,
  homeworks,
  onBack,
  onHomeworkClick,
}: {
  lesson: MockLesson | undefined;
  homeworks: MockHomework[];
  onBack: () => void;
  onHomeworkClick: (id: string) => void;
}) {
  if (!lesson) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Урок не найден</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            lesson.status === 'completed' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-blue-900/40 text-blue-300'
          }`}
        >
          {lesson.status === 'completed' ? 'Проведён' : 'Запланирован'}
        </span>
        <span className="text-neutral-500 text-sm">{formatDate(lesson.date)}</span>
        <span className="text-neutral-600 text-xs">{getStudentName(lesson.studentId)}</span>
      </div>

      <h1 className="text-xl font-bold mb-6">{lesson.topic}</h1>

      {lesson.notes && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Заметки</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{lesson.notes}</p>
        </div>
      )}

      {lesson.homeworkGiven && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Заданное ДЗ</h2>
          <p className="text-neutral-300 text-sm">{lesson.homeworkGiven}</p>
        </div>
      )}

      {/* Files from lesson */}
      {lesson.files && lesson.files.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Файлы урока</h2>
          <div className="space-y-1.5">
            {lesson.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5"
              >
                <span className="text-sm shrink-0">{FILE_ICON[file.type]}</span>
                <span className="text-sm text-neutral-300 flex-1">{file.name}</span>
                <button className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Открыть</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {homeworks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Домашние задания</h2>
          <div className="space-y-2">
            {homeworks.map((hw) => (
              <button
                key={hw.id}
                onClick={() => onHomeworkClick(hw.id)}
                className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{HW_STATUS_ICON[hw.status]}</span>
                  <span className="text-sm text-neutral-300">{hw.title}</span>
                  <span className="text-[10px] text-neutral-600 uppercase ml-auto">{HW_STATUS_LABEL[hw.status]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkDetailView({
  homework,
  onBack,
}: {
  homework: MockHomework | undefined;
  onBack: () => void;
}) {
  if (!homework) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Домашнее задание не найдено</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg">{HW_STATUS_ICON[homework.status]}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            homework.status === 'done'
              ? 'bg-emerald-900/40 text-emerald-300'
              : homework.status === 'upcoming'
                ? 'bg-yellow-900/40 text-yellow-300'
                : 'bg-red-900/40 text-red-300'
          }`}
        >
          {HW_STATUS_LABEL[homework.status]}
        </span>
        <span className="text-neutral-600 text-xs">{getStudentName(homework.studentId)}</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{homework.title}</h1>
      <div className="text-neutral-500 text-sm mb-6">Срок: {formatDate(homework.dueDate)}</div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Задание</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">{homework.description}</p>
      </div>

      {/* File */}
      {homework.file && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Файл</h2>
          <div className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5">
            <span className="text-sm shrink-0">{FILE_ICON[homework.file.type]}</span>
            <span className="text-sm text-neutral-300 flex-1">{homework.file.name}</span>
            <button className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Открыть</button>
          </div>
        </div>
      )}

      {homework.grade && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Оценка</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-neutral-200">{homework.grade}</span>
            {homework.comment && (
              <span className="text-sm text-neutral-400">{homework.comment}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetailView({
  task,
  onBack,
  toggleTaskChecked,
  getEffectiveStatus,
  sendTaskToChat,
}: {
  task: TeachingTask | undefined;
  onBack: () => void;
  toggleTaskChecked: (id: string) => void;
  getEffectiveStatus: (task: TeachingTask) => TaskStatus;
  sendTaskToChat: (task: TeachingTask) => void;
}) {
  if (!task) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Задача не найдена</p>
      </div>
    );
  }

  const pColor = PRIORITY_COLORS[task.priority];
  const effectiveStatus = getEffectiveStatus(task);
  const isDone = effectiveStatus === 'done';

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => toggleTaskChecked(task.id)}
          className={`w-5 h-5 mt-1 rounded border shrink-0 flex items-center justify-center transition-colors ${
            isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
          }`}
        >
          {isDone && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${isDone ? 'text-neutral-500 line-through' : ''}`}>{task.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${pColor.badge}`}>{pColor.label}</span>
            <span className={`text-xs ${STATUS_COLORS[effectiveStatus]}`}>{STATUS_LABEL[effectiveStatus]}</span>
            <span className="text-xs text-neutral-600">{getStudentName(task.studentId)}</span>
            {task.deadline && (
              <span className="text-xs text-neutral-600">Дедлайн: {formatDate(task.deadline)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">Контекст</h2>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3">
          <p className="text-sm text-neutral-400 leading-relaxed">{task.context}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => sendTaskToChat(task)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Отправить боту
        </button>
      </div>
    </div>
  );
}

function AddStudentView({
  form,
  onChange,
  onBack,
  onSave,
}: {
  form: { name: string; subject: string; level: StudentLevel; days: string; time: string };
  onChange: (f: { name: string; subject: string; level: StudentLevel; days: string; time: string }) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div className="max-w-md">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      <h1 className="text-2xl font-bold mb-6">Новый ученик</h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Имя</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Имя Фамилия"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Предмет</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => onChange({ ...form, subject: e.target.value })}
            placeholder="Python, Информатика (ЕГЭ)..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Уровень</label>
          <select
            value={form.level}
            onChange={(e) => onChange({ ...form, level: e.target.value as StudentLevel })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          >
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Дни</label>
            <input
              type="text"
              value={form.days}
              onChange={(e) => onChange({ ...form, days: e.target.value })}
              placeholder="Вт, Сб"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Время</label>
            <input
              type="text"
              value={form.time}
              onChange={(e) => onChange({ ...form, time: e.target.value })}
              placeholder="17:00"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        <button
          onClick={onSave}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Сохранить
        </button>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 mt-4">
          <p className="text-xs text-neutral-500">
            Или скажите боту: <span className="text-neutral-400">"Добавь ученика Петю, физика, beginner"</span>
          </p>
        </div>
      </div>
    </div>
  );
}
