import re

with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array and escape single quotes in the strings
def escape_quotes_in_array(match):
    array_content = match.group(1)
    # Escape single quotes within double-quoted strings
    array_content = re.sub(r'\["([^"]*)\'([^"]*)"', r'["\1\\\'\2"', array_content)
    return f'const states = [{array_content}];'

pattern = r'const states = \[(.*?)\];'
new_content = re.sub(pattern, escape_quotes_in_array, content, flags=re.DOTALL)

with open('sga_50_states_full_view.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Quotes escaped successfully')