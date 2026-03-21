import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus } from '@mark2/shared';

// --- Mock Types ---

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

interface MockTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: number;
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
    description: 'Корпоративный сайт для LI Group. Лендинг + блог + CRM-интеграция.',
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
  { id: 't1', projectId: 'li-group', title: 'Вёрстка главной страницы', status: 'done', priority: 1 },
  { id: 't2', projectId: 'li-group', title: 'Интеграция CRM API', status: 'in_progress', priority: 0 },
  { id: 't3', projectId: 'li-group', title: 'SEO-оптимизация', status: 'todo', priority: 0 },
  { id: 't4', projectId: 'li-group', title: 'Блог: система тегов', status: 'todo', priority: 0 },
  { id: 't5', projectId: 'li-group', title: 'Мобильная адаптация', status: 'in_progress', priority: 1 },
  { id: 't6', projectId: 'li-group', title: 'Форма обратной связи', status: 'done', priority: 0 },
  { id: 't7', projectId: 'li-group', title: 'Анимации hero-секции', status: 'todo', priority: 0 },
  { id: 't8', projectId: 'li-group', title: 'Настройка CI/CD', status: 'done', priority: 0 },
  // Personal Site
  { id: 't9', projectId: 'my-site', title: 'Редизайн портфолио', status: 'in_progress', priority: 1 },
  { id: 't10', projectId: 'my-site', title: 'Блог на MDX', status: 'todo', priority: 0 },
  { id: 't11', projectId: 'my-site', title: 'Тёмная тема', status: 'done', priority: 0 },
  { id: 't12', projectId: 'my-site', title: 'Страница контактов', status: 'todo', priority: 0 },
  { id: 't13', projectId: 'my-site', title: 'Open Graph мета-теги', status: 'done', priority: 0 },
  // Mark2
  { id: 't14', projectId: 'mark2', title: 'Claude Bridge: streaming', status: 'in_progress', priority: 1 },
  { id: 't15', projectId: 'mark2', title: 'UI: раздел Dev', status: 'in_progress', priority: 1 },
  { id: 't16', projectId: 'mark2', title: 'Supabase миграции', status: 'done', priority: 0 },
  { id: 't17', projectId: 'mark2', title: 'Чат с агентами', status: 'done', priority: 0 },
  { id: 't18', projectId: 'mark2', title: 'Раздел Teaching', status: 'todo', priority: 0 },
  { id: 't19', projectId: 'mark2', title: 'Раздел Finance', status: 'todo', priority: 0 },
  { id: 't20', projectId: 'mark2', title: 'Синхронизация Supabase', status: 'todo', priority: 0 },
  { id: 't21', projectId: 'mark2', title: 'Settings: выбор модели', status: 'todo', priority: 0 },
  { id: 't22', projectId: 'mark2', title: 'Мобильное приложение: скелет', status: 'todo', priority: 0 },
  { id: 't23', projectId: 'mark2', title: 'Интеграция Apple Calendar', status: 'todo', priority: 0 },
  { id: 't24', projectId: 'mark2', title: 'Dashboard: сводка по сферам', status: 'in_progress', priority: 0 },
  { id: 't25', projectId: 'mark2', title: 'Агент: авто-summary сессий', status: 'done', priority: 0 },
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
  { id: 'c9', projectId: 'my-site', date: '2026-03-20', message: 'feat: новая секция «Проекты»' },
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

