with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Check for any non-ASCII characters
lines = content.split('\n')
special_char_lines = []
for i, line in enumerate(lines):
    if "[" in line and "]" in line and '"' in line:
        # Check for non-ASCII characters
        if any(ord(char) > 127 for char in line) and not line.strip().startswith('//'):
            special_char_lines.append((i+1, line[:80]))

print(f'Found {len(special_char_lines)} lines with non-ASCII characters:')
for line_num, line_content in special_char_lines[:10]:
    print(f'{line_num}: {line_content}')