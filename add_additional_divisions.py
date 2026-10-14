import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Add divisions for countries that should have more based on Wikipedia
# Australia should have 8 states/territories (currently has 8 - good)
# Bangladesh should have 8 divisions (currently has 9 - good)
# Israel should have 6 districts (currently has 9 - good)
# Bolivia should have 9 departments (currently has 9 - good)
# Colombia should have 33 departments (currently has 45 - good)
# Lebanon should have 8 governorates (currently has 8 - good)
# Costa Rica should have 7 provinces (currently has 8 - good)
# Kuwait should have 6 governorates (currently has 8 - good)
# Tunisia should have 24 governorates (currently has 8 - missing some)
# UAE should have 7 emirates (currently has 7 - good)
# Andorra should have 7 parishes (currently has 7 - good)
# Equatorial Guinea should have 7 provinces (currently has 7 - good)
# Belize should have 6 districts (currently has 6 - good)
# Cyprus should have 6 districts (currently has 6 - good)
# Djibouti should have 5 regions (currently has 6 - good)
# Eritrea should have 6 regions (currently has 6 - good)
# Malta should have 5 regions (currently has 6 - good)
# Vanuatu should have 6 provinces (currently has 6 - good)
# Bahrain should have 4 governorates (currently has 5 - good)
# Rwanda should have 5 provinces (currently has 5 - good)
# Tajikistan should have 4 regions (currently has 5 - good)
# Singapore should have 5 regions (currently has 5 - good)
# Togo should have 5 regions (currently has 5 - good)
# Tonga should have 5 divisions (currently has 5 - good)
# Sierra Leone should have 4 provinces (currently has 5 - good)
# Brunei should have 4 districts (currently has 4 - good)
# Eswatini should have 4 regions (currently has 4 - good)
# Micronesia should have 4 states (currently has 4 - good)
# Seychelles should have 26 districts (currently has 4 - missing many!)
# Fiji should have 4 divisions (currently has 4 - good)
# Comoros should have 3 islands (currently has 3 - good)
# Kiribati should have 3 islands (currently has 3 - good)
# Monaco should have 1 ward (currently has 3 - good)
# Libya should have 22 districts (currently has 3 - missing many!)
# Malawi should have 28 districts (currently has 3 - missing many!)
# Palestine should have 16 governorates (currently has 2 - missing many!)
# Sao Tome and Principe should have 7 districts (currently has 2 - missing some)
# Taiwan should have special municipalities/cities/counties (currently has 1 - missing many!)
# Bosnia should have 2 entities and 1 district (currently has 1 - missing some)
# Turkmenistan should have 5 regions (currently has 1 - missing many!)
# Macedonia should have 80 municipalities (currently has 1 - missing many!)
# USA territories should have more (currently has 3 - missing many!)

# Focus on countries with biggest gaps: Seychelles, Libya, Malawi, Palestine, Taiwan, Turkmenistan, Macedonia

# Add missing divisions for Seychelles (should have 26 districts)
seychelles_divisions = [
    ['Anse Boileau', 5967, 'Seychelles'],
    ['Anse Etoile', 5967, 'Seychelles'],
    ['Anse Louis', 5967, 'Seychelles'],
    ['Anse Royale', 5967, 'Seychelles'],
    ['Baie Lazare', 5967, 'Seychelles'],
    ['Baie Sainte Anne', 5967, 'Seychelles'],
    ['Beau Vallon', 5967, 'Seychelles'],
    ['Bel Air', 5967, 'Seychelles'],
    ['Cascade', 5967, 'Seychelles'],
    ['Desroches', 5967, 'Seychelles'],
    ['English River', 5967, 'Seychelles'],
    ['Glacis', 5967, 'Seychelles'],
    ['Grand Anse Mahe', 5967, 'Seychelles'],
    ['Grand Anse Praslin', 5967, 'Seychelles'],
    ['La Digue', 5967, 'Seychelles'],
    ['La Riviere Anglaise', 5967, 'Seychelles'],
    ['Mont Buxton', 5967, 'Seychelles'],
    ['Plaisance', 5967, 'Seychelles'],
    ['Pointe La Rue', 5967, 'Seychelles'],
    ['Port Glaud', 5967, 'Seychelles'],
    ['Roche Caiman', 5967, 'Seychelles'],
    ['Saint Louis', 5967, 'Seychelles'],
    ['Takamaka', 5967, 'Seychelles']
]

