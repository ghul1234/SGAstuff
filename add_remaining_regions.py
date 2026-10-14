import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)
current_regions = {(item[2], item[0]) for item in current_data}  # (country, name)

print('Current data has ' + str(len(current_data)) + ' unique regions')

# Load all_admin_divisions.json
with open('all_admin_divisions.json', 'r', encoding='utf-8') as f:
    all_admin = json.load(f)

# Extract all unique regions from all_admin_divisions
all_admin_regions = set()
for country_data in all_admin['data']:
    for div in country_data['divisions']:
        all_admin_regions.add((country_data['country'], div['name_en']))

print('all_admin_divisions.json has ' + str(len(all_admin_regions)) + ' unique regions')

# Add missing regions from all_admin_divisions
new_data = current_data.copy()
new_regions_added = 0

for country_data in all_admin['data']:
    for div in country_data['divisions']:
        key = (country_data['country'], div['name_en'])
        if key not in current_regions:
            # Use global median GDP for regions without GDP data
            new_data.append([div['name_en'], 5967, country_data['country']])
            new_regions_added += 1

print('Added ' + str(new_regions_added) + ' new regions from all_admin_divisions')
print('New total: ' + str(len(new_data)))

# Convert to JSON
json_data = json.dumps(new_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with all_admin_divisions regions')
print('Still missing from 4,200 target: ' + str(4200 - len(new_data)))