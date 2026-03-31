# # Файл содержит последовательность натуральных чисел, не превышающих 100 000. Назовём тройкой три идущих подряд элемента последовательности.
# # Задание 17
# # Определите количество троек, для которых выполняются следующие условия:
# # —  хотя бы два числа в тройке пятизначные;
# # —  ровно одно число в тройке делится на 3;
# # —  сумма элементов тройки больше максимального элемента последовательности, запись которого заканчивается на 123. (Гарантируется, что в последовательности есть хотя бы один элемент, запись которого заканчивается на 123.)
# #  
# # В ответе запишите два числа: сначала количество найденных троек, затем максимальную величину суммы элементов этих троек.

# # s = [int(x) for x in open('17-9.txt')]
# # max123 = max([x for x in s if x % 1000 == 123])
# # # s = [1, 1 ,2 ,12, 23]

# # l = []
# # for i in range(len(s)-2):
# # 	a = s[i]
# # 	b = s[i+1]
# # 	c = s[i+2]
# # 	t = [a, b, c]
# # 	p = [x for x in t if len(str(x)) == 5]
# # 	if len(p) >= 2:
# # 		d = [x for x in t if x % 3 == 0]
# # 		if len(d) == 1:
# # 			if sum(t) > max123:
# # 				l.append(sum(t))
# # print(len(l), max(l))

# # Файл содержит последовательность натуральных чисел, не превышающих 100 000. Назовём тройкой три идущих подряд элемента последовательности.
# # Задание 17
# # Определите количество троек, для которых выполняются следующие условия:
# # —  ровно два числа в тройке четырёхзначные;
# # —  хотя бы одно число в тройке делится на 3;
# # —  сумма элементов тройки больше максимального элемента последовательности, запись которого заканчивается на 19. (Гарантируется, что в последовательности есть хотя бы один элемент, запись которого заканчивается на 19.)
# #  
# # В ответе запишите два числа: сначала количество найденных троек, затем максимальную величину суммы элементов этих троек.

# # s = [int(x) for x in open('17-9.txt')]
# # max19 = max([x for x in s if x % 100 == 19])
# # l = []
# # for i in range(len(s)-2):
# # 	a = s[i]
# # 	b = s[i+1]
# # 	c = s[i+2]
# # 	t = [a, b, c]
# # 	ch = [x for x in t if len(str(x)) == 4]
# # 	d = [x for x in t if x % 3 == 0]
# # 	if len(ch) == 2:
# # 		if len(d) >= 1:
# # 			if sum(t) > max19:
# # 				l.append(sum(t))

# # print(len(l), max(l))

# # cnt=0
# # for i in open('1.txt'):
# #     s=[int(x) for x in i.split()]
# #     d=[x for x in s if s.count(x)==1]
# #     if len(d)==5:
# #         s=sorted(s)
# #         # if sum(s[3]+s[4])<=sum(s[0]+s[1]+s[2]):
# #             # cnt+=1
# #         print(s[0] + s[1])
# # print(cnt)

# # m = 1000
# # for i in range(201, 300):
# #     s = i * '1'
# #     while ('1111'):
# #         s = s.replace('1111','22',1)
# #         s = s.replace('222', '1', 1)
# #     if s.count('1') < m:
# #         print(i)
# #         m = s.count('1')
# #         break


# # Файл содержит последовательность натуральных чисел, не превышающих 20 000. Назовём парой два идущих подряд элемента последовательности.
# # Задание 17
# # Определите количество пар, для которых выполняются следующие условия:
# # —  ровно одно число в паре четырёхзначное;
# # —  сумма квадратов элементов пары без остатка делится на наименьшее в последовательности трёхзначное число, запись которого заканчивается цифрой 5.
# #  
# # В ответе запишите два числа: сначала количество найденных пар, затем максимальную из сумм квадратов элементов таких пар.
# # cnt = []
# # s = [int(x) for x in open('1.txt')]
# # min5 = min([x for x in s if x % 10 == 5 and len(str(x)) == 3])
# # for i in range(len(s)-1):
# # 	a = s[i]
# # 	b = s[i+1]
# # 	d = [a, b]
# # 	ch = [x for x in d if x >= 1000 and x < 10000]
# # 	if len(ch) == 1:
# # 		if (a ** 2 + b ** 2) % min5 == 0:
# # 			cnt.append(a ** 2 + b ** 2)
# # print(len(cnt), max(cnt))

