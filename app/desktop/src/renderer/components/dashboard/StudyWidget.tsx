import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export function StudyWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [nextDeadline, setNextDeadline] = useState<{ title: string; subject: string; deadline: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const [assignments, subjects] = await Promise.all([
        window.db.assignments.list(),
        window.db.subjects.list(),
      ]);

      const inProgress = assignments.filter((a) => a.status === 'in_progress');
      setInProgressCount(inProgress.length);

      const withDeadline = assignments
        .filter((a) => a.deadline && a.status !== 'graded' && a.status !== 'submitted')
        .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));

      if (withDeadline.length > 0 && withDeadline[0]) {
        const a = withDeadline[0];
        const subj = subjects.find((s) => s.id === a.subjectId);
        setNextDeadline({
          title: a.title,
          subject: subj?.name ?? '',
          deadline: a.deadline ?? '',
        });
      } else {
        setNextDeadline(null);
      }
    } catch {
      // keep empty state
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['tasks', 'subjects', 'assignments', 'exams'].includes(e))) {
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
          <span className="text-xs text-neutral-500">Заданий в работе</span>
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