const STATUS_ICON: Record<TaskStatus, string> = {
  done: '\u2705',
  in_progress: '\uD83D\uDD04',
  todo: '\u23F3',
  cancelled: '\u274C',
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

function getProjectChanges(projectId: string): MockChange[] {
  return MOCK_CHANGES.filter((c) => c.projectId === projectId);
}

function taskStats(tasks: MockTask[]) {
  const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
  for (const t of tasks) counts[t.status]++;
  return counts;
}

// --- Views ---

type MainView = { kind: 'overview' } | { kind: 'all-tasks'; filter: TaskStatus | 'all' } | { kind: 'change-detail'; changeId: string };

// --- Component ---

export function Dev() {
  const [activeProjectId, setActiveProjectId] = useState<string>(MOCK_PROJECTS[MOCK_PROJECTS.length - 1].id);
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [visibleChanges, setVisibleChanges] = useState(10);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const changesEndRef = useRef<HTMLDivElement>(null);
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const project = MOCK_PROJECTS.find((p) => p.id === activeProjectId);
  const tasks = project ? getProjectTasks(project.id) : [];
  const changes = project ? getProjectChanges(project.id) : [];
  const stats = taskStats(tasks);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setMainView({ kind: 'overview' });
    setVisibleChanges(10);
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

  // Sidebar drag resize
  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-sidebar-width', String(w));
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

  // Reset visible changes when project changes
  useEffect(() => {
    setVisibleChanges(10);
  }, [activeProjectId]);

  return (
    <MainLayout agent="dev" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Level 1: Projects */}
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

          {/* Level 2: Project details (when project selected) */}
          {project && (
            <div className="flex-1 overflow-hidden flex flex-col mt-2">
              {/* Divider */}
              <div className="mx-3 border-t border-neutral-800" />

              {/* Documentation */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Документация
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        STACK_COLORS[tech] ?? 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <div className="space-y-0.5 text-[11px] text-neutral-500">
                  {project.repoUrl && (
                    <div className="truncate" title={project.repoUrl}>
                      <span className="text-neutral-600 mr-1">repo:</span>
                      <span className="text-neutral-400">{project.repoUrl.replace('https://github.com/', '')}</span>
                    </div>
                  )}
                  {project.deployUrl && (
                    <div className="truncate" title={project.deployUrl}>
                      <span className="text-neutral-600 mr-1">deploy:</span>
                      <span className="text-neutral-400">{project.deployUrl.replace('https://', '')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="mx-3 border-t border-neutral-800" />

              {/* Tasks */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Задачи
                </div>
                <div className="space-y-1">
                  {tasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-1.5 text-xs text-neutral-400"
                    >
                      <span className="text-[11px] shrink-0">{STATUS_ICON[task.status]}</span>
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
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

              {/* Divider */}
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
            <ProjectOverview project={project} tasks={tasks} changes={changes} stats={stats} />
          )}
          {project && mainView.kind === 'all-tasks' && (
            <AllTasksView
              project={project}
              tasks={tasks}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'all-tasks', filter: f })}
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
}: {
  project: MockProject;
  tasks: MockTask[];
  changes: MockChange[];
  stats: Record<string, number>;
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
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Статистика задач</h2>
        <div className="flex gap-3">
          <StatBadge label="Todo" count={stats.todo} color="text-yellow-400 bg-yellow-400/10" />
          <StatBadge label="In Progress" count={stats.in_progress} color="text-blue-400 bg-blue-400/10" />
          <StatBadge label="Done" count={stats.done} color="text-emerald-400 bg-emerald-400/10" />
          {stats.cancelled > 0 && (
            <StatBadge label="Cancelled" count={stats.cancelled} color="text-red-400 bg-red-400/10" />
          )}
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
}: {
  project: MockProject;
  tasks: MockTask[];
  filter: TaskStatus | 'all';
  onFilterChange: (f: TaskStatus | 'all') => void;
}) {
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const filters: Array<{ value: TaskStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
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
      <div className="space-y-1">
        {filtered.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-neutral-800/30 transition-colors"
          >
            <span className="text-sm shrink-0">{STATUS_ICON[task.status]}</span>
            <span className="text-sm text-neutral-300 flex-1">{task.title}</span>
            <span className="text-[10px] text-neutral-600 uppercase">{task.status.replace('_', ' ')}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет задач с таким статусом</div>
        )}
      </div>
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
