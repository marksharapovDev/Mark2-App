import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useSidebar } from '../context/sidebar-context';
import type { DevProjectV2, DevTask, DevTaskStatus, DevTaskPriority, DevTimeEntry } from '@mark2/shared';
import { Plus, ArrowLeft, Play, Square, Clock, ChevronDown, ChevronRight, GripVertical, Send, Trash2, ExternalLink, FileText, Calendar, ClipboardList, ListFilter, FolderOpen, Folder, File, Code, Eye, MoreVertical, RefreshCw } from 'lucide-react';

// --- Constants ---

const STATUS_COLUMNS: { status: DevTaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'done', label: 'Готово' },
];

const PROJECT_STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  paused: 'bg-yellow-500',
  completed: 'bg-neutral-500',
  cancelled: 'bg-red-500',
};

const PRIORITY_BADGE: Record<DevTaskPriority, { cls: string; label: string }> = {
  urgent: { cls: 'bg-red-500/20 text-red-400', label: 'Urgent' },
  high: { cls: 'bg-orange-500/20 text-orange-400', label: 'High' },
  medium: { cls: 'bg-blue-500/20 text-blue-400', label: 'Medium' },
  low: { cls: 'bg-neutral-700/50 text-neutral-400', label: 'Low' },
};

const PRIORITY_DOT: Record<DevTaskPriority, string> = {
  urgent: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-neutral-500',
};

const STATUS_BADGE: Record<DevTaskStatus, { cls: string; label: string }> = {
  todo: { cls: 'bg-neutral-700/50 text-neutral-400', label: 'Todo' },
  in_progress: { cls: 'bg-blue-500/20 text-blue-400', label: 'В работе' },
  done: { cls: 'bg-emerald-500/20 text-emerald-400', label: 'Готово' },
  deferred: { cls: 'bg-yellow-500/20 text-yellow-400', label: 'Отложено' },
};

