import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

export function HealthWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [checklistDone, setChecklistDone] = useState(0);
  const [checklistTotal] = useState(5);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightTrend, setWeightTrend] = useState<'up' | 'down' | 'stable' | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2500);

  const reload = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const [checklist, weightLogs, workouts, meals, goals] = await Promise.all([
        window.db.health.checklist.get(today),
        window.db.health.logs.list('weight'),
        window.db.health.workouts.list(weekAgo, today),
        window.db.health.meals.list(today, today, today),
        window.db.health.goals.list(),
      ]);

      // Checklist
      if (checklist) {
        setChecklistDone(checklist.completedCount ?? 0);
      }

      // Weight + trend
      if (weightLogs.length > 0) {
        const sorted = [...weightLogs].sort((a: { date: string }, b: { date: string }) =>
          b.date.localeCompare(a.date)
        );
        const latest = sorted[0];
        if (latest?.value) {
          setCurrentWeight(latest.value);
          if (sorted.length >= 2 && sorted[1]?.value) {
            const diff = latest.value - sorted[1].value;
            if (Math.abs(diff) < 0.2) setWeightTrend('stable');
            else setWeightTrend(diff > 0 ? 'up' : 'down');
          }
        }
      }

      // Weekly workouts
      setWeekWorkouts(workouts.length);

      // Today's calories
      const totalCal = meals.reduce(
        (sum: number, m: { calories: number | null }) => sum + (m.calories ?? 0),
        0
      );
      setTodayCalories(totalCal);

      // Calorie goal
      const calGoal = goals.find(
        (g: { type: string | null; status: string }) =>
          g.type === 'habit' && g.status === 'active' && g.unit === 'kcal'
      );
      if (calGoal?.targetValue) {
        setCalorieGoal(calGoal.targetValue);
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
      if (entities.some((e) => ['workouts', 'health_logs', 'health_checklist', 'meals', 'health_goals'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-orange-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  const calPct = calorieGoal > 0 ? Math.round((todayCalories / calorieGoal) * 100) : 0;
  const checkPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const trendLabel = weightTrend === 'up' ? '\u2191' : weightTrend === 'down' ? '\u2193' : '\u2192';
  const trendColor = weightTrend === 'down' ? 'text-emerald-400' : weightTrend === 'up' ? 'text-red-400' : 'text-neutral-500';

  return (
    <div
      className="bg-neutral-900/50 border border-orange-500/10 rounded-xl p-5 cursor-pointer hover:border-orange-500/25 transition-colors"
      onClick={() => navigate('/health')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-400"><Dumbbell size={18} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Здоровье</h3>
      </div>

      <div className="space-y-3">
        {/* Day checklist */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-neutral-500">Чеклист дня</span>
            <span className="text-[11px] text-neutral-400">{checklistDone} из {checklistTotal}</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(100, checkPct)}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          {currentWeight !== null && (
            <div>
              <span className="text-[11px] text-neutral-500">Вес</span>
              <div className="text-sm text-neutral-200">
                {currentWeight} кг
                {weightTrend && <span className={`ml-1 ${trendColor}`}>{trendLabel}</span>}
              </div>
            </div>
          )}
          <div>
            <span className="text-[11px] text-neutral-500">Тренировок</span>
            <div className="text-sm font-bold text-orange-400">{weekWorkouts}/нед</div>
          </div>
        </div>

        {/* Calories */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-neutral-500">Калории</span>
            <span className="text-[11px] text-neutral-400">
              {todayCalories} / {calorieGoal} ({calPct}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500/70 transition-all"
              style={{ width: `${Math.min(100, calPct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
