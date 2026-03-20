-- =====================
-- Seed: тестовые данные
-- =====================

-- Tasks (dev + study с вложенным чек-листом)
INSERT INTO tasks (id, sphere, title, description, status, priority) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'dev', 'Сделать лендинг LI Group', 'Дизайн + вёрстка главной страницы', 'in_progress', 1),
  ('a0000000-0000-0000-0000-000000000002', 'dev', 'Hero-секция', NULL, 'todo', 0),
  ('a0000000-0000-0000-0000-000000000003', 'study', 'Курсовая по физике', 'Тема: оптические волокна', 'todo', 2);

-- Вложенный чек-лист: "Hero-секция" → подзадача "Сделать лендинг"
UPDATE tasks SET parent_id = 'a0000000-0000-0000-0000-000000000001'
  WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- Calendar events
INSERT INTO calendar_events (sphere, title, start_at, end_at, recurrence, reminder) VALUES
  ('teaching', 'Урок с Алексом — JavaScript', '2026-03-21 15:00:00+03', '2026-03-21 16:00:00+03', 'weekly', 30),
  ('health', 'Тренировка ног', '2026-03-21 10:00:00+03', '2026-03-21 11:30:00+03', 'none', 15);

-- Daily notes
INSERT INTO daily_notes (content, sorted, source) VALUES
  ('Потратил 500р на обед, сделал тренировку ног, нужно доделать форму на сайте LI Group',
   '{"finance": "транзакция 500р обед", "health": "тренировка ног", "dev": "задача: форма на LI Group"}',
   'mobile');

-- Dev projects
INSERT INTO dev_projects (name, slug, status, stack, repo_url) VALUES
  ('LI Group сайт', 'li-group-site', 'active',
   '{"framework": "Next.js", "language": "TypeScript", "css": "Tailwind", "db": "Supabase"}',
   'https://github.com/mark/li-group-site'),
  ('Личный сайт', 'my-site', 'paused',
   '{"framework": "Astro", "language": "TypeScript"}',
   NULL);

-- Students
INSERT INTO students (name, subject, level, schedule) VALUES
  ('Алекс Петров', 'JavaScript', 'beginner',
   '{"day": "saturday", "time": "15:00", "duration": 60}'),
  ('Мария Иванова', 'Python', 'intermediate',
   '{"day": "wednesday", "time": "18:00", "duration": 90}');

-- Subjects
INSERT INTO subjects (name, semester, professor) VALUES
  ('Физика', 4, 'Смирнов А.В.'),
  ('Математический анализ', 4, 'Козлова Е.П.');

-- Transactions
INSERT INTO transactions (amount, type, category, description, date, source) VALUES
  (500.00, 'expense', 'food', 'Обед в кафе', '2026-03-20', 'voice'),
  (45000.00, 'income', 'freelance', 'Оплата за лендинг LI Group', '2026-03-18', 'manual');

-- Workouts
INSERT INTO workouts (type, exercises, duration, date, notes) VALUES
  ('gym',
   '[{"name": "Приседания", "sets": 4, "reps": 10, "weight": 80}, {"name": "Жим ногами", "sets": 3, "reps": 12, "weight": 120}]',
   75, '2026-03-20', 'Хорошая тренировка, прибавил 5кг в приседе'),
  ('run', NULL, 35, '2026-03-19', 'Лёгкий бег 5км');
