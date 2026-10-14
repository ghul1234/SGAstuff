import re

with open(r"d:\SGAs\sga-website\src\main.js", "r", encoding="utf-8") as f:
    content = f.read()

funcs = re.findall(r'function\s+([a-zA-Z0-9_$]+)', content)
from collections import Counter
counts = Counter(funcs)

duplicates = [f for f, c in counts.items() if c > 1]
print("Duplicate functions:", duplicates)
