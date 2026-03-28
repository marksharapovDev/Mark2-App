# Все доступные AI Actions

Формат вызова: `[ACTION:имя]{"param":"value"}[/ACTION]`

## General

- `create_task` — `{sphere, title, description?, priority?: 0|1|2, dueDate?}`
- `complete_task` — `{id}`
- `create_event` — `{title, startAt, endAt, sphere, isRecurring?, recurrenceRule?, metadata?}`
- `update_event` — `{id, title?, startAt?, endAt?, isRecurring?, recurrenceRule?, metadata?}`
- `delete_event` — `{id}`
- `create_reminder` — `{title, date, time?, priority?, sphere?, description?, isRecurring?, recurringPattern?}`
- `complete_reminder` — `{reminderId}`
- `defer_reminder` — `{reminderId, newDate}`
- `delete_reminder` — `{reminderId}`
- `save_file` — `{path, content}`
- `attach_file` — `{entityType, entityId?, filename, filepath, fileType, category}`

## Teaching

- `create_student` — `{name, subject, level?, schedule?}`
- `update_student` — `{id, name?, subject?, level?, schedule?}`
- `find_student` — `{name}`
- `create_lesson` — `{studentName, topic, date?, notes?, homeworkGiven?}`
- `complete_lesson_report` — `{studentName, topicsCovered[], topicsNotCovered?[], notes?, homeworkGiven?, date?}`
- `create_learning_path` — `{studentName, topics: [{title, description?}]}`
- `update_learning_path_topic` — `{topicId, status?, notes?, title?, description?}`
- `delete_learning_path_topic` — `{topicId}`
- `reorder_learning_path` — `{studentId, topicIds[]}`
- `record_student_payment` — `{studentName, amount?, lessonsCount?}`
- `set_student_rate` — `{studentName, rate}`

## Dev

- `create_project` — `{name, description?, techStack?[], repoUrl?}`
- `create_dev_task` — `{projectId, title, description?, priority?, status?, tags?[]}`
- `update_task_status` — `{taskId, status}`
- `generate_task_prompt` — `{taskId}`
- `log_time` — `{taskId, minutes, description?}`
- `defer_task` — `{taskId, newDate}`
- `delete_dev_task` — `{taskId}`
- `delete_project` — `{projectId}`

## Study

- `create_subject` — `{name, description?}`
- `create_assignment` — `{subjectId, title, description?, dueDate?, priority?}`
- `update_assignment` — `{assignmentId, title?, description?, status?, dueDate?}`
- `delete_assignment` — `{assignmentId}`
- `create_exam` — `{subjectId, title, date, description?}`
- `update_exam` — `{examId, title?, date?, description?, status?}`
- `delete_exam` — `{examId}`
- `save_study_note` — `{subjectId, title, content}`
- `generate_summary` — `{subjectId, topicId?}`

## Finance

- `add_transaction` — `{type: "income"|"expense", amount, category, description?, date?}`
- `log_expense` — `{amount, category, description?, date?}`
- `record_student_payment` — `{studentName, amount?, lessonsCount?}`
- `set_student_rate` — `{studentName, rate}`
- `create_savings_goal` — `{name, targetAmount, deadline?}`
- `add_savings` — `{goalId, amount}`

## Health

- `log_workout` — `{type, duration?, exercises?[], notes?}`
- `log_health` — `{type, value, notes?, date?}`
- `create_health_goal` — `{type, target, deadline?}`
- `update_health_goal` — `{goalId, target?, status?}`
- `create_training_program` — `{name, type, days[]}`
- `update_training_program_day` — `{programId, dayIndex, exercises[]}`
- `create_meal_plan` — `{name, meals[]}`
- `log_meal` — `{type, description, calories?, protein?, date?}`
