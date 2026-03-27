import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

interface NextLesson {
  studentName: string;
  subject: string;
  day: string;
  time: string;
}

interface PaymentInfo {
  studentName: string;
  balance: number; // positive = overpaid, negative = owes
}

export function TeachingWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [lessonsThisMonth, setLessonsThisMonth] = useState(0);
  const [pendingHomework, setPendingHomework] = useState(0);
  const [nextLesson, setNextLesson] = useState<NextLesson | null>(null);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);

  const reload = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

      const [students, lessons, files, rates] = await Promise.all([
        window.db.students.list(),
        window.db.lessons.list(),
        window.db.files.list('homework'),
        Promise.resolve([]).catch(() => []), // rates are per-student, we'll handle below
      ]);

      setStudentCount(students.length);

      // Lessons this month
      const thisMonthLessons = lessons.filter(
        (l: { date: string; status: string }) =>
          l.date >= monthStart && l.date <= monthEnd && l.status === 'completed'
      );
      setLessonsThisMonth(thisMonthLessons.length);

      // Pending homework
      const pending = files.filter(
        (f: { category: string; status: string }) =>
          f.category === 'homework' && f.status === 'pending'
      );
      setPendingHomework(pending.length);

      // Next lesson from student schedules
      const dayMap: Record<string, number> = { 'Пн': 1, 'Вт': 2, 'Ср': 3, 'Чт': 4, 'Пт': 5, 'Сб': 6, 'Вс': 0 };
      const today = now.getDay();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let closest: { student: { name: string; subject: string | null }; day: string; time: string; daysAway: number; timeStr: string } | null = null;

      for (const student of students) {
        if (!student.schedule) continue;
        const scheduleArr = Array.isArray(student.schedule) ? student.schedule : [];
        for (const slot of scheduleArr) {
          const s = slot as { day?: string; time?: string };
          if (!s.day || dayMap[s.day] === undefined) continue;
          const slotDay = dayMap[s.day]!;
          let daysAway = (slotDay - today + 7) % 7;
          const slotTime = s.time || '00:00';
          // If today but time already passed, it's next week
          if (daysAway === 0 && slotTime <= currentTime) {
            daysAway = 7;
          }
          if (!closest || daysAway < closest.daysAway || (daysAway === closest.daysAway && slotTime < closest.timeStr)) {
            closest = {
              student: { name: student.name, subject: student.subject },
              day: s.day,
              time: slotTime,
              daysAway,
              timeStr: slotTime,
            };
          }
        }
      }

      if (closest) {
        setNextLesson({
          studentName: closest.student.name,
          subject: closest.student.subject || '',
          day: closest.day,
          time: closest.time,
        });
      }

      // Payment balance per student (lessons conducted vs payments received)
      // Simple heuristic: count lessons this month * rate - income transactions for student
      try {
        const transactions = await window.db.transactions.list({ month: monthStart.slice(0, 7) });
        const studentPayments: PaymentInfo[] = [];

        for (const student of students) {
          const studentLessons = thisMonthLessons.filter(
            (l: { studentId: string }) => l.studentId === student.id
          );
          if (studentLessons.length === 0) continue;

          // Find payments from this student
          const studentIncome = transactions
            .filter((t: { type: string; studentId: string | null }) =>
              t.type === 'income' && t.studentId === student.id
            )
            .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

          // Try to get rate
          let rate: { ratePerLesson: number } | null = null;
          try {
            rate = await window.db.finance.rates.get(student.id);
          } catch {
            // no rate set
          }

          if (rate) {
            const owed = studentLessons.length * rate.ratePerLesson;
            const balance = studentIncome - owed;
            if (balance !== 0) {
              studentPayments.push({ studentName: student.name, balance });
            }
          }
        }

        setPayments(studentPayments);
      } catch {
        // payments data not critical
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
      if (entities.some((e) => ['students', 'lessons', 'files', 'transactions'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return <WidgetSkeleton color="green" />;
  }

  const owes = payments.filter((p) => p.balance < 0);
  const overpaid = payments.filter((p) => p.balance > 0);

  return (
    <div
      className="bg-neutral-900/50 border border-green-500/10 rounded-xl p-5 cursor-pointer hover:border-green-500/25 transition-colors"
      onClick={() => navigate('/teaching')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-green-400"><GraduationCap size={18} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Преподавание</h3>
      </div>

      <div className="space-y-3">
        {/* Next lesson */}
        {nextLesson && (
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wide">Ближайший урок</span>
            <div className="text-sm text-neutral-200 mt-0.5">
              {nextLesson.studentName}
              {nextLesson.subject && <span className="text-neutral-500"> — {nextLesson.subject}</span>}
            </div>
            <div className="text-[11px] text-neutral-500">
              {nextLesson.day}, {nextLesson.time}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-4">
          <div>
            <span className="text-[11px] text-neutral-500">Учеников</span>
            <div className="text-sm font-bold text-green-400">{studentCount}</div>
          </div>
          <div>
            <span className="text-[11px] text-neutral-500">Уроков (мес.)</span>
            <div className="text-sm font-bold text-green-400">{lessonsThisMonth}</div>
          </div>
          <div>
            <span className="text-[11px] text-neutral-500">Непроверенных ДЗ</span>
            <div className={`text-sm font-bold ${pendingHomework > 0 ? 'text-yellow-400' : 'text-neutral-500'}`}>
              {pendingHomework}
            </div>
          </div>
        </div>

        {/* Payment balance */}
        {(owes.length > 0 || overpaid.length > 0) && (
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wide">Баланс оплат</span>
            <div className="mt-1 space-y-0.5">
              {owes.map((p) => (
                <div key={p.studentName} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">{p.studentName}</span>
                  <span className="text-red-400">{formatMoney(p.balance)}</span>
                </div>
              ))}
              {overpaid.map((p) => (
                <div key={p.studentName} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">{p.studentName}</span>
                  <span className="text-emerald-400">+{formatMoney(p.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetSkeleton({ color }: { color: string }) {
  return (
    <div className={`bg-neutral-900/50 border border-${color}-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]`}>
      <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
    </div>
  );
}

function formatMoney(amount: number): string {
  return Math.abs(amount).toLocaleString('ru-RU') + ' \u20BD';
}
