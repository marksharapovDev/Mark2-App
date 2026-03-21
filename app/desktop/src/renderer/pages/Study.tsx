import { useState, useRef, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

// --- Types ---

type MaterialStatus = 'done' | 'in_progress' | 'draft';
type MaterialCategory = 'lecture' | 'seminar' | 'homework' | 'typovoy' | 'coursework' | 'report' | 'notes';

interface Schedule {
  day: string;
  time: string;
  type: string;
}

interface Material {
  id: string;
  subjectId: string;
  title: string;
  category: MaterialCategory;
  status: MaterialStatus;
  date: string;
  filePath?: string;
  description?: string;
  deadline?: string;
}

interface SubjectInfo {
  id: string;
  courseId: string;
  name: string;
  professor: string;
  room?: string;
  schedule: Schedule[];
}

interface Course {
  id: string;
  name: string;
  isCurrent: boolean;
}

// --- Constants ---

const CATEGORY_META: Record<MaterialCategory, { icon: string; label: string; pluralLabel: string }> = {
  lecture: { icon: '\uD83D\uDCD2', label: 'Лекция', pluralLabel: 'Лекции' },
  seminar: { icon: '\uD83D\uDCDD', label: 'Семинар', pluralLabel: 'Семинары' },
  homework: { icon: '\uD83D\uDCCB', label: 'ДЗ', pluralLabel: 'ДЗ' },
  typovoy: { icon: '\uD83D\uDCCA', label: 'Типовой расчёт', pluralLabel: 'Типовые расчёты' },
  coursework: { icon: '\uD83D\uDCC4', label: 'Курсовая', pluralLabel: 'Курсовая' },
  report: { icon: '\uD83D\uDCCC', label: 'Доклад', pluralLabel: 'Доклады' },
  notes: { icon: '\uD83D\uDCD3', label: 'Конспект', pluralLabel: 'Конспекты' },
};

const STATUS_META: Record<MaterialStatus, { icon: string; label: string; color: string }> = {
  done: { icon: '\u2705', label: 'Сдано', color: 'bg-emerald-900/40 text-emerald-300' },
  in_progress: { icon: '\u23F3', label: 'В работе', color: 'bg-yellow-900/40 text-yellow-300' },
  draft: { icon: '\uD83D\uDCCE', label: 'Черновик', color: 'bg-neutral-700/40 text-neutral-400' },
};

// --- Mock Data ---

const COURSES: Course[] = [
  { id: 'course2', name: 'Курс 2 (текущий)', isCurrent: true },
  { id: 'course1', name: 'Курс 1', isCurrent: false },
];

const SUBJECTS: SubjectInfo[] = [
  {
    id: 'matan',
    courseId: 'course2',
    name: 'Математический анализ',
    professor: 'Иванов А.С.',
    room: '305',
    schedule: [
      { day: 'Пн', time: '10:00', type: 'лекция' },
      { day: 'Ср', time: '12:00', type: 'семинар' },
    ],
  },
  {
    id: 'physics',
    courseId: 'course2',
    name: 'Физика',
    professor: 'Петрова М.И.',
    room: '412',
    schedule: [
      { day: 'Вт', time: '14:00', type: 'лекция' },
      { day: 'Чт', time: '16:00', type: 'лаб.' },
    ],
  },
  {
    id: 'informatics',
    courseId: 'course2',
    name: 'Информатика',
    professor: 'Сидоров К.В.',
    room: '201',
    schedule: [{ day: 'Пт', time: '10:00', type: 'лекция' }],
  },
  // Course 1
  {
    id: 'algebra',
    courseId: 'course1',
    name: 'Линейная алгебра',
    professor: 'Кузнецов В.П.',
    schedule: [{ day: 'Пн', time: '08:30', type: 'лекция' }],
  },
  {
    id: 'history',
    courseId: 'course1',
    name: 'История',
    professor: 'Соколова Е.А.',
    schedule: [{ day: 'Ср', time: '10:00', type: 'лекция' }],
  },
];

const MATERIALS: Material[] = [
  // Matan
  { id: 'm1', subjectId: 'matan', title: 'Пределы функций', category: 'lecture', status: 'done', date: '2026-02-03', filePath: '/Users/marksarapov/Documents/study/matan/lec1.pdf' },
  { id: 'm2', subjectId: 'matan', title: 'Производные', category: 'lecture', status: 'done', date: '2026-02-10' },
  { id: 'm3', subjectId: 'matan', title: 'Интегралы', category: 'lecture', status: 'draft', date: '2026-03-17' },
  { id: 'm4', subjectId: 'matan', title: 'Задачи на пределы', category: 'seminar', status: 'done', date: '2026-02-05' },
  { id: 'm5', subjectId: 'matan', title: 'Задачи на производные', category: 'seminar', status: 'in_progress', date: '2026-03-12' },
  { id: 'm6', subjectId: 'matan', title: 'Пределы', category: 'homework', status: 'done', date: '2026-02-10', description: 'Вычислить пределы 15 функций, включая замечательные пределы.' },
  { id: 'm7', subjectId: 'matan', title: 'Производные', category: 'homework', status: 'in_progress', date: '2026-03-15', deadline: '2026-03-25', description: 'Найти производные сложных функций. 20 задач из сборника.' },
  { id: 'm8', subjectId: 'matan', title: 'Интегралы (часть 1)', category: 'homework', status: 'in_progress', date: '2026-03-18', deadline: '2026-04-05' },
  { id: 'm9', subjectId: 'matan', title: 'Ряды Тейлора', category: 'homework', status: 'in_progress', date: '2026-03-20', deadline: '2026-04-10' },
  { id: 'm10', subjectId: 'matan', title: 'Типовой расчёт 1', category: 'typovoy', status: 'in_progress', date: '2026-03-01', deadline: '2026-04-01', description: 'Дифференциальное исчисление функций одной переменной. 30 задач.' },

  // Physics
  { id: 'p1', subjectId: 'physics', title: 'Механика', category: 'lecture', status: 'done', date: '2026-02-04', filePath: '/Users/marksarapov/Documents/study/physics/lec1.pdf' },
  { id: 'p2', subjectId: 'physics', title: 'Термодинамика', category: 'lecture', status: 'done', date: '2026-02-18' },
  { id: 'p3', subjectId: 'physics', title: 'Измерение ускорения', category: 'seminar', status: 'done', date: '2026-02-06', description: 'Лабораторная работа: измерение ускорения свободного падения.' },
  { id: 'p4', subjectId: 'physics', title: 'Теплоёмкость', category: 'seminar', status: 'in_progress', date: '2026-03-20', deadline: '2026-03-27' },
  { id: 'p5', subjectId: 'physics', title: 'Волновая оптика', category: 'coursework', status: 'draft', date: '2026-03-01', deadline: '2026-05-15', description: 'Курсовая работа по волновой оптике. Исследование дифракции.' },
  { id: 'p6', subjectId: 'physics', title: 'Квантовая механика', category: 'report', status: 'in_progress', date: '2026-03-10', deadline: '2026-04-03', description: 'Доклад на 10-15 минут по основам квантовой механики.' },

  // Informatics
  { id: 'i1', subjectId: 'informatics', title: 'Алгоритмы сортировки', category: 'lecture', status: 'done', date: '2026-02-07' },
  { id: 'i2', subjectId: 'informatics', title: 'Реализация quicksort', category: 'homework', status: 'done', date: '2026-02-14', filePath: '/Users/marksarapov/Documents/study/informatics/quicksort.py' },
  { id: 'i3', subjectId: 'informatics', title: 'Графы и деревья', category: 'homework', status: 'in_progress', date: '2026-03-14', deadline: '2026-03-28', description: 'Реализовать BFS, DFS. Построить минимальное остовное дерево.' },
  { id: 'i4', subjectId: 'informatics', title: 'Сложность алгоритмов', category: 'notes', status: 'done', date: '2026-02-20' },

  // Course 1 (all done)
  { id: 'a1', subjectId: 'algebra', title: 'Матрицы и определители', category: 'lecture', status: 'done', date: '2025-09-05' },
  { id: 'a2', subjectId: 'algebra', title: 'Системы линейных уравнений', category: 'homework', status: 'done', date: '2025-09-20' },
  { id: 'a3', subjectId: 'algebra', title: 'Векторные пространства', category: 'notes', status: 'done', date: '2025-10-15' },
  { id: 'h1', subjectId: 'history', title: 'Древний мир', category: 'lecture', status: 'done', date: '2025-09-10' },
  { id: 'h2', subjectId: 'history', title: 'Средневековье — реферат', category: 'report', status: 'done', date: '2025-10-20' },
];

// --- Helpers ---

function getSubjectMaterials(subjectId: string): Material[] {
  return MATERIALS.filter((m) => m.subjectId === subjectId);
}

function groupByCategory(materials: Material[]): Record<MaterialCategory, Material[]> {
  const groups: Record<string, Material[]> = {};
  for (const m of materials) {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  }
  return groups as Record<MaterialCategory, Material[]>;
}

function getUpcomingDeadlines(courseId?: string): Array<Material & { subjectName: string }> {
  const subjectIds = courseId
    ? new Set(SUBJECTS.filter((s) => s.courseId === courseId).map((s) => s.id))
    : new Set(SUBJECTS.map((s) => s.id));

  return MATERIALS
    .filter((m) => m.deadline && m.status !== 'done' && subjectIds.has(m.subjectId))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 3)
    .map((m) => ({
      ...m,
      subjectName: SUBJECTS.find((s) => s.id === m.subjectId)?.name ?? '',
    }));
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function openFile(filePath: string) {
  (window as Record<string, unknown>).electronAPI
    ? (window as { electronAPI: { openFile: (p: string) => Promise<void> } }).electronAPI.openFile(filePath)
    : console.log('Would open:', filePath);
}

// --- Views ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'material-detail'; materialId: string }
  | { kind: 'category-list'; category: MaterialCategory; filter: MaterialStatus | 'all' };

// --- Collapsible Section ---

function CollapsibleCategory({
  category,
  materials,
  onMaterialClick,
}: {
  category: MaterialCategory;
  materials: Material[];
  onMaterialClick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category];

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <span className="text-[10px] text-neutral-600">{open ? '\u25BE' : '\u25B8'}</span>
        <span>{meta.icon}</span>
        <span>{meta.pluralLabel}</span>
        <span className="text-neutral-600 ml-auto">({materials.length})</span>
      </button>
      {open && (
        <div className="ml-2 space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
          {materials.map((m) => (
            <button
              key={m.id}
              onClick={() => onMaterialClick(m.id)}
              className="w-full text-left flex items-center gap-1.5 text-xs text-neutral-400 py-0.5 px-1.5 rounded hover:bg-neutral-800/50 transition-colors group"
            >
              <span className="text-[10px] shrink-0">{STATUS_META[m.status].icon}</span>
              <span className="truncate group-hover:text-neutral-200 transition-colors">{m.title}</span>
              <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">{formatDate(m.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function Study() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    COURSES.find((c) => c.isCurrent)?.id ?? COURSES[0].id,
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const courseSubjects = SUBJECTS.filter((s) => s.courseId === selectedCourseId);
  const subject = selectedSubjectId ? SUBJECTS.find((s) => s.id === selectedSubjectId) : null;
  const materials = subject ? getSubjectMaterials(subject.id) : [];
  const grouped = groupByCategory(materials);
  const deadlines = getUpcomingDeadlines(selectedCourseId);

  const selectSubject = useCallback((id: string) => {
    setSelectedSubjectId(id);
    setMainView({ kind: 'overview' });
  }, []);

  const selectCourse = useCallback((id: string) => {
    setSelectedCourseId(id);
    setSelectedSubjectId(null);
    setMainView({ kind: 'overview' });
  }, []);

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

  return (
    <MainLayout agent="study" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Level 1: Course selector */}
          <div className="px-3 py-3">
            <select
              value={selectedCourseId}
              onChange={(e) => selectCourse(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
            >
              {COURSES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Level 2: Subjects */}
          <div className="px-3 pb-1 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Предметы
          </div>
          <nav className="px-2 space-y-0.5">
            {courseSubjects.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSubject(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedSubjectId === s.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                {s.name}
              </button>
            ))}
          </nav>

          {/* Level 3: Subject details (when selected) */}
          {subject && (
            <div className="flex-1 overflow-hidden flex flex-col mt-2">
              <div className="mx-3 border-t border-neutral-800" />

              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                {/* Info section */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Информация
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-neutral-300 font-medium">{subject.name}</div>
                    <div className="text-neutral-400">
                      <span className="text-neutral-500">Преподаватель:</span> {subject.professor}
                    </div>
                    {subject.room && (
                      <div className="text-neutral-400">
                        <span className="text-neutral-500">Аудитория:</span> {subject.room}
                      </div>
                    )}
                    <div className="text-neutral-500 text-[11px] mt-1">
                      {subject.schedule.map((s) => `${s.day} ${s.time} (${s.type})`).join(', ')}
                    </div>
                  </div>
                </div>

                <div className="mx-3 border-t border-neutral-800" />

                {/* Materials by category */}
                <div className="px-3 pt-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Материалы
                  </div>
                  <div className="space-y-0.5">
                    {(Object.keys(CATEGORY_META) as MaterialCategory[])
                      .filter((cat) => grouped[cat] && grouped[cat].length > 0)
                      .map((cat) => (
                        <CollapsibleCategory
                          key={cat}
                          category={cat}
                          materials={grouped[cat]}
                          onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
                        />
                      ))}
                  </div>
                </div>

                <div className="mx-3 border-t border-neutral-800" />

                {/* Upcoming deadlines */}
                {deadlines.length > 0 && (
                  <div className="px-3 pt-3 pb-3">
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Ближайшие дедлайны
                    </div>
                    <div className="space-y-1.5">
                      {deadlines.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setMainView({ kind: 'material-detail', materialId: d.id })}
                          className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-red-400/70 text-[10px] shrink-0">
                              {formatDate(d.deadline!)}
                            </span>
                            <span className="text-neutral-500 text-[10px] truncate">{d.subjectName}</span>
                          </div>
                          <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                            {CATEGORY_META[d.category].icon} {d.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
          {!subject && (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Выберите предмет
            </div>
          )}

          {subject && mainView.kind === 'overview' && (
            <SubjectOverview
              subject={subject}
              materials={materials}
              deadlines={deadlines}
              onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
              onCategoryClick={(cat) => setMainView({ kind: 'category-list', category: cat, filter: 'all' })}
            />
          )}

          {subject && mainView.kind === 'material-detail' && (
            <MaterialDetailView
              material={materials.find((m) => m.id === mainView.materialId)
                ?? MATERIALS.find((m) => m.id === mainView.materialId)}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}

          {subject && mainView.kind === 'category-list' && (
            <CategoryListView
              subject={subject}
              category={mainView.category}
              materials={grouped[mainView.category] ?? []}
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'category-list', category: mainView.category, filter: f })}
              onMaterialClick={(id) => setMainView({ kind: 'material-detail', materialId: id })}
              onBack={() => setMainView({ kind: 'overview' })}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function SubjectOverview({
  subject,
  materials,
  deadlines,
  onMaterialClick,
  onCategoryClick,
}: {
  subject: SubjectInfo;
  materials: Material[];
  deadlines: Array<Material & { subjectName: string }>;
  onMaterialClick: (id: string) => void;
  onCategoryClick: (cat: MaterialCategory) => void;
}) {
  const total = materials.length;
  const done = materials.filter((m) => m.status === 'done').length;
  const inProgress = materials.filter((m) => m.status === 'in_progress').length;
  const draft = materials.filter((m) => m.status === 'draft').length;
  const recent = [...materials].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const grouped = groupByCategory(materials);

  return (
    <div className="max-w-2xl">
      {/* Subject card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold mb-1">{subject.name}</h1>
        <p className="text-neutral-400 text-sm mb-2">{subject.professor}</p>
        <div className="text-xs text-neutral-500">
          {subject.room && <><span>Ауд. {subject.room}</span><span className="mx-2">&middot;</span></>}
          {subject.schedule.map((s) => `${s.day} ${s.time} (${s.type})`).join(', ')}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatBadge label="Всего" count={total} color="text-blue-400 bg-blue-400/10" />
        <StatBadge label="Сдано" count={done} color="text-emerald-400 bg-emerald-400/10" />
        <StatBadge label="В работе" count={inProgress} color="text-yellow-400 bg-yellow-400/10" />
        {draft > 0 && <StatBadge label="Черновик" count={draft} color="text-neutral-400 bg-neutral-400/10" />}
      </div>

      {/* Deadlines */}
      {deadlines.filter((d) => d.subjectId === subject.id).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Ближайшие дедлайны</h2>
          <div className="space-y-2">
            {deadlines
              .filter((d) => d.subjectId === subject.id)
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => onMaterialClick(d.id)}
                  className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
                >
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="text-red-400/80 text-xs shrink-0">{formatDate(d.deadline!)}</span>
                    <span className="text-neutral-300">
                      {CATEGORY_META[d.category].icon} {d.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${STATUS_META[d.status].color}`}>
                      {STATUS_META[d.status].label}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Materials by category (clickable) */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Материалы по категориям</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORY_META) as MaterialCategory[])
            .filter((cat) => grouped[cat] && grouped[cat].length > 0)
            .map((cat) => {
              const catMaterials = grouped[cat];
              const catDone = catMaterials.filter((m) => m.status === 'done').length;
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryClick(cat)}
                  className="text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-3 py-2.5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{CATEGORY_META[cat].icon}</span>
                    <span className="text-neutral-300">{CATEGORY_META[cat].pluralLabel}</span>
                    <span className="text-neutral-600 text-xs ml-auto">{catDone}/{catMaterials.length}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Recent materials */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последние добавленные</h2>
        <div className="space-y-2">
          {recent.map((m) => (
            <button
              key={m.id}
              onClick={() => onMaterialClick(m.id)}
              className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm shrink-0">{STATUS_META[m.status].icon}</span>
                <span className="text-sm text-neutral-300">
                  {CATEGORY_META[m.category].icon} {m.title}
                </span>
                <span className="text-neutral-600 text-[10px] shrink-0 ml-auto">{formatDate(m.date)}</span>
              </div>
            </button>
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

function MaterialDetailView({
  material,
  onBack,
}: {
  material: Material | undefined;
  onBack: () => void;
}) {
  if (!material) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Материал не найден</p>
      </div>
    );
  }

  const subject = SUBJECTS.find((s) => s.id === material.subjectId);

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_META[material.status].color}`}>
          {STATUS_META[material.status].icon} {STATUS_META[material.status].label}
        </span>
        <span className="text-neutral-600 text-xs">
          {CATEGORY_META[material.category].icon} {CATEGORY_META[material.category].label}
        </span>
        <span className="text-neutral-500 text-sm">{formatDate(material.date)}</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{material.title}</h1>
      {subject && <p className="text-neutral-500 text-sm mb-6">{subject.name}</p>}

      {/* Deadline */}
      {material.deadline && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Дедлайн
          </h2>
          <p className="text-neutral-300 text-sm">{formatDate(material.deadline)}</p>
        </div>
      )}

      {/* Description */}
      {material.description && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Описание
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{material.description}</p>
        </div>
      )}

      {/* File button */}
      {material.filePath ? (
        <button
          onClick={() => openFile(material.filePath!)}
          className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300 hover:bg-blue-900/50 transition-colors"
        >
          <span>\uD83D\uDCC4</span> Посмотреть файл
        </button>
      ) : (
        <div className="text-xs text-neutral-600 mt-2">
          Файл не прикреплён. Можно создать через чат.
        </div>
      )}
    </div>
  );
}

function CategoryListView({
  subject,
  category,
  materials,
  filter,
  onFilterChange,
  onMaterialClick,
  onBack,
}: {
  subject: SubjectInfo;
  category: MaterialCategory;
  materials: Material[];
  filter: MaterialStatus | 'all';
  onFilterChange: (f: MaterialStatus | 'all') => void;
  onMaterialClick: (id: string) => void;
  onBack: () => void;
}) {
  const filtered = filter === 'all' ? materials : materials.filter((m) => m.status === filter);
  const filters: Array<{ value: MaterialStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'done', label: 'Сдано' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'draft', label: 'Черновик' },
  ];

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>
      <h1 className="text-2xl font-bold mb-1">{subject.name}</h1>
      <h2 className="text-neutral-500 text-sm mb-6">
        {CATEGORY_META[category].icon} {CATEGORY_META[category].pluralLabel}
      </h2>

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

      {/* List */}
      <div className="space-y-2">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => onMaterialClick(m.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0">{STATUS_META[m.status].icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{m.title}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  {formatDate(m.date)}
                  {m.deadline && <span className="ml-2">Дедлайн: {formatDate(m.deadline)}</span>}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_META[m.status].color}`}>
                {STATUS_META[m.status].label}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет материалов с таким статусом</div>
        )}
      </div>
    </div>
  );
}
