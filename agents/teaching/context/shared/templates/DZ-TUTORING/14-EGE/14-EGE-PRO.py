# n = 4
# b = 2
# a = '01'
# r = ''
# while n > 0:
# 	r = a[n%b] + r # r = a[0] + '' == 0
# 	n //= b # n = 2
# print(r)

# n = 2
# b = 2
# a = '01'
# r = '00'
# while n > 0:
# 	r = a[n%b] + r # r = a[0] + 0 == 00
# 	n //= b # n = 1
# print(r)

# n = 1
# b = 2
# a = '01'
# r = '000'
# while n > 0:
# 	r = a[n%b] + r # r = a[1] + '00' == '100'
# 	n //= b # n = 0
# print(r)

# n = 1
# b = 2
# a = '01'
# r = '000'
# while n > 0: # false
# 	r = a[n%b] + r # r = a[1] + '00' == '100'
# 	n //= b # n = 0
# print(r)

# print(bin(4)[2:])

# 5 % 2 = 1 - остаток от деления 
# 5 // 2 = 2 - челая часть

n = 100
b = 20
a = '0123456789abcdefghijklmnopqrstwxyz'
r = ''
while n > 0:
	r = a[n % b] + r
	n //= b

print(r)