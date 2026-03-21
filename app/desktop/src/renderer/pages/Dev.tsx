import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus } from '@mark2/shared';

// --- Types ---

type Priority = 'low' | 'medium' | 'high';

interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

interface MockTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  description: string;
  subtasks: SubTask[];
  createdAt: string;
  deadline: string | null;
}

interface MockProject {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  description: string;
  stack: string[];
  repoUrl: string | null;
  deployUrl: string | null;
}

interface DocFile {
  id: string;
  projectId: string;
  title: string;
  icon: string;
  content: string;
  updatedAt: string;
}

interface MockChange {
  id: string;
  projectId: string;
  date: string;
  message: string;
}

// --- Mock Data ---

const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'li-group',
    name: 'LI Group',
    slug: 'li-group',
    status: 'active',
    description: 'Сайт для компании LI GROUP — VR-решения для образования. Лендинг + личный кабинет с аналитикой для школ.',
    stack: ['Next.js', 'Tailwind', 'Supabase'],
    repoUrl: 'https://github.com/mark/li-group-site',
    deployUrl: 'https://li-group.vercel.app',
  },
  {
    id: 'my-site',
    name: 'Personal Site',
    slug: 'my-site',
    status: 'active',
    description: 'Персональный сайт-портфолио. Минималистичный дизайн.',
    stack: ['Next.js', 'Tailwind'],
    repoUrl: 'https://github.com/mark/my-site',
    deployUrl: 'https://marksarapov.dev',
  },
  {
    id: 'mark2',
    name: 'Mark2',
    slug: 'mark2',
    status: 'active',
    description: 'Персональный хаб управления жизнью. Electron + React Native.',
    stack: ['Electron', 'React', 'Supabase'],
    repoUrl: 'https://github.com/mark/mark2',
    deployUrl: null,
  },
];

const MOCK_TASKS: MockTask[] = [
  // LI Group
  {
    id: 't1',
    projectId: 'li-group',
    title: 'Дизайн главной страницы',
    status: 'done',
    priority: 'high',
    description: 'Hero секция с 3D VR демо, секция преимуществ, отзывы школ, CTA на демо-доступ',
    subtasks: [
      { id: 'st1-1', title: 'Hero секция', done: true },
      { id: 'st1-2', title: 'Преимущества', done: true },
      { id: 'st1-3', title: 'Отзывы', done: true },
      { id: 'st1-4', title: 'CTA', done: true },
    ],
    createdAt: '2026-03-05',
    deadline: '2026-03-15',
  },
  {
    id: 't2',
    projectId: 'li-group',
    title: 'Вёрстка главной',
    status: 'in_progress',
    priority: 'high',
    description: 'На основе одобренного дизайна, responsive, анимации при скролле',
    subtasks: [
      { id: 'st2-1', title: 'Header', done: true },
      { id: 'st2-2', title: 'Hero', done: true },
      { id: 'st2-3', title: 'Секции', done: false },
      { id: 'st2-4', title: 'Footer', done: false },
    ],
    createdAt: '2026-03-10',
    deadline: '2026-03-25',
  },
  {
    id: 't3',
    projectId: 'li-group',
    title: 'Личный кабинет — авторизация',
    status: 'todo',
    priority: 'medium',
    description: 'Supabase Auth, вход по email + Google, роли: школа, учитель, админ',
    subtasks: [
      { id: 'st3-1', title: 'Supabase Auth настройка', done: false },
      { id: 'st3-2', title: 'Email вход', done: false },
      { id: 'st3-3', title: 'Google OAuth', done: false },
      { id: 'st3-4', title: 'Система ролей', done: false },
    ],
    createdAt: '2026-03-12',
    deadline: '2026-03-30',
  },
  {
    id: 't4',
    projectId: 'li-group',
    title: 'API аналитики',
    status: 'todo',
    priority: 'medium',
    description: 'Эндпоинты для дашборда школы: количество учеников, время в VR, прогресс',
    subtasks: [
      { id: 'st4-1', title: 'GET /api/analytics/students', done: false },
      { id: 'st4-2', title: 'GET /api/analytics/vr-time', done: false },
      { id: 'st4-3', title: 'GET /api/analytics/progress', done: false },
    ],
    createdAt: '2026-03-14',
    deadline: null,
  },
  {
    id: 't5',
    projectId: 'li-group',
    title: 'Деплой на Vercel',
    status: 'todo',
    priority: 'low',
    description: 'Preview из веток, production из main',
    subtasks: [
      { id: 'st5-1', title: 'Vercel project setup', done: false },
      { id: 'st5-2', title: 'Preview deployments', done: false },
      { id: 'st5-3', title: 'Production deploy', done: false },
    ],
    createdAt: '2026-03-15',
    deadline: null,
  },
  // Personal Site
  {
    id: 't9',
    projectId: 'my-site',
    title: 'Редизайн портфолио',
    status: 'in_progress',
    priority: 'high',
    description: 'Новый дизайн с акцентом на проекты и кейсы',
    subtasks: [
      { id: 'st9-1', title: 'Макет в Figma', done: true },
      { id: 'st9-2', title: 'Вёрстка', done: false },
    ],
    createdAt: '2026-03-08',
    deadline: '2026-03-28',
  },
  {
    id: 't10',
    projectId: 'my-site',
    title: 'Блог на MDX',
    status: 'todo',
    priority: 'medium',
    description: 'Система блога с MDX, теги, пагинация',
    subtasks: [],
    createdAt: '2026-03-10',
    deadline: null,
  },
  {
    id: 't11',
    projectId: 'my-site',
    title: 'Тёмная тема',
    status: 'done',
    priority: 'low',
    description: 'Переключатель light/dark, сохранение в localStorage',
    subtasks: [
      { id: 'st11-1', title: 'CSS variables', done: true },
      { id: 'st11-2', title: 'Toggle UI', done: true },
    ],
    createdAt: '2026-03-05',
    deadline: null,
  },
  // Mark2
  {
    id: 't14',
    projectId: 'mark2',
    title: 'Claude Bridge: streaming',
    status: 'in_progress',
    priority: 'high',
    description: 'Потоковый вывод от Claude Code CLI в реальном времени',
    subtasks: [
      { id: 'st14-1', title: 'Базовый spawn', done: true },
      { id: 'st14-2', title: 'Streaming парсер', done: false },
    ],
    createdAt: '2026-03-12',
    deadline: '2026-03-22',
  },
  {
    id: 't15',
    projectId: 'mark2',
    title: 'UI: раздел Dev',
    status: 'in_progress',
    priority: 'high',
    description: 'Полноценный раздел разработки с задачами и документацией',
    subtasks: [
      { id: 'st15-1', title: 'Sidebar', done: true },
      { id: 'st15-2', title: 'Main content', done: false },
      { id: 'st15-3', title: 'Task system', done: false },
    ],
    createdAt: '2026-03-14',
    deadline: '2026-03-25',
  },
  {
    id: 't16',
    projectId: 'mark2',
    title: 'Supabase миграции',
    status: 'done',
    priority: 'medium',
    description: 'Все таблицы: users, sessions, tasks, documents',
    subtasks: [],
    createdAt: '2026-03-08',
    deadline: null,
  },
];

