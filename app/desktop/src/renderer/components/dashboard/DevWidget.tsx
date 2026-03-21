import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, CheckCircle2, RefreshCw, Clock } from 'lucide-react';

const MOCK_PROJECTS = [
  { name: 'LI Group', status: 'active' },
  { name: 'Personal Site', status: 'active' },
  { name: 'Mark2', status: 'active' },
];

const MOCK_LAST_TASK = { title: 'Claude Bridge: streaming', status: 'in_progress' as const };

const STATUS_ICON: Record<string, React.ReactNode> = {
  done: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />,
  in_progress: <RefreshCw size={14} strokeWidth={1.5} className="text-blue-400" />,
  todo: <Clock size={14} strokeWidth={1.5} className="text-yellow-400" />,
};
const STATUS_LABEL: Record<string, string> = { done: 'Готово', in_progress: 'В работе', todo: 'Todo' };

export function DevWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState(MOCK_PROJECTS);
  const [lastTask, setLastTask] = useState<{ title: string; status: string } | null>(MOCK_LAST_TASK);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [projectsResult, tasksResult] = await Promise.all([
          window.db.projects.list(),
          window.db.tasks.list('dev'),
        ]);
        if (cancelled) return;
        if (projectsResult.length > 0) {
          setProjects(projectsResult.map((p: { name: string; status: string }) => ({ name: p.name, status: p.status })));
        }
        if (tasksResult.length > 0) {
          const inProgress = tasksResult.find((t: { status: string }) => t.status === 'in_progress');
          const task = inProgress ?? tasksResult[0];
          if (task) {
            setLastTask({ title: task.title, status: task.status });
          }
        }
      } catch {
        // keep mock data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-blue-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  const activeCount = projects.filter((p) => p.status === 'active').length;

  return (
    <div className="bg-neutral-900/50 border border-blue-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-400"><Code size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Разработка</h3>
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Активные проекты</span>
          <span className="text-sm font-bold text-blue-400">{activeCount}</span>
        </div>

        {lastTask && (
          <div>
            <span className="text-xs text-neutral-500">Последняя задача</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px]">{STATUS_ICON[lastTask.status]}</span>
              <span className="text-xs text-neutral-300 truncate">{lastTask.title}</span>
              <span className="text-[10px] text-neutral-600 ml-auto shrink-0">
                {STATUS_LABEL[lastTask.status] ?? lastTask.status}
              </span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/dev')}
        className="mt-4 text-xs text-blue-400/70 hover:text-blue-300 transition-colors text-left"
      >
        Перейти в Dev &rarr;
      </button>
    </div>
  );
}
