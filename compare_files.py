import re

for filename in ['sga_50_states_full_view.html', 'sga_50_states_full_view_backup.html', 'sga_50_states_full_view_updated.html']:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
    if states_match:
        states_data = states_match.group(1)
        count = states_data.count('[')
        print(f'{filename}: {count} entries')
        
        # Check for US states
        us_count = states_data.count('US')
        print(f'  US states: {us_count}')
        
        # Check for China
        china_count = states_data.count('China')
        print(f'  China provinces: {china_count}')
        
        # Check California GDP
        ca_match = re.search(r'\["California",(\d+),"US"\]', states_data)
        if ca_match:
            print(f'  California GDP: {ca_match.group(1)}')
        
        print()