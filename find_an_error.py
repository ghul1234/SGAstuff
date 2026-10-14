with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array
import re
states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Look for the specific pattern that might cause "an" error
    # This could be something like "an" appearing in a context where it shouldn't
    lines = states_data.split('\n')
    for i, line in enumerate(lines):
        if 'an' in line.lower() and not line.strip().startswith('//'):
            print(f'Line {i+1}: {line[:100]}')