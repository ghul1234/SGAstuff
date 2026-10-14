import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

print('Current total: ' + str(len(current_data)))
print('Gap to 4,200 target: ' + str(4200 - len(current_data)))
print('Gap to 4,300 target: ' + str(4300 - len(current_data)))

# Count countries
countries = set(item[2] for item in current_data)
print('Total countries: ' + str(len(countries)))

# Check countries with very few divisions (likely incomplete)
country_counts = {}
for item in current_data:
    country = item[2]
    if country in country_counts:
        country_counts[country] += 1
    else:
        country_counts[country] = 1

print()
print('Countries with very few divisions (likely incomplete):')
incomplete_countries = {k: v for k, v in sorted(country_counts.items()) if v < 5}
for country, count in incomplete_countries.items():
    print('  ' + country + ': ' + str(count))