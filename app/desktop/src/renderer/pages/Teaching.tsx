import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useSidebar } from '../context/sidebar-context';
import type { TaskStatus, LearningPathTopic, LearningPathStatus, StudentRate, Transaction } from '@mark2/shared';
import { CheckCircle2, RefreshCw, Clock, XCircle, FileText, FileType, FileCode, PenLine, ClipboardList, BarChart3, Loader2, Banknote, Folder, FolderOpen, File, Code, ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import { PythonEditor } from '../components/PythonEditor';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useUndo } from '../context/undo-context';

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

function toStudentSlug(name: string): string {
  const CYR: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  };
  return name.toLowerCase().split('').map((ch) => CYR[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'all-homeworks'; filter: HomeworkStatus | 'all' }
  | { kind: 'lesson-detail'; lessonId: string }
  | { kind: 'homework-detail'; homeworkId: string }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'add-student' }
  | { kind: 'learning-path' }
  | { kind: 'learning-path-topic'; topicId: string }
  | { kind: 'lessons-history' }
  | { kind: 'homework-files'; filter: 'pending' | 'completed' | 'all' }
  | { kind: 'all-files' }
  | { kind: 'student-files'; openFilePath?: string };

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
  const { leftCollapsed, setLeftKey } = useSidebar();
  useEffect(() => { setLeftKey('teaching'); }, [setLeftKey]);
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
  const [sidebarHomeworkFiles, setSidebarHomeworkFiles] = useState<Array<{id: string; filename: string; filepath: string; status: string; topicId: string | null; createdAt: string}>>([]);

  const loadHomeworkFiles = useCallback((studentId: string) => {
    window.db.files.list('student', studentId).then((files) => {
      const hwFiles = files
        .filter((f) => f.category === 'homework')
        .map((f) => ({ id: f.id, filename: f.filename, filepath: f.filepath, status: (f as Record<string, unknown>).status as string ?? 'pending', topicId: f.topicId ?? null, createdAt: f.createdAt ? String(f.createdAt) : '' }));
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
  const [dbLessons, setDbLessons] = useState<Array<{id: string; studentId: string; date: string; topic: string; status: string; notes: string; homeworkGiven: string | null; topicId: string | null}>>([]);

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
        topicId: r.topicId ?? null,
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
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftCollapsed ? 0 : sidebarWidth }}
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
                        <NextLessonLabel schedule={student.schedule} />
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

                    {/* Files — student file tree */}
                    <SidebarFileTree studentName={student.name} onFileNavigate={(filePath) => setMainView({ kind: 'student-files', openFilePath: filePath })} />
                    <div className="px-3 pb-1">
                      <button
                        onClick={() => setMainView({ kind: 'student-files' })}
                        className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                      >
                        Все файлы &rarr;
                      </button>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Learning path */}
                    <div className="px-3 pt-3 pb-2">
                      <button
                        onClick={() => setMainView({ kind: 'learning-path' })}
                        className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 hover:text-neutral-300 transition-colors"
                      >
                        Путь обучения
                      </button>
                      <div className="space-y-1">
                        {dbLearningPath.length > 0 ? dbLearningPath.map((topic) => (
                          <button
                            key={topic.id}
                            onClick={() => setMainView({ kind: 'learning-path-topic', topicId: topic.id })}
                            className={`w-full text-left flex items-center gap-1.5 text-xs py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors ${
                              topic.status === 'in_progress' ? 'text-neutral-200' : 'text-neutral-400'
                            }`}
                          >
                            {topic.status === 'completed' ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 flex items-center justify-center text-[7px] text-white font-bold">✓</span>
                            ) : topic.status === 'in_progress' ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                            ) : topic.status === 'skipped' ? (
                              <span className="w-2.5 h-2.5 rounded-0 bg-yellow-500 shrink-0 relative">
                                <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neutral-900 font-bold leading-none">–</span>
                              </span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                            )}
                            <span className="truncate">{topic.title}</span>
                          </button>
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

                    {/* Lesson history — from DB */}
                    <div className="px-3 pt-3 pb-2">
                      <button
                        onClick={() => setMainView({ kind: 'lessons-history' })}
                        className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 hover:text-neutral-300 transition-colors"
                      >
                        История уроков
                      </button>
                      <div className="space-y-0.5">
                        {dbLessons.length > 0 ? dbLessons.slice(0, 10).map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setMainView({ kind: 'lessons-history' })}
                            className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                          >
                            <span className="text-neutral-600 mr-1.5 text-[10px]">{lesson.date.slice(5)}</span>
                            <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate">
                              {lesson.topic}
                            </span>
                          </button>
                        )) : (
                          <div className="text-[11px] text-neutral-600">Пока пусто</div>
                        )}
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

              <div className="mx-3 border-t border-neutral-800" />

              {/* All files */}
              <div className="px-3 pt-3 pb-2">
                <button
                  onClick={() => setMainView({ kind: 'all-files' })}
                  className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 hover:text-neutral-300 transition-colors"
                >
                  Все файлы &rarr;
                </button>
                <GeneralSidebarFileTree students={students} />
              </div>
            </div>
          )}
        </aside>

        {!leftCollapsed && (
          <div
            onMouseDown={handleSidebarDragStart}
            className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
          />
        )}

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
              onLearningPathClick={() => setMainView({ kind: 'learning-path' })}
              onLearningPathTopicClick={(id) => setMainView({ kind: 'learning-path-topic', topicId: id })}
              onLessonsHistoryClick={() => setMainView({ kind: 'lessons-history' })}
              onHomeworkFilesClick={(f) => setMainView({ kind: 'homework-files', filter: f })}
              onStudentFilesClick={() => setMainView({ kind: 'student-files' })}
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
          {!loading && student && mainView.kind === 'learning-path' && (
            <LearningPathView
              student={student}
              dbLearningPath={dbLearningPath}
              onBack={() => setMainView({ kind: 'overview' })}
              onTopicClick={(id) => setMainView({ kind: 'learning-path-topic', topicId: id })}
            />
          )}
          {!loading && student && mainView.kind === 'lessons-history' && (
            <LessonsHistoryView
              student={student}
              dbLessons={dbLessons}
              dbLearningPath={dbLearningPath}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
          {!loading && student && mainView.kind === 'homework-files' && (
            <HomeworkFilesView
              student={student}
              files={sidebarHomeworkFiles}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'homework-files', filter: f })}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
          {!loading && student && mainView.kind === 'learning-path-topic' && (
            <LearningPathTopicView
              topic={dbLearningPath.find((t) => t.id === mainView.topicId)}
              topicIndex={dbLearningPath.findIndex((t) => t.id === mainView.topicId)}
              studentId={student.id}
              dbLessons={dbLessons}
              sidebarHomeworkFiles={sidebarHomeworkFiles}
              onBack={() => setMainView({ kind: 'learning-path' })}
              onReload={() => { if (student) loadLearningPath(student.id); }}
            />
          )}
          {!loading && student && mainView.kind === 'student-files' && (
            <div>
              <button onClick={() => setMainView({ kind: 'overview' })} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
                &larr; Назад к ученику
              </button>
              <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
              <h2 className="text-neutral-500 text-sm mb-6">Файлы</h2>
              <StudentFilesView studentName={student.name} initialOpenFilePath={mainView.openFilePath} />
            </div>
          )}
          {!loading && mainView.kind === 'all-files' && (
            <div>
              <button onClick={() => setMainView({ kind: 'overview' })} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
                &larr; Назад
              </button>
              <h1 className="text-2xl font-bold mb-6">Все файлы</h1>
              <AllTeachingFilesTree />
            </div>
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
                  // Create file system folders for the student
                  window.teaching.files.ensureStudent(toStudentSlug(newStudent.name));
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
  onLearningPathClick,
  onLearningPathTopicClick,
  onLessonsHistoryClick,
  onHomeworkFilesClick,
  onStudentFilesClick,
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
  onLearningPathClick: () => void;
  onLearningPathTopicClick: (id: string) => void;
  onLessonsHistoryClick: () => void;
  onHomeworkFilesClick: (filter: 'pending' | 'completed') => void;
  onStudentFilesClick: () => void;
  getEffectiveStatus: (task: TeachingTask) => TaskStatus;
}) {
  const stats = hwStats(homeworks);
  const upcomingLessons = lessons.filter((l) => l.status === 'planned').slice(0, 3);
  const lastDoneHomework = homeworks.filter((h) => h.status === 'done').at(-1);

  const [overviewTab, setOverviewTab] = useState<'overview' | 'files'>('overview');
  const [dbFiles, setDbFiles] = useState<Array<{id: string; filename: string; filepath: string; fileType: string; category: string; createdAt: string}>>([]);

  // Finance state
  const [studentRate, setStudentRate] = useState<StudentRate | null>(null);
  const [tutoringTxns, setTutoringTxns] = useState<Transaction[]>([]);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLessons, setPaymentLessons] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const loadFiles = useCallback(() => {
    window.db.files.list('student', student.id).then((files) => {
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

  const loadFinanceData = useCallback(() => {
    window.db.finance.rates.get(student.id).then((rate) => {
      setStudentRate(rate);
      if (rate) setRateInput(String(rate.ratePerLesson));
    }).catch(() => {});
    window.db.transactions.list({ type: 'income', category: 'tutoring', studentId: student.id }).then((txns) => {
      setTutoringTxns(txns);
    }).catch(() => {});
  }, [student.id]);

  useEffect(() => {
    loadFiles();
    loadFinanceData();
  }, [loadFiles, loadFinanceData]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('files')) loadFiles();
      if (entities.includes('transactions')) loadFinanceData();
    });
  }, [student.id, loadFiles, loadFinanceData]);

  const handleSaveRate = useCallback(async () => {
    const rate = parseFloat(rateInput);
    if (!rate || rate <= 0) return;
    await window.db.finance.rates.set(student.id, rate);
    setEditingRate(false);
    loadFinanceData();
  }, [student.id, rateInput, loadFinanceData]);

  const handleRecordPayment = useCallback(async () => {
    const lessons = parseInt(paymentLessons) || 0;
    let amount = parseFloat(paymentAmount) || 0;
    if (!amount && lessons && studentRate) {
      amount = lessons * studentRate.ratePerLesson;
    }
    if (!amount || amount <= 0) return;
    setPaymentSubmitting(true);
    try {
      const lessonsLabel = lessons || (studentRate ? Math.round(amount / studentRate.ratePerLesson) : '?');
      await window.db.transactions.create({
        type: 'income',
        category: 'tutoring',
        amount,
        studentId: student.id,
        description: `Оплата: ${student.name} (${lessonsLabel} ур.)`,
        date: new Date().toISOString().slice(0, 10),
      });
      setShowPaymentForm(false);
      setPaymentLessons('');
      setPaymentAmount('');
      loadFinanceData();
    } catch { /* ignore */ }
    finally { setPaymentSubmitting(false); }
  }, [student.id, student.name, paymentLessons, paymentAmount, studentRate, loadFinanceData]);

  // Finance derived
  const totalPaid = tutoringTxns.reduce((s, t) => s + t.amount, 0);
  const paidLessons = studentRate ? Math.floor(totalPaid / studentRate.ratePerLesson) : 0;
  const lessonBalance = paidLessons - realLessonCount;

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
    <div className={overviewTab === 'files' ? '' : 'max-w-2xl'}>
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
        <StatBadge label="Уроков" count={realLessonCount} color="text-blue-400 bg-blue-400/10" onClick={onLessonsHistoryClick} />
        <StatBadge label="ДЗ выполнено" count={realHwDone} color="text-emerald-400 bg-emerald-400/10" onClick={() => onHomeworkFilesClick('completed')} />
        <StatBadge label="ДЗ предстоит" count={realHwPending} color="text-yellow-400 bg-yellow-400/10" onClick={() => onHomeworkFilesClick('pending')} />
        {(stats.overdue ?? 0) > 0 && (
          <StatBadge label="Просрочено" count={stats.overdue ?? 0} color="text-red-400 bg-red-400/10" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800 pb-px">
        {(['overview', 'files'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setOverviewTab(tab)}
            className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
              overviewTab === tab
                ? 'bg-neutral-800 text-neutral-200 border-b-2 border-blue-500'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
          >
            {tab === 'overview' ? 'Путь обучения' : 'Файлы'}
          </button>
        ))}
      </div>

      {overviewTab === 'files' && (
        <div>
          <StudentFilesView studentName={student.name} />
          <div className="mt-3">
            <button
              onClick={onStudentFilesClick}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Открыть в полноэкранном режиме &rarr;
            </button>
          </div>
        </div>
      )}

      {overviewTab === 'overview' && (
      <>
      {/* Finance: Rate & Balance */}
      <div className="mb-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote size={16} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-neutral-300">Оплата</h2>
        </div>

        {/* Rate */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-500">Ставка за урок</span>
          {editingRate ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-24 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRate(); if (e.key === 'Escape') setEditingRate(false); }}
              />
              <span className="text-xs text-neutral-500">₽</span>
              <button onClick={handleSaveRate} className="text-xs text-blue-400 hover:text-blue-300">OK</button>
            </div>
          ) : studentRate ? (
            <button
              onClick={() => { setRateInput(String(studentRate.ratePerLesson)); setEditingRate(true); }}
              className="text-sm font-mono text-neutral-200 hover:text-blue-400 transition-colors"
            >
              {studentRate.ratePerLesson.toLocaleString('ru-RU')} ₽
            </button>
          ) : (
            <button
              onClick={() => setEditingRate(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Установить
            </button>
          )}
        </div>

        {/* Balance */}
        {studentRate && (
          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-neutral-500">Оплачено уроков</span>
              <span className="text-neutral-300 font-mono">{paidLessons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Проведено уроков</span>
              <span className="text-neutral-300 font-mono">{realLessonCount}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-neutral-800">
              <span className="text-neutral-500">Баланс</span>
              {lessonBalance > 0 ? (
                <span className="text-emerald-400 font-mono">Оплачено вперёд: +{lessonBalance} ур.</span>
              ) : lessonBalance < 0 ? (
                <span className="text-red-400 font-mono">Должен за {Math.abs(lessonBalance)} ур.</span>
              ) : (
                <span className="text-neutral-400 font-mono">0</span>
              )}
            </div>
          </div>
        )}

        {/* Record payment */}
        {!showPaymentForm ? (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="w-full text-xs text-center py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Записать оплату
          </button>
        ) : (
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-600 block mb-0.5">Уроков</label>
                <input
                  type="number"
                  placeholder="Кол-во"
                  value={paymentLessons}
                  onChange={(e) => {
                    setPaymentLessons(e.target.value);
                    if (studentRate && e.target.value) {
                      setPaymentAmount(String(parseInt(e.target.value) * studentRate.ratePerLesson));
                    }
                  }}
                  className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-600 block mb-0.5">Сумма ₽</label>
                <input
                  type="number"
                  placeholder={studentRate ? String(studentRate.ratePerLesson) : 'Сумма'}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPaymentForm(false)} className="flex-1 text-xs py-1 text-neutral-500 hover:text-neutral-300">
                Отмена
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={paymentSubmitting || (!paymentAmount && !paymentLessons)}
                className="flex-1 text-xs py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
              >
                {paymentSubmitting ? '...' : 'Записать'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Learning path progress */}
      {dbLearningPath.length > 0 && (() => {
        const lpCompleted = dbLearningPath.filter((t) => t.status === 'completed').length;
        const lpTotal = dbLearningPath.length;
        const lpPct = Math.round((lpCompleted / lpTotal) * 100);
        return (
          <button
            onClick={onLearningPathClick}
            className="w-full mb-6 px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Прогресс плана</span>
              <span className="text-xs text-neutral-500">{lpCompleted} из {lpTotal} тем &middot; {lpPct}%</span>
            </div>
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${lpPct}%` }}
              />
            </div>
          </button>
        );
      })()}

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-300">Путь обучения</h2>
          {dbLearningPath.length > 0 && (
            <button
              onClick={onLearningPathClick}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Показать всё &rarr;
            </button>
          )}
        </div>
        {dbLearningPath.length > 0 ? (
          <div className="space-y-2">
            {dbLearningPath.map((topic, idx) => (
              <button
                key={topic.id}
                onClick={() => onLearningPathTopicClick(topic.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-2.5 rounded-lg border hover:brightness-125 transition ${LP_STATUS_COLOR[topic.status]}`}
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
              </button>
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
      </>
      )}
    </div>
  );
}

const DAY_MAP: Record<string, number> = { 'Пн': 1, 'Вт': 2, 'Ср': 3, 'Чт': 4, 'Пт': 5, 'Сб': 6, 'Вс': 0 };
const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function NextLessonLabel({ schedule }: { schedule: Array<{ day: string; time: string }> }) {
  if (schedule.length === 0) return null;

  const now = new Date();
  const todayDow = now.getDay();
  let closest: Date | null = null;

  for (const slot of schedule) {
    const targetDow = DAY_MAP[slot.day];
    if (targetDow === undefined) continue;
    const [h, m] = slot.time.split(':').map(Number);
    let daysAhead = (targetDow - todayDow + 7) % 7;
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 7);
    }
    if (!closest || candidate < closest) closest = candidate;
  }

  if (!closest) return null;

  const isToday = closest.toDateString() === now.toDateString();
  const time = `${closest.getHours()}:${String(closest.getMinutes()).padStart(2, '0')}`;

  return (
    <div className={`text-[11px] mt-1.5 font-medium ${isToday ? 'text-yellow-400' : 'text-neutral-400'}`}>
      {isToday
        ? `Сегодня в ${time}`
        : `Следующий: ${DAY_NAMES[closest.getDay()]} ${closest.getDate()} ${MONTH_NAMES[closest.getMonth()]}, ${time}`
      }
    </div>
  );
}

function StatBadge({ label, count, color, onClick }: { label: string; count: number; color: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`px-3 py-2 rounded-lg shadow-sm shadow-black/10 text-left ${color} ${onClick ? 'hover:brightness-125 transition cursor-pointer' : ''}`}
    >
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </Tag>
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

function HomeworkFilesInline({
  lesson,
  variant = 'default',
}: {
  lesson: { homeworkGiven: string | null; topicId?: string | null; studentId: string };
  variant?: 'default' | 'compact';
}) {
  const [hwFiles, setHwFiles] = useState<Array<{ id: string; filename: string; filepath: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!lesson.homeworkGiven) return;
    if (!lesson.topicId) {
      // No topic_id — can't reliably match homework files
      setLoaded(true);
      return;
    }
    window.db.files.homework(lesson.topicId, null).then((files) => {
      setHwFiles(files);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [lesson.homeworkGiven, lesson.topicId]);

  if (!lesson.homeworkGiven) return null;

  if (variant === 'compact') {
    return (
      <div>
        <div className="text-[10px] text-neutral-600 uppercase mb-0.5">Заданное ДЗ</div>
        {loaded && hwFiles.length > 0 ? (
          <div className="space-y-0.5">
            {hwFiles.map((f) => (
              <button
                key={f.id}
                onClick={() => window.electronAPI.openFile(f.filepath)}
                className="block text-xs text-blue-400 hover:text-blue-300 transition-colors truncate"
              >
                {f.filename}
              </button>
            ))}
          </div>
        ) : loaded ? (
          <p className="text-xs text-neutral-400">ДЗ задано (файл не прикреплён)</p>
        ) : (
          <p className="text-xs text-neutral-600">Загрузка...</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Заданное ДЗ</h2>
      {loaded && hwFiles.length > 0 ? (
        <div className="space-y-1">
          {hwFiles.map((f) => (
            <button
              key={f.id}
              onClick={() => window.electronAPI.openFile(f.filepath)}
              className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {f.filename}
            </button>
          ))}
        </div>
      ) : loaded ? (
        <p className="text-neutral-300 text-sm">ДЗ задано (файл не прикреплён)</p>
      ) : (
        <p className="text-neutral-500 text-sm">Загрузка...</p>
      )}
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

      <HomeworkFilesInline lesson={lesson} />

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

const LP_STATUS_LABEL: Record<LearningPathStatus, string> = {
  completed: 'Завершён',
  in_progress: 'В процессе',
  planned: 'Запланирован',
  skipped: 'Пропущен',
};

function LearningPathView({
  student,
  dbLearningPath,
  onBack,
  onTopicClick,
}: {
  student: MockStudent;
  dbLearningPath: LearningPathTopic[];
  onBack: () => void;
  onTopicClick: (id: string) => void;
}) {
  const completedCount = dbLearningPath.filter((t) => t.status === 'completed').length;
  const totalCount = dbLearningPath.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Add topic form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleAddTopic = async () => {
    if (!newTitle.trim()) return;
    try {
      const maxOrder = dbLearningPath.reduce((max, t) => Math.max(max, t.orderIndex), -1);
      await window.db.learningPath.create({
        studentId: student.id,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        orderIndex: maxOrder + 1,
        status: 'planned',
      });
      window.dataEvents.emitDataChanged(['learning-path']);
      setNewTitle('');
      setNewDesc('');
      setShowAddForm(false);
    } catch (err) {
      console.error('[LearningPathView] Failed to add topic:', err);
    }
  };

  // Inline title editing
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const saveInlineTitle = async (topicId: string, originalTitle: string) => {
    setEditingTitleId(null);
    if (editingTitleValue.trim() && editingTitleValue.trim() !== originalTitle) {
      try {
        await window.db.learningPath.update(topicId, { title: editingTitleValue.trim() });
        window.dataEvents.emitDataChanged(['learning-path']);
      } catch (err) {
        console.error('[LearningPathView] Failed to save title:', err);
      }
    }
  };

  // Drag and drop reordering
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (targetIdx: number) => {
    const fromIdx = dragIdx.current;
    dragIdx.current = null;
    setDragOverIdx(null);
    if (fromIdx === null || fromIdx === targetIdx) return;

    const reordered = [...dbLearningPath];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const newOrder = reordered.map((t) => t.id);

    try {
      await window.db.learningPath.reorder(student.id, newOrder);
      window.dataEvents.emitDataChanged(['learning-path']);
    } catch (err) {
      console.error('[LearningPathView] Failed to reorder:', err);
    }
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к ученику
      </button>

      <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">Путь обучения</h2>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>{completedCount} из {totalCount} этапов завершено</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        {dbLearningPath.map((topic, idx) => (
          <div
            key={topic.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`transition-opacity ${dragIdx.current === idx ? 'opacity-40' : ''} ${dragOverIdx === idx ? 'ring-1 ring-neutral-500 rounded-lg' : ''}`}
          >
            <button
              onClick={() => onTopicClick(topic.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTitleId(topic.id);
                setEditingTitleValue(topic.title);
              }}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border hover:brightness-125 transition cursor-grab active:cursor-grabbing ${LP_STATUS_COLOR[topic.status]}`}
            >
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0 mt-0.5">
                <span>{LP_STATUS_ICON[topic.status]}</span>
                {idx < dbLearningPath.length - 1 && (
                  <div className="w-px h-4 bg-neutral-700 mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-600 font-mono">{idx + 1}</span>
                  {editingTitleId === topic.id ? (
                    <input
                      autoFocus
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onBlur={() => saveInlineTitle(topic.id, topic.title)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineTitle(topic.id, topic.title);
                        if (e.key === 'Escape') setEditingTitleId(null);
                      }}
                      className="flex-1 text-sm font-medium bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-neutral-200 focus:outline-none focus:border-neutral-500"
                    />
                  ) : (
                    <span className="text-sm font-medium">{topic.title}</span>
                  )}
                  <span className="text-[10px] uppercase ml-auto shrink-0 opacity-70">
                    {LP_STATUS_LABEL[topic.status]}
                  </span>
                </div>
                {topic.description && (
                  <p className="text-xs text-neutral-500 mt-0.5">{topic.description}</p>
                )}
                {topic.notes && (
                  <p className="text-[11px] text-neutral-600 mt-1 italic">{topic.notes}</p>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {dbLearningPath.length === 0 && (
        <div className="text-neutral-600 text-sm py-8 text-center">
          Путь обучения пока не создан. Попросите бота составить план.
        </div>
      )}

      {/* Add topic */}
      <div className="mt-4">
        {showAddForm ? (
          <div className="border border-neutral-800 rounded-lg p-4 space-y-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Название темы"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') setShowAddForm(false); }}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Описание (необязательно)"
              rows={2}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 resize-none placeholder:text-neutral-600"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTopic}
                disabled={!newTitle.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Сохранить
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewDesc(''); }}
                className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            + Добавить тему
          </button>
        )}
      </div>
    </div>
  );
}

function LearningPathTopicView({
  topic,
  topicIndex,
  studentId,
  dbLessons,
  sidebarHomeworkFiles,
  onBack,
  onReload,
}: {
  topic: LearningPathTopic | undefined;
  topicIndex: number;
  studentId: string;
  dbLessons: Array<{ id: string; studentId: string; date: string; topic: string; status: string; notes: string; homeworkGiven: string | null; topicId: string | null }>;
  sidebarHomeworkFiles: Array<{ id: string; filename: string; filepath: string; status: string; topicId: string | null; createdAt: string }>;
  onBack: () => void;
  onReload: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [statusValue, setStatusValue] = useState<LearningPathStatus>('planned');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (topic) {
      setTitleDraft(topic.title);
      setDescDraft(topic.description ?? '');
      setNotesDraft(topic.notes ?? '');
      setStatusValue(topic.status);
      setEditingTitle(false);
    }
  }, [topic?.id]);

  if (!topic) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Этап не найден</p>
      </div>
    );
  }

  const saveField = async (field: string, value: string) => {
    try {
      await window.db.learningPath.update(topic.id, { [field]: value });
      window.dataEvents.emitDataChanged(['learning-path']);
      onReload();
    } catch (err) {
      console.error('[LearningPathTopicView] Failed to save:', err);
    }
  };

  const saveStatus = async (newStatus: LearningPathStatus) => {
    setStatusValue(newStatus);
    try {
      await window.db.learningPath.update(topic.id, { status: newStatus });
      window.dataEvents.emitDataChanged(['learning-path']);
      onReload();
    } catch (err) {
      console.error('[LearningPathTopicView] Failed to save status:', err);
    }
  };

  // Related lessons: prefer topic_id match, fallback to keyword search
  const titleWords = topic.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const relatedLessons = dbLessons.filter((l) => {
    // Exact FK match
    if (l.topicId === topic.id) return true;
    // Fallback: keyword search
    const lt = l.topic.toLowerCase();
    return titleWords.some((w) => lt.includes(w));
  });

  // Related homework files: load from DB with topic_id → student_id fallback
  const [relatedHomework, setRelatedHomework] = useState<Array<{ id: string; filename: string; filepath: string; status: string; topicId: string | null; createdAt: string }>>([]);
  useEffect(() => {
    if (!topic) return;
    window.db.files.homework(topic.id, null).then((files) => {
      const mapped = files.map((f) => ({ id: f.id, filename: f.filename, filepath: f.filepath, status: (f as Record<string, unknown>).status as string ?? 'pending', topicId: f.topicId ?? null, createdAt: f.createdAt ? String(f.createdAt) : '' }));
      setRelatedHomework(mapped);
    }).catch(() => {
      // Fallback to sidebar files filtered by topic_id
      setRelatedHomework(sidebarHomeworkFiles.filter((f) => f.topicId === topic.id));
    });
  }, [topic?.id]);

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к плану
      </button>

      {/* Header: number + title */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-neutral-600 text-sm font-mono">#{topicIndex + 1}</span>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setEditingTitle(false); if (titleDraft !== topic.title) saveField('title', titleDraft); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setEditingTitle(false); if (titleDraft !== topic.title) saveField('title', titleDraft); } }}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xl font-bold text-neutral-200 focus:outline-none focus:border-neutral-500"
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            className="text-xl font-bold cursor-pointer hover:text-neutral-300 transition-colors"
            title="Кликните для редактирования"
          >
            {topic.title}
          </h1>
        )}
      </div>

      {/* Status dropdown */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={statusValue}
          onChange={(e) => saveStatus(e.target.value as LearningPathStatus)}
          className={`text-xs px-2.5 py-1 rounded border font-medium focus:outline-none ${LP_STATUS_COLOR[statusValue]}`}
          style={{ backgroundColor: 'transparent' }}
        >
          <option value="planned" className="bg-neutral-900 text-neutral-300">Запланирован</option>
          <option value="in_progress" className="bg-neutral-900 text-neutral-300">В процессе</option>
          <option value="completed" className="bg-neutral-900 text-neutral-300">Завершён</option>
          <option value="skipped" className="bg-neutral-900 text-neutral-300">Пропущен</option>
        </select>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Описание</h2>
        <textarea
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={() => { if (descDraft !== (topic.description ?? '')) saveField('description', descDraft); }}
          placeholder="Добавьте описание..."
          rows={3}
          className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 resize-none placeholder:text-neutral-600"
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Заметки</h2>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => { if (notesDraft !== (topic.notes ?? '')) saveField('notes', notesDraft); }}
          placeholder="Заметки после уроков..."
          rows={3}
          className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 resize-none placeholder:text-neutral-600"
        />
      </div>

      {/* Related lessons */}
      {relatedLessons.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Уроки по этой теме</h2>
          <div className="space-y-1.5">
            {relatedLessons.map((lesson) => {
              const expanded = expandedLessonId === lesson.id;
              return (
                <button
                  key={lesson.id}
                  onClick={() => setExpandedLessonId(expanded ? null : lesson.id)}
                  className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      lesson.status === 'completed' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-blue-900/40 text-blue-300'
                    }`}>
                      {lesson.status === 'completed' ? 'Проведён' : 'Запланирован'}
                    </span>
                    <span className="text-neutral-500 text-xs shrink-0">{formatDate(lesson.date)}</span>
                    <span className="text-sm text-neutral-300 truncate flex-1">{lesson.topic}</span>
                    <span className="text-neutral-600 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
                  </div>
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="text-[10px] text-neutral-600">
                        Дата: {lesson.date}
                      </div>
                      {lesson.notes && (
                        <div>
                          <div className="text-[10px] text-neutral-600 uppercase mb-0.5">Заметки</div>
                          <p className="text-xs text-neutral-400 leading-relaxed">{lesson.notes}</p>
                        </div>
                      )}
                      <HomeworkFilesInline lesson={lesson} variant="compact" />
                      {!lesson.notes && !lesson.homeworkGiven && (
                        <p className="text-xs text-neutral-600">Нет дополнительной информации</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Related homework files */}
      {relatedHomework.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Домашние задания по этой теме</h2>
          <div className="space-y-1.5">
            {relatedHomework.map((file) => (
              <div
                key={file.id}
                onClick={() => window.electronAPI.openFile(file.filepath)}
                className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-neutral-800/50 transition-colors"
              >
                <span className="text-sm shrink-0">{FILE_ICON.docx}</span>
                <span className="text-sm text-neutral-300 truncate flex-1">{file.filename}</span>
                <span className={`text-[10px] uppercase ${file.status === 'completed' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {file.status === 'completed' ? 'Готово' : 'Ожидает'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedLessons.length === 0 && relatedHomework.length === 0 && (
        <div className="text-neutral-600 text-xs py-4">
          Связанных уроков и домашних заданий пока нет.
        </div>
      )}

      {/* Delete topic */}
      <DeleteTopicButton topic={topic} onBack={onBack} />
    </div>
  );
}

function DeleteTopicButton({ topic, onBack }: { topic: LearningPathTopic; onBack: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { pushUndo } = useUndo();

  const handleDelete = async () => {
    try {
      const saved = { ...topic };
      await window.db.learningPath.delete(topic.id);
      window.dataEvents.emitDataChanged(['learning-path']);
      onBack();
      pushUndo({ label: saved.title, restoreFn: async () => { await window.db.learningPath.create(saved); window.dataEvents.emitDataChanged(['learning-path']); } });
    } catch (err) {
      console.error('[LearningPathTopicView] Failed to delete topic:', err);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-neutral-800">
      {confirming ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">Точно удалить?</span>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
          >
            Да
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Нет
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-sm text-red-500 hover:text-red-400 transition-colors"
        >
          Удалить тему
        </button>
      )}
    </div>
  );
}

function LessonsHistoryView({
  student,
  dbLessons,
  dbLearningPath,
  onBack,
}: {
  student: MockStudent;
  dbLessons: Array<{ id: string; studentId: string; date: string; topic: string; status: string; notes: string; homeworkGiven: string | null; topicId: string | null }>;
  dbLearningPath: LearningPathTopic[];
  onBack: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const topicMap = new Map(dbLearningPath.map((t) => [t.id, t]));

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к ученику
      </button>

      <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">История уроков ({dbLessons.length})</h2>

      {dbLessons.length === 0 && (
        <div className="text-neutral-600 text-sm py-8 text-center">Уроков пока нет</div>
      )}

      <div className="space-y-2">
        {dbLessons.map((lesson) => {
          const expanded = expandedId === lesson.id;
          const lpTopic = lesson.topicId ? topicMap.get(lesson.topicId) : undefined;
          return (
            <button
              key={lesson.id}
              onClick={() => setExpandedId(expanded ? null : lesson.id)}
              className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
            >
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  lesson.status === 'completed' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-blue-900/40 text-blue-300'
                }`}>
                  {lesson.status === 'completed' ? 'Проведён' : 'Запланирован'}
                </span>
                <span className="text-neutral-500 text-xs shrink-0">{formatDate(lesson.date)}</span>
                <span className="text-sm text-neutral-300 truncate flex-1">{lesson.topic}</span>
              </div>
              {lpTopic && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] shrink-0">{LP_STATUS_ICON[lpTopic.status]}</span>
                  <span className="text-[10px] text-neutral-600 truncate">План: {lpTopic.title}</span>
                </div>
              )}
              {expanded && (
                <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2" onClick={(e) => e.stopPropagation()}>
                  {lesson.notes && (
                    <div>
                      <div className="text-[10px] text-neutral-600 uppercase mb-0.5">Заметки</div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{lesson.notes}</p>
                    </div>
                  )}
                  <HomeworkFilesInline lesson={lesson} variant="compact" />
                  {!lesson.notes && !lesson.homeworkGiven && (
                    <p className="text-xs text-neutral-600">Нет дополнительной информации</p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeworkFilesView({
  student,
  files,
  filter,
  onFilterChange,
  onBack,
}: {
  student: MockStudent;
  files: Array<{ id: string; filename: string; filepath: string; status: string; createdAt: string }>;
  filter: 'pending' | 'completed' | 'all';
  onFilterChange: (f: 'pending' | 'completed' | 'all') => void;
  onBack: () => void;
}) {
  const filtered = filter === 'all' ? files : files.filter((f) => f.status === filter);
  const filters: Array<{ value: 'pending' | 'completed' | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'completed', label: 'Выполнено' },
    { value: 'pending', label: 'Предстоит' },
  ];

  const toggleStatus = async (file: { id: string; status: string }) => {
    const newStatus = file.status === 'completed' ? 'pending' : 'completed';
    try {
      await window.db.files.update(file.id, { status: newStatus });
      window.dataEvents.emitDataChanged(['files']);
    } catch (err) {
      console.error('[HomeworkFilesView] Failed to update status:', err);
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад к ученику
      </button>

      <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">Домашние задания</h2>

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

      {filtered.length === 0 && (
        <div className="text-neutral-600 text-sm py-8 text-center">Нет домашек с таким статусом</div>
      )}

      <div className="space-y-2">
        {filtered.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 shadow-sm shadow-black/10"
          >
            <button
              onClick={() => toggleStatus(file)}
              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                file.status === 'completed' ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
              }`}
            >
              {file.status === 'completed' && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className="text-sm shrink-0">{FILE_ICON.docx}</span>
            <button
              onClick={() => window.electronAPI.openFile(file.filepath)}
              className="text-sm text-neutral-300 truncate flex-1 text-left hover:text-neutral-100 transition-colors"
            >
              {file.filename}
            </button>
            <span className="text-[10px] text-neutral-600 shrink-0">
              {file.createdAt ? formatDate(file.createdAt.slice(0, 10)) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === File Tree Components ===

function SidebarFileTree({ studentName, onFileNavigate }: { studentName: string; onFileNavigate?: (filePath: string) => void }) {
  const slug = toStudentSlug(studentName);
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const loadTree = useCallback(async () => {
    const result = await window.teaching.files.tree(slug);
    setTree(result);
  }, [slug]);

  useEffect(() => {
    loadTree();
    window.teaching.files.watchStart(slug);
    const unsub = window.teaching.files.onWatchUpdate((updatedSlug: string) => {
      if (updatedSlug === slug) loadTree();
    });
    return () => {
      unsub();
      window.teaching.files.watchStop(slug);
    };
  }, [slug, loadTree]);

  // Auto-expand top-level on first load
  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const node of tree) {
        if (node.isDir) next.add(node.path);
      }
      return next;
    });
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleFileClick = useCallback((node: FileTreeNode) => {
    const ext = node.name.split('.').pop()?.toLowerCase();
    console.log('[Teaching Sidebar] File clicked:', node.path, 'extension:', ext);
    if ((ext === 'md' || ext === 'py') && onFileNavigate) {
      onFileNavigate(node.path);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, [onFileNavigate]);

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        Файлы
        <button
          onClick={loadTree}
          className="ml-auto p-0.5 rounded text-neutral-600 hover:text-neutral-400 transition-colors"
          title="Обновить"
        >
          <RefreshCw size={10} />
        </button>
      </div>
      <div className="space-y-0.5">
        {tree.map((node) => (
          <SidebarTreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            toggleExpand={toggleExpand}
            onFileClick={handleFileClick}
          />
        ))}
        {tree.length === 0 && (
          <div className="text-[11px] text-neutral-600">Пока пусто</div>
        )}
      </div>
    </div>
  );
}

function SidebarTreeNode({
  node, depth, expandedPaths, toggleExpand, onFileClick,
}: {
  node: FileTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  onFileClick: (node: FileTreeNode) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  return (
    <div>
      <button
        onClick={() => node.isDir ? toggleExpand(node.path) : onFileClick(node)}
        className={`w-full text-left flex items-center gap-1 py-0.5 px-1 text-xs rounded transition-colors hover:bg-neutral-800/50
          ${node.isDir ? 'text-neutral-400' : 'text-neutral-500 hover:text-neutral-300'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.isDir ? (
          <>
            {isExpanded ? <ChevronDown size={10} className="shrink-0 text-neutral-600" /> : <ChevronRight size={10} className="shrink-0 text-neutral-600" />}
            <Folder size={12} className="shrink-0 text-yellow-500/70" />
          </>
        ) : (
          <>
            <span className="w-2.5 shrink-0" />
            <File size={12} className="shrink-0 text-neutral-600" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Full file explorer for StudentOverview Files tab ---

function TeachingFileTreeNode({
  node, depth, onFileClick, onDrop, expandedPaths, toggleExpand,
  contextMenu, setContextMenu,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (node: FileTreeNode) => void;
  onDrop: (files: FileList, destFolder: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  contextMenu: { x: number; y: number; node: FileTreeNode } | null;
  setContextMenu: (menu: { x: number; y: number; node: FileTreeNode } | null) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const [dragOver, setDragOver] = useState(false);
  const ext = node.name.split('.').pop()?.toLowerCase();
  const isMd = ext === 'md';
  const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'json', 'yml', 'yaml', 'sh', 'sql'].includes(ext ?? '');

  const handleDragOver = (e: React.DragEvent) => {
    if (!node.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (node.isDir && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files, node.path);
    }
  };

  return (
    <div>
      <button
        onClick={() => node.isDir ? toggleExpand(node.path) : onFileClick(node)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, node });
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full text-left flex items-center gap-1.5 py-1 px-1 transition-colors rounded group
          ${dragOver ? 'bg-blue-900/40 ring-1 ring-blue-500/50' : 'hover:bg-neutral-800/50'}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {node.isDir ? (
          isExpanded ? <ChevronDown size={12} className="text-neutral-600 shrink-0" /> : <ChevronRight size={12} className="text-neutral-600 shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {node.isDir ? (
          isExpanded ? <FolderOpen size={14} className="text-yellow-600 shrink-0" /> : <Folder size={14} className="text-yellow-700 shrink-0" />
        ) : isMd ? (
          <FileText size={14} className="text-blue-500 shrink-0" />
        ) : isCode ? (
          <Code size={14} className="text-emerald-600 shrink-0" />
        ) : (
          <File size={14} className="text-neutral-600 shrink-0" />
        )}
        <span className={`text-xs truncate ${node.isDir ? 'text-neutral-300 font-medium' : 'text-neutral-400'}`}>
          {node.name}
        </span>
        <MoreVertical
          size={12}
          className="text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
          onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, node }); }}
        />
      </button>
      {node.isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TeachingFileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
            />
          ))}
          {node.children.length === 0 && (
            <div className="text-xs text-neutral-600 py-1 italic" style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}>
              Пусто
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeachingFileTreeView({
  tree, onFileClick, onRefresh, onDrop, title,
}: {
  tree: FileTreeNode[];
  onFileClick: (node: FileTreeNode) => void;
  onRefresh: () => void;
  onDrop: (files: FileList, destFolder: string) => void;
  title?: string;
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of tree) {
      if (node.isDir) initial.add(node.path);
    }
    return initial;
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null);
  const [renaming, setRenaming] = useState<{ node: FileTreeNode; newName: string } | null>(null);
  const [creating, setCreating] = useState<{ dir: string; ext: string; name: string } | null>(null);

  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const node of tree) {
        if (node.isDir && !prev.has(node.path)) next.add(node.path);
      }
      return next;
    });
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextAction = useCallback(async (action: 'open' | 'rename' | 'delete' | 'create-md' | 'create-py', node: FileTreeNode) => {
    setContextMenu(null);
    if (action === 'open') {
      if (node.isDir) {
        window.electronAPI.openFile(node.path);
      } else {
        onFileClick(node);
      }
    } else if (action === 'rename') {
      setRenaming({ node, newName: node.name });
    } else if (action === 'delete') {
      await window.teaching.files.delete(node.path);
      onRefresh();
    } else if (action === 'create-md' || action === 'create-py') {
      const ext = action === 'create-md' ? '.md' : '.py';
      setCreating({ dir: node.path, ext, name: '' });
    }
  }, [onFileClick, onRefresh]);

  const handleCreateSubmit = useCallback(async () => {
    if (!creating || !creating.name.trim()) { setCreating(null); return; }
    let filename = creating.name.trim();
    if (!filename.endsWith(creating.ext)) filename += creating.ext;
    const filePath = `${creating.dir}/${filename}`;
    await window.teaching.files.write(filePath, '');
    onRefresh();
    // Open the newly created file
    onFileClick({ name: filename, path: filePath, isDir: false });
    setCreating(null);
  }, [creating, onRefresh, onFileClick]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renaming || !renaming.newName.trim()) { setRenaming(null); return; }
    const dir = renaming.node.path.substring(0, renaming.node.path.lastIndexOf('/'));
    const newPath = `${dir}/${renaming.newName.trim()}`;
    if (newPath !== renaming.node.path) {
      await window.teaching.files.rename(renaming.node.path, newPath);
      onRefresh();
    }
    setRenaming(null);
  }, [renaming, onRefresh]);

  const handleRootDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0 && tree.length > 0 && tree[0]) {
      const rootPath = tree[0].path.substring(0, tree[0].path.lastIndexOf('/'));
      onDrop(e.dataTransfer.files, rootPath);
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  return (
    <div className="flex flex-col overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 shrink-0">
          <span className="text-[11px] text-neutral-500 font-mono truncate">{title}</span>
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-600 hover:text-neutral-300 transition-colors"
            title="Обновить"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-2"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {tree.length === 0 && (
          <div className="text-neutral-600 text-sm text-center py-8">Папка пуста</div>
        )}
          {tree.map((node) => (
            <TeachingFileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileClick={onFileClick}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
            />
          ))}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.isDir && (
            <>
              <button
                onClick={() => handleContextAction('create-md', contextMenu.node)}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Создать .md файл
              </button>
              <button
                onClick={() => handleContextAction('create-py', contextMenu.node)}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Создать .py файл
              </button>
              <div className="my-1 border-t border-neutral-800" />
            </>
          )}
          <button
            onClick={() => handleContextAction('open', contextMenu.node)}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Открыть
          </button>
          <button
            onClick={() => handleContextAction('rename', contextMenu.node)}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Переименовать
          </button>
          {!contextMenu.node.isDir && (
            <button
              onClick={() => handleContextAction('delete', contextMenu.node)}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800 transition-colors"
            >
              Удалить
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCreating(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-neutral-300 mb-3">Новый файл ({creating.ext})</div>
            <input
              autoFocus
              value={creating.name}
              onChange={(e) => setCreating({ ...creating, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
                if (e.key === 'Escape') setCreating(null);
              }}
              placeholder={`filename${creating.ext}`}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setCreating(null)} className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200 rounded transition-colors">Отмена</button>
              <button onClick={handleCreateSubmit} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">Создать</button>
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenaming(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-neutral-300 mb-3">Переименовать</div>
            <input
              autoFocus
              value={renaming.newName}
              onChange={(e) => setRenaming({ ...renaming, newName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenaming(null);
              }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setRenaming(null)} className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200 rounded transition-colors">Отмена</button>
              <button onClick={handleRenameSubmit} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Student Files View (split: tree left + editor right) ---

function StudentFilesView({ studentName, initialOpenFilePath }: { studentName: string; initialOpenFilePath?: string }) {
  const slug = toStudentSlug(studentName);
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saved, setSaved] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [showTreeOverlay, setShowTreeOverlay] = useState(false);
  const isNarrow = containerWidth < 500;
  const initialFileHandled = useRef(false);
  const [treeWidth, setTreeWidth] = useState(208);
  const isDragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = Math.max(150, Math.min(e.clientX - containerLeft, containerWidth - 300));
      setTreeWidth(newWidth);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerWidth]);

  const loadTree = useCallback(async () => {
    const result = await window.teaching.files.tree(slug);
    setTree(result);
  }, [slug]);

  useEffect(() => {
    loadTree();
    window.teaching.files.watchStart(slug);
    const unsub = window.teaching.files.onWatchUpdate((updatedSlug: string) => {
      if (updatedSlug === slug) loadTree();
    });
    return () => {
      unsub();
      window.teaching.files.watchStop(slug);
    };
  }, [slug, loadTree]);

  // Auto-open file from navigation
  useEffect(() => {
    if (initialOpenFilePath && !initialFileHandled.current) {
      initialFileHandled.current = true;
      const fileName = initialOpenFilePath.split('/').pop() ?? '';
      if (fileName.endsWith('.md') || fileName.endsWith('.py')) {
        window.teaching.files.read(initialOpenFilePath).then((content) => {
          setOpenFile({ path: initialOpenFilePath, name: fileName, content });
          setEditContent(content);
          setEditMode(false);
          setSaved(true);
        });
      }
    }
  }, [initialOpenFilePath]);

  const handleFileClick = useCallback(async (node: FileTreeNode) => {
    if (node.name.endsWith('.md') || node.name.endsWith('.py')) {
      const content = await window.teaching.files.read(node.path);
      setOpenFile({ path: node.path, name: node.name, content });
      setEditContent(content);
      setEditMode(false);
      setSaved(true);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, []);

  const handleDrop = useCallback(async (files: FileList, destFolder: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as unknown as { path?: string })?.path;
      if (filePath) {
        await window.teaching.files.copy(filePath, destFolder);
      }
    }
    loadTree();
  }, [loadTree]);

  const handleSave = useCallback(async () => {
    if (!openFile) return;
    await window.teaching.files.write(openFile.path, editContent);
    setOpenFile({ ...openFile, content: editContent });
    setSaved(true);
  }, [openFile, editContent]);

  const handlePythonSave = useCallback(async (content: string) => {
    if (!openFile) return;
    await window.teaching.files.write(openFile.path, content);
    setOpenFile({ ...openFile, content });
  }, [openFile]);

  const handleFileClickWithClose = useCallback(async (node: FileTreeNode) => {
    await handleFileClick(node);
    setShowTreeOverlay(false);
  }, [handleFileClick]);

  const treePanel = (
    <TeachingFileTreeView
      tree={tree}
      onFileClick={isNarrow ? handleFileClickWithClose : handleFileClick}
      onRefresh={loadTree}
      onDrop={handleDrop}
      title={`students/${slug}/`}
    />
  );

  return (
    <div ref={containerRef} className="relative flex h-[calc(100vh-220px)] overflow-hidden">
      {/* Burger button for narrow */}
      {isNarrow && (
        <button
          onClick={() => setShowTreeOverlay(!showTreeOverlay)}
          className="absolute top-2 left-2 z-30 p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          title="Файлы"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Tree overlay for narrow */}
      {isNarrow && showTreeOverlay && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowTreeOverlay(false)} />
          <div className="absolute top-0 left-0 z-40 w-56 h-full bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
            {treePanel}
          </div>
        </>
      )}

      {/* Static tree for wide */}
      {!isNarrow && (
        <div className="shrink-0 border-r border-neutral-800 flex flex-col overflow-hidden" style={{ width: treeWidth }}>
          {treePanel}
        </div>
      )}

      {/* Resizable divider */}
      {!isNarrow && (
        <div
          className="w-1 shrink-0 bg-neutral-700/50 hover:bg-neutral-600 cursor-col-resize transition-colors"
          onMouseDown={() => { isDragging.current = true; }}
        />
      )}

      {/* Editor panel */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {openFile && openFile.name.endsWith('.py') ? (
          <PythonEditor
            filePath={openFile.path}
            fileName={openFile.name}
            initialContent={openFile.content}
            onSave={handlePythonSave}
          />
        ) : openFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                <span className="text-sm text-neutral-300">{openFile.name}</span>
                {!saved && <span className="text-[10px] text-yellow-500">●</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditMode(!editMode); if (editMode && !saved) handleSave(); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    editMode ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  {editMode ? 'Просмотр' : 'Редактировать'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => { setEditContent(e.target.value); setSaved(false); }}
                  onBlur={handleSave}
                  className="w-full h-full bg-transparent text-sm text-neutral-300 font-mono resize-none focus:outline-none"
                  spellCheck={false}
                />
              ) : openFile.content ? (
                <MarkdownRenderer content={openFile.content} className="text-sm text-neutral-300 leading-relaxed" />
              ) : (
                <span className="text-neutral-600 italic">Файл пуст</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
            Выберите файл для просмотра
          </div>
        )}
      </div>
    </div>
  );
}

// --- All Teaching Files Tree (for General tab) ---

function AllTeachingFilesTree() {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saved, setSaved] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [showTreeOverlay, setShowTreeOverlay] = useState(false);
  const isNarrow = containerWidth < 500;
  const [treeWidth, setTreeWidth] = useState(208);
  const isDragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = Math.max(150, Math.min(e.clientX - containerLeft, containerWidth - 300));
      setTreeWidth(newWidth);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerWidth]);

  const loadTree = useCallback(async () => {
    const result = await window.teaching.files.allTree();
    setTree(result);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleFileClick = useCallback(async (node: FileTreeNode) => {
    if (node.name.endsWith('.md') || node.name.endsWith('.py')) {
      const content = await window.teaching.files.read(node.path);
      setOpenFile({ path: node.path, name: node.name, content });
      setEditContent(content);
      setEditMode(false);
      setSaved(true);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, []);

  const handleDrop = useCallback(async (files: FileList, destFolder: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as unknown as { path?: string })?.path;
      if (filePath) {
        await window.teaching.files.copy(filePath, destFolder);
      }
    }
    loadTree();
  }, [loadTree]);

  const handleSave = useCallback(async () => {
    if (!openFile) return;
    await window.teaching.files.write(openFile.path, editContent);
    setOpenFile({ ...openFile, content: editContent });
    setSaved(true);
  }, [openFile, editContent]);

  const handlePythonSave = useCallback(async (content: string) => {
    if (!openFile) return;
    await window.teaching.files.write(openFile.path, content);
    setOpenFile({ ...openFile, content });
  }, [openFile]);

  const handleFileClickWithClose = useCallback(async (node: FileTreeNode) => {
    await handleFileClick(node);
    setShowTreeOverlay(false);
  }, [handleFileClick]);

  const treePanel = (
    <TeachingFileTreeView
      tree={tree}
      onFileClick={isNarrow ? handleFileClickWithClose : handleFileClick}
      onRefresh={loadTree}
      onDrop={handleDrop}
      title="students/"
    />
  );

  return (
    <div ref={containerRef} className="relative flex h-[calc(100vh-220px)] overflow-hidden">
      {isNarrow && (
        <button
          onClick={() => setShowTreeOverlay(!showTreeOverlay)}
          className="absolute top-2 left-2 z-30 p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          title="Файлы"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      {isNarrow && showTreeOverlay && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowTreeOverlay(false)} />
          <div className="absolute top-0 left-0 z-40 w-56 h-full bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
            {treePanel}
          </div>
        </>
      )}
      {!isNarrow && (
        <div className="shrink-0 border-r border-neutral-800 flex flex-col overflow-hidden" style={{ width: treeWidth }}>
          {treePanel}
        </div>
      )}
      {!isNarrow && (
        <div
          className="w-1 shrink-0 bg-neutral-700/50 hover:bg-neutral-600 cursor-col-resize transition-colors"
          onMouseDown={() => { isDragging.current = true; }}
        />
      )}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {openFile && openFile.name.endsWith('.py') ? (
          <PythonEditor
            filePath={openFile.path}
            fileName={openFile.name}
            initialContent={openFile.content}
            onSave={handlePythonSave}
          />
        ) : openFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                <span className="text-sm text-neutral-300">{openFile.name}</span>
                {!saved && <span className="text-[10px] text-yellow-500">●</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditMode(!editMode); if (editMode && !saved) handleSave(); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    editMode ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  {editMode ? 'Просмотр' : 'Редактировать'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => { setEditContent(e.target.value); setSaved(false); }}
                  onBlur={handleSave}
                  className="w-full h-full bg-transparent text-sm text-neutral-300 font-mono resize-none focus:outline-none"
                  spellCheck={false}
                />
              ) : openFile.content ? (
                <MarkdownRenderer content={openFile.content} className="text-sm text-neutral-300 leading-relaxed" />
              ) : (
                <span className="text-neutral-600 italic">Файл пуст</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
            Выберите файл для просмотра
          </div>
        )}
      </div>
    </div>
  );
}

// --- Compact file tree for General sidebar tab ---

function GeneralSidebarFileTree({ students }: { students: MockStudent[] }) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const loadTree = useCallback(async () => {
    const result = await window.teaching.files.allTree();
    setTree(result);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const node of tree) {
        if (node.isDir) next.add(node.path);
      }
      return next;
    });
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Map slugs to student display names
  const slugToName = new Map<string, string>();
  for (const s of students) {
    slugToName.set(toStudentSlug(s.name), s.name);
  }

  const handleFileClick = useCallback((node: FileTreeNode) => {
    window.electronAPI.openFile(node.path);
  }, []);

  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin">
      {tree.map((node) => (
        <SidebarTreeNode
          key={node.path}
          node={{ ...node, name: slugToName.get(node.name) ?? node.name }}
          depth={0}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          onFileClick={handleFileClick}
        />
      ))}
      {tree.length === 0 && (
        <div className="text-[11px] text-neutral-600">Нет файлов</div>
      )}
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
