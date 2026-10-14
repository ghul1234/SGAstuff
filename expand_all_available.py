import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Load the API data
with open('all_admin_divisions.json', 'r', encoding='utf-8') as f:
    api_data = json.load(f)

# Add all regions from API that are not in current data
current_regions = {(item[0], item[2]) for item in current_data}
added_count = 0

for country_data in api_data['data']:
    country_name = country_data['country']
    for div in country_data['divisions']:
        if (div['name_en'], country_name) not in current_regions:
            current_data.append([div['name_en'], 5967, country_name])
            current_regions.add((div['name_en'], country_name))
            added_count += 1

print('Added ' + str(added_count) + ' new divisions from API')
print('New total: ' + str(len(current_data)))

# Convert to JSON
json_data = json.dumps(current_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with all available API regions')
print('Still missing from 4,200 target: ' + str(4200 - len(current_data)))