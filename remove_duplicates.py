import json
import re

# Extract data from the updated HTML file (has correct GDP values)
with open('sga_50_states_full_view_updated.html', 'r', encoding='utf-8') as f:
    content = f.read()

states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Split by array pattern
    array_entries = re.findall(r'\["([^"]+)",(\d+),"([^"]+)"\]', states_data)
    
    states_list = []
    for name, gdp, country in array_entries:
        states_list.append([name, int(gdp), country])
    
    print('Extracted ' + str(len(states_list)) + ' entries from updated HTML')
    
    # Create a set of existing names+country to avoid duplicates
    existing = {(item[0], item[2]) for item in states_list}
    
    # Now add only international regions from complete_regions.txt
    # Skip US, USA, and China since we already have them from updated HTML
    with open('complete_regions.txt', 'r', encoding='utf-8') as f:
        complete_data = f.read()
    
    complete_lines = complete_data.strip().split('\n')
    added_count = 0
    for line in complete_lines:
        match = re.match(r'\["([^"]+)",(\d+),"([^"]+)"\]', line)
        if match:
            name = match.group(1)
            gdp = int(match.group(2))
            country = match.group(3)
            
            # Skip US, USA, and China entries
            if country in ['US', 'USA', 'China']:
                continue
            
            # Skip if already exists
            if (name, country) not in existing:
                states_list.append([name, gdp, country])
                existing.add((name, country))
                added_count += 1
    
    print('Added ' + str(added_count) + ' international regions')
    print('Total entries: ' + str(len(states_list)))
    
    # Check for duplicates
    name_counts = {}
    for item in states_list:
        name = item[0]
        if name in name_counts:
            name_counts[name] += 1
        else:
            name_counts[name] = 1
    
    duplicates = {name: count for name, count in name_counts.items() if count > 1}
    print('Duplicate names: ' + str(len(duplicates)))
    if duplicates:
        for name, count in list(duplicates.items())[:10]:
            print('  ' + name + ': ' + str(count) + ' times')
    
    # Check US states
    us_states = [item for item in states_list if item[2] == 'US']
    print('US states: ' + str(len(us_states)))
    
    # Check China
    china = [item for item in states_list if item[2] == 'China']
    print('China provinces: ' + str(len(china)))
    
    # Convert to JSON
    json_data = json.dumps(states_list, ensure_ascii=False)
    
    # Write to states_data.js
    with open('src/states_data.js', 'w', encoding='utf-8') as f:
        f.write('const statesData = ')
        f.write(json_data)
        f.write(';\n')
    
    print('Data file created without duplicates')
    
    # Show sample GDP values
    print()
    print('Sample GDP values:')
    us_sorted = sorted(us_states, key=lambda x: x[1], reverse=True)
    for name, gdp, country in us_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')
    
    china_sorted = sorted(china, key=lambda x: x[1], reverse=True)
    for name, gdp, country in china_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')