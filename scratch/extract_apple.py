import os
import re

main_js_path = r"d:\SGAs\sga-website\src\main.js"
style_css_path = r"d:\SGAs\sga-website\src\style.css"
apple_html_path = r"d:\SGAs\sga-website\apple_stock_page.html"

with open(apple_html_path, "r", encoding="utf-8") as f:
    apple_content = f.read()

# Extract CSS from apple_stock_page.html
css_match = re.search(r'<style>(.*?)</style>', apple_content, re.DOTALL)
apple_css = css_match.group(1) if css_match else ""

# Extract JS from apple_stock_page.html
js_match = re.search(r'<script>(.*?)</script>', apple_content, re.DOTALL)
apple_js = js_match.group(1) if js_match else ""

# Extract Body Content (main-grid + modals)
body_match = re.search(r'<body>(.*?)<script>', apple_content, re.DOTALL)
apple_body = body_match.group(1) if body_match else ""

# Remove header from apple_body so it fits smoothly into the website's layout
apple_body_no_header = re.sub(r'<!-- Header -->.*?<!-- Main Content -->', '<!-- Markets Main Content -->', apple_body, flags=re.DOTALL)

print("Extracted CSS length:", len(apple_css))
print("Extracted JS length:", len(apple_js))
print("Extracted Body length:", len(apple_body_no_header))
