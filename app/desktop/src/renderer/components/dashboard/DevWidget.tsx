import { useNavigate } from 'react-router-dom';
import { Code, CheckCircle2, RefreshCw, Clock } from 'lucide-react';

const PROJECTS = [
  { name: 'LI Group', status: 'active' },
  { name: 'Personal Site', status: 'active' },
  { name: 'Mark2', status: 'active' },
] as const;

const LAST_TASK = { title: 'Claude Bridge: streaming', status: 'in_progress' as const };

const STATUS_ICON: Record<string, React.ReactNode> = {
  done: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" />,
  in_progress: <RefreshCw size={14} strokeWidth={1.5} className="text-blue-400" />,
  todo: <Clock size={14} strokeWidth={1.5} className="text-yellow-400" />,
};
const STATUS_LABEL = { done: 'Готово', in_progress: 'В работе', todo: 'Todo' };

export function DevWidget() {
  const navigate = useNavigate();
  const activeCount = PROJECTS.filter((p) => p.status === 'active').length;

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

        <div>
          <span className="text-xs text-neutral-500">Последняя задача</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px]">{STATUS_ICON[LAST_TASK.status]}</span>
            <span className="text-xs text-neutral-300 truncate">{LAST_TASK.title}</span>
            <span className="text-[10px] text-neutral-600 ml-auto shrink-0">
              {STATUS_LABEL[LAST_TASK.status]}
            </span>
          </div>
        </div>
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
