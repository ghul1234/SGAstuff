import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

print('Current total: ' + str(len(current_data)))

# Clean up duplicates - prioritize US and China entries
seen_names = {}
cleaned_data = []

for item in current_data:
    name = item[0]
    gdp = item[1]
    country = item[2]
    
    if name not in seen_names:
        seen_names[name] = item
        cleaned_data.append(item)
    else:
        existing = seen_names[name]
        # Prioritize US entries
        if country == 'US' and existing[2] != 'US':
            cleaned_data.remove(existing)
            cleaned_data.append(item)
            seen_names[name] = item
        # Prioritize China entries
        elif country == 'China' and existing[2] != 'China':
            cleaned_data.remove(existing)
            cleaned_data.append(item)
            seen_names[name] = item
        # Otherwise keep higher GDP
        elif gdp > existing[1]:
            cleaned_data.remove(existing)
            cleaned_data.append(item)
            seen_names[name] = item

print('After duplicate removal: ' + str(len(cleaned_data)))

# Check for remaining duplicates
name_counts = {}
for item in cleaned_data:
    name = item[0]
    if name in name_counts:
        name_counts[name] += 1
    else:
        name_counts[name] = 1

duplicates = {name: count for name, count in name_counts.items() if count > 1}
print('Remaining duplicate names: ' + str(len(duplicates)))

# Check US states
us_states = [item for item in cleaned_data if item[2] == 'US']
print('US states: ' + str(len(us_states)))

# Check China
china = [item for item in cleaned_data if item[2] == 'China']
print('China provinces: ' + str(len(china)))

# Convert to JSON
json_data = json.dumps(cleaned_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file cleaned of duplicates')
print('Still missing from 4,200 target: ' + str(4200 - len(cleaned_data)))