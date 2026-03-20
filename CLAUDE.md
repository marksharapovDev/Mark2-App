# CLAUDE.md — Mark2

## Что это

Mark2 — персональный хаб управления жизнью. Десктоп (Electron) +
мобильное (React Native) приложение. Пять сфер: разработка,
преподавание, учёба, спорт, финансы. Система агентов — отдельный
под каждую сферу + один общий.

## Документация

- `docs/mark-v2-architecture.md` — полная архитектура, БД, план

**Перед написанием кода — читай соответствующий doc-файл.**

## Структура monorepo

```
app/desktop/     — Electron + React (главное приложение)
app/mobile/      — React Native (iPhone, вспомогательное)
app/shared/      — общие типы, утилиты, схемы валидации
agents/          — контексты агентов (CLAUDE.md + файлы)
supabase/        — миграции БД
docs/            — документация
```

## Стек

- Monorepo: pnpm workspaces
- Язык: TypeScript (strict)
- Desktop: Electron + React + Tailwind
- Mobile: React Native (позже)
- БД: Supabase (PostgreSQL + Storage)
- AI (desktop): Claude Code CLI через child_process (подписка Max)
- AI (mobile): Claude API Haiku (дешёвая модель)
- Интеграции: Apple Calendar, Git, Vercel, Miro

## Ключевой принцип

Тяжёлые задачи → Claude Code через терминал (бесплатно, подписка).
Лёгкие задачи (мобилка) → API Haiku ($2-10/мес).
Никаких BullMQ, Redis, воркеров — Electron напрямую вызывает Claude Code.

## Конвенции

- TypeScript strict, no `any`
- Файлы: kebab-case (claude-bridge.ts)
- Переменные/функции: camelCase
- Типы/интерфейсы: PascalCase
- Валидация через Zod
- Все ключи через .env, никогда не хардкод

## Текущий этап

Фаза 1: Фундамент
- pnpm workspaces
- app/shared — типы для всех сфер
- supabase — миграции
- agents/ — CLAUDE.md для каждого агента
- Electron скелет + ClaudeBridge
