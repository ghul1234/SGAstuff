import re

with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array and clean it completely
def clean_array(match):
    array_content = match.group(1)
    
    # Remove all non-ASCII characters from state names, keeping only ASCII letters, numbers, spaces, and hyphens
    def clean_name(match):
        name = match.group(1)
        # Keep only ASCII characters
        cleaned = ''.join(char for char in name if ord(char) < 128)
        return f'["{cleaned}"'
    
    # Clean state names within brackets
    array_content = re.sub(r'\["([^"]+)"', clean_name, array_content)
    
    return f'const states = [{array_content}];'

pattern = r'const states = \[(.*?)\];'
new_content = re.sub(pattern, clean_array, content, flags=re.DOTALL)

with open('sga_50_states_full_view.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('All non-ASCII characters removed successfully')