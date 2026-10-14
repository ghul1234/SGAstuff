import re

# Read the Wikipedia content
with open('C:\\Users\\hamza\\AppData\\Local\\Temp\\devin.exe-overloads\\f7b96bcc\\content.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the table data - look for patterns like "[Country]... [X divisions]"
# The format is messy due to the wiki markup, so we need to extract country names and division counts

# Find patterns that match countries and their first-level divisions
country_divisions = {}

# Look for patterns like "[Country name]... [X provinces/states/regions/divisions/etc]"
# This is complex due to the wiki markup formatting, so let's try a simpler approach

# Extract country names from the links like "[Afghanistan][111]"
country_pattern = r'\[([A-Za-z\s\.]+)\]\[\d+\]'
countries = re.findall(country_pattern, content)

print('Found ' + str(len(countries)) + ' country names in Wikipedia table')

# Now let's try to extract division counts
# Look for patterns like "[X provinces]", "[X states]", etc.
division_pattern = r'\[(\d+)\s+(provinces|states|regions|divisions|counties|departments|districts|municipalities|governorates|cantons|prefectures|communes|oblasts|parishes|islands|atolls|divisions)\]'
divisions = re.findall(division_pattern, content)

print('Found ' + str(len(divisions)) + ' division counts')

# This approach is too complex due to the wiki markup
# Let me try a different approach - parse the actual table structure