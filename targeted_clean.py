import re

with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array and clean only problematic characters
def clean_array(match):
    array_content = match.group(1)
    
    # Replace only characters that are known to cause JavaScript syntax errors
    # Keep most Unicode characters, but fix specific problematic ones
    replacements = {
        "'": "",  # Remove apostrophes
        "'": "",  # Remove right single quotes  
        "'": "",  # Remove other quote variants
        "`": "",  # Remove backticks
    }
    
    for old, new in replacements.items():
        array_content = array_content.replace(old, new)
    
    return f'const states = [{array_content}];'

pattern = r'const states = \[(.*?)\];'
new_content = re.sub(pattern, clean_array, content, flags=re.DOTALL)

with open('sga_50_states_full_view.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Targeted character cleaning completed')