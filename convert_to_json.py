import json
import re

with open('complete_regions.txt', 'r', encoding='utf-8') as f:
    data = f.read()

# Parse the data into a proper JavaScript array format
# Convert from ["name",gdp,"country"] format to JSON
lines = data.strip().split('\n')
states_data = []

for line in lines:
    # Parse each line
    match = re.match(r'\["([^"]+)",(\d+),"([^"]+)"\]', line)
    if match:
        name = match.group(1)
        gdp = int(match.group(2))
        country = match.group(3)
        states_data.append([name, gdp, country])

# Convert to JSON
json_data = json.dumps(states_data, ensure_ascii=False)

# Now insert this into the HTML file
with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the states array with a JSON string that we parse
import re
pattern = r'const states = \[.*?\];'
replacement = f'const states = JSON.parse(\'{json_data}\');'

new_html = re.sub(pattern, replacement, html, flags=re.DOTALL)

with open('sga_50_states_full_view.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print('Converted to JSON format successfully')