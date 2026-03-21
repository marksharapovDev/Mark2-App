import { useState, useRef, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus } from '@mark2/shared';
import { BookOpen, PenLine, ClipboardList, BarChart3, FileText, MapPin, NotebookText, CheckCircle2, Clock, Paperclip, RefreshCw } from 'lucide-react';

// --- Types ---

type MaterialStatus = 'done' | 'in_progress' | 'draft';
type MaterialCategory = 'lecture' | 'seminar' | 'homework' | 'typovoy' | 'coursework' | 'report' | 'notes';
type Priority = 'low' | 'medium' | 'high';
type SidebarTab = 'subjects' | 'general';

interface Schedule {
  day: string;
  time: string;
  type: string;
}

interface Material {
  id: string;
  subjectId: string;
  title: string;
  category: MaterialCategory;
  status: MaterialStatus;
  date: string;
  filePath?: string;
  description?: string;
  deadline?: string;
  originalContent?: string;
  summaryContent?: string;
}

interface SubjectInfo {
  id: string;
  courseId: string;
  name: string;
  professor: string;
  room?: string;
  schedule: Schedule[];
}

interface Course {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface StudyTask {
  id: string;
  subjectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Constants ---

const CATEGORY_META: Record<MaterialCategory, { icon: React.ReactNode; label: string; pluralLabel: string }> = {
  lecture: { icon: <BookOpen size={14} strokeWidth={1.5} />, label: 'Лекция', pluralLabel: 'Лекции' },
  seminar: { icon: <PenLine size={14} strokeWidth={1.5} />, label: 'Семинар', pluralLabel: 'Семинары' },
  homework: { icon: <ClipboardList size={14} strokeWidth={1.5} />, label: 'ДЗ', pluralLabel: 'ДЗ' },
  typovoy: { icon: <BarChart3 size={14} strokeWidth={1.5} />, label: 'Типовой расчёт', pluralLabel: 'Типовые расчёты' },
  coursework: { icon: <FileText size={14} strokeWidth={1.5} />, label: 'Курсовая', pluralLabel: 'Курсовая' },
  report: { icon: <MapPin size={14} strokeWidth={1.5} />, label: 'Доклад', pluralLabel: 'Доклады' },
  notes: { icon: <NotebookText size={14} strokeWidth={1.5} />, label: 'Конспект', pluralLabel: 'Конспекты' },
};

const STATUS_META: Record<MaterialStatus, { icon: React.ReactNode; label: string; color: string }> = {
  done: { icon: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />, label: 'Сдано', color: 'bg-emerald-900/40 text-emerald-300' },
  in_progress: { icon: <Clock size={14} strokeWidth={1.5} className="text-yellow-400" />, label: 'В работе', color: 'bg-yellow-900/40 text-yellow-300' },
  draft: { icon: <Paperclip size={14} strokeWidth={1.5} className="text-neutral-400" />, label: 'Черновик', color: 'bg-neutral-700/40 text-neutral-400' },
};

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

// --- Mock Data ---

const COURSES: Course[] = [
  { id: 'course2', name: 'Курс 2 (текущий)', isCurrent: true },
  { id: 'course1', name: 'Курс 1', isCurrent: false },
];

const SUBJECTS: SubjectInfo[] = [
  {
    id: 'matan',
    courseId: 'course2',
    name: 'Математический анализ',
    professor: 'Иванов А.С.',
    room: '305',
    schedule: [
      { day: 'Пн', time: '10:00', type: 'лекция' },
      { day: 'Ср', time: '12:00', type: 'семинар' },
    ],
  },
  {
    id: 'physics',
    courseId: 'course2',
    name: 'Физика',
    professor: 'Петрова М.И.',
    room: '412',
    schedule: [
      { day: 'Вт', time: '14:00', type: 'лекция' },
      { day: 'Чт', time: '16:00', type: 'лаб.' },
    ],
  },
  {
    id: 'informatics',
    courseId: 'course2',
    name: 'Информатика',
    professor: 'Сидоров К.В.',
    room: '201',
    schedule: [{ day: 'Пт', time: '10:00', type: 'лекция' }],
  },
  {
    id: 'algebra',
    courseId: 'course1',
    name: 'Линейная алгебра',
    professor: 'Кузнецов В.П.',
    schedule: [{ day: 'Пн', time: '08:30', type: 'лекция' }],
  },
  {
    id: 'history',
    courseId: 'course1',
    name: 'История',
    professor: 'Соколова Е.А.',
    schedule: [{ day: 'Ср', time: '10:00', type: 'лекция' }],
  },
];

const MATERIALS: Material[] = [
  // Matan
  {
    id: 'm1', subjectId: 'matan', title: 'Пределы функций', category: 'lecture', status: 'done', date: '2026-02-03',
    filePath: '/Users/marksarapov/Documents/study/matan/lec1.pdf',
    originalContent: `Определение предела функции по Коши:
Пусть f(x) определена в проколотой окрестности точки a. Число L называется пределом f(x) при x→a, если:
∀ε>0 ∃δ>0: 0<|x-a|<δ ⇒ |f(x)-L|<ε

Определение по Гейне:
lim f(x) = L при x→a, если для любой последовательности {xn}, xn→a, xn≠a, выполнено f(xn)→L.

Свойства пределов:
1. lim(f±g) = lim f ± lim g
2. lim(f·g) = lim f · lim g
3. lim(f/g) = lim f / lim g (lim g ≠ 0)

Замечательные пределы:
• lim sin(x)/x = 1 при x→0
• lim (1+1/x)^x = e при x→∞`,
    summaryContent: `Предел функции — значение, к которому стремится f(x) при x→a.

Два определения: ε-δ (Коши) и через последовательности (Гейне).

Ключевые свойства: предел суммы = сумма пределов, аналогично для произведения и частного.

Замечательные пределы: sin(x)/x → 1, (1+1/x)^x → e.`,
  },
  {
    id: 'm2', subjectId: 'matan', title: 'Производные', category: 'lecture', status: 'done', date: '2026-02-10',
    originalContent: `Определение производной:
f'(x₀) = lim[Δx→0] (f(x₀+Δx) - f(x₀)) / Δx

Геометрический смысл: угловой коэффициент касательной к графику f в точке x₀.

Таблица производных:
• (xⁿ)' = n·xⁿ⁻¹
• (eˣ)' = eˣ
• (ln x)' = 1/x
• (sin x)' = cos x
• (cos x)' = -sin x

Правила дифференцирования:
1. (f±g)' = f'±g'
2. (f·g)' = f'g + fg'
3. (f/g)' = (f'g - fg')/g²
4. (f(g(x)))' = f'(g(x))·g'(x) — цепное правило`,
    summaryContent: `Производная — мгновенная скорость изменения функции (предел отношения приращений).

Геометрически: наклон касательной.

Основные: (xⁿ)'=nxⁿ⁻¹, (eˣ)'=eˣ, (sin x)'=cos x.

Правила: сумма, произведение (Лейбниц), частное, цепное правило для композиций.`,
  },
  { id: 'm3', subjectId: 'matan', title: 'Интегралы', category: 'lecture', status: 'draft', date: '2026-03-17' },
  { id: 'm4', subjectId: 'matan', title: 'Задачи на пределы', category: 'seminar', status: 'done', date: '2026-02-05' },
  { id: 'm5', subjectId: 'matan', title: 'Задачи на производные', category: 'seminar', status: 'in_progress', date: '2026-03-12' },
  { id: 'm6', subjectId: 'matan', title: 'Пределы', category: 'homework', status: 'done', date: '2026-02-10', description: 'Вычислить пределы 15 функций, включая замечательные пределы.' },
  { id: 'm7', subjectId: 'matan', title: 'Производные', category: 'homework', status: 'in_progress', date: '2026-03-15', deadline: '2026-03-25', description: 'Найти производные сложных функций. 20 задач из сборника.' },
  { id: 'm8', subjectId: 'matan', title: 'Интегралы (часть 1)', category: 'homework', status: 'in_progress', date: '2026-03-18', deadline: '2026-04-05' },
  { id: 'm9', subjectId: 'matan', title: 'Ряды Тейлора', category: 'homework', status: 'in_progress', date: '2026-03-20', deadline: '2026-04-10' },
  { id: 'm10', subjectId: 'matan', title: 'Типовой расчёт 1', category: 'typovoy', status: 'in_progress', date: '2026-03-01', deadline: '2026-04-01', description: 'Дифференциальное исчисление функций одной переменной. 30 задач.' },

  // Physics
  {
    id: 'p1', subjectId: 'physics', title: 'Механика', category: 'lecture', status: 'done', date: '2026-02-04',
    filePath: '/Users/marksarapov/Documents/study/physics/lec1.pdf',
    originalContent: `Кинематика материальной точки:
Радиус-вектор: r⃗(t) = x(t)î + y(t)ĵ + z(t)k̂
Скорость: v⃗ = dr⃗/dt
Ускорение: a⃗ = dv⃗/dt

Равномерное движение: x = x₀ + v·t
Равноускоренное: x = x₀ + v₀t + at²/2

Законы Ньютона:
1. В ИСО тело покоится или движется равномерно, если ΣF⃗ = 0
2. F⃗ = ma⃗
3. F⃗₁₂ = -F⃗₂₁

Закон сохранения импульса: p⃗ = mv⃗ = const (замкнутая система)
Закон сохранения энергии: E = K + U = const`,
    summaryContent: `Кинематика: положение → скорость (производная) → ускорение (вторая производная).

Два типа движения: равномерное (v=const) и равноускоренное (a=const).

Три закона Ньютона: инерция, F=ma, действие=противодействие.

Законы сохранения: импульс (p=mv) и энергия (E=K+U) в замкнутых системах.`,
  },
  { id: 'p2', subjectId: 'physics', title: 'Термодинамика', category: 'lecture', status: 'done', date: '2026-02-18' },
  { id: 'p3', subjectId: 'physics', title: 'Измерение ускорения', category: 'seminar', status: 'done', date: '2026-02-06', description: 'Лабораторная работа: измерение ускорения свободного падения.' },
  { id: 'p4', subjectId: 'physics', title: 'Теплоёмкость', category: 'seminar', status: 'in_progress', date: '2026-03-20', deadline: '2026-03-27' },
  { id: 'p5', subjectId: 'physics', title: 'Волновая оптика', category: 'coursework', status: 'draft', date: '2026-03-01', deadline: '2026-05-15', description: 'Курсовая работа по волновой оптике. Исследование дифракции.' },
  { id: 'p6', subjectId: 'physics', title: 'Квантовая механика', category: 'report', status: 'in_progress', date: '2026-03-10', deadline: '2026-04-03', description: 'Доклад на 10-15 минут по основам квантовой механики.' },

  // Informatics
  { id: 'i1', subjectId: 'informatics', title: 'Алгоритмы сортировки', category: 'lecture', status: 'done', date: '2026-02-07' },
  { id: 'i2', subjectId: 'informatics', title: 'Реализация quicksort', category: 'homework', status: 'done', date: '2026-02-14', filePath: '/Users/marksarapov/Documents/study/informatics/quicksort.py' },
  { id: 'i3', subjectId: 'informatics', title: 'Графы и деревья', category: 'homework', status: 'in_progress', date: '2026-03-14', deadline: '2026-03-28', description: 'Реализовать BFS, DFS. Построить минимальное остовное дерево.' },
  { id: 'i4', subjectId: 'informatics', title: 'Сложность алгоритмов', category: 'notes', status: 'done', date: '2026-02-20' },

  // Course 1 (all done)
  { id: 'a1', subjectId: 'algebra', title: 'Матрицы и определители', category: 'lecture', status: 'done', date: '2025-09-05' },
  { id: 'a2', subjectId: 'algebra', title: 'Системы линейных уравнений', category: 'homework', status: 'done', date: '2025-09-20' },
  { id: 'a3', subjectId: 'algebra', title: 'Векторные пространства', category: 'notes', status: 'done', date: '2025-10-15' },
  { id: 'h1', subjectId: 'history', title: 'Древний мир', category: 'lecture', status: 'done', date: '2025-09-10' },
  { id: 'h2', subjectId: 'history', title: 'Средневековье — реферат', category: 'report', status: 'done', date: '2025-10-20' },
];

const MOCK_STUDY_TASKS: StudyTask[] = [
  {
    id: 'st1',
    subjectId: 'matan',
    title: 'Доделать ДЗ по производным',
    status: 'in_progress',
    priority: 'high',
    context: 'Осталось 8 задач из 20. Сложные — цепное правило с тригонометрией.',
    deadline: '2026-03-25',
  },
  {
    id: 'st2',
    subjectId: 'matan',
    title: 'Типовой расчёт — задачи 15-30',
    status: 'todo',
    priority: 'high',
    context: 'Вторая половина типового. Интегрирование по частям, подстановка.',
    deadline: '2026-04-01',
  },
  {
    id: 'st3',
    subjectId: 'physics',
    title: 'Оформить лабораторную по теплоёмкости',
    status: 'todo',
    priority: 'medium',
    context: 'Данные собраны, нужно оформить отчёт и построить графики.',
    deadline: '2026-03-27',
  },
  {
    id: 'st4',
    subjectId: 'physics',
    title: 'Начать курсовую — план и литература',
    status: 'todo',
    priority: 'medium',
    context: 'Составить план курсовой по волновой оптике, найти 10 источников.',
    deadline: '2026-04-01',
  },
  {
    id: 'st5',
    subjectId: 'informatics',
    title: 'Реализовать BFS и DFS',
    status: 'in_progress',
    priority: 'medium',
    context: 'BFS готов, нужен DFS + минимальное остовное дерево (Краскал или Прим).',
    deadline: '2026-03-28',
  },
  {
    id: 'st6',
    subjectId: 'physics',
    title: 'Подготовить доклад по квантовой механике',
    status: 'in_progress',
    priority: 'low',
    context: 'Слайды наполовину готовы. Нужно добавить примеры и формулы.',
    deadline: '2026-04-03',
  },
  {
    id: 'st7',
    subjectId: 'matan',
    title: 'Написать конспект по интегралам',
    status: 'todo',
    priority: 'low',
    context: 'Лекция была, но конспект пустой. Восстановить по учебнику.',
    deadline: null,
  },
];

// --- Helpers ---

function getSubjectMaterials(subjectId: string): Material[] {
  return MATERIALS.filter((m) => m.subjectId === subjectId);
}

function getSubjectTasks(subjectId: string): StudyTask[] {
  return MOCK_STUDY_TASKS.filter((t) => t.subjectId === subjectId);
}

function getSubjectName(subjectId: string): string {
  return SUBJECTS.find((s) => s.id === subjectId)?.name ?? subjectId;
}

function groupByCategory(materials: Material[]): Record<MaterialCategory, Material[]> {
  const groups: Record<string, Material[]> = {};
  for (const m of materials) {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  }
  return groups as Record<MaterialCategory, Material[]>;
}

function getUpcomingDeadlines(courseId?: string): Array<Material & { subjectName: string }> {
  const subjectIds = courseId
    ? new Set(SUBJECTS.filter((s) => s.courseId === courseId).map((s) => s.id))
    : new Set(SUBJECTS.map((s) => s.id));

  return MATERIALS
    .filter((m) => m.deadline && m.status !== 'done' && subjectIds.has(m.subjectId))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 5)
    .map((m) => ({
      ...m,
      subjectName: SUBJECTS.find((s) => s.id === m.subjectId)?.name ?? '',
    }));
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function openFile(filePath: string) {
  (window as Record<string, unknown>).electronAPI
    ? (window as { electronAPI: { openFile: (p: string) => Promise<void> } }).electronAPI.openFile(filePath)
    : console.log('Would open:', filePath);
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'material-detail'; materialId: string }
  | { kind: 'category-list'; category: MaterialCategory; filter: MaterialStatus | 'all' }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'add-material' };

// --- Collapsible Section ---

function CollapsibleCategory({
  category,
  materials,
  onMaterialClick,
  activeMaterialId,
}: {
  category: MaterialCategory;
  materials: Material[];
  onMaterialClick: (id: string) => void;
  activeMaterialId?: string;
}) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category];

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <span className="text-[10px] text-neutral-600">{open ? '\u25BE' : '\u25B8'}</span>
        <span>{meta.icon}</span>
        <span>{meta.pluralLabel}</span>
        <span className="text-neutral-600 ml-auto">({materials.length})</span>
      </button>
      {open && (
        <div className="ml-2 space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
          {materials.map((m) => (
            <button
              key={m.id}
              onClick={() => onMaterialClick(m.id)}
              className={`w-full text-left flex items-center gap-1.5 text-xs text-neutral-400 py-0.5 px-1.5 rounded hover:bg-neutral-800/50 transition-colors group ${
                activeMaterialId === m.id ? 'bg-neutral-800/50 text-neutral-200' : ''
              }`}
            >
              <span className="text-[10px] shrink-0">{STATUS_META[m.status].icon}</span>
              <span className="truncate group-hover:text-neutral-200 transition-colors">{m.title}</span>
              <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">{formatDate(m.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function Study() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('subjects');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    COURSES.find((c) => c.isCurrent)?.id ?? COURSES[0].id,
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-study-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    category: 'lecture' as MaterialCategory,
    status: 'draft' as MaterialStatus,
    description: '',
    deadline: '',
  });
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const courseSubjects = SUBJECTS.filter((s) => s.courseId === selectedCourseId);
  const subject = selectedSubjectId ? SUBJECTS.find((s) => s.id === selectedSubjectId) : null;
  const materials = subject ? getSubjectMaterials(subject.id) : [];
  const grouped = groupByCategory(materials);
  const subjectTasks = subject ? getSubjectTasks(subject.id) : [];
  const deadlines = getUpcomingDeadlines(selectedCourseId);

  // General tab stats
  const allSubjectsCurrent = SUBJECTS.filter((s) => s.courseId === selectedCourseId);
  const allMaterialsCurrent = MATERIALS.filter((m) =>
    allSubjectsCurrent.some((s) => s.id === m.subjectId),
  );
  const totalInProgress = allMaterialsCurrent.filter((m) => m.status === 'in_progress').length;
  const totalDone = allMaterialsCurrent.filter((m) => m.status === 'done').length;
  const allTasksTodo = MOCK_STUDY_TASKS.filter((t) => t.status === 'todo').length;

  const selectSubject = useCallback((id: string) => {
    setSelectedSubjectId(id);
    setSidebarTab('subjects');
    setMainView({ kind: 'overview' });
  }, []);

  const selectCourse = useCallback((id: string) => {
    setSelectedCourseId(id);
    setSelectedSubjectId(null);
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
      localStorage.setItem('mark2-study-sidebar-width', String(w));
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
    setTaskChecked((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const getEffectiveStatus = useCallback((task: StudyTask): TaskStatus => {
    if (taskChecked[task.id]) return 'done';
    return task.status;
  }, [taskChecked]);

  const sendTaskToChat = useCallback((task: StudyTask) => {
    const text = `Помоги с задачей: ${task.title}\n${task.context}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, []);

  return (
    <MainLayout agent="study" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Tabs */}
          <div className="flex border-b border-neutral-800">
            <button
              onClick={() => setSidebarTab('subjects')}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sidebarTab === 'subjects'
                  ? 'text-neutral-200 border-b-2 border-blue-500'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Предметы
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

          {sidebarTab === 'subjects' && (
            <>
              {/* Course selector */}
              <div className="px-3 py-3">
                <select
                  value={selectedCourseId}
                  onChange={(e) => selectCourse(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
                >
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Subjects header + add button */}
              <div className="px-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Предметы</span>
                <button
                  onClick={() => setMainView({ kind: 'add-material' })}
                  className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-sm"
                  title="Добавить материал"
                >
                  +
                </button>
              </div>
              <nav className="px-2 space-y-0.5">
                {courseSubjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSubject(s.id)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                      selectedSubjectId === s.id
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                    }`}
                  >
                    <span className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                    {s.name}
                  </button>
                ))}
              </nav>

              {/* Subject detail sections */}
              {subject && (
                <div className="flex-1 overflow-hidden flex flex-col mt-2">
                  <div className="mx-3 border-t border-neutral-800" />
                  <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                    {/* Info */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Информация
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="text-neutral-300 font-medium">{subject.name}</div>
                        <div className="text-neutral-400">
                          <span className="text-neutral-500">Преподаватель:</span> {subject.professor}
                        </div>
                        {subject.room && (
                          <div className="text-neutral-400">
                            <span className="text-neutral-500">Аудитория:</span> {subject.room}
                          </div>
                        )}
                        <div className="text-neutral-500 text-[11px] mt-1">
                          {subject.schedule.map((s) => `${s.day} ${s.time} (${s.type})`).join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Tasks for this subject */}
                    {subjectTasks.length > 0 && (
                      <>
                        <div className="px-3 pt-3 pb-2">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Задачи
                          </div>
                          <div className="space-y-1">
                            {subjectTasks.map((task) => {
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

                    {/* Materials by category (tree) */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                          Материалы
                        </div>
                        <button
                          onClick={() => setMainView({ kind: 'add-material' })}
                          className="w-4 h-4 flex items-center justify-center rounded bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-[10px]"
                          title="Добавить материал"
                        >
                          +
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {(Object.keys(CATEGORY_META) as MaterialCategory[])
                          .filter((cat) => grouped[cat] && grouped[cat].length > 0)
                          .map((cat) => (
                            <CollapsibleCategory
                              key={cat}
                              category={cat}
                              materials={grouped[cat]}
                              onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
                              activeMaterialId={mainView.kind === 'material-detail' ? mainView.materialId : undefined}
                            />
                          ))}
                      </div>
                    </div>

                    <div className="mx-3 border-t border-neutral-800" />

                    {/* Upcoming deadlines */}
                    {deadlines.filter((d) => d.subjectId === subject.id).length > 0 && (
                      <div className="px-3 pt-3 pb-3">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                          Ближайшие дедлайны
                        </div>
                        <div className="space-y-1.5">
                          {deadlines
                            .filter((d) => d.subjectId === subject.id)
                            .map((d) => (
                              <button
                                key={d.id}
                                onClick={() => setMainView({ kind: 'material-detail', materialId: d.id })}
                                className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-red-400/70 text-[10px] shrink-0">
                                    {formatDate(d.deadline!)}
                                  </span>
                                </div>
                                <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                                  {CATEGORY_META[d.category].icon} {d.title}
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
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
                    <div className="text-sm font-bold text-blue-400">{allSubjectsCurrent.length}</div>
                    <div className="text-[10px] text-blue-400/70 uppercase">Предметов</div>
                  </div>
                  <div className="bg-emerald-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-emerald-400">{totalDone}</div>
                    <div className="text-[10px] text-emerald-400/70 uppercase">Сдано</div>
                  </div>
                  <div className="bg-yellow-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-yellow-400">{totalInProgress}</div>
                    <div className="text-[10px] text-yellow-400/70 uppercase">В работе</div>
                  </div>
                  <div className="bg-red-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-red-400">{allTasksTodo}</div>
                    <div className="text-[10px] text-red-400/70 uppercase">Задач todo</div>
                  </div>
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* All tasks */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Мои задачи
                </div>
                <div className="space-y-1">
                  {MOCK_STUDY_TASKS.map((task) => {
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
                        <button
                          onClick={() => {
                            setSelectedSubjectId(task.subjectId);
                            setMainView({ kind: 'task-detail', taskId: task.id });
                          }}
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

              {/* Upcoming deadlines (all subjects) */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Ближайшие дедлайны
                </div>
                <div className="space-y-1.5">
                  {deadlines.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedSubjectId(d.subjectId);
                        setSidebarTab('subjects');
                        setMainView({ kind: 'material-detail', materialId: d.id });
                      }}
                      className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-400/70 text-[10px] shrink-0">{formatDate(d.deadline!)}</span>
                        <span className="text-neutral-500 text-[10px] truncate">{d.subjectName}</span>
                      </div>
                      <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                        {CATEGORY_META[d.category].icon} {d.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* All subjects overview */}
              <div className="px-3 pt-3 pb-3">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Предметы
                </div>
                <div className="space-y-1">
                  {allSubjectsCurrent.map((s) => {
                    const subMats = MATERIALS.filter((m) => m.subjectId === s.id);
                    const done = subMats.filter((m) => m.status === 'done').length;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectSubject(s.id)}
                        className="w-full text-left flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors group"
                      >
                        <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors flex-1 truncate">
                          {s.name}
                        </span>
                        <span className="text-neutral-600 text-[10px] shrink-0">{done}/{subMats.length}</span>
                      </button>
                    );
                  })}
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
          {!subject && mainView.kind !== 'add-material' && (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Выберите предмет
            </div>
          )}

          {subject && mainView.kind === 'overview' && (
            <SubjectOverview
              subject={subject}
              materials={materials}
              tasks={subjectTasks}
              deadlines={deadlines}
              onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
              onCategoryClick={(cat) => setMainView({ kind: 'category-list', category: cat, filter: 'all' })}
              onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
              getEffectiveStatus={getEffectiveStatus}
              onAddMaterial={() => setMainView({ kind: 'add-material' })}
            />
          )}

          {subject && mainView.kind === 'material-detail' && (
            <MaterialDetailView
              material={materials.find((m) => m.id === mainView.materialId)
                ?? MATERIALS.find((m) => m.id === mainView.materialId)}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}

          {subject && mainView.kind === 'category-list' && (
            <CategoryListView
              subject={subject}
              category={mainView.category}
              materials={grouped[mainView.category] ?? []}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'category-list', category: mainView.category, filter: f })}
              onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}

          {subject && mainView.kind === 'task-detail' && (
            <TaskDetailView
              task={MOCK_STUDY_TASKS.find((t) => t.id === mainView.taskId)}
              onBack={() => setMainView({ kind: 'overview' })}
              toggleTaskChecked={toggleTaskChecked}
              getEffectiveStatus={getEffectiveStatus}
              sendTaskToChat={sendTaskToChat}
            />
          )}

          {mainView.kind === 'add-material' && (
            <AddMaterialView
              form={newMaterial}
              onChange={setNewMaterial}
              subjects={courseSubjects}
              selectedSubjectId={selectedSubjectId}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function SubjectOverview({
  subject,
  materials,
  tasks,
  deadlines,
  onMaterialClick,
  onCategoryClick,
  onTaskClick,
  getEffectiveStatus,
  onAddMaterial,
}: {
  subject: SubjectInfo;
  materials: Material[];
  tasks: StudyTask[];
  deadlines: Array<Material & { subjectName: string }>;
  onMaterialClick: (id: string) => void;
  onCategoryClick: (cat: MaterialCategory) => void;
  onTaskClick: (id: string) => void;
  getEffectiveStatus: (task: StudyTask) => TaskStatus;
  onAddMaterial: () => void;
}) {
  const total = materials.length;
  const done = materials.filter((m) => m.status === 'done').length;
  const inProgress = materials.filter((m) => m.status === 'in_progress').length;
  const draft = materials.filter((m) => m.status === 'draft').length;
  const grouped = groupByCategory(materials);

  return (
    <div className="max-w-2xl">
      {/* Subject card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold mb-1">{subject.name}</h1>
        <p className="text-neutral-400 text-sm mb-2">{subject.professor}</p>
        <div className="text-xs text-neutral-500">
          {subject.room && <><span>Ауд. {subject.room}</span><span className="mx-2">&middot;</span></>}
          {subject.schedule.map((s) => `${s.day} ${s.time} (${s.type})`).join(', ')}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatBadge label="Всего" count={total} color="text-blue-400 bg-blue-400/10" />
        <StatBadge label="Сдано" count={done} color="text-emerald-400 bg-emerald-400/10" />
        <StatBadge label="В работе" count={inProgress} color="text-yellow-400 bg-yellow-400/10" />
        {draft > 0 && <StatBadge label="Черновик" count={draft} color="text-neutral-400 bg-neutral-400/10" />}
      </div>

      {/* Tasks */}
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

      {/* Deadlines */}
      {deadlines.filter((d) => d.subjectId === subject.id).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Ближайшие дедлайны</h2>
          <div className="space-y-2">
            {deadlines
              .filter((d) => d.subjectId === subject.id)
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => onMaterialClick(d.id)}
                  className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
                >
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="text-red-400/80 text-xs shrink-0">{formatDate(d.deadline!)}</span>
                    <span className="text-neutral-300">
                      {CATEGORY_META[d.category].icon} {d.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${STATUS_META[d.status].color}`}>
                      {STATUS_META[d.status].label}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Materials by category */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-300">Материалы по категориям</h2>
          <button
            onClick={onAddMaterial}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1"
          >
            + Добавить
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORY_META) as MaterialCategory[])
            .filter((cat) => grouped[cat] && grouped[cat].length > 0)
            .map((cat) => {
              const catMaterials = grouped[cat];
              const catDone = catMaterials.filter((m) => m.status === 'done').length;
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryClick(cat)}
                  className="text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-3 py-2.5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{CATEGORY_META[cat].icon}</span>
                    <span className="text-neutral-300">{CATEGORY_META[cat].pluralLabel}</span>
                    <span className="text-neutral-600 text-xs ml-auto">{catDone}/{catMaterials.length}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Recent materials */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последние добавленные</h2>
        <div className="space-y-2">
          {[...materials].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((m) => (
            <button
              key={m.id}
              onClick={() => onMaterialClick(m.id)}
              className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm shrink-0">{STATUS_META[m.status].icon}</span>
                <span className="text-sm text-neutral-300">
                  {CATEGORY_META[m.category].icon} {m.title}
                </span>
                <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">{formatDate(m.date)}</span>
              </div>
            </button>
          ))}
        </div>
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

function MaterialDetailView({
  material,
  onBack,
}: {
  material: Material | undefined;
  onBack: () => void;
}) {
  const [contentMode, setContentMode] = useState<'original' | 'summary'>('original');

  if (!material) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Материал не найден</p>
      </div>
    );
  }

  const subject = SUBJECTS.find((s) => s.id === material.subjectId);
  const hasContent = material.originalContent || material.summaryContent;
  const isLecture = material.category === 'lecture';

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_META[material.status].color}`}>
          {STATUS_META[material.status].icon} {STATUS_META[material.status].label}
        </span>
        <span className="text-neutral-600 text-xs">
          {CATEGORY_META[material.category].icon} {CATEGORY_META[material.category].label}
        </span>
        <span className="text-neutral-500 text-sm">{formatDate(material.date)}</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{material.title}</h1>
      {subject && <p className="text-neutral-500 text-sm mb-6">{subject.name}</p>}

      {/* Deadline */}
      {material.deadline && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Дедлайн
          </h2>
          <p className="text-neutral-300 text-sm">{formatDate(material.deadline)}</p>
        </div>
      )}

      {/* Description */}
      {material.description && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Описание
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{material.description}</p>
        </div>
      )}

      {/* Original / Summary toggle for lectures */}
      {isLecture && hasContent && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Содержание
            </h2>
            <div className="flex gap-0.5 ml-auto bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
              <button
                onClick={() => setContentMode('original')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  contentMode === 'original'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Оригинал
              </button>
              <button
                onClick={() => setContentMode('summary')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  contentMode === 'summary'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Конспект
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
            {contentMode === 'original' && material.originalContent && (
              <pre className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                {material.originalContent}
              </pre>
            )}
            {contentMode === 'summary' && material.summaryContent && (
              <div>
                <div className="flex items-center gap-1.5 mb-3 text-[10px] text-blue-400/70 uppercase tracking-wider">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  AI-конспект
                </div>
                <pre className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {material.summaryContent}
                </pre>
              </div>
            )}
            {contentMode === 'original' && !material.originalContent && (
              <p className="text-neutral-600 text-sm">Оригинальный текст не загружен.</p>
            )}
            {contentMode === 'summary' && !material.summaryContent && (
              <div className="text-center py-4">
                <p className="text-neutral-600 text-sm mb-2">Конспект ещё не создан.</p>
                <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Создать конспект через AI
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File button */}
      {material.filePath ? (
        <button
          onClick={() => openFile(material.filePath!)}
          className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300 hover:bg-blue-900/50 transition-colors"
        >
          <FileText size={16} strokeWidth={1.5} /> Посмотреть файл
        </button>
      ) : (
        !hasContent && (
          <div className="text-xs text-neutral-600 mt-2">
            Файл не прикреплён. Можно создать через чат.
          </div>
        )
      )}
    </div>
  );
}

function CategoryListView({
  subject,
  category,
  materials,
  filter,
  onFilterChange,
  onMaterialClick,
  onBack,
}: {
  subject: SubjectInfo;
  category: MaterialCategory;
  materials: Material[];
  filter: MaterialStatus | 'all';
  onFilterChange: (f: MaterialStatus | 'all') => void;
  onMaterialClick: (id: string) => void;
  onBack: () => void;
}) {
  const filtered = filter === 'all' ? materials : materials.filter((m) => m.status === filter);
  const filters: Array<{ value: MaterialStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'done', label: 'Сдано' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'draft', label: 'Черновик' },
  ];

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>
      <h1 className="text-2xl font-bold mb-1">{subject.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">
        {CATEGORY_META[category].icon} {CATEGORY_META[category].pluralLabel}
      </h2>

      {/* Filters */}
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

      {/* List */}
      <div className="space-y-2">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => onMaterialClick(m.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0">{STATUS_META[m.status].icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{m.title}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  {formatDate(m.date)}
                  {m.deadline && <span className="ml-2">Дедлайн: {formatDate(m.deadline)}</span>}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_META[m.status].color}`}>
                {STATUS_META[m.status].label}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет материалов с таким статусом</div>
        )}
      </div>
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
  task: StudyTask | undefined;
  onBack: () => void;
  toggleTaskChecked: (id: string) => void;
  getEffectiveStatus: (task: StudyTask) => TaskStatus;
  sendTaskToChat: (task: StudyTask) => void;
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
            <span className="text-xs text-neutral-600">{getSubjectName(task.subjectId)}</span>
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

function AddMaterialView({
  form,
  onChange,
  subjects,
  selectedSubjectId,
  onBack,
}: {
  form: { title: string; category: MaterialCategory; status: MaterialStatus; description: string; deadline: string };
  onChange: (f: { title: string; category: MaterialCategory; status: MaterialStatus; description: string; deadline: string }) => void;
  subjects: SubjectInfo[];
  selectedSubjectId: string | null;
  onBack: () => void;
}) {
  const [subjectId, setSubjectId] = useState(selectedSubjectId ?? subjects[0]?.id ?? '');

  return (
    <div className="max-w-md">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      <h1 className="text-2xl font-bold mb-6">Новый материал</h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Предмет</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Название</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="Интегралы, ДЗ 3..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Категория</label>
            <select
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value as MaterialCategory })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              {(Object.keys(CATEGORY_META) as MaterialCategory[]).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_META[cat].label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Статус</label>
            <select
              value={form.status}
              onChange={(e) => onChange({ ...form, status: e.target.value as MaterialStatus })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              {(Object.keys(STATUS_META) as MaterialStatus[]).map((st) => (
                <option key={st} value={st}>{STATUS_META[st].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Дедлайн</label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => onChange({ ...form, deadline: e.target.value })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Описание</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Что нужно сделать..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500 resize-none"
          />
        </div>

        <button className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors">
          Сохранить
        </button>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 mt-4">
          <p className="text-xs text-neutral-500">
            Или скажите боту: <span className="text-neutral-400">"Добавь лекцию по матану — Интегралы"</span>
          </p>
        </div>
      </div>
    </div>
  );
}
