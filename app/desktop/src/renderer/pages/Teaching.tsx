import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

// --- Mock Types ---

type StudentLevel = 'beginner' | 'intermediate' | 'advanced';
type HomeworkStatus = 'done' | 'upcoming' | 'overdue';
type LessonStatus = 'planned' | 'completed';
type TopicStatus = 'done' | 'current' | 'upcoming';

interface ScheduleSlot {
  day: string;
  time: string;
}

interface MockStudent {
  id: string;
  name: string;
  subject: string;
  level: StudentLevel;
  schedule: ScheduleSlot[];
  startDate: string;
  totalLessons: number;
}

interface MockLesson {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  status: LessonStatus;
  notes: string;
  homeworkGiven?: string;
}

interface MockHomework {
  id: string;
  studentId: string;
  lessonId: string;
  title: string;
  description: string;
  dueDate: string;
  status: HomeworkStatus;
  grade?: string;
  comment?: string;
}

interface MockTopic {
  id: string;
  studentId: string;
  title: string;
  status: TopicStatus;
}

// --- Mock Data ---

const MOCK_STUDENTS: MockStudent[] = [
  {
    id: 'misha',
    name: 'Миша Козлов',
    subject: 'Информатика (ЕГЭ)',
    level: 'intermediate',
    schedule: [
      { day: 'Вт', time: '17:00' },
      { day: 'Сб', time: '11:00' },
    ],
    startDate: '2025-12-10',
    totalLessons: 12,
  },
  {
    id: 'anya',
    name: 'Аня Смирнова',
    subject: 'Python',
    level: 'beginner',
    schedule: [{ day: 'Ср', time: '15:00' }],
    startDate: '2026-02-05',
    totalLessons: 6,
  },
];

const MOCK_LESSONS: MockLesson[] = [
  // Misha
  {
    id: 'l1',
    studentId: 'misha',
    date: '2026-03-15',
    topic: 'Системы счисления — перевод из 10 в 2, 8, 16',
    status: 'completed',
    notes: 'Разобрали алгоритм перевода. Миша быстро понял двоичную систему, восьмеричная далась сложнее.',
    homeworkGiven: 'Перевести 10 чисел между системами счисления',
  },
  {
    id: 'l2',
    studentId: 'misha',
    date: '2026-03-18',
    topic: 'Логические выражения — таблицы истинности',
    status: 'completed',
    notes: 'Таблицы истинности для AND, OR, NOT, XOR. Начали составлять выражения по таблицам.',
    homeworkGiven: 'Составить таблицы истинности для 5 выражений',
  },
  {
    id: 'l3',
    studentId: 'misha',
    date: '2026-03-22',
    topic: 'Задание 5 ЕГЭ — анализ алгоритмов',
    status: 'completed',
    notes: 'Разбирали типичные задачи на анализ алгоритмов из ЕГЭ. Трассировка циклов.',
    homeworkGiven: 'Решить 8 задач из сборника',
  },
  {
    id: 'l4',
    studentId: 'misha',
    date: '2026-03-25',
    topic: 'Рекурсия — базовые понятия',
    status: 'planned',
    notes: '',
  },
  {
    id: 'l5',
    studentId: 'misha',
    date: '2026-03-29',
    topic: 'Массивы — сортировка, поиск',
    status: 'planned',
    notes: '',
  },
  // Anya
  {
    id: 'l6',
    studentId: 'anya',
    date: '2026-03-12',
    topic: 'Переменные и типы данных',
    status: 'completed',
    notes: 'Разобрали int, float, str, bool. Аня хорошо поняла разницу типов.',
    homeworkGiven: 'Написать программу-калькулятор',
  },
  {
    id: 'l7',
    studentId: 'anya',
    date: '2026-03-19',
    topic: 'Условия if/elif/else',
    status: 'completed',
    notes: 'Условные конструкции, вложенные условия. Практика на простых задачах.',
    homeworkGiven: 'Написать программу с меню из 3 пунктов',
  },
  {
    id: 'l8',
    studentId: 'anya',
    date: '2026-03-26',
    topic: 'Циклы while и for',
    status: 'planned',
    notes: '',
  },
];

