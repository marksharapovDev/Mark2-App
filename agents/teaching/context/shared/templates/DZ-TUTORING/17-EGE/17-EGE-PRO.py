
count = m = 0
l = [int(i) for i in open('17.txt')]
for i in range(len(l) - 1):
    for j in range(i+1, len(l)):
        if (l[i] - l[j]) % 80 == 0:
            count += 1
            m = max(m, abs(l[i] - l[j]))
print(count, m)


# M = [int(x) for x in open('17.txt')]
# MAXI = max([x for x in M if abs(x) % 100 == 19])
# count = 0
# maxi = -99999
# for i in range(len(M)-2):
#     a, b, c = M[i], M[i+1], M[i+2]
#     # A = [len(str(abs(a))) == 4, len(str(abs(b))) == 4, len(str(abs(c))) == 4]
#     A = [len(str(abs(x))) == 4 for x in [a, b, c]]
#     if sum(A) == 2:
#         # if a % 3 == 0 or b % 3 == 0 or c % 3 == 0:
#         if any(x % 3 == 0 for x in [a, b, c]):
#             if (a + b + c) > MAXI:
#                 count += 1
#                 maxi = max(maxi, a + b + c)
# print(count, maxi)


a = [int(s) for s in open('17.txt')]
a123 = max([x for x in a if x % 1000 == 123])
count = 0
s3 = []
for i in range (len(a) - 2):
    if ((a[i] + a[i+1] + a[i+2]) > a123):
        if ((a[i] % 3 == 0) + (a[i + 1] % 3 == 0) + (a[i + 2] % 3 == 0)) == 1:
            if (((len(str(a[i])) == 5) + (len(str(a[i + 1])) == 5) + (len(str(a[i + 2])) == 5))) > 1:
                s3.append(a[i] + a[i+1] + a[i+2])
print(len(s3),max(s3))


# count = m = 0
# f = open('17.txt')
# l = [int(i) for i in f]
# min_sp = 0
# for i in range(len(l)):
#     if abs(l[i]) % 10 == 7:
#         min_sp = min(min_sp, l[i])

# for i in range(len(l) - 1):
#     if ((abs(l[i])%10==7 and (abs(l[i+1]))%10!=7) or ((abs(l[i]))%10!=7 and abs((l[i+1]))%10==7)) and ((l[i]**2+l[i+1]**2) < min_sp**2):
#         count += 1
#         m = max(m, (l[i]  **2 + l[i+1] **2))
# print(count, m)