import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const MOCK_NEXT_DEADLINE = { title: 'Производные (ДЗ)', subject: 'Мат. анализ', deadline: '2026-03-25' };
const MOCK_IN_PROGRESS_COUNT = 6;

export function StudyWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inProgressCount, setInProgressCount] = useState(MOCK_IN_PROGRESS_COUNT);
  const [nextDeadline, setNextDeadline] = useState<{ title: string; subject: string; deadline: string } | null>(MOCK_NEXT_DEADLINE);

  const reload = useCallback(async () => {
    try {
      const result = await window.db.tasks.list('study');
      if (result.length > 0) {
        const inProgress = result.filter((t: { status: string }) => t.status === 'in_progress');
        setInProgressCount(inProgress.length);
        const withDeadline = result
          .filter((t) => t.dueDate != null)
          .sort((a, b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dlb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            return da - dlb;
          });
        if (withDeadline.length > 0) {
          const t = withDeadline[0];
          if (t) {
            setNextDeadline({
              title: t.title,
              subject: '',
              deadline: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '',
            });
          }
        }
      }
    } catch {
      // keep mock data
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('tasks') || entities.includes('subjects')) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-purple-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-purple-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400"><BookOpen size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Учёба</h3>
      </div>

      <div className="space-y-2 flex-1">
        {nextDeadline && (
          <div>
            <span className="text-xs text-neutral-500">Ближайший дедлайн</span>
            <div className="text-xs text-neutral-300 mt-0.5">{nextDeadline.title}</div>
            <div className="text-[11px] text-neutral-500">
              {nextDeadline.subject && <>{nextDeadline.subject} &middot; </>}{formatDate(nextDeadline.deadline)}
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Материалов в работе</span>
          <span className="text-sm font-bold text-purple-400">{inProgressCount}</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/study')}
        className="mt-4 text-xs text-purple-400/70 hover:text-purple-300 transition-colors text-left"
      >
        Перейти в Study &rarr;
      </button>
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
