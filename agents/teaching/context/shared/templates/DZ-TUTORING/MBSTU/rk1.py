from datetime import datetime
import random
import pandas as pd

# Функция для получения строки лога
def parse_log_line(line):
    try:
        parts = line.strip().split(' ', 3)
        timestamp = datetime.strptime(parts[0] + ' ' + parts[1], '%Y-%m-%d %H:%M:%S')
        level = parts[2]

        return timestamp, level
    except Exception as e:
        return None

cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург']
severity_levels = {'INFO': 1, 'WARNING': 2, 'ERROR': 3}

# Создаем данные для DataFrame
data = []
with open('logfile.log', 'r', encoding='utf-8') as infile:
    lines = infile.readlines()
    for line in lines:
        parsed = parse_log_line(line)
        if parsed:
            timestamp, level = parsed
            data.append({
                'timestamp': timestamp,
                'level': level,
                'city': random.choice(cities),
                'severity': severity_levels[level],
                'hour': timestamp.hour,
                'date': timestamp.date(),
                'message': line.split(' ', 3)[3].strip()
            })

# Создаем DataFrame
df = pd.DataFrame(data)

# 1. Вывести первые 50 строк и не более 10 столбцов
print("\n1. Первые 50 строк:")
print(df.iloc[:50, :10])

# 2. Сводная статистика
print("\n2. Сводная статистика:")
print(df.describe())

# 3. Фильтрация (только ERROR)
print("\n3. Только ошибки:")
errors_df = df[df['level'] == 'ERROR']
print(errors_df.head())

# 4. Сортировка по времени
print("\n4. Сортировка по времени:")
print(df.sort_values('timestamp').head())

# 5. Очистка данных (удаление дубликатов)
df_cleaned = df.drop_duplicates()
print("\n5. Размер после очистки:", df_cleaned.shape)

# 6. Группировка по городам и уровню
print("\n6. Группировка по городам и уровню:")
grouped = df.groupby(['city', 'level']).size().unstack()
print(grouped)

# 7. Сумма ошибок по часам
print("\n7. Сумма ошибок по часам:")
errors_by_hour = df[df['level'] == 'ERROR'].groupby('hour').size()
print(errors_by_hour)

# 8. Среднее количество событий по городам
print("\n8. Среднее количество событий по городам:")
mean_by_city = df.groupby('city').size().mean()
print(mean_by_city)

# 9-13. Визуализация с помощью pandas
# Гистограмма
df['hour'].hist(bins=24, title='Распределение событий по часам')
df['severity'].hist(bins=3, title='Распределение по уровню важности')

# Столбчатая диаграмма
df['level'].value_counts().plot(kind='bar', title='Количество событий по уровням')

# Круговая диаграмма
df['city'].value_counts().plot(kind='pie', title='Распределение по городам')

# Линейный график
errors_by_hour.plot(kind='line', title='Количество ошибок по часам')

# Точечная диаграмма
df.plot.scatter(x='hour', y='severity', title='Распределение важности по часам')

# 14. Дополнительные возможности pandas
# Скользящее среднее
rolling_mean = df.groupby('hour')['severity'].mean().rolling(window=3).mean()
print("\n14.1 Скользящее среднее важности по часам:")
print(rolling_mean)

# Сводная таблица
pivot_table = pd.pivot_table(df, values='severity', 
                            index='city', 
                            columns='level', 
                            aggfunc='count', 
                            fill_value=0)
print("\n14.2 Сводная таблица:")
print(pivot_table)

# Сохранение результатов
df.to_csv('log_analysis.csv', index=False)
