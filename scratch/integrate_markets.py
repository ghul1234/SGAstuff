import os
import re

main_js_path = r"d:\SGAs\sga-website\src\main.js"
style_css_path = r"d:\SGAs\sga-website\src\style.css"
apple_html_path = r"d:\SGAs\sga-website\apple_stock_page.html"

with open(apple_html_path, "r", encoding="utf-8") as f:
    apple_content = f.read()

# Extract CSS
css_match = re.search(r'<style>(.*?)</style>', apple_content, re.DOTALL)
apple_css = css_match.group(1) if css_match else ""

# Extract JS
js_match = re.search(r'<script>(.*?)</script>', apple_content, re.DOTALL)
apple_js = js_match.group(1) if js_match else ""

# Extract Body Content
body_match = re.search(r'<body>(.*?)<script>', apple_content, re.DOTALL)
apple_body = body_match.group(1) if body_match else ""
apple_body_no_header = re.sub(r'<!-- Header -->.*?<!-- Main Content -->', '<!-- Markets Main Content -->', apple_body, flags=re.DOTALL)

# 1. Append CSS to style.css
with open(style_css_path, "r", encoding="utf-8") as f:
    style_css = f.read()

if "/* MARKETS TAB STYLES FROM APPLE STOCK PAGE */" not in style_css:
    style_css += "\n\n/* MARKETS TAB STYLES FROM APPLE STOCK PAGE */\n" + apple_css

with open(style_css_path, "w", encoding="utf-8") as f:
    f.write(style_css)

print("CSS appended to style.css successfully!")

# 2. Update main.js
with open(main_js_path, "r", encoding="utf-8") as f:
    main_js = f.read()

# Replace nav link order: Market Map -> SGA Network -> Markets -> Sovereign Index -> SGA Ledger -> Yield Day
old_nav = """        <a href="#map" class="nav-link">Market Map</a>
        <a href="#network" class="nav-link" style="color: var(--accent-gold); font-weight: 700;">🌐 SGA Network</a>
        <a href="#table" class="nav-link">Sovereign Index</a>
        <a href="#ledger" class="nav-link">SGA Ledger</a>
        <a href="#calculator" class="nav-link">SGA Calculator</a>
        <a href="#yield-day" class="nav-link">Yield Day</a>"""

new_nav = """        <a href="#map" class="nav-link">Market Map</a>
        <a href="#network" class="nav-link" style="color: var(--accent-gold); font-weight: 700;">🌐 SGA Network</a>
        <a href="#markets" class="nav-link" style="color: #00c805; font-weight: 700;">Markets</a>
        <a href="#table" class="nav-link">Sovereign Index</a>
        <a href="#ledger" class="nav-link">SGA Ledger</a>
        <a href="#yield-day" class="nav-link">Yield Day</a>"""

if old_nav in main_js:
    main_js = main_js.replace(old_nav, new_nav)
    print("Nav link updated!")
else:
    # Pattern fallback
    main_js = re.sub(
        r'<a href="#map".*?<a href="#yield-day" class="nav-link">Yield Day</a>',
        new_nav,
        main_js,
        flags=re.DOTALL
    )
    print("Nav link updated via regex pattern!")

# Replace #calculator-page div with #markets-page div
markets_page_html = f"""    <!-- DEDICATED FULL-SCREEN MARKETS PAGE -->
    <div id="markets-page" class="hidden" style="margin-top: 1rem;">
{apple_body_no_header}
    </div>"""

# Match calculator page block and replace with markets page
main_js = re.sub(
    r'<!-- DEDICATED FULL-SCREEN SGA CALCULATOR PAGE -->.*?<div id="calculator-page" class="hidden".*?</div>\s*</div>\s*</div>',
    markets_page_html,
    main_js,
    flags=re.DOTALL
)

# 3. Append JS functions and state
render_markets_init = """

// ==================================================
// MARKETS PAGE INITIALIZATION
// ==================================================
let marketsInitialized = false;

function renderMarketsPage() {
    if (!marketsInitialized) {
        marketsInitialized = true;
        initPriceHistory();
        updateCurrencyUI();
        updateCalculations();
        updateLedgerDisplay();
        updateTopGainers();
        renderBondsGrid();
        updateBondDropdown();
        updateBondBanner();
        drawChart();
        checkUserExchangeCompliance();
        setInterval(tickPrice, 2000);
        setInterval(simulateTrades, 3500);
        setInterval(simulateFX, 4000);
    } else {
        drawChart();
        updateCurrencyUI();
        updateCalculations();
        checkUserExchangeCompliance();
    }
}
window.renderMarketsPage = renderMarketsPage;
"""

if "renderMarketsPage" not in main_js:
    # Add apple_js and render_markets_init at the end before init()
    main_js = main_js + "\n\n/* MARKETS TAB JAVASCRIPT FUNCTIONS */\n" + apple_js + render_markets_init

# Update handleRouting in main.js
old_routing = """  const dashboardPage = document.getElementById('dashboard-page');
  const newsPage = document.getElementById('news-page');
  const articlePage = document.getElementById('article-page');
  const calculatorPage = document.getElementById('calculator-page');
  const networkPage = document.getElementById('network-page');
  const walletPage = document.getElementById('wallet-page');"""

new_routing = """  const dashboardPage = document.getElementById('dashboard-page');
  const newsPage = document.getElementById('news-page');
  const articlePage = document.getElementById('article-page');
  const calculatorPage = document.getElementById('calculator-page');
  const marketsPage = document.getElementById('markets-page');
  const networkPage = document.getElementById('network-page');
  const walletPage = document.getElementById('wallet-page');"""

if old_routing in main_js:
    main_js = main_js.replace(old_routing, new_routing)

old_hide = """  if (dashboardPage) dashboardPage.classList.add('hidden');
  if (newsPage) newsPage.classList.add('hidden');
  if (articlePage) articlePage.classList.add('hidden');
  if (calculatorPage) calculatorPage.classList.add('hidden');
  if (networkPage) networkPage.classList.add('hidden');
  if (walletPage) walletPage.classList.add('hidden');"""

new_hide = """  if (dashboardPage) dashboardPage.classList.add('hidden');
  if (newsPage) newsPage.classList.add('hidden');
  if (articlePage) articlePage.classList.add('hidden');
  if (calculatorPage) calculatorPage.classList.add('hidden');
  if (marketsPage) marketsPage.classList.add('hidden');
  if (networkPage) networkPage.classList.add('hidden');
  if (walletPage) walletPage.classList.add('hidden');"""

if old_hide in main_js:
    main_js = main_js.replace(old_hide, new_hide)

old_calc_route = """  } else if (hash === '#calculator') {
    if (calculatorPage) calculatorPage.classList.remove('hidden');"""

new_markets_route = """  } else if (hash === '#markets' || hash === '#calculator') {
    if (marketsPage) {
      marketsPage.classList.remove('hidden');
      renderMarketsPage();
    }"""

if old_calc_route in main_js:
    main_js = main_js.replace(old_calc_route, new_markets_route)

with open(main_js_path, "w", encoding="utf-8") as f:
    f.write(main_js)

print("main.js updated with Markets tab successfully!")
