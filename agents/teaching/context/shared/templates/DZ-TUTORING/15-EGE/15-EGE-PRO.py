


# def f(x):
# 	P = 12 <= x <= 62
# 	Q = 52 <= x <= 92
# 	A = a1 <= x <= a2
# 	return not(not(A) and P) or Q == A or not(P) or Q

# 	r = []
# 	d = [y for x in (12, 52, 62, 92) for y in (x, x-0.1, x+0.1)]
# 	for a1 in d:
# 		for a2 in d:
# 			if all(f(x) == 1 for x in d) and a1 <= a2:
# 				r += [a2-a1]
# 	print(min(r))

## 3 ---

# def f(x):
#     P = 19 <= x <= 84
#     Q = 4 <= x <= 51
#     A = a1 <= x <= a2
#     # (x∈P) → (¬(x∈Q) → ¬((x∈P) ∧ ¬(x∈A)))
#     return P <= ((not Q) <= (not (P and (not A))))

# r = []

# Контрольные точки: границы P и Q и точки рядом с ними
# points = (4, 19, 51, 84)
# d = [y for x in points for y in (x - 0.1, x, x + 0.1)]x

# for a1 in d:
#     for a2 in d:
#         if a2 >= a1 and all(f(x) == 1 for x in d):
#             r.append(a2 - a1)

# print(round(min(r)))

# 4 ---

# def f(x):
#     P = 12 <= x <= 62
#     Q = 52 <= x <= 92
#     A = a1 <= x <= a2
#     # (x∈P) → (¬(x∈Q) → ¬((x∈P) ∧ ¬(x∈A)))
#     return not((not A) and P ) or Q

# r = []

# # Контрольные точки: границы P и Q и точки рядом с ними
# points = (12, 52, 62, 92)
# d = [y for x in points for y in (x - 0.1, x, x + 0.1)]

# for a1 in d:
#     for a2 in d:
#         if a2 >= a1 and all(f(x) == 1 for x in d):
#             r.append(a2 - a1)

# print(round(min(r)))



# for A in range(300):
#     k = 0
#     for x in range(300):
#         for y in range(300):
#             if (x < A) or (y < A) or (y>x-5) or (y < 2*x - 15):
#                 k += 1
#     if k == 90_000:
#         print(A)
#         break
