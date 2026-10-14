import re

with open('sga_50_states_full_view.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the states array and remove/replace problematic characters
def clean_array(match):
    array_content = match.group(1)
    
    # Replace problematic characters with ASCII equivalents
    replacements = {
        'ñ': 'n', 'Ñ': 'N',
        'é': 'e', 'É': 'E', 'è': 'e', 'È': 'E',
        'í': 'i', 'Í': 'I', 'ì': 'i', 'Ì': 'I',
        'ó': 'o', 'Ó': 'O', 'ò': 'o', 'Ò': 'O',
        'ú': 'u', 'Ú': 'U', 'ù': 'u', 'Ù': 'U',
        'á': 'a', 'Á': 'A', 'à': 'a', 'À': 'A',
        'â': 'a', 'Â': 'A', 'ê': 'e', 'Ê': 'E',
        'î': 'i', 'Î': 'I', 'ô': 'o', 'Ô': 'O',
        'û': 'u', 'Û': 'U', 'ä': 'a', 'Ä': 'A',
        'ë': 'e', 'Ë': 'E', 'ï': 'i', 'Ï': 'I',
        'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U',
        'ã': 'a', 'Ã': 'A', 'õ': 'o', 'Õ': 'O',
        'ç': 'c', 'Ç': 'C',
        'š': 's', 'Š': 'S', 'ž': 'z', 'Ž': 'Z',
        'ń': 'n', 'Ń': 'N',
        'ł': 'l', 'Ł': 'L',
        'đ': 'd', 'Đ': 'D',
        'ț': 't', 'Ț': 'T',
        'ș': 's', 'Ș': 'S',
        'ă': 'a', 'Ă': 'A',
        'ț': 't', 'Ț': 'T',
    }
    
    for old, new in replacements.items():
        array_content = array_content.replace(old, new)
    
    return f'const states = [{array_content}];'

pattern = r'const states = \[(.*?)\];'
new_content = re.sub(pattern, clean_array, content, flags=re.DOTALL)

with open('sga_50_states_full_view.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Special characters replaced successfully')