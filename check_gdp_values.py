with open('src/states_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

import json
json_start = content.find('[')
json_end = content.rfind(']') + 1
json_str = content[json_start:json_end]

data = json.loads(json_str)

# Check US states
us_states = [item for item in data if item[2] == 'US']
print('US States (top 10 by GDP):')
us_states_sorted = sorted(us_states, key=lambda x: x[1], reverse=True)
for name, gdp, country in us_states_sorted[:10]:
    gdp_value = gdp * 1e6
    print(f'  {name}: ${gdp:,}M GDP = ${gdp_value:,.0f}')

print()
print('China Provinces (top 10 by GDP):')
china = [item for item in data if item[2] == 'China']
china_sorted = sorted(china, key=lambda x: x[1], reverse=True)
for name, gdp, country in china_sorted[:10]:
    gdp_value = gdp * 1e6
    print(f'  {name}: ${gdp:,}M GDP = ${gdp_value:,.0f}')

print()
print('Other major economies (Germany, Japan, UK, France, India, Brazil):')
for country in ['Germany', 'Japan', 'United Kingdom', 'France', 'India', 'Brazil']:
    country_data = [item for item in data if item[2] == country]
    if country_data:
        sorted_country = sorted(country_data, key=lambda x: x[1], reverse=True)
        print(f'  {country} (top 3):')
        for name, gdp, c in sorted_country[:3]:
            gdp_value = gdp * 1e6
            print(f'    {name}: ${gdp:,}M GDP = ${gdp_value:,.0f}')