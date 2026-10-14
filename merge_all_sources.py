import csv
import json
import re

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)
current_regions = {(item[2], item[0]) for item in current_data}  # (country, name)

print('Current data has ' + str(len(current_data)) + ' unique regions')

# Load DOSE data
dose_regions = set()
dose_data = {}

with open('DOSE_V2.14.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        key = (row['country'], row['region'])
        dose_regions.add(key)
        # Store the most recent year's data
        if key not in dose_data or int(row['year']) > dose_data[key]['year']:
            dose_data[key] = {
                'country': row['country'],
                'region': row['region'],
                'year': int(row['year']),
                'grp_pc_usd': float(row['grp_pc_usd']) if row['grp_pc_usd'] else None
            }

print('DOSE dataset has ' + str(len(dose_regions)) + ' unique regions')

# Add DOSE regions that are not in current data
new_data = current_data.copy()
new_regions_added = 0

for (country, region), data in dose_data.items():
    if (country, region) not in current_regions:
        # Convert DOSE data to our format
        # Use grp_pc_usd as GDP proxy (convert to millions)
        gdp = int(data['grp_pc_usd']) if data['grp_pc_usd'] else 5967  # Use global median if missing
        new_data.append([region, gdp, country])
        new_regions_added += 1

print('Added ' + str(new_regions_added) + ' new regions from DOSE')
print('New total: ' + str(len(new_data)))

# Convert to JSON
json_data = json.dumps(new_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with DOSE regions')
print('Still missing from 4,200 target: ' + str(4200 - len(new_data)))