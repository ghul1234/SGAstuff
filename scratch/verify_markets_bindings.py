import os
import re

main_js_path = r"d:\SGAs\sga-website\src\main.js"

with open(main_js_path, "r", encoding="utf-8") as f:
    main_js = f.read()

# List of functions to expose on window
window_funcs = [
    "toggleGovernanceModal",
    "toggleModal",
    "toggleGainersModal",
    "renderGainersModal",
    "populateGovUserSelect",
    "selectTestProfile",
    "handleUserInputChanges",
    "toggleDurationField",
    "applyGovernanceAction",
    "updateGovModalUI",
    "checkUserExchangeCompliance",
    "executeTrade",
    "switchTab",
    "toggleOrderMethod",
    "setCurrency",
    "updateCurrencyUI",
    "handleInput",
    "formatInput",
    "updateCalculations",
    "updateLedgerDisplay",
    "updateTradesTable",
    "initPriceHistory",
    "drawMarketsChart",
    "setupChartHover",
    "switchTimeframe",
    "renderBondsGrid",
    "filterBondsCategory",
    "selectBond",
    "selectBondFromDropdown",
    "updateBondDropdown",
    "updateBondBanner",
    "switchAssetMode",
    "changeExchange",
    "updateExchangeBondsMarketplace",
    "updateTopGainers",
    "updateCurrentStock",
    "tickPrice",
    "simulateTrades",
    "simulateFX"
]

assignments = "\n".join([f"window.{fn} = {fn};" for fn in window_funcs])
assignments += "\nwindow.drawChart = drawMarketsChart;\n"

if "window.executeTrade = executeTrade" not in main_js:
    main_js += "\n\n// EXPOSE MARKETS FUNCTIONS TO WINDOW FOR INLINE HTML EVENT HANDLERS\n" + assignments
    with open(main_js_path, "w", encoding="utf-8") as f:
        f.write(main_js)
    print("Exposed all Markets functions on window object!")
else:
    print("Markets functions already exposed on window object.")
