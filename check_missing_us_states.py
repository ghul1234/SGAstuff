import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Expected US states
expected_us_states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
]

# Check which US states are present
us_states = [item for item in current_data if item[2] == 'US']
present_us_states = {item[0] for item in us_states}

missing_us_states = set(expected_us_states) - present_us_states
print('Missing US states: ' + str(len(missing_us_states)))
for state in missing_us_states:
    print('  ' + state)

# Check if they exist under USA
usa_states = [item for item in current_data if item[2] == 'USA']
present_usa_states = {item[0] for item in usa_states}

missing_from_usa = set(expected_us_states) - present_usa_states
print()
print('Missing from USA entries: ' + str(len(missing_from_usa)))
for state in missing_from_usa:
    print('  ' + state)