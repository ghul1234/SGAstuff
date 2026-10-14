with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove non-ASCII characters from state names
import re
def fix_special_chars(match):
    name = match.group(1)
    # Keep only ASCII characters
    cleaned = ''.join(char for char in name if ord(char) < 128)
    return f'["{cleaned}"'

new_content = re.sub(r'\["([^"]+)"', fix_special_chars, content)

with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Non-ASCII characters removed from data file')