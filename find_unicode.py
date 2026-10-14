with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find lines with non-ASCII characters in the states array
import re
lines = content.split('\n')
unicode_lines = []
for i, line in enumerate(lines):
    if '[' in line and ']' in line and '"' in line:
        # Check for non-ASCII characters
        if any(ord(char) > 127 for char in line) and not line.strip().startswith('//'):
            unicode_lines.append((i+1, line[:80]))

print('Lines with non-ASCII characters:')
for line_num, line_content in unicode_lines[:20]:
    print(f'{line_num}: {line_content}')