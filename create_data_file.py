import json
import re

# Combine both data files
with open('dose_regions.txt', 'r', encoding='utf-8') as f:
    dose_data = f.read()

with open('complete_regions.txt', 'r', encoding='utf-8') as f:
    complete_data = f.read()

# Combine the two files
combined_data = dose_data.strip() + '\n' + complete_data.strip()

# Parse the data into a proper JavaScript array
lines = combined_data.strip().split('\n')
states_data = []

for line in lines:
    # Parse each line
    match = re.match(r'\["([^"]+)",(\d+),"([^"]+)"\]', line)
    if match:
        name = match.group(1)
        gdp = int(match.group(2))
        country = match.group(3)
        # Normalize USA to US
        if country == 'USA':
            country = 'US'
        states_data.append([name, gdp, country])

# Convert to JSON which is valid JavaScript
json_data = json.dumps(states_data, ensure_ascii=False)

# Write as a JavaScript file
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file created with proper JSON encoding')
print('Total entries:', len(states_data))
us_count = len([s for s in states_data if s[2] == 'US'])
china_count = len([s for s in states_data if s[2] == 'China'])
print('US states:', us_count)
print('China provinces:', china_count)
