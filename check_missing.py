import re
import json

# Check dose_regions.txt for regions not in current data
with open('dose_regions.txt', 'r', encoding='utf-8') as f:
    dose_data = f.read()

dose_entries = re.findall(r'\["([^"]+)",(\d+),"([^"]+)"\]', dose_data)
print('dose_regions.txt has ' + str(len(dose_entries)) + ' entries')

# Check complete_regions.txt for regions not in current data  
with open('complete_regions.txt', 'r', encoding='utf-8') as f:
    complete_data = f.read()

complete_entries = re.findall(r'\["([^"]+)",(\d+),"([^"]+)"\]', complete_data)
print('complete_regions.txt has ' + str(len(complete_entries)) + ' entries')

# Check current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)
current_names = {(item[0], item[2]) for item in current_data}
print('Current data has ' + str(len(current_data)) + ' entries')

# Find dose_regions.txt entries not in current data
missing_from_dose = []
for name, gdp, country in dose_entries:
    if (name, country) not in current_names:
        missing_from_dose.append((name, country, int(gdp)))

print('Missing from dose_regions.txt: ' + str(len(missing_from_dose)))

# Find complete_regions.txt entries not in current data
missing_from_complete = []
for name, gdp, country in complete_entries:
    if (name, country) not in current_names:
        missing_from_complete.append((name, country, int(gdp)))

print('Missing from complete_regions.txt: ' + str(len(missing_from_complete)))

# Show what's missing
if missing_from_dose:
    print()
    print('Sample missing from dose_regions.txt:')
    for name, country, gdp in missing_from_dose[:10]:
        print('  ' + name + ', ' + country + ' (GDP: ' + str(gdp) + ')')

if missing_from_complete:
    print()
    print('Sample missing from complete_regions.txt:')
    for name, country, gdp in missing_from_complete[:10]:
        print('  ' + name + ', ' + country + ' (GDP: ' + str(gdp) + ')')