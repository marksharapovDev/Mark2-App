import pandas as pd 

df = pd.DataFrame({ 
    'name': ["Петя", 'Ваня', 'Катя'],  
    'age': [14, 35, 46] 
})

# 1
print(df)  

# 2
print(df["age"])  

# 3
df['Город'] = ['Москва', 'Санкт-Петербург', 'Казань']  
print(df)  

# 4
filtered_df = df[df['age'] > 25]  
print(filtered_df)  

# 5
statistics = df.describe()  
print(statistics)  

#6
df = pd.read_csv('iris.csv')  
print(df.head())  