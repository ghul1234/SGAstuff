import os
import re

style_css_path = r"d:\SGAs\sga-website\src\style.css"
apple_html_path = r"d:\SGAs\sga-website\apple_stock_page.html"

# Read original style.css up to marker
with open(style_css_path, "r", encoding="utf-8") as f:
    style_css = f.read()

marker = "/* MARKETS TAB STYLES FROM APPLE STOCK PAGE */"
if marker in style_css:
    style_css = style_css.split(marker)[0].strip()

# Read apple_stock_page.html CSS
with open(apple_html_path, "r", encoding="utf-8") as f:
    apple_content = f.read()

css_match = re.search(r'<style>(.*?)</style>', apple_content, re.DOTALL)
apple_css = css_match.group(1) if css_match else ""

# Remove body and * rules that pollute global scope
apple_css = re.sub(r'\*\s*\{\s*margin:\s*0;[^\}]*\}', '', apple_css)
apple_css = re.sub(r'body\s*\{[^\}]*\}', '', apple_css)

# Scope all CSS selectors under #markets-page
lines = apple_css.split('\n')
scoped_lines = []

inside_media = False
for line in lines:
    stripped = line.strip()
    if not stripped:
        scoped_lines.append(line)
        continue
    if stripped.startswith('@media'):
        scoped_lines.append(line)
        inside_media = True
        continue
    if stripped == '}':
        scoped_lines.append(line)
        inside_media = False
        continue
    
    # Check if this line contains selectors
    if '{' in line and not stripped.startswith('/*') and not stripped.startswith('@'):
        parts = line.split('{')
        selectors = parts[0].split(',')
        scoped_selectors = []
        for sel in selectors:
            sel = sel.strip()
            if sel:
                # Add #markets-page prefix
                scoped_selectors.append(f"#markets-page {sel}")
            else:
                scoped_selectors.append(sel)
        scoped_lines.append(', '.join(scoped_selectors) + ' {' + '{'.join(parts[1:]))
    else:
        scoped_lines.append(line)

scoped_apple_css = '\n'.join(scoped_lines)

# Combine original CSS with scoped Markets CSS
new_style_css = style_css + "\n\n/* MARKETS TAB STYLES SCOPED TO #MARKETS-PAGE */\n" + """
#markets-page {
    background: #f8fafc;
    color: #121212;
    border-radius: 14px;
    padding: 0;
    overflow: hidden;
    margin-top: 1rem;
}
#markets-page * {
    box-sizing: border-box;
}
""" + scoped_apple_css

with open(style_css_path, "w", encoding="utf-8") as f:
    f.write(new_style_css)

print("Homepage style restored and Markets CSS safely scoped to #markets-page!")
