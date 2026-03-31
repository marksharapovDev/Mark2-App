# from turtle import *

# tracer(0) # моментально отображать изменения
# screensize(10000, 10000) # размер окна
# m = 40 # масштаб

# for i in range(2):
# 	fd(14 * m) #forward
# 	lt(270) #left
# 	bk(12 * m) #backward
# 	rt(90) #right

# up() # поднять хвост

# fd(9 * m); rt(90); bk(7 * m); lt(90)

# down() # опустить хвост

# for i in range(2):
# 	fd(13 * m)
# 	rt(90) 
# 	fd(6 * m) 
# 	rt(90) 

# up()
# for x in range(0, 50):
# 	for y in range(0, 50):
# 		goto(x * m, y * m) # переместиться в точку (x * m, y * m)
# 		dot(3, 'black') # нарисовать точку размером 3 пикселя цвета black

# update() # обновить экран
# exitonclick() # закрыть окно при клике

from turtle import*
screensize(5000,5000)
tracer(0)
m=20
for i in range(4):
    fd(9*m)
    rt(90)
    fd(7*m)
    rt(90)
up()
for x in range(-50,50):
    for y in range(-50,50):
        goto(x*m, y*m)
        dot(3, 'blue')
update()
exitonclick()