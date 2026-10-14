import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Get current countries and their counts
current_countries = {}
for item in current_data:
    country = item[2]
    if country in current_countries:
        current_countries[country] += 1
    else:
        current_countries[country] = 1

print('Current countries and division counts:')
for country, count in sorted(current_countries.items()):
    print('  ' + country + ': ' + str(count))

print()
print('Total countries: ' + str(len(current_countries)))
print('Total divisions: ' + str(len(current_data)))