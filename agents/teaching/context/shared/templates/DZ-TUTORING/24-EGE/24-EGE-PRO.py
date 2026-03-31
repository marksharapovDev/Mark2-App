f = open('1.txt').readline()
#LDR
f = f.replace('DL', 'D L')
f = f.replace('RD', 'R D')
f = f.replace('LR', 'L R')
while 'DD' in f: f = f.replace('DD', 'D D')
while 'RR' in f: f = f.replace('RR', 'R R')
while 'LL' in f: f = f.replace('LL', 'L L')

n = f.split()

print(max(len(i) for i in n))

