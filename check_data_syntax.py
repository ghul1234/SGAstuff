with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Check for problematic characters
lines = content.split('\n')
problematic_lines = []
for i, line in enumerate(lines):
    if "[" in line and "]" in line and '"' in line:
        # Check for unescaped quotes or problematic characters
        if "'" in line and not line.strip().startswith('//'):
            problematic_lines.append((i+1, line[:80]))

print(f'Found {len(problematic_lines)} lines with apostrophes:')
for line_num, line_content in problematic_lines[:10]:
    print(f'{line_num}: {line_content}')