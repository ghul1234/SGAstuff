import re

with open(r"d:\SGAs\sga-website\src\main.js", "r", encoding="utf-8") as f:
    content = f.read()

# Separate before and after Markets section
parts = content.split("/* MARKETS TAB JAVASCRIPT FUNCTIONS */")
header_part = parts[0]
markets_part = parts[1]

# Rename drawChart -> drawMarketsChart in markets_part
markets_part = re.sub(r'\bdrawChart\b', 'drawMarketsChart', markets_part)

# Rename selectState -> selectMarketsState in markets_part
markets_part = re.sub(r'\bselectState\b', 'selectMarketsState', markets_part)

new_content = header_part + "/* MARKETS TAB JAVASCRIPT FUNCTIONS */" + markets_part

with open(r"d:\SGAs\sga-website\src\main.js", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Renamed Markets functions to avoid collision!")
