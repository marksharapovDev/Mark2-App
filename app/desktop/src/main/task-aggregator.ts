import * as db from './db-service';

export interface AggregatedTask {
  id: string;
  title: string;
  time: string | null;
  sphere: string;
  priority: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  isReminder: boolean;
}

const DAY_NAMES_RU: Record<string, number> = {
  'Пн': 1, 'Вт': 2, 'Ср': 3, 'Чт': 4, 'Пт': 5, 'Сб': 6, 'Вс': 0,
};

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function parseDayOfWeek(dayStr: string): number | null {
  return DAY_NAMES_RU[dayStr] ?? null;
}

export async function getAggregatedTasks(date: Date): Promise<AggregatedTask[]> {
  const dateStr = formatDate(date);
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...

  const results: AggregatedTask[] = [];

  // --- Teaching: lessons by student schedule ---
  try {
    const students = await db.getStudents();
    for (const student of students) {
      if (!student.schedule) continue;
      const scheduleArr = Array.isArray(student.schedule) ? student.schedule : [];
      for (const slot of scheduleArr) {
        const s = slot as { day?: string; time?: string };
        if (!s.day) continue;
        const slotDay = parseDayOfWeek(s.day);
        if (slotDay === dayOfWeek) {
          results.push({
            id: `teaching-${student.id}-${s.day}`,
            title: `Урок ${student.name}${student.subject ? ` (${student.subject})` : ''}`,
            time: (s.time as string) || null,
            sphere: 'teaching',
            priority: 'medium',
            status: 'pending',
            sourceType: 'teaching_lesson',
            sourceId: student.id,
            isReminder: false,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Aggregator] Teaching error:', err);
  }

  // --- Dev: tasks with deadline === date ---
  try {
    const projects = await db.getProjects();
    for (const project of projects) {
      if (project.status !== 'active') continue;
      const tasks = await db.getDevTasks(project.id);
      for (const task of tasks) {
        if (task.status === 'done') continue;
        if (task.deadline && task.deadline.startsWith(dateStr)) {
          results.push({
            id: task.id,
            title: `${task.title} (${project.name})`,
            time: null,
            sphere: 'dev',
            priority: task.priority,
            status: task.status,
            sourceType: 'dev_task',
            sourceId: task.id,
            isReminder: false,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Aggregator] Dev error:', err);
  }

  // --- Study: assignments with deadline === date, exams with date === date ---
  try {
    const assignments = await db.getStudyAssignments();
    for (const a of assignments) {
      if (a.status === 'submitted' || a.status === 'graded') continue;
      if (a.deadline && a.deadline.startsWith(dateStr)) {
        results.push({
          id: a.id,
          title: a.title,
          time: null,
          sphere: 'study',
          priority: 'high',
          status: a.status,
          sourceType: 'study_assignment',
          sourceId: a.id,
          isReminder: false,
        });
      }
    }

    const exams = await db.getStudyExams();
    for (const e of exams) {
      if (e.status === 'passed' || e.status === 'failed') continue;
      if (e.date && e.date.startsWith(dateStr)) {
        results.push({
          id: e.id,
          title: e.title,
          time: null,
          sphere: 'study',
          priority: 'urgent',
          status: e.status,
          sourceType: 'study_exam',
          sourceId: e.id,
          isReminder: false,
        });
      }
    }
  } catch (err) {
    console.warn('[Aggregator] Study error:', err);
  }

  // --- Finance: recurring subscriptions by date ---
  try {
    const transactions = await db.getTransactions({ dateFrom: dateStr, dateTo: dateStr });
    for (const t of transactions) {
      if (t.isRecurring && t.date === dateStr) {
        results.push({
          id: t.id,
          title: `${t.description || t.category}: ${t.amount}₽`,
          time: null,
          sphere: 'finance',
          priority: 'medium',
          status: 'pending',
          sourceType: 'finance_tax',
          sourceId: t.id,
          isReminder: false,
        });
      }
    }
  } catch (err) {
    console.warn('[Aggregator] Finance error:', err);
  }

  // --- Health: training program day matching ---
  try {
    const programs = await db.getTrainingPrograms();
    for (const program of programs) {
      if (program.status !== 'active') continue;
      const days = await db.getTrainingProgramDays(program.id);
      if (days.length === 0) continue;
      // Calculate which day index based on program start and current date
      const programStart = new Date(program.createdAt);
      const diffMs = date.getTime() - programStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) continue;
      const dayIndex = diffDays % days.length;
      const programDay = days[dayIndex];
      if (programDay) {
        results.push({
          id: `health-${program.id}-${dateStr}`,
          title: `${programDay.dayName} (${program.name})`,
          time: null,
          sphere: 'health',
          priority: 'medium',
          status: 'pending',
          sourceType: 'health_workout',
          sourceId: program.id,
          isReminder: false,
        });
      }
    }
  } catch (err) {
    console.warn('[Aggregator] Health error:', err);
  }

  // --- Reminders ---
  try {
    const reminders = await db.getReminders({ dateFrom: dateStr, dateTo: dateStr });
    for (const r of reminders) {
      results.push({
        id: r.id,
        title: r.title,
        time: r.time,
        sphere: r.sphere || 'personal',
        priority: r.priority,
        status: r.status,
        sourceType: r.sourceType || 'manual',
        sourceId: r.sourceId,
        isReminder: true,
      });
    }
  } catch (err) {
    console.warn('[Aggregator] Reminders error:', err);
  }

  // Sort: urgent first, then by time
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  results.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  return results;
}
