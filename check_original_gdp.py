with open('sga_50_states_full_view_updated.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Find California
    if 'California' in states_data:
        ca_match = re.search(r'\["California",(\d+),"US"\]', states_data)
        if ca_match:
            print(f'California GDP in updated HTML: {ca_match.group(1)}')
    
    # Find Texas
    if 'Texas' in states_data:
        tx_match = re.search(r'\["Texas",(\d+),"US"\]', states_data)
        if tx_match:
            print(f'Texas GDP in updated HTML: {tx_match.group(1)}')
    
    # Find Guangdong (China)
    if 'Guangdong' in states_data:
        gd_match = re.search(r'\["Guangdong",(\d+),"China"\]', states_data)
        if gd_match:
            print(f'Guangdong GDP in updated HTML: {gd_match.group(1)}')