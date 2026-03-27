import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

interface DeadlineInfo {
  title: string;
  subject: string;
  date: string;
}

interface ExamInfo {
  title: string;
  date: string;
}

export function StudyWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [nextDeadline, setNextDeadline] = useState<DeadlineInfo | null>(null);
  const [nextExam, setNextExam] = useState<ExamInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      const [assignments, subjects, exams] = await Promise.all([
        window.db.assignments.list(),
        window.db.subjects.list(),
        window.db.exams.list(),
      ]);

      const today = new Date().toISOString().slice(0, 10);

      // In-progress assignments
      const inProgress = assignments.filter(
        (a: { status: string }) => a.status === 'in_progress' || a.status === 'pending'
      );
      setInProgressCount(inProgress.length);

      // Nearest assignment deadline
      const withDeadline = assignments
        .filter((a: { deadline: string | null; status: string }) =>
          a.deadline && a.deadline >= today && a.status !== 'graded' && a.status !== 'submitted'
        )
        .sort((a: { deadline: string }, b: { deadline: string }) =>
          a.deadline.localeCompare(b.deadline)
        );

      if (withDeadline.length > 0 && withDeadline[0]) {
        const a = withDeadline[0];
        const subj = subjects.find((s: { id: string }) => s.id === a.subjectId);
        setNextDeadline({
          title: a.title,
          subject: subj?.name ?? '',
          date: a.deadline ?? '',
        });
      } else {
        setNextDeadline(null);
      }

      // Nearest exam
      const upcomingExams = exams
        .filter((e: { date: string | null; status: string }) =>
          e.date && e.date >= today && e.status === 'upcoming'
        )
        .sort((a: { date: string }, b: { date: string }) =>
          a.date.localeCompare(b.date)
        );

      if (upcomingExams.length > 0 && upcomingExams[0]) {
        setNextExam({
          title: upcomingExams[0].title,
          date: upcomingExams[0].date ?? '',
        });
      } else {
        setNextExam(null);
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
      if (entities.some((e) => ['subjects', 'assignments', 'exams'].includes(e))) {
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
    <div
      className="bg-neutral-900/50 border border-purple-500/10 rounded-xl p-5 cursor-pointer hover:border-purple-500/25 transition-colors"
      onClick={() => navigate('/study')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-purple-400"><BookOpen size={18} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Учёба</h3>
        <span className="ml-auto text-[11px] text-neutral-500">
          {inProgressCount} {inProgressCount === 1 ? 'задание' : 'заданий'} в работе
        </span>
      </div>

      <div className="space-y-3">
        {/* Nearest assignment deadline */}
        {nextDeadline && (
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wide">Ближайший дедлайн</span>
            <div className="text-sm text-neutral-200 mt-0.5">{nextDeadline.title}</div>
            <div className="text-[11px] text-neutral-500">
              {nextDeadline.subject && <>{nextDeadline.subject} &middot; </>}
              {formatDate(nextDeadline.date)}
            </div>
          </div>
        )}

        {!nextDeadline && (
          <div className="text-xs text-neutral-500">Нет ближайших дедлайнов</div>
        )}

        {/* Nearest exam */}
        {nextExam && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-neutral-500">Ближайший экзамен</span>
            <span className="text-xs">
              <span className="text-neutral-300">{nextExam.title}</span>
              <span className="text-neutral-600 ml-1.5">{formatDate(nextExam.date)}</span>
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
