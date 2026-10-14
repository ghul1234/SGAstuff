import csv
import json

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

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)
current_regions = {(item[2], item[0]) for item in current_data}  # (country, name)

print('Current data has ' + str(len(current_regions)) + ' unique regions')

# Find regions in DOSE that are not in current data
new_regions = dose_regions - current_regions
print('New regions from DOSE: ' + str(len(new_regions)))

# Show sample new regions
print()
print('Sample new regions from DOSE:')
for i, (country, region) in enumerate(list(new_regions)[:10]):
    try:
        print('  ' + region + ', ' + country)
    except:
        print('  [Unicode error showing name]')
    if i >= 9:
        break

# Calculate potential total
potential_total = len(current_data) + len(new_regions)
print()
print('Current total: ' + str(len(current_data)))
print('Potential total with DOSE: ' + str(potential_total))
print('Still missing from 4,200 target: ' + str(4200 - potential_total))