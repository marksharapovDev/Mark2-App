# #1

import random

kb = int(input("Введите количество бросков: "))
count_o = 0
count_r = 0

for i in range(kb):
    x = random.randint(1, 2)
    if x == 1:
        count_o += 1
    else:
        count_r += 1

print(f"Количество орлов: {count_o}")
print(f"Количество решек: {count_r}")

#2

kb = int(input("Введите количество бросков: "))

for i in range(kb):
    throw = random.randint(1, 6)
    print(throw)


#3

length = int(input("Введите длину: "))
string_ascii_letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
a = []

for i in range(length):
    a.append(random.choice(string_ascii_letters))

print(''.join(a))

#4

numbers = []

for i in range(7):
    a = random.randint(1, 49)
    if a not in numbers:
        numbers.append(a)

print(sorted(numbers))


#5
import string

def generate_index():
    letters1 = ''.join(random.choices(string.ascii_uppercase, k=2))
    number1 = random.randint(0, 99)
    number2 = random.randint(0, 99)
    letters2 = ''.join(random.choices(string.ascii_uppercase, k=2))

    number1_str = f"{number1:02d}"
    number2_str = f"{number2:02d}"


    return f"{letters1}{number1_str}_{number2_str}{letters2}"

print(generate_index())


#6

m = [[1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
          [13, 14, 15, 16]]

for row in m:
    random.shuffle(row)


#7

with open('lines.txt', 'r', encoding='utf-8') as file:
    lines = file.readlines()
    random_line = random.choice(lines)
    print(random_line.strip())

#8

s = []
with open('numbers.txt', 'r', encoding='utf-8') as file:
    lines = file.readlines()
    for i in lines:
        s.append(int(i))
print(sum(s))