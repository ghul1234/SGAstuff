import re

with open('sga_50_states_full_view_updated.html', 'r', encoding='utf-8') as f:
    content = f.read()

states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    
    # Split by array pattern
    array_entries = re.findall(r'\["([^"]+)",(\d+),"([^"]+)"\]', states_data)
    
    # Check for duplicates in the HTML file itself
    name_counts = {}
    for name, gdp, country in array_entries:
        if name in name_counts:
            name_counts[name] += 1
        else:
            name_counts[name] = 1
    
    duplicates = {name: count for name, count in name_counts.items() if count > 1}
    print('Duplicates in updated HTML: ' + str(len(duplicates)))
    if duplicates:
        for name, count in list(duplicates.items())[:10]:
            print('  ' + name + ': ' + str(count) + ' times')
    
    # Show all US entries
    us_entries = [(name, gdp, country) for name, gdp, country in array_entries if country == 'US']
    print('US entries in HTML: ' + str(len(us_entries)))
    for name, gdp, country in us_entries[:5]:
        print('  ' + name + ', ' + country + ': ' + str(gdp))
    
    usa_entries = [(name, gdp, country) for name, gdp, country in array_entries if country == 'USA']
    print('USA entries in HTML: ' + str(len(usa_entries)))
    for name, gdp, country in usa_entries[:5]:
        print('  ' + name + ', ' + country + ': ' + str(gdp))