const PRIORITY_ORDER: Record<DevTaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PROJECT_STATUSES: { value: DevProjectV2['status']; label: string }[] = [
  { value: 'active', label: 'Активный' },
  { value: 'paused', label: 'На паузе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

type ProjectTab = 'kanban' | 'docs' | 'files';

// --- Helpers ---

function formatMinutes(m: number): string {
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}ч ${min}м` : `${h}ч`;
}

function deadlineInfo(deadline: string | null): { label: string; cls: string; diff: number } | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  const diff = Math.floor((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Просрочено', cls: 'text-red-400', diff };
  if (diff === 0) return { label: 'Сегодня', cls: 'text-yellow-400', diff };
  if (diff <= 3) return { label: deadline.slice(5), cls: 'text-orange-400', diff };
  return { label: deadline.slice(5), cls: 'text-neutral-600', diff };
}

function daysLeftLabel(diff: number): string {
  if (diff < 0) return `${Math.abs(diff)}д просрочено`;
  if (diff === 0) return 'сегодня';
  if (diff === 1) return '1 день';
  if (diff <= 4) return `${diff} дня`;
  return `${diff} дней`;
}

// --- Views ---

type MainView =
  | { kind: 'project' }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'tasks-list' };

// --- Component ---

export function Dev() {
  const [projects, setProjects] = useState<DevProjectV2[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [allProjectsTasks, setAllProjectsTasks] = useState<DevTask[]>([]);
  const [mainView, setMainView] = useState<MainView>({ kind: 'project' });
  const [loading, setLoading] = useState(true);
  const [deferredOpen, setDeferredOpen] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectTab, setProjectTab] = useState<ProjectTab>('kanban');
  const [timeEntries, setTimeEntries] = useState<DevTimeEntry[]>([]);

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-dev-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const { leftCollapsed, setLeftKey } = useSidebar();
  useEffect(() => { setLeftKey('dev'); }, [setLeftKey]);
  const isDragging = useRef(false);

  const project = projects.find((p) => p.id === activeProjectId);

  // --- Data loading ---

  const loadProjects = useCallback(async () => {
    const data = await window.db.projects.list();
    setProjects(data);
    return data;
  }, []);

  const loadTasks = useCallback(async (projectId: string) => {
    const data = await window.db.dev.tasks.list(projectId);
    setTasks(data);
  }, []);

  const loadAllTasks = useCallback(async (projectsList: DevProjectV2[]) => {
    const all: DevTask[] = [];
    for (const p of projectsList) {
      try {
        const t = await window.db.dev.tasks.list(p.id);
        all.push(...t);
      } catch { /* skip */ }
    }
    setAllProjectsTasks(all);
  }, []);

  const loadTimeEntries = useCallback(async (projectId: string) => {
    try {
      const data = await window.db.dev.time.list(undefined, projectId);
      setTimeEntries(data);
    } catch { setTimeEntries([]); }
  }, []);

  useEffect(() => {
    loadProjects().then((ps) => {
      if (ps.length > 0 && ps[0]) {
        setActiveProjectId(ps[0].id);
        loadTasks(ps[0].id);
        loadTimeEntries(ps[0].id);
      }
      loadAllTasks(ps);
    }).finally(() => setLoading(false));
  }, [loadProjects, loadTasks, loadAllTasks, loadTimeEntries]);

  useEffect(() => {
    if (activeProjectId) {
      loadTasks(activeProjectId);
      loadTimeEntries(activeProjectId);
    }
  }, [activeProjectId, loadTasks, loadTimeEntries]);

  // React to data-changed events
  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('projects')) loadProjects();
      if ((entities.includes('dev-tasks') || entities.includes('dev-time')) && activeProjectId) {
        loadTasks(activeProjectId);
        loadTimeEntries(activeProjectId);
      }
    });
  }, [loadProjects, loadTasks, loadTimeEntries, activeProjectId]);

  // --- Sidebar data ---

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return allProjectsTasks
      .filter((t) => t.deadline && t.status !== 'done' && t.status !== 'deferred')
      .filter((t) => {
        const d = new Date(t.deadline + 'T00:00:00');
        return d <= week;
      })
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  }, [allProjectsTasks]);

  const inProgressTasks = useMemo(() => {
    return allProjectsTasks.filter((t) => t.status === 'in_progress');
  }, [allProjectsTasks]);

  // --- Project actions ---

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setMainView({ kind: 'project' });
    setProjectTab('kanban');
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    const slug = newProjectName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
    const created = await window.db.projects.create({ name: newProjectName, slug, status: 'active', stack: {} });
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setNewProjectName('');
    setAddingProject(false);
  }, [newProjectName]);

  const handleUpdateProject = useCallback(async (id: string, data: Record<string, unknown>) => {
    const updated = await window.db.projects.update(id, data);
    setProjects((prev) => prev.map((p) => p.id === id ? updated : p));
  }, []);

  // --- Task actions ---

  const handleUpdateTaskStatus = useCallback(async (taskId: string, status: DevTaskStatus) => {
    await window.db.dev.tasks.update(taskId, { status });
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
  }, []);

  // --- Drag & Drop ---

  const dragItem = useRef<string | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    dragItem.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent, targetStatus: DevTaskStatus) => {
    e.preventDefault();
    const taskId = dragItem.current;
    if (!taskId) return;
    dragItem.current = null;
    handleUpdateTaskStatus(taskId, targetStatus);
  }, [handleUpdateTaskStatus]);

  // --- Sidebar resize ---

  const handleSidebarDragStart = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const w = Math.min(400, Math.max(200, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-dev-sidebar-width', String(w));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // --- Computed ---

  const selectedTask = mainView.kind === 'task-detail'
    ? tasks.find((t) => t.id === mainView.taskId)
    : null;

  const columnTasks = (status: DevTaskStatus) => tasks.filter((t) => t.status === status);
  const deferredTasks = tasks.filter((t) => t.status === 'deferred');

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const totalTimeSpent = timeEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  // Project name lookup for sidebar
  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  return (
    <MainLayout agent="dev" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftCollapsed ? 0 : sidebarWidth }}
        >
          <div className="px-3 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Проекты</span>
            <button
              onClick={() => setAddingProject(true)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Добавить проект"
            >
              <Plus size={14} />
            </button>
          </div>

          {addingProject && (
            <div className="px-3 pb-2">
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                  if (e.key === 'Escape') { setAddingProject(false); setNewProjectName(''); }
                }}
                placeholder="Название проекта..."
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
              />
            </div>
          )}

          <nav className="px-2 space-y-0.5">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                  activeProjectId === p.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${PROJECT_STATUS_DOT[p.status] ?? 'bg-neutral-600'}`} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar sections */}
          <div className="flex-1 overflow-y-auto scrollbar-thin mt-1">
            {/* Project summary */}
            {project && (
              <>
                <div className="mx-3 border-t border-neutral-800" />
                <div className="px-3 pt-3 pb-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Сводка проекта</div>
                  <div className="space-y-1.5 text-xs">
                    {project.clientName && (
                      <div className="flex justify-between py-0.5 px-1">
                        <span className="text-neutral-600">Клиент</span>
                        <span className="text-neutral-300">{project.clientName}</span>
                      </div>
                    )}
                    {project.deadline && (() => {
                      const dl = deadlineInfo(project.deadline);
                      return (
                        <div className="flex justify-between py-0.5 px-1">
                          <span className="text-neutral-600">Дедлайн</span>
                          <span className={dl?.cls ?? 'text-neutral-300'}>
                            {project.deadline.slice(5)} {dl ? `(${daysLeftLabel(dl.diff)})` : ''}
                          </span>
                        </div>
                      );
                    })()}
                    {project.budget && (
                      <div className="flex justify-between py-0.5 px-1">
                        <span className="text-neutral-600">Бюджет</span>
                        <span className="text-neutral-300">{Number(project.budget).toLocaleString('ru')} ₽</span>
                      </div>
                    )}
                    {/* Progress */}
                    <div className="px-1 pt-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-neutral-600">Прогресс</span>
                        <span className="text-neutral-400">{doneCount} из {totalCount}</span>
                      </div>
                      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                    {totalTimeSpent > 0 && (
                      <div className="flex justify-between py-0.5 px-1">
                        <span className="text-neutral-600">Время</span>
                        <span className="text-neutral-300 flex items-center gap-1"><Clock size={10} />{formatMinutes(totalTimeSpent)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Sidebar tasks for selected project */}
            {project && (
              <>
                <div className="mx-3 border-t border-neutral-800" />
                <div className="px-3 pt-3 pb-2">
                  <button
                    onClick={() => setMainView({ kind: 'tasks-list' })}
                    className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1 hover:text-neutral-300 transition-colors w-full text-left"
                  >
                    <ListFilter size={10} />
                    Задачи
                    {totalCount > 0 && <span className="text-neutral-600 ml-auto normal-case font-normal">{totalCount}</span>}
                  </button>
                  {tasks.length === 0 ? (
                    <div className="text-[10px] text-neutral-700 px-1">Нет задач</div>
                  ) : (
                    <SidebarTasksList
                      tasks={tasks}
                      onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
                    />
                  )}
                </div>
              </>
            )}

            {/* Upcoming deadlines */}
            {upcomingDeadlines.length > 0 && (
              <>
                <div className="mx-3 border-t border-neutral-800" />
                <div className="px-3 pt-3 pb-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Ближайшие дедлайны</div>
                  <div className="space-y-0.5">
                    {upcomingDeadlines.slice(0, 6).map((t) => {
                      const dl = deadlineInfo(t.deadline);
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveProjectId(t.projectId);
                            setMainView({ kind: 'task-detail', taskId: t.id });
                          }}
                          className="w-full text-left py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors flex items-center gap-1.5"
                        >
                          <span className="text-xs text-neutral-400 truncate flex-1">{t.title}</span>
                          <span className={`text-[10px] shrink-0 ${dl?.cls ?? 'text-neutral-600'}`}>{t.deadline?.slice(5)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* In progress */}
            {inProgressTasks.length > 0 && (
              <>
                <div className="mx-3 border-t border-neutral-800" />
                <div className="px-3 pt-3 pb-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">В работе</div>
                  <div className="space-y-0.5">
                    {inProgressTasks.slice(0, 6).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setActiveProjectId(t.projectId);
                          setMainView({ kind: 'task-detail', taskId: t.id });
                        }}
                        className="w-full text-left py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors"
                      >
                        <div className="text-xs text-neutral-300 truncate">{t.title}</div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                          <span>{projectNameById[t.projectId] ?? ''}</span>
                          {t.timeSpentMinutes > 0 && (
                            <span className="flex items-center gap-0.5"><Clock size={8} />{formatMinutes(t.timeSpentMinutes)}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {!leftCollapsed && (
          <div
            onMouseDown={handleSidebarDragStart}
            className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
          />
        )}

        {/* === MAIN === */}
        <main className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full text-neutral-500">Загрузка...</div>
          )}

          {!loading && !project && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <p className="text-lg mb-2">Нет проектов</p>
              <p className="text-sm">Создайте первый проект через кнопку "+" или чат</p>
            </div>
          )}

          {!loading && project && mainView.kind === 'project' && (
            <div className="flex flex-col h-full">
              {/* Project Header */}
              <ProjectHeader
                project={project}
                onUpdate={(data) => handleUpdateProject(project.id, data)}
              />

              {/* Tabs */}
              <div className="border-b border-neutral-800 px-6 flex gap-1">
                {([
                  { key: 'kanban' as const, label: 'Канбан' },
                  { key: 'docs' as const, label: 'Документация' },
                  { key: 'files' as const, label: 'Файлы' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProjectTab(tab.key)}
                    className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                      projectTab === tab.key
                        ? 'border-blue-500 text-neutral-200'
                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {projectTab === 'kanban' && (
                <div className="flex-1 overflow-x-auto p-4">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs text-neutral-600">{totalCount} задач</span>
                    <button
                      onClick={() => setMainView({ kind: 'tasks-list' })}
                      className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      Все задачи &rarr;
                    </button>
                  </div>
                  <div className="flex gap-4 h-full min-w-0">
                    {STATUS_COLUMNS.map((col) => (
                      <KanbanColumn
                        key={col.status}
                        status={col.status}
                        label={col.label}
                        tasks={columnTasks(col.status)}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
                      />
                    ))}
                  </div>

                  {/* Deferred section */}
                  {deferredTasks.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setDeferredOpen(!deferredOpen)}
                        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-2"
                      >
                        {deferredOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Отложено ({deferredTasks.length})
                      </button>
                      {deferredOpen && (
                        <div className="flex flex-wrap gap-2">
                          {deferredTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onClick={() => setMainView({ kind: 'task-detail', taskId: task.id })}
                              onDragStart={onDragStart}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {projectTab === 'docs' && (
                <ProjectDocs project={project} onUpdate={(data) => handleUpdateProject(project.id, data)} />
              )}

              {projectTab === 'files' && (
                <ProjectFiles project={project} onUpdate={(data) => handleUpdateProject(project.id, data)} />
              )}
            </div>
          )}

          {!loading && project && mainView.kind === 'task-detail' && selectedTask && (
            <TaskDetailView
              task={selectedTask}
              project={project}
              onBack={() => setMainView({ kind: 'project' })}
              onUpdate={async (data) => {
                const updated = await window.db.dev.tasks.update(selectedTask.id, data);
                setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
              }}
              onDelete={async () => {
                await window.db.dev.tasks.delete(selectedTask.id);
                setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
                setMainView({ kind: 'project' });
              }}
            />
          )}

          {!loading && project && mainView.kind === 'tasks-list' && (
            <TasksListView
              project={project}
              tasks={tasks}
              onBack={() => setMainView({ kind: 'project' })}
              onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
              onCreateTask={async (data) => {
                const created = await window.db.dev.tasks.create({ ...data, projectId: project.id });
                setTasks((prev) => [...prev, created]);
              }}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Project Header ---

function ProjectHeader({ project, onUpdate }: {
  project: DevProjectV2;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(project.description ?? '');
  const [editingRepo, setEditingRepo] = useState(false);
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? '');
  const [editingDeploy, setEditingDeploy] = useState(false);
  const [deployUrl, setDeployUrl] = useState(project.deployUrl ?? '');

  useEffect(() => {
    setDesc(project.description ?? '');
    setRepoUrl(project.repoUrl ?? '');
    setDeployUrl(project.deployUrl ?? '');
  }, [project]);

  const techStackItems = project.techStack
    ? project.techStack.split(',').map((s) => s.trim()).filter(Boolean)
    : (Array.isArray(project.stack) ? project.stack as string[] : []);

  return (
    <div className="border-b border-neutral-800 px-6 py-4">
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <select
          value={project.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Links row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mb-3">
        {/* Repo link */}
        {editingRepo ? (
          <input
            autoFocus
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onBlur={() => { onUpdate({ repoUrl: repoUrl || null }); setEditingRepo(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate({ repoUrl: repoUrl || null }); setEditingRepo(false); } }}
            placeholder="https://github.com/..."
            className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-neutral-300 focus:outline-none w-48"
          />
        ) : (
          <span
            className="flex items-center gap-1 cursor-pointer hover:text-neutral-300 transition-colors"
            onClick={() => setEditingRepo(true)}
          >
            Repo:
            {project.repoUrl ? (
              <a
                onClick={(e) => { e.stopPropagation(); window.electronAPI.openFile(project.repoUrl!); }}
                className="text-neutral-400 hover:text-blue-400 flex items-center gap-0.5"
              >
                {project.repoUrl.replace(/^https?:\/\/(github\.com\/)?/, '')}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-neutral-700">—</span>
            )}
          </span>
        )}

        {/* Deploy link */}
        {editingDeploy ? (
          <input
            autoFocus
            value={deployUrl}
            onChange={(e) => setDeployUrl(e.target.value)}
            onBlur={() => { onUpdate({ deployUrl: deployUrl || null }); setEditingDeploy(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate({ deployUrl: deployUrl || null }); setEditingDeploy(false); } }}
            placeholder="https://..."
            className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-neutral-300 focus:outline-none w-48"
          />
        ) : (
          <span
            className="flex items-center gap-1 cursor-pointer hover:text-neutral-300 transition-colors"
            onClick={() => setEditingDeploy(true)}
          >
            Deploy:
            {project.deployUrl ? (
              <a
                onClick={(e) => { e.stopPropagation(); window.electronAPI.openFile(project.deployUrl!); }}
                className="text-neutral-400 hover:text-blue-400 flex items-center gap-0.5"
              >
                {project.deployUrl.replace(/^https?:\/\//, '')}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-neutral-700">—</span>
            )}
          </span>
        )}

        {/* Local path */}
        <span className="flex items-center gap-1">
          <FolderOpen size={10} />
          Папка:
          {project.localPath ? (
            <span
              className="text-neutral-400 hover:text-blue-400 cursor-pointer flex items-center gap-0.5"
              onClick={(e) => { e.stopPropagation(); window.db.dev.files.showInFinder(project.localPath!); }}
              title={project.localPath}
            >
              {project.localPath.split('/').slice(-2).join('/')}
            </span>
          ) : (
            <span className="text-neutral-700">Не указана</span>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const selected = await window.electronAPI.openDirectory();
              if (selected) onUpdate({ localPath: selected });
            }}
            className="text-[10px] text-neutral-600 hover:text-neutral-300 transition-colors ml-1"
          >
            [Выбрать]
          </button>
        </span>
      </div>

      {/* Tech stack */}
      {techStackItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {techStackItems.map((tech) => (
            <span key={tech} className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {editingDesc ? (
        <textarea
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => { onUpdate({ description: desc || null }); setEditingDesc(false); }}
          rows={3}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 resize-none"
        />
      ) : (
        <div
          onClick={() => setEditingDesc(true)}
          className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-400 transition-colors min-h-[20px]"
        >
          {project.description || 'Нажмите чтобы добавить описание...'}
        </div>
      )}
    </div>
  );
}

// --- Project Docs ---

function ProjectDocs({ project, onUpdate }: {
  project: DevProjectV2;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [content, setContent] = useState(project.description ?? '');
  const [saved, setSaved] = useState(true);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(project.description ?? '');
    setSaved(true);
  }, [project.id, project.description]);

  const handleSave = useCallback(() => {
    onUpdate({ description: content || null });
    setSaved(true);
  }, [content, onUpdate]);

  const switchToEdit = useCallback(() => {
    const scrollTop = previewRef.current?.scrollTop ?? 0;
    setMode('edit');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = scrollTop;
      }
    });
  }, []);

  const switchToPreview = useCallback(() => {
    if (!saved) handleSave();
    const scrollTop = textareaRef.current?.scrollTop ?? 0;
    setMode('preview');
    requestAnimationFrame(() => {
      if (previewRef.current) {
        previewRef.current.scrollTop = scrollTop;
      }
    });
  }, [saved, handleSave]);

  const sendSummaryToChat = useCallback(() => {
    const msg = `Создай структурированный конспект документации проекта ${project.name}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(inputEl, msg);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, [project.name]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-neutral-900 rounded p-0.5">
            <button
              onClick={switchToPreview}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === 'preview' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Просмотр
            </button>
            <button
              onClick={switchToEdit}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === 'edit' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Редактирование
            </button>
          </div>
          {!saved && <span className="text-[10px] text-yellow-500">Несохранённые изменения</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sendSummaryToChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <Send size={10} />
            Конспект
          </button>
        </div>
      </div>

      {mode === 'preview' ? (
        <div
          ref={previewRef}
          onClick={switchToEdit}
          className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 cursor-text"
        >
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <div className="text-neutral-600 text-sm">Нажмите чтобы добавить документацию...</div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
          onBlur={() => { handleSave(); }}
          placeholder="# ТЗ проекта&#10;&#10;## Заметки&#10;&#10;## API документация"
          className="flex-1 w-full bg-transparent px-6 py-4 text-sm text-neutral-300 font-mono focus:outline-none resize-none scrollbar-thin"
        />
      )}
    </div>
  );
}

// --- Project Files ---

function ProjectFiles({ project, onUpdate }: {
  project: DevProjectV2;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [openFile, setOpenFile] = useState<{ path: string; name: string } | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileMode, setFileMode] = useState<'preview' | 'edit'>('preview');
  const [fileSaved, setFileSaved] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fileTextareaRef = useRef<HTMLTextAreaElement>(null);
  const filePreviewRef = useRef<HTMLDivElement>(null);

  const loadTree = useCallback(async () => {
    if (!project.localPath) return;
    const data = await window.db.dev.files.tree(project.localPath);
    setTree(data);
  }, [project.localPath]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTree();
    setRefreshing(false);
  }, [loadTree]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // File watcher
  useEffect(() => {
    if (!project.localPath) return;
    window.db.dev.files.watchStart(project.localPath);
    const unsub = window.db.dev.files.onWatchUpdate((lp) => {
      if (lp === project.localPath) loadTree();
    });
    return () => {
      unsub();
      if (project.localPath) window.db.dev.files.watchStop(project.localPath);
    };
  }, [project.localPath, loadTree]);

  // Auto-expand first level
  useEffect(() => {
    const firstLevel = new Set(tree.filter((n) => n.isDir).map((n) => n.path));
    setExpandedPaths(firstLevel);
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleFileClick = useCallback(async (node: FileTreeNode) => {
    if (node.isDir) {
      toggleExpand(node.path);
      return;
    }
    const ext = node.name.split('.').pop()?.toLowerCase();
    if (ext === 'md') {
      const content = await window.db.dev.files.read(node.path);
      setOpenFile({ path: node.path, name: node.name });
      setFileContent(content);
      setFileMode('preview');
      setFileSaved(true);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, [toggleExpand]);

  const handleFileSave = useCallback(async () => {
    if (!openFile) return;
    await window.db.dev.files.write(openFile.path, fileContent);
    setFileSaved(true);
  }, [openFile, fileContent]);

  const handleContextMenu = useCallback((e: React.MouseEvent, nodePath: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path: nodePath, isDir });
  }, []);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // No localPath set
  if (!project.localPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <FolderOpen size={32} className="text-neutral-700" />
        <p className="text-sm">Укажите папку проекта</p>
        <button
          onClick={async () => {
            const selected = await window.electronAPI.openDirectory();
            if (selected) onUpdate({ localPath: selected });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          <FolderOpen size={12} />
          Выбрать папку
        </button>
      </div>
    );
  }

  const relativePath = openFile && project.localPath
    ? openFile.path.replace(project.localPath, '').replace(/^\//, '')
    : openFile?.name ?? '';

  const fileViewerPanel = openFile ? (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-neutral-800 text-xs shrink-0">
        <FileText size={12} className="text-blue-500 shrink-0" />
        <span className="text-neutral-400 truncate">{relativePath}</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!fileSaved && <span className="text-[10px] text-yellow-500">Несохранённо</span>}
          <div className="flex gap-0.5 bg-neutral-900 rounded p-0.5">
            <button
              onClick={() => {
                if (!fileSaved) handleFileSave();
                const scrollTop = fileTextareaRef.current?.scrollTop ?? 0;
                setFileMode('preview');
                requestAnimationFrame(() => { if (filePreviewRef.current) filePreviewRef.current.scrollTop = scrollTop; });
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                fileMode === 'preview' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Просмотр
            </button>
            <button
              onClick={() => {
                const scrollTop = filePreviewRef.current?.scrollTop ?? 0;
                setFileMode('edit');
                requestAnimationFrame(() => {
                  if (fileTextareaRef.current) { fileTextareaRef.current.focus(); fileTextareaRef.current.scrollTop = scrollTop; }
                });
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                fileMode === 'edit' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Редактирование
            </button>
          </div>
        </div>
      </div>

      {fileMode === 'preview' ? (
        <div
          ref={filePreviewRef}
          onClick={() => {
            const scrollTop = filePreviewRef.current?.scrollTop ?? 0;
            setFileMode('edit');
            requestAnimationFrame(() => {
              if (fileTextareaRef.current) { fileTextareaRef.current.focus(); fileTextareaRef.current.scrollTop = scrollTop; }
            });
          }}
          className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 cursor-text"
        >
          {fileContent ? <MarkdownRenderer content={fileContent} /> : <div className="text-neutral-600 text-sm">Пустой файл</div>}
        </div>
      ) : (
        <textarea
          ref={fileTextareaRef}
          value={fileContent}
          onChange={(e) => { setFileContent(e.target.value); setFileSaved(false); }}
          onBlur={handleFileSave}
          className="flex-1 w-full bg-transparent px-6 py-4 text-sm text-neutral-300 font-mono focus:outline-none resize-none scrollbar-thin"
        />
      )}
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
      Выберите файл
    </div>
  );

  const treePanel = (
    <div className="flex flex-col overflow-hidden">
      {/* Tree header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Файлы</span>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-600 hover:text-neutral-300 transition-colors"
          title="Обновить"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <DevFileTree
          nodes={tree}
          expandedPaths={expandedPaths}
          onFileClick={handleFileClick}
          onContextMenu={handleContextMenu}
          depth={0}
        />
        {tree.length === 0 && (
          <div className="text-neutral-600 text-sm text-center py-8">Папка пуста</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: file tree */}
      <div className="w-72 shrink-0 border-r border-neutral-800 flex flex-col overflow-hidden">
        {treePanel}
      </div>
      {/* Right: file viewer */}
      {fileViewerPanel}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { window.electronAPI.openFile(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Открыть
          </button>
          <button
            onClick={() => { window.db.dev.files.openInEditor(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Открыть в VS Code
          </button>
          <button
            onClick={() => { window.db.dev.files.showInFinder(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Показать в Finder
          </button>
        </div>
      )}
    </div>
  );
}

// --- Dev File Tree ---

function DevFileTree({ nodes, expandedPaths, onFileClick, onContextMenu, depth }: {
  nodes: FileTreeNode[];
  expandedPaths: Set<string>;
  onFileClick: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const ext = node.name.split('.').pop()?.toLowerCase();
        const isMd = ext === 'md';
        const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'json', 'yml', 'yaml', 'sh', 'sql'].includes(ext ?? '');

        return (
          <div key={node.path}>
            <button
              onClick={() => onFileClick(node)}
              onContextMenu={(e) => onContextMenu(e, node.path, node.isDir)}
              className="w-full text-left flex items-center gap-1.5 py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
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
                onClick={(e) => { e.stopPropagation(); onContextMenu(e, node.path, node.isDir); }}
              />
            </button>
            {node.isDir && isExpanded && node.children && (
              <DevFileTree
                nodes={node.children}
                expandedPaths={expandedPaths}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// --- Kanban Column ---

function KanbanColumn({ status, label, tasks, onDragStart, onDragOver, onDrop, onTaskClick }: {
  status: DevTaskStatus;
  label: string;
  tasks: DevTask[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: DevTaskStatus) => void;
  onTaskClick: (id: string) => void;
}) {
  return (
    <div
      className="flex-1 min-w-[240px] max-w-[360px] flex flex-col"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-neutral-600">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin min-h-[100px] rounded-lg bg-neutral-900/30 p-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
            onDragStart={onDragStart}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-neutral-700 text-xs text-center py-8">Нет задач</div>
        )}
      </div>
    </div>
  );
}

// --- Task Card ---

function TaskCard({ task, onClick, onDragStart }: {
  task: DevTask;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}) {
  const priority = PRIORITY_BADGE[task.priority];
  const dl = deadlineInfo(task.deadline);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 cursor-pointer hover:border-neutral-700 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-neutral-700 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-neutral-200 mb-1.5">{task.title}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${priority.cls}`}>
              {priority.label}
            </span>
            {task.timeSpentMinutes > 0 && (
              <span className="text-[10px] text-neutral-600 flex items-center gap-0.5">
                <Clock size={10} />
                {formatMinutes(task.timeSpentMinutes)}
              </span>
            )}
            {dl && (
              <span className={`text-[10px] flex items-center gap-0.5 ${dl.cls}`}>
                <Calendar size={10} />
                {dl.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sidebar Tasks List ---

function SidebarTasksList({ tasks, onTaskClick }: {
  tasks: DevTask[];
  onTaskClick: (id: string) => void;
}) {
  const [deferredOpen, setDeferredOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const todo = tasks.filter((t) => t.status === 'todo');
  const deferred = tasks.filter((t) => t.status === 'deferred');
  const done = tasks.filter((t) => t.status === 'done');

  const renderTask = (t: DevTask) => {
    const dl = deadlineInfo(t.deadline);
    return (
      <button
        key={t.id}
        onClick={() => onTaskClick(t.id)}
        className="w-full text-left py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors flex items-center gap-1.5"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
        <span className="text-xs text-neutral-400 truncate flex-1">{t.title}</span>
        {dl && <span className={`text-[10px] shrink-0 ${dl.cls}`}>{t.deadline?.slice(5)}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-1">
      {inProgress.length > 0 && (
        <div>
          <div className="text-[10px] text-blue-400/70 uppercase tracking-wider px-1 mb-0.5">В работе</div>
          {inProgress.map(renderTask)}
        </div>
      )}
      {todo.length > 0 && (
        <div>
          <div className="text-[10px] text-neutral-600 uppercase tracking-wider px-1 mb-0.5 mt-1">Todo</div>
          {todo.map(renderTask)}
        </div>
      )}
      {deferred.length > 0 && (
        <button
          onClick={() => setDeferredOpen(!deferredOpen)}
          className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-1 mt-1"
        >
          {deferredOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Отложено ({deferred.length})
        </button>
      )}
      {deferredOpen && deferred.map(renderTask)}
      {done.length > 0 && (
        <button
          onClick={() => setDoneOpen(!doneOpen)}
          className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-1 mt-1"
        >
          {doneOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Готово ({done.length})
        </button>
      )}
      {doneOpen && done.map(renderTask)}
    </div>
  );
}

// --- Tasks List View ---

type TasksSort = 'priority' | 'deadline' | 'status';

function TasksListView({ project, tasks, onBack, onTaskClick, onCreateTask }: {
  project: DevProjectV2;
  tasks: DevTask[];
  onBack: () => void;
  onTaskClick: (id: string) => void;
  onCreateTask: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<DevTaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DevTaskPriority | 'all'>('all');
  const [sort, setSort] = useState<TasksSort>('priority');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter);

    list.sort((a, b) => {
      if (sort === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      // status
      const SO: Record<DevTaskStatus, number> = { in_progress: 0, todo: 1, deferred: 2, done: 3 };
      return SO[a.status] - SO[b.status];
    });
    return list;
  }, [tasks, statusFilter, priorityFilter, sort]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    await onCreateTask({ title: newTitle, status: 'todo', priority: 'medium' });
    setNewTitle('');
    setAdding(false);
  }, [newTitle, onCreateTask]);

  const statusFilters: { value: DevTaskStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'done', label: 'Готово' },
    { value: 'deferred', label: 'Отложено' },
  ];

  const priorityFilters: { value: DevTaskPriority | 'all'; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const sortOptions: { value: TasksSort; label: string }[] = [
    { value: 'priority', label: 'По приоритету' },
    { value: 'deadline', label: 'По дедлайну' },
    { value: 'status', label: 'По статусу' },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Назад к проекту
      </button>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Задачи: {project.name}</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          <Plus size={12} />
          Добавить задачу
        </button>
      </div>

      {adding && (
        <div className="mb-4">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
            }}
            placeholder="Название задачи..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-0.5">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === f.value ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-neutral-800" />
        <div className="flex gap-0.5">
          {priorityFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setPriorityFilter(f.value)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                priorityFilter === f.value ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-neutral-800" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as TasksSort)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-400 focus:outline-none"
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="text-[10px] text-neutral-600 ml-auto">{filtered.length} задач</span>
      </div>

      {/* Task rows */}
      <div className="space-y-1">
        {filtered.map((task) => {
          const pBadge = PRIORITY_BADGE[task.priority];
          const sBadge = STATUS_BADGE[task.status];
          const dl = deadlineInfo(task.deadline);
          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className="w-full text-left bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-4 py-3 hover:border-neutral-700 hover:bg-neutral-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-neutral-200">{task.title}</span>
                    {task.prompt && <ClipboardList size={12} className="text-neutral-600 shrink-0" title="Промпт написан" />}
                  </div>
                  {task.description && (
                    <div className="text-[11px] text-neutral-600 truncate">{task.description.slice(0, 100)}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(task.timeEstimateMinutes || task.timeSpentMinutes > 0) && (
                    <span className="text-[10px] text-neutral-600 flex items-center gap-0.5">
                      <Clock size={10} />
                      {task.timeSpentMinutes > 0 ? formatMinutes(task.timeSpentMinutes) : ''}
                      {task.timeEstimateMinutes ? `/${formatMinutes(task.timeEstimateMinutes)}` : ''}
                    </span>
                  )}
                  {dl && (
                    <span className={`text-[10px] ${dl.cls}`}>{task.deadline?.slice(5)}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${sBadge.cls}`}>{sBadge.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${pBadge.cls}`}>{pBadge.label}</span>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-8 text-center">Нет задач с такими фильтрами</div>
        )}
      </div>
    </div>
  );
}

// --- Task Detail View ---

function TaskDetailView({ task, project, onBack, onUpdate, onDelete }: {
  task: DevTask;
  project: DevProjectV2;
  onBack: () => void;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [prompt, setPrompt] = useState(task.prompt ?? '');
  const [status, setStatus] = useState<DevTaskStatus>(task.status);
  const [priority, setPriority] = useState<DevTaskPriority>(task.priority);
  const [timeEstimate, setTimeEstimate] = useState(task.timeEstimateMinutes?.toString() ?? '');
  const [deadline, setDeadline] = useState(task.deadline ?? '');

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<string>('');

  // Reset state when task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPrompt(task.prompt ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setTimeEstimate(task.timeEstimateMinutes?.toString() ?? '');
    setDeadline(task.deadline ?? '');
  }, [task]);

  // Timer logic
  const startTimer = useCallback(() => {
    timerStartRef.current = new Date().toISOString();
    setTimerRunning(true);
    setTimerSeconds(0);
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    await window.db.dev.time.create({
      taskId: task.id,
      projectId: task.projectId,
      startedAt: timerStartRef.current,
      endedAt: new Date().toISOString(),
      durationMinutes: minutes,
    });
    await onUpdate({ timeSpentMinutes: task.timeSpentMinutes + minutes });
    setTimerSeconds(0);
  }, [timerSeconds, task.id, task.projectId, task.timeSpentMinutes, onUpdate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Save handlers
  const saveField = useCallback(async (field: string, value: unknown) => {
    await onUpdate({ [field]: value });
  }, [onUpdate]);

  // Send prompt to chat
  const sendPromptToChat = useCallback(() => {
    if (!prompt) return;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(inputEl, prompt);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, [prompt]);

  const timerDisplay = timerRunning
    ? `${Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:${(timerSeconds % 60).toString().padStart(2, '0')}`
    : null;

  const dl = deadlineInfo(task.deadline);

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Назад к проекту
      </button>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== task.title) saveField('title', title); }}
        className="w-full text-xl font-bold bg-transparent border-none focus:outline-none text-neutral-100 mb-4"
      />

      {/* Status & Priority & Deadline row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div>
          <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">Статус</label>
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value as DevTaskStatus;
              setStatus(v);
              saveField('status', v);
            }}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="todo">Todo</option>
            <option value="in_progress">В работе</option>
            <option value="done">Готово</option>
            <option value="deferred">Отложено</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">Приоритет</label>
          <select
            value={priority}
            onChange={(e) => {
              const v = e.target.value as DevTaskPriority;
              setPriority(v);
              saveField('priority', v);
            }}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">Дедлайн</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                saveField('deadline', e.target.value || null);
              }}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
            />
            {dl && <span className={`text-[10px] ${dl.cls}`}>{dl.label}</span>}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">Оценка</label>
          <div className="flex items-center gap-1">
            <input
              value={timeEstimate}
              onChange={(e) => setTimeEstimate(e.target.value)}
              onBlur={() => {
                const v = parseInt(timeEstimate, 10);
                if (!isNaN(v)) saveField('timeEstimateMinutes', v);
              }}
              placeholder="—"
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none w-16"
            />
            <span className="text-[10px] text-neutral-600">мин</span>
            {task.timeEstimateMinutes && task.timeEstimateMinutes >= 60 && (
              <span className="text-[10px] text-neutral-500">({formatMinutes(task.timeEstimateMinutes)})</span>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">Потрачено</label>
          <span className="text-xs text-neutral-400">{formatMinutes(task.timeSpentMinutes)}</span>
        </div>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3 mb-6">
        {timerRunning ? (
          <button
            onClick={stopTimer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            <Square size={12} />
            Остановить {timerDisplay}
          </button>
        ) : (
          <button
            onClick={startTimer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            <Play size={12} />
            Начать таймер
          </button>
        )}
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-neutral-400 block mb-2">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (task.description ?? '')) saveField('description', description || null); }}
          placeholder="Описание задачи..."
          rows={4}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 resize-none"
        />
      </div>

      {/* Prompt */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-400">Промпт</label>
          {prompt && (
            <button
              onClick={sendPromptToChat}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Send size={12} />
              Запустить промпт
            </button>
          )}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => { if (prompt !== (task.prompt ?? '')) saveField('prompt', prompt || null); }}
          placeholder="Промпт для Claude Code..."
          rows={6}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 font-mono focus:outline-none focus:border-neutral-600 resize-none"
        />
      </div>

      {/* Delete */}
      <div className="pt-4 border-t border-neutral-800">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
          Удалить задачу
        </button>
      </div>
    </div>
  );
}