const MOCK_DOCS: DocFile[] = [
  // LI Group
  {
    id: 'doc-li-brief',
    projectId: 'li-group',
    title: 'Бриф',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-18',
    content: `# Бриф: LI Group

## О проекте
Сайт для компании **LI GROUP** — VR-решения для образования.
Лендинг + личный кабинет с аналитикой для школ.

## Цели
- Представить продукт (VR-платформа для школ)
- Привлечь школы на демо-доступ
- Личный кабинет с аналитикой для подключённых школ

## Целевая аудитория
- Директора школ и завучи
- IT-специалисты образовательных учреждений
- Учителя, заинтересованные в VR

## Ключевые страницы
1. **Главная** — Hero с VR-демо, преимущества, отзывы, CTA
2. **О компании** — команда, миссия, партнёры
3. **Решения** — каталог VR-курсов
4. **Личный кабинет** — дашборд школы, аналитика
5. **Контакты** — форма, карта

## Сроки
- Лендинг: до 30 марта 2026
- Личный кабинет: до 15 апреля 2026`,
  },
  {
    id: 'doc-li-arch',
    projectId: 'li-group',
    title: 'Архитектура',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-16',
    content: `# Архитектура: LI Group

## Стек
- **Framework**: Next.js 14, App Router
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth (email + Google)
- **Database**: Supabase PostgreSQL
- **Hosting**: Vercel

## Структура
\`\`\`
src/
  app/
    (landing)/     — публичные страницы
    (dashboard)/   — личный кабинет (protected)
    api/           — API routes
  components/
    ui/            — переиспользуемые компоненты
    landing/       — компоненты лендинга
    dashboard/     — компоненты кабинета
  lib/
    supabase.ts    — клиент Supabase
    auth.ts        — хелперы авторизации
\`\`\`

## Роли
- \`school\` — администратор школы
- \`teacher\` — учитель
- \`admin\` — суперадмин LI Group

## API
- \`GET /api/analytics/students\` — список учеников
- \`GET /api/analytics/vr-time\` — время в VR по классам
- \`GET /api/analytics/progress\` — прогресс по курсам`,
  },
  {
    id: 'doc-li-style',
    projectId: 'li-group',
    title: 'Стилегайд',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-14',
    content: `# Стилегайд: LI Group

## Цвета
- **Primary**: \`#1a1a2e\` (тёмно-синий)
- **Accent**: \`#16213e\` (глубокий синий)
- **CTA**: \`#e94560\` (красный акцент)
- **Success**: \`#0f3460\` (синий)
- **Background**: \`#0a0a0a\` — \`#1a1a2e\` (градиент)
- **Text**: \`#ffffff\`, \`#a0a0b0\`

## Шрифты
- **Заголовки**: Inter, 700
- **Текст**: Inter, 400
- **Код**: JetBrains Mono

## Стиль
- Минимализм, tech-feel
- Тёмная тема по умолчанию
- Плавные анимации (Framer Motion)
- Стекломорфизм для карточек (backdrop-blur)
- Градиентные акценты`,
  },
  {
    id: 'doc-li-notes',
    projectId: 'li-group',
    title: 'Заметки',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-20',
    content: `# Заметки: LI Group

## 20.03 — Встреча с заказчиком
- Одобрен дизайн главной
- Просят добавить секцию "Как это работает" (3 шага)
- Дедлайн лендинга — 30 марта (жёстко)

## 18.03
- Hero секция готова, показал заказчику — ОК
- Нужно доработать мобильную версию hero

## 15.03
- Определились со стеком: Next.js + Supabase
- Supabase выбран из-за встроенной Auth + realtime`,
  },
  // Personal Site
  {
    id: 'doc-my-brief',
    projectId: 'my-site',
    title: 'Бриф',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-10',
    content: `# Personal Site

Минималистичный сайт-портфолио. Проекты, блог, контакты.`,
  },
  {
    id: 'doc-my-notes',
    projectId: 'my-site',
    title: 'Заметки',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-18',
    content: `# Заметки

- Нужен MDX для блога
- Добавить кейсы с картинками
- Open Graph для соцсетей`,
  },
  // Mark2
  {
    id: 'doc-m2-brief',
    projectId: 'mark2',
    title: 'Бриф',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-12',
    content: `# Mark2

Персональный хаб управления жизнью. 5 сфер: Dev, Teaching, Study, Health, Finance.`,
  },
  {
    id: 'doc-m2-arch',
    projectId: 'mark2',
    title: 'Архитектура',
    icon: '\uD83D\uDCC4',
    updatedAt: '2026-03-15',
    content: `# Архитектура Mark2

## Стек
- Electron + React + Tailwind
- Supabase (PostgreSQL + Storage)
- Claude Code CLI через child_process

## Monorepo
- app/desktop — Electron
- app/mobile — React Native
- app/shared — типы
- agents/ — контексты агентов`,
  },
];

