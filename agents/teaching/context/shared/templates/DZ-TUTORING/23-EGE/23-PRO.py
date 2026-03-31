
# def f(start, end):
#     if start > end:
#         return 0
#     if start == end:
#         return 1
#     else:
#         return f(start + 1, end) + f(start * 3, end) + f(start + 2, end)
# print(f(2, 9) * f(9, 11) * f(11, 12))

def f(start, end):
	if start > end:
		return 0
	if start == end:
		return 1
	else:
		return f(start + 1, end) + f(start * 3, end) + f(start + 2, end)
	
print(f(2, 9) * f(9, 11) * f(11, 12))


# def f(start, end):
# 	if start > end or start == 20:
# 		return 0
# 	if start == end:
# 		return 1
# 	else:
# 		return f(start + 1, end) + f(start * 2, end)
# print(f(3, 11) * f(11, 25))

# def f(start, end):
# 	if start > end or start == 20:
# 		return 0
# 	if start == end: 
# 		return 1
# 	else:
# 		return f(start + 1, end) + f(start * 2, end)
	
# print(f(3, 11) * f(11, 25))


# def f(start, end, k):
#     if start > end + 1:
#         return 0
#     if start == end:
#         return 1
#     else:
#         if k == 1:
#             return f(start + 3, end, k - 1) + f(start * 2, end, k - 1)
#         else:
#             return f(start - 1, end, k + 1) + f(start + 3, end, k) + f(start * 2, end, k)
# print(f(4, 14, 0))

