import json

# Load current data
with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

current_data = json.loads(json_str)

# Count divisions per country
country_counts = {}
for item in current_data:
    country = item[2]
    if country in country_counts:
        country_counts[country] += 1
    else:
        country_counts[country] = 1

# Sort by count
sorted_countries = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)

print('Current country division counts:')
for country, count in sorted_countries[:30]:
    print('  ' + country + ': ' + str(count))

print()
print('Countries with very few divisions (potential gaps):')
few_divisions = [(c, n) for c, n in sorted_countries if n < 10]
for country, count in few_divisions:
    print('  ' + country + ': ' + str(count))

print()
print('Countries with many divisions (potential overcounts or large countries):')
many_divisions = [(c, n) for c, n in sorted_countries if n > 50]
for country, count in many_divisions:
    print('  ' + country + ': ' + str(count))

print()
print('Total divisions: ' + str(len(current_data)))
print('Total countries: ' + str(len(country_counts)))
print('Gap to 4,200: ' + str(4200 - len(current_data)))