const MOCK_HOMEWORKS: MockHomework[] = [
  // Misha
  {
    id: 'h1',
    studentId: 'misha',
    lessonId: 'l1',
    title: 'Перевод чисел между системами',
    description: 'Перевести 10 чисел между двоичной, восьмеричной, десятичной и шестнадцатеричной системами счисления.',
    dueDate: '2026-03-18',
    status: 'done',
    grade: '5',
    comment: 'Всё верно, отличная работа!',
  },
  {
    id: 'h2',
    studentId: 'misha',
    lessonId: 'l2',
    title: 'Таблицы истинности',
    description: 'Составить таблицы истинности для 5 логических выражений с 2-3 переменными.',
    dueDate: '2026-03-22',
    status: 'done',
    grade: '4',
    comment: 'В 4-м выражении ошибка в приоритете операций, остальное верно.',
  },
  {
    id: 'h3',
    studentId: 'misha',
    lessonId: 'l3',
    title: 'Задачи на анализ алгоритмов',
    description: 'Решить 8 задач формата задания 5 ЕГЭ из сборника Полякова.',
    dueDate: '2026-03-25',
    status: 'done',
    grade: '4',
    comment: 'Решено 7 из 8, в последней задаче ошибка в трассировке цикла.',
  },
  {
    id: 'h4',
    studentId: 'misha',
    lessonId: 'l4',
    title: 'Рекурсивные функции',
    description: 'Написать 3 рекурсивные функции: факториал, Фибоначчи, степень числа.',
    dueDate: '2026-03-29',
    status: 'upcoming',
  },
  {
    id: 'h5',
    studentId: 'misha',
    lessonId: 'l3',
    title: 'Дополнительные задачи ЕГЭ',
    description: 'Решить задачи 6-10 из демоверсии ЕГЭ 2026.',
    dueDate: '2026-03-20',
    status: 'overdue',
  },
  // Anya
  {
    id: 'h6',
    studentId: 'anya',
    lessonId: 'l6',
    title: 'Программа-калькулятор',
    description: 'Написать программу, которая принимает два числа и операцию (+, -, *, /) и выводит результат.',
    dueDate: '2026-03-19',
    status: 'done',
    grade: '5',
    comment: 'Отлично! Даже добавила проверку деления на ноль.',
  },
  {
    id: 'h7',
    studentId: 'anya',
    lessonId: 'l7',
    title: 'Программа с меню',
    description: 'Написать программу с меню из 3 пунктов, использовать if/elif/else.',
    dueDate: '2026-03-26',
    status: 'done',
    grade: '5',
    comment: 'Хорошо структурированный код.',
  },
  {
    id: 'h8',
    studentId: 'anya',
    lessonId: 'l8',
    title: 'Задачи на циклы',
    description: 'Решить 5 задач на циклы while и for из учебника.',
    dueDate: '2026-04-02',
    status: 'upcoming',
  },
];

const MOCK_TOPICS: MockTopic[] = [
  // Misha
  { id: 'tp1', studentId: 'misha', title: 'Системы счисления', status: 'done' },
  { id: 'tp2', studentId: 'misha', title: 'Логика', status: 'done' },
  { id: 'tp3', studentId: 'misha', title: 'Алгоритмы', status: 'current' },
  { id: 'tp4', studentId: 'misha', title: 'Программирование', status: 'upcoming' },
  { id: 'tp5', studentId: 'misha', title: 'Базы данных', status: 'upcoming' },
  { id: 'tp6', studentId: 'misha', title: 'Сети и интернет', status: 'upcoming' },
  // Anya
  { id: 'tp7', studentId: 'anya', title: 'Переменные', status: 'done' },
  { id: 'tp8', studentId: 'anya', title: 'Условия', status: 'done' },
  { id: 'tp9', studentId: 'anya', title: 'Циклы', status: 'current' },
  { id: 'tp10', studentId: 'anya', title: 'Функции', status: 'upcoming' },
  { id: 'tp11', studentId: 'anya', title: 'Списки', status: 'upcoming' },
  { id: 'tp12', studentId: 'anya', title: 'Словари', status: 'upcoming' },
];

