import re

main_js_path = r"d:\SGAs\sga-website\src\main.js"

with open(main_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Remove trailing screener block from end of file
screener_logic_header = "// ==================================================\n// CHINA STOCK MARKET SCREENER LOGIC\n// =================================================="

if screener_logic_header in code:
    parts = code.split(screener_logic_header)
    base_code = parts[0]
    screener_code = screener_logic_header + parts[1]

    # Clean any trailing duplicate window exports at the end of screener_code
    screener_code = re.sub(r'// Window Exports.*$', '', screener_code, flags=re.DOTALL).strip()

    # Move screener_code to BEFORE window exports block
    export_marker = "// EXPOSE MARKETS FUNCTIONS TO WINDOW FOR INLINE HTML EVENT HANDLERS"

    if export_marker in base_code:
        # Add screener window exports into export_marker list
        screener_window_exports = """window.switchMarketsTab = switchMarketsTab;
window.getChinaScreenerStocks = getChinaScreenerStocks;
window.renderScreener = renderScreener;
window.sortScreenerBy = sortScreenerBy;
window.setScreenerQuickFilter = setScreenerQuickFilter;
window.changeScreenerExchange = changeScreenerExchange;
window.changeScreenerPage = changeScreenerPage;
window.inspectScreenerStock = inspectScreenerStock;
"""
        base_code = base_code.replace(export_marker, screener_code + "\n\n" + export_marker + "\n" + screener_window_exports)
        code = base_code

with open(main_js_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Reorganized main.js screener exports successfully!")
