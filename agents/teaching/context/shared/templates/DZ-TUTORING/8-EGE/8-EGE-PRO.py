from itertools import *

#TODO words = [''.join(i) for i in product(sorted('WORD'), repeat=REPEAT)]
# используется для слов, где буквы могут повторятся, REPEAT - любой

#TODO for i in permutations('WORD', REPEAT): s = ''.join(i)
# используется для слов, где буквы НЕ могут повторятся, REPEAT <= len(WORD)

# 3207 ---------------------

# words = [''.join(i) for i in product(sorted('КОР'), repeat=5)]
# print(words[237])

#TODO - РРРОК

# 9691---------------------

# words = [''.join(i) for i in product(sorted('ВЛТУ'), repeat=5)]
# print(words[74])

#TODO - ЛВТТ

# 17374 ------------------- 

# cnt = 0
# for i in permutations('ПОЛИНА'):
# 	s = ''.join(i)
# 	s = s.replace('Л', 'П').replace('Н', 'П')
# 	s = s.replace('О', 'А').replace('И', 'А')
# 	if s.count('АА') == 0 and s.count('ПП') == 0:
# 		cnt += 1
# print(cnt)

#TODO - 72

#-------

# words = [''.join(i) for i in product(sorted('ПОЛИНА'), repeat=6)]
# for i in words:
	
# 	if i.count('П') == 1 and i.count('О') == 1 and i.count('Л') == 1 and i.count('И') == 1 and i.count('Н') == 1 and i.count('А') == 1: 
		
# 		if i.count('ПЛ') == 0 and i.count('ПП') == 0 and i.count('ЛЛ') == 0 and i.count('НН') == 0 and i.count('ПН') == 0 and i.count('НЛ') ==0 and i.count('ЛП') ==0 and i.count('НП') ==0 and i.count('ЛН') ==0:	
			
# 			if i.count('АА') == 0 and i.count('ОО') == 0 and i.count('ИИ') == 0 and i.count('АО') == 0 and i.count('ОА') == 0 and i.count('ИА') ==0 and i.count('АИ') ==0 and i.count('ОИ') ==0 and i.count('ИО') ==0:
								
# 			    cnt += 1
# print(cnt)		

# 55625 --------------------

# cnt = 0
# for i in permutations('ЯРОСЛАВ', 5):
# 	s = ''.join(i)
# 	s = s.replace('О', 'А').replace('Я', 'А')
# 	if s.count('АА') == 0 and s.count('ПП') == 0:
# 		if (i.count('Р') + i.count('С') + i.count('Л') + i.count('В')) > (i.count('Я') + i.count('О') + i.count('А')):
# 		    cnt += 1
# print(cnt)

#TODO - 1224

# 59741 --------------------------

# from itertools import *
# word = '0234567'
# count = 0
# for i in permutations(word,5):
#     x = ''.join(i)
#     if x[0] != '0':
#         x = x.replace('7','1').replace('5','1').replace('3','1')
#         x = x.replace('6','0').replace('4','0').replace('2','0')
#         if ('00' not in x) and ('11' not in x):
#             count += 1
# print(count)

#TODO - 180

# 63024 -------------------------

# c1 = '1357'
# c2 = '2468'
# count = 0
# for i in product(c1,c2,c1,c2,c1,c2,c1,c2,c1,c2,c1):
#     s = ''.join(i)
#     if s.count('1') < 5 and s.count('2') < 5 and s.count('3') < 5 and s.count('4') < 5 and s.count('5') < 5 and s.count('6') < 5 and s.count('7') < 5 and s.count('8') < 5:
#         count += 1 
# print(count * 2)

#TODO - 8200800


# DZ ------------------------------------

#1 - КККУК | EGE 3195
#2 - 35 721 | EGE 33087 
#3 - 270 | EGE 10473
#4 - 3352 | EGE 59832

n = 12
if n % 2 ==0:
	print('Четное')
else:
	print('Нечетное')