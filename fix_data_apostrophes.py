with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove apostrophes from state names in the data
import re
def fix_apostrophes(match):
    name = match.group(1)
    # Remove apostrophes
    name = name.replace("'", "")
    return f'["{name}"'

new_content = re.sub(r'\["([^"]+)"', fix_apostrophes, content)

with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Apostrophes removed from data file')