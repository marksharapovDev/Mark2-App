# Mark v2 — Архитектура

## Принцип

Electron-приложение (десктоп) — центр управления. Тяжёлые задачи
выполняет Claude Code через терминал (подписка Max). Мобильное
приложение — лёгкий клиент через API. Все данные хранятся
в Supabase + локальные файлы.

---

## Файловая структура на Mac

```
~/mark/                              # Корневая папка всего
├── app/                             # Исходники приложений
│   ├── desktop/                     # Electron + React
│   │   ├── src/
│   │   │   ├── main/                # Electron main process
│   │   │   │   ├── index.ts         # Точка входа
│   │   │   │   ├── claude-bridge.ts # Вызов Claude Code CLI
│   │   │   │   ├── file-watcher.ts  # Отслеживание изменений файлов
│   │   │   │   └── integrations/    # Apple Calendar, Git, etc.
│   │   │   └── renderer/            # React UI
│   │   │       ├── App.tsx
│   │   │       ├── pages/
│   │   │       │   ├── Dashboard.tsx     # Главная: все сферы
│   │   │       │   ├── Dev.tsx           # Раздел разработки
│   │   │       │   ├── Teaching.tsx      # Преподавание
│   │   │       │   ├── Study.tsx         # Учёба
│   │   │       │   ├── Health.tsx        # Спорт/здоровье
│   │   │       │   ├── Finance.tsx       # Финансы
│   │   │       │   ├── Calendar.tsx      # Единый календарь
│   │   │       │   ├── Chat.tsx          # Чат с агентом
│   │   │       │   └── Settings.tsx      # Настройки
│   │   │       └── components/
│   │   ├── package.json
│   │   └── electron-builder.yml
│   │
│   ├── mobile/                      # React Native (iPhone)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   ├── Chat.tsx          # Чат с общим агентом
│   │   │   │   └── QuickCapture.tsx  # Быстрый ввод (голос/фото)
│   │   │   ├── services/
│   │   │   │   ├── api.ts            # Claude API (Haiku)
│   │   │   │   └── supabase.ts
│   │   │   └── components/
│   │   └── package.json
│   │
│   └── shared/                      # Общие типы между desktop и mobile
│       ├── types/
│       ├── utils/
│       └── package.json
│
├── agents/                          # Контексты агентов
│   ├── dev/                         # Агент разработки
│   │   ├── CLAUDE.md                # Инструкции: роль, правила, стек
│   │   ├── context/                 # Контекст проектов
│   │   │   ├── projects.json        # Список проектов + статусы
│   │   │   └── active/              # Активные проекты (симлинки)
│   │   └── memory/                  # Память агента
│   │       └── decisions.md         # История решений
│   │
│   ├── teaching/                    # Агент преподавания
│   │   ├── CLAUDE.md
│   │   ├── context/
│   │   │   ├── students.json        # Список учеников
│   │   │   ├── templates/           # Шаблоны ДЗ, тестов
│   │   │   └── materials/           # Учебные материалы
│   │   └── memory/
│   │
│   ├── study/                       # Агент учёбы
│   │   ├── CLAUDE.md
│   │   ├── context/
│   │   │   ├── subjects/            # Папка под каждый предмет
│   │   │   │   ├── math/
│   │   │   │   │   ├── info.json    # Описание, преподаватель
│   │   │   │   │   ├── templates/   # Титульник, стиль
│   │   │   │   │   └── work/        # Текущие работы
│   │   │   │   └── physics/
│   │   │   └── semester.json        # Текущий семестр
│   │   └── memory/
│   │
│   ├── health/                      # Агент спорта
│   │   ├── CLAUDE.md
│   │   ├── context/
│   │   │   ├── workouts.json        # План тренировок
│   │   │   ├── nutrition.json       # Питание
│   │   │   └── stats/               # Статистика по дням
│   │   └── memory/
│   │
│   ├── finance/                     # Агент финансов
│   │   ├── CLAUDE.md
│   │   ├── context/
│   │   │   ├── transactions/        # Транзакции по месяцам
│   │   │   ├── goals.json           # Финансовые цели
│   │   │   └── budget.json          # Бюджет
│   │   └── memory/
│   │
│   └── general/                     # Общий агент
│       ├── CLAUDE.md                # Видит всё, сортирует по сферам
│       ├── context/
│       │   └── life-overview.json   # Краткая сводка по всем сферам
│       └── memory/
│           └── daily-notes/         # Ежедневные заметки (из мобилки)
│
├── projects/                        # Проекты разработки (git repos)
│   ├── li-group-site/
│   ├── my-site/
│   └── ...
│
└── data/                            # Локальные данные
    ├── screenshots/                 # Скриншоты банка и т.д.
    ├── exports/                     # Экспортированные файлы
    └── cache/                       # Кэш
```

