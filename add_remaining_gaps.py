import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Add remaining divisions for Taiwan, Turkmenistan, Macedonia, and USA territories
# Taiwan divisions
taiwan_divisions = [
    ['Taipei', 5967, 'Taiwan'],
    ['New Taipei', 5967, 'Taiwan'],
    ['Taoyuan', 5967, 'Taiwan'],
    ['Taichung', 5967, 'Taiwan'],
    ['Tainan', 5967, 'Taiwan'],
    ['Kaohsiung', 5967, 'Taiwan'],
    ['Keelung', 5967, 'Taiwan'],
    ['Hsinchu', 5967, 'Taiwan'],
    ['Chiayi', 5967, 'Taiwan'],
    ['Yilan', 5967, 'Taiwan'],
    ['Miaoli', 5967, 'Taiwan'],
    ['Changhua', 5967, 'Taiwan'],
    ['Nantou', 5967, 'Taiwan'],
    ['Yunlin', 5967, 'Taiwan'],
    ['Chiayi County', 5967, 'Taiwan'],
    ['Pingtung', 5967, 'Taiwan'],
    ['Taitung', 5967, 'Taiwan'],
    ['Hualien', 5967, 'Taiwan'],
    ['Penghu', 5967, 'Taiwan'],
    ['Kinmen', 5967, 'Taiwan'],
    ['Lienchiang', 5967, 'Taiwan']
]

# Turkmenistan divisions
turkmenistan_divisions = [
    ['Ahal', 5967, 'Turkmenistan'],
    ['Ashgabat', 5967, 'Turkmenistan'],
    ['Balkan', 5967, 'Turkmenistan'],
    ['Dashoguz', 5967, 'Turkmenistan'],
    ['Lebap', 5967, 'Turkmenistan'],
    ['Mary', 5967, 'Turkmenistan']
]

# North Macedonia divisions
macedonia_divisions = [
    ['Skopje', 5967, 'North Macedonia'],
    ['Bitola', 5967, 'North Macedonia'],
    ['Kumanovo', 5967, 'North Macedonia'],
    ['Prilep', 5967, 'North Macedonia'],
    ['Tetovo', 5967, 'North Macedonia'],
    ['Veles', 5967, 'North Macedonia'],
    ['Ohrid', 5967, 'North Macedonia'],
    ['Gostivar', 5967, 'North Macedonia'],
    ['Strumica', 5967, 'North Macedonia'],
    ['Kavadarci', 5967, 'North Macedonia']
]

# USA territories divisions
usa_territories_divisions = [
    ['Puerto Rico', 5967, 'US Territory'],
    ['Guam', 5967, 'US Territory'],
    ['US Virgin Islands', 5967, 'US Territory'],
    ['American Samoa', 5967, 'US Territory'],
    ['Northern Mariana Islands', 5967, 'US Territory'],
    ['District of Columbia', 5967, 'US Territory']
]

# Add some more Tunisia divisions (should have 24, currently has 8)
tunisia_divisions = [
    ['Ariana', 5967, 'Tunisia'],
    ['Ben Arous', 5967, 'Tunisia'],
    ['Bizerte', 5967, 'Tunisia'],
    ['Gabes', 5967, 'Tunisia'],
    ['Gafsa', 5967, 'Tunisia'],
    ['Jendouba', 5967, 'Tunisia'],
    ['Kairouan', 5967, 'Tunisia'],
    ['Kasserine', 5967, 'Tunisia'],
    ['Kebili', 5967, 'Tunisia'],
    ['Le Kef', 5967, 'Tunisia'],
    ['Mahdia', 5967, 'Tunisia'],
    ['Manouba', 5967, 'Tunisia'],
    ['Medenine', 5967, 'Tunisia'],
    ['Monastir', 5967, 'Tunisia'],
    ['Nabeul', 5967, 'Tunisia'],
    ['Sfax', 5967, 'Tunisia'],
    ['Sidi Bouzid', 5967, 'Tunisia'],
    ['Siliana', 5967, 'Tunisia'],
    ['Sousse', 5967, 'Tunisia'],
    ['Tozeur', 5967, 'Tunisia'],
    ['Zaghouan', 5967, 'Tunisia']
]

# Add more Sao Tome and Principe divisions (should have 7, currently has 2)
saotome_divisions = [
    ['Lobata', 5967, 'Sao Tome and Principe'],
    ['Lemba', 5967, 'Sao Tome and Principe'],
    ['Me-Zochi', 5967, 'Sao Tome and Principe'],
    ['Cantagalo', 5967, 'Sao Tome and Principe'],
    ['Caué', 5967, 'Sao Tome and Principe']
]

current_regions = {(item[0], item[2]) for item in current_data}
added_count = 0

for division in taiwan_divisions + turkmenistan_divisions + macedonia_divisions + usa_territories_divisions + tunisia_divisions + saotome_divisions:
    if (division[0], division[2]) not in current_regions:
        current_data.append(division)
        current_regions.add((division[0], division[2]))
        added_count += 1

print('Added ' + str(added_count) + ' remaining divisions')
print('New total: ' + str(len(current_data)))

# Convert to JSON
json_data = json.dumps(current_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with remaining divisions')
print('Gap to 4,200 target: ' + str(4200 - len(current_data)))
print('Gap to 4,300 target: ' + str(4300 - len(current_data)))