# # В файле содержится последовательность из 10 000 целых положительных чисел. Каждое число не превышает 10 000. Определите и запишите в ответе сначала количество пар элементов последовательности, у которых разность элементов кратна 36 и хотя бы один из элементов кратен 13, затем максимальную из разностей элементов таких пар. В данной задаче под парой подразумевается два различных элемента последовательности. Порядок элементов в паре не важен.
# # cnt = []
# # s = [int(x) for x in open('1.txt')]
# # for i in range(len(s) - 1):
# # 	a = s[i]
# # 	b = s[i+1]
# # 	d = [a, b]
# # 	if (a-b) % 36 == 0:
# # 		if a % 13 == 0 or b % 13 == 0:
# # 			cnt.append(abs(a-b)) 

# # print(len(cnt), max(cnt))
# # # print(abs(13 - 26))


# # from itertools import*
# # cnt = 0
# # for i in product('0123456789', repeat = 5):
# # 	i = ''.join(i)
# # 	if int(i[0]) < int(i[1]) and int(i[1]) < int(i[2]) and int(i[2]) < int(i[3]) and int(i[3]) < int(i[4]):
# # 			cnt += 1
# # print(cnt)
# # =
# # print(252/100000)
# # Алгоритм вычисления значения функции  где n  — натуральное число, задан следующими соотношениями:
# #  если 
# #  если  и четное,
# #  если  и нечетное.
# # Чему равно значение выражения 

# # def F(n):
# # 	if n >= 10000:
# # 		return 1

# Алгоритм получает на вход натуральное число N (100 < N < 1000) и строит по нему новое число R следующим образом.
# 1.  Строится двоичная запись числа N.
# 2.  Если сумма цифр десятичной записи заданного числа нечётна, то в конец двоичной записи дописывается 1, если чётна  — 0.
# 3−4.  Пункт 2 повторяется для вновь полученных чисел ещё два раза.
# 5.  Результатом работы алгоритма становится десятичная запись полученного числа R.

# Определите количество принадлежащих отрезку [123 456 789; 1 987 654 321] чисел, которые могут получиться в результате работы этого алгоритма.


# for n in range(0, 10):
# 	s = bin(n)[2:]
# 	print(s)

# Повтори 4 [Вперёд 10 Направо 90].


# Определите, сколько точек с целочисленными координатами будут находиться внутри области, ограниченной линией, заданной данным алгоритмом. Точки на линии учитывать не следует.

# forward(1000) - fd()
# back(1000) - bk()
# right(90) - rt()
# left(90) - lt()

# from turtle import *

# tracer(0)
# screensize(10000, 10000)
# m = 30

# for i in range(4):
# 	fd(10 * m)
# 	rt(90)

# up()
# for x in range(-50, 50):
# 	for y in range(-50, 50):
# 		goto(x * m, y * m)
# 		dot(3, 'blue')


# update()
# exitonclick()

# f = open('1.txt').readline()
# #LDR
# f = f.replace('DL', 'D L')
# f = f.replace('RD', 'R D')
# f = f.replace('LR', 'L R')
# while 'DD' in f: f = f.replace('DD', 'D D')
# while 'RR' in f: f = f.replace('RR', 'R R')
# while 'LL' in f: f = f.replace('LL', 'L L')

# n = f.split()

# print(max(len(i) for i in n))


# import matplotlib.pyplot as plt
# import numpy as np

# # Исходные данные
# N = np.array([1, 10000, 20000, 30000])
# Z_per = np.array([4718.19, 4718.19, 4718.19, 4718.19])
# Z_post = np.array([67780000, 6778.42, 3389.21, 2259.47])
# Z_full = Z_per + Z_post

# # Перевод в млн руб.
# Z_per_m = Z_per / 1e6
# Z_post_m = Z_post / 1e6
# Z_full_m = Z_full / 1e6

# # Гладкая шкала X от 1 до 30000
# x = np.linspace(1, 30000, 500)

