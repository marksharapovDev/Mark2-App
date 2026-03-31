# from ipaddress import *
# for i in range(33):
# 	net = ip_network(f'153.82.140.123/{i}', False)
# 	if '153.82.136.0' in str(net):
# 		print(net.netmask)

# from ipaddress import *
# for i in range(33):
# 	net1 = ip_network(f'84.77.95.123/{i}', False)
# 	net2 = ip_network(f'84.77.96.123/{i}', False)
# 	if net1.netmask == net2.netmask and net1 != net2:
# 		print(net1.netmask)
		
# from ipaddress import*
# net = ip_network('226.185.90.162/255.255.252.0',0)
# count = 0
# for ad in net:
#     if ad == ip_address('226.185.90.162'):
#         print(count)
#     count += 1
# import ipaddress


# import ipaddress

# ip = ipaddress.IPv4Address("208.32.128.64")
# net = ipaddress.IPv4Network(f"{ip}/255.255.192.0", strict=False)
# print(net.network_address)

# for i in range(200, 1000):
# 	s = i * '5'
# 	while '555' in s or '888' in s:
# 		s = s.replace('555', '8', 1)
# 		s = s.replace('888', '55', 1)
# 	if s.count('8') > s.count('5'):
# 		print(i)
# 		break


# for i in range(1, 1000):
# 	s = '3' * 10 + '2' * i
# 	while '23' in s:
# 		s = s.replace('23', '7', 1)
# 	if s.count('2') * 2 + s.count('3') * 3 + s.count('7') * 7 == 82:
# 		print(i)


s = '1234'
n = 1
for i in s:
	n *= int(i)

print(n)

