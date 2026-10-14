with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find lines with problematic characters
import re
lines = content.split('\n')
problematic_lines = []
for i, line in enumerate(lines):
    if '[' in line and ']' in line and '"' in line:
        # Check for unescaped quotes or problematic characters
        if "'" in line and not line.strip().startswith('//'):
            problematic_lines.append((i+1, line[:80]))

print('Problematic lines with quotes:')
for line_num, line_content in problematic_lines[:10]:
    print(f'{line_num}: {line_content}')