---

## Claude Bridge — как Electron вызывает Claude Code

```typescript
// app/desktop/src/main/claude-bridge.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

class ClaudeBridge extends EventEmitter {

  // Запустить задачу через Claude Code (одиночный запрос)
  async run(options: {
    agent: string;          // 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general'
    prompt: string;         // Что сделать
    cwd?: string;           // Рабочая директория (по умолчанию ~/mark/agents/{agent})
  }): Promise<string> {

    const agentDir = options.cwd || `${HOME}/mark/agents/${options.agent}`;

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['-p', options.prompt], {
        cwd: agentDir,
        env: { ...process.env },
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('stream', { agent: options.agent, chunk: data.toString() });
      });

      proc.stderr.on('data', (data) => {
        this.emit('error', { agent: options.agent, error: data.toString() });
      });

      proc.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Claude Code exited with ${code}`));
      });
    });
  }

  // Запустить интерактивную сессию (для чата)
  startSession(agent: string): ChildProcess {
    const agentDir = `${HOME}/mark/agents/${agent}`;

    const proc = spawn('claude', [], {
      cwd: agentDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return proc; // UI пишет в stdin, читает из stdout
  }

  // Запустить несколько агентов параллельно (мультиагентность)
  async runParallel(tasks: Array<{
    agent: string;
    prompt: string;
    cwd?: string;
  }>): Promise<Map<string, string>> {

    const results = new Map();
    const promises = tasks.map(async (task) => {
      const result = await this.run(task);
      results.set(task.agent, result);
    });

    await Promise.all(promises);
    return results;
  }
}

export const claude = new ClaudeBridge();
```

**Пример использования:**

```typescript
// Один агент
const design = await claude.run({
  agent: 'dev',
  prompt: 'Сгенерируй дизайн главной страницы для LI Group',
  cwd: '~/mark/projects/li-group-site',
});

// Параллельно 3 агента
const results = await claude.runParallel([
  { agent: 'dev', prompt: 'Сделай код главной страницы' },
  { agent: 'study', prompt: 'Составь план курсовой по физике' },
  { agent: 'finance', prompt: 'Посчитай расходы за эту неделю' },
]);
```

---

## Агенты — структура CLAUDE.md

### Пример: agents/dev/CLAUDE.md

```markdown
# Агент разработки — Mark

## Роль
Ты — агент разработки. Помогаешь создавать сайты и приложения
для клиентов. Работаешь с кодом, дизайном, деплоем.

## Стек по умолчанию
Next.js + TypeScript + Tailwind + Supabase
(может варьироваться — смотри конфиг проекта)

## Правила
1. Перед началом работы прочитай context/projects.json
2. Все решения записывай в memory/decisions.md
3. Код: TypeScript strict, no any
4. Коммиты: conventional commits (feat:, fix:, etc.)
5. Перед деплоем на прод — всегда спроси подтверждение

## Текущие проекты
Смотри context/projects.json
```

### Пример: agents/general/CLAUDE.md

```markdown
# Общий агент — Mark

## Роль
Ты — главный персональный агент Марка. Видишь все сферы жизни.
Умеешь сортировать информацию по нужным агентам.

## Сферы
- dev: разработка (~/mark/agents/dev/)
- teaching: преподавание (~/mark/agents/teaching/)
- study: учёба (~/mark/agents/study/)
- health: спорт/здоровье (~/mark/agents/health/)
- finance: финансы (~/mark/agents/finance/)

## Правила
1. Когда получаешь информацию — определи к какой сфере она относится
2. Сохрани в соответствующую папку агента
3. Обновляй context/life-overview.json после каждого важного события
4. При ежедневном отчёте — бери данные из всех агентов

## Формат сортировки
Если пользователь надиктовал: "Сегодня потратил 500р на обед,
сделал тренировку ног, и нужно доделать форму на сайте LI Group"

→ finance: транзакция 500р обед
→ health: тренировка ног
→ dev: задача "форма на LI Group"
```

---

## Хранилище данных

### Два уровня:

**Локальные файлы (~/mark/agents/*/context/):**
- Быстрый доступ для Claude Code (читает файлы мгновенно)
- Контекст агентов, конфиги проектов, шаблоны
- Git-репозитории проектов

**Supabase (облако):**
- Синхронизация между десктопом и мобилкой
- История транзакций, статистика, задачи
- Календарные события
- Данные учеников

### Синхронизация:
Electron-приложение при запуске синхронизирует локальные файлы
с Supabase. Мобильное приложение работает напрямую с Supabase.

---

## Схема БД (Supabase)

### Общие таблицы

```sql
-- Задачи из всех сфер
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sphere      TEXT NOT NULL,          -- dev | teaching | study | health | finance
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'todo',    -- todo | in_progress | done | cancelled
  priority    INT DEFAULT 0,
  due_date    TIMESTAMPTZ,
  parent_id   UUID REFERENCES tasks(id),  -- вложенные чек-листы
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Календарные события
CREATE TABLE calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sphere      TEXT NOT NULL,
  title       TEXT NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  recurrence  TEXT,                    -- daily | weekly | none
  reminder    INT,                     -- минут до события
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Ежедневные заметки (с мобилки)
CREATE TABLE daily_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,           -- Что надиктовал
  sorted      JSONB,                   -- Результат сортировки по сферам
  source      TEXT DEFAULT 'mobile',   -- mobile | desktop
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Разработка

```sql
CREATE TABLE dev_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'active',
  stack       JSONB DEFAULT '{}',
  repo_url    TEXT,
  deploy_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### Преподавание

```sql
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT,
  level       TEXT,                    -- beginner | intermediate | advanced
  schedule    JSONB,                   -- расписание уроков
  stats       JSONB DEFAULT '{}',      -- статистика, прогресс
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Учёба

```sql
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  semester    INT NOT NULL,
  professor   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Финансы

```sql
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount      DECIMAL NOT NULL,
  type        TEXT NOT NULL,           -- income | expense
  category    TEXT,                    -- food | transport | salary | freelance
  description TEXT,
  date        DATE DEFAULT CURRENT_DATE,
  source      TEXT DEFAULT 'manual',   -- manual | screenshot | voice
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Здоровье

```sql
CREATE TABLE workouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,           -- gym | run | swim
  exercises   JSONB,                   -- массив упражнений
  duration    INT,                     -- минут
  date        DATE DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## Мобильное приложение — как работает

Мобилка НЕ вызывает Claude Code (нет терминала).
Использует Claude API (Haiku — самая дешёвая модель).

### Основные сценарии:

**1. Быстрый захват (QuickCapture):**
- Нажал кнопку → надиктовал → API (Haiku) сортирует по сферам
- → сохраняет в Supabase → десктоп подхватит при синхронизации

**2. Календарь:**
- Читает из Supabase (синхронизирован с десктопом)
- Показывает задачи из всех сфер
- Можно добавить/изменить

**3. Финансы:**
- Сфоткал чек → API распознаёт → записал в transactions
- Надиктовал "потратил 300р на такси" → записал

**4. Чат с общим агентом:**
- Лёгкие вопросы через API (Haiku)
- Контекст подтягивается из Supabase (не из файлов)

---

## Стоимость

| Компонент | $/мес |
|-----------|-------|
| Claude Max x5 подписка | $100 |
| Claude API Haiku (мобилка) | $2-10 |
| Supabase Free | $0 |
| Apple Developer (для iOS) | $8 ($99/год) |
| **Итого** | **$110-118** |

При необходимости: Claude Max x20 ($200) если лимитов x5 не хватит.

---

## План разработки

### Фаза 1: Фундамент (неделя 1-2)
- Создать структуру ~/mark/
- Написать все CLAUDE.md для агентов
- Supabase: миграции всех таблиц
- Electron: скелет приложения + ClaudeBridge
- Тест: вызвать Claude Code из Electron

### Фаза 2: Десктоп MVP (неделя 3-4)
- UI: Dashboard, разделы по сферам
- Чат с агентами (интерактивная сессия Claude Code)
- Управление проектами (Dev раздел)
- Календарь (базовый)
- Синхронизация с Supabase

### Фаза 3: Мобильное приложение (неделя 5-6)
- React Native: Dashboard, Calendar, QuickCapture
- API интеграция (Haiku)
- Синхронизация с Supabase
- Push-уведомления

### Фаза 4: Интеграции и полировка (неделя 7-8)
- Apple Calendar
- Git/GitHub
- Miro
- Мультиагентность
- Оптимизация UX
