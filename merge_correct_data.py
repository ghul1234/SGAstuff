import json
import re

# Extract data from the updated HTML file (has correct GDP values)
with open('sga_50_states_full_view_updated.html', 'r', encoding='utf-8') as f:
    content = f.read()

states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Parse the array entries
    lines = states_data.split('],[')
    lines[0] = lines[0].replace('[', '')
    lines[-1] = lines[-1].replace(']', '')
    
    states_list = []
    for line in lines:
        line = line.strip()
        if line:
            try:
                entry = json.loads('[' + line + ']')
                states_list.append(entry)
            except:
                pass
    
    print(f'Extracted {len(states_list)} entries from updated HTML')
    
    # Check US states
    us_states = [item for item in states_list if item[2] == 'US']
    print(f'US states: {len(us_states)}')
    
    # Check China
    china = [item for item in states_list if item[2] == 'China']
    print(f'China provinces: {len(china)}')
    
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
    
    print(f'Total entries after merge: {len(states_list)}')
    
    # Check US states again
    us_states = [item for item in states_list if item[2] == 'US']
    print(f'US states after merge: {len(us_states)}')
    
    # Check China again
    china = [item for item in states_list if item[2] == 'China']
    print(f'China provinces after merge: {len(china)}')
    
    # Convert to JSON
    json_data = json.dumps(states_list, ensure_ascii=False)
    
    # Write to states_data.js
    with open('src/states_data.js', 'w', encoding='utf-8') as f:
        f.write('const statesData = ')
        f.write(json_data)
        f.write(';\n')
    
    print('Data file created with merged data')
    
    # Show sample GDP values
    print()
    print('Sample GDP values:')
    us_sorted = sorted(us_states, key=lambda x: x[1], reverse=True)
    for name, gdp, country in us_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')
    
    china_sorted = sorted(china, key=lambda x: x[1], reverse=True)
    for name, gdp, country in china_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')