// --- Helpers ---

const HW_STATUS_ICON: Record<HomeworkStatus, string> = {
  done: '\u2705',
  upcoming: '\u23F3',
  overdue: '\u274C',
};

const HW_STATUS_LABEL: Record<HomeworkStatus, string> = {
  done: 'Выполнена',
  upcoming: 'Предстоит',
  overdue: 'Не сдана',
};

const TOPIC_ICON: Record<TopicStatus, string> = {
  done: '\u2705',
  current: '\uD83D\uDD04',
  upcoming: '\u23F3',
};

const LEVEL_LABEL: Record<StudentLevel, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

const LEVEL_COLOR: Record<StudentLevel, string> = {
  beginner: 'bg-green-900/40 text-green-300',
  intermediate: 'bg-yellow-900/40 text-yellow-300',
  advanced: 'bg-purple-900/40 text-purple-300',
};

function getStudentLessons(studentId: string): MockLesson[] {
  return MOCK_LESSONS.filter((l) => l.studentId === studentId);
}

function getStudentHomeworks(studentId: string): MockHomework[] {
  return MOCK_HOMEWORKS.filter((h) => h.studentId === studentId);
}

function getStudentTopics(studentId: string): MockTopic[] {
  return MOCK_TOPICS.filter((t) => t.studentId === studentId);
}

function hwStats(homeworks: MockHomework[]) {
  const counts: Record<string, number> = { done: 0, upcoming: 0, overdue: 0 };
  for (const h of homeworks) counts[h.status]++;
  return counts;
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'all-homeworks'; filter: HomeworkStatus | 'all' }
  | { kind: 'lesson-detail'; lessonId: string }
  | { kind: 'homework-detail'; homeworkId: string };

// --- Component ---