const MOCK_CHANGES: MockChange[] = [
  // LI Group
  { id: 'c1', projectId: 'li-group', date: '2026-03-20', message: 'fix: мобильная навигация — бургер-меню' },
  { id: 'c2', projectId: 'li-group', date: '2026-03-19', message: 'feat: подключён CRM endpoint /leads' },
  { id: 'c3', projectId: 'li-group', date: '2026-03-18', message: 'style: hero-секция — новые градиенты' },
  { id: 'c4', projectId: 'li-group', date: '2026-03-17', message: 'feat: блог — базовый список постов' },
  { id: 'c5', projectId: 'li-group', date: '2026-03-16', message: 'fix: форма обратной связи — валидация email' },
  { id: 'c6', projectId: 'li-group', date: '2026-03-15', message: 'chore: обновление зависимостей' },
  { id: 'c7', projectId: 'li-group', date: '2026-03-14', message: 'feat: footer с соц. сетями' },
  { id: 'c8', projectId: 'li-group', date: '2026-03-13', message: 'fix: CI pipeline — node 20' },
  // Personal Site
  { id: 'c9', projectId: 'my-site', date: '2026-03-20', message: 'feat: новая секция "Проекты"' },
  { id: 'c10', projectId: 'my-site', date: '2026-03-18', message: 'style: типографика — Inter + JetBrains Mono' },
  { id: 'c11', projectId: 'my-site', date: '2026-03-16', message: 'feat: тёмная тема — переключатель' },
  { id: 'c12', projectId: 'my-site', date: '2026-03-14', message: 'fix: OG-изображения для Twitter' },
  { id: 'c13', projectId: 'my-site', date: '2026-03-12', message: 'chore: миграция на Next.js 15' },
  { id: 'c14', projectId: 'my-site', date: '2026-03-10', message: 'feat: базовый лейаут сайта' },
  // Mark2
  { id: 'c15', projectId: 'mark2', date: '2026-03-20', message: 'feat: cross-context — auto-summary, fallback' },
  { id: 'c16', projectId: 'mark2', date: '2026-03-19', message: 'feat: история чат-сессий, авто-именование' },
  { id: 'c17', projectId: 'mark2', date: '2026-03-18', message: 'feat: новый layout — header tabs, sidebar' },
  { id: 'c18', projectId: 'mark2', date: '2026-03-17', message: 'feat: hybrid chat — Haiku + Claude Code' },
  { id: 'c19', projectId: 'mark2', date: '2026-03-16', message: 'feat: agent CLAUDE.md + context directories' },
  { id: 'c20', projectId: 'mark2', date: '2026-03-15', message: 'fix: chat panel resize — сохранение ширины' },
  { id: 'c21', projectId: 'mark2', date: '2026-03-14', message: 'feat: Supabase миграции — все таблицы' },
  { id: 'c22', projectId: 'mark2', date: '2026-03-13', message: 'feat: ClaudeBridge — базовый run()' },
  { id: 'c23', projectId: 'mark2', date: '2026-03-12', message: 'chore: pnpm workspaces + shared types' },
  { id: 'c24', projectId: 'mark2', date: '2026-03-11', message: 'feat: Electron скелет приложения' },
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

const STACK_COLORS: Record<string, string> = {
  'Next.js': 'bg-white/10 text-white',
  'Tailwind': 'bg-cyan-900/40 text-cyan-300',
  'Supabase': 'bg-emerald-900/40 text-emerald-300',
  'Electron': 'bg-blue-900/40 text-blue-300',
  'React': 'bg-sky-900/40 text-sky-300',
};

function getProjectTasks(projectId: string): MockTask[] {
  return MOCK_TASKS.filter((t) => t.projectId === projectId);
}

function getProjectDocs(projectId: string): DocFile[] {
  return MOCK_DOCS.filter((d) => d.projectId === projectId);
}

function getProjectChanges(projectId: string): MockChange[] {
  return MOCK_CHANGES.filter((c) => c.projectId === projectId);
}

function taskStats(tasks: MockTask[]) {
  const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
  for (const t of tasks) counts[t.status]++;
  return counts;
}

// --- Simple Markdown Renderer ---

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-neutral-900 border border-neutral-800 rounded-lg p-3 my-3 overflow-x-auto text-xs font-mono text-neutral-300"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-800 px-1.5 py-0.5 rounded text-xs text-neutral-300">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-neutral-200 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-neutral-100 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-neutral-200 font-semibold">$1</strong>')
    // List items
    .replace(/^- (.+)$/gm, '<li class="text-neutral-400 text-sm ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="text-neutral-400 text-sm ml-4 list-decimal">$2</li>')
    // Paragraphs (lines not starting with < or empty)
    .replace(/^(?!<|$)(.+)$/gm, '<p class="text-neutral-400 text-sm leading-relaxed mb-1">$1</p>')
    // Empty lines
    .replace(/^\s*$/gm, '');

  return html;
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'all-tasks'; filter: TaskStatus | 'all' }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'doc-view'; docId: string }
  | { kind: 'change-detail'; changeId: string };