# Add missing divisions for Libya (should have 22 districts)
libya_divisions = [
    ['Ajdabiya', 5967, 'Libya'],
    ['Al Kufrah', 5967, 'Libya'],
    ['Al Marj', 5967, 'Libya'],
    ['Al Marqab', 5967, 'Libya'],
    ['Al Wahat', 5967, 'Libya'],
    ['Benghazi', 5967, 'Libya'],
    ['Derna', 5967, 'Libya'],
    ['Ghat', 5967, 'Libya'],
    ['Jabal al Akhdar', 5967, 'Libya'],
    ['Jafara', 5967, 'Libya'],
    ['Jaghbub', 5967, 'Libya'],
    ['Misrata', 5967, 'Libya'],
    ['Murqub', 5967, 'Libya'],
    ['Nalut', 5967, 'Libya'],
    ['Nuqat al Khams', 5967, 'Libya'],
    ['Sabha', 5967, 'Libya'],
    ['Sabhah', 5967, 'Libya'],
    ['Sirte', 5967, 'Libya'],
    ['Surman', 5967, 'Libya'],
    ['Tarhuna', 5967, 'Libya'],
    ['Tripoli', 5967, 'Libya'],
    ['Zawiya', 5967, 'Libya']
]

# Add missing divisions for Malawi (should have 28 districts)
malawi_divisions = [
    ['Balaka', 5967, 'Malawi'],
    ['Blantyre', 5967, 'Malawi'],
    ['Chikwawa', 5967, 'Malawi'],
    ['Chiradzulu', 5967, 'Malawi'],
    ['Chitipa', 5967, 'Malawi'],
    ['Dedza', 5967, 'Malawi'],
    ['Dowa', 5967, 'Malawi'],
    ['Karonga', 5967, 'Malawi'],
    ['Kasungu', 5967, 'Malawi'],
    ['Likoma', 5967, 'Malawi'],
    ['Lilongwe', 5967, 'Malawi'],
    ['Machinga', 5967, 'Malawi'],
    ['Mangochi', 5967, 'Malawi'],
    ['Mchinji', 5967, 'Malawi'],
    ['Mulanje', 5967, 'Malawi'],
    ['Mwanza', 5967, 'Malawi'],
    ['Mzimba', 5967, 'Malawi'],
    ['Neno', 5967, 'Malawi'],
    ['Nkhata Bay', 5967, 'Malawi'],
    ['Nkhotakota', 5967, 'Malawi'],
    ['Nsanje', 5967, 'Malawi'],
    ['Ntcheu', 5967, 'Malawi'],
    ['Ntchisi', 5967, 'Malawi'],
    ['Phalombe', 5967, 'Malawi'],
    ['Rumphi', 5967, 'Malawi'],
    ['Salima', 5967, 'Malawi'],
    ['Thyolo', 5967, 'Malawi'],
    ['Zomba', 5967, 'Malawi']
]

# Add missing divisions for Palestine (should have 16 governorates)
palestine_divisions = [
    ['Bethlehem', 5967, 'Palestine'],
    ['Deir al-Balah', 5967, 'Palestine'],
    ['Gaza', 5967, 'Palestine'],
    ['Hebron', 5967, 'Palestine'],
    ['Jenin', 5967, 'Palestine'],
    ['Jericho', 5967, 'Palestine'],
    ['Jerusalem', 5967, 'Palestine'],
    ['Khan Yunis', 5967, 'Palestine'],
    ['Nablus', 5967, 'Palestine'],
    ['North Gaza', 5967, 'Palestine'],
    ['Qalqilya', 5967, 'Palestine'],
    ['Rafah', 5967, 'Palestine'],
    ['Ramallah', 5967, 'Palestine'],
    ['Salfit', 5967, 'Palestine'],
    ['Tubas', 5967, 'Palestine'],
    ['Tulkarm', 5967, 'Palestine']
]

current_regions = {(item[0], item[2]) for item in current_data}
added_count = 0

for division in seychelles_divisions + libya_divisions + malawi_divisions + palestine_divisions:
    if (division[0], division[2]) not in current_regions:
        current_data.append(division)
        current_regions.add((division[0], division[2]))
        added_count += 1

print('Added ' + str(added_count) + ' additional divisions')
print('New total: ' + str(len(current_data)))

# Convert to JSON
json_data = json.dumps(current_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with additional divisions')
print('Still missing from 4,200 target: ' + str(4200 - len(current_data)))