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
    
    # Check US states
    us_states = [item for item in states_list if item[2] == 'US']
    print('US states: ' + str(len(us_states)))
    
    # Check China
    china = [item for item in states_list if item[2] == 'China']
    print('China provinces: ' + str(len(china)))
    
    # Now add the complete_regions.txt data but skip duplicates
    with open('complete_regions.txt', 'r', encoding='utf-8') as f:
        complete_data = f.read()
    
    # Create a set of existing names to avoid duplicates
    existing_names = {(item[0], item[2]) for item in states_list}
    
    complete_lines = complete_data.strip().split('\n')
    for line in complete_lines:
        match = re.match(r'\["([^"]+)",(\d+),"([^"]+)"\]', line)
        if match:
            name = match.group(1)
            gdp = int(match.group(2))
            country = match.group(3)
            
            # Skip if already exists
            if (name, country) not in existing_names:
                states_list.append([name, gdp, country])
                existing_names.add((name, country))
    
    print('Total entries after merge: ' + str(len(states_list)))
    
    # Check US states again
    us_states = [item for item in states_list if item[2] == 'US']
    print('US states after merge: ' + str(len(us_states)))
    
    # Check China again
    china = [item for item in states_list if item[2] == 'China']
    print('China provinces after merge: ' + str(len(china)))
    
    # Convert to JSON
    json_data = json.dumps(states_list, ensure_ascii=False)
    
    # Write to states_data.js
    with open('src/states_data.js', 'w', encoding='utf-8') as f:
        f.write('const statesData = ')
        f.write(json_data)
        f.write(';\n')
    
    print('Data file created with merged data and correct GDP values')
    
    # Show sample GDP values
    print()
    print('Sample GDP values:')
    us_sorted = sorted(us_states, key=lambda x: x[1], reverse=True)
    for name, gdp, country in us_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')
    
    china_sorted = sorted(china, key=lambda x: x[1], reverse=True)
    for name, gdp, country in china_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')