import json

with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

data = json.loads(json_str)

# Find duplicates by name only (ignoring country)
name_counts = {}
name_details = {}

for item in data:
    name = item[0]
    country = item[2]
    gdp = item[1]
    
    if name in name_counts:
        name_counts[name] += 1
        name_details[name].append((country, gdp))
    else:
        name_counts[name] = 1
        name_details[name] = [(country, gdp)]

# Show duplicates
print('Names that appear multiple times:')
for name, count in name_counts.items():
    if count > 1:
        print('  ' + name + ' (' + str(count) + ' times):')
        for country, gdp in name_details[name]:
            print('    ' + country + ' - GDP: ' + str(gdp))