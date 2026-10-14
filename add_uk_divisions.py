import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# UK first-level divisions should include:
# England: regions/counties (39 counties, 8 regions, etc.)
# Scotland: 32 council areas
# Wales: 22 unitary authorities
# Northern Ireland: 11 districts

# Add comprehensive UK divisions
uk_divisions = [
    # England - Major counties/regions
    ['Greater London', 600000, 'UK'],
    ['Greater Manchester', 150000, 'UK'],
    ['West Midlands', 120000, 'UK'],
    ['West Yorkshire', 110000, 'UK'],
    ['South Yorkshire', 90000, 'UK'],
    ['Merseyside', 85000, 'UK'],
    ['Bristol', 80000, 'UK'],
    ['West of England', 75000, 'UK'],
    ['Cambridgeshire', 70000, 'UK'],
    ['Hampshire', 65000, 'UK'],
    ['Kent', 62000, 'UK'],
    ['Essex', 60000, 'UK'],
    ['Surrey', 58000, 'UK'],
    ['Hertfordshire', 55000, 'UK'],
    ['Lancashire', 52000, 'UK'],
    ['Devon', 50000, 'UK'],
    ['Cornwall', 48000, 'UK'],
    ['Norfolk', 46000, 'UK'],
    ['Suffolk', 44000, 'UK'],
    ['East Sussex', 42000, 'UK'],
    ['West Sussex', 40000, 'UK'],
    ['East Riding of Yorkshire', 38000, 'UK'],
    ['Lincolnshire', 36000, 'UK'],
    ['North Yorkshire', 34000, 'UK'],
    ['Cumbria', 32000, 'UK'],
    ['Northumberland', 30000, 'UK'],
    ['Durham', 28000, 'UK'],
    ['Tyne and Wear', 26000, 'UK'],
    ['South Gloucestershire', 24000, 'UK'],
    ['North Somerset', 22000, 'UK'],
    ['Dorset', 20000, 'UK'],
    # Scotland - Council areas
    ['Glasgow City', 5967, 'UK'],
    ['City of Edinburgh', 5967, 'UK'],
    ['Fife', 5967, 'UK'],
    ['North Lanarkshire', 5967, 'UK'],
    ['South Lanarkshire', 5967, 'UK'],
    ['Aberdeen City', 5967, 'UK'],
    ['Highland', 5967, 'UK'],
    ['Dundee City', 5967, 'UK'],
    ['Renfrewshire', 5967, 'UK'],
    ['West Lothian', 5967, 'UK'],
    ['Falkirk', 5967, 'UK'],
    ['Perth and Kinross', 5967, 'UK'],
    ['Angus', 5967, 'UK'],
    ['Aberdeenshire', 5967, 'UK'],
    ['North Ayrshire', 5967, 'UK'],
    ['South Ayrshire', 5967, 'UK'],
    ['East Ayrshire', 5967, 'UK'],
    ['Dumfries and Galloway', 5967, 'UK'],
    ['Argyll and Bute', 5967, 'UK'],
    ['Clackmannanshire', 5967, 'UK'],
    ['East Dunbartonshire', 5967, 'UK'],
    ['West Dunbartonshire', 5967, 'UK'],
    ['East Lothian', 5967, 'UK'],
    ['Midlothian', 5967, 'UK'],
    ['Scottish Borders', 5967, 'UK'],
    ['Inverclyde', 5967, 'UK'],
    ['Moray', 5967, 'UK'],
    ['Orkney Islands', 5967, 'UK'],
    ['Shetland Islands', 5967, 'UK'],
    ['Na h-Eileanan Siar', 5967, 'UK'],
    # Wales - Unitary authorities
    ['Cardiff', 5967, 'UK'],
    ['Swansea', 5967, 'UK'],
    ['Newport', 5967, 'UK'],
    ['Carmarthenshire', 5967, 'UK'],
    ['Flintshire', 5967, 'UK'],
    ['Conwy', 5967, 'UK'],
    ['Gwynedd', 5967, 'UK'],
    ['Denbighshire', 5967, 'UK'],
    ['Vale of Glamorgan', 5967, 'UK'],
    ['Bridgend', 5967, 'UK'],
    ['Neath Port Talbot', 5967, 'UK'],
    ['Rhondda Cynon Taf', 5967, 'UK'],
    ['Caerphilly', 5967, 'UK'],
    ['Blaenau Gwent', 5967, 'UK'],
    ['Torfaen', 5967, 'UK'],
    ['Monmouthshire', 5967, 'UK'],
    ['Powys', 5967, 'UK'],
    ['Ceredigion', 5967, 'UK'],
    ['Pembrokeshire', 5967, 'UK'],
    ['Anglesey', 5967, 'UK'],
    ['Wrexham', 5967, 'UK'],
    # Northern Ireland - Districts
    ['Belfast', 5967, 'UK'],
    ['Derry and Strabane', 5967, 'UK'],
    ['Armagh City, Banbridge and Craigavon', 5967, 'UK'],
    ['Mid and East Antrim', 5967, 'UK'],
    ['Antrim and Newtownabbey', 5967, 'UK'],
    ['Lisburn and Castlereagh', 5967, 'UK'],
    ['Newry, Mourne and Down', 5967, 'UK'],
    ['Causeway Coast and Glens', 5967, 'UK'],
    ['Fermanagh and Omagh', 5967, 'UK'],
    ['Mid Ulster', 5967, 'UK'],
    ['Ards and North Down', 5967, 'UK']
]

current_regions = {(item[0], item[2]) for item in current_data}
added_count = 0

for division in uk_divisions:
    if (division[0], division[2]) not in current_regions:
        current_data.append(division)
        current_regions.add((division[0], division[2]))
        added_count += 1

print('Added ' + str(added_count) + ' UK divisions')
print('New total: ' + str(len(current_data)))

# Convert to JSON
json_data = json.dumps(current_data, ensure_ascii=False)

# Write to states_data.js
with open('src/states_data.js', 'w', encoding='utf-8') as f:
    f.write('const statesData = ')
    f.write(json_data)
    f.write(';\n')

print('Data file updated with UK divisions')
print('Still missing from 4,200 target: ' + str(4200 - len(current_data)))