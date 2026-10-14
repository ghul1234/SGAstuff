import re

# Extract data from the updated HTML file using a more robust parsing method
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
    
    print(f'Extracted {len(states_list)} entries from updated HTML')
    
    # Check US states
    us_states = [item for item in states_list if item[2] == 'US']
    print(f'US states: {len(us_states)}')
    
    # Check China
    china = [item for item in states_list if item[2] == 'China']
    print(f'China provinces: {len(china)}')
    
    # Show sample GDP values
    print()
    print('Sample GDP values from updated HTML:')
    us_sorted = sorted(us_states, key=lambda x: x[1], reverse=True)
    for name, gdp, country in us_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')
    
    china_sorted = sorted(china, key=lambda x: x[1], reverse=True)
    for name, gdp, country in china_sorted[:5]:
        print('  ' + name + ': $' + str(gdp) + 'M')
    
    # Save this data to a file
    import json
    json_data = json.dumps(states_list, ensure_ascii=False)
    
    with open('src/states_data.js', 'w', encoding='utf-8') as f:
        f.write('const statesData = ')
        f.write(json_data)
        f.write(';\n')
    
    print('Data file created from updated HTML with correct GDP values')