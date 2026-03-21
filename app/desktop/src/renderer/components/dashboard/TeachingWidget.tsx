import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

const NEXT_LESSON = { student: 'Миша Козлов', subject: 'Информатика (ЕГЭ)', date: '2026-03-25', topic: 'Рекурсия' };
const OVERDUE_HW = 1;
const UPCOMING_HW = 2;

export function TeachingWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-neutral-900/50 border border-green-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-400"><GraduationCap size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Ученики</h3>
      </div>

      <div className="space-y-2 flex-1">
        <div>
          <span className="text-xs text-neutral-500">Ближайший урок</span>
          <div className="text-xs text-neutral-300 mt-0.5">{NEXT_LESSON.student}</div>
          <div className="text-[11px] text-neutral-500">
            {formatDate(NEXT_LESSON.date)} &middot; {NEXT_LESSON.topic}
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Невыполненные ДЗ</span>
          <div className="flex items-center gap-2">
            {OVERDUE_HW > 0 && (
              <span className="text-[10px] text-red-400">{OVERDUE_HW} просрочено</span>
            )}
            <span className="text-[10px] text-yellow-400">{UPCOMING_HW} предстоит</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/teaching')}
        className="mt-4 text-xs text-green-400/70 hover:text-green-300 transition-colors text-left"
      >
        Перейти в Teaching &rarr;
      </button>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}
