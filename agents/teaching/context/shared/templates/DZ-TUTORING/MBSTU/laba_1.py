from collections import defaultdict

def log_file(log_filename, output_filename):
    log_l = {"INFO": 0, "WARNING": 0, "ERROR": 0}
    errors_h = defaultdict(int)
    with open(log_filename, "r", encoding="utf-8") as file:
        for i in file:
            parts = i.strip().split(" ", 3)
            if len(parts) < 4:
                continue      
            time_part, level, _ = parts[1], parts[2], parts[3]     
            if level in log_l:
                log_l[level] += 1         
                if level == "ERROR":
                    hour = time_part.split(":")[0]
                    errors_h[hour] += 1  
    max_error_hour = max(errors_h, key=errors_h.get, default="Нет ошибок")
    max_error_count = errors_h.get(max_error_hour, 0)  
    output = (f"Статистика логов:\n"
              f"INFO: {log_l['INFO']}\n"
              f"WARNING: {log_l['WARNING']}\n"
              f"ERROR: {log_l['ERROR']}\n"
              f"Наибольшое кол-во ошибок: {max_error_hour} (количество: {max_error_count})")   
    print(output)
    with open(output_filename, "w", encoding="utf-8") as out_file:
        out_file.write(output)

log_filename = "logfile.log"
output_filename = "log_stats.txt"
log_file(log_filename, output_filename)
