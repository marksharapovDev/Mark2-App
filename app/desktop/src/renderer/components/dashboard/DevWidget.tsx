import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Circle } from 'lucide-react';

interface DevTaskInfo {
  id: string;
  title: string;
  projectName: string;
  status: string;
}

interface DeadlineInfo {
  title: string;
  date: string;
  projectName: string;
}

const STATUS_COLOR: Record<string, string> = {
  in_progress: 'text-blue-400',
  todo: 'text-yellow-400',
  deferred: 'text-neutral-500',
};

export function DevWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [tasks, setTasks] = useState<DevTaskInfo[]>([]);
  const [nearestDeadline, setNearestDeadline] = useState<DeadlineInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      const projects = await window.db.projects.list();
      const active = projects.filter((p: { status: string }) => p.status === 'active');
      setActiveCount(active.length);

      const allTasks: DevTaskInfo[] = [];
      let closest: DeadlineInfo | null = null;

      for (const project of active) {
        const projectTasks = await window.db.dev.tasks.list(project.id);
        for (const t of projectTasks) {
          if (t.status === 'done') continue;

          if (t.status === 'in_progress' || t.status === 'todo') {
            allTasks.push({
              id: t.id,
              title: t.title,
              projectName: project.name,
              status: t.status,
            });
          }

          if (t.deadline) {
            if (!closest || t.deadline < closest.date) {
              closest = { title: t.title, date: t.deadline, projectName: project.name };
            }
          }
        }
      }

      // Also check project-level deadlines
      for (const project of active) {
        if (project.deadline) {
          if (!closest || project.deadline < closest.date) {
            closest = { title: project.name, date: project.deadline, projectName: project.name };
          }
        }
      }

      // Show in_progress first, then todo, max 5
      allTasks.sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
        return 0;
      });
      setTasks(allTasks.slice(0, 5));
      setNearestDeadline(closest);
    } catch {
      // keep empty state
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['tasks', 'projects', 'dev_tasks'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-blue-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="bg-neutral-900/50 border border-blue-500/10 rounded-xl p-5 cursor-pointer hover:border-blue-500/25 transition-colors"
      onClick={() => navigate('/dev')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-blue-400"><Code size={18} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Разработка</h3>
        <span className="ml-auto text-[11px] text-neutral-500">
          {activeCount} {activeCount === 1 ? 'проект' : 'проектов'}
        </span>
      </div>

      <div className="space-y-3">
        {/* Tasks in progress */}
        {tasks.length > 0 && (
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wide">Задачи в работе</span>
            <div className="mt-1 space-y-1">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <Circle size={6} className={`shrink-0 fill-current ${STATUS_COLOR[t.status] ?? 'text-neutral-500'}`} />
                  <span className="text-neutral-300 truncate flex-1">{t.title}</span>
                  <span className="text-neutral-600 shrink-0 text-[10px]">{t.projectName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-xs text-neutral-500">Нет активных задач</div>
        )}

        {/* Nearest deadline */}
        {nearestDeadline && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-neutral-500">Ближайший дедлайн</span>
            <span className="text-xs">
              <span className="text-neutral-300">{nearestDeadline.title}</span>
              <span className="text-neutral-600 ml-1.5">{formatDate(nearestDeadline.date)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)] ?? ''}`;
}