export function Teaching() {
  const [activeStudentId, setActiveStudentId] = useState<string>(
    MOCK_STUDENTS[MOCK_STUDENTS.length - 1].id,
  );
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [visibleLessons, setVisibleLessons] = useState(10);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const student = MOCK_STUDENTS.find((s) => s.id === activeStudentId);
  const lessons = student ? getStudentLessons(student.id) : [];
  const homeworks = student ? getStudentHomeworks(student.id) : [];
  const topics = student ? getStudentTopics(student.id) : [];

  const selectStudent = useCallback((id: string) => {
    setActiveStudentId(id);
    setMainView({ kind: 'overview' });
    setVisibleLessons(10);
  }, []);

  const handleLessonsScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        setVisibleLessons((v) => Math.min(v + 10, lessons.length));
      }
    },
    [lessons.length],
  );

  // Sidebar drag resize
  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-sidebar-width', String(w));
    };
    const onUp = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    setVisibleLessons(10);
  }, [activeStudentId]);

  // Upcoming lessons (next 2-3)
  const upcomingLessons = lessons
    .filter((l) => l.status === 'planned')
    .slice(0, 3);

  // Recent homeworks (last 4)
  const recentHomeworks = homeworks.slice(0, 4);

  return (
    <MainLayout agent="teaching" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Level 1: Students */}
          <div className="px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Students
          </div>
          <nav className="px-2 space-y-0.5">
            {MOCK_STUDENTS.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  activeStudentId === s.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                {s.name}
              </button>
            ))}
          </nav>

          {/* Level 2: Student details */}
          {student && (
            <div className="flex-1 overflow-hidden flex flex-col mt-2">
              <div className="mx-3 border-t border-neutral-800" />

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                {/* Info */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Информация
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-neutral-300 font-medium">{student.name}</div>
                    <div className="text-neutral-400">{student.subject}</div>
                    <div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LEVEL_COLOR[student.level]}`}
                      >
                        {LEVEL_LABEL[student.level]}
                      </span>
                    </div>
                    <div className="text-neutral-500 text-[11px] mt-1">
                      {student.schedule.map((s) => `${s.day} ${s.time}`).join(', ')}
                    </div>
                  </div>
                </div>

                <div className="mx-3 border-t border-neutral-800" />

                {/* Upcoming lessons */}
                {upcomingLessons.length > 0 && (
                  <>
                    <div className="px-3 pt-3 pb-2">
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Ближайшие уроки
                      </div>
                      <div className="space-y-1.5">
                        {upcomingLessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setMainView({ kind: 'lesson-detail', lessonId: lesson.id })}
                            className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-neutral-600 text-[10px] shrink-0">
                                {lesson.date.slice(5)}
                              </span>
                              <span className="text-[10px] text-blue-400/70">запланирован</span>
                            </div>
                            <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                              {lesson.topic}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mx-3 border-t border-neutral-800" />
                  </>
                )}

                {/* Homeworks */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Домашки
                  </div>
                  <div className="space-y-1">
                    {recentHomeworks.map((hw) => (
                      <button
                        key={hw.id}
                        onClick={() => setMainView({ kind: 'homework-detail', homeworkId: hw.id })}
                        className="w-full text-left flex items-center gap-1.5 text-xs text-neutral-400 py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                      >
                        <span className="text-[11px] shrink-0">{HW_STATUS_ICON[hw.status]}</span>
                        <span className="truncate group-hover:text-neutral-200 transition-colors">
                          {hw.title}
                        </span>
                        <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">
                          {hw.dueDate.slice(5)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {homeworks.length > 4 && (
                    <button
                      onClick={() => setMainView({ kind: 'all-homeworks', filter: 'all' })}
                      className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      ... Все домашки ({homeworks.length})
                    </button>
                  )}
                </div>

                <div className="mx-3 border-t border-neutral-800" />

                {/* Learning path */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Путь обучения
                  </div>
                  <div className="space-y-1">
                    {topics.map((topic) => (
                      <div
                        key={topic.id}
                        className={`flex items-center gap-1.5 text-xs ${
                          topic.status === 'current'
                            ? 'text-neutral-200'
                            : 'text-neutral-400'
                        }`}
                      >
                        <span className="text-[11px] shrink-0">{TOPIC_ICON[topic.status]}</span>
                        <span className="truncate">{topic.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mx-3 border-t border-neutral-800" />

                {/* Lesson history */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    История уроков
                  </div>
                  <div
                    className="space-y-0.5"
                    onScroll={handleLessonsScroll}
                  >
                    {lessons.slice(0, visibleLessons).map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => setMainView({ kind: 'lesson-detail', lessonId: lesson.id })}
                        className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                      >
                        <span className="text-neutral-600 mr-1.5 text-[10px]">
                          {lesson.date.slice(5)}
                        </span>
                        <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors">
                          {lesson.topic}
                        </span>
                        {lesson.notes && (
                          <div className="text-neutral-600 text-[10px] truncate mt-0.5">
                            {lesson.notes}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={handleSidebarDragStart}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
        />

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-auto p-6">
          {student && mainView.kind === 'overview' && (
            <StudentOverview
              student={student}
              lessons={lessons}
              homeworks={homeworks}
              topics={topics}
              onLessonClick={(id) => setMainView({ kind: 'lesson-detail', lessonId: id })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
            />
          )}
          {student && mainView.kind === 'all-homeworks' && (
            <AllHomeworksView
              student={student}
              homeworks={homeworks}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'all-homeworks', filter: f })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
          {student && mainView.kind === 'lesson-detail' && (
            <LessonDetailView
              lesson={lessons.find((l) => l.id === mainView.lessonId)}
              homeworks={homeworks.filter((h) => h.lessonId === mainView.lessonId)}
              onBack={() => setMainView({ kind: 'overview' })}
              onHomeworkClick={(id) => setMainView({ kind: 'homework-detail', homeworkId: id })}
            />
          )}
          {student && mainView.kind === 'homework-detail' && (
            <HomeworkDetailView
              homework={homeworks.find((h) => h.id === mainView.homeworkId)}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function StudentOverview({
  student,
  lessons,
  homeworks,
  topics,
  onLessonClick,
  onHomeworkClick,
}: {
  student: MockStudent;
  lessons: MockLesson[];
  homeworks: MockHomework[];
  topics: MockTopic[];
  onLessonClick: (id: string) => void;
  onHomeworkClick: (id: string) => void;
}) {
  const stats = hwStats(homeworks);
  const upcomingLessons = lessons.filter((l) => l.status === 'planned').slice(0, 3);
  const lastDoneHomework = homeworks.filter((h) => h.status === 'done').at(-1);

  return (
    <div className="max-w-2xl">
      {/* Student card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
            <p className="text-neutral-400 text-sm">{student.subject}</p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-medium ${LEVEL_COLOR[student.level]}`}
          >
            {LEVEL_LABEL[student.level]}
          </span>
        </div>
        <div className="text-xs text-neutral-500">
          Занимаемся с {formatDate(student.startDate)}
          <span className="mx-2">&middot;</span>
          {student.schedule.map((s) => `${s.day} ${s.time}`).join(', ')}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatBadge label="Уроков" count={student.totalLessons} color="text-blue-400 bg-blue-400/10" />
        <StatBadge label="ДЗ выполнено" count={stats.done} color="text-emerald-400 bg-emerald-400/10" />
        <StatBadge label="ДЗ предстоит" count={stats.upcoming} color="text-yellow-400 bg-yellow-400/10" />
        {stats.overdue > 0 && (
          <StatBadge label="Просрочено" count={stats.overdue} color="text-red-400 bg-red-400/10" />
        )}
      </div>

      {/* Upcoming lessons */}
      {upcomingLessons.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Ближайшие уроки</h2>
          <div className="space-y-2">
            {upcomingLessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onLessonClick(lesson.id)}
                className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
              >
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="text-neutral-500 text-xs shrink-0">{formatDate(lesson.date)}</span>
                  <span className="text-neutral-300">{lesson.topic}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Last homework */}
      {lastDoneHomework && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последнее ДЗ</h2>
          <button
            onClick={() => onHomeworkClick(lastDoneHomework.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{HW_STATUS_ICON[lastDoneHomework.status]}</span>
              <span className="text-sm text-neutral-300">{lastDoneHomework.title}</span>
            </div>
            <p className="text-xs text-neutral-500">{lastDoneHomework.description}</p>
            {lastDoneHomework.grade && (
              <div className="mt-2 text-xs">
                <span className="text-neutral-600 mr-1">Оценка:</span>
                <span className="text-neutral-300">{lastDoneHomework.grade}</span>
                {lastDoneHomework.comment && (
                  <span className="text-neutral-500 ml-2">— {lastDoneHomework.comment}</span>
                )}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Learning path overview */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Путь обучения</h2>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic.id}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                topic.status === 'done'
                  ? 'border-emerald-800/50 bg-emerald-900/20 text-emerald-400'
                  : topic.status === 'current'
                    ? 'border-blue-800/50 bg-blue-900/20 text-blue-400'
                    : 'border-neutral-800 bg-neutral-900/30 text-neutral-500'
              }`}
            >
              {TOPIC_ICON[topic.status]} {topic.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg shadow-sm shadow-black/10 ${color}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function AllHomeworksView({
  student,
  homeworks,
  filter,
  onFilterChange,
  onHomeworkClick,
  onBack,
}: {
  student: MockStudent;
  homeworks: MockHomework[];
  filter: HomeworkStatus | 'all';
  onFilterChange: (f: HomeworkStatus | 'all') => void;
  onHomeworkClick: (id: string) => void;
  onBack: () => void;
}) {
  const filtered = filter === 'all' ? homeworks : homeworks.filter((h) => h.status === filter);
  const filters: Array<{ value: HomeworkStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'done', label: 'Выполнено' },
    { value: 'upcoming', label: 'Предстоит' },
    { value: 'overdue', label: 'Просрочено' },
  ];

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>
      <h1 className="text-2xl font-bold mb-1">{student.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">Все домашние задания</h2>

      {/* Filters */}
      <div className="flex gap-1 mb-6">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Homework list */}
      <div className="space-y-2">
        {filtered.map((hw) => (
          <button
            key={hw.id}
            onClick={() => onHomeworkClick(hw.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0">{HW_STATUS_ICON[hw.status]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{hw.title}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  Срок: {formatDate(hw.dueDate)}
                  {hw.grade && <span className="ml-2">Оценка: {hw.grade}</span>}
                </div>
              </div>
              <span className="text-[10px] text-neutral-600 uppercase shrink-0">
                {HW_STATUS_LABEL[hw.status]}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет домашек с таким статусом</div>
        )}
      </div>
    </div>
  );
}

function LessonDetailView({
  lesson,
  homeworks,
  onBack,
  onHomeworkClick,
}: {
  lesson: MockLesson | undefined;
  homeworks: MockHomework[];
  onBack: () => void;
  onHomeworkClick: (id: string) => void;
}) {
  if (!lesson) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Урок не найден</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            lesson.status === 'completed'
              ? 'bg-emerald-900/40 text-emerald-300'
              : 'bg-blue-900/40 text-blue-300'
          }`}
        >
          {lesson.status === 'completed' ? 'Проведён' : 'Запланирован'}
        </span>
        <span className="text-neutral-500 text-sm">{formatDate(lesson.date)}</span>
      </div>

      <h1 className="text-xl font-bold mb-6">{lesson.topic}</h1>

      {/* Notes */}
      {lesson.notes && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Заметки
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{lesson.notes}</p>
        </div>
      )}

      {/* Homework given */}
      {lesson.homeworkGiven && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Заданное ДЗ
          </h2>
          <p className="text-neutral-300 text-sm">{lesson.homeworkGiven}</p>
        </div>
      )}

      {/* Related homeworks */}
      {homeworks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Домашние задания
          </h2>
          <div className="space-y-2">
            {homeworks.map((hw) => (
              <button
                key={hw.id}
                onClick={() => onHomeworkClick(hw.id)}
                className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{HW_STATUS_ICON[hw.status]}</span>
                  <span className="text-sm text-neutral-300">{hw.title}</span>
                  <span className="text-[10px] text-neutral-600 uppercase ml-auto">
                    {HW_STATUS_LABEL[hw.status]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkDetailView({
  homework,
  onBack,
}: {
  homework: MockHomework | undefined;
  onBack: () => void;
}) {
  if (!homework) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Домашнее задание не найдено</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg">{HW_STATUS_ICON[homework.status]}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            homework.status === 'done'
              ? 'bg-emerald-900/40 text-emerald-300'
              : homework.status === 'upcoming'
                ? 'bg-yellow-900/40 text-yellow-300'
                : 'bg-red-900/40 text-red-300'
          }`}
        >
          {HW_STATUS_LABEL[homework.status]}
        </span>
      </div>

      <h1 className="text-xl font-bold mb-1">{homework.title}</h1>
      <div className="text-neutral-500 text-sm mb-6">Срок: {formatDate(homework.dueDate)}</div>

      {/* Description */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6 shadow-sm shadow-black/10">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Задание
        </h2>
        <p className="text-neutral-300 text-sm leading-relaxed">{homework.description}</p>
      </div>

      {/* Grade & comment */}
      {homework.grade && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Оценка
          </h2>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-neutral-200">{homework.grade}</span>
            {homework.comment && (
              <span className="text-sm text-neutral-400">{homework.comment}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Utils ---

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}