// --- Component ---

export function Dev() {
  const [activeProjectId, setActiveProjectId] = useState<string>(MOCK_PROJECTS[0]?.id ?? '');
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [visibleChanges, setVisibleChanges] = useState(10);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-dev-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});
  const [subtaskChecked, setSubtaskChecked] = useState<Record<string, boolean>>({});
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [docContents, setDocContents] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskEdits, setTaskEdits] = useState<{ title: string; description: string } | null>(null);

  const changesEndRef = useRef<HTMLDivElement>(null);
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const project = MOCK_PROJECTS.find((p) => p.id === activeProjectId);
  const tasks = project ? getProjectTasks(project.id) : [];
  const docs = project ? getProjectDocs(project.id) : [];
  const changes = project ? getProjectChanges(project.id) : [];
  const stats = taskStats(tasks);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setMainView({ kind: 'overview' });
    setVisibleChanges(10);
    setEditingDoc(null);
    setEditingTask(null);
  }, []);

  const handleChangesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        setVisibleChanges((v) => Math.min(v + 10, changes.length));
      }
    },
    [changes.length],
  );

  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-dev-sidebar-width', String(w));
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

  useEffect(() => {
    setVisibleChanges(10);
  }, [activeProjectId]);

  const toggleTaskChecked = useCallback((taskId: string) => {
    setTaskChecked((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const toggleSubtaskChecked = useCallback((subtaskId: string) => {
    setSubtaskChecked((prev) => ({ ...prev, [subtaskId]: !prev[subtaskId] }));
  }, []);

  const sendTaskToChat = useCallback((task: MockTask) => {
    const text = `Выполни задачу: ${task.title}\n${task.description}`;
    // Use the chat API to send a message
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, []);

  const getDocContent = useCallback((docId: string): string => {
    if (docContents[docId] !== undefined) return docContents[docId];
    const doc = MOCK_DOCS.find((d) => d.id === docId);
    return doc?.content ?? '';
  }, [docContents]);

  const saveDocContent = useCallback((docId: string, content: string) => {
    setDocContents((prev) => ({ ...prev, [docId]: content }));
    setEditingDoc(null);
  }, []);

  const getEffectiveStatus = useCallback((task: MockTask): TaskStatus => {
    if (taskChecked[task.id]) return 'done';
    return task.status;
  }, [taskChecked]);

  const isSubtaskDone = useCallback((subtask: SubTask): boolean => {
    if (subtaskChecked[subtask.id] !== undefined) return subtaskChecked[subtask.id];
    return subtask.done;
  }, [subtaskChecked]);

  return (
    <MainLayout agent="dev" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Projects */}
          <div className="px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Projects
          </div>
          <nav className="px-2 space-y-0.5">
            {MOCK_PROJECTS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  activeProjectId === p.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" />
                {p.name}
              </button>
            ))}
          </nav>

          {project && (
            <div className="flex-1 overflow-y-auto flex flex-col mt-2 scrollbar-thin">
              <div className="mx-3 border-t border-neutral-800" />

              {/* Tasks (compact) */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Задачи
                </div>
                <div className="space-y-1">
                  {tasks.slice(0, 4).map((task) => {
                    const effectiveStatus = getEffectiveStatus(task);
                    const pColor = PRIORITY_COLORS[task.priority];
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          setMainView({ kind: 'task-detail', taskId: task.id });
                          setEditingTask(null);
                        }}
                        className={`w-full text-left flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors ${
                          mainView.kind === 'task-detail' && 'taskId' in mainView && mainView.taskId === task.id
                            ? 'bg-neutral-800/50'
                            : ''
                        }`}
                      >
                        <span className={`shrink-0 ${STATUS_COLORS[effectiveStatus]}`}>
                          {effectiveStatus === 'done' ? '\u2705' : effectiveStatus === 'in_progress' ? '\uD83D\uDD04' : '\u23F3'}
                        </span>
                        <span className={`truncate ${effectiveStatus === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-400'}`}>
                          {task.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {tasks.length > 4 && (
                  <button
                    onClick={() => setMainView({ kind: 'all-tasks', filter: 'all' })}
                    className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    ... Все задачи ({tasks.length})
                  </button>
                )}
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* Documentation */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Документация
                </div>
                <div className="space-y-0.5">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setMainView({ kind: 'doc-view', docId: doc.id });
                        setEditingDoc(null);
                      }}
                      className={`w-full text-left flex items-center gap-1.5 text-xs py-1 px-2 rounded hover:bg-neutral-800/50 transition-colors ${
                        mainView.kind === 'doc-view' && 'docId' in mainView && mainView.docId === doc.id
                          ? 'bg-neutral-800/50 text-neutral-200'
                          : 'text-neutral-400'
                      }`}
                    >
                      <span className="shrink-0">{doc.icon}</span>
                      <span className="truncate">{doc.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* Changes */}
              <div className="flex-1 overflow-hidden flex flex-col px-3 pt-3 pb-2 min-h-0">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Последние изменения
                </div>
                <div
                  className="flex-1 overflow-y-auto space-y-0.5 min-h-0 scrollbar-thin"
                  onScroll={handleChangesScroll}
                >
                  {changes.slice(0, visibleChanges).map((change) => (
                    <button
                      key={change.id}
                      onClick={() => setMainView({ kind: 'change-detail', changeId: change.id })}
                      className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                    >
                      <span className="text-neutral-600 mr-1.5 text-[10px]">
                        {change.date.slice(5)}
                      </span>
                      <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors">
                        {change.message}
                      </span>
                    </button>
                  ))}
                  <div ref={changesEndRef} />
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
          {project && mainView.kind === 'overview' && (
            <ProjectOverview
              project={project}
              tasks={tasks}
              changes={changes}
              stats={stats}
              onViewAllTasks={() => setMainView({ kind: 'all-tasks', filter: 'all' })}
              onViewTask={(id) => { setMainView({ kind: 'task-detail', taskId: id }); setEditingTask(null); }}
              getEffectiveStatus={getEffectiveStatus}
            />
          )}
          {project && mainView.kind === 'all-tasks' && (
            <AllTasksView
              project={project}
              tasks={tasks}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'all-tasks', filter: f })}
              onViewTask={(id) => { setMainView({ kind: 'task-detail', taskId: id }); setEditingTask(null); }}
              toggleTaskChecked={toggleTaskChecked}
              taskChecked={taskChecked}
              getEffectiveStatus={getEffectiveStatus}
              sendTaskToChat={sendTaskToChat}
            />
          )}
          {project && mainView.kind === 'task-detail' && (
            <TaskDetailView
              task={tasks.find((t) => t.id === mainView.taskId)}
              onBack={() => setMainView({ kind: 'all-tasks', filter: 'all' })}
              toggleTaskChecked={toggleTaskChecked}
              taskChecked={taskChecked}
              toggleSubtaskChecked={toggleSubtaskChecked}
              isSubtaskDone={isSubtaskDone}
              sendTaskToChat={sendTaskToChat}
              getEffectiveStatus={getEffectiveStatus}
              isEditing={editingTask === mainView.taskId}
              onToggleEdit={() => {
                if (editingTask === mainView.taskId) {
                  setEditingTask(null);
                  setTaskEdits(null);
                } else {
                  const task = tasks.find((t) => t.id === mainView.taskId);
                  if (task) {
                    setEditingTask(mainView.taskId);
                    setTaskEdits({ title: task.title, description: task.description });
                  }
                }
              }}
              taskEdits={taskEdits}
              onTaskEditsChange={setTaskEdits}
            />
          )}
          {project && mainView.kind === 'doc-view' && (
            <DocDetailView
              doc={docs.find((d) => d.id === mainView.docId)}
              content={getDocContent(mainView.docId)}
              onBack={() => setMainView({ kind: 'overview' })}
              isEditing={editingDoc === mainView.docId}
              onToggleEdit={() => setEditingDoc(editingDoc === mainView.docId ? null : mainView.docId)}
              onSave={(content) => saveDocContent(mainView.docId, content)}
            />
          )}
          {project && mainView.kind === 'change-detail' && (
            <ChangeDetailView
              change={changes.find((c) => c.id === mainView.changeId)}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function ProjectOverview({
  project,
  tasks,
  changes,
  stats,
  onViewAllTasks,
  onViewTask,
  getEffectiveStatus,
}: {
  project: MockProject;
  tasks: MockTask[];
  changes: MockChange[];
  stats: Record<string, number>;
  onViewAllTasks: () => void;
  onViewTask: (id: string) => void;
  getEffectiveStatus: (task: MockTask) => TaskStatus;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
      <p className="text-neutral-400 text-sm mb-6">{project.description}</p>

      {/* Stack */}
      <div className="flex flex-wrap gap-2 mb-6">
        {project.stack.map((tech) => (
          <span
            key={tech}
            className={`text-xs px-2 py-1 rounded font-medium ${
              STACK_COLORS[tech] ?? 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Links */}
      <div className="flex gap-4 mb-8 text-sm text-neutral-500">
        {project.repoUrl && (
          <span>
            <span className="text-neutral-600 mr-1">Repo:</span>
            <span className="text-neutral-400">{project.repoUrl.replace('https://github.com/', '')}</span>
          </span>
        )}
        {project.deployUrl && (
          <span>
            <span className="text-neutral-600 mr-1">Deploy:</span>
            <span className="text-neutral-400">{project.deployUrl.replace('https://', '')}</span>
          </span>
        )}
      </div>

      {/* Task stats */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-300">Задачи</h2>
          <button
            onClick={onViewAllTasks}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Все задачи &rarr;
          </button>
        </div>
        <div className="flex gap-3 mb-4">
          <StatBadge label="Todo" count={stats.todo} color="text-yellow-400 bg-yellow-400/10" />
          <StatBadge label="In Progress" count={stats.in_progress} color="text-blue-400 bg-blue-400/10" />
          <StatBadge label="Done" count={stats.done} color="text-emerald-400 bg-emerald-400/10" />
        </div>

        {/* Recent tasks */}
        <div className="space-y-1.5">
          {tasks.slice(0, 5).map((task) => {
            const pColor = PRIORITY_COLORS[task.priority];
            const effectiveStatus = getEffectiveStatus(task);
            return (
              <button
                key={task.id}
                onClick={() => onViewTask(task.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border-l-2 ${pColor.border} bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors`}
              >
                <span className={`text-sm shrink-0 ${STATUS_COLORS[effectiveStatus]}`}>
                  {effectiveStatus === 'done' ? '\u2705' : effectiveStatus === 'in_progress' ? '\uD83D\uDD04' : '\u23F3'}
                </span>
                <span className={`text-sm flex-1 ${effectiveStatus === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>
                  {task.title}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${pColor.badge}`}>
                  {pColor.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent changes */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последние изменения</h2>
        <div className="space-y-2">
          {changes.slice(0, 5).map((change) => (
            <div key={change.id} className="flex items-baseline gap-3 text-sm">
              <span className="text-neutral-600 text-xs shrink-0">{change.date}</span>
              <span className="text-neutral-400">{change.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg ${color}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function AllTasksView({
  project,
  tasks,
  filter,
  onFilterChange,
  onViewTask,
  toggleTaskChecked,
  taskChecked,
  getEffectiveStatus,
  sendTaskToChat,
}: {
  project: MockProject;
  tasks: MockTask[];
  filter: TaskStatus | 'all';
  onFilterChange: (f: TaskStatus | 'all') => void;
  onViewTask: (id: string) => void;
  toggleTaskChecked: (id: string) => void;
  taskChecked: Record<string, boolean>;
  getEffectiveStatus: (task: MockTask) => TaskStatus;
  sendTaskToChat: (task: MockTask) => void;
}) {
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => {
    const effective = getEffectiveStatus(t);
    return effective === filter;
  });

  const filters: Array<{ value: TaskStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'done', label: 'Готово' },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">Все задачи</h2>

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

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map((task) => {
          const pColor = PRIORITY_COLORS[task.priority];
          const effectiveStatus = getEffectiveStatus(task);
          const isDone = effectiveStatus === 'done';
          const doneSubtasks = task.subtasks.filter((s) => s.done).length;

          return (
            <div
              key={task.id}
              className={`border-l-2 ${pColor.border} bg-neutral-900/50 rounded-lg hover:bg-neutral-800/30 transition-colors`}
            >
              <div className="flex items-center gap-3 px-3 py-3">
                {/* Checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleTaskChecked(task.id); }}
                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  {isDone && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Title + meta */}
                <button
                  onClick={() => onViewTask(task.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className={`text-sm ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] ${STATUS_COLORS[effectiveStatus]}`}>
                      {STATUS_LABEL[effectiveStatus]}
                    </span>
                    {task.subtasks.length > 0 && (
                      <span className="text-[10px] text-neutral-600">
                        {doneSubtasks}/{task.subtasks.length} subtasks
                      </span>
                    )}
                    {task.deadline && (
                      <span className="text-[10px] text-neutral-600">{task.deadline}</span>
                    )}
                  </div>
                </button>

                {/* Priority badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${pColor.badge}`}>
                  {pColor.label}
                </span>

                {/* Send to chat */}
                <button
                  onClick={(e) => { e.stopPropagation(); sendTaskToChat(task); }}
                  className="text-neutral-600 hover:text-blue-400 transition-colors shrink-0"
                  title="Отправить в чат"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет задач с таким статусом</div>
        )}
      </div>
    </div>
  );
}

function TaskDetailView({
  task,
  onBack,
  toggleTaskChecked,
  taskChecked,
  toggleSubtaskChecked,
  isSubtaskDone,
  sendTaskToChat,
  getEffectiveStatus,
  isEditing,
  onToggleEdit,
  taskEdits,
  onTaskEditsChange,
}: {
  task: MockTask | undefined;
  onBack: () => void;
  toggleTaskChecked: (id: string) => void;
  taskChecked: Record<string, boolean>;
  toggleSubtaskChecked: (id: string) => void;
  isSubtaskDone: (subtask: SubTask) => boolean;
  sendTaskToChat: (task: MockTask) => void;
  getEffectiveStatus: (task: MockTask) => TaskStatus;
  isEditing: boolean;
  onToggleEdit: () => void;
  taskEdits: { title: string; description: string } | null;
  onTaskEditsChange: (edits: { title: string; description: string } | null) => void;
}) {
  if (!task) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Задача не найдена</p>
      </div>
    );
  }

  const pColor = PRIORITY_COLORS[task.priority];
  const effectiveStatus = getEffectiveStatus(task);
  const isDone = effectiveStatus === 'done';

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Все задачи
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => toggleTaskChecked(task.id)}
          className={`w-5 h-5 mt-1 rounded border shrink-0 flex items-center justify-center transition-colors ${
            isDone
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-neutral-600 hover:border-neutral-400'
          }`}
        >
          {isDone && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          {isEditing && taskEdits ? (
            <input
              type="text"
              value={taskEdits.title}
              onChange={(e) => onTaskEditsChange({ ...taskEdits, title: e.target.value })}
              className="w-full text-xl font-bold bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-100 focus:outline-none focus:border-neutral-500"
            />
          ) : (
            <h1 className={`text-xl font-bold ${isDone ? 'text-neutral-500 line-through' : ''}`}>
              {task.title}
            </h1>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${pColor.badge}`}>
              {pColor.label}
            </span>
            <span className={`text-xs ${STATUS_COLORS[effectiveStatus]}`}>
              {STATUS_LABEL[effectiveStatus]}
            </span>
            <span className="text-xs text-neutral-600">
              Создана: {task.createdAt}
            </span>
            {task.deadline && (
              <span className="text-xs text-neutral-600">
                Дедлайн: {task.deadline}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">Контекст</h2>
        {isEditing && taskEdits ? (
          <textarea
            value={taskEdits.description}
            onChange={(e) => onTaskEditsChange({ ...taskEdits, description: e.target.value })}
            rows={4}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500 resize-none"
          />
        ) : (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3">
            <p className="text-sm text-neutral-400 leading-relaxed">{task.description}</p>
          </div>
        )}
      </div>

      {/* Subtasks */}
      {task.subtasks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-2">
            Подзадачи ({task.subtasks.filter((s) => isSubtaskDone(s)).length}/{task.subtasks.length})
          </h2>
          <div className="space-y-1">
            {task.subtasks.map((sub) => {
              const done = isSubtaskDone(sub);
              return (
                <button
                  key={sub.id}
                  onClick={() => toggleSubtaskChecked(sub.id)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/30 transition-colors"
                >
                  <span
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      done ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600'
                    }`}
                  >
                    {done && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${done ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>
                    {sub.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* History (mock) */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">История</h2>
        <div className="space-y-1.5 text-xs text-neutral-500">
          <div className="flex gap-2">
            <span className="text-neutral-600 shrink-0">{task.createdAt}</span>
            <span>Задача создана</span>
          </div>
          {task.status === 'in_progress' && (
            <div className="flex gap-2">
              <span className="text-neutral-600 shrink-0">{task.createdAt}</span>
              <span>Статус изменён на "В работе"</span>
            </div>
          )}
          {task.status === 'done' && (
            <div className="flex gap-2">
              <span className="text-neutral-600 shrink-0">{task.deadline ?? task.createdAt}</span>
              <span>Задача завершена</span>
            </div>
          )}
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
        <button
          onClick={onToggleEdit}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isEditing
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          {isEditing ? 'Сохранить' : 'Редактировать'}
        </button>
      </div>
    </div>
  );
}

function DocDetailView({
  doc,
  content,
  onBack,
  isEditing,
  onToggleEdit,
  onSave,
}: {
  doc: DocFile | undefined;
  content: string;
  onBack: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (content: string) => void;
}) {
  const [editContent, setEditContent] = useState(content);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  if (!doc) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Документ не найден</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад
      </button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">{doc.icon} {doc.title}</h1>
          <div className="text-xs text-neutral-600 mt-1">
            Обновлено: {doc.updatedAt}
            <span className="ml-3">{Math.round(content.length / 1024 * 10) / 10} KB</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <button
              onClick={() => { onSave(editContent); }}
              className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              Сохранить
            </button>
          )}
          <button
            onClick={onToggleEdit}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isEditing
                ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {isEditing ? 'Отмена' : 'Редактировать'}
          </button>
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full h-[calc(100vh-250px)] bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-300 font-mono focus:outline-none focus:border-neutral-500 resize-none scrollbar-thin"
        />
      ) : (
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </div>
  );
}

function ChangeDetailView({
  change,
  onBack,
}: {
  change: MockChange | undefined;
  onBack: () => void;
}) {
  if (!change) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Изменение не найдено</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>
      <h1 className="text-xl font-bold mb-2">{change.message}</h1>
      <div className="text-neutral-500 text-sm mb-6">{change.date}</div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <p className="text-neutral-400 text-sm">Детали коммита будут загружены из Git...</p>
        <div className="mt-4 text-xs text-neutral-600 font-mono">
          commit {change.id.padEnd(40, '0').slice(0, 8)}...
        </div>
      </div>
    </div>
  );
}
