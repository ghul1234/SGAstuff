with open(r"d:\SGAs\sga-website\src\main.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace duplicate let recentTrades in Markets section
content = content.replace("let recentTrades = [];\n\n// Exchange Data", "recentTrades = [];\n\n// Exchange Data")

with open(r"d:\SGAs\sga-website\src\main.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed duplicate let declaration")
