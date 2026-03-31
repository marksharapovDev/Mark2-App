# 1 ------------------------------------------------

# cnt = 0
# for line in open('1-9-EGE.txt'):
# 	a = [int(x) for x in line.split()]
# 	dont_repeat = [x for x in a if a.count(x) == 1]
# 	even = 0
# 	not_even = 0
# 	sum_even = 0
# 	sum_not_even = 0
# 	for i in a:
# 		if i % 2 == 0:
# 			sum_even += i
# 			even += 

# 		else:
# 			sum_not_even += i
# 			not_even += 1
# 	if len(dont_repeat) == 5 and even > not_even and sum_even < sum_not_even:
# 		cnt += 1
# print(cnt)

#### 52180
#### 241


# 2-------------------------------------------------

cnt = 0
for line in open('1-9-EGE.txt'):
	a = [int(x) for x in line.split()]
	repeat = [x for x in a if a.count(x) == 3]
	dont_repeat = [x for x in a if a.count(x) == 1]
	if len(repeat) == 3 and len(dont_repeat) == 3:
		if sum(repeat) ** 2 > sum(dont_repeat) ** 2:
			cnt += 1
# print(cnt)

#### 70536
#### 273

# 3 -------------------------------------------------

cnt = 0
for line in open('1-9-EGE.txt'):
	a = [int(x) for x in line.split()]
	repeat = [x for x in a if a.count(x) == 2]
	dont_repeat = [x for x in a if a.count(x) == 1]
	if len(repeat) == 4 and len(dont_repeat) == 3:
		if sum(dont_repeat) / len(dont_repeat) < sum(repeat) / len(repeat):
			cnt += 1
# print(cnt)

#### 59802
#### 24

# ------------------------------------------------

a = [1, 2, 3, 4]
b = [int(x) for x in a if x < 3]
print(b)








# m = [1, 2]
# if 2:
# 	print('Not empty')
# else:
# 	print('Empty')
