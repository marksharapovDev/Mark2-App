


# def f(x1, x2, c, win):
# 	if x1 + x2 >= 68:
# 		return c in win
# 	if c > max(win):
# 		return 0
# 	moves = [f(x1+1,x2, c + 1, win), f(x1,x2+1, c + 1, win), f(x1+4,x2, c + 1, win), f(x1,x2+4, c + 1, win), f(x1*5,x2, c + 1, win), f(x1,x2*5, c + 1, win)]
# 	if c % 2 != max(win) % 2:
# 		return any(moves)
# 	else:
# 		return any(moves)
	
# for s in range(1, 67+1): 
# 	if f(s, 0, [2]) == 1:
# 		print(s)
# 	if f(x, 0, [3]) == 1:
# 		print(x)
# 	if f(x, 0, [2,4]) == 1 and f(x, 0, [2]) == 0:
# 		print(x)

def f(x1, x2, c, win):
	if x1 + x2 >= 68:
		return c in win
	if c > max(win):
		return 0
	moves = [f(x1+1,x2, c + 1, win), f(x1,x2+1, c + 1, win), f(x1+4,x2, c + 1, win), f(x1,x2+4, c + 1, win), f(x1*5,x2, c + 1, win), f(x1,x2*5, c + 1, win)]
	if c % 2 != max(win) % 2:
		return any(moves)
	else:
		return all(moves)

# for s in range(1, 67+1): 

# from itertools import *

# for i in product('0123456', repeat=5):
# 	s = ''.join(i)
# 	if s.count('6') == 1:
# 		print(s)
# 		break

from itertools import *

for i in product('0123456', repeat=5):
	s = ''.join(i)
	if s.count('6') == 1:
		print(s)
		break

from itertools import *