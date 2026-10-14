with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array
import re
states_match = re.search(r'const states = \[(.*?)\];', content, re.DOTALL)
if states_match:
    states_data = states_match.group(1)
    # Check for any characters that might break JavaScript
    problematic_chars = set()
    for char in states_data:
        if ord(char) > 127 and char not in "àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ":
            problematic_chars.add(char)
    
    if problematic_chars:
        print(f'Found problematic characters: {problematic_chars}')
    else:
        print('No problematic Unicode characters found')
    
    # Check for specific syntax issues
    if "'" in states_data and "\\'" not in states_data:
        print('Found unescaped single quotes')
    else:
        print('Single quotes are properly escaped')