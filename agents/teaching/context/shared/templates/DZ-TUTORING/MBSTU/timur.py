import pandas as pd
import matplotlib.pyplot as plt

# Загрузка данных
df = pd.read_csv('german_credit_data.csv')

# 1. Вывод не более 50 строк и не более 10 столбцов
print(df.head(50).iloc[:, :10])

# 2. Сводная статистика
print(df.describe(include='all'))

# 3. Фильтрация: клиенты мужского пола, старше 30 лет
filtered = df[(df['Sex'] == 'male') & (df['Age'] > 30)]

# 4. Сортировка по убыванию суммы кредита
sorted_df = filtered.sort_values('Credit amount', ascending=False)

# 5. Очистка данных: удаление строк с пропусками в столбцах 'Age' и 'Saving accounts'
cleaned = sorted_df.dropna(subset=['Age', 'Saving accounts'])

# 6. Группировка: средний возраст по типу жилья
grouped = cleaned.groupby('Housing')['Age'].mean()
print("\nСредний возраст по типу жилья:\n", grouped)

# 7. Сумма всех кредитов
total_credit = cleaned['Credit amount'].sum()
print(f"\nОбщая сумма кредитов: {total_credit} EUR")

# 8. Средняя продолжительность кредита
avg_duration = cleaned['Duration'].mean()
print(f"Средняя продолжительность кредита: {avg_duration:.1f} месяцев")

# Построение графиков
plt.figure(figsize=(15, 10))

# 9. Гистограмма: распределение возраста и суммы кредита
plt.subplot(2, 3, 1)
plt.hist(cleaned['Age'], bins=20, alpha=0.7, label='Возраст')
plt.hist(cleaned['Credit amount'], bins=20, alpha=0.7, label='Кредит', color='orange')
plt.title('Распределение возраста и суммы кредита')
plt.legend()

# 10. Столбчатая диаграмма: количество клиентов по типу жилья
plt.subplot(2, 3, 2)
cleaned['Housing'].value_counts().plot(kind='bar', color='teal')
plt.title('Тип жилья клиентов')

# 11. Круговая диаграмма: распределение по полу
plt.subplot(2, 3, 3)
df['Sex'].value_counts().plot(kind='pie', autopct='%1.1f%%')
plt.title('Распределение по полу (вся выборка)')

# 12. Линейный график: возраст и сумма кредита
plt.subplot(2, 3, 4)
plt.plot(cleaned['Age'].sort_values().values, cleaned.sort_values('Age')['Credit amount'].values)
plt.title('Возраст и сумма кредита')
plt.xlabel('Возраст')
plt.ylabel('Кредит')

# 13. Точечная диаграмма: возраст vs сумма кредита, цвет — тип работы
plt.subplot(2, 3, 5)
scatter = plt.scatter(
    cleaned['Age'], 
    cleaned['Credit amount'], 
    c=cleaned['Job'], 
    cmap='viridis',
    alpha=0.6
)
plt.colorbar(scatter, label='Тип работы')
plt.xlabel('Возраст')
plt.ylabel('Сумма кредита')
plt.title('Возраст vs Кредит по типу работы')

# 14. Дополнительные пункты:
# - Использование cut() для возрастных групп
# - Агрегация нескольких метрик через agg()
cleaned['AgeGroup'] = pd.cut(cleaned['Age'], bins=[0, 25, 40, 60, 100])
agg_stats = cleaned.groupby('AgeGroup').agg(
    Avg_Credit=('Credit amount', 'mean'),
    Total_Duration=('Duration', 'sum')
)
print("\nАгрегированные показатели по возрастным группам:\n", agg_stats)

plt.tight_layout()
plt.show()