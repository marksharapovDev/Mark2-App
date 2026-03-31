import pandas as pd
import matplotlib.pyplot as plt  # Добавляем импорт matplotlib


df = pd.read_csv('Mobiles.csv', encoding='unicode_escape')

# # 1. Первые 50 строк и 10 столбцов
# print("\n1. Первые 50 строк и 10 столбцов:")
# print(df.head(50).iloc[:, :10])

# # 2. Сводная статистика 
# print("\n2. Сводная статистика:")
# print(df.describe(include='all'))

# # 3. Фильтрация - смартфоны с рейтингом выше 4.5
# print("\n3. Телефоны выпущенные до 2020")
# filtered_df = df[df['Launched Year'] < 2020]
# print(filtered_df)

# # # 4. Сортировка по рейтингу
# # print("\n4. Сортировка по рейтингу (по убыванию):")
# # print(df.sort_values(by='rating', ascending=False).head())

# # 5. Очистка данных
# df_cleaned = df.dropna()
# df_cleaned = df_cleaned.drop_duplicates()
# print("\n5. Размер после очистки:", df_cleaned.shape)

# # 6. Группировка по бренду и подсчет моделей
# print("\n6. Количество моделей по брендам:")
# print(df.groupby('Company Name').size())

# # 7. Сумма весов всех телефонов
# print("\n7. Общий вес всех телефонов:")
# total_weight = df['Mobile Weight'].str.extract('(\d+)').astype(float).sum()
# print(f"Общий вес всех телефонов: {total_weight} г")

# # 8. Средний вес телефонов
# print("\n8. Средний вес телефонов:")
# average_weight = float(df['Mobile Weight'].str.extract('(\d+)').astype(float).mean())
# print(f"Средний вес телефона: {average_weight:.2f} г")

# 9. Гистограммы
# Извлекаем числовые значения из Battery Capacity и Mobile Weight
# df['Battery_Numeric'] = df['Battery Capacity'].str.extract('(\d+)').astype(float)
# df['Weight_Numeric'] = df['Mobile Weight'].str.extract('(\d+)').astype(float)

# # Строим гистограммы
# df['Battery_Numeric'].plot(kind='hist', bins=30, title='Распределение емкости аккумуляторов (мАч)')
# plt.figure()  # Создаем новый рисунок для второй гистограммы
# df['Weight_Numeric'].plot(kind='hist', bins=30, title='Распределение веса телефонов (г)')

# # Отображаем графики
# plt.show()

# 10. Столбчатая диаграмма - количество моделей по компаниям
df['Company Name'].value_counts().plot(
    kind='bar',
    title='Количество моделей по компаниям',
    figsize=(10, 6)  # Увеличиваем размер графика для лучшей читаемости
)
plt.xticks(rotation=45)  # Поворачиваем подписи компаний для лучшей читаемости
plt.tight_layout()  # Автоматически регулируем размещение элементов
plt.show()

# # 11. Круговая диаграмма
# plt.figure(figsize=(10, 10))
# df['Company Name'].value_counts().plot(kind='pie', autopct='%1.1f%%')
# plt.title('Доля компаний на рынке')
# plt.axis('equal')
# plt.show()

# 12. Линейный график
# df['Battery Capacity'] = df['Battery Capacity'].str.extract('(\d+)').astype(float)

# plt.figure(figsize=(12, 6))
# df.groupby('Launched Year')['Battery Capacity'].mean().plot(kind='line')
# plt.title('Средняя емкость аккумулятора по годам')
# plt.xlabel('Год выпуска')
# plt.ylabel('Емкость аккумулятора (мАч)')
# plt.grid(True)
# plt.show()

# # 13. Точечная диаграмма
# plt.figure(figsize=(10, 6))
# plt.scatter(df['Battery Capacity'], df['Mobile Weight'])
# plt.title('Зависимость веса от емкости аккумулятора')
# plt.xlabel('Емкость аккумулятора (мАч)')
# plt.ylabel('Вес (г)')
# plt.show()

# 14.2 Сводная таблица по брендам и емкости аккумуляторов
# Сначала извлекаем числовые значения из столбца Battery Capacity
# df['Battery_Numeric'] = df['Battery Capacity'].str.extract('(\d+)').astype(float)

# pivot = pd.pivot_table(df, 
#                       values=['Battery_Numeric'],
#                       index='Company Name',
#                       aggfunc={
#                           'Battery_Numeric': ['mean', 'min', 'max', 'count']
#                       })

# # Переименовываем столбцы для лучшей читаемости
# pivot.columns = ['Средняя емкость', 'Минимальная емкость', 'Максимальная емкость', 'Количество моделей']
# print("\n14.2 Сводная статистика по брендам и аккумуляторам (мАч):")
# print(pivot)


# # Извлекаем числовые значения из Back Camera (например, '48 MP' -> 48)
# df['Back MP'] = df['Back Camera'].str.extract('(\d+)').astype(float)

# # Удалим строки без данных
# camera_df = df[['Company Name', 'Back MP']].dropna()

# # Считаем среднее по компаниям
# avg_back_camera = camera_df.groupby('Company Name')['Back MP'].mean().sort_values(ascending=False)

# # Строим график
# plt.figure(figsize=(12, 6))
# avg_back_camera.plot(kind='bar', color='mediumseagreen')
# plt.title('Среднее количество мегапикселей задней камеры по брендам')
# plt.xlabel('Компания')
# plt.ylabel('Мегапиксели')
# plt.xticks(rotation=45)
# plt.tight_layout()
# plt.show()