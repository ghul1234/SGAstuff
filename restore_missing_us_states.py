import json
import re

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Extract missing US states from original HTML
with open('sga_50_states_full_view_updated.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

states_match = re.search(r'const states = \[(.*?)\];', html_content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Split by array pattern
    array_entries = re.findall(r'\["([^"]+)",(\d+),"([^"]+)"\]', states_data)
    
    # Get US states
    us_states_from_html = []
    for name, gdp, country in array_entries:
        if country == 'US':
            us_states_from_html.append([name, int(gdp), country])
    
    print('Found ' + str(len(us_states_from_html)) + ' US states in original HTML')
    
    # Add missing US states
    current_names = {(item[0], item[2]) for item in current_data}
    added_count = 0
    
    for state in us_states_from_html:
        if (state[0], state[2]) not in current_names:
            current_data.append(state)
            current_names.add((state[0], state[2]))
            added_count += 1
    
    print('Added ' + str(added_count) + ' missing US states')
    print('New total: ' + str(len(current_data)))
    
    # Check US states
    us_states = [item for item in current_data if item[2] == 'US']
    print('US states: ' + str(len(us_states)))
    
    # Convert to JSON
    json_data = json.dumps(current_data, ensure_ascii=False)
    
    # Write to states_data.js
    with open('src/states_data.js', 'w', encoding='utf-8') as f:
        f.write('const statesData = ')
        f.write(json_data)
        f.write(';\n')
    
    print('Data file updated with missing US states')
    print('Still missing from 4,200 target: ' + str(4200 - len(current_data)))