import { useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

const LAST_WORKOUT = { date: '2026-03-20', type: 'Зал', label: 'Грудь + трицепс', duration: 65 };
const TODAY_CALORIES = 1400;
const TARGET_CALORIES = 2500;

export function HealthWidget() {
  const navigate = useNavigate();
  const pct = Math.round((TODAY_CALORIES / TARGET_CALORIES) * 100);

  return (
    <div className="bg-neutral-900/50 border border-orange-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-orange-400"><Dumbbell size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Здоровье</h3>
      </div>

      <div className="space-y-2 flex-1">
        <div>
          <span className="text-xs text-neutral-500">Последняя тренировка</span>
          <div className="text-xs text-neutral-300 mt-0.5">
            {LAST_WORKOUT.type} &mdash; {LAST_WORKOUT.label}
          </div>
          <div className="text-[11px] text-neutral-500">
            {formatDate(LAST_WORKOUT.date)} &middot; {LAST_WORKOUT.duration} мин
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-neutral-500">Калории сегодня</span>
            <span className="text-[11px] text-neutral-400">{TODAY_CALORIES} / {TARGET_CALORIES} ({pct}%)</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/health')}
        className="mt-4 text-xs text-orange-400/70 hover:text-orange-300 transition-colors text-left"
      >
        Перейти в Health &rarr;
      </button>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}
