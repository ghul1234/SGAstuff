import json

with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

data = json.loads(json_str)

# Find duplicates by name+country
name_counts = {}
duplicates = []

for item in data:
    name = item[0]
    country = item[2]
    key = (name, country)
    
    if key in name_counts:
        duplicates.append((name, country, item[1], name_counts[key]))
        name_counts[key] += 1
    else:
        name_counts[key] = 1

print('Found ' + str(len(duplicates)) + ' duplicate entries:')
for name, country, gdp, count in duplicates[:20]:
    print('  ' + name + ', ' + country + ' (GDP: ' + str(gdp) + ') - appears ' + str(count + 1) + ' times')

# Show which countries have duplicates
print()
print('Countries with duplicates:')
for (name, country), count in name_counts.items():
    if count > 1:
        print('  ' + country + ': ' + name + ' (' + str(count) + ' times)')