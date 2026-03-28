import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useSidebar } from '../context/sidebar-context';
import type { Subject, StudyAssignment, StudyExam, TaskStatus } from '@mark2/shared';
import {
  BookOpen, PenLine, ClipboardList, BarChart3, FileText, MapPin, NotebookText,
  CheckCircle2, Clock, RefreshCw, Loader2, Plus, Trash2,
  GraduationCap, Calendar, FolderOpen, FileQuestion, Save, Sparkles,
  ChevronRight, ChevronDown, File, Folder, Eye, Pencil,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

// --- Types ---

type AssignmentType = StudyAssignment['type'];
type AssignmentStatus = StudyAssignment['status'];
type ExamType = StudyExam['type'];
type ExamStatus = StudyExam['status'];
type Priority = 'low' | 'medium' | 'high';
type SidebarTab = 'subjects' | 'general';
type SubjectTab = 'assignments' | 'exams' | 'files' | 'notes';

interface StudyTask {
  id: string;
  subjectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Constants ---

const ASSIGNMENT_TYPE_META: Record<AssignmentType, { icon: React.ReactNode; label: string }> = {
  homework: { icon: <ClipboardList size={14} strokeWidth={1.5} />, label: 'ДЗ' },
  lab_report: { icon: <BarChart3 size={14} strokeWidth={1.5} />, label: 'Лаб. работа' },
  essay: { icon: <PenLine size={14} strokeWidth={1.5} />, label: 'Эссе' },
  project: { icon: <FolderOpen size={14} strokeWidth={1.5} />, label: 'Проект' },
  presentation: { icon: <MapPin size={14} strokeWidth={1.5} />, label: 'Презентация' },
  typical_calc: { icon: <BarChart3 size={14} strokeWidth={1.5} />, label: 'Типовой расчёт' },
  coursework: { icon: <FileText size={14} strokeWidth={1.5} />, label: 'Курсовая' },
  report: { icon: <BookOpen size={14} strokeWidth={1.5} />, label: 'Доклад' },
  other: { icon: <FileQuestion size={14} strokeWidth={1.5} />, label: 'Другое' },
};

const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Ожидает', color: 'bg-neutral-700/40 text-neutral-400', icon: <Clock size={14} strokeWidth={1.5} className="text-neutral-400" /> },
  in_progress: { label: 'В работе', color: 'bg-yellow-900/40 text-yellow-300', icon: <RefreshCw size={14} strokeWidth={1.5} className="text-yellow-400" /> },
  submitted: { label: 'Сдано', color: 'bg-blue-900/40 text-blue-300', icon: <CheckCircle2 size={14} strokeWidth={1.5} className="text-blue-400" /> },
  graded: { label: 'Оценено', color: 'bg-emerald-900/40 text-emerald-300', icon: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400" /> },
};

const EXAM_TYPE_META: Record<ExamType, string> = {
  exam: 'Экзамен',
  credit: 'Зачёт',
  test: 'Контрольная',
  midterm: 'Промежуточная',
};

const EXAM_STATUS_META: Record<ExamStatus, { label: string; color: string }> = {
  upcoming: { label: 'Предстоит', color: 'bg-blue-900/40 text-blue-300' },
  passed: { label: 'Сдан', color: 'bg-emerald-900/40 text-emerald-300' },
  failed: { label: 'Не сдан', color: 'bg-red-900/40 text-red-300' },
};

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string; label: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400', label: 'Low' },
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  done: 'text-emerald-400',
  in_progress: 'text-blue-400',
  todo: 'text-yellow-400',
  cancelled: 'text-red-400',
};

const DEFAULT_SUBJECT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

// --- Helpers ---

const PRIORITY_FROM_INT: Record<number, Priority> = { 0: 'low', 1: 'medium', 2: 'high' };

function mapDbTaskToStudy(t: Record<string, unknown>): StudyTask {
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const dueDate = t.dueDate ? new Date(t.dueDate as string).toISOString().slice(0, 10) : null;
  return {
    id: String(t.id),
    subjectId: String(meta.subjectId ?? ''),
    title: String(t.title),
    status: (t.status as TaskStatus) ?? 'todo',
    priority: PRIORITY_FROM_INT[t.priority as number] ?? 'low',
    context: String(t.description ?? ''),
    deadline: dueDate,
  };
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function getDeadlineColor(deadline: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (deadline < today) return 'text-red-400';
  if (deadline === today) return 'text-yellow-400';
  return 'text-neutral-400';
}

function parseSchedule(schedule: string | null): Array<{ day: string; time: string; type: string }> {
  if (!schedule) return [];
  try {
    const parsed = JSON.parse(schedule);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  // Parse simple format "Пн 10:00, Ср 14:00"
  return schedule.split(',').map((s) => {
    const trimmed = s.trim();
    const parts = trimmed.split(/\s+/);
    return { day: parts[0] ?? '', time: parts[1] ?? '', type: parts[2] ?? '' };
  }).filter((s) => s.day);
}

function getSubjectColor(subject: Subject, index: number): string {
  return subject.color ?? DEFAULT_SUBJECT_COLORS[index % DEFAULT_SUBJECT_COLORS.length] ?? '#3b82f6';
}

// --- Semester helpers ---

function getCurrentSemester(): number {
  const month = new Date().getMonth() + 1; // 1-12
  // Sep-Jan = odd semesters (1,3,5...), Feb-Jun = even (2,4,6...)
  return month >= 9 || month <= 1 ? 3 : 4; // Default to 3 or 4 for 2nd year
}

function getAvailableSemesters(subjects: Subject[]): number[] {
  const set = new Set(subjects.map((s) => s.semester));
  return Array.from(set).sort((a, b) => a - b);
}

// --- Views ---

type MainView =
  | { kind: 'empty' }
  | { kind: 'subject'; tab: SubjectTab }
  | { kind: 'assignment-detail'; id: string }
  | { kind: 'exam-detail'; id: string }
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'add-assignment' }
  | { kind: 'add-exam' }
  | { kind: 'add-subject' };

// --- Main Component ---

export function Study() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('subjects');
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>({ kind: 'empty' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-study-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const { leftCollapsed, setLeftKey } = useSidebar();
  useEffect(() => { setLeftKey('study'); }, [setLeftKey]);

  // DB state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<StudyAssignment[]>([]);
  const [exams, setExams] = useState<StudyExam[]>([]);
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const isDraggingSidebar = useRef(false);
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const reloadData = useCallback(async () => {
    try {
      const [dbSubjects, dbAssignments, dbExams, dbTasks] = await Promise.all([
        window.db.subjects.list(),
        window.db.assignments.list(),
        window.db.exams.list(),
        window.db.tasks.list('study'),
      ]);
      setSubjects(dbSubjects);
      setAssignments(dbAssignments);
      setExams(dbExams);
      setStudyTasks(dbTasks.map((t) => mapDbTaskToStudy(t as unknown as Record<string, unknown>)));
      setDbError(null);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка подключения к БД');
    }
  }, []);

  useEffect(() => {
    reloadData().finally(() => setLoading(false));
  }, [reloadData]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['tasks', 'subjects', 'assignments', 'exams'].includes(e))) {
        reloadData();
      }
    });
  }, [reloadData]);

  // Auto-set semester to the latest available when data loads
  useEffect(() => {
    if (subjects.length > 0 && selectedSemester === 'all') {
      const semesters = getAvailableSemesters(subjects);
      const current = getCurrentSemester();
      const best = semesters.includes(current) ? current : semesters[semesters.length - 1] ?? 'all';
      setSelectedSemester(best);
    }
  }, [subjects, selectedSemester]);

  const filteredSubjects = selectedSemester === 'all'
    ? subjects
    : subjects.filter((s) => s.semester === selectedSemester);

  const subject = selectedSubjectId ? subjects.find((s) => s.id === selectedSubjectId) ?? null : null;
  const subjectAssignments = subject ? assignments.filter((a) => a.subjectId === subject.id) : [];
  const subjectExams = subject ? exams.filter((e) => e.subjectId === subject.id) : [];
  const subjectTasks = subject ? studyTasks.filter((t) => t.subjectId === subject.id) : [];

  // Upcoming deadlines across all subjects
  const upcomingDeadlines = assignments
    .filter((a) => a.deadline && a.status !== 'graded' && a.status !== 'submitted')
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 6);

  const upcomingExams = exams
    .filter((e) => e.status === 'upcoming' && e.date)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 5);

  // Auto-select last subject (or first available) after data loads
  useEffect(() => {
    if (loading || subjects.length === 0 || selectedSubjectId) return;
    const lastId = localStorage.getItem('mark2-study-last-subject');
    const target = (lastId && subjects.find((s) => s.id === lastId)) ? lastId : subjects[0]!.id;
    setSelectedSubjectId(target);
    setMainView({ kind: 'subject', tab: 'notes' });
  }, [loading, subjects, selectedSubjectId]);

  const selectSubject = useCallback((id: string) => {
    setSelectedSubjectId(id);
    setSidebarTab('subjects');
    localStorage.setItem('mark2-study-last-subject', id);
    setMainView({ kind: 'subject', tab: 'notes' });
  }, []);

  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-study-sidebar-width', String(w));
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

  const toggleTaskDone = useCallback((taskId: string) => {
    setStudyTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newStatus = t.status === 'done' ? 'todo' : 'done';
      window.db.tasks.update(taskId, { status: newStatus }).catch(() => {});
      return { ...t, status: newStatus as TaskStatus };
    }));
  }, []);

  return (
    <MainLayout agent="study" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftCollapsed ? 0 : sidebarWidth }}
        >
          {/* Tabs */}
          <div className="flex border-b border-neutral-800">
            {(['subjects', 'general'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  sidebarTab === tab
                    ? 'text-neutral-200 border-b-2 border-blue-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab === 'subjects' ? 'Предметы' : 'Общее'}
              </button>
            ))}
          </div>

          {sidebarTab === 'subjects' && (
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
              {/* Semester selector */}
              <div className="px-3 pt-3 pb-2">
                <select
                  value={String(selectedSemester)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSemester(val === 'all' ? 'all' : parseInt(val, 10));
                    setSelectedSubjectId(null);
                    setMainView({ kind: 'empty' });
                  }}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="all">Все семестры</option>
                  {getAvailableSemesters(subjects).map((sem) => (
                    <option key={sem} value={sem}>Семестр {sem}</option>
                  ))}
                </select>
              </div>

              {/* Subjects header + add */}
              <div className="px-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Предметы</span>
                <button
                  onClick={() => { setSelectedSubjectId(null); setMainView({ kind: 'add-subject' }); }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-sm"
                  title="Добавить предмет"
                >
                  +
                </button>
              </div>

              {/* Subject list */}
              <nav className="px-2 space-y-0.5 mb-2">
                {filteredSubjects.filter((s) => s.status !== 'dropped').map((s, idx) => {
                  const color = getSubjectColor(s, idx);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSubject(s.id)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                        selectedSubjectId === s.id
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                      }`}
                    >
                      <span
                        className="mr-2 inline-block w-2 h-2 rounded-full align-middle"
                        style={{ backgroundColor: color }}
                      />
                      {s.name}
                      {s.status === 'completed' && (
                        <span className="ml-2 text-[10px] text-emerald-500">✓</span>
                      )}
                    </button>
                  );
                })}
                {filteredSubjects.length === 0 && !loading && (
                  <div className="text-xs text-neutral-600 px-3 py-2">Нет предметов</div>
                )}
              </nav>

              {/* Selected subject details in sidebar */}
              {subject && (
                <>
                  <div className="mx-3 border-t border-neutral-800" />
                  <div className="px-3 pt-3 pb-2 space-y-1.5">
                    <div className="text-xs text-neutral-300 font-medium">{subject.name}</div>
                    {subject.professor && (
                      <div className="text-xs text-neutral-500">
                        <span className="text-neutral-600">Преп:</span> {subject.professor}
                      </div>
                    )}
                    {subject.schedule && (
                      <div className="text-[11px] text-neutral-600">
                        {parseSchedule(subject.schedule).map((s) => `${s.day} ${s.time}`).join(', ')}
                      </div>
                    )}
                    {subject.type && (
                      <div className="text-[11px] text-neutral-600">
                        Тип: {subject.type === 'lecture' ? 'Лекция' : subject.type === 'seminar' ? 'Семинар' : subject.type === 'lab' ? 'Лаб.' : 'Практика'}
                      </div>
                    )}
                  </div>

                  {/* Subject deadlines */}
                  {subjectAssignments.filter((a) => a.deadline && a.status !== 'graded').length > 0 && (
                    <>
                      <div className="mx-3 border-t border-neutral-800" />
                      <div className="px-3 pt-2 pb-2">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Дедлайны</div>
                        <div className="space-y-1">
                          {subjectAssignments
                            .filter((a) => a.deadline && a.status !== 'graded')
                            .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
                            .slice(0, 3)
                            .map((a) => (
                              <button
                                key={a.id}
                                onClick={() => setMainView({ kind: 'assignment-detail', id: a.id })}
                                className="w-full text-left text-xs py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors"
                              >
                                <span className={`${getDeadlineColor(a.deadline!)} mr-1.5`}>{formatDate(a.deadline!)}</span>
                                <span className="text-neutral-400">{a.title}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Global deadlines section */}
              {upcomingDeadlines.length > 0 && (
                <>
                  <div className="mx-3 border-t border-neutral-800" />
                  <div className="px-3 pt-3 pb-2">
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Дедлайны</div>
                    <div className="space-y-1">
                      {upcomingDeadlines.slice(0, 4).map((a) => {
                        const subj = subjects.find((s) => s.id === a.subjectId);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              setSelectedSubjectId(a.subjectId);
                              setMainView({ kind: 'assignment-detail', id: a.id });
                            }}
                            className="w-full text-left text-xs py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors"
                          >
                            <span className={`${getDeadlineColor(a.deadline!)} mr-1.5`}>{formatDate(a.deadline!)}</span>
                            <span className="text-neutral-500 mr-1">{subj?.name?.slice(0, 15)}</span>
                            <span className="text-neutral-400">{a.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Upcoming exams */}
              {upcomingExams.length > 0 && (
                <>
                  <div className="mx-3 border-t border-neutral-800" />
                  <div className="px-3 pt-3 pb-3">
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Экзамены</div>
                    <div className="space-y-1">
                      {upcomingExams.map((e) => {
                        const subj = subjects.find((s) => s.id === e.subjectId);
                        return (
                          <button
                            key={e.id}
                            onClick={() => {
                              setSelectedSubjectId(e.subjectId);
                              setMainView({ kind: 'exam-detail', id: e.id });
                            }}
                            className="w-full text-left text-xs py-0.5 px-1 rounded hover:bg-neutral-800/50 transition-colors"
                          >
                            <GraduationCap size={12} className="inline mr-1 text-neutral-600" />
                            <span className="text-neutral-500 mr-1">{e.date ? formatDate(e.date) : '—'}</span>
                            <span className="text-neutral-400">{subj?.name?.slice(0, 12)}: {e.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {sidebarTab === 'general' && (
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
              {/* Stats */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Статистика</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-blue-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-blue-400">{subjects.filter((s) => s.status === 'active' || !s.status).length}</div>
                    <div className="text-[10px] text-blue-400/70 uppercase">Предметов</div>
                  </div>
                  <div className="bg-emerald-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-emerald-400">{assignments.filter((a) => a.status === 'graded' || a.status === 'submitted').length}</div>
                    <div className="text-[10px] text-emerald-400/70 uppercase">Сдано</div>
                  </div>
                  <div className="bg-yellow-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-yellow-400">{assignments.filter((a) => a.status === 'in_progress').length}</div>
                    <div className="text-[10px] text-yellow-400/70 uppercase">В работе</div>
                  </div>
                  <div className="bg-red-400/10 rounded px-2 py-1.5">
                    <div className="text-sm font-bold text-red-400">{studyTasks.filter((t) => t.status === 'todo').length}</div>
                    <div className="text-[10px] text-red-400/70 uppercase">Задач todo</div>
                  </div>
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* Tasks */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Задачи</div>
                <div className="space-y-1">
                  {studyTasks.map((task) => {
                    const pColor = PRIORITY_COLORS[task.priority];
                    const isDone = task.status === 'done';
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors`}
                      >
                        <button
                          onClick={() => toggleTaskDone(task.id)}
                          className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                            isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
                          }`}
                        >
                          {isDone && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (task.subjectId) setSelectedSubjectId(task.subjectId);
                            setMainView({ kind: 'task-detail', taskId: task.id });
                          }}
                          className={`truncate text-left flex-1 ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-400 hover:text-neutral-200'}`}
                        >
                          {task.title}
                        </button>
                      </div>
                    );
                  })}
                  {studyTasks.length === 0 && <div className="text-xs text-neutral-600">Нет задач</div>}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* All deadlines */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Ближайшие дедлайны</div>
                <div className="space-y-1.5">
                  {upcomingDeadlines.map((a) => {
                    const subj = subjects.find((s) => s.id === a.subjectId);
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedSubjectId(a.subjectId);
                          setMainView({ kind: 'assignment-detail', id: a.id });
                        }}
                        className="w-full text-left text-xs py-1 px-1 rounded hover:bg-neutral-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`${getDeadlineColor(a.deadline!)} text-[10px] shrink-0`}>{formatDate(a.deadline!)}</span>
                          <span className="text-neutral-500 text-[10px] truncate">{subj?.name}</span>
                        </div>
                        <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate mt-0.5">
                          {ASSIGNMENT_TYPE_META[a.type]?.icon} {a.title}
                        </div>
                      </button>
                    );
                  })}
                  {upcomingDeadlines.length === 0 && <div className="text-xs text-neutral-600">Нет дедлайнов</div>}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* All subjects overview */}
              <div className="px-3 pt-3 pb-3">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Предметы</div>
                <div className="space-y-1">
                  {subjects.map((s, idx) => {
                    const subAssignments = assignments.filter((a) => a.subjectId === s.id);
                    const done = subAssignments.filter((a) => a.status === 'graded' || a.status === 'submitted').length;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectSubject(s.id)}
                        className="w-full text-left flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors group"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getSubjectColor(s, idx) }}
                        />
                        <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors flex-1 truncate">
                          {s.name}
                        </span>
                        <span className="text-neutral-600 text-[10px] shrink-0">{done}/{subAssignments.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mx-3 border-t border-neutral-800" />

              {/* All files tree */}
              <div className="px-3 pt-3 pb-3">
                <AllFilesTree onFileOpen={(filePath) => {
                  // Try to find which subject the file belongs to and switch to it
                  const pathParts = filePath.split('/');
                  const subjectsIdx = pathParts.indexOf('subjects');
                  if (subjectsIdx >= 0) {
                    const slugFromPath = pathParts[subjectsIdx + 1];
                    const matchSubject = subjects.find((s) => toSlug(s.name) === slugFromPath);
                    if (matchSubject) {
                      selectSubject(matchSubject.id);
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('study:open-file', { detail: { filePath } }));
                      }, 100);
                    }
                  }
                }} />
              </div>
            </div>
          )}
        </aside>

        {!leftCollapsed && (
          <div
            onMouseDown={handleSidebarDragStart}
            className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
          />
        )}

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-neutral-500" />
            </div>
          )}
          {dbError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {dbError}
            </div>
          )}

          {!loading && mainView.kind === 'empty' && subjects.length === 0 && (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Добавьте первый предмет
            </div>
          )}

          {!loading && mainView.kind === 'add-subject' && (
            <AddSubjectView
              defaultSemester={typeof selectedSemester === 'number' ? selectedSemester : getCurrentSemester()}
              onSave={async (data) => {
                await window.db.subjects.create(data);
                await reloadData();
                setMainView({ kind: 'empty' });
              }}
              onBack={() => setMainView({ kind: 'empty' })}
            />
          )}

          {!loading && subject && mainView.kind === 'subject' && (
            <SubjectView
              subject={subject}
              subjectIndex={subjects.indexOf(subject)}
              assignments={subjectAssignments}
              exams={subjectExams}
              tasks={subjectTasks}
              activeTab={mainView.tab}
              onTabChange={(tab) => setMainView({ kind: 'subject', tab })}
              onAssignmentClick={(id) => setMainView({ kind: 'assignment-detail', id })}
              onExamClick={(id) => setMainView({ kind: 'exam-detail', id })}
              onTaskClick={(id) => setMainView({ kind: 'task-detail', taskId: id })}
              onAddAssignment={() => setMainView({ kind: 'add-assignment' })}
              onAddExam={() => setMainView({ kind: 'add-exam' })}
              toggleTaskDone={toggleTaskDone}
            />
          )}

          {!loading && mainView.kind === 'assignment-detail' && (
            <AssignmentDetailView
              assignment={assignments.find((a) => a.id === mainView.id)}
              subjectName={subjects.find((s) => s.id === assignments.find((a) => a.id === mainView.id)?.subjectId)?.name}
              onBack={() => setMainView(subject ? { kind: 'subject', tab: 'assignments' } : { kind: 'empty' })}
              onUpdate={async (id, data) => {
                await window.db.assignments.update(id, data);
                await reloadData();
              }}
              onDelete={async (id) => {
                await window.db.assignments.delete(id);
                await reloadData();
                setMainView(subject ? { kind: 'subject', tab: 'assignments' } : { kind: 'empty' });
              }}
            />
          )}

          {!loading && mainView.kind === 'exam-detail' && (
            <ExamDetailView
              exam={exams.find((e) => e.id === mainView.id)}
              subjectName={subjects.find((s) => s.id === exams.find((e) => e.id === mainView.id)?.subjectId)?.name}
              onBack={() => setMainView(subject ? { kind: 'subject', tab: 'exams' } : { kind: 'empty' })}
              onUpdate={async (id, data) => {
                await window.db.exams.update(id, data);
                await reloadData();
              }}
              onDelete={async (id) => {
                await window.db.exams.delete(id);
                await reloadData();
                setMainView(subject ? { kind: 'subject', tab: 'exams' } : { kind: 'empty' });
              }}
            />
          )}

          {!loading && mainView.kind === 'task-detail' && (
            <TaskDetailView
              task={studyTasks.find((t) => t.id === mainView.taskId)}
              subjectName={subjects.find((s) => s.id === studyTasks.find((t) => t.id === mainView.taskId)?.subjectId)?.name}
              onBack={() => setMainView(subject ? { kind: 'subject', tab: 'assignments' } : { kind: 'empty' })}
              toggleDone={toggleTaskDone}
            />
          )}

          {!loading && subject && mainView.kind === 'add-assignment' && (
            <AddAssignmentView
              subjectId={subject.id}
              subjectName={subject.name}
              onSave={async (data) => {
                await window.db.assignments.create(data);
                await reloadData();
                setMainView({ kind: 'subject', tab: 'assignments' });
              }}
              onBack={() => setMainView({ kind: 'subject', tab: 'assignments' })}
            />
          )}

          {!loading && subject && mainView.kind === 'add-exam' && (
            <AddExamView
              subjectId={subject.id}
              subjectName={subject.name}
              onSave={async (data) => {
                await window.db.exams.create(data);
                await reloadData();
                setMainView({ kind: 'subject', tab: 'exams' });
              }}
              onBack={() => setMainView({ kind: 'subject', tab: 'exams' })}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// === Sub-components ===

function SubjectView({
  subject, subjectIndex, assignments, exams, tasks, activeTab,
  onTabChange, onAssignmentClick, onExamClick, onTaskClick,
  onAddAssignment, onAddExam, toggleTaskDone,
}: {
  subject: Subject;
  subjectIndex: number;
  assignments: StudyAssignment[];
  exams: StudyExam[];
  tasks: StudyTask[];
  activeTab: SubjectTab;
  onTabChange: (tab: SubjectTab) => void;
  onAssignmentClick: (id: string) => void;
  onExamClick: (id: string) => void;
  onTaskClick: (id: string) => void;
  onAddAssignment: () => void;
  onAddExam: () => void;
  toggleTaskDone: (id: string) => void;
}) {
  const color = getSubjectColor(subject, subjectIndex);
  const schedule = parseSchedule(subject.schedule);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AssignmentType | 'all'>('all');

  const filteredAssignments = assignments
    .filter((a) => statusFilter === 'all' || a.status === statusFilter)
    .filter((a) => typeFilter === 'all' || a.type === typeFilter);

  const tabs: Array<{ key: SubjectTab; label: string; count?: number }> = [
    { key: 'notes', label: 'Заметки' },
    { key: 'assignments', label: 'Задания', count: assignments.length },
    { key: 'exams', label: 'Экзамены', count: exams.length },
    { key: 'files', label: 'Файлы' },
  ];

  const fullWidthTab = activeTab === 'notes' || activeTab === 'files';

  return (
    <div className={fullWidthTab ? '' : 'max-w-3xl'}>
      {/* Header */}
      <div className={`bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20 ${fullWidthTab ? 'max-w-3xl' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-full mt-2 shrink-0" style={{ backgroundColor: color }} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-neutral-400">
              {subject.professor && <span>{subject.professor}</span>}
              {subject.type && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {subject.type === 'lecture' ? 'Лекция' : subject.type === 'seminar' ? 'Семинар' : subject.type === 'lab' ? 'Лаб.' : 'Практика'}
                </span>
              )}
              {subject.status && subject.status !== 'active' && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${subject.status === 'completed' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                  {subject.status === 'completed' ? 'Завершён' : 'Отброшен'}
                </span>
              )}
              <span className="text-xs text-neutral-600">Семестр {subject.semester}</span>
            </div>
            {schedule.length > 0 && (
              <div className="text-xs text-neutral-500 mt-2">
                <Calendar size={12} className="inline mr-1" />
                {schedule.map((s) => `${s.day} ${s.time}${s.type ? ` (${s.type})` : ''}`).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'text-neutral-200 border-blue-500'
                : 'text-neutral-500 border-transparent hover:text-neutral-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-neutral-600">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'assignments' && (
        <div>
          {/* Filters + add */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | 'all')}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="all">Все статусы</option>
              {(Object.keys(ASSIGNMENT_STATUS_META) as AssignmentStatus[]).map((s) => (
                <option key={s} value={s}>{ASSIGNMENT_STATUS_META[s].label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AssignmentType | 'all')}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="all">Все типы</option>
              {(Object.keys(ASSIGNMENT_TYPE_META) as AssignmentType[]).map((t) => (
                <option key={t} value={t}>{ASSIGNMENT_TYPE_META[t].label}</option>
              ))}
            </select>
            <button
              onClick={onAddAssignment}
              className="ml-auto flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              <Plus size={12} /> Задание
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredAssignments.map((a) => {
              const isOverdue = a.deadline && a.deadline < new Date().toISOString().slice(0, 10) && a.status !== 'graded' && a.status !== 'submitted';
              return (
                <button
                  key={a.id}
                  onClick={() => onAssignmentClick(a.id)}
                  className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0">{ASSIGNMENT_STATUS_META[a.status].icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-300">{a.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                          {ASSIGNMENT_TYPE_META[a.type]?.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-2">
                        {a.deadline && (
                          <span className={isOverdue ? 'text-red-400' : ''}>
                            Дедлайн: {formatDate(a.deadline)}
                          </span>
                        )}
                        {a.grade && <span className="text-emerald-400">Оценка: {a.grade}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${ASSIGNMENT_STATUS_META[a.status].color}`}>
                      {ASSIGNMENT_STATUS_META[a.status].label}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredAssignments.length === 0 && (
              <div className="text-neutral-600 text-sm py-8 text-center">
                {assignments.length === 0 ? 'Нет заданий' : 'Нет заданий с такими фильтрами'}
              </div>
            )}
          </div>

          {/* Tasks for this subject */}
          {tasks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-3">Задачи</h3>
              <div className="space-y-1.5">
                {tasks.map((task) => {
                  const pColor = PRIORITY_COLORS[task.priority];
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-l-2 ${pColor.border} bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors`}
                    >
                      <button
                        onClick={() => toggleTaskDone(task.id)}
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
                        }`}
                      >
                        {isDone && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => onTaskClick(task.id)}
                        className={`text-sm flex-1 text-left ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}
                      >
                        {task.title}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${pColor.badge}`}>{pColor.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'exams' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={onAddExam}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              <Plus size={12} /> Экзамен
            </button>
          </div>
          <div className="space-y-2">
            {exams.map((e) => (
              <button
                key={e.id}
                onClick={() => onExamClick(e.id)}
                className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={16} className="text-neutral-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-300">{e.title}</div>
                    <div className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-2">
                      <span>{EXAM_TYPE_META[e.type]}</span>
                      {e.date && <span>{formatDate(e.date)}</span>}
                      {e.grade && <span className="text-emerald-400">Оценка: {e.grade}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${EXAM_STATUS_META[e.status].color}`}>
                    {EXAM_STATUS_META[e.status].label}
                  </span>
                </div>
              </button>
            ))}
            {exams.length === 0 && (
              <div className="text-neutral-600 text-sm py-8 text-center">Нет экзаменов</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <FilesView subjectName={subject.name} onOpenFile={(filePath) => {
          // Switch to notes tab and open the file
          onTabChange('notes');
          // Pass via a custom event so NotesEditorView can pick it up
          window.dispatchEvent(new CustomEvent('study:open-file', { detail: { filePath } }));
        }} />
      )}

      {activeTab === 'notes' && (
        <NotesEditorView subjectName={subject.name} />
      )}
    </div>
  );
}

// --- File tree component ---

function FileTreeNode({
  node, depth, onFileClick, onDrop, expandedPaths, toggleExpand,
  contextMenu, setContextMenu,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (node: FileTreeNode) => void;
  onDrop: (files: FileList, destFolder: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  contextMenu: { x: number; y: number; node: FileTreeNode } | null;
  setContextMenu: (menu: { x: number; y: number; node: FileTreeNode } | null) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!node.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (node.isDir && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files, node.path);
    }
  };

  return (
    <div>
      <button
        onClick={() => node.isDir ? toggleExpand(node.path) : onFileClick(node)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, node });
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full text-left flex items-center gap-1.5 py-1 px-2 text-xs transition-colors rounded
          ${dragOver ? 'bg-blue-900/40 ring-1 ring-blue-500/50' : 'hover:bg-neutral-800/50'}
          ${node.isDir ? 'text-neutral-300' : 'text-neutral-400 hover:text-neutral-200'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.isDir ? (
          <>
            {isExpanded ? <ChevronDown size={12} className="shrink-0 text-neutral-500" /> : <ChevronRight size={12} className="shrink-0 text-neutral-500" />}
            <Folder size={14} className="shrink-0 text-yellow-500/70" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File size={14} className="shrink-0 text-neutral-500" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
            />
          ))}
          {node.children.length === 0 && (
            <div className="text-[10px] text-neutral-600 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              Пусто
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileTreeView({
  tree, onFileClick, onRefresh, onDrop, title,
}: {
  tree: FileTreeNode[];
  onFileClick: (node: FileTreeNode) => void;
  onRefresh: () => void;
  onDrop: (files: FileList, destFolder: string) => void;
  title?: string;
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Auto-expand top-level directories
    const initial = new Set<string>();
    for (const node of tree) {
      if (node.isDir) initial.add(node.path);
    }
    return initial;
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null);
  const [renaming, setRenaming] = useState<{ node: FileTreeNode; newName: string } | null>(null);

  // Update expanded when tree changes (keep existing, add new top-level)
  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const node of tree) {
        if (node.isDir && !prev.has(node.path)) next.add(node.path);
      }
      return next;
    });
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextAction = useCallback(async (action: 'open' | 'rename' | 'delete', node: FileTreeNode) => {
    setContextMenu(null);
    if (action === 'open') {
      if (node.isDir) {
        window.electronAPI.openFile(node.path);
      } else {
        onFileClick(node);
      }
    } else if (action === 'rename') {
      setRenaming({ node, newName: node.name });
    } else if (action === 'delete') {
      await window.study.files.delete(node.path);
      onRefresh();
    }
  }, [onFileClick, onRefresh]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renaming || !renaming.newName.trim()) { setRenaming(null); return; }
    const dir = renaming.node.path.substring(0, renaming.node.path.lastIndexOf('/'));
    const newPath = `${dir}/${renaming.newName.trim()}`;
    if (newPath !== renaming.node.path) {
      await window.study.files.rename(renaming.node.path, newPath);
      onRefresh();
    }
    setRenaming(null);
  }, [renaming, onRefresh]);

  // Root-level drag & drop
  const handleRootDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0 && tree.length > 0) {
      // Drop at root: use the first dir's parent
      const rootPath = tree[0]!.path.substring(0, tree[0]!.path.lastIndexOf('/'));
      onDrop(e.dataTransfer.files, rootPath);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</span>
          <button
            onClick={onRefresh}
            className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Обновить"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}
      <div
        className="border border-neutral-800 rounded-lg bg-neutral-950/50 overflow-hidden"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin py-1">
          {tree.length === 0 && (
            <div className="text-xs text-neutral-600 text-center py-4">Нет файлов</div>
          )}
          {tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileClick={onFileClick}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
            />
          ))}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleContextAction('open', contextMenu.node)}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Открыть
          </button>
          <button
            onClick={() => handleContextAction('rename', contextMenu.node)}
            className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Переименовать
          </button>
          {!contextMenu.node.isDir && (
            <button
              onClick={() => handleContextAction('delete', contextMenu.node)}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800 transition-colors"
            >
              Удалить
            </button>
          )}
        </div>
      )}

      {/* Rename dialog */}
      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenaming(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-neutral-300 mb-3">Переименовать</div>
            <input
              autoFocus
              value={renaming.newName}
              onChange={(e) => setRenaming({ ...renaming, newName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenaming(null);
              }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setRenaming(null)} className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200 rounded transition-colors">Отмена</button>
              <button onClick={handleRenameSubmit} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilesView({ subjectName, onOpenFile }: { subjectName: string; onOpenFile: (filePath: string) => void }) {
  const slug = toSlug(subjectName);
  const [tree, setTree] = useState<FileTreeNode[]>([]);

  const loadTree = useCallback(async () => {
    const result = await window.study.files.tree(slug);
    setTree(result);
  }, [slug]);

  useEffect(() => {
    loadTree();
    window.study.files.watchStart(slug);
    const unsub = window.study.files.onWatchUpdate((updatedSlug: string) => {
      if (updatedSlug === slug) loadTree();
    });
    return () => {
      unsub();
      window.study.files.watchStop(slug);
    };
  }, [slug, loadTree]);

  const handleFileClick = useCallback((node: FileTreeNode) => {
    if (node.name.endsWith('.md')) {
      onOpenFile(node.path);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, [onOpenFile]);

  const handleDrop = useCallback(async (files: FileList, destFolder: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file?.path) {
        await window.study.files.copy(file.path, destFolder);
      }
    }
    loadTree();
  }, [loadTree]);

  return (
    <div>
      <p className="text-sm text-neutral-400 mb-3">
        Файлы предмета в <code className="text-neutral-300 bg-neutral-800 px-1 rounded text-xs">agents/study/context/subjects/{slug}/</code>
      </p>
      <FileTreeView
        tree={tree}
        onFileClick={handleFileClick}
        onRefresh={loadTree}
        onDrop={handleDrop}
        title="Файлы"
      />
      <p className="text-[10px] text-neutral-600 mt-2">
        Перетащите файлы из Finder в папку для копирования. Правый клик — контекстное меню.
      </p>
    </div>
  );
}

// --- All files tree (for General tab) ---

function AllFilesTree({ onFileOpen }: { onFileOpen: (filePath: string) => void }) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);

  const loadTree = useCallback(async () => {
    const result = await window.study.files.allTree();
    setTree(result);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleFileClick = useCallback((node: FileTreeNode) => {
    if (node.name.endsWith('.md')) {
      onFileOpen(node.path);
    } else {
      window.electronAPI.openFile(node.path);
    }
  }, [onFileOpen]);

  const handleDrop = useCallback(async (files: FileList, destFolder: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file?.path) {
        await window.study.files.copy(file.path, destFolder);
      }
    }
    loadTree();
  }, [loadTree]);

  return (
    <FileTreeView
      tree={tree}
      onFileClick={handleFileClick}
      onRefresh={loadTree}
      onDrop={handleDrop}
      title="Все файлы"
    />
  );
}

// --- Notes Editor View ---

interface NoteFile {
  name: string;
  path: string;
}

function NotesEditorView({ subjectName }: { subjectName: string }) {
  const slug = toSlug(subjectName);
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [summaries, setSummaries] = useState<NoteFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<NoteFile | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'summary'>('original');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('preview');
  const previewRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [creating, setCreating] = useState(false);
  const [noteType, setNoteType] = useState<'лекция' | 'семинар' | 'лаба' | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadFiles = useCallback(async () => {
    const [noteFiles, summaryFiles] = await Promise.all([
      window.study.files.list(slug, 'notes'),
      window.study.files.list(slug, 'summaries'),
    ]);
    setNotes(noteFiles);
    setSummaries(summaryFiles);
  }, [slug]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const openFile = useCallback(async (file: NoteFile) => {
    const text = await window.study.files.read(file.path);
    setSelectedFile(file);
    setContent(text);
    setOriginalContent(text);
    setSaveStatus('saved');
    setViewMode('original');
    // Check for matching summary
    const summaryName = file.name.replace(/\.md$/, '') + '_summary.md';
    const match = summaries.find((s) => s.name === summaryName);
    if (match) {
      const summaryText = await window.study.files.read(match.path);
      setSummaryContent(summaryText);
    } else {
      setSummaryContent(null);
    }
  }, [summaries]);

  const saveFile = useCallback(async () => {
    if (!selectedFile || content === originalContent) return;
    setSaveStatus('saving');
    await window.study.files.write(selectedFile.path, content);
    setOriginalContent(content);
    setSaveStatus('saved');
  }, [selectedFile, content, originalContent]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveFile]);

  // Track unsaved changes
  useEffect(() => {
    if (selectedFile && content !== originalContent) {
      setSaveStatus('unsaved');
    }
  }, [content, originalContent, selectedFile]);

  // Listen for file open from FileTreeView
  useEffect(() => {
    const handler = (e: Event) => {
      const filePath = (e as CustomEvent).detail?.filePath;
      if (filePath) {
        const name = filePath.split('/').pop() ?? filePath;
        openFile({ name, path: filePath });
      }
    };
    window.addEventListener('study:open-file', handler);
    return () => window.removeEventListener('study:open-file', handler);
  }, [openFile]);

  const handleCreateNote = useCallback(async () => {
    let filename: string;
    const customName = newFileName.trim();

    if (customName) {
      filename = customName.endsWith('.md') ? customName : `${customName}.md`;
    } else if (noteType) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const base = `${dd}-${mm}-${yy}-${noteType}`;
      // Check for duplicates
      let candidate = `${base}.md`;
      let counter = 2;
      const existingNames = new Set(notes.map((n) => n.name));
      while (existingNames.has(candidate)) {
        candidate = `${base}-${counter}.md`;
        counter++;
      }
      filename = candidate;
    } else {
      return; // No type selected and no name — do nothing
    }

    const file = await window.study.files.create(slug, 'notes', filename);
    setCreating(false);
    setNoteType(null);
    setNewFileName('');
    await loadFiles();
    openFile(file);
  }, [newFileName, noteType, notes, slug, loadFiles, openFile]);

  const handleDeleteNote = useCallback(async (file: NoteFile) => {
    await window.study.files.delete(file.path);
    if (selectedFile?.path === file.path) {
      setSelectedFile(null);
      setContent('');
      setOriginalContent('');
    }
    await loadFiles();
  }, [selectedFile, loadFiles]);

  const sendToChat = useCallback(() => {
    if (!selectedFile) return;
    const text = `Создай конспект из заметки ${selectedFile.name} по предмету ${subjectName}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, [selectedFile, subjectName]);

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
      {/* Left panel — file list */}
      <div className="w-56 shrink-0 flex flex-col border border-neutral-800 rounded-lg bg-neutral-950/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Заметки</span>
          <button
            onClick={() => { setCreating(!creating); setNoteType(null); setNewFileName(''); }}
            className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-sm"
            title="Новая заметка"
          >
            {creating ? '×' : '+'}
          </button>
        </div>

        {creating && (
          <div className="px-2 py-2 border-b border-neutral-800 space-y-2">
            {/* Type selector */}
            <div className="flex gap-1">
              {(['лекция', 'семинар', 'лаба'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNoteType(t)}
                  className={`flex-1 px-1 py-1 rounded text-[10px] font-medium transition-colors ${
                    noteType === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  {t === 'лекция' ? 'Лекция' : t === 'семинар' ? 'Семинар' : 'Лаба'}
                </button>
              ))}
            </div>
            {/* Name input + create button (shown after type selected) */}
            {noteType && (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNote();
                    if (e.key === 'Escape') { setCreating(false); setNoteType(null); setNewFileName(''); }
                  }}
                  placeholder="Название (необязательно)"
                  autoFocus
                  className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600"
                />
                <button
                  onClick={handleCreateNote}
                  className="shrink-0 px-2 py-1 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  Создать
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {notes.length === 0 && !creating && (
            <div className="px-3 py-4 text-xs text-neutral-600 text-center">Нет заметок</div>
          )}
          {notes.map((file) => (
            <div
              key={file.path}
              className={`group flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                selectedFile?.path === file.path
                  ? 'bg-neutral-800 text-neutral-200'
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
              }`}
            >
              <button
                onClick={() => openFile(file)}
                className="flex-1 text-left truncate"
              >
                <NotebookText size={12} className="inline mr-1.5 text-neutral-500" />
                {file.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteNote(file); }}
                className="opacity-0 group-hover:opacity-100 shrink-0 text-neutral-600 hover:text-red-400 transition-all"
                title="Удалить"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {/* Summaries section — right after notes */}
          {summaries.length > 0 && (
            <>
              <div className="px-3 py-1.5 border-t border-neutral-800 mt-1">
                <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Конспекты</span>
              </div>
              {summaries.map((file) => (
                <button
                  key={file.path}
                  onClick={async () => {
                    const text = await window.study.files.read(file.path);
                    setSelectedFile(file);
                    setContent(text);
                    setOriginalContent(text);
                    setSummaryContent(null);
                    setViewMode('original');
                    setSaveStatus('saved');
                  }}
                  className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                    selectedFile?.path === file.path
                      ? 'bg-neutral-800 text-neutral-200'
                      : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
                  }`}
                >
                  <Sparkles size={10} className="inline mr-1 text-blue-400/50" />
                  {file.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right panel — editor */}
      <div className="flex-1 flex flex-col border border-neutral-800 rounded-lg bg-neutral-950/50 overflow-hidden">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
            Выберите заметку или создайте новую
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3">
              <span className="text-xs text-neutral-300 font-medium truncate">{selectedFile.name}</span>

              {/* Save status */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                saveStatus === 'saved' ? 'text-emerald-400/70 bg-emerald-900/20' :
                saveStatus === 'saving' ? 'text-blue-400/70 bg-blue-900/20' :
                'text-yellow-400/70 bg-yellow-900/20'
              }`}>
                {saveStatus === 'saved' ? 'Сохранено' : saveStatus === 'saving' ? 'Сохранение...' : 'Не сохранено'}
              </span>

              <div className="ml-auto flex items-center gap-2">
                {/* Preview / Edit toggle */}
                {viewMode === 'original' && (
                  <div className="flex gap-0.5 bg-neutral-900 rounded p-0.5 border border-neutral-800">
                    <button
                      onClick={() => setEditorMode('preview')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        editorMode === 'preview' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <Eye size={10} /> Просмотр
                    </button>
                    <button
                      onClick={() => setEditorMode('edit')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        editorMode === 'edit' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <Pencil size={10} /> Редактирование
                    </button>
                  </div>
                )}

                {/* Original / Summary toggle */}
                {summaryContent !== null && (
                  <div className="flex gap-0.5 bg-neutral-900 rounded p-0.5 border border-neutral-800">
                    <button
                      onClick={() => setViewMode('original')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        viewMode === 'original' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Оригинал
                    </button>
                    <button
                      onClick={() => setViewMode('summary')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        viewMode === 'summary' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Конспект
                    </button>
                  </div>
                )}

                {saveStatus === 'unsaved' && (
                  <button
                    onClick={saveFile}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-blue-400 hover:bg-blue-900/30 transition-colors"
                  >
                    <Save size={10} /> Сохранить
                  </button>
                )}

                <button
                  onClick={sendToChat}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-purple-400 hover:bg-purple-900/30 transition-colors"
                  title="Создать конспект через AI"
                >
                  <Sparkles size={10} /> Конспект
                </button>
              </div>
            </div>

            {/* Editor area */}
            {viewMode === 'original' ? (
              editorMode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onBlur={saveFile}
                  className="flex-1 w-full bg-gray-900 text-neutral-300 text-sm font-mono leading-relaxed p-4 resize-none focus:outline-none scrollbar-thin"
                  spellCheck={false}
                />
              ) : (
                <div
                  ref={previewRef}
                  className="flex-1 overflow-auto p-4 bg-gray-900 cursor-text"
                  onClick={() => {
                    const el = previewRef.current;
                    if (!el) return;
                    const scrollRatio = el.scrollHeight > el.clientHeight
                      ? el.scrollTop / (el.scrollHeight - el.clientHeight)
                      : 0;
                    setEditorMode('edit');
                    requestAnimationFrame(() => {
                      const ta = textareaRef.current;
                      if (!ta) return;
                      const taScrollMax = ta.scrollHeight - ta.clientHeight;
                      ta.scrollTop = scrollRatio * taScrollMax;
                      const cursorPos = Math.round(scrollRatio * content.length);
                      ta.selectionStart = cursorPos;
                      ta.selectionEnd = cursorPos;
                      ta.focus();
                    });
                  }}
                >
                  <MarkdownRenderer content={content} className="text-sm text-neutral-300 leading-relaxed" />
                </div>
              )
            ) : (
              <div className="flex-1 overflow-auto p-4 bg-gray-900">
                <div className="flex items-center gap-1.5 mb-3 text-[10px] text-blue-400/70 uppercase tracking-wider">
                  <Sparkles size={12} /> AI-конспект
                </div>
                <MarkdownRenderer content={summaryContent ?? ''} className="text-sm text-neutral-300 leading-relaxed" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function toSlug(name: string): string {
  const CYR: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  };
  return name.toLowerCase().split('').map((ch) => CYR[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// --- Assignment Detail ---

function AssignmentDetailView({
  assignment, subjectName, onBack, onUpdate, onDelete,
}: {
  assignment: StudyAssignment | undefined;
  subjectName: string | undefined;
  onBack: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  if (!assignment) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Задание не найдено</p>
      </div>
    );
  }

  const isOverdue = assignment.deadline && assignment.deadline < new Date().toISOString().slice(0, 10) && assignment.status !== 'graded' && assignment.status !== 'submitted';

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${ASSIGNMENT_STATUS_META[assignment.status].color}`}>
          {ASSIGNMENT_STATUS_META[assignment.status].icon} {ASSIGNMENT_STATUS_META[assignment.status].label}
        </span>
        <span className="text-neutral-600 text-xs">
          {ASSIGNMENT_TYPE_META[assignment.type]?.icon} {ASSIGNMENT_TYPE_META[assignment.type]?.label}
        </span>
      </div>

      <h1 className="text-xl font-bold mb-1">{assignment.title}</h1>
      {subjectName && <p className="text-neutral-500 text-sm mb-4">{subjectName}</p>}

      {/* Status dropdown */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-neutral-500">Статус:</label>
        <select
          value={assignment.status}
          onChange={(e) => onUpdate(assignment.id, { status: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
        >
          {(Object.keys(ASSIGNMENT_STATUS_META) as AssignmentStatus[]).map((s) => (
            <option key={s} value={s}>{ASSIGNMENT_STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {assignment.deadline && (
        <div className={`bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10 ${isOverdue ? 'border-red-800/50' : ''}`}>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Дедлайн</h2>
          <p className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-neutral-300'}`}>
            {formatDate(assignment.deadline)}
            {isOverdue && ' — просрочено!'}
          </p>
        </div>
      )}

      {assignment.description && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Описание</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{assignment.description}</p>
        </div>
      )}

      {assignment.grade && (
        <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Оценка</h2>
          <p className="text-lg font-bold text-emerald-300">{assignment.grade}</p>
        </div>
      )}

      {assignment.filePath && (
        <button
          onClick={() => window.electronAPI.openFile(assignment.filePath!)}
          className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300 hover:bg-blue-900/50 transition-colors mb-4"
        >
          <FileText size={16} strokeWidth={1.5} /> Открыть файл
        </button>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onDelete(assignment.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={12} /> Удалить
        </button>
      </div>
    </div>
  );
}

// --- Exam Detail ---

function ExamDetailView({
  exam, subjectName, onBack, onUpdate, onDelete,
}: {
  exam: StudyExam | undefined;
  subjectName: string | undefined;
  onBack: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  if (!exam) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Экзамен не найден</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${EXAM_STATUS_META[exam.status].color}`}>
          {EXAM_STATUS_META[exam.status].label}
        </span>
        <span className="text-neutral-600 text-xs">{EXAM_TYPE_META[exam.type]}</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{exam.title}</h1>
      {subjectName && <p className="text-neutral-500 text-sm mb-4">{subjectName}</p>}

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-neutral-500">Статус:</label>
        <select
          value={exam.status}
          onChange={(e) => onUpdate(exam.id, { status: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
        >
          {(Object.keys(EXAM_STATUS_META) as ExamStatus[]).map((s) => (
            <option key={s} value={s}>{EXAM_STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {exam.date && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Дата</h2>
          <p className="text-neutral-300 text-sm">{formatDate(exam.date)}</p>
        </div>
      )}

      {exam.grade && (
        <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Оценка</h2>
          <p className="text-lg font-bold text-emerald-300">{exam.grade}</p>
        </div>
      )}

      {exam.notes && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Заметки</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{exam.notes}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onDelete(exam.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={12} /> Удалить
        </button>
      </div>
    </div>
  );
}

// --- Task Detail ---

function TaskDetailView({
  task, subjectName, onBack, toggleDone,
}: {
  task: StudyTask | undefined;
  subjectName: string | undefined;
  onBack: () => void;
  toggleDone: (id: string) => void;
}) {
  if (!task) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">&larr; Назад</button>
        <p>Задача не найдена</p>
      </div>
    );
  }

  const pColor = PRIORITY_COLORS[task.priority];
  const isDone = task.status === 'done';

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>

      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => toggleDone(task.id)}
          className={`w-5 h-5 mt-1 rounded border shrink-0 flex items-center justify-center transition-colors ${
            isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
          }`}
        >
          {isDone && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${isDone ? 'text-neutral-500 line-through' : ''}`}>{task.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${pColor.badge}`}>{pColor.label}</span>
            <span className={`text-xs ${STATUS_COLORS[task.status]}`}>{task.status}</span>
            {subjectName && <span className="text-xs text-neutral-600">{subjectName}</span>}
            {task.deadline && <span className="text-xs text-neutral-600">Дедлайн: {formatDate(task.deadline)}</span>}
          </div>
        </div>
      </div>

      {task.context && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3">
          <p className="text-sm text-neutral-400 leading-relaxed">{task.context}</p>
        </div>
      )}
    </div>
  );
}

// --- Add Assignment ---

function AddAssignmentView({
  subjectId, subjectName, onSave, onBack,
}: {
  subjectId: string;
  subjectName: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssignmentType>('homework');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        subjectId,
        title: title.trim(),
        type,
        deadline: deadline || null,
        description: description.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>
      <h1 className="text-2xl font-bold mb-1">Новое задание</h1>
      <p className="text-sm text-neutral-500 mb-6">{subjectName}</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ДЗ 3 — интегралы"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AssignmentType)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              {(Object.keys(ASSIGNMENT_TYPE_META) as AssignmentType[]).map((t) => (
                <option key={t} value={t}>{ASSIGNMENT_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Дедлайн</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Что нужно сделать..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500 resize-none"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// --- Add Exam ---

function AddExamView({
  subjectId, subjectName, onSave, onBack,
}: {
  subjectId: string;
  subjectName: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ExamType>('exam');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        subjectId,
        title: title.trim(),
        type,
        date: date || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>
      <h1 className="text-2xl font-bold mb-1">Новый экзамен</h1>
      <p className="text-sm text-neutral-500 mb-6">{subjectName}</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Экзамен по термодинамике"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExamType)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              {(Object.keys(EXAM_TYPE_META) as ExamType[]).map((t) => (
                <option key={t} value={t}>{EXAM_TYPE_META[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Дата</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Заметки</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Что нужно подготовить..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500 resize-none"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// --- Add Subject ---

function AddSubjectView({
  defaultSemester, onSave, onBack,
}: {
  defaultSemester: number;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [semester, setSemester] = useState(defaultSemester);
  const [schedule, setSchedule] = useState('');
  const [type, setType] = useState('lecture');
  const [color, setColor] = useState(DEFAULT_SUBJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        semester,
        professor: professor.trim() || null,
        schedule: schedule.trim() || null,
        type,
        color,
        status: 'active',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
        &larr; Назад
      </button>
      <h1 className="text-2xl font-bold mb-6">Новый предмет</h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Математический анализ"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Преподаватель</label>
            <input
              type="text"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Иванов А.С."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Семестр</label>
            <input
              type="number"
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value, 10) || 1)}
              min={1} max={12}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Расписание</label>
          <input
            type="text"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Пн 10:00, Ср 14:00"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              <option value="lecture">Лекция</option>
              <option value="seminar">Семинар</option>
              <option value="lab">Лаб.</option>
              <option value="practice">Практика</option>
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Цвет</label>
            <div className="flex gap-1 flex-wrap">
              {DEFAULT_SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-colors ${
                    color === c ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Создать предмет'}
        </button>
      </div>
    </div>
  );
}
