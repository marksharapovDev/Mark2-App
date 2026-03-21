import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const NEXT_DEADLINE = { title: 'Производные (ДЗ)', subject: 'Мат. анализ', deadline: '2026-03-25' };
const IN_PROGRESS_COUNT = 6;

export function StudyWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-neutral-900/50 border border-purple-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400"><BookOpen size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Учёба</h3>
      </div>

      <div className="space-y-2 flex-1">
        <div>
          <span className="text-xs text-neutral-500">Ближайший дедлайн</span>
          <div className="text-xs text-neutral-300 mt-0.5">{NEXT_DEADLINE.title}</div>
          <div className="text-[11px] text-neutral-500">
            {NEXT_DEADLINE.subject} &middot; {formatDate(NEXT_DEADLINE.deadline)}
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Материалов в работе</span>
          <span className="text-sm font-bold text-purple-400">{IN_PROGRESS_COUNT}</span>
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
