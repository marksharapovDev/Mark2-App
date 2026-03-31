# #1-----------------------------------

# def F(n):
#     if n == 1 or n == 2:
#         return 1
#     if n > 2:
#         return F(n - 2) * n
# print(F(7))

# #6189
# #105


# #2-----------------------------------

# from sys import *
# setrecursionlimit(10**6)

# def F(n):
#     if n < 11:
#         return 10
#     else:
#         return n + F(n - 1)
# print(F(2124) - F(2122))

# #59761
# #4247


# #3--------------------------------------

# def F(n):
#     if n < 11:
#         return n
#     else:
#         return n + F(n - 1)
# print(F(2024) - F(2021))

# #59694
# #6069


# #4---------------------------------------

# def F(n):
#     if n == 1:
#         return 1
#     if n == 2:
#         return 2
#     if n > 2 and n % 2 == 0:
#         return int((4*n-F(n-3))/8)
#     if n > 2 and n % 2 != 0:
#         return int((4*n-F(n-1)+F(n-2))/8)
# print(F(52)-F(38))

# #58228
# #7

from sys import *
setrecursionlimit(10**8)

def f(n):
    if n >= 20:
        return f(n-5) + 3219
    else:
        return (8 * g(n-9))-34
def g(n):
    if n >= 250000:
        return n / 24 + 32
    else:
        return g(n+9) - 3
print(f(925))