# # Интерполяция кривых
# z_per_curve = np.full_like(x, Z_per_m[0])
# z_post_curve = np.interp(x, N, Z_post_m)
# z_full_curve = np.interp(x, N, Z_full_m)

# # Построение графика
# plt.figure(figsize=(10,6))

# plt.plot(x, z_per_curve, label='Удельные переменные затраты (Zперем.уд)', color="#d4a017", linewidth=2)
# plt.plot(x, z_post_curve, label='Удельные постоянные затраты (Zпост.уд)', color="#4aa0d8", linewidth=2)
# plt.plot(x, z_full_curve, label='Полная себестоимость единицы (Zполн.уд)', linestyle='--', color="#009682", linewidth=2)

# plt.xlabel("Объем производства, шт.")
# plt.ylabel("Затраты на единицу продукции, млн руб.")
# plt.title("Зависимость удельных затрат от объема производства\n(ось начинается с 1)")
# plt.grid(True, linestyle="--", linewidth=0.5)
# plt.legend()
# plt.tight_layout()

# plt.show()
# cnt = 0
# d = {}
# for i in open('1.txt'):
# 	s = [x for x in i.split()]
# 	d[s[0]] = int(s[1])

# print(d)


# from ipaddress import *
# maxi = 0
# for mask in range(32+1):
#     net = ip_network(f'157.220.185.237/{mask}', 0)
#     if str(net) == f'157.220.184.230/{mask}':
#         maxi = max(maxi, net.num_addresses)
# print(maxi)
# print(bin(192))


# счетчик = 3
# number = 2

# while счетчик != 7:
# 	number *= number
# 	счетчик += 1
# print(number)

from re import T


# title = input()
# minutes = int(input())
# print(f'{title} длится {minutes} минут')

# author = input()
# status = input()
# print()


# course = input()
# students = int(input())
# print(f'{course} обучается {students} студентов')

# surname = input()
# mark = int(input())
# # print(f'{surname} получил {mark}')100
# price = int(input())
# lastmoney = int(input())
# print(f'i bought ticket {price}, initiialy i have {lastmoney + price}')

# cnt = 0
# n = 1
# while n != 0:
# 	n = int(input())
# 	if n > 100:
# 		cnt += 1
# print(cnt)

# # 

# data = 'битва началась,в,1380,году,и,закончилась,в,1391'
# data = data.split()
# print(data)
# companies = input().split()
# days = input()
# maxDay = int(input())
# cnt = -1
# for i in days.split():
#     cnt+=1
#     if int(i) <=maxDay:
#         print(companies[cnt])
    
# s = 'string'
# print(s)
# list = ['str', 123, 'str2']
# dict = {'key':'meaning', 'key2':'meaning2'}
# bool = True/False -> 1/0
# flt = 
# from random import shuffle

# a = list('1234')
# shuffle(a)
# print(a)
to_buy = 'Покупаем!'
not_to_buy = 'Не покупаем!'

# material = input()
# inf = input().split(', ')
# print(inf)
# if material in inf:
# 	print(to_buy)
# else:
# 	print(not_to_buy)
# cnt = []
# while True:
# 	name = input().split(', ')
# 	if name[-1] == 'посетила':
# 		cnt.append(name[-1])
# 	if name[0] == 'Конец':
# 		break
# print(len(cnt))
# to_buy = 'Покупаем!'
# not_to_buy = 'На карте недостаточно средств'
# inf = input().split(', ')
# amount = int(input())
# cnt = 0
# for i in inf:
# 	i = i.split(': ')
# 	cnt += int(i[1])
# if cnt <= amount:
# 	print(to_buy)
# else:	
# 	print(not_to_buy)

# or and == xor

# eva = input().split(', ')
# ana = input().split(', ')
# best = input().split(', ')
# cnt = []
# for i in eva:
# 	if i in ana and i in best:
# 		cnt.append(i)
# cnt = sorted(cnt)[::-1]
# print(', '.join(cnt))



# for i in range(0, 10**10, 3147):
# 	if str(i)[0] == '1' and str(i)[-1] == '1' and str(i)[-6:-2] == '4302':
# 		print(i)

from fnmatch import *
for i in range(0, 10**10, 3147):
	if fnmatch(str(i), '1*4302?1'):
		print(i)