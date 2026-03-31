#  1
numbers = [(10, 10, 10), (30, 45, 56), (81, 39), (1, 2, 3), (12,), (-2, -4, 100), (1, 2, 99), (89, 9, 34), (10, 20, 30, -2), (50, 40, 50), (34, 78, 65), (-5, 90, -1, -5), (1, 2, 3, 4, 5, 6), (-9, 8, 4), (90, 1, -45, -21)] 

averages = []  
for tup in numbers: 
    averages.append(sum(tup) / len(tup))  

min_index = averages.index(min(averages)) 
max_index = averages.index(max(averages)) 

print(numbers[min_index])  
print(numbers[max_index]) 

# 2
points = [(-1, 1), (5, 6), (12, 0), (4, 3), (0, 1), (-3, 2), (0, 0), (-1, 3), (2, 0), (3, 0), (-9, 1), (3, 6), (8, 8)]  # Список точек с координатами

distances = []  
for point in points: 
    distance = (point[0] ** 2 + point[1] ** 2) ** 0.5  
    distances.append(distance)  
    
sorted_points = []  
for i in range(len(points)):  
    min_dist = min(distances)  
    min_index = distances.index(min_dist) 
    sorted_points.append(points[min_index])  
    distances[min_index] = 999999 
print(sorted_points)  

# 3
numbers = [(10, 10, 10), (30, 45, 56), (81, 80, 39), (1, 2, 3), (12, 45, 67), (-2, -4, 100), (1, 2, 99), (89, 90, 34), (10, 20, 30), (50, 40, 50), (34, 78, 65), (-5, 90, -1)] 

sums = []  
for tup in numbers:  
    min_num = min(tup)  
    max_num = max(tup)  
    sums.append(min_num + max_num)  

sorted_numbers = []  
for i in range(len(numbers)):  
    min_sum = min(sums) 
    min_index = sums.index(min_sum) 
    sorted_numbers.append(numbers[min_index]) 
    sums[min_index] = 999999 

print(sorted_numbers) 

# 4
athletes = [('Дима', 10, 130, 35), ('Тимур', 11, 135, 39), ('Руслан', 9, 140, 33), ('Рустам', 10, 128, 30), ('Амир', 16, 170, 70), ('Рома', 16, 188, 100), ('Матвей', 17, 168, 68), ('Петя', 15, 190, 90)] 

n = int(input()) 

sorted_athletes = sorted(athletes, key=lambda x: x[n-1])

for athlete in sorted_athletes:
    print(*athlete)

#  5
numbers = input().split()  

digit_sums = []  
for num in numbers: 
    sum_digits = 0 
    for digit in num:  
        sum_digits += int(digit)  
    digit_sums.append(sum_digits) 

sorted_numbers = [] 
for i in range(len(numbers)): 
    min_sum = min(digit_sums)  
    min_index = digit_sums.index(min_sum) 
    sorted_numbers.append(numbers[min_index])
    digit_sums[min_index] = 999999 

print(*sorted_numbers)  