import './style.css';
import { statesData, chinaSubdivisionsData, afghanistanSubdivisionsData, calculateEOI, getPayoutSplit, SHARES_PER_STATE, SOCIAL_PROGRAM_ALLOCATIONS, generateSocialProgramAllocations } from './data.js';
import { worldData, calculateWorldEOI, getCountryById, getCountryTicker, getCountrySGASymbol, calculateSwapPrice } from './worldData.js';
import { SGALedger, TAXONOMY } from './ledger.js';
import { FREDService } from './fredService.js';
import { newsFetcher } from './newsFetcher.js';
import { initNetworkUI, renderNetworkPage, renderWalletPage } from './networkUI.js';

const ledger = new SGALedger();
const fredService = new FREDService();

let currentMapType = 'us'; // 'us' or 'world'
let currentMapData = statesData; // Current data being displayed
let previousMapType = null; // Track previous map for back button

window.postedArticleUrls = new Set();

// Make EOI calculation functions available globally
window.calculateEOI = calculateEOI;
window.calculateWorldEOI = calculateWorldEOI;
window.getCountryById = getCountryById;
window.getCountryTicker = getCountryTicker;
window.getCountrySGASymbol = getCountrySGASymbol;
window.calculateSwapPrice = calculateSwapPrice;
window.switchMap = switchMap;
window.goBackToMap = goBackToMap;
window.filterBusinessWireOnly = filterBusinessWireOnly;

let totalNationalEOI = statesData.reduce((sum, state) => sum + calculateEOI(state), 0);

// SGA Futures Contract Specifications
const CONTRACT_SPECS = {
  tickSize: 1.00, // Price moves in whole dollars
  tickValue: 10.00, // 1 tick = $10.00 change in contract value
  multiplier: 10, // Contract multiplier set to 10
  initialMarginPct: 0.10,
  maintenanceMarginPct: 0.08,
  pricingScale: 2000 // EOI index points to USD pricing multiplier ($2,000 per EOI point)
};

// SGA Stock Specifications
const STOCK_SPECS = {
  tickSize: 0.01, // Price moves in cents
  tickValue: 0.01, // 1 share * 1 cent = 1 cent change
  multiplier: 1, // Share multiplier is 1
  initialMarginPct: 1.00, // Unleveraged Cash Account (100% margin)
  maintenanceMarginPct: 1.00,
  pricingScale: 2000
};

// SGA Swaps Specifications
const SWAP_SPECS = {
  tickSize: 0.0001,
  tickValue: 1.00,
  multiplier: 10000,
  initialMarginPct: 0.10,
  maintenanceMarginPct: 0.08,
  pricingScale: 1.0
};

window.activeInstrumentType = 'futures'; // 'futures', 'stock', or 'swap'
window.activeSwapPair = { countryA: 'us', countryB: 'cn' };

function getActiveSpecs() {
  if (window.activeInstrumentType === 'swap') return SWAP_SPECS;
  return window.activeInstrumentType === 'stock' ? STOCK_SPECS : CONTRACT_SPECS;
}

function getInstrumentSpecs(type) {
  if (type === 'swap') return SWAP_SPECS;
  return type === 'stock' ? STOCK_SPECS : CONTRACT_SPECS;
}


window.activeTimeframe = '10s';

function getTimeframeTicks(tf) {
  switch (tf) {
    case '10s': return 40;
    case '1m': return 240;
    case '5m': return 1200;
    case '15m': return 3600;
    case '1H': return 14400;
    case '1D': return 345600;
    default: return 40;
  }
}

function getTimeframeIntervalMs(tf) {
  switch (tf) {
    case '10s': return 10000;
    case '1m': return 60000;
    case '5m': return 300000;
    case '15m': return 900000;
    case '1H': return 3600000;
    case '1D': return 86400000;
    default: return 10000;
  }
}

function formatChartTime(time, timeframe) {
  if (timeframe === '1D') {
    return (time.getMonth() + 1) + '/' + time.getDate();
  } else if (timeframe === '1H') {
    return (time.getMonth() + 1) + '/' + time.getDate() + ' ' + time.getHours().toString().padStart(2, '0') + ':00';
  } else {
    return formatTime(time);
  }
}

window.setTimeframe = (timeframe) => {
  window.activeTimeframe = timeframe;
  
  document.querySelectorAll('.chart-timeframe-btn').forEach(btn => {
    if (btn.getAttribute('data-timeframe') === timeframe) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  window.tickCounter = 0;

  if (currentTradingStateData) {
    const specs = getActiveSpecs();
    const trend = currentTradingStateData.growth >= 0 ? 1 : -1;
    const ohlcData = new Array(600);
    let priceCursor = currentLivePrice;
    const now = new Date();
    const intervalMs = getTimeframeIntervalMs(timeframe);

    const decimals = window.activeInstrumentType === 'stock' ? (currentLivePrice < 1.0 ? 4 : 2) : 2;

    for (let i = 599; i >= 0; i--) {
      const time = new Date(now.getTime() - (599 - i) * intervalMs);
      const timeStr = formatChartTime(time, timeframe);
      const close = parseFloat(priceCursor.toFixed(decimals));
      const tickVol = specs.tickSize * (1 + Math.random() * 4);
      const change = (Math.random() * 2 - 1) * tickVol + (trend * specs.tickSize * 0.4);
      const open = parseFloat((close - change).toFixed(decimals));
      const high = parseFloat((Math.max(open, close) + Math.random() * specs.tickSize * 2).toFixed(decimals));
      const low = parseFloat((Math.min(open, close) - Math.random() * specs.tickSize * 2).toFixed(decimals));
      ohlcData[i] = { time: timeStr, open, high, low, close };
      priceCursor = open + (Math.random() * 2 - 1) * specs.tickSize;
    }

    if (chartCtx) {
      currentChartData = ohlcData;
      drawChart();
    }
  }
};

window.populateSwapCountryDropdowns = () => {
  const selA = document.getElementById('swap-country-a');
  const selB = document.getElementById('swap-country-b');
  if (!selA || !selB) return;

  const sortedCountries = [...worldData].sort((a, b) => b.eoi - a.eoi);
  
  const optionsHtml = sortedCountries.map(c => {
    const ticker = getCountryTicker(c.id);
    return `<option value="${c.id}">${c.name} (${ticker}-SGA | EOI: ${c.eoi.toFixed(1)})</option>`;
  }).join('');

  selA.innerHTML = optionsHtml;
  selB.innerHTML = optionsHtml;

  selA.value = window.activeSwapPair.countryA || 'us';
  selB.value = window.activeSwapPair.countryB || 'cn';
};

window.onSwapCountryChange = () => {
  const selA = document.getElementById('swap-country-a');
  const selB = document.getElementById('swap-country-b');
  if (selA && selB) {
    window.activeSwapPair.countryA = selA.value;
    window.activeSwapPair.countryB = selB.value;
    if (window.activeInstrumentType === 'swap') {
      window.updateSwapTerminalUI();
    }
  }
};

window.selectPresetSwap = (idA, idB) => {
  window.activeSwapPair.countryA = idA;
  window.activeSwapPair.countryB = idB;
  const selA = document.getElementById('swap-country-a');
  const selB = document.getElementById('swap-country-b');
  if (selA) selA.value = idA;
  if (selB) selB.value = idB;
  if (window.activeInstrumentType === 'swap') {
    window.updateSwapTerminalUI();
  }
};

window.flipSwapPair = () => {
  const temp = window.activeSwapPair.countryA;
  window.activeSwapPair.countryA = window.activeSwapPair.countryB;
  window.activeSwapPair.countryB = temp;

  const selA = document.getElementById('swap-country-a');
  const selB = document.getElementById('swap-country-b');
  if (selA) selA.value = window.activeSwapPair.countryA;
  if (selB) selB.value = window.activeSwapPair.countryB;

  if (window.activeInstrumentType === 'swap') {
    window.updateSwapTerminalUI();
  }
};

window.updateSwapTerminalUI = () => {
  const countryA = window.activeSwapPair.countryA || 'us';
  const countryB = window.activeSwapPair.countryB || 'cn';

  const cA = getCountryById(countryA) || { id: 'us', name: 'United States', eoi: 215.0 };
  const cB = getCountryById(countryB) || { id: 'cn', name: 'China', eoi: 185.5 };

  const symbolA = getCountrySGASymbol(countryA);
  const symbolB = getCountrySGASymbol(countryB);
  const pairSymbol = `${symbolA}/${symbolB}`;

  const swapPrice = calculateSwapPrice(countryA, countryB);
  currentLivePrice = swapPrice;
  window.continuousPrice = swapPrice;

  // Header & price label updates
  const stateNameEl = document.getElementById('trading-state-name');
  if (stateNameEl) stateNameEl.textContent = pairSymbol;

  const typeLabelEl = document.getElementById('instrument-type-label');
  if (typeLabelEl) typeLabelEl.textContent = 'SGA Relative Swap';

  const priceLabelEl = document.getElementById('terminal-price-label');
  if (priceLabelEl) priceLabelEl.textContent = 'Swap Ratio';

  const priceEl = document.getElementById('trading-price');
  if (priceEl) {
    priceEl.textContent = swapPrice.toFixed(4);
  }

  const ratioDispEl = document.getElementById('swap-eoi-ratio-display');
  if (ratioDispEl) {
    ratioDispEl.textContent = `EOI: ${cA.eoi.toFixed(1)} ÷ ${cB.eoi.toFixed(1)} = ${swapPrice.toFixed(4)}`;
  }

  // Spec items
  const formulaEl = document.getElementById('swap-spec-formula');
  if (formulaEl) formulaEl.textContent = `${cA.name} / ${cB.name}`;

  const marginEl = document.getElementById('swap-spec-margin');
  if (marginEl) {
    const marginReq = swapPrice * SWAP_SPECS.multiplier * SWAP_SPECS.initialMarginPct;
    marginEl.textContent = `$${marginReq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const g10List = ['us', 'cn', 'de', 'gb', 'jp', 'ca', 'au', 'fr', 'ch', 'se'];
  const isG10A = g10List.includes(countryA.toLowerCase());
  const isG10B = g10List.includes(countryB.toLowerCase());
  const isG10Pair = isG10A && isG10B;

  const volEl = document.getElementById('swap-spec-vol');
  if (volEl) {
    volEl.textContent = isG10Pair ? 'G10 (1 Pip)' : 'EM (3 Pip)';
  }

  // Generate Real FX Swap Candlestick Chart with Ornstein-Uhlenbeck Mean Reversion
  const ohlcData = new Array(600);
  let priceCursor = swapPrice;
  const now = new Date();
  const timeframe = window.activeTimeframe || '10s';
  const intervalMs = getTimeframeIntervalMs(timeframe);
  const pipVol = isG10Pair ? 0.00015 : 0.0004;

  for (let i = 599; i >= 0; i--) {
    const time = new Date(now.getTime() - (599 - i) * intervalMs);
    const timeStr = formatChartTime(time, timeframe);
    const close = parseFloat(priceCursor.toFixed(4));

    // Ornstein-Uhlenbeck mean-reversion pull towards fundamental EOI division ratio
    const pull = (swapPrice - priceCursor) * 0.18;
    const change = pull + (Math.random() * 2 - 1) * pipVol;
    const open = parseFloat(Math.max(0.0001, close - change).toFixed(4));

    const maxVal = Math.max(open, close);
    const minVal = Math.min(open, close);
    const high = parseFloat((maxVal + Math.random() * pipVol * 0.75).toFixed(4));
    const low = parseFloat(Math.max(0.0001, minVal - Math.random() * pipVol * 0.75).toFixed(4));

    ohlcData[i] = { time: timeStr, open, high, low, close };
    priceCursor = open;
  }

  if (chartCtx) {
    currentChartData = ohlcData;
    drawChart();
  }

  generateOrderBook(swapPrice);
  renderOrderBook();
  updateOrderSummary();
};

window.setInstrumentType = (type) => {
  window.activeInstrumentType = type;
  
  // Update toggle classes
  const futBtn = document.getElementById('instrument-btn-futures');
  const stkBtn = document.getElementById('instrument-btn-stock');
  const swpBtn = document.getElementById('instrument-btn-swap');
  
  if (futBtn) futBtn.classList.remove('active', 'futures-active');
  if (stkBtn) stkBtn.classList.remove('active', 'stock-active');
  if (swpBtn) swpBtn.classList.remove('active', 'swap-active');

  if (type === 'stock' && stkBtn) stkBtn.classList.add('active', 'stock-active');
  else if (type === 'swap' && swpBtn) swpBtn.classList.add('active', 'swap-active');
  else if (futBtn) futBtn.classList.add('active', 'futures-active');

  // Toggle selector & spec strips
  const futuresStrip = document.getElementById('specs-strip-futures');
  const stockStrip = document.getElementById('specs-strip-stock');
  const swapStrip = document.getElementById('specs-strip-swap');
  const swapContainer = document.getElementById('swap-selector-container');

  if (futuresStrip) futuresStrip.style.display = type === 'futures' ? '' : 'none';
  if (stockStrip) stockStrip.style.display = type === 'stock' ? '' : 'none';
  if (swapStrip) swapStrip.style.display = type === 'swap' ? '' : 'none';
  if (swapContainer) swapContainer.style.display = type === 'swap' ? 'flex' : 'none';

  // Adjust default quantity for user convenience
  const qtyInput = document.getElementById('order-qty');
  if (qtyInput) {
    const currentQty = parseInt(qtyInput.value.replace(/,/g, '')) || 1;
    if (type === 'stock' && currentQty === 1) {
      qtyInput.value = '100';
    } else if (type !== 'stock' && currentQty === 100) {
      qtyInput.value = '1';
    }
  }

  if (type === 'swap') {
    window.populateSwapCountryDropdowns();
    window.updateSwapTerminalUI();
    // Start live pricing loop for swaps to keep order book updating
    const swapPrice = calculateSwapPrice(window.activeSwapPair.countryA, window.activeSwapPair.countryB);
    startLivePricing(swapPrice);
  } else if (currentTradingStateData) {
    const eoi = calculateEOI(currentTradingStateData);
    const targetPrice = type === 'stock'
      ? window.getStockPrice(currentTradingStateData.id)
      : (eoi * CONTRACT_SPECS.pricingScale);

    currentLivePrice = targetPrice;
    window.continuousPrice = targetPrice;

    // Update terminal pricing display
    const priceEl = document.getElementById('trading-price');
    if (priceEl) {
      const decimals = type === 'stock' ? (currentLivePrice < 1.0 ? 4 : 2) : 2;
      priceEl.textContent = `$${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }

    // Regenerate Candlestick Chart for the new instrument
    const trend = currentTradingStateData.growth >= 0 ? 1 : -1;
    const ohlcData = new Array(600);
    let priceCursor = currentLivePrice;
    const now = new Date();
    const specs = getActiveSpecs();

    for (let i = 599; i >= 0; i--) {
      const time = new Date(now.getTime() - (599 - i) * 10000);
      const timeStr = formatTime(time);
      const close = parseFloat(priceCursor.toFixed(type === 'stock' ? 4 : 2));
      const tickVol = specs.tickSize * (1 + Math.random() * 4);
      const change = (Math.random() * 2 - 1) * tickVol + (trend * specs.tickSize * 0.4);
      const open = parseFloat((close - change).toFixed(type === 'stock' ? 4 : 2));
      const high = parseFloat((Math.max(open, close) + Math.random() * specs.tickSize * 2).toFixed(type === 'stock' ? 4 : 2));
      const low = parseFloat((Math.min(open, close) - Math.random() * specs.tickSize * 2).toFixed(type === 'stock' ? 4 : 2));
      ohlcData[i] = { time: timeStr, open, high, low, close };
      priceCursor = open + (Math.random() * 2 - 1) * specs.tickSize;
    }

    if (chartCtx) {
      currentChartData = ohlcData;
      drawChart();
    }

    generateOrderBook(currentLivePrice);
    renderOrderBook();
  }

  updateContractSpecsUI();
  renderIPOPanel();
  renderTable();
  updateOrderSummary();
};


function updateContractSpecsUI() {
  const specs = getActiveSpecs();
  
  const tickValEl = document.getElementById('spec-tick-val');
  const tickValueValEl = document.getElementById('spec-tick-value-val');
  const multValEl = document.getElementById('spec-mult-val');
  const marginLabelEl = document.getElementById('spec-margin-label');
  const tickLabelEl = document.getElementById('spec-tick-label');
  const tickValueLabelEl = document.getElementById('spec-tick-value-label');
  const multLabelEl = document.getElementById('spec-mult-label');
  const qtyLabelEl = document.getElementById('order-qty-label');
  const labelEl = document.getElementById('instrument-type-label');

  if (tickLabelEl) tickLabelEl.textContent = 'Tick';
  if (tickValueLabelEl) tickValueLabelEl.textContent = 'Tick Val';
  if (multLabelEl) multLabelEl.textContent = window.activeInstrumentType === 'stock' ? 'Shares' : 'Mult';
  if (qtyLabelEl) qtyLabelEl.textContent = window.activeInstrumentType === 'stock' ? 'Shares' : 'Contracts';
  if (labelEl) labelEl.textContent = window.activeInstrumentType === 'stock' ? 'SGA Shares' : 'Futures Contract';

  if (tickValEl) tickValEl.textContent = specs.tickSize.toFixed(2);
  if (tickValueValEl) tickValueValEl.textContent = `$${specs.tickValue.toFixed(2)}`;
  if (multValEl) multValEl.textContent = specs.multiplier;

  if (marginLabelEl) {
    marginLabelEl.textContent = window.activeInstrumentType === 'stock' ? 'Required Cash' : 'Init Margin';
  }

  // Update margin value
  const specMargin = document.getElementById('spec-margin');
  if (specMargin && currentTradingStateData) {
    const eoi = calculateEOI(currentTradingStateData);
    const price = currentLivePrice || (eoi * specs.pricingScale);
    const marginReq = price * specs.multiplier * specs.initialMarginPct;
    specMargin.textContent = formatCurrency(marginReq);
  }

  // Update expiry value
  const specExpiry = document.getElementById('spec-expiry');
  if (specExpiry) {
    if (window.activeInstrumentType === 'stock') {
      specExpiry.textContent = 'Perpetual';
    } else {
      specExpiry.textContent = getNextExpiry().label;
    }
  }

  // Toggle specs strips
  const futuresStrip = document.getElementById('specs-strip-futures');
  const stockStrip = document.getElementById('specs-strip-stock');
  if (futuresStrip) futuresStrip.style.display = window.activeInstrumentType === 'stock' ? 'none' : '';
  if (stockStrip) stockStrip.style.display = window.activeInstrumentType === 'stock' ? '' : 'none';

  // Update Mark Price label
  const priceLabelEl = document.getElementById('terminal-price-label');
  if (priceLabelEl) priceLabelEl.textContent = window.activeInstrumentType === 'stock' ? 'Share Price' : 'Mark Price';

  // Update stock spec values
  if (window.activeInstrumentType === 'stock' && currentTradingStateData) {
    const stockPrice = currentLivePrice || window.getStockPrice(currentTradingStateData.id);
    const reqCash = stockPrice * 1; // 1 share
    const reqCashEl = document.getElementById('stock-spec-req-cash');
    if (reqCashEl) reqCashEl.textContent = reqCash < 1 ? `$${reqCash.toFixed(4)}` : `$${reqCash.toFixed(2)}`;
  }

  // Update left-side Details Panel labels and values dynamically
  const exposureLabelEl = document.getElementById('market-exposure-label');
  const oiLabelEl = document.getElementById('market-oi-label');
  const outstandingLabelEl = document.getElementById('market-outstanding-label');
  const oiEl = document.getElementById('market-oi');
  const outstandingEl = document.getElementById('market-outstanding');

  if (currentTradingStateData) {
    const eoi = calculateEOI(currentTradingStateData);
    const stateProportion = eoi / totalNationalEOI;

    if (window.activeInstrumentType === 'stock') {
      if (exposureLabelEl) exposureLabelEl.textContent = 'Share Details';
      if (oiLabelEl) oiLabelEl.textContent = 'Market Cap';
      if (outstandingLabelEl) outstandingLabelEl.textContent = 'Shares Out';
      
      const stockPrice = currentLivePrice || window.getStockPrice(currentTradingStateData.id);
      const mcap = 100_000_000_000 * stockPrice;
      if (oiEl) oiEl.textContent = formatCurrency(mcap);
      if (outstandingEl) outstandingEl.textContent = '100.0B';
    } else {
      if (exposureLabelEl) exposureLabelEl.textContent = 'Market Exposure';
      if (oiLabelEl) oiLabelEl.textContent = 'Open Interest';
      if (outstandingLabelEl) outstandingLabelEl.textContent = 'Contracts Out';
      
      if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
      if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);
    }
  }

  // Update Order Entry buttons labels
  const buyBtn = document.querySelector('.trading-terminal .buy-btn');
  const sellBtn = document.querySelector('.trading-terminal .sell-btn');
  if (buyBtn && sellBtn) {
    buyBtn.disabled = false;
    sellBtn.disabled = false;
    buyBtn.style.opacity = '';
    sellBtn.style.opacity = '';
    buyBtn.style.cursor = '';
    sellBtn.style.cursor = '';
    if (window.activeInstrumentType === 'stock') {
      buyBtn.innerHTML = `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">BUY SHARES</span>LONG`;
      sellBtn.innerHTML = `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT SELL</span>SHORT`;
    } else {
      buyBtn.innerHTML = `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">LONG</span>BUY`;
      sellBtn.innerHTML = `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>SELL`;
    }
  }
}



// ─────────────────────────────────────────────
// IPO ENGINE — SGA Stock Shares
// ─────────────────────────────────────────────

// Live stock prices per state — independent from futures price.
// Before IPO: floor at $0.000001. After IPO: set to ipoPriceTarget.
window.stockPrices = {};
statesData.forEach(s => { window.stockPrices[s.id] = 0.000001; });

// Previous day's stock prices for 24h change calculation
window.previousDayStockPrices = {};
statesData.forEach(s => {
  // Set initial previous day price to create visible initial changes
  // Use a larger percentage offset to create realistic -10% to +10% initial changes
  const basePrice = 0.000001;
  const pctChange = (Math.random() * 0.20) - 0.10; // -10% to +10%
  window.previousDayStockPrices[s.id] = basePrice * (1 - pctChange);
});

// Returns the live stock market price for a given state (independent of futures)
window.getStockPrice = (stateId) => window.stockPrices[stateId] || 0.000001;

// Simulate stock price movements for realistic 24h changes
setInterval(() => {
  statesData.forEach(state => {
    const currentPrice = window.getStockPrice(state.id);

    // Only simulate movement for states that have completed IPO or are running
    if (state.ipoStatus === 'completed' || state.ipoStatus === 'running') {
      // Simulate random price movement based on state growth - make it more volatile
      const volatility = 0.08; // Increased to 8% volatility for more visible changes
      const drift = state.growth * 0.001; // Increased drift based on growth
      const randomChange = (Math.random() - 0.5) * volatility + drift;

      const newPrice = currentPrice * (1 + randomChange);
      window.stockPrices[state.id] = Math.max(0.000001, newPrice);

      // Update state's current IPO price if running
      if (state.ipoStatus === 'running') {
        state.ipoCurrentPrice = window.stockPrices[state.id];
      }

      // Update previous day price more frequently to show changing percentages
      // This creates changing 24h percentages over time
      if (Math.random() > 0.5) { // 50% chance each update (increased from 30%)
        const timeVariation = (Math.random() * 0.20) - 0.10; // -10% to +10% (increased range)
        window.previousDayStockPrices[state.id] = currentPrice * (1 + timeVariation);
      }
    }
  });
  // Re-render table to show updated prices and 24h changes
  renderTable();
}, 1000); // Update every 1 second (decreased from 1.5 seconds for faster updates)

// IPO simulation status
window.ipoRunning = false;
window.ipoAnimationId = null;

/**
 * Request IPO simulation with custom share amount and 5-second delay
 */
window.requestIPOSimulation = (stateId) => {
  const state = statesData.find(s => s.id === stateId);
  if (!state) return;
  if (state.ipoStatus === 'running') {
    showTradeNotification(`${state.name} IPO is already in progress.`, 'sell');
    return;
  }
  if (state.ipoStatus === 'completed') {
    showTradeNotification(`${state.name} IPO has already completed.`, 'sell');
    return;
  }

  // Get requested share amount from input (try both table and card inputs)
  const tableSharesInput = document.getElementById(`ipo-shares-${stateId}`);
  const cardSharesInput = document.getElementById('ipo-card-shares');
  const requestedShares = parseInt(tableSharesInput?.value || cardSharesInput?.value) || 100000000;

  // Disable button and show countdown
  const runBtn = document.querySelector(`button[onclick="requestIPOSimulation('${stateId}')"]`);
  if (runBtn) {
    runBtn.disabled = true;
    let countdown = 5;
    runBtn.textContent = `${countdown}s`;
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        runBtn.textContent = `${countdown}s`;
      } else {
        clearInterval(countdownInterval);
        runBtn.textContent = '▶ Run';
        runBtn.disabled = false;
        runIPOSimulation(stateId, requestedShares);
      }
    }, 1000);
  }

  showTradeNotification(`🚀 ${state.name} IPO starting in 5 seconds... (${requestedShares.toLocaleString()} shares)`, 'buy');
};

/**
 * Animate IPO price discovery for a single state.
 * Price walks from $0.000001 → ipoPriceTarget over ~3.5 seconds using eased steps.
 */
window.runIPOSimulation = (stateId, requestedShares = 100000000) => {
  const state = statesData.find(s => s.id === stateId);
  if (!state) return;
  if (state.ipoStatus === 'running') {
    showTradeNotification(`${state.name} IPO is already in progress.`, 'sell');
    return;
  }
  if (state.ipoStatus === 'completed') {
    showTradeNotification(`${state.name} SGA IPO already completed. Price: $${state.ipoCurrentPrice.toFixed(2)}`, 'buy');
    return;
  }

  // Track concurrent running count
  window.ipoRunningCount = (window.ipoRunningCount || 0) + 1;
  window.ipoRunning = true;
  state.ipoStatus = 'running';
  state.ipoCurrentPrice = 0.000001;
  window.stockPrices[state.id] = 0.000001;
  state.ipoProgress = 0;

  // ── Inject pre-IPO positions for State Treasury and Federal Government ──
  // Remove any previous IPO positions for this state to avoid duplication on re-run
  positions = positions.filter(p => !(p.isIPOPosition && p.stateId === stateId));

  // State Treasury: 20 billion shares at floor $0.000001
  const statePosId = positionIdCounter++;
  positions.push({
    id: statePosId,
    stateId: state.id,
    stateName: state.id,
    side: 'LONG',
    qty: 20_000_000_000,
    entryPrice: 0.000001,
    timestamp: Date.now(),
    instrumentType: 'stock',
    isIPOPosition: true,
    ipoParty: 'STATE',
    label: 'State Treasury'
  });

  // Federal Government: 20 billion shares at floor $0.000001
  const fedPosId = positionIdCounter++;
  positions.push({
    id: fedPosId,
    stateId: state.id,
    stateName: state.id,
    side: 'LONG',
    qty: 20_000_000_000,
    entryPrice: 0.000001,
    timestamp: Date.now(),
    instrumentType: 'stock',
    isIPOPosition: true,
    ipoParty: 'FED',
    label: 'Federal Government'
  });

  // User position with requested shares
  const userPosId = positionIdCounter++;
  positions.push({
    id: userPosId,
    stateId: state.id,
    stateName: state.id,
    side: 'LONG',
    qty: requestedShares,
    entryPrice: 0.000001,
    timestamp: Date.now(),
    instrumentType: 'stock',
    isIPOPosition: false,
    label: 'User IPO Allocation'
  });

  renderPositions();

  const startPrice = 0.000001;
  const targetPrice = state.ipoPriceTarget;

  // Log panel details (instantly logged)
  const logEl = document.getElementById('ipo-log-panel');
  if (logEl) {
    logEl.innerHTML = '';
    
    const appendLog = (html) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      div.style.animation = 'ipo-log-appear 0.4s ease';
      logEl.appendChild(div);
    };

    appendLog(`<div class="ipo-log-entry ipo-log-start">🔔 <strong>${state.name} SGA Stock IPO Initiated</strong> — ${new Date().toLocaleTimeString()}</div>`);
    appendLog(`<div class="ipo-log-entry">📋 <strong>Underwriter:</strong> ${state.ipoUnderwriter} | Target Market Cap: <span class="ipo-highlight">$${state.ipoMarketCap}</span></div>`);
    appendLog(`<div class="ipo-log-entry">📊 <strong>Total Shares:</strong> 50,000,000,000 (50 Billion) | Floor: <span class="ipo-floor">$0.000001</span></div>`);
    appendLog(`<div class="ipo-log-entry ipo-log-state">🏛️ <strong>State Treasury Investment:</strong> $50 Million cash committed for 20% equity (20,000,000,000 shares)</div>`);
    appendLog(`<div class="ipo-log-entry ipo-log-fed">🏛️ <strong>Federal Government Investment:</strong> $50 Million cash injected for 20% equity (20,000,000,000 shares)</div>`);
    appendLog(`<div class="ipo-log-entry ipo-log-book">📈 <strong>Public Market Allocation:</strong> 60% equity (60,000,000,000 shares) underwritten by ${state.ipoUnderwriter} — Price discovery begins...</div>`);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Price animation: extremely slow walk (every 10 seconds) from startPrice ($0.000001) → targetPrice
  // Walks from $0.000001 to $1.00 over 70 seconds (7 steps of 10s), then shifts to normal speeds (100ms per step) above $1.00.
  const STEPS = 12;
  let step = 0;
  let lastLoggedMilestone = -1;
  let walk;

  // Full re-render on run to show pricing state
  renderIPOPanel();

  const runStep = () => {
    step++;
    const t = step / STEPS;
    
    let currentPrice;
    if (targetPrice <= 1.00) {
      const eased = Math.pow(t, 3); // Cubic ease-in for extremely slow sub-dollar climb
      const noiseAmplitude = (targetPrice - startPrice) * 0.05 * Math.sin(t * Math.PI);
      const noise = (Math.random() * 2 - 1) * noiseAmplitude;
      currentPrice = startPrice + (targetPrice - startPrice) * eased + noise;
    } else {
      if (step <= 7) {
        // Sub-dollar phase: very slow pennies walk over 7 steps (70 seconds)
        const tSub = step / 7;
        const eased = Math.pow(tSub, 3); // Cubic ease-in
        const noiseAmplitude = 0.05 * Math.sin(tSub * Math.PI);
        const noise = (Math.random() * 2 - 1) * noiseAmplitude;
        currentPrice = startPrice + (1.00 - startPrice) * eased + noise;
        
        // When we reach step 7 (price reaches $1.00), shift gears to normal speed!
        if (step === 7) {
          clearInterval(walk);
          // Shift to 100ms ticks for normal speed post-dollar climb
          walk = setInterval(runStep, 100);
          window.ipoAnimationId = walk;
        }
      } else {
        // Post-dollar phase: normal speed walk (100ms per step) over remaining 5 steps
        const tPost = (step - 7) / 5;
        const eased = Math.pow(tPost, 2);
        const noiseAmplitude = (targetPrice - 1.00) * 0.04 * Math.sin(tPost * Math.PI);
        const noise = (Math.random() * 2 - 1) * noiseAmplitude;
        currentPrice = 1.00 + (targetPrice - 1.00) * eased + noise;
      }
    }
    
    // Ensure we don't go below startPrice
    currentPrice = Math.max(startPrice, currentPrice);
    
    // Enforce target price at final step
    if (step >= STEPS) {
      currentPrice = targetPrice;
    }

    state.ipoCurrentPrice = parseFloat(currentPrice.toFixed(4));
    window.stockPrices[state.id] = state.ipoCurrentPrice;
    state.ipoProgress = parseFloat((t * 100).toFixed(1));

    const priceStr = state.ipoCurrentPrice >= 1
      ? `$${state.ipoCurrentPrice.toFixed(2)}`
      : `$${state.ipoCurrentPrice.toFixed(4)}`;
    const gainPct = ((state.ipoCurrentPrice - 0.000001) / 0.000001 * 100);
    const gainStr = '+' + gainPct.toLocaleString(undefined, { maximumFractionDigits: 0 }) + '%';

    // Card stat updates
    const cardPriceEl = document.getElementById('ipo-card-live-price');
    if (cardPriceEl) cardPriceEl.textContent = priceStr;

    const cardGainEl = document.getElementById('ipo-card-live-gain');
    if (cardGainEl) cardGainEl.textContent = gainStr;

    // Table row price update
    const rowPriceEl = document.getElementById(`ipo-row-price-${state.id}`);
    if (rowPriceEl) rowPriceEl.textContent = priceStr;

    // Update trading terminal pricing & chart in real-time
    if (currentTradingStateData && currentTradingStateData.id === stateId && window.activeInstrumentType === 'stock') {
      currentLivePrice = state.ipoCurrentPrice;
      const livePriceEl = document.getElementById('live-price');
      if (livePriceEl) livePriceEl.textContent = priceStr;
      const tradingPriceEl = document.getElementById('trading-price');
      if (tradingPriceEl) tradingPriceEl.textContent = priceStr;

      // Update the order book to center around the active pricing walk
      generateOrderBook(currentLivePrice);
      renderOrderBook();

      // Update the chart candlestick data with current price walk
      if (currentChartData && currentChartData.length > 0) {
        const lastCandle = currentChartData[currentChartData.length - 1];
        lastCandle.close = currentLivePrice;
        lastCandle.high = Math.max(lastCandle.high, currentLivePrice);
        lastCandle.low = Math.min(lastCandle.low, currentLivePrice);
        drawChart();
      }
    }

    renderPositions();

    // Milestones at 25%, 50%, 75%
    const milestone = Math.floor(state.ipoProgress / 25) * 25;
    if (milestone > 0 && milestone <= 75 && milestone !== lastLoggedMilestone) {
      lastLoggedMilestone = milestone;
      if (logEl) {
        const div = document.createElement('div');
        div.className = 'ipo-log-entry ipo-log-book';
        div.innerHTML = `📊 <strong>${milestone}% Priced</strong> — Current price: <span class="ipo-highlight">${priceStr}</span> | Gain from floor: <span style="color:#10b981;font-weight:700;">${gainStr}</span>`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
      }
    }

    if (step >= STEPS) {
      clearInterval(walk);
      state.ipoStatus = 'completed';
      state.ipoCurrentPrice = targetPrice;
      window.stockPrices[state.id] = targetPrice;
      // Update previous day price to create realistic initial 24h change (larger variation)
      // Set it slightly different from target price to create immediate visible percentage change
      const initialVariation = (Math.random() * 0.15) - 0.075; // -7.5% to +7.5% variation
      window.previousDayStockPrices[state.id] = targetPrice * (1 + initialVariation);
      state.ipoProgress = 100;

      // Decrement running count
      window.ipoRunningCount = Math.max(0, (window.ipoRunningCount || 1) - 1);
      window.ipoRunning = window.ipoRunningCount > 0;

      if (logEl) {
        const div = document.createElement('div');
        div.className = 'ipo-log-entry ipo-log-complete';
        div.innerHTML = `✅ <strong>IPO COMPLETE</strong> — ${state.name} priced at <span class="ipo-highlight">$${targetPrice.toFixed(2)}</span> per share | Market Cap: $${state.ipoMarketCap}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
      }

      if (currentTradingStateData && currentTradingStateData.id === stateId && window.activeInstrumentType === 'stock') {
        currentLivePrice = targetPrice;
        generateOrderBook(targetPrice);
        renderOrderBook();
        updateOrderSummary();
      }

      renderIPOPanel();

      if (!window._runningAllIPOs) {
        showTradeNotification(`🎉 ${state.name} IPO Complete! $${targetPrice.toFixed(2)}/share — ${state.ipoUnderwriter}`, 'buy');
      } else if (window.ipoRunningCount === 0) {
        window._runningAllIPOs = false;
        showTradeNotification('🎉 All 50 State SGA IPOs Completed! Full national market now live.', 'buy');
      }
    }
  };

  // Start with 10-second intervals for the sub-dollar phase
  walk = setInterval(runStep, 10000);
  window.ipoAnimationId = walk;
};

/**
 * Run all pending state IPOs simultaneously
 */
window.runAllIPOs = () => {
  const pending = statesData.filter(s => s.ipoStatus === 'pending');
  if (pending.length === 0) {
    showTradeNotification('All state IPOs have already completed.', 'buy');
    return;
  }
  showTradeNotification(`🚀 Launching all ${pending.length} SGA IPOs simultaneously...`, 'buy');
  window._runningAllIPOs = true;
  window.ipoRunningCount = pending.length;

  pending.forEach((state, i) => {
    setTimeout(() => {
      if (state.ipoStatus === 'pending') {
        window.runIPOSimulation(state.id);
      }
    }, i * 30);
  });
};

/**
 * Reset all IPOs to pending (for demo)
 */
window.resetAllIPOs = () => {
  // Cancel all running walks by force-resetting state
  window.ipoRunningCount = 0;
  window.ipoRunning = false;
  window._runningAllIPOs = false;
  statesData.forEach(s => {
    s.ipoStatus = 'pending';
    s.ipoCurrentPrice = 0.000001;
    s.ipoProgress = 0;
    window.stockPrices[s.id] = 0.000001;
  });
  // Remove all IPO positions from the panel
  positions = positions.filter(p => !p.isIPOPosition);
  renderPositions();
  renderIPOPanel();
  showTradeNotification('All IPO simulations reset to pending.', 'buy');
};

function renderIPOPanel() {
  const container = document.getElementById('ipo-states-table-body');
  if (!container) return;

  const sorted = [...statesData].sort((a, b) => b.ipoPriceTarget - a.ipoPriceTarget);

  container.innerHTML = sorted.map(state => {
    const statusBadge = state.ipoStatus === 'completed'
      ? `<span class="ipo-badge ipo-badge-complete">✅ Live</span>`
      : state.ipoStatus === 'running'
      ? `<span class="ipo-badge ipo-badge-running">⏳ Pricing</span>`
      : `<span class="ipo-badge ipo-badge-pending">🕐 Pending</span>`;

    const currentPriceStr = state.ipoStatus === 'completed'
      ? `<span id="ipo-row-price-${state.id}" style="color:#10b981;font-weight:700;font-family:monospace;">$${state.ipoCurrentPrice.toFixed(2)}</span>`
      : state.ipoStatus === 'running'
      ? `<span id="ipo-row-price-${state.id}" style="color:var(--accent-gold);font-weight:700;font-family:monospace;">$${state.ipoCurrentPrice.toFixed(4)}</span>`
      : `<span id="ipo-row-price-${state.id}" style="color:rgba(255,255,255,0.3);font-family:monospace;">$0.000001</span>`;

    const runBtn = state.ipoStatus !== 'completed'
      ? `<div style="display:flex;gap:0.25rem;align-items:center;">
          <input type="number" id="ipo-shares-${state.id}" class="ipo-shares-input" value="100000000" min="1" step="1" style="width:80px;padding:0.2rem 0.4rem;font-size:0.7rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;" placeholder="Shares">
          <button class="ipo-run-btn" onclick="requestIPOSimulation('${state.id}')" ${state.ipoStatus === 'running' ? 'disabled' : ''}>▶ Run</button>
        </div>`
      : `<span style="color:#10b981;font-size:0.65rem;font-weight:600;">LIVE</span>`;

    return `
      <tr class="ipo-table-row" style="cursor:pointer;" onclick="selectStateFromIPO('${state.id}')">
        <td style="font-weight:600;">${state.name}</td>
        <td style="font-family:monospace;color:var(--accent-blue);">$${state.ipoPriceTarget.toFixed(2)}</td>
        <td style="color:rgba(255,255,255,0.6);">$${state.ipoMarketCap}</td>
        <td style="font-size:0.6rem;color:rgba(255,255,255,0.45);">${state.ipoUnderwriter}</td>
        <td>${currentPriceStr}</td>
        <td>${statusBadge}</td>
        <td>${runBtn}</td>
      </tr>
    `;
  }).join('');

  renderSelectedStateIPOCard();
}

function renderSelectedStateIPOCard() {
  const card = document.getElementById('ipo-selected-card');
  if (!card || !currentTradingStateData) {
    if (card) card.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;font-size:0.8rem;">Select a state from the map to view its IPO details.</div>`;
    return;
  }
  const state = statesData.find(s => s.id === currentTradingStateData.id);
  if (!state) return;

  const statusColor = state.ipoStatus === 'completed' ? '#10b981' : state.ipoStatus === 'running' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)';
  const statusLabel = state.ipoStatus === 'completed' ? '✅ IPO Complete — Trading Live' : state.ipoStatus === 'running' ? '⏳ Pricing...' : '🕐 Awaiting IPO Launch';
  
  // Calculate percentage gain dynamically as current price goes up
  const currentGain = ((state.ipoCurrentPrice - 0.000001) / 0.000001 * 100);
  const gainPct = currentGain.toLocaleString(undefined, { maximumFractionDigits: 0 });

  card.innerHTML = `
    <div class="ipo-card-header">
      <div>
        <div style="font-size:1.05rem;font-weight:700;">${state.name} SGA Stock</div>
        <div style="font-size:0.6rem;color:rgba(255,255,255,0.45);margin-top:2px;">Underwritten by ${state.ipoUnderwriter}</div>
      </div>
      <span class="ipo-status-pill" style="background:${statusColor}18;border-color:${statusColor}44;color:${statusColor};">${statusLabel}</span>
    </div>
    <div class="ipo-card-stats">
      <div class="ipo-stat"><div class="ipo-stat-label">Floor Price</div><div class="ipo-stat-value" style="color:rgba(255,255,255,0.4);">$0.000001</div></div>
      <div class="ipo-stat"><div class="ipo-stat-label">Current</div><div id="ipo-card-live-price" class="ipo-stat-value" style="color:${state.ipoStatus === 'completed' ? '#10b981' : 'var(--accent-gold)'};">$${state.ipoCurrentPrice >= 1 ? state.ipoCurrentPrice.toFixed(2) : state.ipoCurrentPrice.toFixed(4)}</div></div>
      <div class="ipo-stat"><div class="ipo-stat-label">Price Target</div><div class="ipo-stat-value" style="color:var(--accent-blue);">$${state.ipoPriceTarget.toFixed(2)}</div></div>
      <div class="ipo-stat"><div class="ipo-stat-label">Market Cap</div><div class="ipo-stat-value" style="color:var(--accent-gold);">$${state.ipoMarketCap}</div></div>
      <div class="ipo-stat"><div class="ipo-stat-label">Total Shares</div><div class="ipo-stat-value">50B</div></div>
      <div class="ipo-stat"><div class="ipo-stat-label">Gain from $0.000001</div><div id="ipo-card-live-gain" class="ipo-stat-value" style="color:#10b981;">+${gainPct}%</div></div>
    </div>
    <div class="ipo-funding-breakdown">
      <div style="font-size:0.6rem;color:rgba(255,255,255,0.45);margin-bottom:6px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Initial Capital & Equity Allocation</div>
      <div class="ipo-funding-bar" style="display:flex;height:8px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
        <div style="flex:20;background:linear-gradient(90deg,#3b82f6,#60a5fa);" title="Federal Government (Fed): 20%"></div>
        <div style="flex:20;background:linear-gradient(90deg,#f59e0b,#fbbf24);" title="State Government: 20%"></div>
        <div style="flex:60;background:linear-gradient(90deg,#8b5cf6,#a78bfa);" title="Public Market: 60%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:0.58rem;flex-wrap:wrap;line-height:1.35;">
        <span style="color:#60a5fa;display:inline-flex;align-items:center;gap:3px;">🏛️ <strong>Fed:</strong> $50M (20% / 20B sh.)</span>
        <span style="color:#fbbf24;display:inline-flex;align-items:center;gap:3px;">🏛️ <strong>State:</strong> $50M (20% / 20B sh.)</span>
        <span style="color:#a78bfa;display:inline-flex;align-items:center;gap:3px;">🛒 <strong>Market:</strong> 60% (30B sh.)</span>
      </div>
    </div>
    ${state.ipoStatus !== 'completed' ? `
    <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:8px;">
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <label style="font-size:0.65rem;color:rgba(255,255,255,0.6);">Shares:</label>
        <input type="number" id="ipo-card-shares" value="100000000" min="1" step="1" style="flex:1;padding:0.3rem 0.5rem;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;">
      </div>
      <button class="ipo-launch-btn" onclick="requestIPOSimulation('${state.id}')" ${state.ipoStatus === 'running' ? 'disabled' : ''}>
        ${state.ipoStatus === 'running' ? '⏳ Pricing...' : '🚀 Launch IPO Simulation'}
      </button>
    </div>` : `
    <div style="text-align:center;padding:8px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:6px;color:#10b981;font-size:0.75rem;font-weight:600;margin-top:8px;">
      ✅ Trading Live at $${state.ipoCurrentPrice.toFixed(2)} per share
    </div>`}
  `;
}

let positions = [];

let positionIdCounter = 1;
let currentLivePrice = 0;
let currentBid = 0;
let currentAsk = 0;
let currentTradingStateData = null;
let liveTickInterval = null;
let backgroundSimInterval = null;
let sovereignReinvestmentInterval = null;

// Drawdown short-selling restriction: after 1.6% drawdown yield, no shorts for 10 minutes
let drawdownCooldownExpiry = 0; // Unix ms timestamp; 0 = no active cooldown

// Realistic market behavior variables for drawdown events
let baseVolatility = 0.05; // Base volatility level
let currentVolatility = 0.05; // Current volatility (dynamic)
let drawdownVolatilitySpike = 0; // Volatility spike during drawdown
let bidAskSpreadMultiplier = 1.0; // Spread widening factor
let orderFlowImbalance = 0; // Dividend capture order flow
let postDrawdownRecoveryFactor = 0; // Recovery dynamics
let drawdownTimestamp = 0; // Time of last drawdown

// Trillion-dollar real-time Limit Order Book & Trades
let orderBook = { bids: [], asks: [] };
let recentTrades = [];
window.allTransactions = [];
window.userTradeHistory = [];
window.clearingRevenue = {
  total: 0,
  totalTradesCount: 0
};
window.txFilter = 'all';
window.tickCounter = 0;
window.priceMomentum = 0;

/*
// State-tailored economic news pool for all 50 states representing realistic local economic drivers
const STATE_NEWS_POOL = {
  AL: {
    bullish: {
      title: "Alabama Aerospace Corridor Lands $2.4B Rocket Expansion",
      description: "Huntsville technology hub expands defense propulsion production, adding 3,500 advanced technical engineering positions to the sovereign growth corridor."
    },
    bearish: {
      title: "Automotive Part Shortages Slow Production Lines at Alabama Assembly Plants",
      description: "Global micro-component logistics delays trigger temporary line halts, lowering near-term manufacturing output indices."
    }
  },
  AK: {
    bullish: {
      title: "Alaska Sovereign Oil Lease Sales Surge to Record Highs",
      description: "State Department of Natural Resources reports unprecedented bidding volume, bolstering long-term sovereign wealth reserves."
    },
    bearish: {
      title: "Alaskan Salmon Catch Falls 22%, Disputing Regional Export Models",
      description: "Bristol Bay commercial fisheries report significantly lowered yields under warm current pressures, impacting regional seafood trade balances."
    }
  },
  AZ: {
    bullish: {
      title: "Phoenix Microelectronics Hub Attracts $15B Megafab Capital Influx",
      description: "Federal and state grants successfully attract global microchip manufacturers, expanding local cleanrooms and advanced technical labor pools."
    },
    bearish: {
      title: "Water Allocation Caps Limit Commercial Real Estate Construction in Phoenix Metro",
      description: "New environmental directives restrict high-volume commercial starts, cooling near-term industrial development indices."
    }
  },
  AR: {
    bullish: {
      title: "Arkansas Logistics Infrastructure Hub Receives $1.2B Cargo Expansion",
      description: "Intermodal freight centers in West Memphis secure private funding to double shipping capacity, boosting agricultural trade streams."
    },
    bearish: {
      title: "Poultry Feed Cost Inflation Triggers Operating Margin Contractions for Arkansas Producers",
      description: "Surging grain prices impact agricultural earnings, creating temporary pricing friction in state sovereign index yields."
    }
  },
  CA: {
    bullish: {
      title: "Silicon Valley AI Boom Drives California Tech Tax Windfall",
      description: "State finance department records massive capital gains tax receipts from tech IPOs, bolstering the general fund surplus and growth outlook."
    },
    bearish: {
      title: "Agricultural Water Allotments Reduced in Central Valley Specialty Farms",
      description: "Strict conservation limits on almond and grape farms lead to projected lower specialty crop export revenues."
    }
  },
  CO: {
    bullish: {
      title: "Colorado Aerospace Clusters Win Massive $8B Orbital Systems Procurement Contract",
      description: "Denver-Boulder defense and space agencies partner with federal labs to construct next-generation satellite arrays."
    },
    bearish: {
      title: "Rocky Mountain Recreational Tourism Revenues Soften After Unseasonably Warm Weather",
      description: "Ski resort operators report lower visitor numbers in late winter, impacting seasonal service tax revenues."
    }
  },
  CT: {
    bullish: {
      title: "Connecticut Submarine and Naval Manufacturing Base Wins Historic Order",
      description: "Defense contractors in Groton secure long-term allocations, initiating heavy technical recruitment for shipyards."
    },
    bearish: {
      title: "Corporate Relocations to Lower-Cost Regions Cool Stamford Financial Sector",
      description: "Several large insurance and hedge fund operators shift back-office workloads out of state, dampening corporate tax bases."
    }
  },
  DE: {
    bullish: {
      title: "Delaware Corporate Registrations Spike 14%, Driving Franchise Tax Surpluses",
      description: "State corporate division records historic levels of new filings, solidifying corporate franchise revenues and financial security."
    },
    bearish: {
      title: "Credit Processing Volume Slowdowns Dampen Delaware Banking Revenues",
      description: "Financial service tax revenues cool as consumer credit transaction volumes decline slightly from high-growth benchmarks."
    }
  },
  FL: {
    bullish: {
      title: "Florida Space Coast Spacecraft Cargo Shipments Jump on Strong Demand",
      description: "Port Canaveral and Orlando hospitality operators record record-breaking quarterly visitor volumes, boosting hotel tax yields."
    },
    bearish: {
      title: "Florida Agricultural Exports Disrupted Due to Severe Weather Warnings",
      description: "Supply chain bottlenecks emerge as major agricultural hubs in Central Florida brace for severe weather, raising near-term cargo logistics and crop yield concerns."
    }
  },
  GA: {
    bullish: {
      title: "Georgia Port Authority Reports Record TEU Cargo Throughput at Savannah Port",
      description: "The Port of Savannah records a 9% year-over-year cargo volume spike, reflecting resilient consumer demand and highlighting the state's strategic logistics position."
    },
    bearish: {
      title: "Southeastern Logistics Delays Impede Georgia Logistics Corridor Delivery Times",
      description: "Interstate freight flows face gridlock due to heavy construction backlogs, raising transport costs for Atl-region hubs."
    }
  },
  HI: {
    bullish: {
      title: "Hawaii Commercial Tourism Spending Hits Record Highs as International Routes Reopen",
      description: "Hotel occupancies and luxury hospitality tax revenues surge, fueling state infrastructure capital investments."
    },
    bearish: {
      title: "Hawaiian Clean Energy Shift Delayed by Undersea Cable Regulatory Impasses",
      description: "Grid modernization efforts on Oahu stall, raising near-term commercial electricity costs for resort operators."
    }
  },
  ID: {
    bullish: {
      title: "Idaho Agricultural Tech Hub Launches $800M Sustainable Food Processing Site",
      description: "Boise metro attracts food science companies, leveraging state potato and dairy surpluses into premium export products."
    },
    bearish: {
      title: "Timber Export Tariffs Slow Down Logging Operations in Northern Idaho Forests",
      description: "International trade disputes reduce lumber demand, causing local mills to trim active production shifts."
    }
  },
  IL: {
    bullish: {
      title: "Illinois Municipal Debt Refinanced with Historic High-Demand Bond Placement",
      description: "Chicago and state treasuries complete a major debt optimization program, lowering interest costs and clearing the path for new public transit capital investments."
    },
    bearish: {
      title: "Chicago Logistics Hub Experiences Rail Container Stagnation",
      description: "Freight congestion at massive intermodal yards slows industrial deliveries, creating headwinds for manufacturing."
    }
  },
  IN: {
    bullish: {
      title: "Indiana EV Battery Plant Starts Construction, Representing $3.5B Capital Inflow",
      description: "State commerce department welcomes high-tech manufacturing, creating thousands of clean energy jobs."
    },
    bearish: {
      title: "Steel Mill Production Decelerates in Gary Due to Lower Heavy-Industrial Orders",
      description: "Primary metal manufacturers adjust output downwards, reflecting soft domestic automotive demand."
    }
  },
  IA: {
    bullish: {
      title: "Iowa Agricultural Yield Forecasts Raised on Favorable Soil Moisture Levels",
      description: "Corn and soybean yields project above historical averages, supporting high farm-state trade balances."
    },
    bearish: {
      title: "Ethanol Production Capacity Constrained by Regulatory Carbon Capture Delays in Iowa",
      description: "Environmental review extensions delay pipeline networks, stalling biofuels export expansions."
    }
  },
  KS: {
    bullish: {
      title: "Kansas Aviation Hub lands Major Defense Contract for Advanced Drone Assembly",
      description: "Wichita aerospace suppliers expand operations, driving job growth in the composite materials sector."
    },
    bearish: {
      title: "Severe Drought Damages Winter Wheat Crops Across Western Kansas Counties",
      description: "Agricultural analysts project substantial yield drawdowns, impacting farm income and crop tax revenues."
    }
  },
  KY: {
    bullish: {
      title: "Kentucky Automotive Production Hits Record Highs on Solid Utility Truck Demand",
      description: "Assembly plants in Louisville run at full capacity, driving local parts manufacturing hiring."
    },
    bearish: {
      title: "High Freight Costs Pinch Bourbon Distilleries' Global Shipping Volumes in Kentucky",
      description: "Premium spirits exports face distribution bottlenecks at ports, slowing barrel-aging inventory turnover."
    }
  },
  LA: {
    bullish: {
      title: "Louisiana Liquefied Natural Gas (LNG) Terminal Wins Permits for $8B Expansion",
      description: "Sovereign growth models show a significant capital influx as major energy ports expand cryogenic storage capacity."
    },
    bearish: {
      title: "Gulf Coast Petrochemical Fabs Face Shutdowns for Mandatory Pipeline Maintenance",
      description: "Chemical manufacturing output in Baton Rouge declines temporarily, lowering quarterly export values."
    }
  },
  ME: {
    bullish: {
      title: "Maine Aquaculture Sector Receives Federal Approval for Clean Salmon Farms",
      description: "Offshore marine science projects expand, establishing Maine as a premium cold-water seafood export base."
    },
    bearish: {
      title: "Paper Pulp Mill Halts Operations in Northern Maine Due to Falling Global Demand",
      description: "Reduced paper and packaging demand forces structural layoffs, impacting forest-product economies."
    }
  },
  MD: {
    bullish: {
      title: "Maryland Cybersecurity and Biotech Sectors Land Massive Government Contracts",
      description: "Fort Meade and Bethesda research institutions draw billions in private capital, boosting professional service taxes."
    },
    bearish: {
      title: "Baltimore Port Cargo Throughput Declines Following Regional Bridge Construction Delays",
      description: "Logistics diversions impact port terminal operations, temporarily lowering commercial shipping tariffs."
    }
  },
  MA: {
    bullish: {
      title: "Boston Biotech Clusters Secure Historic $4.2B Venture Capital Inflow",
      description: "Life science start-ups in Cambridge drive commercial lab demand, supporting high state productivity indexes."
    },
    bearish: {
      title: "Massachusetts Biotech R&D Output Declines Slightly as Venture Deals Cool",
      description: "Life sciences funding contracts in the Cambridge cluster, leading to a temporary slowdown in commercial lab real estate demand."
    }
  },
  MI: {
    bullish: {
      title: "Michigan EV Manufacturing Center Completes Major Capital Tooling Upgrades",
      description: "Leading automotive manufacturers re-open expanded assembly lines, ramping up commercial production of next-gen batteries."
    },
    bearish: {
      title: "Automotive Supply Chain Disruptions Cool Detroit Manufacturing Activity",
      description: "Micro-sensor delivery delays slow assembly line output, leading to temporary manufacturing production decelerations."
    }
  },
  MN: {
    bullish: {
      title: "Minnesota Medical Device Industry Tops Global Market Share Reports",
      description: "Twin Cities medical tech corridor reports unprecedented export demand for advanced pacemakers and surgical equipment."
    },
    bearish: {
      title: "Iron Ore Shipment Volumes Cool Off at Lake Superior Ports in Minnesota",
      description: "Slowing heavy construction demand reduces domestic steel demand, dampening Iron Range mining activities."
    }
  },
  MS: {
    bullish: {
      title: "Mississippi Defense Shipyards Secure $3.8B Navy Vessel Construction Pipeline",
      description: "Shipyards in Pascagoula win multi-year warship orders, expanding advanced technical employment."
    },
    bearish: {
      title: "Agricultural Crop Yields Downgraded in Mississippi Delta Following Spring Floods",
      description: "Heavy rains delay planting windows, lowering cotton and soybean production forecasts."
    }
  },
  MO: {
    bullish: {
      title: "Missouri AgTech Sector Expands with $1.2B Plant Science Research Hub",
      description: "St. Louis research facilities attract global funding, boosting biotech-driven agricultural exports."
    },
    bearish: {
      title: "Automotive Assembly Plant in Kansas City Trims Shifts on Slowing SUV Inventory",
      description: "Leading automaker balances dealer supplies, reducing temporary assembly jobs in the KC area."
    }
  },
  MT: {
    bullish: {
      title: "Montana Tourism Industry Projects Record Summer Season for National Parks",
      description: "Bozeman and Flathead hospitality operators report unprecedented bookings, lifting regional hotel tax revenues."
    },
    bearish: {
      title: "Early Spring Mountain Runoff Reduces Water Reserves for Eastern Montana Ranches",
      description: "Insufficient soil moisture limits forage growth, raising operating costs for livestock producers."
    }
  },
  NE: {
    bullish: {
      title: "Nebraska Agricultural Exports Rise 18% on Heavy Global Beef Demand",
      description: "Omaha-region meatpackers expand refrigeration infrastructure, reaching new international consumer markets."
    },
    bearish: {
      title: "High Irrigation Fuel Costs Squeeze Operating Margins for Nebraska Farmers",
      description: "Rising energy expenses erode agricultural profitability, dampening rural business equipment sales."
    }
  },
  NV: {
    bullish: {
      title: "Nevada Lithium Mining Receives Federal Approval for Massive Extraction Site",
      description: "Thacker Pass project expands development, positioning Nevada as the primary source of domestic battery materials."
    },
    bearish: {
      title: "Nevada Gaming Revenues Dip Slightly as Travel Spending Faces Short-Term Cooling",
      description: "State gaming board reports a minor contraction in leisure spending, slightly lowering tax yields."
    }
  },
  NH: {
    bullish: {
      title: "New Hampshire High-Tech Optics Sector Wins Global Aerospace Contracts",
      description: "Precision engineering companies in Merrimack Valley expand manufacturing of laser guidance equipment."
    },
    bearish: {
      title: "Residential Housing Shortage Restrains Professional Talent Migration to New Hampshire",
      description: "Limited inventory drives up labor costs, causing some technical employers to freeze local hiring."
    }
  },
  NJ: {
    bullish: {
      title: "New Jersey Biotech and Pharmaceutical Hubs Partner with Global Research Pools",
      description: "Major drug developers in Newark and Princeton secure funding for clinical pipelines, lifting local GDP."
    },
    bearish: {
      title: "Congestion Pricing Implementation Near Jersey Ports Slows Freight Trucking",
      description: "New transit tariffs add shipping friction, raising operational costs for regional logistics carriers."
    }
  },
  NM: {
    bullish: {
      title: "New Mexico Space and Defense Research Labs Land $2B Strategic Grant",
      description: "Los Alamos and Sandia national labs expand clean energy research, boosting professional technical services."
    },
    bearish: {
      title: "Oil Production Leases Facing Regulatory Delays in New Mexico Permian Basin",
      description: "Bureau of Land Management extends environmental reviews, capping short-term drilling expansion."
    }
  },
  NY: {
    bullish: {
      title: "Wall Street Transaction Volume Surges, Boosting NY Fiscal Forecast",
      description: "Sovereign growth models show a significant spike in state financial services tax revenue as equity and bond markets experience record quarterly trading volumes."
    },
    bearish: {
      title: "Commercial Office Vacancy Rates Weigh on Manhattan Real Estate Tax Revenues",
      description: "Persistent hybrid work trends lower commercial office valuations, impacting long-term municipal revenue models."
    }
  },
  NC: {
    bullish: {
      title: "North Carolina Financial Services Sector Grows in Charlotte Hub",
      description: "Charlotte-based commercial banks expand hiring, driving domestic growth numbers and sovereign service sector indices."
    },
    bearish: {
      title: "Research Triangle Park Tech Firms Announce Selective Hiring Freezes",
      description: "Software developers trim operational expenditures, slowing down luxury residential starts in Raleigh-Durham."
    }
  },
  ND: {
    bullish: {
      title: "North Dakota Bakken Oil Field Production Reaches Five-Year Output Peaks",
      description: "Sovereign wealth reserves grow as automated drilling tech improves per-well production efficiency."
    },
    bearish: {
      title: "Plunging Natural Gas Export Prices Compress North Dakota Drilling Revenues",
      description: "Regional supply glut lowers extraction royalty payments, reducing state capital project budgets."
    }
  },
  OH: {
    bullish: {
      title: "Ohio Aerospace and Steel Hub Lands $3.2B Clean Steel Mill Project",
      description: "Next-gen electric arc furnace facility breaks ground near Toledo, promising zero-emission industrial output."
    },
    bearish: {
      title: "Ohio Industrial Manufacturing Hub Facing Supply Chain De-Stocking",
      description: "Automotive and aerospace suppliers record temporary inventory drawdowns, leading to minor manufacturing production decelerations in the Rust Belt corridor."
    }
  },
  OK: {
    bullish: {
      title: "Oklahoma Wind Energy Infrastructure Attracts Major Tech Datacenter Grid Contracts",
      description: "Massive wind farms in the panhandle supply green energy directly to next-gen AI server farms, generating local utility tax windfalls."
    },
    bearish: {
      title: "Severe Weather Events Disrupt Pipeline Networks in Cushing, Oklahoma Oil Hub",
      description: "Crude oil storage terminals face operational pauses due to localized power grid damage, stalling trade."
    }
  },
  OR: {
    bullish: {
      title: "Oregon Silicon Forest Tech Clusters Announce $1.8B Microchip Substrate Fab",
      description: "Hillsboro microelectronics suppliers expand advanced manufacturing capacity, boosting international high-tech exports."
    },
    bearish: {
      title: "Pacific Northwest Timber Mill Slowdowns Impede Oregon Forestry Shipments",
      description: "Low domestic homebuilding volumes reduce lumber orders, prompting mills to pause processing shifts."
    }
  },
  PA: {
    bullish: {
      title: "Pennsylvania Healthcare Systems Hub Lands Massive Federal Life-Sciences Grant",
      description: "University research networks in Philadelphia and Pittsburgh expand medical training, driving urban growth."
    },
    bearish: {
      title: "Pennsylvania Steel and Heavy Energy Projects Face Delayed Regulatory Approvals",
      description: "Infrastructure projects in Western PA experience administrative review backlogs, delaying job growth and state treasury investment disbursements."
    }
  },
  RI: {
    bullish: {
      title: "Rhode Island Offshore Wind Power Corridor Completes Deepwater Grid Connection",
      description: "Narragansett Bay wind arrays begin commercial transmission, lowering retail electricity costs for state manufacturers."
    },
    bearish: {
      title: "Rhode Island Marine Tourism and Commercial Harbors Slow Down on Bad Weather",
      description: "Unseasonable summer precipitation drops tourist arrivals in Newport, impacting seasonal hospitality revenues."
    }
  },
  SC: {
    bullish: {
      title: "South Carolina Automotive Port Export Capacity Doubles in Charleston Expansion",
      description: "State port authority opens automated terminal, streamlining international vehicle shipments."
    },
    bearish: {
      title: "Textile and Synthetic Fiber Fabs in Upstate South Carolina Announce Workforce Cuts",
      description: "Global competition and high raw polymer costs force operating cutbacks at regional chemical plants."
    }
  },
  SD: {
    bullish: {
      title: "South Dakota Corporate Financial Services Sector Welcomes Record Asset Influx",
      description: "Favorable trust and regulatory laws attract domestic wealth offices, lifting state banking taxes."
    },
    bearish: {
      title: "Agricultural Dry Spell Hampers South Dakota Grassland Ranching Forage Yields",
      description: "Ranchers face diminished hay volumes, prompting early herd sales and dampening agricultural index forecasts."
    }
  },
  TN: {
    bullish: {
      title: "Tennessee Advanced Manufacturing Hub Lands $4B EV Powertrain Megafactory",
      description: "Spring Hill assembly site expands electric utility vehicle production, drawing automotive suppliers state-wide."
    },
    bearish: {
      title: "Logistical Bottlenecks on Tennessee Waterways Stall Agricultural Barge Shipping",
      description: "Low water levels on key rivers restrict barge freight limits, slowing grain shipping out of Memphis."
    }
  },
  TX: {
    bullish: {
      title: "Texas Allocates $5B Surplus for High-Speed Grid Expansion",
      description: "The Texas Legislature has approved a landmark $5 billion funding package from its sovereign treasury to expand high-voltage transmission lines, fortifying the energy grid and supporting large-scale tech migrations."
    },
    bearish: {
      title: "Texas Refining Capacity Capped Temporarily Following Gulf Coast Plant Incident",
      description: "Major energy complexes in Houston undergo unscheduled maintenance, tightening national product supplies."
    }
  },
  UT: {
    bullish: {
      title: "Utah Silicon Slopes Tech Hub Attracts Global Enterprise Software Inflows",
      description: "Salt Lake Valley tech ecosystem records a major capital influx, expanding office development and technical jobs."
    },
    bearish: {
      title: "Winter Resort Operators in Utah Report Late Snowpack Lowering Ski Pass Bookings",
      description: "Shorter winter season limits hospitality services tax, cooling the local recreation GDP indices."
    }
  },
  VT: {
    bullish: {
      title: "Vermont Green Transit Grid Funded by Historic Clean Energy Bonds",
      description: "State treasury issues green bonds to finance state-wide EV charging corridors and municipal battery sites."
    },
    bearish: {
      title: "Maple Syrup Yields in Vermont Decline Due to Unseasonable Temperature Fluctuations",
      description: "Early sap runs shorten harvesting windows, reducing export crop volumes for specialty food markets."
    }
  },
  VA: {
    bullish: {
      title: "Virginia Data Center Alley Lands $6B Infrastructure Pipeline",
      description: "Loudoun County cloud infrastructure expands, driving high fiber tax revenues and commercial grid upgrades."
    },
    bearish: {
      title: "Defense Procurement Cool-Off Limits Northern Virginia Consulting Outflows",
      description: "Federal budget caps slow down professional service agreements, dampening regional wage growth models."
    }
  },
  WA: {
    bullish: {
      title: "Washington State Aerospace Exports Jump 14% on Commercial Jet Deliveries",
      description: "A sharp increase in wide-body aircraft shipments drives robust international trade numbers for Seattle-region ports, supporting strong sovereign productivity metrics."
    },
    bearish: {
      title: "Tech Sector Software Licensing Income Slows Down in Seattle Tech Hub",
      description: "Cloud computing growth rates level off, reducing corporate tax payments to the state general fund."
    }
  },
  WV: {
    bullish: {
      title: "West Virginia Secures Massive Rare Earth Element Processing Facility",
      description: "Former mining centers pivot to technical mineral extraction, creating high-tech chemical refining positions."
    },
    bearish: {
      title: "Thermal Coal Export Volumes Face Structural Contracting at West Virginia Rail Hubs",
      description: "International shifts to renewable power sources compress mining royalty distributions."
    }
  },
  WI: {
    bullish: {
      title: "Wisconsin Bio-Manufacturing and Dairy Exporters Secure Premium Trade Deals",
      description: "State agricultural products win exclusive supply agreements with international markets, lifting export GDP."
    },
    bearish: {
      title: "Supply Chain Congestion at Wisconsin Casting Foundries Delays Heavy Machinery Shipments",
      description: "Metal fabrication plants face inventory backlogs, slightly slowing industrial production indices."
    }
  },
  WY: {
    bullish: {
      title: "Wyoming Carbon Capture and Sequestration Project Lands $1.5B Federal Grant",
      description: "Major geologic storage hub begins construction, drawing carbon storage engineering teams to the state."
    },
    bearish: {
      title: "Natural Gas Drilling Activity Softens in Wyoming Over Pipeline Capacity Limits",
      description: "Producers reduce active drilling rigs due to high regional shipping tariffs to major consumption hubs."
    }
  }
};
*/

function generateInitialNewsData() {
  return [
    {
      id: 1,
      time: "02:07:16 AM",
      stateId: "MI",
      title: "Pratt Miller Engineering & Fabrication Expands New Hudson, Michigan, Operations",
      description: "Engineering and technology company Pratt Miller Engineering & Fabrication plans to expand its operations in New Hudson, Michigan. The approximately $3 million project is expected to create 50 jobs.",
      sentiment: "Bullish",
      impactScore: 68,
      isPrattMiller: true
    }
  ];
}


let newsData = generateInitialNewsData();
let newsIdCounter = newsData.length + 1;

function formatCurrency(value) {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const BASE_MARKET_STATS = {
  vol24h: 115e12,
  avg7d: 105e12,
  oi: 780e12,
  outstanding: 5.5e9
};

function formatScaledValue(baseValue, proportion, isContracts = false) {
  const val = baseValue * proportion;
  if (isContracts) {
    let stateValStr;
    if (val >= 1e6) stateValStr = `${(val / 1e6).toFixed(1)}M`;
    else if (val >= 1e3) stateValStr = `${(val / 1e3).toFixed(1)}K`;
    else stateValStr = val.toFixed(0);

    let baseValStr = baseValue >= 1e6 ? `${(baseValue / 1e6).toFixed(0)}M` : baseValue.toLocaleString();
    return `${stateValStr} <span style="font-size: 0.6rem; color: var(--text-secondary); font-weight: normal; margin-left: 2px;">(Global: ${baseValStr})</span>`;
  } else {
    let stateValStr;
    if (val >= 1e12) stateValStr = `$${(val / 1e12).toFixed(2)}T`;
    else if (val >= 1e9) stateValStr = `$${(val / 1e9).toFixed(1)}B`;
    else if (val >= 1e6) stateValStr = `$${(val / 1e6).toFixed(1)}M`;
    else stateValStr = `$${val.toLocaleString()}`;

    let baseValStr = baseValue >= 1e12 ? `$${(baseValue / 1e12).toFixed(1)}T` : `$${(baseValue / 1e9).toFixed(0)}B`;
    return `${stateValStr} <span style="font-size: 0.6rem; color: var(--text-secondary); font-weight: normal; margin-left: 2px;">(Global: ${baseValStr})</span>`;
  }
}

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-container">
    <div class="ticker-wrap" style="overflow: hidden; background: rgba(255,255,255,0.03); border-radius: 1.5rem; padding: 0.4rem 0.8rem; margin-bottom: 0.75rem; font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap;">
      <div class="ticker" style="display: inline-block; animation: scroll 30s linear infinite;">
        <span style="margin-right: 2rem;">NY-SGA: 2,450.21 <span style="color: #10b981">+1.2%</span></span>
        <span style="margin-right: 2rem;">TX-SGA: 3,120.45 <span style="color: #10b981">+2.4%</span></span>
        <span style="margin-right: 2rem;">CA-SGA: 4,560.00 <span style="color: #ef4444">-0.5%</span></span>
        <span style="margin-right: 2rem;">FL-SGA: 1,890.12 <span style="color: #10b981">+0.8%</span></span>
        <span style="margin-right: 2rem;">US-SGA-GLOBAL: 12,450.00 <span style="color: var(--accent-gold)">+1.1%</span></span>
        <span style="margin-right: 2rem;">NOWCASTING: Q3 US GDP EXPECTED +2.8%</span>
      </div>
    </div>
    <header>
      <div class="logo">SGA Network</div>
      <nav style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <a href="#map" class="nav-link">Market Map</a>
        <a href="#network" class="nav-link" style="color: var(--accent-gold); font-weight: 700;">🌐 SGA Network</a>
        <a href="#markets" class="nav-link">Markets</a>
        <a href="#table" class="nav-link">Sovereign Index</a>
        <a href="#screener" class="nav-link" style="color: var(--accent-blue); font-weight: 700;">📊 Stock Scanner</a>
        <a href="#ledger" class="nav-link">SGA Ledger</a>
        
        <!-- Exchange Selector -->
        <select id="exchange-select" onchange="window.changeExchange(this.value)" style="padding: 0.4rem 0.8rem; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #fff; border-radius: 0.5rem; font-size: 0.75rem; cursor: pointer; outline: none;">
          <option value="NASDAQ" selected>NASDAQ - USA</option>
          <option value="NYSE">NYSE - USA</option>
          <option value="LSE">LSE - UK</option>
          <option value="XETRA">XETRA - Germany</option>
          <option value="TSE">TSE - Canada</option>
          <option value="HKEX">HKEX - Hong Kong</option>
          <option value="TADAWUL">Tadawul - Saudi Arabia</option>
          <option value="NSE">NSE - India</option>
          <option value="ASX">ASX - Australia</option>
          <option value="SIX">SIX - Switzerland</option>
          <option value="BM">BME - Spain</option>
          <option value="TSE_JP">TSE - Japan</option>
          <option value="SSE">🇨🇳 SSE - Shanghai Stock Exchange</option>
          <option value="SZSE">🇨🇳 SZSE - Shenzhen Stock Exchange</option>
          <option value="MOEX">🇷🇺 MOEX - Moscow Exchange (Russia)</option>

        </select>
        
        <a href="#news" id="header-news-lnk" class="nav-link" style="display: flex; align-items: center; gap: 0.4rem; border: 1px solid rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.05); color: var(--accent-gold); padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 0.5rem; text-decoration: none; margin-left: 1.5rem; height: 32px; box-shadow: 0 0 10px rgba(251, 191, 36, 0.05); transition: all 0.2s ease;">
          <span style="display: inline-block; width: 6px; height: 6px; background: var(--accent-gold); border-radius: 50%; animation: pulse 2s infinite;"></span>
          SGA News <span id="header-news-count" class="news-badge-reg" style="background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); color: var(--accent-gold); padding: 0.05rem 0.25rem; font-size: 0.6rem; border-radius: 3px; font-weight: 700; margin-left: 2px;">50</span>
        </a>
      </nav>
    </header>

    <div id="network-page" class="hidden"></div>
    <div id="wallet-page" class="hidden"></div>

    <div id="dashboard-page">
      <section class="hero">
        <h1>The Future of <span style="color: var(--accent-gold)">State Growth</span></h1>
        <p>Sovereign Growth Assets (SGAs) are next-generation futures contracts and equities instruments tied to real-time economic performance. Trade expectations, hedge macro-risk, and fund public infrastructure automatically</p>
      </section>

    <div class="dashboard-grid" id="map">
      <div class="map-section glass-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding: 0 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button id="btn-back-map" class="map-toggle-btn" style="display: none;" onclick="window.goBackToMap()">← Back</button>
            <h3 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
              <span style="color: var(--accent-blue)">●</span> <span id="map-title">Interactive State Futures Map</span>
            </h3>
          </div>
          <div class="map-toggle" style="display: flex; gap: 1rem;">
            <button id="btn-us-map" class="map-toggle-btn active" style="padding: 0.5rem 1.25rem;" onclick="window.switchMap('us')">US Map</button>
            <button id="btn-world-map" class="map-toggle-btn" style="padding: 0.5rem 1.25rem;" onclick="window.switchMap('world')">World Map</button>
          </div>
        </div>
        <div id="svg-placeholder" class="map-container">
          <!-- SVG will be loaded here -->
        </div>
      </div>

      <div class="details-panel" id="state-details">
        <div class="glass-card">
          <div class="stat-label">Selected State</div>
          <h2 id="selected-state-name" style="font-size: 2rem; margin-bottom: 1rem;">Select a State</h2>
          <div class="stat-item">
            <div class="stat-label">Current Sovereign EOI</div>
            <div class="stat-value eoi-value" id="eoi-value">--</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">SGA Contract Price</div>
            <div class="stat-value" id="contract-price" style="color: var(--accent-blue)">--</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">SGA Share Price</div>
            <div class="stat-value" id="share-price" style="color: var(--accent-blue)">--</div>
          </div>
        </div>

        <div class="glass-card">
          <div class="stat-label">Payout Simulation & Market Exposure ($50 Trillion Injection)</div>
          <div class="split-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
            <div class="split-bar">
              <div class="market-share" id="market-bar"></div>
              <div class="state-share" id="state-bar"></div>
            </div>
            <div class="split-legend" style="display: flex; flex-direction: column; gap: 0.8rem;">
              <!-- Market Notional Activity & Exposure -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <span style="font-size: 0.7rem; color: var(--accent-blue); font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Market Activity</span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">24h Volume: <strong id="market-24h-vol" style="color: #fff; font-family: monospace;">--</strong></span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">7-Day Avg: <strong id="market-7d-avg" style="color: #fff; font-family: monospace;">--</strong></span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <span id="market-exposure-label" style="font-size: 0.7rem; color: var(--accent-blue); font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Market Exposure</span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);"><span id="market-oi-label">Open Interest</span>: <strong id="market-oi" style="color: #fff; font-family: monospace;">--</strong></span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);"><span id="market-outstanding-label">Contracts Out</span>: <strong id="market-outstanding" style="color: #fff; font-family: monospace;">--</strong></span>
                </div>
              </div>
              
              <!-- Government Payouts -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <div class="dot" style="background: #3b82f6; width: 8px; height: 8px; border-radius: 50%;"></div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #3b82f6;">Federal (30%):</span>
                  </div>
                  <strong id="federal-payout" style="color: #3b82f6; font-family: monospace; font-size: 0.85rem;">--</strong>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <div class="dot" style="background: var(--accent-gold); width: 8px; height: 8px; border-radius: 50%;"></div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold);">State (30%):</span>
                  </div>
                  <strong id="public-payout" style="color: var(--accent-gold); font-family: monospace; font-size: 0.85rem;">--</strong>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span style="font-size: 0.65rem; color: var(--text-secondary); margin-left: 0.75rem;">↳ 1.6% Monthly Drawdown Value:</span>
                  <strong id="public-drawdown-payout" style="color: #10b981; font-family: monospace; font-size: 0.85rem;">--</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="stat-label">Economic Pulse</div>
          <div id="mini-stats" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
            <div>
              <div class="stat-label" style="font-size: 0.6rem;">GDP Growth</div>
              <div class="stat-value" id="stat-growth" style="font-size: 1rem;">--</div>
            </div>
            <div>
              <div class="stat-label" style="font-size: 0.6rem;">Employment</div>
              <div class="stat-value" id="stat-employment" style="font-size: 1rem;">--</div>
            </div>
            <div>
              <div class="stat-label" style="font-size: 0.6rem; color: #ef4444;">Inflation (CPI)</div>
              <div class="stat-value" id="stat-inflation" style="font-size: 1rem; color: #ef4444;">--</div>
            </div>
          </div>
        </div>

        <div class="glass-card" id="state-wealth-fund-card">
          <div class="stat-label">Sovereign Wealth & Reinvestment</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Sovereign Value Locked (20%):</span>
              <strong id="stat-sovereign-wealth-pool" style="font-family: monospace; font-size: 0.95rem; color: var(--accent-gold);">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">State Treasury Cash (Paid):</span>
              <strong id="stat-treasury-cash" style="font-family: monospace; font-size: 0.95rem; color: #f59e0b;">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Available Drawdown (1.6%):</span>
              <strong id="stat-monthly-reinvestment" style="font-family: monospace; font-size: 0.95rem; color: #10b981;">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Accumulated Volume:</span>
              <strong id="stat-accumulated-volume" style="font-family: monospace; font-size: 0.95rem; color: var(--accent-blue);">0 contracts</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.2rem;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Investment Inflow Index:</span>
              <strong id="stat-investment-inflow-index" style="font-family: monospace; font-size: 0.95rem; color: #38bdf8;">0.00</strong>
            </div>
            
            <button id="drawdown-btn" class="trade-btn" style="width: 100%; margin-top: 0.5rem; padding: 0.55rem; font-size: 0.75rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2)); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 0.35rem; color: #10b981; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="window.triggerSovereignDrawdown()">
              <span>⚡</span> Draw Down 1.6% Yield
            </button>
          </div>
        </div>
      </div>
    </div>

    <section class="trading-section" id="table" style="margin-top: 4rem;">
      <h3 style="margin-bottom: 2rem;">Real-time Sovereign Index & Trading Terminal</h3>
      <div style="display: grid; grid-template-columns: 1fr 450px; gap: 2rem;">
        
        <div class="table-container" style="overflow-x: auto; max-height: 750px; overflow-y: auto;">
          <table id="state-table">
            <thead style="position: sticky; top: 0; z-index: 5;">
              <tr>
                <th>State</th>
                <th>GDP ($B)</th>
                <th>Growth (%)</th>
                <th>Inflation (%)</th>
                <th id="table-header-eoi">EOI Index</th>
                <th id="table-header-price">SGA Price</th>
                <th>24h Chg</th>
              </tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>

        <div class="trading-terminal glass-card" style="display: flex; flex-direction: column; gap: 0;">
          <!-- Instrument Selector Toggle -->
          <div class="instrument-selector" style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
            <button id="instrument-btn-futures" class="tab-btn active futures-active" onclick="window.setInstrumentType('futures')">FUTURES</button>
            <button id="instrument-btn-stock" class="tab-btn" onclick="window.setInstrumentType('stock')">SHARES</button>
            <button id="instrument-btn-swap" class="tab-btn" onclick="window.setInstrumentType('swap')">SGA SWAPS</button>
          </div>

          <!-- SGA Swaps Pair Selector Bar (shown when instrument is SGA Swaps) -->
          <div id="swap-selector-container" style="display: none; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.25); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: var(--accent-gold); font-weight: 700; text-transform: uppercase;">
              <span>💱 Relative EOI Swap Pair</span>
              <span id="swap-eoi-ratio-display" style="font-family: monospace; color: #fff; background: rgba(251,191,36,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.3);">EOI: -- ÷ --</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: center;">
              <div>
                <label style="display: block; font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 2px;">Base SGA (A)</label>
                <select id="swap-country-a" onchange="window.onSwapCountryChange()" style="width: 100%; padding: 0.4rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 0.35rem; font-size: 0.75rem; font-weight: bold; outline: none; cursor: pointer;"></select>
              </div>

              <button type="button" id="swap-flip-btn" onclick="window.flipSwapPair()" title="Flip Pair Direction (A/B → B/A)" style="margin-top: 12px; padding: 0.45rem 0.65rem; background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(59, 130, 246, 0.2)); border: 1px solid rgba(251, 191, 36, 0.4); color: var(--accent-gold); border-radius: 0.35rem; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease;">
                ⇄
              </button>

              <div>
                <label style="display: block; font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 2px;">Quote SGA (B)</label>
                <select id="swap-country-b" onchange="window.onSwapCountryChange()" style="width: 100%; padding: 0.4rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 0.35rem; font-size: 0.75rem; font-weight: bold; outline: none; cursor: pointer;"></select>
              </div>
            </div>

            <!-- Quick Preset Swap Pair Chips -->
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;" id="swap-preset-chips">
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('us', 'cn')">🇺🇸 USA / 🇨🇳 CN</button>
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('us', 'de')">🇺🇸 USA / 🇩🇪 DE</button>
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('cn', 'jp')">🇨🇳 CN / 🇯🇵 JP</button>
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('de', 'gb')">🇩🇪 DE / 🇬🇧 GB</button>
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('us', 'in')">🇺🇸 USA / 🇮🇳 IN</button>
              <button type="button" class="swap-chip" onclick="window.selectPresetSwap('us', 'br')">🇺🇸 USA / 🇧🇷 BR</button>
            </div>
          </div>

          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <div class="stat-label" id="instrument-type-label">Futures Contract</div>
              <h2 id="trading-state-name" style="margin: 0; font-size: 1.4rem;">Select a State</h2>
            </div>
            <div style="text-align: right;">
              <div class="stat-label" id="terminal-price-label">Mark Price</div>
              <div id="trading-price" class="live-price" style="font-size: 1.5rem; font-weight: bold; color: var(--accent-blue);">--</div>
            </div>
          </div>

          <!-- Contract / Stock Specs Strip -->
          <div class="contract-specs-strip" id="specs-strip-futures" style="">
            <div class="spec-item"><span class="spec-label" id="spec-tick-label">Tick</span><span class="spec-val" id="spec-tick-val">1.00</span></div>
            <div class="spec-item"><span class="spec-label" id="spec-tick-value-label">Tick Val</span><span class="spec-val" id="spec-tick-value-val">$10.00</span></div>
            <div class="spec-item"><span class="spec-label" id="spec-mult-label">Mult</span><span class="spec-val" id="spec-mult-val">10</span></div>
            <div class="spec-item"><span class="spec-label" id="spec-margin-label">Init Margin</span><span class="spec-val" id="spec-margin">--</span></div>
            <div class="spec-item"><span class="spec-label">Expiry</span><span class="spec-val" id="spec-expiry">--</span></div>
          </div>
          <!-- Stock-specific Specs Strip (shown only in stock mode) -->
          <div class="contract-specs-strip" id="specs-strip-stock" style="display:none;">
            <div class="spec-item"><span class="spec-label">Sovereign Class</span><span class="spec-val">Equity</span></div>
            <div class="spec-item"><span class="spec-label">Leverage</span><span class="spec-val">1x (None)</span></div>
            <div class="spec-item"><span class="spec-label">Required Cash</span><span class="spec-val" id="stock-spec-req-cash">$0</span></div>
            <div class="spec-item"><span class="spec-label">Settlement</span><span class="spec-val">Cash</span></div>
          </div>
          <!-- Swap-specific Specs Strip (shown only in swap mode) -->
          <div class="contract-specs-strip" id="specs-strip-swap" style="display:none;">
            <div class="spec-item"><span class="spec-label">Swap Formula</span><span class="spec-val" id="swap-spec-formula">EOI A ÷ EOI B</span></div>
            <div class="spec-item"><span class="spec-label">Tick Size</span><span class="spec-val">0.0001 (1 Pip)</span></div>
            <div class="spec-item"><span class="spec-label">Tick Val</span><span class="spec-val">$1.00</span></div>
            <div class="spec-item"><span class="spec-label">Multiplier</span><span class="spec-val">10,000</span></div>
            <div class="spec-item"><span class="spec-label">Vol Profile</span><span class="spec-val" id="swap-spec-vol">G10 (1 Pip)</span></div>
            <div class="spec-item"><span class="spec-label">Init Margin</span><span class="spec-val" id="swap-spec-margin">10%</span></div>
          </div>


          <!-- Chart Container -->
          <div style="position: relative; margin: 0.75rem 0;">
            <!-- Chart Canvas Container -->
            <div id="trading-chart" style="height: 200px; width: 100%; background: rgba(0,0,0,0.2); border-radius: 0.5rem; position: relative;">
            </div>
            
            <!-- Glassmorphic Chart Toolbar -->
            <div class="chart-toolbar" style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding: 0.35rem 0.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.35rem; font-size: 0.7rem;">
              <div style="display: flex; gap: 0.25rem;">
                <button type="button" class="chart-timeframe-btn active" data-timeframe="10s" onclick="window.setTimeframe('10s')">10s</button>
                <button type="button" class="chart-timeframe-btn" data-timeframe="1m" onclick="window.setTimeframe('1m')">1m</button>
                <button type="button" class="chart-timeframe-btn" data-timeframe="5m" onclick="window.setTimeframe('5m')">5m</button>
                <button type="button" class="chart-timeframe-btn" data-timeframe="15m" onclick="window.setTimeframe('15m')">15m</button>
                <button type="button" class="chart-timeframe-btn" data-timeframe="1H" onclick="window.setTimeframe('1H')">1H</button>
                <button type="button" class="chart-timeframe-btn" data-timeframe="1D" onclick="window.setTimeframe('1D')">1D</button>
              </div>
              
              <!-- Custom styled scroll slider -->
              <input type="range" id="chart-timeline-slider" min="0" max="155" value="0" style="flex: 1; margin: 0 0.75rem; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; -webkit-appearance: none; cursor: pointer;">
              
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button type="button" id="chart-btn-zoom-out" class="chart-tool-btn" title="Zoom Out (Show More)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">−</button>
                <button type="button" id="chart-btn-zoom-in" class="chart-tool-btn" title="Zoom In (Show Fewer)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">＋</button>
                <button type="button" id="chart-btn-live" class="chart-tool-btn" title="Snap to Real-Time Feed" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem; font-weight: bold; display: flex; align-items: center; gap: 2px;"><span style="display:inline-block; width:4px; height:4px; background:#10b981; border-radius:50%;"></span>LIVE</button>
              </div>
            </div>
          </div>

          <!-- Limit Order Book & Depth -->
          <div class="order-book-panel" style="margin: 0.5rem 0; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--glass-border); border-radius: 0.5rem; overflow: hidden; font-family: monospace;">
            <div class="ob-header" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.35rem 0.5rem; font-size: 0.6rem; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 700; text-transform: uppercase;">
              <span>Price ($)</span>
              <span style="text-align: right;">Size (Qty)</span>
              <span style="text-align: right;">Total ($M)</span>
            </div>
            <div id="ob-asks" style="display: flex; flex-direction: column;"></div>
            
            <div class="ob-spread-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; padding: 0.35rem 0.5rem; font-size: 0.8rem; font-weight: bold; background: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.03); align-items: center;">
              <div id="ob-last-price" style="display: flex; align-items: center; gap: 0.4rem;">
                <span id="ob-last-val" style="font-weight: bold;">--</span>
                <span id="ob-direction-arrow"></span>
              </div>
              <div id="ob-spread-val" style="text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-weight: normal;">Spread: --</div>
            </div>
            
            <div id="ob-bids" style="display: flex; flex-direction: column;"></div>
          </div>

          <!-- Order Entry -->
          <div class="order-entry">
            <div class="order-row">
              <div class="order-field">
                <label>Order Type</label>
                <select id="order-type" class="order-input">
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>
              <div class="order-field">
                <label id="order-qty-label">Contracts</label>
                <div class="qty-control">
                  <button class="qty-btn" onclick="adjustQty(-1)">−</button>
                  <input type="text" id="order-qty" value="1" inputmode="numeric">
                  <button class="qty-btn" onclick="adjustQty(1)">+</button>
                </div>
              </div>
              <div class="order-field">
                <label>Payment Currency</label>
                <select id="payment-currency" class="order-input" onchange="updateOrderSummary()">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                  <option value="CHF">CHF</option>
                  <option value="CNY">CNY</option>
                  <option value="SAR">SAR</option>
                  <option value="RUB">RUB</option>
                </select>
              </div>
              <div class="order-field" id="limit-price-field" style="display: none;">
                <label>Price</label>
                <input type="number" id="limit-price" class="order-input" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="order-summary" style="display: flex; flex-direction: column; gap: 0.35rem; border-top: 1px solid var(--glass-border); padding: 0.5rem 0;">
              <div style="display: flex; justify-content: space-between; width: 100%;">
                <span>Notional Value:</span>
                <strong id="order-notional">--</strong>
              </div>
              <div style="display: flex; justify-content: space-between; width: 100%;">
                <span id="order-margin-label">Required Margin (10%):</span>
                <strong id="order-margin">--</strong>
              </div>
              <div style="display: flex; flex-direction: column; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.35rem; gap: 0.25rem;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                  <span id="order-fee-label">Exchange Fee ($0.50/Contract):</span>
                  <strong id="order-fee" style="color: #10b981;">$0.00 (Free &lt; $25k)</strong>
                </div>
                <div id="order-fee-split" style="font-size: 0.55rem; color: var(--text-secondary); display: none; flex-direction: column; width: 100%; font-family: monospace; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 0.15rem; gap: 0.1rem; text-align: left;">
                  <span id="fee-split-mm">↳ Rebate to MM (34%): $0.00</span>
                  <span id="fee-split-llc">↳ Royalty to SGA LLC (33%): $0.00</span>
                  <span id="fee-split-state">↳ Sovereign Yield (33%): $0.00</span>
                </div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">
              <button class="trade-btn buy-btn" onclick="executeTrade('buy')">
                <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">LONG</span>
                BUY
              </button>
              <button class="trade-btn sell-btn" onclick="executeTrade('sell')">
                <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>
                SELL
              </button>
            </div>
            
            <!-- Live Trade Feed -->
            <div class="live-feed-panel" style="padding: 0.35rem 0.5rem; background: rgba(0, 0, 0, 0.2); border-radius: 0.4rem; border: 1px solid rgba(255,255,255,0.03);">
              <div style="display: flex; justify-content: space-between; font-size: 0.55rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold; margin-bottom: 0.2rem;">
                <span>Live Feed</span>
                <span style="color: var(--accent-gold);">● Trillion-$ Pool</span>
              </div>
              <div id="live-trades-list" style="display: flex; flex-direction: column; gap: 0.15rem; font-family: monospace; font-size: 0.65rem; height: 38px; overflow: hidden; justify-content: center;">
                <div style="color: var(--text-secondary); text-align: center;">Awaiting market activity...</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Open Positions Panel -->
      <div class="positions-panel glass-card" style="margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <span style="display: inline-block; width: 8px; height: 8px; background: var(--accent-blue); border-radius: 50%; animation: pulse 2s infinite;"></span>
            Open Positions
            <span class="position-badge" id="position-count">0</span>
          </h4>
          <div style="display: flex; align-items: center; gap: 2rem;">
            <div>
              <span class="stat-label" style="margin: 0; font-size: 0.6rem;">UNREALIZED P&L</span>
              <div id="total-pnl" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">$0.00</div>
            </div>
            <div>
              <span class="stat-label" style="margin: 0; font-size: 0.6rem;">TOTAL MARGIN</span>
              <div id="total-margin" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">$0.00</div>
            </div>
          </div>
        </div>
        <div class="table-container" style="max-height: 220px; overflow-y: auto;">
          <table id="positions-table">
            <thead style="position: sticky; top: 0; z-index: 5;">
              <tr>
                <th>Asset</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>P&L</th>
                <th>Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="positions-body">
              <tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No open positions. Place a trade to begin.</td></tr>
            </tbody>
          </table>
        </div>
    </section>

    <!-- ═══════════════════════════════════════════════════ -->
    <!-- IPO SIMULATION PANEL                                 -->
    <!-- ═══════════════════════════════════════════════════ -->
    <section class="ipo-simulation-panel glass-card" style="margin-top: 2rem; padding: 1.5rem;" id="ipo-simulation-section">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem;">
        <h4 style="display:flex;align-items:center;gap:0.5rem;margin:0;font-size:1.1rem;font-weight:700;color:#fff;">
          <span style="display:inline-block;width:8px;height:8px;background:var(--accent-gold);border-radius:50%;animation:pulse 2s infinite;"></span>
          📈 IPO Simulation — SGA Stock Shares
          <span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:var(--accent-gold);margin-left:4px;">100B SHARES / STATE</span>
        </h4>
        <div style="display:flex;gap:0.5rem;">
          <button class="ipo-global-btn ipo-global-btn-run" onclick="window.runAllIPOs()" title="Run all 50 pending state IPOs in sequence">
            🚀 Run All IPOs
          </button>
          <button class="ipo-global-btn ipo-global-btn-reset" onclick="window.resetAllIPOs()" title="Reset all IPOs to pending">
            ↺ Reset
          </button>
        </div>
      </div>

      <!-- Two-column layout: selected state card + log -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem;">
        <!-- Selected State IPO Card -->
        <div id="ipo-selected-card" class="ipo-card">
          <div style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;font-size:0.8rem;">Select a state from the map to view its IPO details.</div>
        </div>

        <!-- Capital Injection / Progress Log -->
        <div class="ipo-log-container">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);text-transform:uppercase;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;">📡 Live IPO Event Log</div>
          <div id="ipo-log-panel" class="ipo-log-panel">
            <div class="ipo-log-entry" style="color:rgba(255,255,255,0.3);">Awaiting IPO simulation launch...</div>
          </div>
        </div>
      </div>

      <!-- All States IPO Table -->
      <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);text-transform:uppercase;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;">All State IPO Status</div>
      <div class="table-container" style="max-height:360px;overflow-y:auto;">
        <table class="ipo-states-table">
          <thead style="position:sticky;top:0;z-index:5;">
            <tr>
              <th>State</th>
              <th>Price Target</th>
              <th>Market Cap</th>
              <th>Underwriter</th>
              <th>Current Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="ipo-states-table-body">
            <tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">Loading IPO data...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TRADE HISTORY TAB -->
    <section class="trade-history-section glass-card" style="margin-top: 2rem; padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff;">
          <span style="display: inline-block; width: 8px; height: 8px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span>
          Trade History
          <span class="position-badge" id="history-count" style="background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.3);">0</span>
        </h4>
        <div style="display: flex; align-items: center; gap: 2rem;">
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">TOTAL REALIZED P&L</span>
            <div id="history-total-pnl" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary); font-family: monospace;">$0.00</div>
          </div>
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">TOTAL FEES PAID</span>
            <div id="history-total-fees" style="font-weight: 700; font-size: 1.1rem; color: var(--accent-gold); font-family: monospace;">$0.00</div>
          </div>
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">WIN RATE</span>
            <div id="history-win-rate" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary); font-family: monospace;">—</div>
          </div>
        </div>
      </div>

      <!-- Summary Cards Row -->
      <div id="history-summary-cards" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.6rem; margin-bottom: 1rem;">
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Total Volume</span>
          <span id="history-total-volume" style="font-weight: 700; color: #fff; font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
        <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #10b981; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Best Trade</span>
          <span id="history-best-trade" style="font-weight: 700; color: #10b981; font-family: monospace; font-size: 0.85rem;">—</span>
        </div>
        <div style="background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #ef4444; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Worst Trade</span>
          <span id="history-worst-trade" style="font-weight: 700; color: #ef4444; font-family: monospace; font-size: 0.85rem;">—</span>
        </div>
        <div style="background: rgba(56,189,248,0.05); border: 1px solid rgba(56,189,248,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #38bdf8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Federal Fees</span>
          <span id="history-fed-fees" style="font-weight: 700; color: #38bdf8; font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
        <div style="background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: var(--accent-gold); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Exchange Fees</span>
          <span id="history-exch-fees" style="font-weight: 700; color: var(--accent-gold); font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
      </div>

      <div class="table-container" style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.03); border-radius: 0.4rem;">
        <table id="trade-history-table" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="position: sticky; top: 0; background: #0c0f16; z-index: 5; border-bottom: 1px solid var(--glass-border);">
            <tr>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Time</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Asset</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Side</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Qty</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Entry</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Exit</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Notional</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">P&L</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">RoM%</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Fees</th>
            </tr>
          </thead>
          <tbody id="trade-history-body">
            <tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">No closed trades yet. Open and close a position to see your history.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- REAL-TIME TRANSACTION LEDGER & CLEARING HOUSE REVENUE TRACKER -->
    <section class="trading-ledger-section glass-card" style="margin-top: 2rem; padding: 1.5rem;">
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;">
        
        <!-- Left: Live Transactions Log -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff;">
              <span style="display: inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%; animation: pulse 1.5s infinite;"></span>
              Transaction Ledger
            </h4>
            
            <div style="display: flex; gap: 0.25rem; background: rgba(0,0,0,0.25); padding: 0.2rem; border-radius: 0.35rem; border: 1px solid rgba(255,255,255,0.05);">
              <button id="tx-filter-all" class="tab-btn active" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 0.25rem; background: rgba(251, 191, 36, 0.15); color: var(--accent-gold); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onclick="setTxFilter('all')">All Activity</button>
              <button id="tx-filter-user" class="tab-btn" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; border: 1px solid transparent; border-radius: 0.25rem; background: transparent; color: var(--text-secondary); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onclick="setTxFilter('user')">My Trades Only</button>
            </div>
          </div>
          
          <div class="table-container" style="max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.03); border-radius: 0.4rem;">
            <table id="transactions-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead style="position: sticky; top: 0; background: #0c0f16; z-index: 5; border-bottom: 1px solid var(--glass-border);">
                <tr>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Timestamp</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Asset</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Party</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Side</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Qty</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Price</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Notional</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Clearing Fee</th>
                </tr>
              </thead>
              <tbody id="transactions-body">
                <tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">Awaiting clearing house transactions...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Right: Real-time Clearing House Fee Revenue Tracker -->
        <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.9rem;">
          <h4 style="margin: 0; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent-gold); display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
            <svg style="width: 15px; height: 15px; fill: var(--accent-gold);" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            Clearing Revenue
          </h4>
          
          <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.6rem;">
            <div id="revenue-total" style="font-size: 2rem; font-weight: 800; color: #fff; text-shadow: 0 0 15px rgba(16, 185, 129, 0.25); font-family: monospace; letter-spacing: -0.02em;">$0.00</div>
          </div>
          
          <div style="font-size: 0.55rem; color: var(--text-secondary); text-align: center; margin-top: 0.1rem; font-style: italic; line-height: 1.3;">
            Tracks institutional LOB blocks & user fills in real time under CFTC 40.2 protocols.
          </div>
        </div>
        
      </div>
    </section>

    <section class="formula-section glass-card" style="margin-top: 4rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem;">
        <div>
          <h3 style="color: var(--accent-gold); margin-bottom: 1rem;">The EOI Formula</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The Sovereign Economic Output Index is a composite metric of a nation's macroeconomic health:</p>
          <div style="background: rgba(0,0,0,0.25); padding: 2rem 2.5rem; border-radius: 0.75rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.5rem; font-family: system-ui, sans-serif;">Economic Output Index (EOI)</div>

            <div style="font-family: 'Georgia', 'Times New Roman', serif; font-size: 1rem; color: #e2e8f0; line-height: 2.4; overflow-x: auto;">
              <div style="white-space: nowrap;">
                EOI &nbsp;= &nbsp;( a · GDP &nbsp;+&nbsp; b · GDP growth rate &nbsp;+&nbsp; c · Tax Revenue
              </div>
              <div style="white-space: nowrap; padding-left: 4.5rem;">
                + &nbsp;d · Employment Rate &nbsp;+&nbsp; e · Business Formation Rate &nbsp;+&nbsp; f · Investment Inflow
              </div>
              <div style="white-space: nowrap; padding-left: 4.5rem;">
                + &nbsp;g · Productivity Rate &nbsp;) &nbsp;× &nbsp;<span style="color: #ef4444; font-family: system-ui, sans-serif; font-size: 0.9rem;">(1 − 0.05 · max(0, CPI − 2.0%))</span>
              </div>
            </div>

            <div style="margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.07); font-family: system-ui, sans-serif;">
              <div style="color: var(--accent-gold); font-size: 0.85rem; font-weight: 700; margin-bottom: 0.6rem;">
                SGA Futures Contract Price = EOI × $2,000.00
              </div>
              <div style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.7;">
                <span style="color: #ef4444;">Inflation Factor</span> = 1 − (0.05 × max(0, State CPI − 2.0%)) · <span style="opacity: 0.7;">At or below 2% = no penalty. Each 1% above = 5% EOI haircut.</span>
              </div>
            </div>

            <div style="font-family: system-ui, sans-serif; font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem 1rem; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 1rem; margin-top: 1.25rem; line-height: 1.5;">
              <div><strong style="color: var(--accent-blue)">GDP:</strong> Gross Domestic Product (a = 0.25)</div>
              <div><strong style="color: var(--accent-blue)">Growth:</strong> GDP Growth Rate (b = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Tax:</strong> Tax Revenue (c = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Employment:</strong> Employment Rate (d = 0.15)</div>
              <div><strong style="color: var(--accent-blue)">Business:</strong> Business Formation Rate (e = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Investment:</strong> Investment Inflow (f = 0.15)</div>
              <div><strong style="color: var(--accent-blue)">Productivity:</strong> Productivity Rate (g = 0.15)</div>
              <div><strong style="color: #ef4444">Inflation:</strong> CPI Deflator (h = 0.05)</div>
            </div>
          </div>

          
          <div style="margin-top: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 0.5rem; font-family: system-ui, sans-serif;">
            <h4 style="color: #fff; margin: 0 0 1rem 0; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent-gold);">Weight & Metric Explanation</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 1.25rem 0; line-height: 1.4;">
              Here is how each of the seven key economic factors and the inflation deflator contribute to the Sovereign Economic Index:
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              
              <!-- GDP -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-gold); font-size: 0.85rem; display: block; margin-bottom: 2px;">Gross Domestic Product (GDP)</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures the total size and value of all goods and services produced. It represents the foundational anchor of a state's economic power.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-gold); font-family: monospace; font-size: 1rem; background: rgba(251, 191, 36, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(251, 191, 36, 0.2); min-width: 55px; text-align: center;">25%</div>
              </div>

              <!-- Employment -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Employment Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures job security and labor market participation. High employment fuels household income and consumer spending.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Investment -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Investment Inflow</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks outside capital flowing into regional industries, demonstrating global investor trust and powering business growth.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Productivity -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Productivity Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures economic efficiency per capita. High productivity is a sign of technological innovation and skilled workforces.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Growth -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">GDP Growth Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures how fast the economy is expanding. It captures short-term economic momentum and expansionary velocity.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

              <!-- Tax -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">Tax Revenue</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks fiscal collection, representing a state's funding capacity for public infrastructure and developmental yield.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

              <!-- Business -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">Business Formation Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks the launch rate of new businesses, representing entrepreneurial dynamism and future growth potential.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

            </div>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1rem;">Weights are determined by independent economic committees to ensure stability and accuracy.</p>
        </div>
        <div>
          <h3 style="color: var(--accent-blue); margin-bottom: 1rem;">Sovereign Benefit Rule</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Unlike traditional futures, SGAs mandate a public yield. Every contract settlement is automatically split:</p>
          <ul style="color: var(--text-secondary); list-style: none; display: flex; flex-direction: column; gap: 0.75rem;">
            <li><strong style="color: #fff">80% Market Volume:</strong> High-liquidity environment for open market trading.</li>
            <li><strong style="color: #fff">20% Sovereign Yield:</strong> Automatic reinvestment into the state’s economic and social infrastructure.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- SGA LEDGER SECTION -->
    <section class="ledger-section" id="ledger" style="margin-top: 4rem; overflow: visible;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h3>SGA Ledger</h3>
        <div style="display: flex; gap: 1rem;">
          <button id="reset-ledger-btn" class="trade-btn sell-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem;">Reset Ledger</button>
          <button id="verify-ledger-btn" class="trade-btn" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; font-size: 0.8rem;">Verify Integrity</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 360px 1fr; gap: 2rem; align-items: start;">
        <!-- Entry Form -->
        <div class="glass-card ledger-form-container">
          
          <!-- Auditing Section -->
          <div class="audit-section" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <h4 style="color: var(--accent-blue); font-size: 0.85rem; font-weight: 700; margin: 0 0 0.75rem 0; text-transform: uppercase; letter-spacing: 0.05em;">🔍 Audit Information</h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">AUDITING FIRM</label>
                <input type="text" id="audit-firm" placeholder="e.g. Deloitte & Touche LLP" style="font-size: 0.8rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; color: var(--text-primary); width: 100%;">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">AUDIT DATE</label>
                  <input type="date" id="audit-date" style="font-size: 0.8rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; color: var(--text-primary); width: 100%;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">STATUS</label>
                  <select id="audit-status" style="font-size: 0.8rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; color: var(--text-primary); width: 100%;">
                    <option value="">— No Audit —</option>
                    <option value="Pending">⏳ Pending Review</option>
                    <option value="Passed">✓ Passed</option>
                    <option value="Qualified">⚠ Qualified Opinion</option>
                    <option value="Failed">✗ Failed</option>
                  </select>
                </div>
              </div>
              <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">REPORT URL (OPTIONAL)</label>
                <input type="url" id="audit-report-url" placeholder="https://..." style="font-size: 0.8rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; color: var(--text-primary); width: 100%;">
              </div>
            </div>
          </div>

          <div class="allocations-header">
            <h4 style="color: var(--accent-gold); font-size: 1.15rem; font-weight: 700; margin: 0;">Create New SGA Entry</h4>
            <button type="button" id="add-split-btn" class="add-split-btn">
              <span>+</span> Add Split
            </button>
          </div>
          <form id="ledger-form">
            <div id="allocations-container" class="allocations-scroll-container">
              <!-- Dynamically populated splits go here -->
            </div>
            
            <div class="splits-summary-box">
              <span class="sum-label">Total Volume</span>
              <span class="sum-value" id="splits-total-amount">$0</span>
            </div>

            <!-- Media & Documentation Section -->
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem; margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                <span style="font-size: 0.62rem; color: var(--accent-blue); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">📎 Media &amp; Documentation</span>
                <button type="button" id="add-media-btn" class="add-split-btn" style="font-size: 0.6rem; padding: 0.2rem 0.5rem;">+ Add URL</button>
              </div>
              <div id="media-urls-container" style="display: flex; flex-direction: column; gap: 0.35rem;"></div>
              <div style="font-size: 0.52rem; color: var(--text-secondary); margin-top: 0.25rem; font-style: italic;">Supports YouTube/Vimeo, images (.jpg/.png), PDFs, or any document URL.</div>
            </div>

            <!-- Audit added post-entry via record panel -->

            <button type="submit" class="trade-btn buy-btn" style="width: 100%;">Record to Ledger</button>
          </form>
        </div>

        <!-- Ledger View & Filters -->
        <div class="ledger-view-container" style="display: flex; flex-direction: column; overflow: visible; background: var(--panel-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: 1.25rem; padding: 1.5rem;">
          <div class="ledger-filters" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <div class="filter-group">
              <label>Category</label>
              <select id="filter-category"><option value="All">All Categories</option></select>
            </div>
            <div class="filter-group">
              <label>Region</label>
              <select id="filter-region"><option value="All">All Regions</option></select>
            </div>
            <div class="filter-group">
              <label>Agency</label>
              <input type="text" id="filter-agency" placeholder="Search Agency...">
            </div>
            <div class="filter-group">
              <label>From Date</label>
              <input type="date" id="filter-start">
            </div>
            <div class="filter-group">
              <label>To Date</label>
              <input type="date" id="filter-end">
            </div>
          </div>

          <div class="table-container" style="flex: 1; overflow-y: auto; max-height: 80vh; overflow-x: hidden;">
            <table id="ledger-table">
              <thead style="position: sticky; top: 0; z-index: 5;">
                <tr>
                  <th>Date</th>
                  <th style="text-align: center;">Region</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Agency</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th style="text-align: center;">Audit</th>
                  <th style="text-align: right;">Record ID</th>
                </tr>
              </thead>
              <tbody id="ledger-body">
                <!-- populated by JS -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>

    <!-- PROFESSIONAL INSTITUTIONAL FOOTER -->
    <footer style="margin-top: 5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(8, 12, 20, 0.85); backdrop-filter: blur(16px); padding: 3rem 2rem 2rem; border-radius: 1.25rem 1.25rem 0 0;">
      <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 3rem; margin-bottom: 2.5rem;">
        
        <!-- Column 1: Brand & Overview -->
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, var(--accent-gold) 0%, #d97706 100%); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem; color: #000; box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);">
              S
            </div>
            <span style="font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; color: #fff;">SGA Network</span>
          </div>
          <p style="font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); margin: 0; max-width: 380px;">
            Institutional sovereign growth assets, automated clearing house mechanics, and real-time macroeconomic execution infrastructure.
          </p>
        </div>

        <!-- Column 2: Platform -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fff;">Platform</div>
          <a href="#map" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">Market Map</a>
          <a href="#network" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">SGA Network</a>
          <a href="#markets" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">Live Markets</a>
          <a href="#table" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">Sovereign Index</a>
          <a href="#screener" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">Stock Scanner</a>
        </div>

        <!-- Column 3: Economics & Analytics -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fff;">Economics</div>
          <a href="#ledger" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">SGA Ledger</a>
          <a href="#news" style="font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">Macro Intelligence</a>
        </div>

      </div>

      <!-- Bottom Strip -->
      <div style="max-width: 1280px; margin: 0 auto; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.75rem; color: var(--text-secondary);">
        <div>
          © 2026 SGA Network Protocol. All rights reserved. Sovereign Clearing &amp; Settlement Architecture.
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <span style="color: rgba(255, 255, 255, 0.3);">|</span>
          <span style="color: var(--text-secondary);">Institutional Gateway</span>
        </div>
      </div>
    </footer>
    </div> <!-- end of dashboard-page -->

    <!-- Governance Modal (Institutional Banking Compliance Engine) -->
    <div class="modal" id="governance-modal" onclick="window.toggleGovernanceModal(false)">
        <div class="modal-card bank-window" onclick="event.stopPropagation()">
            <div class="bank-titlebar">
                <div class="bank-titlebar-left">
                    <span class="bank-icon">🛡️</span>
                    <div>
                        <div class="bank-titlebar-text">SGA Network Clearing & Settlement Governance</div>
                        <div class="bank-titlebar-sub">INSTITUTIONAL RISK MANAGEMENT & COMPLIANCE ENGINE • VER 4.8</div>
                    </div>
                </div>
                <button class="bank-close-btn" type="button" onclick="window.toggleGovernanceModal(false)">✕</button>
            </div>
            <div class="modal-body bank-window-body">
                <div class="bank-status-strip">
                    <span>● SGA SETTLEMENT LEDGER: <strong>ACTIVE</strong></span>
                    <span>T+0 CLEARING ENFORCEMENT</span>
                    <span>AUTHORIZATION LEVEL: <strong>ADMIN (LEVEL 4)</strong></span>
                </div>

                <div class="gov-grid">
                    <!-- Left: Enforcement Form -->
                    <div class="gov-box bank-panel">
                        <div class="gov-box-title bank-panel-title">⚖️ ISSUE COMPLIANCE ENFORCEMENT</div>

                        <div class="gov-form-group" id="gov-user-id-group">
                            <label class="gov-label bank-label">TARGET SGA USER ID</label>
                            <input type="text" class="gov-input bank-input" id="gov-target-user-id" value="SGA-USR-9042" placeholder="e.g. SGA-USR-8812" oninput="window.handleUserInputChanges()">
                        </div>

                        <div class="gov-form-group" id="gov-user-name-group">
                            <label class="gov-label bank-label">TARGET ACCOUNT / INSTITUTION NAME</label>
                            <input type="text" class="gov-input bank-input" id="gov-target-user-name" value="Hamza (Primary Trader)" placeholder="e.g. Quantum Arbitrage Fund" oninput="window.handleUserInputChanges()">
                        </div>

                        <div class="gov-form-group" id="gov-test-profiles-group">
                            <label class="gov-label bank-label">🧪 QUICK TEST PROFILES</label>
                            <div class="test-profiles-list" id="test-profiles-list"></div>
                        </div>

                        <div class="gov-form-group">
                            <label class="gov-label bank-label">TARGET EXCHANGE VENUE</label>
                            <select class="gov-select bank-select" id="gov-target-exchange-select">
                                <option value="ALL">ALL EXCHANGES (Global Action)</option>
                                <option value="NASDAQ">NASDAQ (USA)</option>
                                <option value="NYSE">NYSE (USA)</option>
                                <option value="LSE">LSE (UK)</option>
                                <option value="XETRA">XETRA (Germany)</option>
                                <option value="TSE">TSE (Canada)</option>
                                <option value="HKEX">HKEX (Hong Kong)</option>
                                <option value="TADAWUL">Tadawul (Saudi Arabia)</option>
                                <option value="NSE">NSE (India)</option>
                                <option value="ASX">ASX (Australia)</option>
                                <option value="SIX">SIX (Switzerland)</option>
                                <option value="BM">BME (Spain)</option>
                                <option value="TSE_JP">TSE (Japan)</option>
                                <option value="SSE">SSE - Shanghai (China)</option>
                                <option value="SZSE">SZSE - Shenzhen (China)</option>
                                <option value="MOEX">MOEX - Moscow (Russia)</option>

                            </select>
                        </div>

                        <div class="gov-form-group">
                            <label class="gov-label bank-label">TARGET BROKERAGE</label>
                            <select class="gov-select bank-select" id="gov-target-brokerage-select">
                                <option value="">-- Select Brokerage (Optional) --</option>
                                <option value="Federal Reserve System">Federal Reserve System</option>
                                <option value="JP Morgan Clearing Corp">JP Morgan Clearing Corp</option>
                                <option value="Self-Clearing">Self-Clearing</option>
                                <option value="Morgan Stanley Clearing">Morgan Stanley Clearing</option>
                                <option value="Goldman Sachs Clearing">Goldman Sachs Clearing</option>
                                <option value="Citigroup Clearing">Citigroup Clearing</option>
                                <option value="Bank of America Clearing">Bank of America Clearing</option>
                                <option value="Webull">Webull</option>
                                <option value="Robinhood">Robinhood</option>
                                <option value="Public">Public</option>
                                <option value="Fidelity">Fidelity</option>
                                <option value="Interactive Brokers">Interactive Brokers</option>
                                <option value="Charles Schwab">Charles Schwab</option>
                                <option value="TD Ameritrade">TD Ameritrade</option>
                                <option value="E*TRADE">E*TRADE</option>
                            </select>
                        </div>

                        <div class="gov-form-group">
                            <label class="gov-label bank-label">ENFORCEMENT TYPE</label>
                            <select class="gov-select bank-select" id="gov-enforcement-type" onchange="window.toggleDurationField(this.value)">
                                <option value="exchange_ban" selected> Ban Exchange (Network-Wide)</option>
                                <option value="exchange_temp"> Suspend Exchange (Network-Wide)</option>
                                <option value="brokerage_ban"> Ban Brokerage (Network-Wide)</option>
                                <option value="brokerage_temp"> Suspend Brokerage (Network-Wide)</option>
                                <option value="temp"> Temporary User Suspension</option>
                                <option value="permanent"> Permanent User Ban</option>
                                <option value="lift"> Lift Ban / Reinstate Venue</option>
                                <option value="remove"> Remove Exchange from Registry</option>
                            </select>
                        </div>

                        <div class="gov-form-group" id="gov-duration-group" style="display:none;">
                            <label class="gov-label bank-label">SUSPENSION DURATION</label>
                            <select class="gov-select bank-select" id="gov-suspension-duration">
                                <option value="1">1 Hour</option>
                                <option value="24" selected>24 Hours</option>
                                <option value="168">7 Days</option>
                                <option value="720">30 Days</option>
                            </select>
                        </div>

                        <div class="gov-form-group">
                            <label class="gov-label bank-label">VIOLATION CODE & REASON</label>
                            <select class="gov-select bank-select" id="gov-violation-reason">
                                <option value="Regulatory Non-Compliance & Order Breach">Regulatory Non-Compliance</option>
                                <option value="Clearing Reserve Insolvency & Liquidity Default">Clearing Reserve Insolvency</option>
                                <option value="Illegal Arbitrage (Cross-Market Latency Abuse)">Illegal Arbitrage</option>
                                <option value="Wash Trading / Spoofing / Manipulation">Wash Trading / Spoofing</option>
                                <option value="KYC / AML Non-Compliance">KYC / AML Non-Compliance</option>
                                <option value="Sovereign Mandate & Sanction Compliance">Sovereign Mandate Disruption</option>
                            </select>
                        </div>

                        <button class="gov-action-btn bank-btn bank-btn-danger" id="gov-apply-btn" type="button" style="background:#dc2626;" onclick="window.applyGovernanceAction()">Ban Exchange Network-Wide</button>
                        <div id="gov-toast-feedback" class="bank-toast" style="display:none; margin-top:6px; padding:8px; border-radius:6px; font-size:11px; font-weight:600; text-align:center;"></div>
                    </div>

                    <!-- Right: Matrix -->
                    <div class="gov-box bank-panel">
                        <div class="gov-box-title bank-panel-title">📋 EXCHANGE RESTRICTION MATRIX</div>
                        <div style="font-size:10px; color:#64748b; margin-bottom:8px; font-family: 'JetBrains Mono', Consolas, monospace;">
                            Active User: <strong id="modal-active-user-label" style="color:#0f172a;">SGA-USR-9042</strong>
                        </div>
                        <div class="bank-table-container" style="max-height: 250px; overflow-y: auto;">
                            <table class="matrix-table bank-table">
                                <thead><tr><th>Exchange Venue</th><th>Compliance Status</th><th>Details</th></tr></thead>
                                <tbody id="gov-matrix-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Brokerage Matrix -->
                    <div class="gov-box bank-panel" style="margin-top: 12px;">
                        <div class="gov-box-title bank-panel-title">🏦 BROKERAGE RESTRICTION MATRIX</div>
                        <div style="font-size:10px; color:#64748b; margin-bottom:8px; font-family: 'JetBrains Mono', Consolas, monospace;">
                            Network-Wide Brokerage Status
                        </div>
                        <div class="bank-table-container" style="max-height: 200px; overflow-y: auto;">
                            <table class="matrix-table bank-table">
                                <thead><tr><th>Brokerage</th><th>Compliance Status</th><th>Details</th></tr></thead>
                                <tbody id="gov-brokerage-matrix-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal-highlight bank-infobar" style="margin-top: 12px;">
                    <span style="font-size:14px; margin-right:4px;">🔒</span> <strong>SGA Clearing Ledger Protocol:</strong> Executing a governance action signs and broadcasts a cryptographic compliance instruction across the SGA clearing network, enforcing immediate order rejection.
                </div>
            </div>
        </div>
    </div>

    <!-- DEDICATED FULL-SCREEN NEWS TERMINAL PAGE -->
    <div id="news-page" class="hidden" style="margin-top: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--accent-gold); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; background: var(--accent-gold); border-radius: 50%; animation: pulse 2s infinite;"></span>
            Live Intelligence Datastream
          </div>
          <h2 style="font-size: 2rem; margin: 0; color: #fff; font-weight: 800;">Sovereign Growth News Terminal</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; border-radius: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Active Monitors: <strong style="color: #fff">50 States</strong></span>
          <span style="color: var(--glass-border)">|</span>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Last Update: <strong id="news-last-tick" style="color: var(--accent-blue)">Just Now</strong></span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;">
        <!-- Left Column: News List & Filters -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Filters Card -->
          <div class="glass-card news-filters" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <div class="filter-group" style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Search Intelligence</label>
              <input type="text" id="news-search-main" placeholder="Search headline, summary or region..." style="width: 100%; padding: 0.5rem 0.75rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; transition: border-color 0.2s;">
            </div>
            <div class="filter-group" style="width: 150px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Region</label>
              <select id="news-filter-state-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All States</option>
              </select>
            </div>
            <div class="filter-group" style="width: 120px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Sentiment</label>
              <select id="news-filter-sentiment-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All Sentiments</option>
                <option value="Bullish">Bullish</option>
                <option value="Bearish">Bearish</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>
            <div class="filter-group" style="width: 130px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Impact</label>
              <select id="news-filter-impact-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All Severity</option>
                <option value="High">High Severity (>50)</option>
                <option value="Med">Medium Severity (20-50)</option>
                <option value="Low">Low Severity (<20)</option>
              </select>
            </div>
            <div class="filter-group" style="width: 140px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Source</label>
              <select id="news-filter-source-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All Sources</option>
                <option value="Business Wire">Business Wire</option>
                <option value="external">State Sources</option>
                <option value="internal">SGA Internal</option>
              </select>
            </div>
            <button id="business-wire-quick-btn" onclick="filterBusinessWireOnly()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; height: 36px; margin-top: auto;">
              Business Wire Only
            </button>
          </div>
          
          <!-- Feed list container -->
          <div id="news-feed-main" style="display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; max-height: 800px; padding-right: 0.5rem;"></div>
        </div>
        
        <!-- Right Column: Analytics Sidebar -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Sentiment Monitor Card -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-blue);">●</span> Macro Sentiment Monitor
            </h4>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                <span>Bullish Index Catalyst</span>
                <span id="sentiment-bullish-pct" style="color: #10b981; font-weight: 700;">--</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; display: flex;">
                <div id="sentiment-bar-bullish" style="height: 100%; background: #10b981; width: 0%; transition: width 0.4s ease;"></div>
                <div id="sentiment-bar-neutral" style="height: 100%; background: #94a3b8; width: 0%; transition: width 0.4s ease;"></div>
                <div id="sentiment-bar-bearish" style="height: 100%; background: #ef4444; width: 0%; transition: width 0.4s ease;"></div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 0.65rem; color: var(--text-secondary); text-align: center; margin-top: 0.25rem;">
                <div>
                  <div style="color: #10b981; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-bullish">--</div>
                  <span>Bullish</span>
                </div>
                <div>
                  <div style="color: #94a3b8; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-neutral">--</div>
                  <span>Neutral</span>
                </div>
                <div>
                  <div style="color: #ef4444; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-bearish">--</div>
                  <span>Bearish</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Hot Contracts (Shocks) Card -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-gold);">●</span> High Impact Shocks
            </h4>
            <div id="hot-shocks-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <!-- Rendered dynamically -->
            </div>
          </div>
          
          <!-- State Sentiment Matrix -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-blue);">●</span> State Sentiment Matrix
            </h4>
            <div id="state-news-matrix" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; text-align: center; font-family: monospace; font-size: 0.65rem;">
              <!-- 50 mini state pills with green/red indicator dots based on their latest news sentiment! -->
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- DEDICATED FULL-SCREEN ARTICLE VIEW PAGE -->
    <div id="article-page" class="hidden" style="margin-top: 2rem;"></div>

        <!-- DEDICATED FULL-SCREEN MARKETS PAGE -->
    <div id="markets-page" class="hidden" style="margin-top: 1rem;">

    <!-- Markets Page Tab Bar -->
    <div class="markets-tab-bar" style="margin-bottom: 1.5rem;">
        <button class="markets-tab-btn active" id="tab-btn-trading" onclick="window.switchMarketsTab('trading')">
            📈 Live Trading & Assets
        </button>
        <button class="markets-tab-btn" id="tab-btn-screener" onclick="window.switchMarketsTab('screener')">
            🇨🇳 China Stock Market Screener
        </button>
    </div>

    <!-- MARKETS TRADING VIEW -->
    <div id="markets-trading-view">
    
    <!-- Markets Page Header -->
    <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--glass-border);">
        <button onclick="window.toggleGovernanceModal(true)" style="padding: 0.5rem 1rem; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: var(--accent-gold); border-radius: 0.5rem; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
            🛡️ Compliance
        </button>
    </div>

    <!-- Markets Main Content -->
    <main class="main-grid">

        <!-- Left Area -->
        <div>
            <!-- Stock Info -->
            <div class="stock-header">
                <div class="stock-title-row">
                    <span class="stock-symbol" id="stock-symbol">AAPL</span>
                    <span class="stock-name" id="stock-name">Apple Inc.</span>
                    <span class="exchange-tag" id="stock-exchange-tag">NASDAQ (USA)</span>
                    <span id="active-exchange-flag" style="font-size:18px;">🇺🇸</span>
                </div>
                <div class="stock-price" id="stock-price">$310.45</div>
                <div class="stock-change-row">
                    <span class="stock-change" id="stock-change">+$1.10 (+0.36%) Today</span>
                    <span class="stock-change-sub" id="stock-price-converted">≈ $310.45 USD</span>
                </div>
            </div>

            <!-- Chart -->
            <div class="chart-area" id="chart-svg-container"></div>
            <div class="timeframe-bar">
                <button class="time-tab active" onclick="switchTimeframe('1D', this)">1D</button>
                <button class="time-tab" onclick="switchTimeframe('1W', this)">1W</button>
                <button class="time-tab" onclick="switchTimeframe('1M', this)">1M</button>
                <button class="time-tab" onclick="switchTimeframe('3M', this)">3M</button>
                <button class="time-tab" onclick="switchTimeframe('YTD', this)">YTD</button>
                <button class="time-tab" onclick="switchTimeframe('1Y', this)">1Y</button>
                <button class="time-tab" onclick="switchTimeframe('ALL', this)">ALL</button>
            </div>

            <!-- About -->
            <h2 class="section-title">About</h2>
            <p class="about-text">Apple, Inc. engages in the design, manufacture, and sale of smartphones, personal computers, tablets, wearables and accessories, and other varieties of related services.</p>
            <div class="metrics-grid">
                <div class="metric-box"><span class="metric-label">CEO</span><span class="metric-value">Timothy Donald Cook</span></div>
                <div class="metric-box"><span class="metric-label">Employees</span><span class="metric-value">161,000</span></div>
                <div class="metric-box"><span class="metric-label">Headquarters</span><span class="metric-value">Cupertino, CA</span></div>
                <div class="metric-box"><span class="metric-label">Founded</span><span class="metric-value">1976</span></div>
            </div>

            <!-- Key Stats -->
            <h2 class="section-title">Key Statistics</h2>
            <div class="metrics-grid">
                <div class="metric-box"><span class="metric-label">Market Cap</span><span class="metric-value">$2.84T</span></div>
                <div class="metric-box"><span class="metric-label">P/E Ratio</span><span class="metric-value">28.52</span></div>
                <div class="metric-box"><span class="metric-label">52W High</span><span class="metric-value">$199.62</span></div>
                <div class="metric-box"><span class="metric-label">52W Low</span><span class="metric-value">$164.08</span></div>
                <div class="metric-box"><span class="metric-label">Volume</span><span class="metric-value">52.48M</span></div>
                <div class="metric-box"><span class="metric-label">Avg Volume</span><span class="metric-value">58.21M</span></div>
                <div class="metric-box"><span class="metric-label">Dividend Yield</span><span class="metric-value">0.55%</span></div>
                <div class="metric-box"><span class="metric-label">Open Price</span><span class="metric-value">$318.50</span></div>
            </div>

            <!-- Bond Marketplace -->
            <div class="bonds-section" id="bonds-marketplace">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h2 class="section-title" style="margin:0; border:none; padding:0;">📜 Fixed Income & Bond Marketplace</h2>
                </div>
                <div class="bonds-subtitle">Apple Corporate Notes, Exchange Sovereign Debt & Local Municipal Bonds</div>
                <div class="bonds-category-tabs">
                    <button class="bond-cat-btn active" onclick="filterBondsCategory('all')">All Bonds</button>
                    <button class="bond-cat-btn" onclick="filterBondsCategory('aapl')">🍏 Apple Debt</button>
                    <button class="bond-cat-btn" onclick="filterBondsCategory('muni')">🏛️ Municipal</button>
                    <button class="bond-cat-btn" onclick="filterBondsCategory('sovereign')">👑 Sovereign</button>
                    <button class="bond-cat-btn" onclick="filterBondsCategory('corp')">🏢 Corporate</button>
                </div>
                <div class="bonds-grid" id="bonds-grid-container"></div>
            </div>

            <!-- Trades Table -->
            <div class="recent-trades">
                <div class="trades-header">📊 Live Network Settlement Activity</div>
                <table class="trades-table">
                    <thead><tr><th>Time</th><th>Routing</th><th>Side</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
                    <tbody id="recent-trades-body"></tbody>
                </table>
            </div>

            <!-- Top Gainers -->
            <div class="top-gainers-section">
                <div class="gainers-header">
                    <span>📈 Top Gainers</span>
                    <span class="gainers-subtitle" id="gainers-exchange-label">NASDAQ</span>
                </div>
                <div class="gainers-list" id="top-gainers-list"></div>
            </div>
        </div>

        <!-- Right Trading Panel -->
        <div class="trading-panel">
            <div class="trade-card">

                <!-- Compliance Banner -->
                <div class="user-compliance-banner" id="user-compliance-banner" style="display: none;">
                    <div class="banner-alert-title">
                        <span>⛔ EXCHANGE TRADING SUSPENDED</span>
                        <span class="restriction-badge" id="restriction-type-badge">Temp Suspension</span>
                    </div>
                    <div class="banner-alert-msg" id="restriction-reason-msg">Restricted</div>
                    <div class="banner-alert-timer" id="restriction-timer-msg">⏳ Active</div>
                </div>

                <!-- Asset Mode -->
                <div class="asset-mode-selector">
                    <button class="asset-mode-btn active" id="mode-stock-btn" onclick="switchAssetMode('stock')">📈 Stock (AAPL)</button>
                    <button class="asset-mode-btn" id="mode-bond-btn" onclick="switchAssetMode('bonds')">📜 Fixed Income</button>
                </div>

                <!-- Bond Banner -->
                <div class="bond-selected-banner" id="bond-selected-banner" style="display: none;">
                    <div style="font-size:11px; font-weight:700; color:#166534;" id="banner-bond-name">Bond</div>
                    <span class="bond-badge badge-aapl" id="banner-bond-badge">Apple Inc.</span>
                    <div style="font-size:9.5px; color:#15803d; margin-top:2px;" id="banner-bond-sub">Details</div>
                    <div id="banner-bond-ratings" style="display:flex; gap:3px; margin-top:3px;"></div>
                </div>

                <!-- Bond Dropdown -->
                <div class="trade-field" id="bond-selector-field" style="display: none;">
                    <span class="field-label">Select Bond Instrument</span>
                    <select class="currency-select" id="bond-instrument-select" onchange="selectBondFromDropdown(this.value)"></select>
                </div>

                <!-- Buy/Sell Tabs -->
                <div class="trade-tabs">
                    <button class="trade-tab active-buy" id="tab-buy" onclick="switchTab('buy')">Buy AAPL</button>
                    <button class="trade-tab" id="tab-sell" onclick="switchTab('sell')">Sell AAPL</button>
                </div>

                <!-- Currency -->
                <div class="trade-field">
                    <span class="field-label">Payment Currency</span>
                    <select class="currency-select" id="payment-currency" onchange="setCurrency(this.value)">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="JPY">JPY</option>
                        <option value="CAD">CAD</option>
                        <option value="AUD">AUD</option>
                        <option value="CHF">CHF</option>
                        <option value="CNY">CNY</option>
                        <option value="SAR">SAR</option>
                        <option value="HKD">HKD</option>
                        <option value="INR">INR</option>
                        <option value="RUB">RUB</option>
                    </select>
                </div>

                <!-- Amount -->
                <div class="trade-field">
                    <span class="field-label" id="input-label">Investment Amount</span>
                    <div class="amount-input-wrap">
                        <span class="amount-prefix" id="input-prefix">$</span>
                        <input type="text" class="amount-input" id="trade-amount" value="1,000.00" oninput="handleInput(this)" onblur="formatInput(this)">
                        <span class="input-suffix" id="input-suffix">USD</span>
                    </div>
                    <button class="toggle-method-btn" id="toggle-method-btn" onclick="toggleOrderMethod()">Switch to Shares</button>
                </div>

                <!-- Fee Breakdown -->
                <div class="fee-section">
                    <div class="fee-row">
                        <span id="estimated-result-label">Est. Shares</span>
                        <span id="fee-shares-qty">0</span>
                    </div>
                    <div class="fee-row">
                        <span>Converted Valuation</span>
                        <span id="fee-converted-valuation">$1,000.00 USD</span>
                    </div>
                    <div class="fee-row">
                        <span>FX Fee</span>
                        <span id="fee-conversion-charge">$0.00</span>
                    </div>
                    <div class="fee-row">
                        <span>GX Fee</span>
                        <span id="fee-settlement-charge">$0.00</span>
                    </div>
                    <div class="fee-row total" id="total-row">
                        <span id="total-cost-label">Total Debit</span>
                        <span id="fee-total-cost">$1,000.50 USD</span>
                    </div>
                </div>

                <!-- Execute Button -->
                <button class="review-btn" id="action-btn" onclick="executeMarketTrade()">Buy Order</button>

                <!-- Buying Power -->
                <div class="buying-power-row">
                    <span>Your Holdings</span>
                    <span id="user-shares-holding">154.2850 Shares</span>
                </div>
                <div class="buying-power-row">
                    <span>Bond Holdings (Par)</span>
                    <span id="user-bonds-holding">$0.00 Par</span>
                </div>

                <div class="account-type" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-top:10px; font-size:11px; font-weight:600; color:#0f172a; cursor:pointer;">
                    <span class="account-label">SGA Reserves - Sovereign Access</span>
                    <span class="account-value">▼</span>
                </div>

                <button class="trade-options-btn" style="width:100%; border:1px solid #0f172a; background:transparent; color:#0f172a; font-size:12px; font-weight:700; border-radius:18px; padding:10px; cursor:pointer; margin-top:10px; transition:background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">Trade Options</button>
                <button class="add-to-lists-btn" style="width:100%; border:1px solid #cbd5e1; background:transparent; color:#475569; font-size:12px; font-weight:600; border-radius:18px; padding:8px; cursor:pointer; margin-top:6px; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">+ Add to Watchlist</button>

                <!-- SGA Network Stats -->
                <div class="network-stats">
                    <div class="stat-box">
                        <div class="stat-label">FX Rate</div>
                        <div class="stat-value" id="fx-rate">1.00 USD</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Clearing</div>
                        <div class="stat-value">T+0</div>
                    </div>
                </div>

                <!-- Ledger -->
                <div class="network-ledger">
                    <div class="ledger-title">🏦 SGA Network Reserves</div>
                    <div id="ledger-rows-container"></div>
                </div>

                <div class="settlement-info">⚡ Atomic Settlement • Cross-Border FX Routing • SGA Reserves Active</div>
            </div>
        </div>
    </main>
    </div> <!-- /#markets-trading-view -->

    <!-- MARKETS SCREENER VIEW -->
    <div id="markets-screener-view" class="hidden">
        <!-- Breadth Banner -->
        <div class="screener-breadth-banner">
            <div class="breadth-card">
                <div class="breadth-card-title">MARKET BREADTH (CHINA)</div>
                <div class="breadth-card-value neutral" id="screener-breadth-pct">0% Gainers</div>
                <div class="breadth-card-sub" id="screener-breadth-counts">0 Up · 0 Down</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">TOTAL LISTED STOCKS</div>
                <div class="breadth-card-value" id="screener-total-count" style="color: #60a5fa;">150</div>
                <div class="breadth-card-sub">SSE (Shanghai) + SZSE (Shenzhen)</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">COMBINED MARKET CAP</div>
                <div class="breadth-card-value" style="color: #fbbf24;">¥38.5 Trillion</div>
                <div class="breadth-card-sub">A-Shares Capitalization</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">TOP SECTOR PERFORMER</div>
                <div class="breadth-card-value gain" id="screener-top-sector">Consumer Staples</div>
                <div class="breadth-card-sub" id="screener-top-sector-gain">+2.45% Average</div>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="screener-filter-bar">
            <div class="screener-filter-group">
                <input type="text" id="screener-search-input" placeholder="🔍 Search stock symbol, name, or ticker..." oninput="window.renderScreener()">
            </div>
            
            <div class="screener-filter-group">
                <select id="screener-exchange-select" class="gov-select" style="min-width: 160px;" onchange="window.changeScreenerExchange(this.value)">
                    <option value="ALL">🇨🇳 All China (SSE + SZSE)</option>
                    <option value="SSE">🇨🇳 SSE - Shanghai Stock Exchange</option>
                    <option value="SZSE">🇨🇳 SZSE - Shenzhen Stock Exchange</option>
                </select>
            </div>

            <div class="screener-filter-group">
                <select id="screener-sector-select" class="gov-select" style="min-width: 160px;" onchange="window.renderScreener()">
                    <option value="ALL">All Sectors</option>
                    <option value="Technology">Technology & Chips</option>
                    <option value="Financials">Financials & Banking</option>
                    <option value="Consumer Staples">Consumer Staples & Spirits</option>
                    <option value="Consumer Discretionary">Consumer Auto & Appliances</option>
                    <option value="Industrials">Industrials & Defense</option>
                    <option value="Healthcare">Healthcare & Biotech</option>
                    <option value="Energy">Energy & Oil</option>
                    <option value="Materials">Materials & Mining</option>
                    <option value="Utilities">Utilities & Power</option>
                    <option value="Communication">Communication Services</option>
                    <option value="Real Estate">Real Estate & Construction</option>
                </select>
            </div>

            <div class="screener-quick-filters">
                <button class="screener-pill active" id="pill-filter-all" onclick="window.setScreenerQuickFilter('ALL')">All Stocks</button>
                <button class="screener-pill" id="pill-filter-gainers" onclick="window.setScreenerQuickFilter('GAINERS')">🚀 Top Gainers</button>
                <button class="screener-pill" id="pill-filter-losers" onclick="window.setScreenerQuickFilter('LOSERS')">🔻 Top Decliners</button>
                <button class="screener-pill" id="pill-filter-active" onclick="window.setScreenerQuickFilter('ACTIVE')">🔥 Most Active</button>
                <button class="screener-pill" id="pill-filter-lowpe" onclick="window.setScreenerQuickFilter('LOWPE')">💎 Value (P/E &lt; 12)</button>
            </div>
        </div>

        <!-- Screener Table Card -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 0.85rem; overflow: hidden; backdrop-filter: blur(12px);">
            <!-- Meta Row -->
            <div class="screener-meta-row">
                <div>
                    Showing <span class="screener-stock-count" id="screener-meta-count">0</span> stocks matching criteria
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Sort by:</span>
                    <select id="screener-sort-select" class="gov-select" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" onchange="window.sortScreenerBy(this.value)">
                        <option value="marketCap">Market Cap (Highest)</option>
                        <option value="changePercent">Price Change (%)</option>
                        <option value="volume">Trading Volume</option>
                        <option value="peRatio">P/E Ratio</option>
                        <option value="symbol">Ticker Code</option>
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div class="screener-table-wrapper">
                <table class="screener-table">
                    <thead>
                        <tr>
                            <th onclick="window.sortScreenerBy('symbol')">Symbol / Company <span class="sort-icon" id="sort-icon-symbol">↕</span></th>
                            <th onclick="window.sortScreenerBy('sector')">Sector <span class="sort-icon" id="sort-icon-sector">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('price')">Price (CNY) <span class="sort-icon" id="sort-icon-price">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('changePercent')">Change (%) <span class="sort-icon" id="sort-icon-changePercent">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('marketCap')">Market Cap <span class="sort-icon" id="sort-icon-marketCap">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('volume')">Volume <span class="sort-icon" id="sort-icon-volume">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('peRatio')">P/E Ratio <span class="sort-icon" id="sort-icon-peRatio">↕</span></th>
                            <th class="num-col">52W Range</th>
                            <!-- <th style="text-align: center;">Action</th> -->
                        </tr>
                    </thead>
                    <tbody id="screener-tbody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div class="screener-pagination">
                <div id="screener-page-info">Page 1 of 1</div>
                <div class="screener-page-btns">
                    <button class="screener-page-btn" id="screener-prev-btn" onclick="window.changeScreenerPage(-1)">← Previous</button>
                    <button class="screener-page-btn" id="screener-next-btn" onclick="window.changeScreenerPage(1)">Next →</button>
                </div>
            </div>
        </div>
    </div>
    </div> <!-- /#markets-page -->

    <!-- DEDICATED FULL-SCREEN STOCK SCANNER PAGE (SGA + GLOBAL EXCHANGE GX) -->
    <div id="scanner-page" class="hidden screener-section" style="margin-top: 1.5rem;">
        <div class="scanner-page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--glass-border);">
            <div>
                <h2 id="scanner-header-title" style="color: var(--accent-blue); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.6rem; font-size: 1.7rem; font-weight: 800;">
                    <span id="scanner-header-dot" style="display: inline-block; width: 10px; height: 10px; background: var(--accent-blue); border-radius: 50%; box-shadow: 0 0 10px var(--accent-blue); animation: pulse 2s infinite;"></span>
                    <span id="scanner-header-text">SGA Stock Market Scanner</span>
                </h2>
                <p id="scanner-header-subtitle" style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">Real-time market data with advanced metrics including RVOL, Delta, and institutional flow analysis</p>
            </div>

            <!-- Scanner Mode Switcher (SGA vs Global Exchange GX) -->
            <div class="scanner-mode-switch-wrapper" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <div class="scanner-mode-toggle-group" style="display: flex; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 2rem; padding: 3px; backdrop-filter: blur(10px); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <button type="button" id="scanner-mode-sga-btn" class="scanner-mode-tab-btn active" onclick="window.switchScannerMode('sga')">
                        <span class="mode-icon">🏛️</span>
                        <span>SGA Scanner</span>
                        <span class="mode-tag tag-sga">Sovereign</span>
                    </button>
                    <button type="button" id="scanner-mode-gx-btn" class="scanner-mode-tab-btn" onclick="window.switchScannerMode('gx')">
                        <span class="mode-icon">🌐</span>
                        <span>Global Exchange (GX)</span>
                        <span class="mode-tag tag-gx">World Stocks</span>
                    </button>
                </div>

                <!-- 1-Click Toggle Switch -->
                <div class="scanner-toggle-switch-box" onclick="window.toggleScannerModeQuick()" title="Click to toggle between SGA and Global Exchange">
                    <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Mode:</span>
                    <div class="scanner-toggle-track" id="scanner-toggle-track">
                        <div class="scanner-toggle-thumb" id="scanner-toggle-thumb"></div>
                    </div>
                    <span id="scanner-toggle-indicator" style="font-size: 0.75rem; font-weight: 700; color: #38bdf8;">SGA</span>
                </div>
            </div>
        </div>

        <!-- SGA Screener Section (Completely Separate) -->
        <div id="screener-container" class="screener-section">
            <!-- SGA Screener content will be loaded here -->
        </div>

        <!-- Global Exchange (GX) Screener Section (Completely Separate) -->
        <div id="gx-screener-container" class="screener-section hidden">
            <!-- GX Screener content will be loaded here -->
        </div>
    </div>

    <!-- SGA Guidelines Modal -->
    <div class="modal" id="guidelines-modal" onclick="toggleModal(false)">
        <div class="modal-card" onclick="event.stopPropagation()">
            <button class="modal-close" onclick="toggleModal(false)">✕</button>
            <h2 class="modal-title" style="color:#0f172a;">🌐 SGA Network Trading Guidelines</h2>
            <div class="modal-body">
                <p>The <strong>SGA Network</strong> facilitates direct multi-currency trading of equities and bonds without requiring USD as a manual intermediary clearing channel.</p>
                <div class="modal-highlight">
                    <strong>Atomic T+0 Settlement:</strong> Trades settle instantly against corresponding localized liquidity reserves, bypassing delayed wire clearings.
                </div>
                <p><strong>Liquidity Rules:</strong> Swapping between sovereign currencies incurs a standard transaction charge of 10 basis points (0.10%). A flat $0.50 settlement fee covers ledger clearance.</p>
                <p>By selecting a payment currency, the interface dynamically quotes, calculates FX fees, and routes the trade directly via optimal settlement tranches.</p>
            </div>
        </div>
    <!-- Dedicated Top Gainers Modal -->
    <div class="modal" id="gainers-modal" onclick="toggleGainersModal(false)">
        <div class="modal-card" style="max-width: 820px;" onclick="event.stopPropagation()">
            <button class="modal-close" onclick="toggleGainersModal(false)">✕</button>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:12px;">
                <h2 class="modal-title" style="margin:0; color:#0f172a; display:flex; align-items:center; gap:8px;">
                    📈 Global & Exchange Top Gainers Directory
                </h2>
                <span id="gainers-modal-flag" style="font-size:22px;">🌐</span>
            </div>

            <!-- Filter controls -->
            <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                <div style="flex:1; min-width:200px;">
                    <input type="text" class="gov-input" id="gainers-search-input" placeholder="🔍 Search stock symbol or name..." oninput="renderGainersModal()">
                </div>
                <select class="gov-select" id="gainers-exchange-filter" style="width:220px;" onchange="renderGainersModal()">
                    <option value="CURRENT" selected>🎯 Current Exchange Stocks</option>
                    <option value="ALL">🌐 All Exchanges (Global Top Gainers)</option>
                    <option value="NASDAQ">🇺🇸 NASDAQ (USA)</option>
                    <option value="NYSE">🇺🇸 NYSE (USA)</option>
                    <option value="LSE">🇬🇧 LSE (UK)</option>
                    <option value="XETRA">🇩🇪 XETRA (Germany)</option>
                    <option value="TSE">🇨🇦 TSE (Canada)</option>
                    <option value="HKEX">🇭🇰 HKEX (Hong Kong)</option>
                    <option value="TADAWUL">🇸🇦 Tadawul (Saudi Arabia)</option>
                    <option value="NSE">🇮🇳 NSE (India)</option>
                    <option value="ASX">🇦🇺 ASX (Australia)</option>
                    <option value="SIX">🇨🇭 SIX (Switzerland)</option>
                    <option value="BM">🇪🇸 BME (Spain)</option>
                    <option value="TSE_JP">🇯🇵 TSE (Japan)</option>
                    <option value="SSE">🇨🇳 SSE (Shanghai)</option>
                    <option value="SZSE">🇨🇳 SZSE (Shenzhen)</option>
                    <option value="MOEX">🇷🇺 MOEX (Russia)</option>

                </select>
            </div>

            <div style="max-height: 420px; overflow-y: auto;">
                <table class="matrix-table" style="font-size:12px;">
                    <thead>
                        <tr>
                            <th style="padding:8px;">Exchange</th>
                            <th style="padding:8px;">Ticker / Company</th>
                            <th style="padding:8px;">Price (Local)</th>
                            <th style="padding:8px;">USD Valuation</th>
                            <th style="padding:8px;">24h Gain</th>
                            <!-- <th style="padding:8px; text-align:right;">Action</th> -->
                        </tr>
                    </thead>
                    <tbody id="gainers-modal-tbody">
                        <!-- Rendered dynamically by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>


    </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Record Detail Slide-Over Panel -->
  <div id="record-panel-overlay" class="record-panel-overlay">
    <div id="record-panel" class="record-panel">
      <!-- Panel Header -->
      <div class="record-panel-header">
        <div>
          <div id="rp-header-badge" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.4rem;"></div>
          <div id="rp-header-title" style="font-size:1.05rem;font-weight:700;color:#fff;"></div>
          <div id="rp-header-meta" style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.2rem;"></div>
        </div>
        <button id="close-record-panel-btn" class="close-modal-btn" style="flex-shrink:0;">&#x2715;</button>
      </div>

      <!-- Tab Nav -->
      <div class="record-panel-tabs" id="rp-tabs">
        <button class="rp-tab active" data-tab="overview">Overview</button>
        <button class="rp-tab" data-tab="timeline">Timeline</button>
        <button class="rp-tab" data-tab="milestones">Milestones</button>
        <button class="rp-tab" data-tab="contractor">Contractor Payments</button>
        <button class="rp-tab" data-tab="changeorders">Change Orders</button>
        <button class="rp-tab" data-tab="valuation">Asset Valuation</button>
        <button class="rp-tab" data-tab="media">Media</button>
        <button class="rp-tab" data-tab="audit">Audit Report</button>
      </div>

      <!-- Tab Content -->
      <div class="record-panel-body" id="record-panel-body">
        <!-- Populated dynamically -->
      </div>
    </div>
  </div>

  <!-- Floating Corner News Alert Container -->
  <div id="news-flash-container" class="news-flash-alert"></div>
`;

async function switchMap(mapType) {
  currentMapType = mapType;
  
  // Update button states
  document.getElementById('btn-us-map').classList.toggle('active', mapType === 'us');
  document.getElementById('btn-world-map').classList.toggle('active', mapType === 'world');
  
  // Update title
  const mapTitle = document.getElementById('map-title');
  mapTitle.textContent = mapType === 'us' ? 'Interactive State Futures Map' : 'Interactive World Futures Map';
  
  // Update data
  currentMapData = mapType === 'us' ? statesData : worldData;
  
  // Load appropriate SVG
  const svgUrl = mapType === 'us' ? '/src/us.svg' : '/src/world.svg';
  const response = await fetch(svgUrl);
  const svgText = await response.text();
  document.getElementById('svg-placeholder').innerHTML = svgText;
  
  const svg = document.querySelector('svg');
  svg.removeAttribute('style');
  
  // Get tooltip element
  const tooltip = document.querySelector('.map-tooltip');
  if (!tooltip) {
    const newTooltip = document.createElement('div');
    newTooltip.className = 'map-tooltip';
    document.body.appendChild(newTooltip);
  }
  
  // Get min/max EOI for color mapping
  const calculateEOI = mapType === 'us' ? window.calculateEOI : window.calculateWorldEOI;
  const eois = currentMapData.map(s => calculateEOI(s));
  const minEoi = Math.min(...eois);
  const maxEoi = Math.max(...eois);
  
  // Add state-path class to all paths and setup interactions
  const paths = svg.querySelectorAll('path');
  
  paths.forEach(path => {
    path.classList.add('state-path');
    const entityId = path.id;
    const entity = currentMapData.find(s => s.id === entityId);
    
    if (entity) {
      const eoi = calculateEOI(entity);
      
      // Calculate color based on EOI (heatmap from dark blue to cyan)
      const ratio = (eoi - minEoi) / (maxEoi - minEoi);
      const hue = 220 - (ratio * 40); // 220 (blue) to 180 (cyan)
      const lightness = 25 + (ratio * 35); // 25% to 60%
      path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;
      
      path.addEventListener('click', () => {
        selectState(entity, path);
      });

      path.addEventListener('dblclick', () => {
        drillDownToCountry(entity);
      });
      
      // Tooltip logic
      path.addEventListener('mousemove', (e) => {
        const tooltipEl = document.querySelector('.map-tooltip');
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = e.pageX + 15 + 'px';
        tooltipEl.style.top = e.pageY + 15 + 'px';
        tooltipEl.innerHTML = `<strong>${entity.name}</strong><div style="display:flex; justify-content:space-between; width:120px;"><span>EOI Score:</span> <span style="color:var(--accent-gold); font-weight:bold">${eoi}</span></div><div style="display:flex; justify-content:space-between; width:120px;"><span>GDP Growth:</span> <span>${entity.growth}%</span></div>`;
      });
      
      path.addEventListener('mouseleave', () => {
        const tooltipEl = document.querySelector('.map-tooltip');
        tooltipEl.style.opacity = '0';
      });
    }
  });
  
  // Update details panel label
  const detailsLabel = document.querySelector('#state-details .stat-label');
  if (detailsLabel) {
    detailsLabel.textContent = mapType === 'us' ? 'Selected State' : 'Selected Country';
  }
  
  // Select first entity by default
  const firstEntity = currentMapData[0];
  const firstPath = document.getElementById(firstEntity.id);
  if (firstEntity && firstPath) {
    selectState(firstEntity, firstPath);
  }
}

async function drillDownToCountry(country) {
  // Check if subdivision data exists for this country
  const subdivisionData = getSubdivisionData(country.id);
  
  if (!subdivisionData) {
    alert(`Subdivision data for ${country.name} is not yet available.`);
    return;
  }

  // Store previous map type and show back button
  previousMapType = currentMapType;
  document.getElementById('btn-back-map').style.display = 'block';

  // Update map title
  const mapTitle = document.getElementById('map-title');
  mapTitle.textContent = `${country.name} - Interactive Regional Futures Map`;

  // Load subdivision SVG
  const svgUrl = `/src/subdivisions/${country.id.toLowerCase()}.svg`;
  
  try {
    const response = await fetch(svgUrl);
    const svgText = await response.text();
    document.getElementById('svg-placeholder').innerHTML = svgText;
    
    const svg = document.querySelector('svg');
    svg.removeAttribute('style');
    
    // Get min/max EOI for color mapping
    const eois = subdivisionData.map(s => s.eoi);
    const minEoi = Math.min(...eois);
    const maxEoi = Math.max(...eois);
    
    // Add state-path class to all paths and setup interactions
    const paths = svg.querySelectorAll('path');
    
    paths.forEach(path => {
      path.classList.add('state-path');
      const entityId = path.id;
      const entity = subdivisionData.find(s => s.id === entityId);
      
      if (entity) {
        const eoi = entity.eoi;
        
        // Calculate color based on EOI (heatmap from dark blue to cyan)
        const ratio = (eoi - minEoi) / (maxEoi - minEoi);
        const hue = 220 - (ratio * 40);
        const lightness = 25 + (ratio * 35);
        path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;
        
        path.addEventListener('click', () => {
          selectState(entity, path);
        });
        
        // Tooltip logic
        path.addEventListener('mousemove', (e) => {
          const tooltipEl = document.querySelector('.map-tooltip');
          tooltipEl.style.opacity = '1';
          tooltipEl.style.left = e.pageX + 15 + 'px';
          tooltipEl.style.top = e.pageY + 15 + 'px';
          tooltipEl.innerHTML = `<strong>${entity.name}</strong><div style="display:flex; justify-content:space-between; width:120px;"><span>EOI Score:</span> <span style="color:var(--accent-gold); font-weight:bold">${eoi}</span></div>`;
        });
        
        path.addEventListener('mouseleave', () => {
          const tooltipEl = document.querySelector('.map-tooltip');
          tooltipEl.style.opacity = '0';
        });
      }
    });
    
    // Update details panel label
    const detailsLabel = document.querySelector('#state-details .stat-label');
    if (detailsLabel) {
      detailsLabel.textContent = `Selected Region (${country.name})`;
    }
    
    // Select first subdivision by default
    const firstEntity = subdivisionData[0];
    const firstPath = document.getElementById(firstEntity.id);
    if (firstEntity && firstPath) {
      selectState(firstEntity, firstPath);
    }
  } catch (error) {
    console.error(`Failed to load subdivision map for ${country.name}:`, error);
    alert(`Could not load subdivision map for ${country.name}.`);
  }
}

function getSubdivisionData(countryId) {
  // Return subdivision data for the given country
  // This will be populated with actual data
  const subdivisionMaps = {
    'us': statesData, // US states already exist
    'cn': chinaSubdivisionsData, // China provinces
    'af': afghanistanSubdivisionsData, // Afghanistan provinces
    // Add more countries as needed
  };

  return subdivisionMaps[countryId] || null;
}

function goBackToMap() {
  if (previousMapType) {
    switchMap(previousMapType);
    previousMapType = null;
    document.getElementById('btn-back-map').style.display = 'none';
  }
}

async function init() {
  // Initialize state-level wealth fund tracking fields
  statesData.forEach(state => {
    state.sovereignFund = state.sovereignFund || 0; // treasury cash paid out
    state.lockedValue = state.lockedValue || 0;     // capital currently locked
    state.totalVolume = state.totalVolume || 0;
  });

  // Initialize China province tracking fields
  chinaSubdivisionsData.forEach(province => {
    province.sovereignFund = province.sovereignFund || 0;
    province.lockedValue = province.lockedValue || 0;
    province.totalVolume = province.totalVolume || 0;
  });

  // Initialize Afghanistan province tracking fields
  afghanistanSubdivisionsData.forEach(province => {
    province.sovereignFund = province.sovereignFund || 0;
    province.lockedValue = province.lockedValue || 0;
    province.totalVolume = province.totalVolume || 0;
  });

  // Initialize Ledger first
  await ledger.init();
  initLedgerUI();

  // Initialize ledger with sample data if empty
  await initSampleLedgerData();

  // Initialize SGA Multicurrency Network
  await initNetworkUI();

  // Load US map by default
  await switchMap('us');

  // Initialize the chart
  initChart();

  // Initial table render
  renderTable();

  // Select CA by default
  const caState = statesData.find(s => s.id === 'CA');
  const caPath = document.getElementById('CA');
  if (caState && caPath) selectState(caState, caPath);

  // Initialize Trading Terminal
  initTradingTerminal();

  // Initialize Router
  initRouter();

  // Initialize News UI
  initNewsUI();

  // Start background simulations
  startGlobalBackgroundSimulation();
}

// Initialize ledger with sample data if empty
async function initSampleLedgerData() {
  const existingRecords = ledger.getRecords({});
  if (existingRecords.length > 0) return; // Already has data (including genesis block)

  const sampleData = [
    // Infrastructure
    {
      category: 'Infrastructure',
      amount: 250000000,
      agency: 'California Dept of Transportation',
      region: 'CA',
      description: 'SGA funds will be spent on Highway 101 widening from San Jose to San Francisco, including new HOV lanes, seismic retrofitting, intelligent traffic monitoring systems, noise barriers, and drainage upgrades.',
      imageUrl: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop'
    },
    {
      category: 'Infrastructure',
      amount: 180000000,
      agency: 'Texas DOT',
      region: 'TX',
      description: 'SGA funds will be spent on I-35 corridor improvements including 23 bridge replacements, adaptive traffic control systems, variable message signs, high-performance concrete pavement, and connected vehicle infrastructure.',
      imageUrl: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&h=600&fit=crop'
    },
    {
      category: 'Infrastructure',
      amount: 95000000,
      agency: 'NY State Thruway Authority',
      region: 'NY',
      description: 'SGA funds will be spent on Hudson River Crossing bridge rehabilitation including deck replacement, steel reinforcement, bearing replacement, corrosion protection, seismic retrofitting, and structural health monitoring sensors.',
      imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop'
    },
    {
      category: 'Infrastructure',
      amount: 145000000,
      agency: 'Florida Dept of Transportation',
      region: 'FL',
      description: 'SGA funds will be spent on Port Everglades deepening and expansion including dredging for larger vessels, new berths and wharves, cargo handling equipment, shore power infrastructure, and environmental mitigation.',
      imageUrl: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&h=600&fit=crop'
    },
    {
      category: 'Infrastructure',
      amount: 89000000,
      agency: 'Illinois Dept of Transportation',
      region: 'IL',
      description: 'SGA funds will be spent on Chicago O\'Hare modernization including Terminal 5 expansion with new gates, automated baggage systems, runway reconstruction, taxiway optimization, and biometric passenger processing.',
      imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&h=600&fit=crop'
    },
    {
      category: 'Infrastructure',
      amount: 76000000,
      agency: 'Pennsylvania DOT',
      region: 'PA',
      description: 'SGA funds will be spent on Pennsylvania Turnpike widening from four to six lanes across 45 miles, electronic tolling systems, highway lighting, intelligent transportation systems, and bridge replacements.',
      imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&h=600&fit=crop'
    },
    // Education
    {
      category: 'Education',
      amount: 75000000,
      agency: 'Florida Dept of Education',
      region: 'FL',
      description: 'SGA funds will be spent on K-12 STEM initiatives including 3D printers, robotics equipment, advanced computers across 200 schools, teacher training in coding/robotics, and after-school STEM programs.',
      imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=600&fit=crop'
    },
    {
      category: 'Education',
      amount: 120000000,
      agency: 'Illinois Board of Higher Education',
      region: 'IL',
      description: 'SGA funds will be spent on community college workforce development including CNC machinery, industrial robotics, manufacturing simulation systems, industry-aligned curriculum, and apprenticeship partnerships.',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop'
    },
    {
      category: 'Education',
      amount: 45000000,
      agency: 'Pennsylvania Dept of Education',
      region: 'PA',
      description: 'SGA funds will be spent on early childhood education expansion including Pre-K classroom construction, certified educator hiring, evidence-based curriculum development, family engagement programs, and developmental screenings.',
      imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=600&fit=crop'
    },
    {
      category: 'Education',
      amount: 89000000,
      agency: 'California Dept of Education',
      region: 'CA',
      description: 'SGA funds will be spent on digital learning initiatives providing laptops/tablets to 500,000 students, high-speed wireless infrastructure, blended learning teacher training, digital content libraries, and learning management systems.',
      imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop'
    },
    {
      category: 'Education',
      amount: 67000000,
      agency: 'Texas Education Agency',
      region: 'TX',
      description: 'SGA funds will be spent on career and technical education expansion including automotive labs, healthcare simulation centers, culinary kitchens, advanced technical training equipment, industry certification programs, and business partnerships.',
      imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop'
    },
    {
      category: 'Education',
      amount: 54000000,
      agency: 'New York State Education Dept',
      region: 'NY',
      description: 'SGA funds will be spent on teacher recruitment and retention including signing bonuses for high-need subjects, student loan forgiveness, mentorship programs, professional development, and teacher leadership pathways.',
      imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b955?w=800&h=600&fit=crop'
    },
    // Healthcare
    {
      category: 'Healthcare',
      amount: 200000000,
      agency: 'California Health & Human Services',
      region: 'CA',
      description: 'SGA funds will be spent on Medicaid expansion including dental and vision benefits, increased rural provider reimbursement, community health center funding, value-based care initiatives, and telehealth services.',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop'
    },
    {
      category: 'Healthcare',
      amount: 85000000,
      agency: 'Ohio Dept of Health',
      region: 'OH',
      description: 'SGA funds will be spent on rural health clinic initiatives including telemedicine equipment, HIPAA-compliant facility upgrades, electronic health records, telehealth provider training, and broadband infrastructure.',
      imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop'
    },
    {
      category: 'Healthcare',
      amount: 65000000,
      agency: 'Georgia Dept of Behavioral Health',
      region: 'GA',
      description: 'SGA funds will be spent on mental health services expansion including 15 community treatment centers, 24/7 crisis hotlines, mobile crisis teams, primary care mental health integration, and workforce development.',
      imageUrl: 'https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=800&h=600&fit=crop'
    },
    {
      category: 'Healthcare',
      amount: 145000000,
      agency: 'Texas Health & Human Services',
      region: 'TX',
      description: 'SGA funds will be spent on hospital safety net enhancements including trauma center upgrades, emergency department expansion, MRI and CT scanners, electronic health records, and physician recruitment incentives.',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop'
    },
    {
      category: 'Healthcare',
      amount: 98000000,
      agency: 'Florida Agency for Health Care Administration',
      region: 'FL',
      description: 'SGA funds will be spent on senior healthcare access including mobile health units, home healthcare expansion, medication management, chronic disease programs, and rural medical transportation.',
      imageUrl: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&h=600&fit=crop'
    },
    {
      category: 'Healthcare',
      amount: 76000000,
      agency: 'New York State Dept of Health',
      region: 'NY',
      description: 'SGA funds will be spent on public health infrastructure including laboratory modernization, disease surveillance systems, emergency preparedness stockpiles, epidemiologist training, and community health assessment tools.',
      imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=600&fit=crop'
    },
    // Technology
    {
      category: 'Technology',
      amount: 150000000,
      agency: 'Washington State Dept of Commerce',
      region: 'WA',
      description: 'SGA funds will be spent on broadband expansion including fiber optic deployment to 200,000 rural households, fixed wireless solutions, low-income subsidies, digital literacy training, and public Wi-Fi hotspots.',
      imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&h=600&fit=crop'
    },
    {
      category: 'Technology',
      amount: 90000000,
      agency: 'Massachusetts Technology Collaborative',
      region: 'MA',
      description: 'SGA funds will be spent on biotechnology R&D including laboratory construction, gene sequencing equipment, drug discovery tools, startup incubator funding, academic partnerships, and biotech workforce training.',
      imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&h=600&fit=crop'
    },
    {
      category: 'Technology',
      amount: 55000000,
      agency: 'Colorado Office of Economic Development',
      region: 'CO',
      description: 'SGA funds will be spent on smart cities initiatives including IoT traffic sensors, air quality monitoring, energy optimization, data analytics platforms, citizen engagement apps, cybersecurity infrastructure, and municipal staff training.',
      imageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=600&fit=crop'
    },
    {
      category: 'Technology',
      amount: 120000000,
      agency: 'California Gov Ops Agency',
      region: 'CA',
      description: 'SGA funds will be spent on state digital transformation including cloud migration, digital identity verification, online service portals, data analytics capabilities, and cybersecurity enhancements across agencies.',
      imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop'
    },
    {
      category: 'Technology',
      amount: 78000000,
      agency: 'Texas Dept of Information Resources',
      region: 'TX',
      description: 'SGA funds will be spent on cybersecurity enhancements including security operations center expansion, threat intelligence platforms, endpoint detection and response, security awareness training, and incident response capabilities.',
      imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=600&fit=crop'
    },
    {
      category: 'Technology',
      amount: 62000000,
      agency: 'Illinois Dept of Innovation & Technology',
      region: 'IL',
      description: 'SGA funds will be spent on government technology modernization including enterprise resource planning, data center consolidation, network infrastructure upgrades, digital services, and IT workforce development.',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop'
    },
    // Environmental
    {
      category: 'Environmental',
      amount: 175000000,
      agency: 'California Environmental Protection Agency',
      region: 'CA',
      description: 'SGA funds will be spent on clean energy transition including solar panels on 500 public buildings, battery storage systems, electric vehicle charging infrastructure, energy efficiency retrofits, and renewable energy procurement.',
      imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=600&fit=crop'
    },
    {
      category: 'Environmental',
      amount: 80000000,
      agency: 'Michigan Dept of Environment',
      region: 'MI',
      description: 'SGA funds will be spent on Great Lakes restoration including wastewater treatment upgrades, native species habitat conservation, invasive species control, shoreline restoration, and water quality monitoring systems.',
      imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=600&fit=crop'
    },
    {
      category: 'Environmental',
      amount: 60000000,
      agency: 'Oregon Dept of Environmental Quality',
      region: 'OR',
      description: 'SGA funds will be spent on forest conservation including sustainable logging certification, 100,000-acre reforestation, watershed protection, wildlife habitat corridors, and carbon sequestration monitoring.',
      imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop'
    },
    {
      category: 'Environmental',
      amount: 95000000,
      agency: 'New York State Dept of Environmental Conservation',
      region: 'NY',
      description: 'SGA funds will be spent on climate resilience infrastructure including seawalls and levees, stormwater management, green infrastructure, coastal erosion control, and extreme weather emergency planning.',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop'
    },
    {
      category: 'Environmental',
      amount: 72000000,
      agency: 'Florida Dept of Environmental Protection',
      region: 'FL',
      description: 'SGA funds will be spent on Everglades restoration including water quality projects, endangered species habitat restoration, invasive species removal, hydrological restoration, and ecosystem conservation education.',
      imageUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&h=600&fit=crop'
    },
    {
      category: 'Environmental',
      amount: 58000000,
      agency: 'Texas Commission on Environmental Quality',
      region: 'TX',
      description: 'SGA funds will be spent on air quality improvement including industrial emissions reduction, monitoring network expansion, clean vehicle incentives, renewable energy promotion, and air pollution public health initiatives.',
      imageUrl: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&h=600&fit=crop'
    },
    // Economic Relief
    {
      category: 'Economic Relief',
      amount: 300000000,
      agency: 'New York Dept of Labor',
      region: 'NY',
      description: 'SGA funds will be spent on small business relief including operating expense coverage, payroll support, rent assistance, technical assistance for business recovery, with priority for minority and women-owned businesses.',
      imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=600&fit=crop'
    },
    {
      category: 'Economic Relief',
      amount: 125000000,
      agency: 'Texas Workforce Commission',
      region: 'TX',
      description: 'SGA funds will be spent on job training for displaced energy sector workers including solar installation, wind turbine maintenance, battery storage, smart grid operations, certification programs, apprenticeships, and job placement.',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop'
    },
    {
      category: 'Economic Relief',
      amount: 95000000,
      agency: 'Florida Dept of Economic Opportunity',
      region: 'FL',
      description: 'SGA funds will be spent on housing assistance including rental subsidies for low-income families, mortgage assistance for homeowners facing foreclosure, emergency shelter funding, housing counseling, and first-time homebuyer down payment assistance.',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop'
    },
    {
      category: 'Economic Relief',
      amount: 180000000,
      agency: 'California Employment Development Dept',
      region: 'CA',
      description: 'SGA funds will be spent on unemployment insurance enhancements including extended benefits duration, increased benefit amounts, streamlined application process, job search assistance, and retraining for long-term unemployed.',
      imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop'
    },
    {
      category: 'Economic Relief',
      amount: 110000000,
      agency: 'Illinois Dept of Commerce',
      region: 'IL',
      description: 'SGA funds will be spent on manufacturing recovery including equipment modernization grants, supply chain resilience funding, export assistance, digital transformation support, and advanced manufacturing workforce training.',
      imageUrl: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop'
    },
    {
      category: 'Economic Relief',
      amount: 85000000,
      agency: 'Pennsylvania Dept of Community & Economic Development',
      region: 'PA',
      description: 'SGA funds will be spent on main street revitalization including façade improvement grants, business technical assistance, marketing and tourism promotion, public space enhancement, and downtown economic development planning.',
      imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop'
    },
    // Social Services
    {
      category: 'Social Services',
      amount: 110000000,
      agency: 'California Dept of Social Services',
      region: 'CA',
      description: 'SGA funds will be spent on SNAP benefits administration including online application systems, mobile benefit management, expanded eligibility for working families, increased benefit amounts, nutrition education, and food bank partnerships.',
      imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 75000000,
      agency: 'Pennsylvania Dept of Human Services',
      region: 'PA',
      description: 'SGA funds will be spent on child care subsidies including income-based subsidies, provider quality improvement funding, extended hours for non-traditional schedules, infant care support, and early childhood educator professional development.',
      imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 85000000,
      agency: 'Ohio Dept of Aging',
      region: 'OH',
      description: 'SGA funds will be spent on senior services expansion including home-delivered meals, healthcare coordination, medical appointment transportation, fall prevention programs, social isolation mitigation, and caregiver support services.',
      imageUrl: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 92000000,
      agency: 'Texas Health & Human Services',
      region: 'TX',
      description: 'SGA funds will be spent on foster care system reform including foster family recruitment and training, foster child mental health and educational support, kinship care programs, youth transition services, and family preservation initiatives.',
      imageUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 68000000,
      agency: 'Florida Dept of Children & Families',
      region: 'FL',
      description: 'SGA funds will be spent on homelessness prevention including emergency rental assistance, utility bill payment support, case management services, rapid rehousing programs, permanent supportive housing development, and street outreach services.',
      imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 79000000,
      agency: 'New York Office of Temporary & Disability Assistance',
      region: 'NY',
      description: 'SGA funds will be spent on disability services expansion including public housing accessibility improvements, employment support for disabled individuals, assistive technology funding, independent living skills training, and transportation services.',
      imageUrl: 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 88000000,
      agency: 'Michigan Dept of Health & Human Services',
      region: 'MI',
      description: 'SGA funds will be spent on substance abuse treatment including residential treatment facility expansion, outpatient counseling, medication-assisted treatment, recovery support services, harm reduction initiatives, and prevention education programs.',
      imageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=600&fit=crop'
    },
    {
      category: 'Social Services',
      amount: 74000000,
      agency: 'Georgia Dept of Human Services',
      region: 'GA',
      description: 'SGA funds will be spent on refugee resettlement support including language acquisition programs, employment services, cultural orientation, housing assistance, mental health services, and community integration programs.',
      imageUrl: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&h=600&fit=crop'
    }
  ];

  // Add sample records with staggered timestamps
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30); // Start 30 days ago

  for (let i = 0; i < sampleData.length; i++) {
    const recordDate = new Date(baseDate);
    recordDate.setDate(recordDate.getDate() + (i * 2)); // Stagger every 2 days
    
    await ledger.addRecord({
      ...sampleData[i],
      timestamp: recordDate.toISOString()
    });
  }
}

function getDailyChangePct(state) {
  const isStock = window.activeInstrumentType === 'stock';
  
  if (isStock) {
    // Calculate actual 24h stock price change
    const currentPrice = window.getStockPrice(state.id);
    const previousPrice = window.previousDayStockPrices[state.id] || currentPrice;
    
    if (previousPrice === 0) return 0;
    
    const changePct = ((currentPrice - previousPrice) / previousPrice) * 100;
    return parseFloat(changePct.toFixed(2));
  } else {
    // Pseudorandom but stable daily change % based on state GDP growth for futures
    const base = state.growth * 0.12;
    const seed = (state.id.charCodeAt(0) * 17 + state.id.charCodeAt(1) * 23) % 100;
    const variation = (seed / 100) * 0.5 - 0.25;
    const finalChange = base + variation;
    return parseFloat(finalChange.toFixed(2));
  }
}

function selectStateFromIPO(stateId) {
  const state = statesData.find(s => s.id === stateId);
  if (!state) return;
  
  // Find the corresponding map path element
  const path = document.getElementById(stateId);
  if (!path) return;
  
  // Call the existing selectState function
  selectState(state, path);
  
  // Switch to stock mode if not already
  if (window.activeInstrumentType !== 'stock') {
    window.setInstrumentType('stock');
  }
  
  // Update the IPO card display
  renderSelectedStateIPOCard();
}

function selectState(state, element) {
  // Update Map UI
  document.querySelectorAll('.state-path').forEach(p => p.classList.remove('active'));
  element.classList.add('active');

  // Update Details - use appropriate EOI calculation based on map type
  const calculateEOI = currentMapType === 'us' ? window.calculateEOI : window.calculateWorldEOI;
  const eoi = calculateEOI(state);
  const targetPrice = window.activeInstrumentType === 'stock'
    ? window.getStockPrice(state.id)
    : (eoi * CONTRACT_SPECS.pricingScale);
  const decimals = window.activeInstrumentType === 'stock' ? (targetPrice < 1.0 ? 4 : 2) : 2;
  const price = targetPrice.toFixed(decimals);

  // Calculate entity's proportion of the $50 Trillion collective market injection
  const totalEOI = currentMapType === 'us' ? totalNationalEOI : worldData.reduce((sum, c) => sum + calculateWorldEOI(c), 0);
  const entityProportion = eoi / totalEOI;
  const entityInjectionAmount = 50_000_000_000_000 * entityProportion;
  const split = getPayoutSplit(entityInjectionAmount);

  const changePct = getDailyChangePct(state);
  const isUp = changePct >= 0;
  const changeText = isUp ? `+${changePct}%` : `${changePct}%`;
  const changeColor = isUp ? '#10b981' : '#ef4444';
  const arrow = isUp ? '▲' : '▼';

  const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  document.getElementById('selected-state-name').textContent = state.name;
  document.getElementById('eoi-value').textContent = eoi;
  document.getElementById('contract-price').textContent = `$${formattedPrice}`;

  // Add share price
  const sharePrice = window.getStockPrice(state.id);
  const shareDecimals = sharePrice < 1.0 ? 4 : 2;
  const formattedSharePrice = sharePrice.toLocaleString(undefined, { minimumFractionDigits: shareDecimals, maximumFractionDigits: shareDecimals });
  document.getElementById('share-price').textContent = `$${formattedSharePrice}`;

  const vol24hEl = document.getElementById('market-24h-vol');
  const avg7dEl = document.getElementById('market-7d-avg');

  if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, entityProportion);
  if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, entityProportion);

  const federalPayoutEl = document.getElementById('federal-payout');
  if (federalPayoutEl) federalPayoutEl.textContent = formatCurrency(split.federal);

  const publicPayoutEl = document.getElementById('public-payout');
  if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

  const publicDrawdown = entityInjectionAmount * 0.016;
  const drawdownEl = document.getElementById('public-drawdown-payout');
  if (drawdownEl) {
    drawdownEl.textContent = formatCurrency(publicDrawdown);
  }

  document.getElementById('stat-growth').textContent = `${state.growth}%`;
  document.getElementById('stat-employment').textContent = `${state.employment}%`;
  document.getElementById('stat-inflation').textContent = `${state.inflation}%`;

  // Animate bars slightly
  document.getElementById('market-bar').style.width = '80%';
  document.getElementById('state-bar').style.width = '20%';

  updateStateWealthUI(state);

  // Update Trading Terminal
  currentTradingStateData = state;
  const tradingStateName = document.getElementById('trading-state-name');
  const expiry = getNextExpiry();
  if (tradingStateName) tradingStateName.textContent = `${state.id}-SGA`;
  const tradingPrice = document.getElementById('trading-price');
  if (tradingPrice) tradingPrice.textContent = `$${formattedPrice}`;

  // Update contract specs
  updateContractSpecsUI();

  // Update IPO panel card for selected state
  renderIPOPanel();

  // Start live price simulation
  startLivePricing(parseFloat(price));

  // Update Chart with Real-Time Intraday Candlesticks (600 periods of 10-second ticks for deep scrollback history)
  const currentPrice = parseFloat(price);

  const trend = state.growth >= 0 ? 1 : -1;
  const ohlcData = new Array(600);
  let priceCursor = currentPrice;
  const now = new Date();

  // Reset chart scroll and zoom levels when a new state is loaded
  window.chartScrollOffset = 0;
  window.visibleCandlesCount = 45;

  const specs = getActiveSpecs();

  // Generate 600 candles of 10s intervals backwards from the current mark price
  for (let i = 599; i >= 0; i--) {
    const time = new Date(now.getTime() - (599 - i) * 10000);
    const timeStr = formatTime(time);

    const close = parseFloat(priceCursor.toFixed(decimals));

    // 10-second scale volatility (1 to 5 ticks)
    const tickVol = specs.tickSize * (1 + Math.random() * 4);
    const change = (Math.random() * 2 - 1) * tickVol + (trend * specs.tickSize * 0.4);
    const open = parseFloat((close - change).toFixed(decimals));

    const high = parseFloat((Math.max(open, close) + Math.random() * specs.tickSize * 2).toFixed(decimals));
    const low = parseFloat((Math.min(open, close) - Math.random() * specs.tickSize * 2).toFixed(decimals));

    ohlcData[i] = { time: timeStr, open, high, low, close };

    // Connect next candle open to current candle's open with a minor tick gap
    priceCursor = open + (Math.random() * 2 - 1) * specs.tickSize;
  }

  if (chartCtx) {
    currentChartData = ohlcData;
    drawChart();
  }
}

// ==========================================
// CUSTOM CANVAS CANDLESTICK CHART
// ==========================================
let chartCanvas = null;
let chartCtx = null;
let currentChartData = [];
let hoveredIndex = -1;
let isDragging = false;
let dragStartX = 0;
let dragStartOffset = 0;

function initChart() {
  const container = document.getElementById('trading-chart');
  chartCanvas = document.createElement('canvas');
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '100%';
  chartCanvas.style.cursor = 'grab'; // Visual cue for panning
  container.innerHTML = '';
  container.appendChild(chartCanvas);
  chartCtx = chartCanvas.getContext('2d');

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    chartCanvas.width = container.clientWidth;
    chartCanvas.height = container.clientHeight;
    drawChart();
  });
  resizeObserver.observe(container);

  // Initial sizing
  chartCanvas.width = container.clientWidth;
  chartCanvas.height = container.clientHeight;

  // Interactivity: Panning & Zooming
  chartCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartOffset = window.chartScrollOffset || 0;
    chartCanvas.style.cursor = 'grabbing';
    hoveredIndex = -1; // Suppress hover guide lines while actively panning
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      chartCanvas.style.cursor = 'grab';
    }
  });

  chartCanvas.addEventListener('mousemove', (e) => {
    const rect = chartCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const padding = { top: 30, right: 50, bottom: 20, left: 10 };
      const chartWidth = chartCanvas.width - padding.left - padding.right;
      const visibleCount = window.visibleCandlesCount || 45;
      const candleSpacing = chartWidth / visibleCount;

      const deltaX = e.clientX - dragStartX;
      const candlesDragged = Math.round(deltaX / candleSpacing);

      let newOffset = dragStartOffset + candlesDragged;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      newOffset = Math.max(0, Math.min(newOffset, maxOffset));

      if (window.chartScrollOffset !== newOffset) {
        window.chartScrollOffset = newOffset;
        drawChart();
      }
    } else {
      handleMouseMove(x, y);
    }
  });

  chartCanvas.addEventListener('mouseleave', () => {
    if (!isDragging) {
      hoveredIndex = -1;
      drawChart();
    }
  });

  // Wheel zoom support
  chartCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.08;
    let visibleCount = window.visibleCandlesCount || 45;

    if (e.deltaY > 0) {
      // Zoom out (show more candlesticks in viewport)
      visibleCount = Math.min(150, Math.round(visibleCount * (1 + zoomIntensity)));
    } else {
      // Zoom in (show fewer candlesticks in viewport)
      visibleCount = Math.max(15, Math.round(visibleCount * (1 - zoomIntensity)));
    }

    window.visibleCandlesCount = visibleCount;

    // Clamp offset inside bounds
    const maxOffset = Math.max(0, currentChartData.length - visibleCount);
    window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));

    drawChart();
  }, { passive: false });

  // Toolbar controls support
  const slider = document.getElementById('chart-timeline-slider');
  const btnPanLeft = document.getElementById('chart-btn-pan-left');
  const btnPanRight = document.getElementById('chart-btn-pan-right');
  const btnZoomIn = document.getElementById('chart-btn-zoom-in');
  const btnZoomOut = document.getElementById('chart-btn-zoom-out');
  const btnLive = document.getElementById('chart-btn-live');

  if (btnPanLeft) {
    btnPanLeft.addEventListener('click', () => {
      const visibleCount = window.visibleCandlesCount || 45;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.min(maxOffset, (window.chartScrollOffset || 0) + 5);
      drawChart();
    });
  }

  if (btnPanRight) {
    btnPanRight.addEventListener('click', () => {
      window.chartScrollOffset = Math.max(0, (window.chartScrollOffset || 0) - 5);
      drawChart();
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      let visibleCount = window.visibleCandlesCount || 45;
      visibleCount = Math.max(15, Math.round(visibleCount * 0.8));
      window.visibleCandlesCount = visibleCount;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));
      drawChart();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      let visibleCount = window.visibleCandlesCount || 45;
      visibleCount = Math.min(150, Math.round(visibleCount * 1.2));
      window.visibleCandlesCount = visibleCount;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));
      drawChart();
    });
  }

  if (btnLive) {
    btnLive.addEventListener('click', () => {
      window.chartScrollOffset = 0;
      drawChart();
    });
  }

  if (slider) {
    slider.addEventListener('input', () => {
      const visibleCount = window.visibleCandlesCount || 45;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      const sliderVal = parseInt(slider.value);
      window.chartScrollOffset = maxOffset - sliderVal;
      drawChart();
    });
  }
}

function handleMouseMove(x, y) {
  if (currentChartData.length === 0) return;
  const padding = { top: 30, right: 50, bottom: 20, left: 10 };
  const chartWidth = chartCanvas.width - padding.left - padding.right;

  const visibleCount = window.visibleCandlesCount || 45;
  const scrollOffset = window.chartScrollOffset || 0;
  const startIdx = Math.max(0, currentChartData.length - visibleCount - scrollOffset);
  const endIdx = Math.max(0, currentChartData.length - scrollOffset);
  const activeCount = endIdx - startIdx;

  const candleSpacing = chartWidth / activeCount;

  if (x >= padding.left && x <= padding.left + chartWidth) {
    const index = Math.floor((x - padding.left) / candleSpacing);
    if (index >= 0 && index < activeCount) {
      if (hoveredIndex !== index) {
        hoveredIndex = index;
        drawChart();
      }
    }
  } else {
    hoveredIndex = -1;
    drawChart();
  }
}

function drawChart() {
  if (!chartCtx || currentChartData.length === 0) return;

  const width = chartCanvas.width;
  const height = chartCanvas.height;

  const visibleCount = window.visibleCandlesCount || 45;
  const scrollOffset = window.chartScrollOffset || 0;
  const startIdx = Math.max(0, currentChartData.length - visibleCount - scrollOffset);
  const endIdx = Math.max(0, currentChartData.length - scrollOffset);
  const data = currentChartData.slice(startIdx, endIdx);

  chartCtx.clearRect(0, 0, width, height);

  const padding = { top: 30, right: 50, bottom: 20, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get price range of visible candlesticks for dynamic Y-axis auto-scaling
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (let d of data) {
    if (d.low < minPrice) minPrice = d.low;
    if (d.high > maxPrice) maxPrice = d.high;
  }
  const priceRange = maxPrice - minPrice || 0.1;
  minPrice -= priceRange * 0.1;
  maxPrice += priceRange * 0.1;
  const adjustedRange = maxPrice - minPrice;

  // Draw Grid & Axes
  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * (i / 4));
    chartCtx.moveTo(padding.left, y);
    chartCtx.lineTo(padding.left + chartWidth, y);
  }
  chartCtx.stroke();

  // Draw Y-Axis Labels
  chartCtx.fillStyle = '#94a3b8';
  chartCtx.font = '10px Inter, sans-serif';
  chartCtx.textAlign = 'left';
  chartCtx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * (i / 4));
    const price = maxPrice - (adjustedRange * (i / 4));
    chartCtx.fillText(price.toFixed(2), width - padding.right + 8, y);
  }

  // Draw Candlesticks
  const candleSpacing = chartWidth / data.length;
  const candleWidth = Math.max(1, candleSpacing * 0.6);

  data.forEach((d, i) => {
    const xCenter = padding.left + (i * candleSpacing) + (candleSpacing / 2);
    const yHigh = padding.top + chartHeight * (1 - ((d.high - minPrice) / adjustedRange));
    const yLow = padding.top + chartHeight * (1 - ((d.low - minPrice) / adjustedRange));
    const yOpen = padding.top + chartHeight * (1 - ((d.open - minPrice) / adjustedRange));
    const yClose = padding.top + chartHeight * (1 - ((d.close - minPrice) / adjustedRange));

    const isUp = d.close >= d.open;
    const color = isUp ? '#10b981' : '#ef4444';

    // Wick
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 1;
    chartCtx.beginPath();
    chartCtx.moveTo(xCenter, yHigh);
    chartCtx.lineTo(xCenter, yLow);
    chartCtx.stroke();

    // Body
    chartCtx.fillStyle = color;
    const bodyY = isUp ? yClose : yOpen;
    const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
    chartCtx.fillRect(xCenter - candleWidth / 2, bodyY, candleWidth, bodyHeight);
  });

  // Crosshair & Tooltip Hover
  if (hoveredIndex >= 0 && hoveredIndex < data.length) {
    const d = data[hoveredIndex];
    const xCenter = padding.left + (hoveredIndex * candleSpacing) + (candleSpacing / 2);
    const yClose = padding.top + chartHeight * (1 - ((d.close - minPrice) / adjustedRange));

    // Crosshair Lines
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    chartCtx.setLineDash([4, 4]);
    chartCtx.beginPath();
    chartCtx.moveTo(xCenter, padding.top);
    chartCtx.lineTo(xCenter, height - padding.bottom);
    chartCtx.moveTo(padding.left, yClose);
    chartCtx.lineTo(padding.left + chartWidth, yClose);
    chartCtx.stroke();
    chartCtx.setLineDash([]); // Reset

    // OHLC Overlay Box
    chartCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    chartCtx.fillRect(padding.left, 0, chartWidth, 24);
    chartCtx.fillStyle = '#fff';
    chartCtx.textAlign = 'left';
    chartCtx.font = '11px monospace';
    const ohlcText = `Time: ${d.time} | O: ${d.open.toFixed(2)}  H: ${d.high.toFixed(2)}  L: ${d.low.toFixed(2)}  C: ${d.close.toFixed(2)}`;
    chartCtx.fillText(ohlcText, padding.left + 5, 12);

    // Y-Axis Price Highlight
    chartCtx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    chartCtx.fillRect(width - padding.right, yClose - 10, padding.right, 20);
    chartCtx.fillStyle = '#000';
    chartCtx.fillText(d.close.toFixed(2), width - padding.right + 5, yClose);
  }

  // Sync timeline control slider & LIVE button styling on every draw
  const slider = document.getElementById('chart-timeline-slider');
  if (slider) {
    const maxOffset = Math.max(0, currentChartData.length - visibleCount);
    slider.max = maxOffset;
    slider.value = maxOffset - scrollOffset;

    // Visually toggle LIVE button styling based on whether viewport is panned to the present (scrollOffset === 0)
    const btnLive = document.getElementById('chart-btn-live');
    if (btnLive) {
      if (scrollOffset === 0) {
        btnLive.style.background = 'rgba(16, 185, 129, 0.25)';
        btnLive.style.borderColor = '#10b981';
        btnLive.style.color = '#10b981';
        btnLive.title = 'Snap to Real-Time Feed (Active)';
      } else {
        btnLive.style.background = 'rgba(255, 255, 255, 0.05)';
        btnLive.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        btnLive.style.color = 'var(--text-secondary)';
        btnLive.title = 'Snap to Real-Time Feed (Panned to Past)';
      }
    }
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  const sortedStates = [...statesData].sort((a, b) => b.gdp - a.gdp);
  const isStock = window.activeInstrumentType === 'stock';

  // Update table headers
  const priceHeader = document.getElementById('table-header-price');
  const eoiHeader = document.getElementById('table-header-eoi');
  if (priceHeader) priceHeader.textContent = isStock ? 'Share Price' : 'SGA Price';
  if (eoiHeader) eoiHeader.textContent = isStock ? 'IPO Status' : 'EOI Index';

  tbody.innerHTML = sortedStates.map(state => {
    const eoi = calculateEOI(state);
    const futuresPrice = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
    const stockPrice = window.getStockPrice(state.id);
    const stockDecimals = stockPrice < 1.0 ? 4 : 2;
    const formattedFuturesPrice = parseFloat(futuresPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedStockPrice = stockPrice.toLocaleString(undefined, { minimumFractionDigits: stockDecimals, maximumFractionDigits: stockDecimals });

    const changePct = getDailyChangePct(state);
    const isUp = changePct >= 0;
    const changeText = isUp ? `+${changePct}%` : `${changePct}%`;
    const changeColor = isUp ? '#10b981' : '#ef4444';
    const arrow = isUp ? '▲' : '▼';

    // Stock mode: price cell shows share price; eoi cell shows IPO status badge
    const ipoState = state.ipoStatus || 'pending';
    const ipoBadgeColor = ipoState === 'completed' ? '#10b981' : ipoState === 'running' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)';
    const ipoBadgeText = ipoState === 'completed' ? 'LIVE' : ipoState === 'running' ? 'RUNNING' : 'PENDING';

    const eoiCell = isStock
      ? `<span style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:3px;background:${ipoBadgeColor}18;border:1px solid ${ipoBadgeColor}44;color:${ipoBadgeColor};">${ipoBadgeText}</span>`
      : `${eoi}`;

    const priceCell = isStock
      ? `<span style="color:${ipoState === 'completed' ? '#10b981' : ipoState === 'running' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.35)'};">$${formattedStockPrice}</span>`
      : `<span style="color:var(--accent-blue);">$${formattedFuturesPrice}</span>`;

    return `
      <tr class="state-row" data-id="${state.id}">
        <td style="font-weight: 600;">${state.name}</td>
        <td>$${state.gdp}B</td>
        <td style="color: ${state.growth >= 0 ? '#10b981' : '#ef4444'}">${state.growth}%</td>
        <td style="color: #ef4444;">${state.inflation}%</td>
        <td style="color: ${isStock ? 'inherit' : 'var(--accent-gold)'}; font-weight: ${isStock ? 'normal' : '700'};">${eoiCell}</td>
        <td>${priceCell}</td>
        <td style="color: ${changeColor}; font-weight: 600; font-family: monospace;">${arrow} ${changeText}</td>
      </tr>
    `;
  }).join('');

  // Make rows clickable to update the map and chart
  const rows = tbody.querySelectorAll('.state-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const stateId = row.getAttribute('data-id');
      const state = statesData.find(s => s.id === stateId);
      const mapPath = document.getElementById(stateId);

      if (state && mapPath) {
        selectState(state, mapPath);
      }
    });
  });
}

// ==========================================
// FUTURES TRADING ENGINE
// ==========================================

function getNextExpiry() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const qMonths = [2, 5, 8, 11];
  let nextQ = qMonths.find(m => m > month);
  let expYear = year;
  if (nextQ === undefined) { nextQ = 2; expYear = year + 1; }
  const labels = { 2: 'MAR', 5: 'JUN', 8: 'SEP', 11: 'DEC' };
  const firstDay = new Date(expYear, nextQ, 1);
  let friday = 1 + ((5 - firstDay.getDay() + 7) % 7);
  friday += 14;
  return { label: `${labels[nextQ]} '${String(expYear).slice(2)}`, date: new Date(expYear, nextQ, friday) };
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function generateOrderBook(price) {
  const bids = [];
  const asks = [];

  // High-fidelity dynamic scaling of LOB sizing: inside levels are thin, deeper levels are thick.
  const levelScales = [
    { sizeMin: 200, sizeMax: 600 },    // Level 1: thin inside spread
    { sizeMin: 500, sizeMax: 1200 },   // Level 2: medium
    { sizeMin: 1200, sizeMax: 2800 },  // Level 3: thick
    { sizeMin: 3000, sizeMax: 6500 }   // Level 4: deep block liquidity
  ];

  const contraction = window.liquidityContraction || 1.0;
  const specs = getActiveSpecs();

  let sizeMultiplier = 1;
  let tickSize = specs.tickSize;
  let decimals = 2;

  if (window.activeInstrumentType === 'stock') {
    sizeMultiplier = 1000000; // 1,000,000x liquidity for stocks (100B outstanding)
    if (price < 1.00) {
      tickSize = 0.0001; // 4 decimals tick size for sub-dollar stocks
      decimals = 4;
    }
  } else if (window.activeInstrumentType === 'swap') {
    sizeMultiplier = 5; // Deep institutional FX Swap contract depth
    tickSize = 0.0001; // 1 Pip tick size
    decimals = 4;
  }

  for (let i = 1; i <= 4; i++) {
    const scale = levelScales[i - 1];

    // REALISTIC MARKET BEHAVIOR: Dynamic bid-ask spread widening
    // Market makers widen spreads during periods of uncertainty/volatility
    const spreadMultiplier = bidAskSpreadMultiplier || 1.0;
    const bidTickOffset = i * tickSize * spreadMultiplier;
    const askTickOffset = i * tickSize * spreadMultiplier;

    const bidPrice = parseFloat((price - bidTickOffset).toFixed(decimals));
    const askPrice = parseFloat((price + askTickOffset).toFixed(decimals));

    // REALISTIC MARKET BEHAVIOR: Order flow imbalance affects liquidity
    // Dividend capture creates temporary sell-side imbalance
    const orderFlowAdjustment = orderFlowImbalance || 0;
    const bidSizeMultiplier = 1.0 + Math.max(-0.3, orderFlowAdjustment); // Bids thin out on selling pressure
    const askSizeMultiplier = 1.0 - Math.max(-0.3, orderFlowAdjustment); // Asks thin out on buying pressure

    const bidSize = Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction * sizeMultiplier * bidSizeMultiplier);
    const askSize = Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction * sizeMultiplier * askSizeMultiplier);

    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  orderBook = { bids, asks };
}

function replenishOrderBook() {
  if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    generateOrderBook(currentLivePrice);
    return;
  }

  const bids = [];
  const asks = [];

  const levelScales = [
    { sizeMin: 200, sizeMax: 600 },
    { sizeMin: 500, sizeMax: 1200 },
    { sizeMin: 1200, sizeMax: 2800 },
    { sizeMin: 3000, sizeMax: 6500 }
  ];

  const contraction = window.liquidityContraction || 1.0;
  const specs = getActiveSpecs();

  let sizeMultiplier = 1;
  let tickSize = specs.tickSize;
  let decimals = 2;
  let tolerance = 0.001;

  if (window.activeInstrumentType === 'stock') {
    sizeMultiplier = 1000000; // 1,000,000x liquidity for stocks (100B outstanding)
    if (currentLivePrice < 1.00) {
      tickSize = 0.0001; // 4 decimals tick size for sub-dollar stocks
      decimals = 4;
      tolerance = 0.00001;
    }
  } else if (window.activeInstrumentType === 'swap') {
    sizeMultiplier = 5; // Deep institutional FX Swap contract depth
    tickSize = 0.0001; // 1 Pip tick size
    decimals = 4;
    tolerance = 0.00001;
  }

  for (let i = 1; i <= 4; i++) {
    const scale = levelScales[i - 1];

    // REALISTIC MARKET BEHAVIOR: Dynamic bid-ask spread widening
    const spreadMultiplier = bidAskSpreadMultiplier || 1.0;
    const bidTickOffset = i * tickSize * spreadMultiplier;
    const askTickOffset = i * tickSize * spreadMultiplier;

    const bidPrice = parseFloat((currentLivePrice - bidTickOffset).toFixed(decimals));
    const askPrice = parseFloat((currentLivePrice + askTickOffset).toFixed(decimals));

    const existingBid = orderBook.bids.find(b => Math.abs(b.price - bidPrice) < tolerance);
    const existingAsk = orderBook.asks.find(a => Math.abs(a.price - askPrice) < tolerance);

    // REALISTIC MARKET BEHAVIOR: Order flow imbalance affects liquidity
    const orderFlowAdjustment = orderFlowImbalance || 0;
    const bidSizeMultiplier = 1.0 + Math.max(-0.3, orderFlowAdjustment);
    const askSizeMultiplier = 1.0 - Math.max(-0.3, orderFlowAdjustment);

    let bidSize = existingBid ? existingBid.size : Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction * sizeMultiplier * bidSizeMultiplier);
    let askSize = existingAsk ? existingAsk.size : Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction * sizeMultiplier * askSizeMultiplier);

    // Smooth replenishment: Level 1 replenishes fastest (HFT market makers)
    const replenishRate = 5 - i;
    if (bidSize < scale.sizeMin * contraction * sizeMultiplier * bidSizeMultiplier) {
      bidSize += Math.floor(Math.random() * 20 + 10) * replenishRate * sizeMultiplier * bidSizeMultiplier;
    }
    if (askSize < scale.sizeMin * contraction * sizeMultiplier * askSizeMultiplier) {
      askSize += Math.floor(Math.random() * 20 + 10) * replenishRate * sizeMultiplier * askSizeMultiplier;
    }

    // Cap maximum level sizing to prevent runaway orderbooks
    bidSize = Math.max(scale.sizeMin * contraction * sizeMultiplier * bidSizeMultiplier, Math.min(bidSize, scale.sizeMax * 1.5 * contraction * sizeMultiplier * bidSizeMultiplier));
    askSize = Math.max(scale.sizeMin * contraction * sizeMultiplier * askSizeMultiplier, Math.min(askSize, scale.sizeMax * 1.5 * contraction * sizeMultiplier * askSizeMultiplier));

    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  orderBook = { bids, asks };
}

function renderOrderBook() {
  const asksDiv = document.getElementById('ob-asks');
  const bidsDiv = document.getElementById('ob-bids');
  const lastPriceVal = document.getElementById('ob-last-val');
  const directionArrow = document.getElementById('ob-direction-arrow');
  const spreadVal = document.getElementById('ob-spread-val');
  const tradesList = document.getElementById('live-trades-list');

  if (!asksDiv || !bidsDiv) return;

  const specs = getActiveSpecs();
  const maxBidSize = Math.max(...orderBook.bids.map(b => b.size), 1);
  const maxAskSize = Math.max(...orderBook.asks.map(a => a.size), 1);
  const maxLevelSize = Math.max(maxBidSize, maxAskSize);

  // Render Asks descending from Ask 4 to Ask 1
  const askDecimals = window.activeInstrumentType === 'swap' ? 4 : (window.activeInstrumentType === 'stock' && currentLivePrice < 1.0 ? 4 : 2);
  const asksHTML = [...orderBook.asks].reverse().map(ask => {
    const depthPct = Math.min(100, (ask.size / maxLevelSize) * 100);
    const notionalM = (ask.price * ask.size * specs.multiplier) / 1e6;
    return `
      <div class="ob-row ask-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #ef4444; position: relative; background: linear-gradient(to left, rgba(239, 68, 68, 0.08) ${depthPct}%, transparent ${depthPct}%); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.01);" onmousedown="document.getElementById('limit-price').value = ${ask.price.toFixed(askDecimals)}">
        <span style="font-weight: bold;">$${ask.price.toLocaleString(undefined, { minimumFractionDigits: askDecimals, maximumFractionDigits: askDecimals })}</span>
        <span style="text-align: right; color: var(--text-primary);">${ask.size.toLocaleString()}</span>
        <span style="text-align: right; color: var(--text-secondary);">$${notionalM.toFixed(1)}M</span>
      </div>
    `;
  }).join('');
  asksDiv.innerHTML = asksHTML;

  // Render Bids descending from Bid 1 to Bid 4
  const bidDecimals = window.activeInstrumentType === 'swap' ? 4 : (window.activeInstrumentType === 'stock' && currentLivePrice < 1.0 ? 4 : 2);
  const bidsHTML = orderBook.bids.map(bid => {
    const depthPct = Math.min(100, (bid.size / maxLevelSize) * 100);
    const notionalM = (bid.price * bid.size * specs.multiplier) / 1e6;
    return `
      <div class="ob-row bid-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #10b981; position: relative; background: linear-gradient(to left, rgba(16, 185, 129, 0.08) ${depthPct}%, transparent ${depthPct}%); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.01);" onmousedown="document.getElementById('limit-price').value = ${bid.price.toFixed(bidDecimals)}">
        <span style="font-weight: bold;">$${bid.price.toLocaleString(undefined, { minimumFractionDigits: bidDecimals, maximumFractionDigits: bidDecimals })}</span>
        <span style="text-align: right; color: var(--text-primary);">${bid.size.toLocaleString()}</span>
        <span style="text-align: right; color: var(--text-secondary);">$${notionalM.toFixed(1)}M</span>
      </div>
    `;
  }).join('');
  bidsDiv.innerHTML = bidsHTML;

  // Spread calculations
  const bestBid = orderBook.bids[0]?.price || currentLivePrice;
  const bestAsk = orderBook.asks[0]?.price || currentLivePrice;
  const spreadDecimals = window.activeInstrumentType === 'swap' ? 4 : 2;
  const spread = parseFloat((bestAsk - bestBid).toFixed(spreadDecimals));
  const ticks = Math.round(spread / specs.tickSize);

  // REALISTIC MARKET BEHAVIOR: Indicate when spreads are widened due to drawdown conditions
  const isWidenedSpread = bidAskSpreadMultiplier > 1.0;
  const spreadColor = isWidenedSpread ? '#f59e0b' : 'var(--text-secondary)';
  const spreadIndicator = isWidenedSpread ? ' 🔶' : '';

  if (spreadVal) {
    spreadVal.textContent = `Spread: $${spread.toFixed(spreadDecimals)} (${ticks}T)${spreadIndicator}`;
    spreadVal.style.color = spreadColor;
  }

  // Last traded price display
  if (lastPriceVal) {
    const prevPrice = parseFloat(lastPriceVal.textContent.replace(/[$,]/g, '')) || 0;
    const pricePrefix = window.activeInstrumentType === 'swap' ? '' : '$';
    const priceDecimals = window.activeInstrumentType === 'swap' ? 4 : (window.activeInstrumentType === 'stock' && currentLivePrice < 1.0 ? 4 : 2);
    lastPriceVal.textContent = `${pricePrefix}${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}`;

    if (currentLivePrice > prevPrice) {
      lastPriceVal.style.color = '#10b981';
      if (directionArrow) { directionArrow.textContent = '▲'; directionArrow.style.color = '#10b981'; }
    } else if (currentLivePrice < prevPrice) {
      lastPriceVal.style.color = '#ef4444';
      if (directionArrow) { directionArrow.textContent = '▼'; directionArrow.style.color = '#ef4444'; }
    }
  }

  // Recent Trade Feed
  if (tradesList && recentTrades.length > 0) {
    const pricePrefix = window.activeInstrumentType === 'swap' ? '' : '$';
    const priceDecimals = window.activeInstrumentType === 'swap' ? 4 : (window.activeInstrumentType === 'stock' && currentLivePrice < 1.0 ? 4 : 2);
    tradesList.innerHTML = [...recentTrades].reverse().slice(0, 2).map(trade => {
      const color = trade.side === 'BUY' ? '#10b981' : trade.side === 'SELL' ? '#ef4444' : '#fbbf24';
      const labelColor = trade.source === 'USER' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)';
      const sourceLabel = trade.source === 'USER' ? 'YOU' : 'INST';
      const qtyVal = typeof trade.qty === 'number' ? trade.qty : (parseFloat(trade.qty) || parseFloat(trade.shares) || 0);
      const priceVal = typeof trade.price === 'number' ? trade.price : (parseFloat(trade.priceUSD) || parseFloat(trade.price) || 0);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="color: var(--text-secondary);">${trade.time || ''}</span>
          <span style="color: ${labelColor}; font-weight: bold; padding: 0 4px; background: rgba(255,255,255,0.05); border-radius: 2px; font-size: 0.55rem;">${sourceLabel}</span>
          <span style="color: ${color}; font-weight: bold;">${trade.side || ''} ${qtyVal.toLocaleString()}</span>
          <span style="font-weight: bold;">${pricePrefix}${priceVal.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</span>
        </div>
      `;
    }).join('');
  }
}

function startLivePricing(basePrice) {
  if (liveTickInterval) clearInterval(liveTickInterval);
  currentLivePrice = basePrice;
  window.continuousPrice = basePrice;
  window.liquidityImbalance = 0;
  window.liquidityContraction = 1.0;

  // Reset pricing variables for the new state contract
  window.tickCounter = 0;
  window.priceMomentum = 0;
  recentTrades = [];

  generateOrderBook(currentLivePrice);
  renderOrderBook();
  updateOrderSummary();

  // High-frequency 250ms tick loop for exceptionally smooth price updates
  liveTickInterval = setInterval(() => {
    if (window.activeInstrumentType === 'stock' && currentTradingStateData) {
      const state = statesData.find(s => s.id === currentTradingStateData.id);
      if (state && state.ipoStatus !== 'completed') {
        // Stock has not finished IPO; let the IPO simulation walk price.
        return;
      }
    }

    const growth = (currentTradingStateData && window.activeInstrumentType !== 'swap') ? currentTradingStateData.growth : 0;

    // Decay the liquidity contraction factor back to 1.0 (normal)
    if (window.liquidityContraction && window.liquidityContraction < 1.0) {
      window.liquidityContraction = Math.min(1.0, window.liquidityContraction + 0.04); // Recovers 4% depth per tick
    }

    // REALISTIC MARKET BEHAVIOR: Post-drawdown dynamics decay
    if (drawdownTimestamp > 0) {
      const timeSinceDrawdown = Date.now() - drawdownTimestamp;
      const recoveryRate = 0.02; // 2% recovery per tick

      // Volatility mean reversion (GARCH-like decay)
      if (currentVolatility > baseVolatility) {
        currentVolatility = Math.max(baseVolatility, currentVolatility - (drawdownVolatilitySpike * recoveryRate));
      }

      // Bid-ask spread normalization
      if (bidAskSpreadMultiplier > 1.0) {
        bidAskSpreadMultiplier = Math.max(1.0, bidAskSpreadMultiplier - (1.5 * recoveryRate));
      }

      // Order flow imbalance decay (dividend capture effects fade)
      if (Math.abs(orderFlowImbalance) > 0.01) {
        orderFlowImbalance *= 0.92; // Fast decay of dividend capture effects
      }

      // Full recovery after ~2 minutes
      if (timeSinceDrawdown > 120000) {
        drawdownTimestamp = 0;
        currentVolatility = baseVolatility;
        bidAskSpreadMultiplier = 1.0;
        orderFlowImbalance = 0;
      }
    }

    // 1. Calculate price movements: drift, momentum, reversion, and liquidity pull
    const specs = getActiveSpecs();

    let fairPrice;
    if (window.activeInstrumentType === 'swap') {
      fairPrice = calculateSwapPrice(window.activeSwapPair.countryA, window.activeSwapPair.countryB);
    } else if (window.activeInstrumentType === 'stock') {
      const state = statesData.find(s => s.id === currentTradingStateData.id);
      fairPrice = state ? state.ipoPriceTarget : basePrice;
    } else {
      fairPrice = currentTradingStateData ? parseFloat((calculateEOI(currentTradingStateData) * specs.pricingScale).toFixed(2)) : basePrice;
    }

    let meanReversionPull;
    let volatilityAdjustedNoise;
    let imbalancePull;
    let secularDrift;
    let orderFlowPull;
    let scaledImbalance = 0;

    if (window.activeInstrumentType === 'swap') {
      const countryA = window.activeSwapPair ? window.activeSwapPair.countryA : 'us';
      const countryB = window.activeSwapPair ? window.activeSwapPair.countryB : 'cn';
      const g10List = ['us', 'cn', 'de', 'gb', 'jp', 'ca', 'au', 'fr', 'ch', 'se'];
      const isG10 = g10List.includes(countryA.toLowerCase()) && g10List.includes(countryB.toLowerCase());

      // Real FX Swap Ornstein-Uhlenbeck Mean Reversion: 0.22 speed for G10 FX, 0.15 for EM FX
      const meanReversionSpeed = isG10 ? 0.22 : 0.15;
      meanReversionPull = (fairPrice - currentLivePrice) * meanReversionSpeed;

      // Pipette noise: G10 standard 1 pip (0.0001) per tick, Emerging 3 pips (0.0003)
      const pipBaseNoise = isG10 ? 0.0001 : 0.0003;
      volatilityAdjustedNoise = (Math.random() * 2 - 1) * pipBaseNoise * (currentVolatility / baseVolatility);
      window.priceMomentum = window.priceMomentum * 0.75 + volatilityAdjustedNoise * 0.25;

      const signedImbalance = window.liquidityImbalance || 0;
      scaledImbalance = Math.sign(signedImbalance) * Math.log1p(Math.abs(signedImbalance)) * 100;
      imbalancePull = Math.sign(signedImbalance) * Math.min(0.0003, Math.abs(signedImbalance) * 0.000005);
      secularDrift = 0;
      orderFlowPull = 0;
    } else {
      secularDrift = (growth / 100) * 0.0012;
      volatilityAdjustedNoise = (Math.random() * 2 - 1) * specs.tickSize * 0.45 * (currentVolatility / baseVolatility);
      window.priceMomentum = window.priceMomentum * 0.90 + volatilityAdjustedNoise * 0.35;
      meanReversionPull = (fairPrice - currentLivePrice) * 0.002;
      const signedImbalance = window.liquidityImbalance || 0;
      scaledImbalance = Math.sign(signedImbalance) * Math.log1p(Math.abs(signedImbalance)) * 100;
      imbalancePull = scaledImbalance * 0.00015;
      orderFlowPull = orderFlowImbalance * 0.00025;
    }

    let move = secularDrift + window.priceMomentum + meanReversionPull + imbalancePull + volatilityAdjustedNoise + orderFlowPull;

    // Smoothly decay the liquidity imbalance over time
    window.liquidityImbalance *= 0.94;

    const decimals = window.activeInstrumentType === 'swap'
      ? 4
      : (window.activeInstrumentType === 'stock' ? (currentLivePrice < 1.0 ? 4 : 2) : 2);

    // 2. High probability of institutional blocks hitting the limit order book
    // REALISTIC MARKET BEHAVIOR: Reduced institutional activity during high volatility periods
    const baseTradeProbability = 0.08;
    const volatilityAdjustedProbability = baseTradeProbability / (currentVolatility / baseVolatility); // Lower probability during high volatility
    const adjustedTradeProbability = Math.max(0.02, Math.min(0.12, volatilityAdjustedProbability));

    if (Math.random() < adjustedTradeProbability) {
      const buyBias = 0.50 + Math.max(-0.4, Math.min(0.4, scaledImbalance * 0.0015));

      // REALISTIC MARKET BEHAVIOR: Order flow affects buy/sell bias during drawdown
      const drawdownAdjustedBias = buyBias + (orderFlowImbalance * 0.3); // Dividend capture creates sell bias
      const isBuy = Math.random() < drawdownAdjustedBias;

      // REALISTIC MARKET BEHAVIOR: Smaller trade sizes during high volatility
      const volatilitySizeAdjustment = 1.0 / (currentVolatility / baseVolatility);
      const baseTradeQty = Math.floor(50 + Math.random() * 550);
      const tradeQty = Math.floor(baseTradeQty * volatilitySizeAdjustment);

      if (isBuy) {
        // Walk asks
        let remaining = tradeQty;
        let finalPrice = currentLivePrice;
        for (let ask of orderBook.asks) {
          if (remaining <= 0) break;
          const fill = Math.min(remaining, ask.size);
          ask.size -= fill;
          remaining -= fill;
          finalPrice = ask.price;
        }
        window.continuousPrice = finalPrice;
        currentLivePrice = parseFloat(window.continuousPrice.toFixed(decimals));
        window.liquidityImbalance += tradeQty * 0.15;

        if (remaining > 0) {
          const lastAskPrice = orderBook.asks[orderBook.asks.length - 1]?.price || currentLivePrice;
          const penaltyPrice = lastAskPrice + specs.tickSize * 2;
          window.continuousPrice = penaltyPrice;
          currentLivePrice = parseFloat(window.continuousPrice.toFixed(decimals));
        }
        recentTrades.push({ time: formatTime(new Date()), side: 'BUY', qty: tradeQty, price: currentLivePrice, source: 'INST' });
        if (currentTradingStateData && window.activeInstrumentType !== 'swap') {
          window.calculateTradeFeeAndRecord('INST', currentTradingStateData.id, 'BUY', tradeQty, currentLivePrice, false, 0, window.activeInstrumentType);
        }
      } else {
        // 🔒 Skip institutional SELL trades during drawdown cooldown
        const now = Date.now();
        if (now < drawdownCooldownExpiry && window.activeInstrumentType !== 'swap') {
          // Skip this SELL trade and try again next tick
          return;
        }

        // Walk bids
        let remaining = tradeQty;
        let finalPrice = currentLivePrice;
        for (let bid of orderBook.bids) {
          if (remaining <= 0) break;
          const fill = Math.min(remaining, bid.size);
          bid.size -= fill;
          remaining -= fill;
          finalPrice = bid.price;
        }
        window.continuousPrice = finalPrice;
        currentLivePrice = parseFloat(window.continuousPrice.toFixed(decimals));
        window.liquidityImbalance -= tradeQty * 0.15;

        if (remaining > 0) {
          const lastBidPrice = orderBook.bids[orderBook.bids.length - 1]?.price || currentLivePrice;
          const penaltyPrice = lastBidPrice - specs.tickSize * 2;
          window.continuousPrice = penaltyPrice;
          currentLivePrice = parseFloat(window.continuousPrice.toFixed(decimals));
        }
        recentTrades.push({ time: formatTime(new Date()), side: 'SELL', qty: tradeQty, price: currentLivePrice, source: 'INST' });
        if (currentTradingStateData && window.activeInstrumentType !== 'swap') {
          window.calculateTradeFeeAndRecord('INST', currentTradingStateData.id, 'SELL', tradeQty, currentLivePrice, false, 0, window.activeInstrumentType);
        }
      }
    } else {
      window.continuousPrice += move;
      currentLivePrice = parseFloat(window.continuousPrice.toFixed(decimals));
    }

    const floorPrice = window.activeInstrumentType === 'swap' ? 0.0001 : (window.activeInstrumentType === 'stock' ? 0.000001 : 0.01);
    if (currentLivePrice < floorPrice) {
      currentLivePrice = floorPrice;
      window.continuousPrice = floorPrice;
    }

    // Flashing visual active price in terminal
    const priceEl = document.getElementById('trading-price');
    if (priceEl) {
      const prevPrice = parseFloat(priceEl.textContent.replace(/[$,]/g, '')) || 0;
      if (currentLivePrice !== prevPrice) {
        const formattedPrice = window.activeInstrumentType === 'swap'
          ? currentLivePrice.toFixed(4)
          : `$${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
        priceEl.textContent = formattedPrice;
        priceEl.classList.remove('price-flash-up', 'price-flash-down');
        void priceEl.offsetWidth; // Trigger reflow
        priceEl.classList.add(currentLivePrice >= prevPrice ? 'price-flash-up' : 'price-flash-down');
      }
    }

    // Update swap-specific UI elements
    if (window.activeInstrumentType === 'swap') {
      const ratioDispEl = document.getElementById('swap-eoi-ratio-display');
      if (ratioDispEl) {
        const countryA = window.activeSwapPair ? window.activeSwapPair.countryA : 'us';
        const countryB = window.activeSwapPair ? window.activeSwapPair.countryB : 'cn';
        const cA = getCountryById(countryA) || { id: 'us', name: 'United States', eoi: 215.0 };
        const cB = getCountryById(countryB) || { id: 'cn', name: 'China', eoi: 185.5 };
        ratioDispEl.textContent = `EOI: ${cA.eoi.toFixed(1)} ÷ ${cB.eoi.toFixed(1)} = ${currentLivePrice.toFixed(4)}`;
      }
    }


    // 3. Replenish depth and redraw order book
    replenishOrderBook();
    renderOrderBook();

    // 4. Mutate the active candlestick in real-time
    if (currentChartData.length > 0) {
      const activeCandle = currentChartData[currentChartData.length - 1];
      activeCandle.close = currentLivePrice;
      if (currentLivePrice > activeCandle.high) activeCandle.high = currentLivePrice;
      if (currentLivePrice < activeCandle.low) activeCandle.low = currentLivePrice;

      // 5. Scroll candlesticks every 40 ticks
      window.tickCounter++;
      if (window.tickCounter >= 40) {
        window.tickCounter = 0;
        const newTime = formatTime(new Date());

        currentChartData.push({
          time: newTime,
          open: currentLivePrice,
          high: currentLivePrice,
          low: currentLivePrice,
          close: currentLivePrice
        });

        if (window.chartScrollOffset > 0) {
          window.chartScrollOffset++;
        }

        if (currentChartData.length > 1000) {
          currentChartData.shift();
          if (window.chartScrollOffset > 0) {
            window.chartScrollOffset--;
          }
        }
      }

      drawChart();
    }

    updateOrderSummary();
    renderPositions();
  }, 250);
}

function startGlobalBackgroundSimulation() {
  if (backgroundSimInterval) clearInterval(backgroundSimInterval);

  backgroundSimInterval = setInterval(() => {
    // Pick a random state from the 50 states
    const randomState = statesData[Math.floor(Math.random() * statesData.length)];

    // Skip if it is the currently active selected state (it has its own high-frequency order book loop)
    if (currentTradingStateData && randomState.id === currentTradingStateData.id) {
      return;
    }

    // Pick a random side and quantity
    const side = Math.random() < 0.52 ? 'BUY' : 'SELL'; // Slight bullish bias matching general GDP drift

    // 🔒 Skip SELL trades during drawdown cooldown
    if (side === 'SELL') {
      const now = Date.now();
      if (now < drawdownCooldownExpiry) {
        // Skip this SELL trade and try again next tick
        return;
      }
    }

    const qty = Math.floor(50 + Math.random() * 550);

    // Calculate a realistic price with slight intraday variance
    const eoi = calculateEOI(randomState);
    const basePrice = eoi * CONTRACT_SPECS.pricingScale;
    const tickVariance = (Math.random() * 8 - 4) * CONTRACT_SPECS.tickSize; // ±4 ticks variance
    const price = parseFloat(Math.max(0.01, basePrice + tickVariance).toFixed(2));

    // Calculate and record clearing fee
    window.calculateTradeFeeAndRecord('INST', randomState.id, side, qty, price, false, 0);
  }, 1200); // Ticks every 1.2 seconds for an exceptionally active, alive transaction ledger
}

function updateStateWealthUI(state) {
  if (!state) return;
  const lockedValue = state.lockedValue || 0;
  const treasuryCash = state.sovereignFund || 0;
  // For stocks: 1.6% of locked value. For futures: 1.6% of investment index, capped by locked value
  let availableDrawdown;
  if (window.activeInstrumentType === 'stock') {
    availableDrawdown = lockedValue * 0.016;
  } else {
    availableDrawdown = Math.min((state.investment || 0) * 0.016 * 1000000, lockedValue);
  }
  const totalVolume = state.totalVolume || 0;

  const poolEl = document.getElementById('stat-sovereign-wealth-pool');
  const cashEl = document.getElementById('stat-treasury-cash');
  const reinvestEl = document.getElementById('stat-monthly-reinvestment');
  const volEl = document.getElementById('stat-accumulated-volume');
  const investEl = document.getElementById('stat-investment-inflow-index');

  if (poolEl) poolEl.textContent = `$${lockedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (cashEl) cashEl.textContent = `$${treasuryCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (reinvestEl) reinvestEl.textContent = `$${availableDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (volEl) volEl.textContent = `${totalVolume.toLocaleString()} contracts`;
  if (investEl) investEl.textContent = `${(state.investment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateStateMapColor(state) {
  if (!state) return;
  const path = document.getElementById(state.id);
  if (!path) return;

  const currentEOI = calculateEOI(state);
  const eois = statesData.map(s => calculateEOI(s));
  const minEoi = Math.min(...eois);
  const maxEoi = Math.max(...eois);

  const ratio = (currentEOI - minEoi) / (maxEoi - minEoi || 1);
  const hue = 220 - (ratio * 40);
  const lightness = 25 + (ratio * 35);
  path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;
}

// Optimized version that caches min/max EOI to avoid recalculating all states
let cachedMinEoi = null;
let cachedMaxEoi = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000; // 1 second cache

function updateStateMapColorOptimized(state) {
  if (!state) return;
  const path = document.getElementById(state.id);
  if (!path) return;

  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    const eois = statesData.map(s => calculateEOI(s));
    cachedMinEoi = Math.min(...eois);
    cachedMaxEoi = Math.max(...eois);
    cacheTimestamp = now;
  }

  const currentEOI = calculateEOI(state);
  const ratio = (currentEOI - cachedMinEoi) / (cachedMaxEoi - cachedMinEoi || 1);
  const hue = 220 - (ratio * 40);
  const lightness = 25 + (ratio * 35);
  path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;
}

// Update only the single table row instead of re-rendering entire table
function updateTableRow(state) {
  const row = document.querySelector(`.state-row[data-id="${state.id}"]`);
  if (!row) return;

  const eoi = calculateEOI(state);
  const futuresPrice = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
  const stockPrice = window.getStockPrice(state.id);
  const stockDecimals = stockPrice < 1.0 ? 4 : 2;
  const formattedFuturesPrice = parseFloat(futuresPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedStockPrice = stockPrice.toLocaleString(undefined, { minimumFractionDigits: stockDecimals, maximumFractionDigits: stockDecimals });

  const changePct = getDailyChangePct(state);
  const isUp = changePct >= 0;
  const changeText = isUp ? `+${changePct}%` : `${changePct}%`;
  const changeColor = isUp ? '#10b981' : '#ef4444';
  const arrow = isUp ? '▲' : '▼';

  const isStock = window.activeInstrumentType === 'stock';
  const ipoState = state.ipoStatus || 'pending';
  const ipoBadgeColor = ipoState === 'completed' ? '#10b981' : ipoState === 'running' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)';
  const ipoBadgeText = ipoState === 'completed' ? 'LIVE' : ipoState === 'running' ? 'RUNNING' : 'PENDING';

  const eoiCell = isStock
    ? `<span style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:3px;background:${ipoBadgeColor}18;border:1px solid ${ipoBadgeColor}44;color:${ipoBadgeColor};">${ipoBadgeText}</span>`
    : `${eoi}`;

  const priceCell = isStock
    ? `<span style="color:${ipoState === 'completed' ? '#10b981' : ipoState === 'running' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.35)'};">$${formattedStockPrice}</span>`
    : `<span style="color:var(--accent-blue);">$${formattedFuturesPrice}</span>`;

  // Update only the cells that change
  const cells = row.querySelectorAll('td');
  if (cells[5]) cells[5].innerHTML = priceCell; // Price column
  if (cells[6]) {
    cells[6].innerHTML = `${arrow} ${changeText}`;
    cells[6].style.color = changeColor;
  }
  if (cells[4]) cells[4].innerHTML = eoiCell; // EOI/IPO column
}

window.triggerSovereignDrawdown = () => {
  if (!currentTradingStateData) return;
  const state = statesData.find(s => s.id === currentTradingStateData.id);
  if (!state) return;

  // Verify the state's investment index is positive
  if (state.investment <= 0) return;

  // Calculate stock position value for this state
  const stockPositions = positions.filter(p => p.stateId === state.id && p.instrumentType === 'stock' && !p.isIPOPosition);
  const stockPositionValue = stockPositions.reduce((sum, pos) => {
    const currentPrice = window.getStockPrice(state.id);
    return sum + (currentPrice * pos.qty);
  }, 0);

  // If in stock mode, calculate 1.6% of locked value (liquidity pool) only
  // If in futures mode, calculate 1.6% of investment index
  let desiredPayout;
  if (window.activeInstrumentType === 'stock' && stockPositionValue > 0) {
    desiredPayout = (state.lockedValue || 0) * 0.016; // 1.6% of locked value (liquidity pool)
  } else {
    // Draw down 1.6% of the state's economic index (the 100% pool)
    const desiredIndexDeduction = parseFloat((state.investment * 0.016).toFixed(2));
    desiredPayout = desiredIndexDeduction * 1000000;
  }

  if (desiredPayout <= 0.01) {
    showNewsFlashAlert({
      id: ++newsIdCounter,
      stateId: state.id,
      sentiment: "Neutral",
      impactScore: 0,
      title: "Drawdown Limit Reached",
      description: `Sovereign index pool for ${state.name} is too low to execute a 1.6% yield drawdown.`
    });
    return;
  }

  // For stocks: payout is already 1.6% of locked value, no cap needed
  // For futures: cap payout by currently locked value
  let payoutDollars;
  if (window.activeInstrumentType === 'stock' && stockPositionValue > 0) {
    payoutDollars = desiredPayout;
  } else {
    payoutDollars = Math.min(desiredPayout, state.lockedValue || 0);
  }

  if (payoutDollars <= 0) {
    showNewsFlashAlert({
      id: ++newsIdCounter,
      stateId: state.id,
      sentiment: "Neutral",
      impactScore: 0,
      title: "No Locked Value Available",
      description: `Sovereign wealth pool for ${state.name} has no locked value available for drawdown. Execute trades to lock value first.`
    });
    return;
  }

  // For stocks: only deduct from locked value, not investment index
  // For futures: deduct from both investment index and locked value
  let previousInvestment = state.investment;
  if (window.activeInstrumentType === 'stock' && stockPositionValue > 0) {
    // Stock mode: don't touch investment index, only locked value
    previousInvestment = state.investment; // No change to investment index
  } else {
    // Futures mode: calculate actual index deduction matching the capped payout dollars
    const actualIndexDeduction = parseFloat((payoutDollars / 1000000).toFixed(2));
    if (actualIndexDeduction <= 0.01) {
      showNewsFlashAlert({
        id: ++newsIdCounter,
        stateId: state.id,
        sentiment: "Neutral",
        impactScore: 0,
        title: "Insufficient Locked Value",
        description: `Sovereign wealth pool for ${state.name} has insufficient locked value ($${(state.lockedValue || 0).toLocaleString()}) to execute a drawdown.`
      });
      return;
    }
    state.investment = parseFloat((state.investment - actualIndexDeduction).toFixed(2));
  }

  // Subtract the payout from the locked value pool and transfer to treasury cash
  state.lockedValue = parseFloat((state.lockedValue - payoutDollars).toFixed(2));
  state.sovereignFund = (state.sovereignFund || 0) + payoutDollars;

  // Calculate current EOI
  const eoi = calculateEOI(state);

  // Calculate ex-dividend price drop based on EOI shift (only for futures)
  let priceDrop = 0;
  if (window.activeInstrumentType !== 'stock' || stockPositionValue === 0) {
    const prevEOI = calculateEOI({ ...state, investment: previousInvestment });
    priceDrop = parseFloat(((prevEOI - eoi) * CONTRACT_SPECS.pricingScale).toFixed(2));
  }

  // If this is the active trading contract, trigger real-time ex-dividend price drop and liquidity drain
  if (currentTradingStateData && state.id === currentTradingStateData.id) {
    currentLivePrice = Math.max(0.01, parseFloat((currentLivePrice - priceDrop).toFixed(2)));
    window.continuousPrice = currentLivePrice;

    // Trigger a 60% liquidity contraction (order book sizes fall to 40%) representing market makers backing away
    window.liquidityContraction = 0.40;

    // REALISTIC MARKET BEHAVIOR: Volatility spike during drawdown (GARCH-like behavior)
    // Markets show increased volatility after ex-dividend events due to uncertainty
    const volatilitySpikeFactor = 2.5; // 2.5x volatility spike during drawdown
    drawdownVolatilitySpike = baseVolatility * (volatilitySpikeFactor - 1);
    currentVolatility = baseVolatility * volatilitySpikeFactor;
    drawdownTimestamp = Date.now();

    // REALISTIC MARKET BEHAVIOR: Bid-ask spread widening
    // Market makers widen spreads during periods of uncertainty
    bidAskSpreadMultiplier = 2.5; // 2.5x wider spreads initially

    // REALISTIC MARKET BEHAVIOR: Order flow imbalance from dividend capture strategies
    // Traders who captured the dividend may sell, creating temporary sell pressure
    orderFlowImbalance = -0.3; // Initial sell-side imbalance (-30%)

    // REALISTIC MARKET BEHAVIOR: Enhanced momentum impact adjusted for volatility
    // Higher volatility = larger potential price swings
    const volatilityAdjustedMomentum = -CONTRACT_SPECS.tickSize * 8 * (currentVolatility / baseVolatility);
    window.priceMomentum = (window.priceMomentum || 0) + volatilityAdjustedMomentum;

    // REALISTIC MARKET BEHAVIOR: Post-drawdown recovery dynamics
    // Volatility and spreads decay gradually over time (mean reversion)
    postDrawdownRecoveryFactor = 1.0; // Start at full recovery needed

    // Instantly regenerate and redraw the book reflecting the ex-dividend adjustment and liquidity drain
    generateOrderBook(currentLivePrice);
    renderOrderBook();
    updateOrderSummary();
  }

  // Recalculate EOI, national EOI sum, and prices (optimized - use cached total if available)
  totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);
  const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
  const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Batch DOM updates for better performance
  requestAnimationFrame(() => {
    const eoiValEl = document.getElementById('eoi-value');
    const priceEl = document.getElementById('contract-price');
    const sharePriceEl = document.getElementById('share-price');
    const growthEl = document.getElementById('stat-growth');
    const empEl = document.getElementById('stat-employment');
    const infEl = document.getElementById('stat-inflation');

    if (eoiValEl) eoiValEl.textContent = eoi;
    if (priceEl) priceEl.textContent = `$${formattedPrice}`;
    
    // Update share price
    const sharePrice = window.getStockPrice(state.id);
    const shareDecimals = sharePrice < 1.0 ? 4 : 2;
    const formattedSharePrice = sharePrice.toLocaleString(undefined, { minimumFractionDigits: shareDecimals, maximumFractionDigits: shareDecimals });
    if (sharePriceEl) sharePriceEl.textContent = `$${formattedSharePrice}`;
    
    if (growthEl) growthEl.textContent = `${state.growth}%`;
    if (empEl) empEl.textContent = `${state.employment}%`;
    if (infEl) infEl.textContent = `${state.inflation}%`;

    // Update Payout Simulation details based on new national proportions
    const stateProportion = eoi / totalNationalEOI;
    const stateInjectionAmount = 50_000_000_000_000 * stateProportion;
    const split = getPayoutSplit(stateInjectionAmount);

    const vol24hEl = document.getElementById('market-24h-vol');
    const avg7dEl = document.getElementById('market-7d-avg');
    const oiEl = document.getElementById('market-oi');
    const outstandingEl = document.getElementById('market-outstanding');

    if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, stateProportion);
    if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, stateProportion);
    if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
    if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);

    const federalPayoutEl = document.getElementById('federal-payout');
    if (federalPayoutEl) federalPayoutEl.textContent = formatCurrency(split.federal);

    const publicPayoutEl = document.getElementById('public-payout');
    if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

    const publicDrawdown = stateInjectionAmount * 0.016;
    const drawdownEl = document.getElementById('public-drawdown-payout');
    if (drawdownEl) {
      drawdownEl.textContent = formatCurrency(publicDrawdown);
    }
  });

  // Refresh rankings table, sidebar details, and map color (optimized - only update affected state)
  updateStateWealthUI(state);
  updateStateMapColorOptimized(state);
  updateTableRow(state);

  // Generate social program allocations for this drawdown
  const socialAllocations = generateSocialProgramAllocations(payoutDollars);

  // Record each social program allocation in the ledger (async, non-blocking)
  const ledgerPromises = socialAllocations.map(allocation => {
    return ledger.addRecord({
      category: allocation.category,
      amount: allocation.amount,
      agency: 'State Treasury Dept',
      region: state.id,
      description: `Drawdown 1.6% Sovereign Yield - ${allocation.program}: Allocated $${allocation.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${(allocation.percentage * 100).toFixed(1)}%) from sovereign yield. Investment Inflow index adjusted ex-dividend: ${previousInvestment} -> ${state.investment}`
    });
  });

  // Also record the total drawdown summary
  ledgerPromises.push(
    ledger.addRecord({
      category: 'Infrastructure',
      amount: payoutDollars,
      agency: 'State Treasury Dept',
      region: state.id,
      description: `Drawdown 1.6% Sovereign Yield Summary: Total $${payoutDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })} distributed across ${socialAllocations.length} social programs. Investment Inflow index adjusted ex-dividend: ${previousInvestment} -> ${state.investment}`
    })
  );

  Promise.all(ledgerPromises).then(() => {
    // Defer ledger UI refresh to avoid blocking
    requestAnimationFrame(() => initLedgerUI());
  });

  // Spawn a live economic news flash alert
  const topPrograms = socialAllocations.slice(0, 3).map(p => p.program).join(', ');
  const newsStory = {
    id: ++newsIdCounter,
    stateId: state.id,
    sentiment: "Bullish",
    impactScore: -16, // Simulates immediate market ex-dividend downward pressure
    title: `SGA Yield Drawdown: ${state.name}`,
    description: `State Treasury department successfully drew down 1.6% of the sovereign index pool, transferring $${payoutDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })} cash from locked reserves into public treasury.`
  };

  // Push to news list and update badge (deferred for performance)
  requestAnimationFrame(() => {
    newsData.unshift(newsStory);
    if (newsData.length > 100) {
      newsData.pop();
    }
    const badgeEl = document.getElementById('header-news-count');
    if (badgeEl) {
      badgeEl.textContent = String(newsData.length);
    }

    showNewsFlashAlert(newsStory);
  });

  // 🔒 Activate 10-minute short-selling restriction after drawdown yield
  const DRAWDOWN_SHORT_RESTRICTION_MS = 10 * 60 * 1000; // 10 minutes
  drawdownCooldownExpiry = Date.now() + DRAWDOWN_SHORT_RESTRICTION_MS;

  // Update SELL button visual to indicate cooldown is active (deferred)
  requestAnimationFrame(() => {
    updateShortRestrictionUI();
    showTradeNotification(
      `⚡ DRAWDOWN COMPLETE — 🔒 SHORT POSITIONS RESTRICTED FOR 5 MIN. Only LONG positions allowed during post-drawdown stabilization period.`,
      'warning'
    );
  });
}

// Updates the SELL/SHORT button visual state based on whether the drawdown cooldown is active
function updateShortRestrictionUI() {
  const sellBtn = document.querySelector('.sell-btn');
  if (!sellBtn) return;

  const now = Date.now();
  const isRestricted = now < drawdownCooldownExpiry;

  if (isRestricted) {
    const remainingSec = Math.ceil((drawdownCooldownExpiry - now) / 1000);
    const remainingMin = Math.floor(remainingSec / 60);
    const remainingSecDisplay = remainingSec % 60;
    sellBtn.style.opacity = '0.45';
    sellBtn.style.cursor = 'not-allowed';
    sellBtn.style.filter = 'grayscale(0.6)';
    sellBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    sellBtn.style.background = 'rgba(239, 68, 68, 0.05)';
    sellBtn.innerHTML = `
      <span style="font-size: 0.55rem; display: block; opacity: 0.8; margin-bottom: 2px; color: #ef4444;">🔒 RESTRICTED</span>
      ${remainingMin}m ${String(remainingSecDisplay).padStart(2,'0')}s
    `;

    // Re-check every second until the cooldown expires
    setTimeout(() => {
      if (Date.now() < drawdownCooldownExpiry) {
        updateShortRestrictionUI();
      } else {
        // Cooldown expired — restore normal state
        sellBtn.style.opacity = '';
        sellBtn.style.cursor = '';
        sellBtn.style.filter = '';
        sellBtn.style.borderColor = '';
        sellBtn.style.background = '';
        sellBtn.innerHTML = window.activeInstrumentType === 'stock'
          ? `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT SELL</span>SHORT`
          : `<span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>SELL`;
        showTradeNotification('✅ Short-selling restriction lifted. Normal trading resumed.', 'buy');
      }
    }, 1000);
  }
}

function updateOrderSummary() {
  const qtyEl = document.getElementById('order-qty');
  if (!qtyEl) return;
  const qty = parseInt(qtyEl.value.replace(/,/g, '')) || 1;
  const specs = getActiveSpecs();
  const notional = currentLivePrice * specs.multiplier * qty;
  const margin = notional * specs.initialMarginPct;

  // Get selected payment currency
  const currencySelect = document.getElementById('payment-currency');
  const selectedCurrency = currencySelect ? currencySelect.value : 'USD';

  // FX rates relative to USD
  const fxRates = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 149.50,
    'CAD': 1.36,
    'AUD': 1.53,
    'CHF': 0.89,
    'CNY': 7.24,
    'HKD': 7.81,
    'SGD': 1.35,
    'INR': 83.45,
    'SAR': 3.75,
    'AED': 3.67,
    'SEK': 10.52,
    'NOK': 10.85,
    'DKK': 6.85,
    'PLN': 3.95,
    'CZK': 23.15,
    'HUF': 365.5,
    'RON': 4.65,
    'RUB': 92.5,
    'UAH': 39.5,
    'TRY': 32.5,
    'ILS': 3.75,
    'KRW': 1378.5,
    'THB': 35.5,
    'IDR': 15750,
    'MYR': 4.75,
    'VND': 25350,
    'PHP': 56.5,
    'TWD': 31.5,
    'NZD': 1.65,
    'MXN': 17.5,
    'BRL': 5.15,
    'ARS': 850.5,
    'CLP': 980.5,
    'COP': 4150,
    'PEN': 3.75,
    'VES': 36.5,
    'ZAR': 18.75,
    'NGN': 1550,
    'EGP': 48.5,
    'MAD': 10.25,
    'KES': 155,
    'PKR': 280.5,
    'BDT': 110.5,
    'LKR': 320,
    'NPR': 133.5,
    'MMK': 2100,
    'KHR': 4150,
    'LAK': 21500,
    'BND': 1.35,
    'MVR': 15.5,
    'ISK': 140.5,
    'QAR': 3.65,
    'KWD': 0.31,
    'BHD': 0.38,
    'OMR': 0.39,
    'BGN': 1.85,
    'BAM': 1.85,
    'MKD': 58.5,
    'RSD': 105.5
  };

  const fxRate = fxRates[selectedCurrency] || 1.0;
  const currencySymbol = selectedCurrency === 'USD' ? '$' : 
                          selectedCurrency === 'EUR' ? '€' :
                          selectedCurrency === 'GBP' ? '£' :
                          selectedCurrency === 'JPY' ? '¥' :
                          selectedCurrency === 'CNY' ? '¥' :
                          selectedCurrency === 'HKD' ? 'HK$' :
                          selectedCurrency === 'SGD' ? 'S$' :
                          selectedCurrency === 'INR' ? '₹' :
                          selectedCurrency === 'SAR' ? 'SR' :
                          selectedCurrency === 'AED' ? 'AED' :
                          selectedCurrency === 'SEK' ? 'kr' :
                          selectedCurrency === 'NOK' ? 'kr' :
                          selectedCurrency === 'DKK' ? 'kr' :
                          selectedCurrency === 'PLN' ? 'zł' :
                          selectedCurrency === 'CZK' ? 'Kč' :
                          selectedCurrency === 'HUF' ? 'Ft' :
                          selectedCurrency === 'RON' ? 'lei' :
                          selectedCurrency === 'RUB' ? '₽' :
                          selectedCurrency === 'UAH' ? '₴' :
                          selectedCurrency === 'TRY' ? '₺' :
                          selectedCurrency === 'ILS' ? '₪' :
                          selectedCurrency === 'KRW' ? '₩' :
                          selectedCurrency === 'THB' ? '฿' :
                          selectedCurrency === 'IDR' ? 'Rp' :
                          selectedCurrency === 'MYR' ? 'RM' :
                          selectedCurrency === 'VND' ? '₫' :
                          selectedCurrency === 'PHP' ? '₱' :
                          selectedCurrency === 'TWD' ? 'NT$' :
                          selectedCurrency === 'NZD' ? 'NZ$' :
                          selectedCurrency === 'MXN' ? 'MX$' :
                          selectedCurrency === 'BRL' ? 'R$' :
                          selectedCurrency === 'ARS' ? 'AR$' :
                          selectedCurrency === 'CLP' ? 'CL$' :
                          selectedCurrency === 'COP' ? 'COL$' :
                          selectedCurrency === 'PEN' ? 'S/' :
                          selectedCurrency === 'VES' ? 'Bs.' :
                          selectedCurrency === 'ZAR' ? 'R' :
                          selectedCurrency === 'NGN' ? '₦' :
                          selectedCurrency === 'EGP' ? 'E£' :
                          selectedCurrency === 'MAD' ? 'DH' :
                          selectedCurrency === 'KES' ? 'KSh' :
                          selectedCurrency === 'PKR' ? '₨' :
                          selectedCurrency === 'BDT' ? '৳' :
                          selectedCurrency === 'LKR' ? 'Rs' :
                          selectedCurrency === 'NPR' ? '₨' :
                          selectedCurrency === 'MMK' ? 'K' :
                          selectedCurrency === 'KHR' ? '៛' :
                          selectedCurrency === 'LAK' ? '₭' :
                          selectedCurrency === 'BND' ? 'B$' :
                          selectedCurrency === 'MVR' ? 'Rf' :
                          selectedCurrency === 'ISK' ? 'kr' :
                          selectedCurrency === 'QAR' ? 'QR' :
                          selectedCurrency === 'KWD' ? 'KD' :
                          selectedCurrency === 'BHD' ? 'BD' :
                          selectedCurrency === 'OMR' ? '﷼' :
                          selectedCurrency === 'BGN' ? 'лв' :
                          selectedCurrency === 'BAM' ? 'КМ' :
                          selectedCurrency === 'MKD' ? 'ден' :
                          selectedCurrency === 'RSD' ? 'дин' :
                          selectedCurrency + ' ';

  // Convert values to selected currency
  const notionalInCurrency = notional * fxRate;
  const marginInCurrency = margin * fxRate;

  const notionalEl = document.getElementById('order-notional');
  const marginEl = document.getElementById('order-margin');
  const marginLabelEl = document.getElementById('order-margin-label');
  const feeEl = document.getElementById('order-fee');
  const feeSplitEl = document.getElementById('order-fee-split');
  const feeLabelEl = document.getElementById('order-fee-label');

  if (notionalEl) notionalEl.textContent = formatCurrencyWithSymbol(notionalInCurrency, selectedCurrency);
  if (marginEl) marginEl.textContent = formatCurrencyWithSymbol(marginInCurrency, selectedCurrency);

  if (marginLabelEl) {
    marginLabelEl.textContent = window.activeInstrumentType === 'stock' ? 'Required Cash (100%):' : 'Required Margin (10%):';
  }

  if (feeLabelEl) {
    feeLabelEl.textContent = `Transaction Fee:`;
  }

  // Get fee rate from saved settings or FeeSchedule
  let feeRate = 0.0005; // Default 0.05%
  
  // Try to get from saved additional fees
  if (window.additionalFees && window.additionalFees.futures !== undefined) {
    feeRate = window.additionalFees.futures / 100; // Convert percentage to decimal
  }
  // Try to get from FeeSchedule if available
  else if (window.sgaNetwork && window.sgaNetwork.feeSchedule) {
    const schedule = window.sgaNetwork.feeSchedule;
    // Check if there's a futures fee stored
    if (schedule.futuresFeeBps) {
      feeRate = schedule.futuresFeeBps / 10000; // Convert bps to decimal
    }
  }

  if (feeEl) {
    if (notional < 25000) {
      // FREE TIER under $25,000
      feeEl.textContent = `${currencySymbol}0.00 (Free < $25k)`;
      feeEl.style.color = '#10b981'; // Green for free
      if (feeSplitEl) feeSplitEl.style.display = 'none';
    } else {
      // CHARGED TIER: Apply configured fee rate on margin
      const feeInCurrency = (margin * feeRate) * fxRate;
      feeEl.textContent = `${currencySymbol}${feeInCurrency.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      feeEl.style.color = 'var(--accent-gold)'; // Gold for active fee
      if (feeSplitEl) feeSplitEl.style.display = 'none';
    }
  }
}

// Helper function to format currency with custom symbol
function formatCurrencyWithSymbol(amount, currency = 'USD') {
  const symbol = currency === 'USD' ? '$' : currency + ' ';
  return symbol + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function getMarkPrice(pos) {
  if (pos.instrumentType === 'swap') {
    if (window.activeInstrumentType === 'swap' && pos.pairKey === `${window.activeSwapPair.countryA}/${window.activeSwapPair.countryB}`) {
      return currentLivePrice;
    }
    return calculateSwapPrice(pos.countryA || 'us', pos.countryB || 'cn');
  }
  if (currentTradingStateData && pos.stateId === currentTradingStateData.id && pos.instrumentType === window.activeInstrumentType) {
    return currentLivePrice;
  }
  const sd = statesData.find(s => s.id === pos.stateId);
  if (!sd) return pos.entryPrice;
  if (pos.instrumentType === 'stock') {
    return window.getStockPrice(pos.stateId);
  }
  return parseFloat((calculateEOI(sd) * CONTRACT_SPECS.pricingScale).toFixed(2));
}

function renderPositions() {
  const tbody = document.getElementById('positions-body');
  const countEl = document.getElementById('position-count');
  const totalPnlEl = document.getElementById('total-pnl');
  const totalMarginEl = document.getElementById('total-margin');
  if (!tbody) return;
  if (positions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No open positions. Place a trade to begin.</td></tr>';
    if (countEl) countEl.textContent = '0';
    if (totalPnlEl) { totalPnlEl.textContent = '$0.00'; totalPnlEl.style.color = 'var(--text-secondary)'; }
    if (totalMarginEl) { totalMarginEl.textContent = '$0.00'; totalMarginEl.style.color = 'var(--text-secondary)'; }
    return;
  }
  let totalPnl = 0;
  let totalMargin = 0;
  let totalEntryNotional = 0;
  tbody.innerHTML = positions.map(pos => {
    const specs = getInstrumentSpecs(pos.instrumentType);
    const markPrice = getMarkPrice(pos);
    const priceDiff = pos.side === 'LONG' ? (markPrice - pos.entryPrice) : (pos.entryPrice - markPrice);
    const pnl = pos.instrumentType === 'stock'
      ? priceDiff * pos.qty
      : Math.round(priceDiff / specs.tickSize) * specs.tickValue * pos.qty;
    const margin = pos.entryPrice * specs.multiplier * pos.qty * specs.initialMarginPct;
    totalPnl += pnl;
    totalMargin += margin;
    if (!pos.isIPOPosition) {
      totalEntryNotional += pos.entryPrice * specs.multiplier * pos.qty;
    }
    const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
    const sideColor = pos.side === 'LONG' ? '#10b981' : '#ef4444';
    const instrumentColor = pos.instrumentType === 'swap' ? 'var(--accent-gold)' : 'var(--accent-blue)';

    // ── IPO pre-allocated positions (State / Fed) ──
    if (pos.isIPOPosition) {
      const pctReturn = ((markPrice - pos.entryPrice) / pos.entryPrice * 100);
      const pctStr = (pctReturn >= 0 ? '+' : '') + pctReturn.toLocaleString(undefined, { maximumFractionDigits: 0 }) + '%';
      const partyColor = pos.ipoParty === 'FED' ? '#38bdf8' : '#f59e0b';
      const partyIcon = pos.ipoParty === 'FED' ? '🏛️' : '🏛️';
      const qtyLabel = pos.qty >= 1e9 ? `${(pos.qty / 1e9).toFixed(0)}B sh.` : pos.qty.toLocaleString();
      const markStr = markPrice < 1 ? `$${markPrice.toFixed(4)}` : `$${markPrice.toFixed(2)}`;
      return `
        <tr style="background: rgba(${pos.ipoParty === 'FED' ? '56,189,248' : '245,158,11'},0.04); border-left: 2px solid ${partyColor}44;">
          <td style="font-weight: 600;">
            ${partyIcon} ${pos.label}
            <span style="font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; background: ${partyColor}22; border: 1px solid ${partyColor}44; color: ${partyColor}; font-weight: bold; margin-left: 4px;">PRE-IPO</span>
          </td>
          <td><span style="color: #10b981; font-weight: 700;">LONG</span></td>
          <td style="font-family:monospace; font-size:0.7rem;">${qtyLabel}</td>
          <td style="font-family: monospace;">$0.000001</td>
          <td style="font-family: monospace; color:${partyColor};">${markStr}</td>
          <td style="color: ${pnlColor}; font-weight: 700; font-family: monospace;">
            <span style="color:${pnlColor};">${pctStr}</span>
          </td>
          <td style="color: var(--text-secondary); font-size:0.65rem;">Gov. Equity</td>
          <td><span style="font-size:0.6rem; color:rgba(255,255,255,0.25);">Locked</span></td>
        </tr>
      `;
    }

    // ── Regular user positions ──
    const instrumentLabel = pos.instrumentType === 'swap' ? 'Swap' : (pos.instrumentType === 'stock' ? 'Shares' : 'Futures');
    const assetDisplayName = pos.instrumentType === 'swap' ? (pos.swapSymbol || pos.stateName) : `${pos.stateName}-SGA`;

    const rawPct = pos.side === 'LONG' ? ((markPrice - pos.entryPrice) / pos.entryPrice) : ((pos.entryPrice - markPrice) / pos.entryPrice);
    const pctReturn = rawPct * 100;
    const pctStr = (pctReturn >= 0 ? '+' : '') + pctReturn.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const entryDecimals = (pos.instrumentType === 'swap' || (pos.instrumentType === 'stock' && pos.entryPrice < 1.00)) ? 4 : 2;
    const markDecimals = (pos.instrumentType === 'swap' || (pos.instrumentType === 'stock' && markPrice < 1.00)) ? 4 : 2;

    const entryPricePrefix = pos.instrumentType === 'swap' ? '' : '$';
    const markPricePrefix = pos.instrumentType === 'swap' ? '' : '$';

    const entryPriceStr = entryPricePrefix + pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: entryDecimals, maximumFractionDigits: entryDecimals });
    const markPriceStr = markPricePrefix + markPrice.toLocaleString(undefined, { minimumFractionDigits: markDecimals, maximumFractionDigits: markDecimals });


    return `
      <tr>
        <td style="font-weight: 600;">
          ${assetDisplayName}
          <span style="font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; background: ${instrumentColor}22; border: 1px solid ${instrumentColor}44; color: ${instrumentColor}; font-weight: bold; margin-left: 4px;">
            ${instrumentLabel}
          </span>
        </td>
        <td><span style="color: ${sideColor}; font-weight: 700;">${pos.side}</span></td>
        <td>${pos.qty.toLocaleString()}</td>
        <td style="font-family: monospace;">${entryPriceStr}</td>
        <td style="font-family: monospace;">${markPriceStr}</td>
        <td style="color: ${pnlColor}; font-weight: 700; font-family: monospace; line-height: 1.25;">
          <div>${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style="font-size: 0.65rem; font-weight: 600; opacity: 0.85; margin-top: 1px;">${pctStr}</div>
        </td>
        <td style="color: var(--text-secondary); font-family: monospace;">${formatCurrency(margin)}</td>
        <td><button class="close-pos-btn" onmousedown="closePosition(${pos.id})" title="Close position">✕</button></td>
      </tr>
    `;
  }).join('');
  if (countEl) countEl.textContent = String(positions.length);
  if (totalPnlEl) {
    let totalPnlStr = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalEntryNotional > 0) {
      const totalPnlPct = (totalPnl / totalEntryNotional) * 100;
      const formattedTotalPnlPct = totalPnlPct.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      totalPnlStr += ` (${totalPnlPct >= 0 ? '+' : ''}${formattedTotalPnlPct}%)`;
    }
    totalPnlEl.textContent = totalPnlStr;
    totalPnlEl.style.color = totalPnl >= 0 ? '#10b981' : '#ef4444';
  }
  if (totalMarginEl) {
    totalMarginEl.textContent = formatCurrency(totalMargin);
    totalMarginEl.style.color = 'var(--text-primary)';
  }
}


window.calculateTradeFeeAndRecord = (party, stateId, side, qty, price, isClosing, realizedPnl, instrumentType = 'futures') => {
  const specs = getInstrumentSpecs(instrumentType);
  const multiplier = specs.multiplier;
  const notional = qty * price * multiplier;

  // Exchange fee: $0.05 per contract/share (if notional >= $25k)
  let finalFee = notional >= 25000 ? qty * 0.05 : 0;

  // Accumulate revenues
  window.clearingRevenue.total += finalFee;
  if (finalFee > 0) {
    window.clearingRevenue.totalTradesCount++;
  }

  // Update state-level volume, sovereign value locked (20% of gross trade notional), and real-time investment inflows
  const state = statesData.find(s => s.id === stateId);
  if (state) {
    state.totalVolume = (state.totalVolume || 0) + qty;

    // Directional capital flow: BUY = capital inflow (+), SELL = capital outflow (-)
    const direction = (side === 'BUY') ? 1 : -1;
    
    // Calculate sovereign yield contribution (20% of notional for both futures and stocks)
    const sovereignYieldContribution = notional * 0.20 * direction;
    state.lockedValue = Math.max(0, (state.lockedValue || 0) + sovereignYieldContribution);

    // Real-time investment inflows/outflows from trading volume
    const scale = 0.00000005; // $20 Million of trading volume adds 1.0 point to the Investment Index
    state.investment = parseFloat(Math.max(0, state.investment + (notional * scale * direction)).toFixed(2));

    // Recalculate national EOI sum
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    // If this is the currently selected state, update its details panel in real-time
    if (currentTradingStateData && state.id === currentTradingStateData.id) {
      const eoi = calculateEOI(state);
      const pr = (eoi * specs.pricingScale).toFixed(2);
      const formattedPrice = parseFloat(pr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const eoiValEl = document.getElementById('eoi-value');
      const priceEl = document.getElementById('contract-price');
      const sharePriceEl = document.getElementById('share-price');
      const growthEl = document.getElementById('stat-growth');
      const empEl = document.getElementById('stat-employment');
      const infEl = document.getElementById('stat-inflation');

      if (eoiValEl) eoiValEl.textContent = eoi;
      if (priceEl) priceEl.textContent = `$${formattedPrice}`;
      
      // Update share price
      const sharePrice = window.getStockPrice(state.id);
      const shareDecimals = sharePrice < 1.0 ? 4 : 2;
      const formattedSharePrice = sharePrice.toLocaleString(undefined, { minimumFractionDigits: shareDecimals, maximumFractionDigits: shareDecimals });
      if (sharePriceEl) sharePriceEl.textContent = `$${formattedSharePrice}`;
      
      if (growthEl) growthEl.textContent = `${state.growth}%`;
      if (empEl) empEl.textContent = `${state.employment}%`;
      if (infEl) infEl.textContent = `${state.inflation}%`;

      // Update Payout Simulation details based on new national proportions
      const stateProportion = eoi / totalNationalEOI;
      const stateInjectionAmount = 50_000_000_000_000 * stateProportion;
      const split = getPayoutSplit(stateInjectionAmount);

      const vol24hEl = document.getElementById('market-24h-vol');
      const avg7dEl = document.getElementById('market-7d-avg');
      const oiEl = document.getElementById('market-oi');
      const outstandingEl = document.getElementById('market-outstanding');

      if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, stateProportion);
      if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, stateProportion);
      if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
      if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);

      const federalPayoutEl = document.getElementById('federal-payout');
      if (federalPayoutEl) federalPayoutEl.textContent = formatCurrency(split.federal);

      const publicPayoutEl = document.getElementById('public-payout');
      if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

      const publicDrawdown = stateInjectionAmount * 0.016;
      const drawdownEl = document.getElementById('public-drawdown-payout');
      if (drawdownEl) {
        drawdownEl.textContent = formatCurrency(publicDrawdown);
      }

      // Update the wealth card details
      updateStateWealthUI(state);
      updateStateMapColor(state);
    }
  }

  // Create transaction log entry
  const tx = {
    timestamp: new Date(),
    stateId: stateId,
    party: party,
    side: side,
    qty: qty,
    price: price,
    notional: notional,
    fee: finalFee,
    realizedPnl: realizedPnl,
    isClosing: isClosing,
    instrumentType: instrumentType
  };


  window.allTransactions.unshift(tx); // Newest first

  // Keep last 100 entries to prevent memory leak
  if (window.allTransactions.length > 100) {
    window.allTransactions.pop();
  }

  // Trigger UI updates
  renderTransactions();
  renderClearingRevenue();
};

window.setTxFilter = (filterType) => {
  window.txFilter = filterType;

  // Update button active states
  const btnAll = document.getElementById('tx-filter-all');
  const btnUser = document.getElementById('tx-filter-user');

  if (btnAll && btnUser) {
    if (filterType === 'all') {
      btnAll.classList.add('active');
      btnAll.style.background = 'rgba(251, 191, 36, 0.15)';
      btnAll.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      btnAll.style.color = 'var(--accent-gold)';

      btnUser.classList.remove('active');
      btnUser.style.background = 'transparent';
      btnUser.style.borderColor = 'transparent';
      btnUser.style.color = 'var(--text-secondary)';
    } else {
      btnUser.classList.add('active');
      btnUser.style.background = 'rgba(251, 191, 36, 0.15)';
      btnUser.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      btnUser.style.color = 'var(--accent-gold)';

      btnAll.classList.remove('active');
      btnAll.style.background = 'transparent';
      btnAll.style.borderColor = 'transparent';
      btnAll.style.color = 'var(--text-secondary)';
    }
  }

  renderTransactions();
};

function renderTransactions() {
  const tbody = document.getElementById('transactions-body');
  if (!tbody) return;

  const filtered = window.allTransactions.filter(tx => {
    if (window.txFilter === 'user') {
      return tx.party === 'USER';
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Awaiting clearing house transactions...</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const formattedTime = formatTime(tx.timestamp);
    const sideColor = tx.side === 'BUY' ? '#10b981' : '#ef4444';

    // Formatting Fee string
    const fee = tx.fee || 0;
    const feeStr = `<div style="display: flex; flex-direction: column; font-size: 0.68rem; gap: 0.1rem; line-height: 1.25; text-align: left;">
          <span style="color: var(--accent-gold); font-weight: bold; font-family: monospace;">$${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>`;

    const partyColor = tx.party === 'USER' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)';
    const partyLabel = tx.party === 'USER' ? 'YOU' : 'INST';

    const instrumentLabel = tx.instrumentType === 'stock' ? 'Stock' : 'Futures';
    const instrumentColor = 'var(--accent-blue)';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.01);">
        <td style="color: var(--text-secondary); font-family: monospace; font-size: 0.7rem;">${formattedTime}</td>
        <td style="font-weight: 600;">
          ${tx.stateId}-SGA
          <span style="font-size: 0.55rem; padding: 1px 3px; border-radius: 2px; background: ${instrumentColor}22; border: 1px solid ${instrumentColor}44; color: ${instrumentColor}; font-weight: bold; margin-left: 2px;">
            ${instrumentLabel}
          </span>
        </td>
        <td><span style="color: ${partyColor}; font-weight: bold; padding: 1px 4px; background: rgba(255,255,255,0.05); border-radius: 2px; font-size: 0.6rem;">${partyLabel}</span></td>
        <td><span style="color: ${sideColor}; font-weight: 700;">${tx.side}</span></td>
        <td>${tx.qty.toLocaleString()}</td>
        <td style="font-family: monospace;">$${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family: monospace; color: var(--text-primary);">${formatCurrency(tx.notional)}</td>
        <td>${feeStr}</td>
      </tr>
    `;
  }).join('');
}

function renderClearingRevenue() {
  const totalEl = document.getElementById('revenue-total');

  if (totalEl) totalEl.textContent = `$${window.clearingRevenue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTradeHistory() {
  const tbody = document.getElementById('trade-history-body');
  const countEl = document.getElementById('history-count');
  const totalPnlEl = document.getElementById('history-total-pnl');
  const totalFeesEl = document.getElementById('history-total-fees');
  const winRateEl = document.getElementById('history-win-rate');
  const totalVolumeEl = document.getElementById('history-total-volume');
  const bestTradeEl = document.getElementById('history-best-trade');
  const worstTradeEl = document.getElementById('history-worst-trade');

  if (!tbody) return;

  const trades = window.userTradeHistory;
  if (trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">No closed trades yet. Open and close a position to see your history.</td></tr>';
    return;
  }

  // Compute summary stats
  let totalPnl = 0, totalFees = 0, totalVolume = 0;
  let wins = 0, bestPnl = -Infinity, worstPnl = Infinity;

  trades.forEach(t => {
    totalPnl += t.realizedPnl;
    totalFees += t.fee;
    totalVolume += t.notional;
    if (t.realizedPnl > 0) wins++;
    if (t.realizedPnl > bestPnl) bestPnl = t.realizedPnl;
    if (t.realizedPnl < worstPnl) worstPnl = t.realizedPnl;
  });

  const winRate = ((wins / trades.length) * 100).toFixed(1);

  // Update summary header
  if (countEl) countEl.textContent = trades.length;
  if (totalPnlEl) {
    totalPnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalPnlEl.style.color = totalPnl >= 0 ? '#10b981' : '#ef4444';
  }
  if (totalFeesEl) totalFeesEl.textContent = `$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (winRateEl) {
    winRateEl.textContent = `${winRate}%`;
    winRateEl.style.color = parseFloat(winRate) >= 50 ? '#10b981' : '#ef4444';
  }

  // Update summary cards
  if (totalVolumeEl) totalVolumeEl.textContent = formatCurrency(totalVolume);
  if (bestTradeEl) bestTradeEl.textContent = `+$${bestPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (worstTradeEl) worstTradeEl.textContent = `${worstPnl >= 0 ? '+' : ''}$${worstPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Render table rows
  tbody.innerHTML = trades.map(t => {
    const formattedTime = formatTime(t.timestamp);
    const sideColor = t.side === 'LONG' ? '#10b981' : '#ef4444';
    const pnlColor = t.realizedPnl >= 0 ? '#10b981' : '#ef4444';
    const romPct = (t.returnOnMargin * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const romColor = t.returnOnMargin >= 0 ? '#10b981' : '#ef4444';

    const assetLabel = t.instrumentType === 'swap' ? (t.swapSymbol || t.stateId) : `${t.stateId}-SGA`;
    const instrumentLabel = t.instrumentType === 'swap' ? 'Swap' : (t.instrumentType === 'stock' ? 'Stock' : 'Futures');
    const instrumentColor = t.instrumentType === 'swap' ? 'var(--accent-gold)' : 'var(--accent-blue)';
    const priceDecimals = (t.instrumentType === 'swap' || (t.instrumentType === 'stock' && t.entryPrice < 1.0)) ? 4 : 2;
    const pricePrefix = t.instrumentType === 'swap' ? '' : '$';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
        <td style="color: var(--text-secondary); font-family: monospace; font-size: 0.7rem; padding: 0.5rem 0.75rem;">${formattedTime}</td>
        <td style="font-weight: 600; padding: 0.5rem 0.75rem;">
          ${assetLabel}
          <span style="font-size: 0.55rem; padding: 1px 3px; border-radius: 2px; background: ${instrumentColor}22; border: 1px solid ${instrumentColor}44; color: ${instrumentColor}; font-weight: bold; margin-left: 2px;">
            ${instrumentLabel}
          </span>
        </td>
        <td style="padding: 0.5rem 0.75rem;"><span style="color: ${sideColor}; font-weight: 700;">${t.side}</span></td>
        <td style="padding: 0.5rem 0.75rem;">${t.qty.toLocaleString()}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem;">${pricePrefix}${t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem;">${pricePrefix}${t.exitPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem; color: var(--text-secondary);">${formatCurrency(t.notional)}</td>
        <td style="color: ${pnlColor}; font-weight: 700; font-family: monospace; padding: 0.5rem 0.75rem;">${t.realizedPnl >= 0 ? '+' : ''}$${t.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="color: ${romColor}; font-weight: 600; font-family: monospace; padding: 0.5rem 0.75rem;">${romPct}%</td>
        <td style="padding: 0.5rem 0.75rem;">
          <div style="display: flex; flex-direction: column; font-size: 0.65rem; gap: 0.1rem; line-height: 1.2;">
            <span style="color: var(--accent-gold); font-weight: bold; font-family: monospace;">$${t.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function showTradeNotification(message, type) {
  const existing = document.querySelector('.trade-notification');
  if (existing) existing.remove();
  const notif = document.createElement('div');
  notif.className = `trade-notification trade-notif-${type}`;
  notif.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(notif);
  requestAnimationFrame(() => notif.classList.add('show'));
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 400);
  }, 4000);
}

function initTradingTerminal() {
  window.populateSwapCountryDropdowns();

  const orderType = document.getElementById('order-type');
  const limitField = document.getElementById('limit-price-field');
  if (orderType && limitField) {
    orderType.addEventListener('change', () => {
      limitField.style.display = orderType.value !== 'market' ? 'block' : 'none';
    });
  }
  const qtyInput = document.getElementById('order-qty');
  if (qtyInput) {
    qtyInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = Math.min(999999999, parseInt(cleanVal, 10)).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);

      updateOrderSummary();
    });
  }
  const expiry = getNextExpiry();
  const specExpiry = document.getElementById('spec-expiry');
  if (specExpiry) specExpiry.textContent = expiry.label;
}

window.executeTrade = (type) => {
  const isSwap = window.activeInstrumentType === 'swap';
  if (!isSwap && !currentTradingStateData) {
    showTradeNotification('Select a state contract first.', 'error');
    return;
  }

  // 🔒 Post-drawdown short-selling restriction (10 min lock-out after 1.6% yield drawdown)
  if (type === 'sell' && !isSwap) {
    const now = Date.now();
    if (now < drawdownCooldownExpiry) {
      const remainingSec = Math.ceil((drawdownCooldownExpiry - now) / 1000);
      const remainingMin = Math.floor(remainingSec / 60);
      const remainingSecDisplay = remainingSec % 60;
      showTradeNotification(
        `🚫 SHORT RESTRICTED — Post-Drawdown Cooldown Active: ${remainingMin}m ${remainingSecDisplay}s remaining. Only LONG positions allowed after a 1.6% sovereign yield drawdown.`,
        'error'
      );
      return;
    }
  }

  const orderType = document.getElementById('order-type').value;
  const qty = parseInt(document.getElementById('order-qty').value.replace(/,/g, '')) || 1;
  
  // Get selected payment currency for FX detection
  const currencySelect = document.getElementById('payment-currency');
  const selectedCurrency = currencySelect ? currencySelect.value : 'USD';
  const isNonNativeCurrency = selectedCurrency !== 'USD';
  
  const specs = getActiveSpecs();
  let tickSize = specs.tickSize;
  let tickValue = specs.tickValue;
  if (window.activeInstrumentType === 'stock' && currentLivePrice < 1.00) {
    tickSize = 0.0001;
    tickValue = 0.0001;
  }
  let fillPrice;
  let slippage = 0;

  if (orderType === 'market') {
    let remaining = qty;
    let totalNotional = 0;

    if (type === 'buy') {
      const originalBestPrice = orderBook.asks[0]?.price || currentLivePrice;

      // Sweeping Asks (Buy fills against Ask orders)
      for (let ask of orderBook.asks) {
        if (remaining <= 0) break;
        const fill = Math.min(remaining, ask.size);
        totalNotional += fill * ask.price * specs.multiplier;
        ask.size -= fill;
        remaining -= fill;
        currentLivePrice = ask.price; // sweep physically impacts price
      }

      // If we completely exhaust LOB asks, fill remaining size with high-slippage penalty
      if (remaining > 0) {
        const lastAskPrice = orderBook.asks[orderBook.asks.length - 1]?.price || currentLivePrice;
        const penaltyPrice = lastAskPrice + tickSize * 2;
        totalNotional += remaining * penaltyPrice * specs.multiplier;
        currentLivePrice = penaltyPrice;
      }

      fillPrice = totalNotional / (qty * specs.multiplier);
      slippage = fillPrice - originalBestPrice;

      // Synchronize continuous price and inject positive imbalance for buyer impact
      window.continuousPrice = currentLivePrice;
      window.liquidityImbalance = (window.liquidityImbalance || 0) + qty * 0.4;

      recentTrades.push({
        time: formatTime(new Date()),
        side: 'BUY',
        qty: qty,
        price: fillPrice,
        source: 'USER'
      });

    } else {
      const originalBestPrice = orderBook.bids[0]?.price || currentLivePrice;

      // Sweeping Bids (Sell fills against Bid orders)
      for (let bid of orderBook.bids) {
        if (remaining <= 0) break;
        const fill = Math.min(remaining, bid.size);
        totalNotional += fill * bid.price * specs.multiplier;
        bid.size -= fill;
        remaining -= fill;
        currentLivePrice = bid.price; // sweep physically impacts price
      }

      if (remaining > 0) {
        const lastBidPrice = orderBook.bids[orderBook.bids.length - 1]?.price || currentLivePrice;
        const penaltyPrice = lastBidPrice - tickSize * 2;
        totalNotional += remaining * penaltyPrice * specs.multiplier;
        currentLivePrice = penaltyPrice;
      }

      fillPrice = totalNotional / (qty * specs.multiplier);
      slippage = originalBestPrice - fillPrice;

      // Synchronize continuous price and inject negative imbalance for seller impact
      window.continuousPrice = currentLivePrice;
      window.liquidityImbalance = (window.liquidityImbalance || 0) - qty * 0.4;

      recentTrades.push({
        time: formatTime(new Date()),
        side: 'SELL',
        qty: qty,
        price: fillPrice,
        source: 'USER'
      });
    }

    const fillDecimals = (isSwap || (window.activeInstrumentType === 'stock' && fillPrice < 1.00)) ? 4 : 2;
    const liveDecimals = (isSwap || (window.activeInstrumentType === 'stock' && currentLivePrice < 1.00)) ? 4 : 2;
    fillPrice = parseFloat(fillPrice.toFixed(fillDecimals));
    currentLivePrice = parseFloat(currentLivePrice.toFixed(liveDecimals));
    slippage = Math.max(0, parseFloat(slippage.toFixed(2)));

    // Instantly replenish and redraw the book reflecting user's market sweep
    replenishOrderBook();
    renderOrderBook();

  } else {
    // 🔒 Post-drawdown short-selling restriction for limit orders
    if (type === 'sell' && !isSwap) {
      const now = Date.now();
      if (now < drawdownCooldownExpiry) {
        const remainingSec = Math.ceil((drawdownCooldownExpiry - now) / 1000);
        const remainingMin = Math.floor(remainingSec / 60);
        const remainingSecDisplay = remainingSec % 60;
        showTradeNotification(
          `🚫 SHORT RESTRICTED — Post-Drawdown Cooldown Active: ${remainingMin}m ${remainingSecDisplay}s remaining. Only LONG positions allowed after a 1.6% sovereign yield drawdown.`,
          'error'
        );
        return;
      }
    }

    const limitVal = parseFloat(document.getElementById('limit-price').value);
    if (isNaN(limitVal) || limitVal <= 0) {
      showTradeNotification('Enter a valid limit/stop price.', 'error');
      return;
    }
    fillPrice = Math.round(limitVal / tickSize) * tickSize;
    const fillDecimals = (isSwap || (window.activeInstrumentType === 'stock' && fillPrice < 1.00)) ? 4 : 2;
    fillPrice = parseFloat(fillPrice.toFixed(fillDecimals));
  }

  const side = type === 'buy' ? 'LONG' : 'SHORT';
  const notional = fillPrice * specs.multiplier * qty;
  const margin = notional * specs.initialMarginPct;

  const countryA = isSwap ? (window.activeSwapPair.countryA || 'us') : '';
  const countryB = isSwap ? (window.activeSwapPair.countryB || 'cn') : '';
  const swapSymbol = isSwap ? `${getCountrySGASymbol(countryA)}/${getCountrySGASymbol(countryB)}` : '';
  const assetId = isSwap ? `swap_${countryA}_${countryB}` : currentTradingStateData.id;
  const assetName = isSwap ? swapSymbol : currentTradingStateData.name;
  const unitName = isSwap ? 'swap contracts' : (window.activeInstrumentType === 'stock' ? 'shares' : 'contracts');
  const marginLabel = window.activeInstrumentType === 'stock' ? 'Cash' : 'Margin';
  const tradeStateId = isSwap ? swapSymbol : currentTradingStateData.id;

  // Check for existing same-side position
  const existingIdx = positions.findIndex(p =>
    p.instrumentType === window.activeInstrumentType &&
    p.side === side &&
    !p.isIPOPosition &&
    (isSwap ? (p.pairKey === `${countryA}/${countryB}`) : (p.stateId === currentTradingStateData.id))
  );

  if (existingIdx >= 0) {
    const existing = positions[existingIdx];
    const totalQty = existing.qty + qty;
    const avgPrice = ((existing.entryPrice * existing.qty) + (fillPrice * qty)) / totalQty;
    existing.qty = totalQty;
    const avgDecimals = (isSwap || (window.activeInstrumentType === 'stock' && avgPrice < 1.00)) ? 4 : 2;
    existing.entryPrice = parseFloat(avgPrice.toFixed(avgDecimals));

    const fillPriceStr = (isSwap || fillPrice < 1.00) ? fillPrice.toFixed(4) : fillPrice.toFixed(2);
    const avgPriceStr = (isSwap || existing.entryPrice < 1.00) ? existing.entryPrice.toFixed(4) : existing.entryPrice.toFixed(2);
    let msg = `Averaged ${side} ${assetName}: +${qty.toLocaleString()} @ ${isSwap ? '' : '$'}${fillPriceStr} → ${totalQty.toLocaleString()} ${unitName} @ ${isSwap ? '' : '$'}${avgPriceStr} avg`;
    if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

    showTradeNotification(msg, type === 'buy' ? 'buy' : 'sell');
    window.calculateTradeFeeAndRecord('USER', tradeStateId, type.toUpperCase(), qty, fillPrice, false, 0, window.activeInstrumentType);
  } else {
    // Check for opposite position
    const oppositeIdx = positions.findIndex(p =>
      p.instrumentType === window.activeInstrumentType &&
      p.side !== side &&
      !p.isIPOPosition &&
      (isSwap ? (p.pairKey === `${countryA}/${countryB}`) : (p.stateId === currentTradingStateData.id))
    );

    if (oppositeIdx >= 0) {
      const opposite = positions[oppositeIdx];
      if (qty >= opposite.qty) {
        const closedQty = opposite.qty;
        const priceDiff = opposite.side === 'LONG' ? (fillPrice - opposite.entryPrice) : (opposite.entryPrice - fillPrice);
        const realizedPnl = window.activeInstrumentType === 'stock'
          ? priceDiff * closedQty
          : Math.round(priceDiff / tickSize) * tickValue * closedQty;
        positions.splice(oppositeIdx, 1);
        const remainingQty = qty - closedQty;

        const fillPriceStr = (isSwap || fillPrice < 1.00) ? fillPrice.toFixed(4) : fillPrice.toFixed(2);
        let msg = `Closed ${closedQty.toLocaleString()} ${opposite.side} ${assetName} @ ${isSwap ? '' : '$'}${fillPriceStr} | P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

        // Fee notification
        const closingNotional = fillPrice * specs.multiplier * closedQty;
        const closingFee = closingNotional >= 25000 ? closedQty * 0.05 : 0;
        msg += ` | Fee: $${closingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        window.calculateTradeFeeAndRecord('USER', tradeStateId, type.toUpperCase(), closedQty, fillPrice, true, realizedPnl, window.activeInstrumentType);

        // Record to Trade History
        window.userTradeHistory.unshift({
          timestamp: new Date(),
          stateId: tradeStateId,
          swapSymbol: isSwap ? swapSymbol : null,
          side: opposite.side,
          qty: closedQty,
          entryPrice: opposite.entryPrice,
          exitPrice: fillPrice,
          notional: closingNotional,
          realizedPnl: realizedPnl,
          fee: closingFee,
          returnOnMargin: realizedPnl / (closingNotional * specs.initialMarginPct),
          instrumentType: window.activeInstrumentType
        });
        renderTradeHistory();

        if (remainingQty > 0) {
          const newPos = { id: positionIdCounter++, stateId: assetId, stateName: assetName, side, qty: remainingQty, entryPrice: fillPrice, timestamp: Date.now(), instrumentType: window.activeInstrumentType };
          if (isSwap) { newPos.swapSymbol = swapSymbol; newPos.pairKey = `${countryA}/${countryB}`; newPos.countryA = countryA; newPos.countryB = countryB; }
          positions.push(newPos);
          msg += ` | Opened ${side} ${remainingQty.toLocaleString()} @ ${isSwap ? '' : '$'}${fillPrice.toFixed(isSwap ? 4 : 2)}`;
          window.calculateTradeFeeAndRecord('USER', tradeStateId, type.toUpperCase(), remainingQty, fillPrice, false, 0, window.activeInstrumentType);
        }
        showTradeNotification(msg, realizedPnl >= 0 ? 'buy' : 'sell');
      } else {
        const priceDiff = opposite.side === 'LONG' ? (fillPrice - opposite.entryPrice) : (opposite.entryPrice - fillPrice);
        const realizedPnl = window.activeInstrumentType === 'stock'
          ? priceDiff * qty
          : Math.round(priceDiff / tickSize) * tickValue * qty;
        opposite.qty -= qty;

        const fillPriceStr = (isSwap || fillPrice < 1.00) ? fillPrice.toFixed(4) : fillPrice.toFixed(2);
        let msg = `Reduced ${opposite.side} ${assetName} by ${qty.toLocaleString()} @ ${isSwap ? '' : '$'}${fillPriceStr} | P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

        // Fee notification
        const closingNotional = fillPrice * specs.multiplier * qty;
        const closingFee = closingNotional >= 25000 ? qty * 0.05 : 0;
        msg += ` | Fee: $${closingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        window.calculateTradeFeeAndRecord('USER', tradeStateId, type.toUpperCase(), qty, fillPrice, true, realizedPnl, window.activeInstrumentType);

        // Record to Trade History
        window.userTradeHistory.unshift({
          timestamp: new Date(),
          stateId: tradeStateId,
          swapSymbol: isSwap ? swapSymbol : null,
          side: opposite.side,
          qty: qty,
          entryPrice: opposite.entryPrice,
          exitPrice: fillPrice,
          notional: closingNotional,
          realizedPnl: realizedPnl,
          fee: closingFee,
          returnOnMargin: realizedPnl / (closingNotional * specs.initialMarginPct),
          instrumentType: window.activeInstrumentType
        });
        renderTradeHistory();

        showTradeNotification(msg, realizedPnl >= 0 ? 'buy' : 'sell');
      }
    } else {
      const newPos = { id: positionIdCounter++, stateId: assetId, stateName: assetName, side, qty, entryPrice: fillPrice, timestamp: Date.now(), instrumentType: window.activeInstrumentType };
      if (isSwap) { newPos.swapSymbol = swapSymbol; newPos.pairKey = `${countryA}/${countryB}`; newPos.countryA = countryA; newPos.countryB = countryB; }
      positions.push(newPos);

      const fee = notional >= 25000 ? qty * 0.05 : 0;
      let msg = `${orderType.toUpperCase()} FILL: ${side} ${qty.toLocaleString()} ${assetName} @ ${isSwap ? '' : '$'}${fillPrice.toFixed(isSwap ? 4 : 2)} | ${marginLabel}: ${formatCurrency(margin)}`;
      if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;
      msg += ` | Fee: $${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      window.calculateTradeFeeAndRecord('USER', tradeStateId, type.toUpperCase(), qty, fillPrice, false, 0, window.activeInstrumentType);

      showTradeNotification(msg, type === 'buy' ? 'buy' : 'sell');
    }
  }
  renderPositions();

  // Record forex transaction if non-native currency was used
  if (isNonNativeCurrency && type === 'buy') {
    const fxRates = {
      'USD': 1.0,
      'EUR': 0.92,
      'GBP': 0.79,
      'JPY': 149.50,
      'CAD': 1.36,
      'AUD': 1.53,
      'CHF': 0.89,
      'CNY': 7.24,
      'HKD': 7.81,
      'SGD': 1.35,
      'INR': 83.45,
      'SAR': 3.75,
      'AED': 3.67,
      'SEK': 10.52,
      'NOK': 10.85,
      'DKK': 6.85,
      'PLN': 3.95,
      'CZK': 23.15,
      'HUF': 365.5,
      'RON': 4.65,
      'RUB': 92.5,
      'UAH': 39.5,
      'TRY': 32.5,
      'ILS': 3.75,
      'KRW': 1378.5,
      'THB': 35.5,
      'IDR': 15750,
      'MYR': 4.75,
      'VND': 25350,
      'PHP': 56.5,
      'TWD': 31.5,
      'NZD': 1.65,
      'MXN': 17.5,
      'BRL': 5.15,
      'ARS': 850.5,
      'CLP': 980.5,
      'COP': 4150,
      'PEN': 3.75,
      'VES': 36.5,
      'ZAR': 18.75,
      'NGN': 1550,
      'EGP': 48.5,
      'MAD': 10.25,
      'KES': 155,
      'PKR': 280.5,
      'BDT': 110.5,
      'LKR': 320,
      'NPR': 133.5,
      'MMK': 2100,
      'KHR': 4150,
      'LAK': 21500,
      'BND': 1.35,
      'MVR': 15.5,
      'ISK': 140.5,
      'QAR': 3.65,
      'KWD': 0.31,
      'BHD': 0.38,
      'OMR': 0.39,
      'BGN': 1.85,
      'BAM': 1.85,
      'MKD': 58.5,
      'RSD': 105.5
    };
    
    const fxRate = fxRates[selectedCurrency] || 1.0;
    const notional = fillPrice * specs.multiplier * qty;
    const sourceAmount = notional * fxRate; // Amount in foreign currency
    const destinationAmount = notional; // Amount in USD (SGA is priced in USD)
    
    recordFXTransactionToNetworkLedger({
      sourceCurrency: selectedCurrency,
      destinationCurrency: 'USD',
      sourceAmount,
      destinationAmount: notional,
      exchangeRate: fxRate,
      stateId: currentTradingStateData.id,
      instrumentType: window.activeInstrumentType,
      qty,
      price: fillPrice
    });
  }
};


/**
 * Record forex transaction to network ledger when buying SGA with non-native currency
 */
function recordFXTransactionToNetworkLedger({
  sourceCurrency,
  destinationCurrency,
  sourceAmount,
  destinationAmount,
  exchangeRate,
  stateId,
  instrumentType,
  qty,
  price
}) {
  // Only record if we have access to the network ledger
  if (!window.sgaNetwork || !window.sgaNetwork.ledger) {
    console.warn('SGA Network ledger not available for FX transaction recording');
    return;
  }

  try {
    const forexTransaction = {
      transactionType: 'conversion',
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      exchangeRate,
      feeCurrency: sourceCurrency,
      feeAmount: 0,
      executionPrice: exchangeRate,
      route: [sourceCurrency, destinationCurrency],
      providerType: 'internal',
      status: 'completed',
      metadata: {
        description: `SGA Purchase: ${qty} ${instrumentType} of ${stateId} @ $${price}`,
        stateId,
        instrumentType,
        qty,
        price,
        timestamp: new Date().toISOString()
      }
    };

    window.sgaNetwork.ledger.recordTransaction(forexTransaction);
    console.log('Forex transaction recorded to network ledger:', forexTransaction);
  } catch (error) {
    console.error('Failed to record forex transaction to network ledger:', error);
  }
}


window.adjustQty = (delta) => {
  const input = document.getElementById('order-qty');
  const cleanVal = parseInt(input.value.replace(/,/g, '')) || 1;
  const val = Math.max(1, Math.min(999999999, cleanVal + delta));
  input.value = val.toLocaleString();
  updateOrderSummary();
};

window.closePosition = (posId) => {
  const idx = positions.findIndex(p => p.id === posId);
  if (idx < 0) return;
  const pos = positions[idx];
  const specs = getInstrumentSpecs(pos.instrumentType);
  const markPrice = getMarkPrice(pos);
  const priceDiff = pos.side === 'LONG' ? (markPrice - pos.entryPrice) : (pos.entryPrice - markPrice);
  const pnlTicks = Math.round(priceDiff / specs.tickSize);
  const pnl = pnlTicks * specs.tickValue * pos.qty;
  positions.splice(idx, 1);

  const closingSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
  const closingNotional = markPrice * specs.multiplier * pos.qty;
  const closingFee = closingNotional >= 25000 ? pos.qty * 0.05 : 0;

  let msg = `Closed ${pos.side} ${pos.qty.toLocaleString()} ${pos.stateName}-SGA @ $${markPrice.toFixed(2)} | Realized P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Fee: $${closingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  showTradeNotification(msg, pnl >= 0 ? 'buy' : 'sell');

  window.calculateTradeFeeAndRecord('USER', pos.stateId, closingSide, pos.qty, markPrice, true, pnl, pos.instrumentType);

  // Record to Trade History
  window.userTradeHistory.unshift({
    timestamp: new Date(),
    stateId: pos.stateId,
    side: pos.side,
    qty: pos.qty,
    entryPrice: pos.entryPrice,
    exitPrice: markPrice,
    notional: closingNotional,
    realizedPnl: pnl,
    fee: closingFee,
    returnOnMargin: pnl / (closingNotional * specs.initialMarginPct),
    instrumentType: pos.instrumentType
  });
  renderTradeHistory();

  renderPositions();
};

// ==========================================
// LEDGER LOGIC
// ==========================================
// ==========================================
// LEDGER LOGIC
// ==========================================

const CATEGORY_OPTIONS_HTML = TAXONOMY.map(cat => `<option value="${cat}">${cat}</option>`).join('');
const REGION_OPTIONS_HTML = [...statesData]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(state => `<option value="${state.id}">${state.name} (${state.id})</option>`)
  .join('');

function createAllocationItemHTML(index, isRemovable = true) {
  return `
    <div class="allocation-split-item" data-index="${index}">
      <div class="split-item-header">
        <span>Allocation Split #${index + 1}</span>
        ${isRemovable ? `
          <button type="button" class="remove-split-btn" title="Remove Split">
            ✕ Remove
          </button>
        ` : ''}
      </div>
      
      <div class="form-group">
        <label>AMOUNT ($)</label>
        <input type="text" class="alloc-amount" required placeholder="e.g. 5,000,000" inputmode="numeric">
      </div>
      
      <div class="form-group">
        <label>REGION</label>
        <select class="alloc-region" required>
          ${REGION_OPTIONS_HTML}
        </select>
      </div>
      
      <div class="form-group">
        <label>CATEGORY</label>
        <select class="alloc-category" required>
          ${CATEGORY_OPTIONS_HTML}
        </select>
      </div>
      
      <div class="form-group">
        <label>AGENCY</label>
        <input type="text" class="alloc-agency" required placeholder="e.g. Dept of Transportation">
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label>DESCRIPTION</label>
        <textarea class="alloc-description" rows="3" required placeholder="Write a mandatory 1-2 sentence description. And a certain number of characters is required."></textarea>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>EXPENDITURE TYPE</label>
          <select class="alloc-expenditure-type">
            <option value="CapEx">CapEx — Capital Expenditure</option>
            <option value="OpEx">OpEx — Operating Expenditure</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>HAS TIMELINE?</label>
          <select class="alloc-has-timeline">
            <option value="no">No Timeline</option>
            <option value="yes">Yes — Set Dates</option>
          </select>
        </div>
      </div>

      <div class="alloc-timeline-dates" style="display: none; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.4rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>START DATE</label>
          <input type="date" class="alloc-start-date">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>PROJECTED END</label>
          <input type="date" class="alloc-end-date">
        </div>
      </div>
    </div>
  `;
}

function initLedgerUI() {
  // Populate Filter Categories
  const filterCategory = document.getElementById('filter-category');
  TAXONOMY.forEach(cat => {
    filterCategory.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
  });

  // Populate Filter Regions
  const filterRegion = document.getElementById('filter-region');
  const sortedStates = [...statesData].sort((a, b) => a.name.localeCompare(b.name));
  sortedStates.forEach(state => {
    filterRegion.insertAdjacentHTML('beforeend', `<option value="${state.id}">${state.name} (${state.id})</option>`);
  });

  const container = document.getElementById('allocations-container');
  const totalAmountEl = document.getElementById('splits-total-amount');
  let splitIndexCounter = 0;

  // Helper to calculate total dynamic volume on-the-fly
  function updateRealTimeTotal() {
    let sum = 0;
    container.querySelectorAll('.alloc-amount').forEach(input => {
      const val = parseFloat(input.value.replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        sum += val;
      }
    });
    totalAmountEl.textContent = `$${sum.toLocaleString()}`;
  }

  // Appends a new split block
  function appendSplitRow(isRemovable = true) {
    container.insertAdjacentHTML('beforeend', createAllocationItemHTML(splitIndexCounter++, isRemovable));

    const newRow = container.lastElementChild;
    const amountInput = newRow.querySelector('.alloc-amount');

    // Amount changed listener for live total & real-time comma formatting
    amountInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = parseInt(cleanVal, 10).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);

      updateRealTimeTotal();
    });

    // Remove click listener
    if (isRemovable) {
      newRow.querySelector('.remove-split-btn').addEventListener('click', () => {
        newRow.remove();
        updateRealTimeTotal();
        reindexSplits();
      });
    }

    // Timeline toggle show/hide
    const timelineToggle = newRow.querySelector('.alloc-has-timeline');
    const timelineDates = newRow.querySelector('.alloc-timeline-dates');
    timelineToggle.addEventListener('change', () => {
      timelineDates.style.display = timelineToggle.value === 'yes' ? 'grid' : 'none';
    });

    updateRealTimeTotal();
  }

  // Re-numbers splits when intermediate items are deleted
  function reindexSplits() {
    const rows = container.querySelectorAll('.allocation-split-item');
    rows.forEach((row, i) => {
      row.dataset.index = i;
      const headerSpan = row.querySelector('.split-item-header span');
      if (headerSpan) {
        headerSpan.textContent = `Allocation Split #${i + 1}`;
      }
    });
    splitIndexCounter = rows.length;
  }

  // Initial single split row (non-removable) - only if container is empty
  if (container.children.length === 0) {
    appendSplitRow(false);
  }

  // Add split click handler
  document.getElementById('add-split-btn').addEventListener('click', () => {
    appendSplitRow(true);
    container.scrollTop = container.scrollHeight;
  });

  // --- Media URL Management ---
  const mediaContainer = document.getElementById('media-urls-container');
  let mediaRowCounter = 0;

  function appendMediaUrlRow() {
    const rowEl = document.createElement('div');
    rowEl.className = 'media-url-row';
    rowEl.style.cssText = 'display:flex;gap:0.35rem;align-items:center;';
    rowEl.innerHTML = `
      <input type="url" class="media-url-input" placeholder="https://youtube.com/watch?v=... or image/PDF URL"
        style="flex:1;font-size:0.7rem;padding:0.35rem 0.5rem;background:rgba(0,0,0,0.25);border:1px solid var(--glass-border);border-radius:0.3rem;color:#fff;outline:none;min-width:0;">
      <span class="media-type-badge" style="font-size:0.55rem;color:var(--text-secondary);white-space:nowrap;min-width:44px;text-align:center;">URL</span>
      <button type="button" class="remove-media-btn" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;border-radius:0.3rem;padding:0.2rem 0.4rem;font-size:0.6rem;cursor:pointer;flex-shrink:0;">✕</button>
    `;
    const urlInput = rowEl.querySelector('.media-url-input');
    const badge = rowEl.querySelector('.media-type-badge');
    urlInput.addEventListener('input', () => {
      const t = detectMediaType(urlInput.value.trim());
      const labels = { video: '🎥 Video', image: '🖼 Image', pdf: '📄 PDF', link: '🔗 Link' };
      badge.textContent = labels[t] || 'URL';
      badge.style.color = t === 'video' ? '#f59e0b' : t === 'image' ? '#10b981' : t === 'pdf' ? '#38bdf8' : 'var(--text-secondary)';
    });
    rowEl.querySelector('.remove-media-btn').addEventListener('click', () => rowEl.remove());
    mediaContainer.appendChild(rowEl);
    urlInput.focus();
  }

  document.getElementById('add-media-btn').addEventListener('click', appendMediaUrlRow);

  // Form submission
  document.getElementById('ledger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording...';

    // Parse and validate all dynamic split rows
    const allocationElements = container.querySelectorAll('.allocation-split-item');
    const allocations = [];
    let totalAmount = 0;

    let isValid = true;
    let validationError = '';

    for (let i = 0; i < allocationElements.length; i++) {
      const row = allocationElements[i];
      const amountRaw = row.querySelector('.alloc-amount').value.replace(/,/g, '');
      const amount = parseFloat(amountRaw);
      const region = row.querySelector('.alloc-region').value;
      const category = row.querySelector('.alloc-category').value;
      const agency = row.querySelector('.alloc-agency').value;
      const description = row.querySelector('.alloc-description').value.trim();

      if (isNaN(amount) || amount <= 0) {
        isValid = false;
        validationError = `Allocation Split #${i + 1} amount is invalid. Please enter a valid number.`;
        row.querySelector('.alloc-amount').focus();
        break;
      }

      // Mandatory 1-2 sentence description validation:
      // Minimum 30 characters, contains at least one sentence terminator
      const hasPeriod = /[.!?]/.test(description);
      if (description.length === 0) {
        isValid = false;
        validationError = `Allocation Split #${i + 1} description is required. Please write a mandatory 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (description.length < 30) {
        isValid = false;
        validationError = `Split #${i + 1} description is too short (${description.length}/30 characters minimum). Please write a mandatory 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (description.length > 250) {
        isValid = false;
        validationError = `Split #${i + 1} description is too long (${description.length}/250 characters maximum). Please write a concise 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (!hasPeriod) {
        isValid = false;
        validationError = `Split #${i + 1} description must contain grammatically complete sentences (ending in a period, question mark, or exclamation mark).`;
        row.querySelector('.alloc-description').focus();
        break;
      }

      totalAmount += amount;
      const expenditureType = row.querySelector('.alloc-expenditure-type').value;
      const hasTimeline = row.querySelector('.alloc-has-timeline').value === 'yes';
      const startDate = hasTimeline ? row.querySelector('.alloc-start-date').value : null;
      const endDate = hasTimeline ? row.querySelector('.alloc-end-date').value : null;

      allocations.push({
        amount,
        region,
        category,
        agency,
        description,
        expenditureType,
        timeline: hasTimeline ? { startDate, endDate } : null
      });
    }

    if (!isValid) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record to Ledger';
      showTradeNotification(validationError, 'error');
      return;
    }

    if (allocations.length === 0) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record to Ledger';
      return;
    }

    // Collect media items from URL rows
    const mediaItems = [];
    document.querySelectorAll('#media-urls-container .media-url-input').forEach(input => {
      const url = input.value.trim();
      if (url) mediaItems.push({ url, type: detectMediaType(url) });
    });

    // Determine primary expenditure type for record-level badge
    const primaryExpType = allocations.length === 1
      ? allocations[0].expenditureType
      : ([...new Set(allocations.map(a => a.expenditureType))].length === 1
          ? allocations[0].expenditureType
          : 'Mixed');

    // Determine if any split has a timeline
    const hasAnyTimeline = allocations.some(a => a.timeline);

    // Collect audit information
    const auditFirm = document.getElementById('audit-firm').value.trim();
    const auditDate = document.getElementById('audit-date').value;
    const auditStatus = document.getElementById('audit-status').value;
    const auditReportUrl = document.getElementById('audit-report-url').value.trim();

    const auditReport = (auditFirm || auditDate || auditStatus || auditReportUrl) ? {
      firm: auditFirm || null,
      date: auditDate || null,
      status: auditStatus || null,
      reportUrl: auditReportUrl || null
    } : null;

    // Aggregate summary fields for table display
    let categorySummary, regionSummary, agencySummary, descriptionSummary;
    if (allocations.length === 1) {
      categorySummary = allocations[0].category;
      regionSummary = allocations[0].region;
      agencySummary = allocations[0].agency;
      descriptionSummary = allocations[0].description;
    } else {
      const uniqueCats = [...new Set(allocations.map(a => a.category))];
      categorySummary = uniqueCats.length === 1 ? uniqueCats[0] : `Multiple (${uniqueCats.length})`;
      const uniqueRegs = [...new Set(allocations.map(a => a.region))];
      regionSummary = uniqueRegs.length === 1 ? uniqueRegs[0] : 'Multiple';
      const uniqueAgencies = [...new Set(allocations.map(a => a.agency))];
      agencySummary = uniqueAgencies.length === 1 ? uniqueAgencies[0] : `${uniqueAgencies.length} Agencies`;
      descriptionSummary = `Liquidated biweekly. Contains ${allocations.length} splits going to ${uniqueRegs.length} states. Click to view detailed breakdown.`;
    }

    await ledger.addRecord({
      amount: totalAmount,
      agency: agencySummary,
      category: categorySummary,
      region: regionSummary,
      description: descriptionSummary,
      allocations,
      expenditureType: primaryExpType,
      hasTimeline: hasAnyTimeline,
      mediaItems: mediaItems.length > 0 ? mediaItems : null,
      auditReport: auditReport,
      milestones: [],
      contractorPayments: [],
      changeOrders: [],
      assetValuations: []
    });

    // Reset splits workspace
    container.innerHTML = '';
    splitIndexCounter = 0;
    appendSplitRow(false);
    updateRealTimeTotal();

    // Reset media rows
    mediaContainer.innerHTML = '';
    mediaRowCounter = 0;

    // Reset audit fields
    document.getElementById('audit-firm').value = '';
    document.getElementById('audit-date').value = '';
    document.getElementById('audit-status').value = '';
    document.getElementById('audit-report-url').value = '';

    submitBtn.disabled = false;
    submitBtn.textContent = 'Record to Ledger';

    // Green flash UI confirmation feedback
    const originalBg = submitBtn.style.background;
    submitBtn.style.background = '#10b981';
    submitBtn.textContent = 'Recorded!';
    setTimeout(() => {
      submitBtn.style.background = originalBg;
      submitBtn.textContent = 'Record to Ledger';
    }, 2000);

    renderLedger();
  });


  // Filters setup
  const filters = ['filter-category', 'filter-region', 'filter-agency', 'filter-start', 'filter-end'];
  filters.forEach(id => {
    document.getElementById(id).addEventListener('input', renderLedger);
  });

  // Click-to-copy ID Anchor
  document.getElementById('ledger-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.id-cell');
    if (!cell) return;

    const id = cell.dataset.id;
    if (!id) return;

    navigator.clipboard.writeText(id).then(() => {
      const originalText = cell.textContent;
      cell.textContent = 'Copied!';
      cell.classList.add('copied');

      setTimeout(() => {
        cell.textContent = originalText;
        cell.classList.remove('copied');
      }, 1200);
    }).catch(err => {
      console.error('Failed to copy ID: ', err);
    });
  });

  // Click Description to Open Record Panel
  document.getElementById('ledger-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.desc-cell');
    if (!cell) return;
    const id = cell.dataset.recordId;
    if (!id) return;
    const record = ledger.getRecords({}).find(r => r.id === id);
    if (!record) return;
    openRecordPanel(record);
  });

  // Close Record Panel
  const overlay = document.getElementById('record-panel-overlay');
  const closePanelBtn = document.getElementById('close-record-panel-btn');
  const closePanel = () => overlay.classList.remove('active');
  if (closePanelBtn) closePanelBtn.addEventListener('click', closePanel);
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) closePanel();
  });

  // Verify button removed
  const verifyBtn = document.getElementById('verify-ledger-btn');
  if (verifyBtn) {
    verifyBtn.style.display = 'none';
  }

  // Reset Ledger
  const resetBtn = document.getElementById('reset-ledger-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all entries? This will completely reset the ledger.')) {
        await ledger.clearAll();
        renderLedger();
      }
    });
  }

  // Initial render
  renderLedger();
}

function renderLedger() {
  const tbody = document.getElementById('ledger-body');

  const filters = {
    category: document.getElementById('filter-category').value,
    region: document.getElementById('filter-region').value,
    agency: document.getElementById('filter-agency').value,
    startDate: document.getElementById('filter-start').value,
    endDate: document.getElementById('filter-end').value,
  };

  const records = ledger.getRecords(filters);

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(record => {
    const date = new Date(record.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const shortId = record.id.substring(0, 10) + '...';

    // CapEx/OpEx badge
    const expType = record.expenditureType || '';
    const expBadge = expType === 'CapEx'
      ? `<span class="ledger-badge ledger-badge-capex">CapEx</span>`
      : expType === 'OpEx'
        ? `<span class="ledger-badge ledger-badge-opex">OpEx</span>`
        : expType === 'Mixed'
          ? `<span class="ledger-badge ledger-badge--mixed">Mixed</span>`
          : `<span style="color:var(--text-secondary);font-size:0.7rem;">—</span>`;

    // Timeline indicator
    const timelineIcon = record.hasTimeline ? `<span title="Has Timeline" style="font-size:0.7rem;margin-left:3px;opacity:0.7;">📅</span>` : '';

    // Audit status pill with firm name
    const ar = record.auditReport;
    const auditColors = { Passed: '#10b981', Failed: '#ef4444', Qualified: '#f59e0b', Pending: '#38bdf8' };
    const auditIcons = { Passed: '✓', Failed: '✗', Qualified: '⚠', Pending: '⏳' };
    const auditCell = ar && (ar.status || ar.firm)
      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:0.15rem;">
          ${ar.status ? `<span style="background:${auditColors[ar.status]}22;color:${auditColors[ar.status]};border:1px solid ${auditColors[ar.status]}55;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.65rem;font-weight:700;white-space:nowrap;">${auditIcons[ar.status]} ${ar.status}</span>` : ''}
          ${ar.firm ? `<span style="font-size:0.65rem;color:var(--text-secondary);max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${ar.firm}">${ar.firm}</span>` : ''}
        </div>`
      : `<span style="color:var(--text-secondary);font-size:0.7rem;">—</span>`;

    return `
      <tr>
        <td style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap;">${date}</td>
        <td style="font-weight: 600; text-align: center;">${record.region}</td>
        <td><span style="background: rgba(255,255,255,0.08); padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; border: 1px solid var(--glass-border);">${record.category}</span></td>
        <td>${expBadge}${timelineIcon}</td>
        <td style="font-size: 0.85rem; font-weight: 500;">${record.agency}</td>
        <td class="desc-cell" data-record-id="${record.id}" title="Click to view & edit details" style="cursor:pointer;">
          <div class="desc-text-clamp" style="font-size: 0.85rem; color: var(--text-secondary); max-width: 260px; line-height: 1.4;">${record.description || ''}</div>
        </td>
        <td style="color: var(--accent-gold); font-weight: 600; font-family: 'Inter', monospace;">$${record.amount.toLocaleString()}</td>
        <td style="text-align:center;">${auditCell}</td>
        <td class="id-cell" data-id="${record.id}" style="font-family: monospace; font-size: 0.8rem; color: var(--accent-blue); text-align: right;" title="Click to copy full ID">${shortId}</td>
      </tr>
    `;
  }).join('');

}

function detectMediaType(url) {
  if (!url) return '';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return 'video';
  if (u.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) return 'image';
  if (u.match(/\.pdf(\?|$)/)) return 'pdf';
  if (url.length > 0) return 'link';
  return '';
}

function getYouTubeEmbedUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getVimeoEmbedUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function buildMediaItemHTML(item) {
  if (item.type === 'video') {
    const embedUrl = getYouTubeEmbedUrl(item.url) || getVimeoEmbedUrl(item.url);
    if (embedUrl) return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;border:1px solid var(--glass-border);background:#000;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div>`;
    return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.5rem;color:#f59e0b;text-decoration:none;padding:0.6rem 0.75rem;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:0.4rem;font-size:0.8rem;">🎥 ${item.url} ↗</a>`;
  } else if (item.type === 'image') {
    return `<div style="border-radius:0.5rem;overflow:hidden;border:1px solid var(--glass-border);"><img src="${item.url}" alt="Attached image" style="width:100%;max-height:280px;object-fit:cover;display:block;" loading="lazy"><div style="padding:0.3rem 0.6rem;font-size:0.6rem;color:var(--text-secondary);background:rgba(0,0,0,0.3);"><a href="${item.url}" target="_blank" rel="noopener" style="color:#10b981;">🖼 View Full Image ↗</a></div></div>`;
  } else if (item.type === 'pdf') {
    return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.6rem;color:#38bdf8;text-decoration:none;padding:0.6rem 0.75rem;background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.2);border-radius:0.4rem;font-size:0.8rem;">📄 View PDF Document ↗<span style="font-size:0.6rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${item.url}</span></a>`;
  }
  return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary);text-decoration:none;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:0.4rem;font-size:0.75rem;">🔗 ${item.url} ↗</a>`;
}

function openRecordPanel(record) {
  const overlay = document.getElementById('record-panel-overlay');
  const body = document.getElementById('record-panel-body');
  if (!overlay || !body) return;

  // Refresh record from ledger (for live patches)
  let r = ledger.getRecords({}).find(x => x.id === record.id) || record;

  // --- Header ---
  const expType = r.expenditureType || '';
  const expBadgeClass = expType === 'CapEx' ? 'ledger-badge-capex' : expType === 'OpEx' ? 'ledger-badge-opex' : 'ledger-badge-mixed';
  document.getElementById('rp-header-badge').innerHTML = [
    expType ? `<span class="ledger-badge ${expBadgeClass}">${expType}</span>` : '',
    r.hasTimeline ? `<span style="font-size:0.7rem;background:rgba(56,189,248,0.12);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:0.1rem 0.5rem;border-radius:999px;">📅 Has Timeline</span>` : '',
    r.category ? `<span style="font-size:0.7rem;background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--glass-border);padding:0.1rem 0.5rem;border-radius:999px;">${r.category}</span>` : ''
  ].join('');
  document.getElementById('rp-header-title').textContent = `${r.agency} — ${r.region}`;
  document.getElementById('rp-header-meta').textContent = `$${r.amount.toLocaleString()} · ${new Date(r.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

  // Tab system
  const tabs = overlay.querySelectorAll('.rp-tab');
  let activeTab = 'overview';

  function renderTab(tab) {
    activeTab = tab;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    // Re-fetch fresh record on each tab render
    r = ledger.getRecords({}).find(x => x.id === record.id) || record;

    // --- Helper for section labels ---
    const sectionLabel = (icon, text) => `<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-blue);margin-bottom:0.75rem;">${icon} ${text}</div>`;
    const emptyState = (msg) => `<div style="color:var(--text-secondary);font-size:0.82rem;text-align:center;padding:2rem 0;opacity:0.6;">${msg}</div>`;
    const addForm = (id, html) => `<div class="rp-add-form" id="${id}">${html}</div>`;
    const saveBtn = (label) => `<button type="button" class="rp-save-btn">${label}</button>`;

    if (tab === 'overview') {
      const splitsHTML = (r.allocations && r.allocations.length > 1) ? `
        <div class="modal-splits-section" style="margin-top:1rem;">
          <div class="modal-splits-title">Allocation Splits (${r.allocations.length})</div>
          <div class="modal-splits-grid">${r.allocations.map(a => `
            <div class="modal-split-card">
              <div class="modal-split-card-header"><span class="modal-split-card-amount">$${a.amount.toLocaleString()}</span><div class="modal-split-badges"><span class="modal-split-badge-reg">${a.region}</span><span class="modal-split-badge-cat">${a.category}</span>${a.expenditureType ? `<span class="ledger-badge ${a.expenditureType==='CapEx'?'ledger-badge-capex':'ledger-badge-opex'}" style="font-size:0.55rem;padding:0.1rem 0.4rem;">${a.expenditureType}</span>` : ''}</div></div>
              <div class="modal-split-card-agency">${a.agency}</div>
              <div class="modal-split-card-desc">${a.description || ''}</div>
            </div>`).join('')}</div>
        </div>` : '';

      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div class="modal-field"><span class="modal-field-label">Date &amp; Time</span><span class="modal-field-value">${new Date(r.timestamp).toLocaleString(undefined,{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
          <div class="modal-field"><span class="modal-field-label">Region</span><span class="modal-field-value" style="font-weight:600;">${r.region}</span></div>
          <div class="modal-field"><span class="modal-field-label">Category</span><span class="modal-field-value"><span style="background:rgba(255,255,255,0.08);padding:0.2rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;border:1px solid var(--glass-border);">${r.category}</span></span></div>
          <div class="modal-field"><span class="modal-field-label">Total Amount</span><span class="modal-field-value" style="color:var(--accent-gold);font-weight:700;font-size:1.1rem;">$${r.amount.toLocaleString()}</span></div>
          <div class="modal-field" style="grid-column:span 2;"><span class="modal-field-label">Authorized Agency</span><span class="modal-field-value">${r.agency}</span></div>
        </div>
        <div class="modal-field"><span class="modal-field-label">Transaction Summary</span><div class="modal-desc-box">${r.description || '—'}</div></div>
        ${splitsHTML}
        <div class="modal-field" style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.06);">
          <span class="modal-field-label">Record ID</span>
          <span class="modal-field-value" style="font-family:monospace;font-size:0.72rem;color:var(--accent-blue);word-break:break-all;background:rgba(0,0,0,0.2);padding:0.4rem;border-radius:0.4rem;border:1px solid var(--glass-border);">${r.id}</span>
        </div>`;

    } else if (tab === 'timeline') {
      const allTimelines = (r.allocations || []).filter(a => a.timeline && a.timeline.startDate);
      if (!r.hasTimeline || allTimelines.length === 0) {
        body.innerHTML = emptyState('No timeline set for this record. Enable "Has Timeline?" when creating splits.');
        return;
      }
      const milestones = r.milestones || [];
      // Build timeline visual for first allocation with timeline (or primary)
      const tl = allTimelines[0].timeline;
      const start = tl.startDate ? new Date(tl.startDate + 'T12:00:00') : null;
      const end = tl.endDate ? new Date(tl.endDate + 'T12:00:00') : null;
      const now = new Date();
      let progressPct = 0;
      if (start && end) {
        const total = end - start;
        const elapsed = Math.min(now - start, total);
        progressPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
      }
      const fmtDate = (d) => d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';

      // Milestone markers on timeline
      const milestonePips = milestones.filter(m => m.targetDate).map(m => {
        const md = new Date(m.targetDate + 'T12:00:00');
        let pct = 0;
        if (start && end && md > start) pct = Math.min(100, Math.round(((md - start) / (end - start)) * 100));
        const statusColor = m.status === 'Released' ? '#10b981' : m.status === 'Withheld' ? '#ef4444' : '#f59e0b';
        return `<div class="timeline-pip" style="left:${pct}%;background:${statusColor};" title="${m.name} (${m.status})"><div class="timeline-pip-label">${m.name}</div></div>`;
      }).join('');

      body.innerHTML = `
        ${sectionLabel('📅', 'Project Timeline')}
        <div class="timeline-track-container">
          <div class="timeline-date-start">${fmtDate(start)}</div>
          <div class="timeline-date-end">${fmtDate(end)}</div>
          <div class="timeline-bar-outer">
            <div class="timeline-bar-inner" style="width:${progressPct}%;"></div>
            <div class="timeline-now-marker" style="left:${progressPct}%;" title="Today (${progressPct}%)"></div>
            ${milestonePips}
          </div>
          <div style="text-align:center;font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem;">${progressPct}% elapsed</div>
        </div>
        ${allTimelines.length > 1 ? `<div style="margin-top:1rem;font-size:0.72rem;color:var(--text-secondary);">Note: ${allTimelines.length} splits have timelines. Showing primary split.</div>` : ''}
      `;

    } else if (tab === 'milestones') {
      const milestones = r.milestones || [];
      const totalPct = milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0);
      const totalReleased = milestones.filter(m => m.status === 'Released').reduce((s, m) => s + (Number(m.amount) || 0), 0);

      body.innerHTML = `
        ${sectionLabel('🏁', 'Milestone-Based Drawdowns')}
        ${milestones.length > 0 ? `
          <div style="margin-bottom:1rem;display:flex;gap:1rem;font-size:0.78rem;">
            <span style="color:var(--text-secondary);">Total allocation: <strong style="color:#fff;">${totalPct}%</strong></span>
            <span style="color:var(--text-secondary);">Released: <strong style="color:#10b981;">$${totalReleased.toLocaleString()}</strong></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.25rem;">
            ${milestones.map((m, i) => {
              const sc = m.status === 'Released' ? '#10b981' : m.status === 'Withheld' ? '#ef4444' : '#f59e0b';
              return `<div class="rp-list-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">
                  <strong style="font-size:0.85rem;">${m.name}</strong>
                  <span style="background:${sc}22;color:${sc};border:1px solid ${sc}55;padding:0.15rem 0.55rem;border-radius:999px;font-size:0.65rem;font-weight:700;">${m.status}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;gap:1rem;flex-wrap:wrap;">
                  <span>${m.pct}% of total</span>
                  ${m.amount ? `<span>$${Number(m.amount).toLocaleString()}</span>` : ''}
                  ${m.targetDate ? `<span>Due: ${new Date(m.targetDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
                </div>
                ${m.notes ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.3rem;opacity:0.8;">${m.notes}</div>` : ''}
              </div>`;
            }).join('')}
          </div>` : emptyState('No milestones yet. Add the first drawdown milestone below.')}
        ${addForm('ms-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">+ Add Milestone</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div class="form-group" style="margin:0;"><label>MILESTONE NAME</label><input type="text" id="ms-name" placeholder="e.g. Foundation Complete"></div>
            <div class="form-group" style="margin:0;"><label>% OF TOTAL</label><input type="number" id="ms-pct" placeholder="30" min="0" max="100"></div>
            <div class="form-group" style="margin:0;"><label>AMOUNT ($)</label><input type="text" id="ms-amount" placeholder="e.g. 9,000,000"></div>
            <div class="form-group" style="margin:0;"><label>TARGET DATE</label><input type="date" id="ms-date"></div>
            <div class="form-group" style="margin:0;grid-column:span 2;"><label>STATUS</label>
              <select id="ms-status"><option value="Pending">⏳ Pending</option><option value="Released">✓ Released</option><option value="Withheld">✗ Withheld</option></select></div>
            <div class="form-group" style="margin:0;grid-column:span 2;"><label>NOTES</label><input type="text" id="ms-notes" placeholder="Optional notes..."></div>
          </div>
          ${saveBtn('Add Milestone')}
        `)}
      `;
      body.querySelector('#ms-add-form .rp-save-btn').addEventListener('click', () => {
        const name = document.getElementById('ms-name').value.trim();
        if (!name) return;
        const updated = ledger.getRecords({}).find(x => x.id === r.id);
        const milestones = [...(updated.milestones || []), {
          name,
          pct: document.getElementById('ms-pct').value,
          amount: document.getElementById('ms-amount').value.replace(/,/g,''),
          targetDate: document.getElementById('ms-date').value,
          status: document.getElementById('ms-status').value,
          notes: document.getElementById('ms-notes').value.trim()
        }];
        ledger.updateRecord(r.id, { milestones });
        renderLedger();
        renderTab('milestones');
      });

    } else if (tab === 'contractor') {
      const payments = r.contractorPayments || [];
      body.innerHTML = `
        ${sectionLabel('🔧', 'Contractor Payments')}
        ${payments.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.25rem;">
            ${payments.map(p => `<div class="rp-list-card">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.25rem;">
                <strong style="font-size:0.85rem;">${p.contractor}</strong>
                <span style="color:var(--accent-gold);font-weight:700;">$${Number(p.amount).toLocaleString()}</span>
              </div>
              <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;gap:1rem;flex-wrap:wrap;">
                ${p.date ? `<span>${new Date(p.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>` : ''}
                ${p.invoiceRef ? `<span>Inv# ${p.invoiceRef}</span>` : ''}
              </div>
              ${p.description ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.3rem;">${p.description}</div>` : ''}
            </div>`).join('')}
          </div>` : emptyState('No contractor payments logged yet.')}
        ${addForm('cp-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">+ Log Payment</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div class="form-group" style="margin:0;"><label>CONTRACTOR / PAYEE</label><input type="text" id="cp-name" placeholder="e.g. Acme Construction LLC"></div>
            <div class="form-group" style="margin:0;"><label>AMOUNT ($)</label><input type="text" id="cp-amount" placeholder="e.g. 2,500,000"></div>
            <div class="form-group" style="margin:0;"><label>PAYMENT DATE</label><input type="date" id="cp-date"></div>
            <div class="form-group" style="margin:0;"><label>INVOICE REF</label><input type="text" id="cp-inv" placeholder="INV-2024-001"></div>
            <div class="form-group" style="margin:0;grid-column:span 2;"><label>DESCRIPTION</label><input type="text" id="cp-desc" placeholder="Scope of work..."></div>
          </div>
          ${saveBtn('Log Payment')}
        `)}
      `;
      body.querySelector('#cp-add-form .rp-save-btn').addEventListener('click', () => {
        const contractor = document.getElementById('cp-name').value.trim();
        if (!contractor) return;
        const updated = ledger.getRecords({}).find(x => x.id === r.id);
        const contractorPayments = [...(updated.contractorPayments || []), {
          contractor,
          amount: document.getElementById('cp-amount').value.replace(/,/g,''),
          date: document.getElementById('cp-date').value,
          invoiceRef: document.getElementById('cp-inv').value.trim(),
          description: document.getElementById('cp-desc').value.trim()
        }];
        ledger.updateRecord(r.id, { contractorPayments });
        renderLedger();
        renderTab('contractor');
      });

    } else if (tab === 'changeorders') {
      const orders = r.changeOrders || [];
      body.innerHTML = `
        ${sectionLabel('📋', 'Change Orders')}
        ${orders.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.25rem;">
            ${orders.map(co => {
              const amtNum = Number(co.costImpact);
              const amtStr = amtNum >= 0 ? `+$${amtNum.toLocaleString()}` : `-$${Math.abs(amtNum).toLocaleString()}`;
              const amtColor = amtNum >= 0 ? '#ef4444' : '#10b981';
              return `<div class="rp-list-card">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.25rem;">
                  <strong style="font-size:0.85rem;">${co.title}</strong>
                  <span style="color:${amtColor};font-weight:700;font-size:0.8rem;">${amtStr}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">${co.date ? new Date(co.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''} ${co.approvedBy ? `· Approved by: ${co.approvedBy}` : ''}</div>
                ${co.reason ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.3rem;">${co.reason}</div>` : ''}
              </div>`;
            }).join('')}
          </div>` : emptyState('No change orders logged yet.')}
        ${addForm('co-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">+ Add Change Order</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div class="form-group" style="margin:0;grid-column:span 2;"><label>TITLE / DESCRIPTION</label><input type="text" id="co-title" placeholder="e.g. Scope expansion — additional drainage system"></div>
            <div class="form-group" style="margin:0;"><label>COST IMPACT ($)</label><input type="text" id="co-cost" placeholder="e.g. +500000 or -200000"></div>
            <div class="form-group" style="margin:0;"><label>DATE</label><input type="date" id="co-date"></div>
            <div class="form-group" style="margin:0;"><label>APPROVED BY</label><input type="text" id="co-approver" placeholder="Name / Authority"></div>
            <div class="form-group" style="margin:0;"><label>REASON</label><input type="text" id="co-reason" placeholder="Brief justification..."></div>
          </div>
          ${saveBtn('Add Change Order')}
        `)}
      `;
      body.querySelector('#co-add-form .rp-save-btn').addEventListener('click', () => {
        const title = document.getElementById('co-title').value.trim();
        if (!title) return;
        const updated = ledger.getRecords({}).find(x => x.id === r.id);
        const changeOrders = [...(updated.changeOrders || []), {
          title,
          costImpact: document.getElementById('co-cost').value.replace(/[^0-9.-]/g,''),
          date: document.getElementById('co-date').value,
          approvedBy: document.getElementById('co-approver').value.trim(),
          reason: document.getElementById('co-reason').value.trim()
        }];
        ledger.updateRecord(r.id, { changeOrders });
        renderLedger();
        renderTab('changeorders');
      });

    } else if (tab === 'valuation') {
      const valuations = r.assetValuations || [];
      body.innerHTML = `
        ${sectionLabel('📈', 'Asset Valuation History')}
        ${valuations.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.25rem;">
            ${valuations.map((v, i) => `<div class="rp-list-card">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.25rem;">
                <span style="font-size:0.75rem;color:var(--text-secondary);">${v.date ? new Date(v.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'No date'}</span>
                <span style="color:var(--accent-gold);font-weight:700;font-size:0.95rem;">$${Number(v.value).toLocaleString()}</span>
              </div>
              ${v.method ? `<div style="font-size:0.72rem;color:var(--text-secondary);">Method: ${v.method}</div>` : ''}
              ${v.notes ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.25rem;">${v.notes}</div>` : ''}
            </div>`).join('')}
          </div>` : emptyState('No valuation entries yet. Log the first appraisal below.')}
        ${addForm('av-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">+ Add Valuation Entry</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div class="form-group" style="margin:0;"><label>APPRAISED VALUE ($)</label><input type="text" id="av-value" placeholder="e.g. 12,000,000"></div>
            <div class="form-group" style="margin:0;"><label>VALUATION DATE</label><input type="date" id="av-date"></div>
            <div class="form-group" style="margin:0;"><label>METHOD</label><input type="text" id="av-method" placeholder="e.g. DCF, Comparable Sales"></div>
            <div class="form-group" style="margin:0;"><label>APPRAISER</label><input type="text" id="av-appraiser" placeholder="Firm or individual"></div>
            <div class="form-group" style="margin:0;grid-column:span 2;"><label>NOTES</label><input type="text" id="av-notes" placeholder="Key assumptions or findings..."></div>
          </div>
          ${saveBtn('Add Valuation')}
        `)}
      `;
      body.querySelector('#av-add-form .rp-save-btn').addEventListener('click', () => {
        const value = document.getElementById('av-value').value.replace(/,/g,'');
        if (!value) return;
        const updated = ledger.getRecords({}).find(x => x.id === r.id);
        const assetValuations = [...(updated.assetValuations || []), {
          value,
          date: document.getElementById('av-date').value,
          method: document.getElementById('av-method').value.trim(),
          appraiser: document.getElementById('av-appraiser').value.trim(),
          notes: document.getElementById('av-notes').value.trim()
        }];
        ledger.updateRecord(r.id, { assetValuations });
        renderLedger();
        renderTab('valuation');
      });

    } else if (tab === 'media') {
      const items = r.mediaItems || [];
      
      // Main project image display
      const mainImageHTML = r.imageUrl ? `
        <div style="margin-bottom:1.5rem;">
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">📷 Project Image</div>
          <div style="Border-radius:0.75rem;overflow:hidden;border:1px solid var(--glass-border);">
            <img src="${r.imageUrl}" alt="Project Image" style="width:100%;max-height:400px;object-fit:cover;display:block;" loading="lazy">
          </div>
          <div style="padding:0.5rem 0.75rem;font-size:0.65rem;color:var(--text-secondary);background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);border-radius:0.4rem;margin-top:0.5rem;">
            <a href="${r.imageUrl}" target="_blank" rel="noopener" style="color:#10b981;text-decoration:none;">🔗 View Full Image ↗</a>
          </div>
        </div>` : '';
      
      // Additional media items
      const additionalMediaHTML = items.length > 0 ? `
        <div style="font-size:0.65rem;font-weight:700;color:var(--accent-blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">📎 Additional Documentation</div>
        <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.25rem;">${items.map(buildMediaItemHTML).join('')}</div>` : '';
      
      body.innerHTML = `
        ${mainImageHTML}
        ${additionalMediaHTML}
        ${!r.imageUrl && items.length === 0 ? emptyState('No media attached.') : ''}
        ${addForm('media-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">+ Add Media URL</div>
          <div class="form-group" style="margin:0 0 0.5rem 0;"><label>URL</label><input type="url" id="media-new-url" placeholder="YouTube, Vimeo, image, PDF, or any URL"></div>
          ${saveBtn('Add Media')}
        `)}
      `;
      body.querySelector('#media-add-form .rp-save-btn').addEventListener('click', () => {
        const url = document.getElementById('media-new-url').value.trim();
        if (!url) return;
        const updated = ledger.getRecords({}).find(x => x.id === r.id);
        const mediaItems = [...(updated.mediaItems || []), { url, type: detectMediaType(url) }];
        ledger.updateRecord(r.id, { mediaItems });
        renderLedger();
        renderTab('media');
      });

    } else if (tab === 'audit') {
      const ar = r.auditReport || {};
      const statusColors = { Passed: '#10b981', Failed: '#ef4444', Qualified: '#f59e0b', Pending: '#38bdf8' };
      const statusIcons = { Passed: '✓ Passed', Failed: '✗ Failed', Qualified: '⚠ Qualified Opinion', Pending: '⏳ Pending Review' };

      const existingHTML = ar.status || ar.firm ? `
        <div style="background:linear-gradient(135deg,rgba(59,130,246,0.1) 0%,rgba(0,0,0,0.2) 100%);border:1px solid rgba(59,130,246,0.3);border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.25rem;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 70%);pointer-events:none;"></div>
          
          ${ar.firm ? `
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div style="width:40px;height:40px;background:rgba(59,130,246,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(59,130,246,0.4);">
                <span style="font-size:1.2rem;">🏢</span>
              </div>
              <div style="flex:1;">
                <div style="font-size:0.65rem;color:rgba(59,130,246,0.8);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.15rem;">Auditing Firm</div>
                <div style="font-size:1rem;font-weight:700;color:#fff;">${ar.firm}</div>
              </div>
            </div>
          ` : ''}
          
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
            ${ar.status ? `<span style="background:${statusColors[ar.status]}22;color:${statusColors[ar.status]};border:1px solid ${statusColors[ar.status]}55;padding:0.25rem 0.85rem;border-radius:999px;font-size:0.75rem;font-weight:700;">${statusIcons[ar.status]}</span>` : ''}
            ${ar.date ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;color:var(--text-secondary);">📅 ${new Date(ar.date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</span>` : ''}
          </div>
          
          ${ar.reportUrl ? `<a href="${ar.reportUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.6rem 1rem;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);border-radius:0.5rem;font-size:0.8rem;color:#38bdf8;text-decoration:none;font-weight:600;transition:all 0.2s ease;">📄 View Full Audit Report ↗</a>` : ''}
          ${ar.notes ? `<div style="font-size:0.8rem;color:var(--text-secondary);background:rgba(0,0,0,0.2);padding:0.75rem;border-radius:0.5rem;border-left:3px solid rgba(59,130,246,0.5);line-height:1.6;">${ar.notes}</div>` : ''}
        </div>` : emptyState('No audit report attached yet.');

      body.innerHTML = `
        ${sectionLabel('🔍', 'Audit Report')}
        ${existingHTML}
        ${addForm('audit-add-form', `
          <div style="font-size:0.65rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.65rem;">${ar.status ? 'Update Audit Report' : '+ Attach Audit Report'}</div>
          <div style="display:flex;flex-direction:column;gap:0.5rem;">
            <div class="form-group" style="margin:0;"><label>AUDITOR / FIRM</label><input type="text" id="audit-new-firm" value="${ar.firm || ''}" placeholder="e.g. Deloitte &amp; Touche LLP"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
              <div class="form-group" style="margin:0;"><label>AUDIT DATE</label><input type="date" id="audit-new-date" value="${ar.date || ''}"></div>
              <div class="form-group" style="margin:0;"><label>STATUS</label>
                <select id="audit-new-status">
                  <option value="">— No Audit —</option>
                  <option value="Pending" ${ar.status==='Pending'?'selected':''}>⏳ Pending Review</option>
                  <option value="Passed" ${ar.status==='Passed'?'selected':''}>✓ Passed</option>
                  <option value="Qualified" ${ar.status==='Qualified'?'selected':''}>⚠ Qualified Opinion</option>
                  <option value="Failed" ${ar.status==='Failed'?'selected':''}>✗ Failed</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin:0;"><label>REPORT URL</label><input type="url" id="audit-new-url" value="${ar.reportUrl || ''}" placeholder="https://example.com/audit-report.pdf"></div>
            <div class="form-group" style="margin:0;"><label>AUDIT NOTES</label><textarea id="audit-new-notes" rows="3" placeholder="Key findings, scope, qualifications...">${ar.notes || ''}</textarea></div>
          </div>
          ${saveBtn('Save Audit Report')}
        `)}
      `;
      body.querySelector('#audit-add-form .rp-save-btn').addEventListener('click', () => {
        const firm = document.getElementById('audit-new-firm').value.trim();
        const date = document.getElementById('audit-new-date').value;
        const status = document.getElementById('audit-new-status').value;
        const reportUrl = document.getElementById('audit-new-url').value.trim();
        const notes = document.getElementById('audit-new-notes').value.trim();
        const auditReport = (firm || status || reportUrl)
          ? { firm, date, status, reportUrl, notes }
          : null;
        ledger.updateRecord(r.id, { auditReport });
        renderLedger();
        renderTab('audit');
      });
    }
  }

  // Tab click listeners
  tabs.forEach(t => t.addEventListener('click', () => renderTab(t.dataset.tab)));

  renderTab('overview');
  overlay.classList.add('active');
}


// ==========================================
// SGA LIVE NEWS TERMINAL ENGINE
// ==========================================

// ==========================================
// SGA LIVE NEWS TERMINAL ENGINE & SPA ROUTER
// ==========================================

function initNewsUI() {
  // Wire up filter controls on the dedicated news page
  const searchInput = document.getElementById('news-search-main');
  const stateFilter = document.getElementById('news-filter-state-main');
  const sentimentFilter = document.getElementById('news-filter-sentiment-main');
  const impactFilter = document.getElementById('news-filter-impact-main');
  const sourceFilter = document.getElementById('news-filter-source-main');

  if (stateFilter && stateFilter.options.length <= 1) {
    const sortedStates = [...statesData].sort((a, b) => a.name.localeCompare(b.name));
    sortedStates.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = `${s.name} (${s.id})`;
      stateFilter.appendChild(option);
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderNews);
  if (stateFilter) stateFilter.addEventListener('change', renderNews);
  if (sentimentFilter) sentimentFilter.addEventListener('change', renderNews);
  if (impactFilter) impactFilter.addEventListener('change', renderNews);
  if (sourceFilter) sourceFilter.addEventListener('change', renderNews);

  // Update header news count
  const badgeEl = document.getElementById('header-news-count');
  if (badgeEl) {
    badgeEl.textContent = String(newsData.length);
  }

  // Load initial state news
  loadInitialStateNews();

  // Start background news generator loop (generates a live flash alert every 45 seconds)
  if (window.liveNewsInterval) clearInterval(window.liveNewsInterval);
  window.liveNewsInterval = setInterval(generateLiveNews, 45000);
}

async function loadInitialStateNews() {
  try {
    // Fetch news from just 3 states initially for faster loading
    const sampleStates = statesData.slice(0, 3).map(s => s.id);
    const initialNews = [];
    
    // Use Promise.all for parallel loading instead of sequential
    const newsPromises = sampleStates.map(async (stateId) => {
      try {
        const articles = await newsFetcher.fetchStateNews(stateId);
        return articles.map(article => ({
          id: ++newsIdCounter,
          stateId,
          title: article.title,
          description: article.description || article.summary || article.contentSnippet || `Economic development news from ${stateId}`,
          link: article.link,
          sentiment: article.sentiment || 'Neutral',
          impactScore: article.impactScore || 30,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          source: 'external'
        }));
      } catch (error) {
        console.warn(`Failed to load initial news for ${stateId}:`, error);
        return [];
      }
    });
    
    // Also fetch Business Wire news separately (no date filter to get all available English articles)
    const businessWirePromise = newsFetcher.fetchBusinessWireNews(null, true).then(articles => {
      return articles.map(article => ({
        id: ++newsIdCounter,
        stateId: article.stateId,
        title: article.title,
        description: article.description || `Business Wire news regarding ${article.title.toLowerCase().includes('expansion') ? 'business expansion' : 'corporate developments'}`,
        link: article.link,
        sentiment: article.sentiment || 'Neutral',
        impactScore: article.impactScore || 35,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        source: 'Business Wire'
      }));
    }).catch(error => {
      console.warn('Failed to load Business Wire news:', error);
      return [];
    });
    
    const results = await Promise.all([...newsPromises, businessWirePromise]);
    results.forEach(articles => {
      initialNews.push(...articles);
    });
    
    // Add initial news to the feed
    initialNews.forEach(story => {
      if (!window.postedArticleUrls.has(story.link)) {
        window.postedArticleUrls.add(story.link);
        newsData.unshift(story);
      }
    });
    
    // Update badge
    const badgeEl = document.getElementById('header-news-count');
    if (badgeEl) {
      badgeEl.textContent = String(newsData.length);
    }
    
    console.log(`Loaded ${initialNews.length} initial state news articles`);
  } catch (error) {
    console.error('Failed to load initial state news:', error);
  }
}

async function generateLiveNews() {
  if (!window.postedArticleUrls) {
    window.postedArticleUrls = new Set();
  }

  // 1. Try to fetch live corporate site selection news from Area Development RSS feed
  const rssArticles = await fredService.fetchRealEconomicNews(statesData);
  const newArticles = rssArticles.filter(art => art.matchedState && !window.postedArticleUrls.has(art.link));

  // 2. Try to fetch from state economic development websites
  let stateNewsArticles = [];
  if (newArticles.length === 0) {
    try {
      const randomState = statesData[Math.floor(Math.random() * statesData.length)];
      stateNewsArticles = await newsFetcher.fetchStateNews(randomState.id);
      stateNewsArticles = stateNewsArticles.filter(art => !window.postedArticleUrls.has(art.link));
    } catch (error) {
      console.warn('State news fetch failed:', error);
    }
  }

  // 3. Try to fetch from Business Wire (no date filter to get all available English articles)
  let businessWireArticles = [];
  try {
    businessWireArticles = await newsFetcher.fetchBusinessWireNews(null, true);
    businessWireArticles = businessWireArticles.filter(art => !window.postedArticleUrls.has(art.link));
    console.log(`Business Wire: Found ${businessWireArticles.length} new articles with job filter`);
  } catch (error) {
    console.warn('Business Wire fetch failed:', error);
  }

  let newStory = null;
  let state = null;
  let path = null;

  if (newArticles.length > 0) {
    // A. We have a fresh corporate catalyst! Use the real-world article
    const article = newArticles[0];
    window.postedArticleUrls.add(article.link);
    state = article.matchedState;
    path = document.getElementById(state.id);

    const prevEOI = calculateEOI(state);

    // Dynamic catalyst pricing: determine positive impact score based on headline triggers
    let impactScore = 15 + Math.floor(Math.random() * 16); // Default +15 to +30
    const lTitle = article.title.toLowerCase();
    if (lTitle.includes("billion") || lTitle.includes("data center") || lTitle.includes("chips") || lTitle.includes("gigafactory") || lTitle.includes("headquarters") || lTitle.includes("expansion")) {
      impactScore = 50 + Math.floor(Math.random() * 36); // Mega-scale (+50 to +85)
    } else if (lTitle.includes("million") || lTitle.includes("grant") || lTitle.includes("funding") || lTitle.includes("subsidy")) {
      impactScore = 30 + Math.floor(Math.random() * 21); // Medium-scale (+30 to +50)
    }

    // Reactively update the state's in-memory variables to simulate capital inflow
    const capexRatio = 1 + (impactScore / 150);
    state.investment = Math.round(state.investment * capexRatio);
    state.business = Math.round(state.business * (1 + (impactScore / 300)));
    state.gdp = Math.round(state.gdp * (1 + (impactScore / 1000)));
    state.growth = parseFloat((state.growth + (impactScore / 100)).toFixed(2));

    const newEOI = calculateEOI(state);
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    newStory = {
      id: ++newsIdCounter,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stateId: state.id,
      title: article.title,
      description: article.description,
      sentiment: "Bullish",
      impactScore,
      link: article.link
    };
  } else if (stateNewsArticles.length > 0) {
    // B. Use state economic development news
    const article = stateNewsArticles[0];
    window.postedArticleUrls.add(article.link);
    state = statesData.find(s => s.id === article.stateId);
    path = document.getElementById(state.id);
    const prevEOI = calculateEOI(state);

    // Dynamic catalyst pricing based on headline triggers
    let impactScore = 15 + Math.floor(Math.random() * 16);
    const lTitle = article.title.toLowerCase();
    if (lTitle.includes("billion") || lTitle.includes("data center") || lTitle.includes("chips") || lTitle.includes("gigafactory") || lTitle.includes("headquarters") || lTitle.includes("expansion")) {
      impactScore = 50 + Math.floor(Math.random() * 36);
    } else if (lTitle.includes("million") || lTitle.includes("grant") || lTitle.includes("funding") || lTitle.includes("subsidy")) {
      impactScore = 30 + Math.floor(Math.random() * 21);
    }

    // Reactively update the state's in-memory variables
    const capexRatio = 1 + (impactScore / 150);
    state.investment = Math.round(state.investment * capexRatio);
    state.business = Math.round(state.business * (1 + (impactScore / 300)));
    state.gdp = Math.round(state.gdp * (1 + (impactScore / 1000)));
    state.growth = parseFloat((state.growth + (impactScore / 100)).toFixed(2));

    const newEOI = calculateEOI(state);
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    newStory = {
      id: ++newsIdCounter,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stateId: state.id,
      title: article.title,
      description: article.description,
      sentiment: article.sentiment || "Bullish",
      impactScore: article.impactScore || impactScore,
      link: article.link,
      source: 'external'
    };
  } else if (businessWireArticles.length > 0) {
    // C. Use Business Wire news (past 90 days for testing)
    let article = businessWireArticles[0];
    window.postedArticleUrls.add(article.link);
    state = statesData.find(s => s.id === article.stateId);
    
    // If first article doesn't match a state, try the next one
    if (!state && businessWireArticles.length > 1) {
      article = businessWireArticles[1];
      window.postedArticleUrls.add(article.link);
      state = statesData.find(s => s.id === article.stateId);
    }
    
    // If still no state match, skip to fallback
    if (!state) {
      console.log('Business Wire articles had no matching state, using fallback');
    } else {
      path = document.getElementById(state.id);
      const prevEOI = calculateEOI(state);

      let impactScore = 15 + Math.floor(Math.random() * 16);
      const lTitle = article.title.toLowerCase();
      if (lTitle.includes("billion") || lTitle.includes("data center") || lTitle.includes("chips") || lTitle.includes("gigafactory") || lTitle.includes("headquarters") || lTitle.includes("expansion")) {
        impactScore = 50 + Math.floor(Math.random() * 36);
      } else if (lTitle.includes("million") || lTitle.includes("grant") || lTitle.includes("funding") || lTitle.includes("subsidy")) {
        impactScore = 30 + Math.floor(Math.random() * 21);
      }

      const capexRatio = 1 + (impactScore / 150);
      state.investment = Math.round(state.investment * capexRatio);
      state.business = Math.round(state.business * (1 + (impactScore / 300)));
      state.gdp = Math.round(state.gdp * (1 + (impactScore / 1000)));
      state.growth = parseFloat((state.growth + (impactScore / 100)).toFixed(2));

      const newEOI = calculateEOI(state);
      totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

      newStory = {
        id: ++newsIdCounter,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        stateId: state.id,
        title: article.title,
        description: article.description || `Business Wire news regarding ${article.title.toLowerCase().includes('expansion') ? 'business expansion' : 'corporate developments'}`,
        sentiment: article.sentiment || "Bullish",
        impactScore: article.impactScore || impactScore,
        link: article.link,
        source: 'Business Wire'
      };
    }
  }

  // D. Fallback: If no story yet, query live economic observations from the FRED API
  if (!newStory) {
    state = statesData[Math.floor(Math.random() * statesData.length)];
    path = document.getElementById(state.id);
    const prevEOI = calculateEOI(state);

    const updatedMetrics = await fredService.getLiveStateEOI(state);
    Object.assign(state, updatedMetrics);

    const newEOI = calculateEOI(state);
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    newStory = fredService.generateLiveNewsFlash(state, updatedMetrics, prevEOI, newEOI);
  }

  // 2. Update local state map path colors in real-time based on new EOI bounds
  updateStateMapColor(state);

  // 3. Push the new story into newsData array
  newsData.unshift(newStory);
  if (newsData.length > 100) {
    newsData.pop();
  }

  const badgeEl = document.getElementById('header-news-count');
  if (badgeEl) {
    badgeEl.textContent = String(newsData.length);
  }

  showNewsFlashAlert(newStory);

  // 4. Render dynamic economic pricing and charts if this state is currently viewed
  if (currentTradingStateData && state.id === currentTradingStateData.id) {
    const shockMagnitude = (newStory.impactScore / 100) * CONTRACT_SPECS.tickSize * 25;
    window.priceMomentum = (window.priceMomentum || 0) + shockMagnitude;
    window.liquidityImbalance = (window.liquidityImbalance || 0) + (newStory.impactScore * 2.0);
    showTradeNotification(`⚠️ MARKET SHOCK: ${state.id}-SGA price impacted by live news flash! (${newStory.sentiment === "Bullish" ? "+" : ""}${newStory.impactScore} Impact)`, newStory.sentiment === 'Bullish' ? 'buy' : 'sell');

    // Refresh selections to update details panel, margin reqs, expected payouts
    selectState(state, path || document.getElementById(state.id));
  }

  // 5. Re-render the index table and news feed
  renderTable();

  const newsPage = document.getElementById('news-page');
  if (newsPage && !newsPage.classList.contains('hidden')) {
    renderNews();
  }
}

function showNewsFlashAlert(story) {
  const container = document.getElementById('news-flash-container');
  if (!container) return;

  const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');

  container.innerHTML = `
    <div class="news-flash-alert-header">
      <span style="font-weight: 700; font-size: 0.7rem; color: var(--accent-gold); letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
        <span style="display:inline-block; width: 4px; height: 4px; background: var(--accent-gold); border-radius: 50%; animation: pulse 1s infinite;"></span>
        LIVE SGA NEWS FLASH
      </span>
      <button class="news-flash-alert-close">&times;</button>
    </div>
    <div style="display: flex; gap: 0.4rem; align-items: center;">
      <span class="news-badge-reg">${story.stateId}</span>
      <span class="news-badge-sent ${story.sentiment.toLowerCase()}">${story.sentiment}</span>
      <span class="news-badge-impact" style="color: ${sentimentColor}; font-family: monospace;">Impact: ${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
    </div>
    <div style="font-weight: 700; font-size: 0.85rem; color: #fff; line-height: 1.3;">${story.title}</div>
    <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${story.description}</div>
  `;

  container.querySelector('.news-flash-alert-close').onclick = (e) => {
    e.stopPropagation();
    container.classList.remove('show');
  };

  container.onclick = (e) => {
    if (e.target.classList.contains('news-flash-alert-close')) return;
    container.classList.remove('show');
    window.location.hash = `#article-${story.id}`;
  };

  container.classList.add('show');

  if (window.newsFlashTimer) clearTimeout(window.newsFlashTimer);
  window.newsFlashTimer = setTimeout(() => {
    container.classList.remove('show');
  }, 8000);
}

function filterBusinessWireOnly() {
  const sourceFilter = document.getElementById('news-filter-source-main');
  if (sourceFilter) {
    sourceFilter.value = 'Business Wire';
    renderNews();
  }
}

function renderNews() {
  const listEl = document.getElementById('news-feed-main');
  if (!listEl) return;

  const searchInput = document.getElementById('news-search-main');
  const stateFilter = document.getElementById('news-filter-state-main');
  const sentimentFilter = document.getElementById('news-filter-sentiment-main');
  const impactFilter = document.getElementById('news-filter-impact-main');
  const sourceFilter = document.getElementById('news-filter-source-main');

  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
  const stateVal = stateFilter ? stateFilter.value : 'All';
  const sentimentVal = sentimentFilter ? sentimentFilter.value : 'All';
  const impactVal = impactFilter ? impactFilter.value : 'All';
  const sourceVal = sourceFilter ? sourceFilter.value : 'All';

  // 1. Update Macro Sentiment Monitor
  const bullishCount = newsData.filter(s => s.sentiment === 'Bullish').length;
  const bearishCount = newsData.filter(s => s.sentiment === 'Bearish').length;
  const neutralCount = newsData.filter(s => s.sentiment === 'Neutral').length;
  const totalNews = newsData.length || 1;

  const bullishPct = Math.round((bullishCount / totalNews) * 100);
  const neutralPct = Math.round((neutralCount / totalNews) * 100);
  const bearishPct = 100 - bullishPct - neutralPct; // ensure sums exactly to 100

  const pctBullishEl = document.getElementById('sentiment-bullish-pct');
  if (pctBullishEl) pctBullishEl.textContent = `${bullishPct}%`;

  const barBullishEl = document.getElementById('sentiment-bar-bullish');
  const barNeutralEl = document.getElementById('sentiment-bar-neutral');
  const barBearishEl = document.getElementById('sentiment-bar-bearish');
  if (barBullishEl) barBullishEl.style.width = `${bullishPct}%`;
  if (barNeutralEl) barNeutralEl.style.width = `${neutralPct}%`;
  if (barBearishEl) barBearishEl.style.width = `${Math.max(0, bearishPct)}%`;

  const countBullishEl = document.getElementById('sentiment-count-bullish');
  const countNeutralEl = document.getElementById('sentiment-count-neutral');
  const countBearishEl = document.getElementById('sentiment-count-bearish');
  if (countBullishEl) countBullishEl.textContent = String(bullishCount);
  if (countNeutralEl) countNeutralEl.textContent = String(neutralCount);
  if (countBearishEl) countBearishEl.textContent = String(bearishCount);

  // 2. Update News Last Tick Time
  const lastTickEl = document.getElementById('news-last-tick');
  if (lastTickEl && newsData.length > 0) {
    lastTickEl.innerHTML = `<strong style="color: var(--accent-blue)">${newsData[0].time}</strong>`;
  }

  // 3. Update High Impact Shocks Sidebar
  const highImpactStories = [...newsData]
    .filter(story => Math.abs(story.impactScore) >= 20)
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, 5);

  const shocksListEl = document.getElementById('hot-shocks-list');
  if (shocksListEl) {
    if (highImpactStories.length === 0) {
      shocksListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; padding: 1rem 0;">No high-impact shocks.</div>`;
    } else {
      shocksListEl.innerHTML = highImpactStories.map(story => {
        const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : '#ef4444';
        return `
          <div class="shock-item" data-state="${story.stateId}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 0.5rem 0.75rem; border-radius: 0.4rem; cursor: pointer; transition: background 0.2s;">
            <div style="display: flex; flex-direction: column; gap: 0.15rem; max-width: 75%;">
              <span style="font-size: 0.75rem; font-weight: bold; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${story.title}</span>
              <span style="font-size: 0.6rem; color: var(--text-secondary);">${story.stateId} &middot; ${story.time}</span>
            </div>
            <span style="font-family: monospace; font-size: 0.75rem; font-weight: bold; color: ${sentimentColor};">${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
          </div>
        `;
      }).join('');

      shocksListEl.querySelectorAll('.shock-item').forEach(item => {
        item.addEventListener('click', () => {
          const stateId = item.getAttribute('data-state');
          navigateToTrading(stateId);
        });
      });
    }
  }

  // 4. Update 50-State Sentiment Matrix
  const matrixEl = document.getElementById('state-news-matrix');
  if (matrixEl) {
    matrixEl.innerHTML = statesData.map(state => {
      const latestStory = newsData.find(story => story.stateId === state.id);
      let sentimentClass = 'neutral';
      let dotColor = '#94a3b8';
      if (latestStory) {
        sentimentClass = latestStory.sentiment.toLowerCase();
        dotColor = latestStory.sentiment === 'Bullish' ? '#10b981' : (latestStory.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');
      }

      return `
        <div class="matrix-pill" data-state="${state.id}" title="${state.name}: Latest sentiment is ${latestStory ? latestStory.sentiment : 'Neutral'}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.35rem 0.2rem; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 0.25rem; cursor: pointer; transition: all 0.2s;">
          <span style="font-weight: 700; color: #fff; margin-bottom: 2px;">${state.id}</span>
          <span style="display: inline-block; width: 6px; height: 6px; background: ${dotColor}; border-radius: 50%; box-shadow: 0 0 5px ${dotColor};"></span>
        </div>
      `;
    }).join('');

    matrixEl.querySelectorAll('.matrix-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const stateId = pill.getAttribute('data-state');
        const stateFilterEl = document.getElementById('news-filter-state-main');
        if (stateFilterEl) {
          stateFilterEl.value = stateId;
          renderNews();
        }
      });
      pill.addEventListener('mouseenter', () => {
        pill.style.background = 'rgba(255,255,255,0.08)';
        pill.style.borderColor = 'rgba(255,255,255,0.2)';
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.background = 'rgba(255,255,255,0.02)';
        pill.style.borderColor = 'var(--glass-border)';
      });
    });
  }

  // 5. Filter and Render News Feed
  const filtered = newsData.filter(story => {
    const stateObj = statesData.find(s => s.id === story.stateId);
    const stateName = stateObj ? stateObj.name : 'United States';
    const textMatch =
      story.title.toLowerCase().includes(searchVal) ||
      story.description.toLowerCase().includes(searchVal) ||
      story.stateId.toLowerCase().includes(searchVal) ||
      stateName.toLowerCase().includes(searchVal);

    if (!textMatch) return false;

    if (stateVal !== 'All' && story.stateId !== stateVal) return false;

    if (sentimentVal !== 'All' && story.sentiment !== sentimentVal) return false;

    const absImpact = Math.abs(story.impactScore);
    if (impactVal === 'High' && absImpact <= 50) return false;
    if (impactVal === 'Med' && (absImpact < 20 || absImpact > 50)) return false;
    if (impactVal === 'Low' && absImpact >= 20) return false;

    // Source filter
    if (sourceVal !== 'All') {
      const storySource = story.source || 'internal';
      if (sourceVal === 'Business Wire' && storySource !== 'Business Wire') return false;
      if (sourceVal === 'external' && storySource !== 'external') return false;
      if (sourceVal === 'internal' && storySource !== 'internal') return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 3rem;">No news matches the active intelligence filters.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(story => {
    const sentimentClass = story.sentiment.toLowerCase();
    const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');
    const stateObj = statesData.find(s => s.id === story.stateId);
    const stateName = stateObj ? stateObj.name : 'National Macro';
    
    // Determine source badge color and label
    const source = story.source || 'internal';
    let sourceBadgeColor = '#6366f1'; // Default internal (indigo)
    let sourceLabel = 'SGA Internal';
    if (source === 'Business Wire') {
      sourceBadgeColor = '#8b5cf6'; // Purple for Business Wire
      sourceLabel = 'Business Wire';
    } else if (source === 'external') {
      sourceBadgeColor = '#06b6d4'; // Cyan for state sources
      sourceLabel = 'State Source';
    }

    return `
      <div class="news-card ${sentimentClass}" data-state="${story.stateId}" data-id="${story.id}">
        <div class="news-card-header">
          <div class="news-card-badges">
            <span class="news-badge-reg">${story.stateId}</span>
            <span class="news-badge-sent ${sentimentClass}">${story.sentiment}</span>
            <span class="news-badge-impact" style="color: ${sentimentColor}; font-family: monospace;">Impact: ${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
            <span class="news-badge-source" style="background: ${sourceBadgeColor}20; border-color: ${sourceBadgeColor}; color: ${sourceBadgeColor};">${sourceLabel}</span>
          </div>
          <span class="news-card-time">${story.time}</span>
        </div>
        <div class="news-card-title">${story.title}</div>
        <div class="news-card-description">${story.description}</div>
        <div class="news-card-footer">
          <span>Target Contract: ${story.stateId}-SGA (${stateName})</span>
          <span>&middot;</span>
          <span>Source: ${story.source || 'SGA Network'}</span>
          <span>&middot;</span>
          <span>Click to View Full Catalyst Article</span>
        </div>
      </div>
    `;
  }).join('');

  const cards = listEl.querySelectorAll('.news-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const storyId = card.getAttribute('data-id');
      window.location.hash = `#article-${storyId}`;
    });
  });
}

function navigateToTrading(stateId) {
  if (stateId === 'US') return;
  const state = statesData.find(s => s.id === stateId);
  const mapPath = document.getElementById(stateId);
  if (state && mapPath) {
    window.location.hash = '#table';
    setTimeout(() => {
      selectState(state, mapPath);
      const terminalEl = document.getElementById('table');
      if (terminalEl) {
        terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}

async function fetchFullPressRelease(url) {
  try {
    if (!url) return null;

    // Fix Utah URLs that might be missing the /usbci/ prefix
    let workingUrl = url;
    if (url.includes('business.utah.gov') && url.includes('usbci') && !url.includes('/usbci/')) {
      workingUrl = url.replace('business.utah.gov/', 'business.utah.gov/usbci/');
      console.log('Fixed Utah URL:', workingUrl);
    }

    // Fix Georgia URLs that might be using wrong domain
    if (url.includes('georgia.org') && !url.includes('gov.georgia.gov')) {
      workingUrl = url.replace('georgia.org', 'gov.georgia.gov');
      console.log('Fixed Georgia URL:', workingUrl);
    }

    // CORS proxies to bypass browser restrictions
    const CORS_PROXIES = [
      'http://localhost:3001/proxy?url=',
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
      'https://api.codetabs.com/v1/proxy?quest='
    ];

    let htmlText = null;
    let fetchError = null;

    // First, try direct fetch for areadevelopment.com (has local proxy)
    if (workingUrl.includes('areadevelopment.com')) {
      try {
        let proxiedUrl = workingUrl;
        if (workingUrl.startsWith('https://www.areadevelopment.com')) {
          proxiedUrl = workingUrl.replace('https://www.areadevelopment.com', '/api/areadevelopment');
        } else if (workingUrl.startsWith('http://www.areadevelopment.com')) {
          proxiedUrl = workingUrl.replace('http://www.areadevelopment.com', '/api/areadevelopment');
        } else if (workingUrl.startsWith('/')) {
          proxiedUrl = `/api/areadevelopment${workingUrl}`;
        }

        const response = await fetch(proxiedUrl);
        if (response.ok) {
          htmlText = await response.text();
        }
      } catch (error) {
        console.warn('Direct areadevelopment fetch failed:', error.message);
        fetchError = error;
      }
    }

    // If direct fetch failed or not areadevelopment.com, try CORS proxies
    if (!htmlText) {
      for (const proxy of CORS_PROXIES) {
        try {
          const response = await fetch(proxy + encodeURIComponent(workingUrl), {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
          });
          
          if (response.ok) {
            htmlText = await response.text();
            console.log(`Successfully fetched via proxy: ${proxy}`);
            break;
          }
        } catch (error) {
          console.warn(`Proxy ${proxy} failed:`, error.message);
          fetchError = error;
          continue;
        }
      }
    }

    if (!htmlText) {
      console.error('All fetch attempts failed for:', workingUrl);
      return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Try multiple content selectors for different website structures
    const contentEl = doc.querySelector('section.areaArticleBody') ||
      doc.querySelector('[itemprop="articleBody"]') ||
      doc.querySelector('.story-content') ||
      doc.querySelector('.article-body') ||
      doc.querySelector('.entry-content') ||
      doc.querySelector('.post-content') ||
      doc.querySelector('.field--name-body') ||
      doc.querySelector('.field--name-field-body') ||
      doc.querySelector('.news-content') ||
      doc.querySelector('.press-release-content') ||
      doc.querySelector('.content-body') ||
      doc.querySelector('.post-body') ||
      doc.querySelector('.node-content') ||
      doc.querySelector('.article-content') ||
      doc.querySelector('.main-content') ||
      doc.querySelector('article') ||
      doc.querySelector('.content') ||
      doc.querySelector('main') ||
      doc.querySelector('.post') ||
      doc.querySelector('.entry') ||
      doc.querySelector('.field--type-text-with-summary') ||
      doc.querySelector('.field--name-body') ||
      doc.querySelector('.paragraph') ||
      doc.querySelector('.region-content');

    if (contentEl) {
      // Remove elements that are sidebars, advertisements, or related articles to keep layout clean
      const toRemove = contentEl.querySelectorAll('script, style, iframe, aside, .sidebar, .ads, .advertisement, .related-items, .navigation, .comments, .share-buttons, .social-share, .author-box, .tags, .categories');
      toRemove.forEach(el => el.remove());

      // Return the clean HTML content of the article body
      const content = contentEl.innerHTML.trim();
      return content.length > 100 ? content : null; // Only return if we got substantial content
    }

    console.error('No content element found for:', workingUrl);
    return null;
  } catch (error) {
    console.error('Error fetching full press release:', error);
    return null;
  }
}

// ==========================================
// DYNAMIC ARTICLE CONTENT GENERATOR
// ==========================================

function boldImportantMetrics(text) {
  if (!text) return "";
  return text
    .replace(/(\$[\d,.]+\s*(?:million|billion|M|B|trillion))/gi, '<strong>$1</strong>')
    .replace(/(\b\d{1,3}(?:,\d{3})*\s*(?:jobs|new jobs|positions|advanced positions|technical positions))/gi, '<strong>$1</strong>');
}

function generateArticleContent(story) {
  const state = statesData.find(s => s.id === story.stateId) || { name: "National Macro", growth: 1.5, employment: 95.0 };
  const sentiment = story.sentiment;
  const description = story.description;
  const title = story.title;
  const price = parseFloat((calculateEOI(state) * CONTRACT_SPECS.pricingScale).toFixed(2));
  const stateName = state.name;

  let subtitle = "";
  if (sentiment === "Bullish") {
    subtitle = `Sovereign contract values for ${stateName} spike as private capital inflows and infrastructure adjustments push economic output indexes above historic benchmarks.`;
  } else if (sentiment === "Bearish") {
    subtitle = `Supply-side caps and localized logistics hurdles trigger downward pressure on ${stateName} sovereign growth benchmarks.`;
  } else {
    subtitle = `Balanced economic metrics and stable capital yields sustain range-bound volatility within ${stateName} sovereign growth pools.`;
  }

  // Generate intelligent summary based on available content
  let summary = "";
  
  // Check if description is generic or missing
  const isGenericDescription = !description || 
    description.includes(`Economic development news from`) ||
    description.includes(`Press release from`) ||
    description.length < 50;
  
  if (isGenericDescription) {
    // Generate summary from title and state context
    const lowerTitle = title.toLowerCase();
    let generatedSummary = "";
    
    if (lowerTitle.includes("expansion") || lowerTitle.includes("growth") || lowerTitle.includes("investment")) {
      generatedSummary = `${stateName} is experiencing significant economic activity with new capital projects and business expansion initiatives. This development signals strengthening regional economic fundamentals and improved business climate conditions.`;
    } else if (lowerTitle.includes("jobs") || lowerTitle.includes("employment") || lowerTitle.includes("hiring")) {
      generatedSummary = `Labor market dynamics in ${stateName} show positive momentum with new employment opportunities emerging across key sectors. This workforce development indicates sustainable economic growth and increased household income potential.`;
    } else if (lowerTitle.includes("funding") || lowerTitle.includes("grant") || lowerTitle.includes("investment") || lowerTitle.includes("million") || lowerTitle.includes("billion")) {
      generatedSummary = `Major capital allocation and investment initiatives are strengthening ${stateName}'s economic infrastructure. These financial commitments support long-term competitiveness and regional development objectives.`;
    } else if (lowerTitle.includes("appointment") || lowerTitle.includes("announces")) {
      generatedSummary = `Government leadership and administrative developments in ${stateName} are shaping economic policy direction. These official actions reflect strategic priorities for regional economic advancement.`;
    } else {
      generatedSummary = `Economic developments in ${stateName} reflect evolving market conditions and policy initiatives. Regional economic indicators suggest adjustment in response to changing business dynamics and competitive landscape factors.`;
    }
    
    summary = boldImportantMetrics(generatedSummary);
  } else {
    // Use the original description with bold metrics
    summary = boldImportantMetrics(description);
  }

  // Ensure summary has some content
  if (!summary || summary.length < 20) {
    summary = boldImportantMetrics(`Economic catalyst activity in ${stateName} indicates evolving market conditions with potential impact on regional sovereign growth indices and capital allocation patterns.`);
  }
  const targetVal = sentiment === "Bullish"
    ? (price * (1 + Math.abs(story.impactScore) / 300)).toFixed(2)
    : (sentiment === "Bearish"
      ? (price * (1 - Math.abs(story.impactScore) / 300)).toFixed(2)
      : price.toFixed(2));

  const projectedChange = sentiment === "Bullish"
    ? `+${((parseFloat(targetVal) - price) / price * 100).toFixed(1)}%`
    : (sentiment === "Bearish"
      ? `-${((price - parseFloat(targetVal)) / price * 100).toFixed(1)}%`
      : "0.0%");

  const recommendation = sentiment === "Bullish"
    ? "<span style='color: #10b981; font-weight: bold;'>LONG / BUY</span>"
    : (sentiment === "Bearish"
      ? "<span style='color: #ef4444; font-weight: bold;'>SHORT / SELL</span>"
      : "<span style='color: #94a3b8; font-weight: bold;'>HOLD / NEUTRAL</span>");

  const analysis = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Recommendation</span>
        <span style="font-size: 0.9rem; font-weight: 700;">${recommendation}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Projected Target Price</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-blue); font-family: monospace;">$${targetVal}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Estimated Price Move</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: ${sentiment === 'Bullish' ? '#10b981' : (sentiment === 'Bearish' ? '#ef4444' : '#94a3b8')}; font-family: monospace;">${projectedChange}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Catalyst Weight</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-gold); font-family: monospace;">${story.impactScore > 0 ? '+' : ''}${story.impactScore} Score</span>
      </div>
    </div>
    <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0; margin-bottom: 1rem;">
      <strong>Market Intelligence Brief:</strong> Based on the capital inflow catalyst for <strong>${stateName}</strong>, the regional EOI is projected to experience a ${sentiment === 'Bullish' ? 'positive shock' : (sentiment === 'Bearish' ? 'downward adjustment' : 'stable baseline transition')}. 
      ${sentiment === 'Bullish'
      ? `This expansion represents a structural injection into local ${stateName} business formation and capital asset indices. High-frequency algorithms indicate strong order book demand, suggesting that active long positions will see a significant appreciation ahead of contract settlement.`
      : (sentiment === 'Bearish'
        ? `This disruption is expected to temporarily compress municipal tax receipts and logistics output. High-frequency algorithms suggest near-term downward pressure, making short positions the optimal hedge against regional economic contraction.`
        : `The steady operational balance preserves standard index ranges. Spot price volatility is expected to remain low, offering a highly stable yield-generating vehicle through standard rebalancing distributions.`
      )
    }
    </p>
    <div style="font-size: 0.6rem; color: rgba(255, 255, 255, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.75rem; line-height: 1.4; font-style: italic;">
      <strong>DISCLAIMER:</strong> SGA Network EOI projections and recommendation postures are generated by automated quantitative algorithms. This does not constitute licensed financial, investment, legal, or tax advice, nor a solicitation or endorsement to trade real securities.
    </div>
  `;

  return { subtitle, summary, analysis };
}

// ==========================================
// ARTICLE DETAIL SCREEN RENDERER
// ==========================================

function renderArticleDetail(storyId) {
  const container = document.getElementById('article-page');
  if (!container) return;

  const story = newsData.find(s => s.id === parseInt(storyId, 10) || s.id === storyId || s.id === Number(storyId));
  if (!story) {
    container.innerHTML = `
      <div class="glass-card" style="padding: 3rem; text-align: center;">
        <h3 style="color: var(--accent-gold); margin-bottom: 1.5rem;">Article Not Found</h3>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">The requested catalyst intelligence report could not be located in active memory pools.</p>
        <a href="#news" class="article-back-btn" style="margin-bottom: 0;">◀ Return to News Terminal</a>
      </div>
    `;
    return;
  }

  const state = statesData.find(s => s.id === story.stateId) || { name: "National Macro", growth: 1.5, employment: 95.0 };
  const eoi = calculateEOI(state);
  const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
  const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');

  // Generate Paragraphs
  const { subtitle, summary, analysis } = generateArticleContent(story);

  const hasPressRelease = story.isPrattMiller || !!story.link;
  const isPratt = story.isPrattMiller || (story.title && story.title.includes("Pratt Miller"));

  container.innerHTML = `
    <a href="#news" class="article-back-btn">◀ Return to News Terminal</a>
    
    <div class="article-container">
      <!-- Left Column: Bloomberg Article Card -->
      <div class="article-content-card">
        <div class="article-meta">
          <span>📁 SGA SOVEREIGN FUTURES</span>
          <span>&middot;</span>
          <span>✍️ GLOBAL INTELLIGENCE DESK</span>
          <span>&middot;</span>
          <span>🕒 PUBLISHED ${story.time}</span>
        </div>
        
        ${hasPressRelease ? `
        <div class="article-tabs">
          <button class="art-tab-btn active sga-tab" id="tab-our-btn">SGA Intelligence Report</button>
          <button class="art-tab-btn real-tab" id="tab-real-btn">Official Press Release</button>
        </div>

        <div id="art-sga-content">
          <h1 class="article-headline">${story.title}</h1>
          <div class="article-subtitle">${subtitle}</div>
          
          <div class="article-body">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 2rem; border-radius: 0.6rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="color: var(--accent-gold); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 10px;">
                <span style="display:inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%;"></span>
                Sovereign Intelligence Summary
              </h3>
              <p style="font-size: 1.2rem; line-height: 1.65; color: #fff; margin: 0;">${summary}</p>
            </div>
            
            <div style="border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(56, 189, 248, 0.02); padding: 1.5rem; border-radius: 0.6rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="color: var(--accent-blue); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                <span style="display:inline-block; width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%;"></span>
                Sovereign Investment Analysis
              </h3>
              ${analysis}
            </div>
          </div>
        </div>

        <div id="art-real-content" class="hidden">
          ${isPratt ? `
            <h1 class="article-headline" style="color: #fff; font-size: 2.2rem; line-height: 1.25; margin-bottom: 1.25rem;">Gov. Whitmer Announces Southeast Michigan Business Expansions</h1>
            <div class="article-subtitle" style="border-left-color: var(--accent-gold); color: var(--accent-gold); font-style: italic; line-height: 1.5; margin-bottom: 2rem; padding-left: 0.75rem; border-left: 3px solid var(--accent-gold);">Governor Gretchen Whitmer's office on Monday announced business expansion projects in southeast Michigan creating good-paying jobs, contributing to the growth of Michigan’s economy.</div>
            
            <div class="article-body">
              <p>Governor Gretchen Whitmer's office on Monday announced business expansion projects in southeast Michigan creating good-paying jobs, contributing to the growth of Michigan’s economy.</p>
              <p>They include Pratt Miller Engineering & Fabrication, LLC, a Michigan-based engineering and product development company, with winning roots in motorsports while also serving as global customer base, delivering ingenious solutions to the motor sports, defense, mobility, and innovation industries. Founded in 1989, the company was acquired by Oshkosh Corporation in 2021 with headquarters in New Hudson, and has been experiencing growing customer demand in its motorsports and defense division.</p>
              <p>Pratt Miller is announcing their plans to expand two of their existing facilities to continue the growth of its high technology business in New Hudson. The expansion plans will add an additional 24,000 square feet and create additional engineering and skilled manufacturing jobs over the next three years. The first facility expansion will add another professional sportscar race team and expanded support for existing Corvette GT3 race car customer support business. The second facility expansion will create a specialized and rare secure space to support innovative survivability and lethality solutions for government customers.</p>
              <div class="article-blockquote" style="border-left-color: var(--accent-gold); background: rgba(255,255,255,0.02); padding: 1.25rem; margin: 2rem 0; border-radius: 0.35rem; line-height: 1.6; color: #fff;">
                “Pratt Miller is proud to partner with the Michigan Economic Development Corporation as we continue investing in the future of our business in New Hudson, Michigan. This grant supports our ongoing growth through facility expansion and job creation, while strengthening our ability to deliver advanced innovation and technology across motorsports, mobility, and defense,” said Matt Carroll, Pratt Miller Chief Executive Officer. “For more than three decades, Pratt Miller has built its reputation on solving complex challenges with speed, ingenuity and technical excellence, and we’re excited to continue growing in our home state alongside partners who share our commitment to advancing industry and creating lasting impact.”
              </div>
              <p>The company’s expansion plans are anticipated to result in nearly $3 million in capital investment while creating 50 new jobs in the area. Wages for these new jobs will all be at or greater than the regional media wage plus benefits. Support for these two expansion projects has been provided by the MSF through an MBDP performance-based grant.</p>
              <p>“Pratt Miller’s expansion in New Hudson is a powerful indicator of Oakland County's thriving innovation ecosystem,” said Oakland County Executive David Coulter. “This project reinforces the strength of our local economy and highlights the successful partnership between visionary companies and our community. We are grateful for Pratt Miller’s continued commitment to the region.”</p>
              <p>“The expansion represents a significant commitment to Lyon Township and underscores Pratt Miller’s dedication to expanding its operations while remaining rooted in the community. As part of this investment, more than 50 new high-paying jobs are expected to be created over the next two years, further strengthening the local economy. We are honored that Pratt Miller has chosen to expand at their Lyon Township location,” said Amy Allen, Director of the Downtown Development Authority, Lyon Township. “Their continued growth reflects the strength of our community as a place where innovative businesses can thrive, and we look forward to welcoming new team members as the company continues to expand. Lyon Township values its long-standing partnership with Pratt Miller and looks forward to supporting their continued success for years to come.”</p>
              <p>In addition to MSF support, Lyon Township is offering retention support services, making important connections with the state and local organizations such as Michigan Works! and Advantage Oakland for employment recruitment opportunities and related support services.</p>
            </div>
          ` : `
            <h1 class="article-headline" style="color: #fff; font-size: 2.2rem; line-height: 1.25; margin-bottom: 1.25rem;">${story.title}</h1>
            <div id="rss-press-release-body"></div>
          `}
        </div>
        ` : `
        <h1 class="article-headline">${story.title}</h1>
        <div class="article-subtitle">${subtitle}</div>
        
        <div class="article-body">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 2rem; border-radius: 0.6rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="color: var(--accent-gold); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 10px;">
              <span style="display:inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%;"></span>
              Sovereign Intelligence Summary
            </h3>
            <p style="font-size: 1.2rem; line-height: 1.65; color: #fff; margin: 0;">${summary}</p>
          </div>
          
          <div style="border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(56, 189, 248, 0.02); padding: 1.5rem; border-radius: 0.6rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="color: var(--accent-blue); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
              <span style="display:inline-block; width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%;"></span>
              Sovereign Investment Analysis
            </h3>
            ${analysis}
          </div>
        </div>
        `}
      </div>

      
      <!-- Right Column: Sidebar Spec and Actions -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Catalyst Stats Card -->
        <div class="article-sidebar-card">
          <h4>● Catalyst Analysis</h4>
          <div class="article-spec-row">
            <span class="article-spec-label">Sovereign Target</span>
            <span class="article-spec-value">${state.name} (${story.stateId})</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Sovereign EOI</span>
            <span class="article-spec-value" style="color: var(--accent-gold); font-weight: bold;">${eoi}</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Market Bias</span>
            <span class="article-spec-value" style="color: ${sentimentColor}; font-weight: 700; text-transform: uppercase;">${story.sentiment}</span>
          </div>
          <div class="article-spec-row" style="flex-direction: column; align-items: flex-start; gap: 0.35rem; margin-top: 0.25rem;">
            <div style="display: flex; justify-content: space-between; width: 100%; font-size: 0.8rem;">
              <span class="article-spec-label">Catalyst Impact Score</span>
              <span style="font-family: monospace; font-weight: bold; color: ${sentimentColor};">${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; display: flex;">
              <div style="height: 100%; background: ${sentimentColor}; width: ${Math.min(100, Math.abs(story.impactScore))}%"></div>
            </div>
          </div>
        </div>
        
        <!-- Contract Specs Card -->
        <div class="article-sidebar-card">
          <h4>● Contract Reference</h4>
          <div class="article-spec-row">
            <span class="article-spec-label">Active Contract</span>
            <span class="article-spec-value" style="color: var(--accent-blue);">${story.stateId}-SGA</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Contract Type</span>
            <span class="article-spec-value">Sovereign Growth Futures</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Multiplier</span>
            <span class="article-spec-value">$1,000 / Contract</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Mark Price</span>
            <span class="article-spec-value" style="color: var(--accent-blue); font-weight: bold;">$${price}</span>
          </div>
        </div>
        
        <!-- Direct Quick Trade Card -->
        <div class="article-sidebar-card" style="border: 1px solid rgba(251, 191, 36, 0.15); background: rgba(251, 191, 36, 0.02);">
          <h4 style="color: var(--accent-gold); border-bottom-color: rgba(251, 191, 36, 0.15);">● Direct Executive Desk</h4>
          
          <div class="article-trade-input-group">
            <label for="article-qty-input">Qty</label>
            <input type="text" id="article-qty-input" value="1" inputmode="numeric" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; font-weight: 600; text-align: center;">
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <button id="article-buy-btn" class="trade-btn buy-btn" style="padding: 0.65rem 0; font-size: 0.8rem;">
              <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">LONG</span>
              BUY CONTRACTS
            </button>
            <button id="article-sell-btn" class="trade-btn sell-btn" style="padding: 0.65rem 0; font-size: 0.8rem;">
              <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>
              SELL CONTRACTS
            </button>
          </div>
          
          <a href="#table" id="article-open-terminal-lnk" style="text-align: center; font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; font-weight: 700; margin-top: 0.25rem; display: block; transition: color 0.2s; cursor: pointer;">
            Open Main Trading Terminal ↗
          </a>
        </div>
        
      </div>
    </div>
  `;

  // Bind tab click listeners if it is the Pratt Miller story
  // Bind tab click listeners if the article has a press release
  if (hasPressRelease) {
    const tabOurBtn = document.getElementById('tab-our-btn');
    const tabRealBtn = document.getElementById('tab-real-btn');
    const sgaContent = document.getElementById('art-sga-content');
    const realContent = document.getElementById('art-real-content');

    if (tabOurBtn && tabRealBtn && sgaContent && realContent) {
      tabOurBtn.onclick = () => {
        tabOurBtn.classList.add('active');
        tabRealBtn.classList.remove('active');
        sgaContent.classList.remove('hidden');
        realContent.classList.add('hidden');
      };

      tabRealBtn.onclick = () => {
        tabRealBtn.classList.add('active');
        tabOurBtn.classList.remove('active');
        realContent.classList.remove('hidden');
        sgaContent.classList.add('hidden');

        // Trigger live fetching if it's an RSS article and not loaded yet
        if (!story.isPrattMiller && story.link && !story.fullPressRelease) {
          const bodyEl = document.getElementById('rss-press-release-body');
          if (bodyEl) {
            bodyEl.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem; color: var(--text-secondary);">
                <div class="press-release-spinner"></div>
                <span style="font-size: 0.9rem; font-weight: 500; letter-spacing: 0.05em; color: var(--accent-gold);">RETRIEVING LIVE OFFICIAL PRESS RELEASE...</span>
                <span style="font-size: 0.75rem; opacity: 0.7; max-width: 320px; text-align: center;">Decrypting official state commerce records and corporate announcements via Area Development network feed...</span>
              </div>
            `;

            fetchFullPressRelease(story.link).then(content => {
              if (content) {
                story.fullPressRelease = content;
                // Double check we are still viewing the same story's tab
                const activeBodyEl = document.getElementById('rss-press-release-body');
                if (activeBodyEl) {
                  activeBodyEl.innerHTML = `
                    <div class="article-body" style="line-height: 1.6; color: #fff;">
                      ${content}
                    </div>
                  `;
                }
              } else {
                const activeBodyEl = document.getElementById('rss-press-release-body');
                if (activeBodyEl) {
                  activeBodyEl.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem; color: var(--text-secondary); text-align: center;">
                      <span style="font-size: 2rem; color: var(--accent-gold);">⚠️</span>
                      <span style="font-size: 0.9rem; font-weight: bold; color: #fff;">OFFICIAL DECREE ENCRYPTION UNRESOLVABLE</span>
                      <p style="font-size: 0.8rem; max-width: 400px; line-height: 1.5; margin: 0;">We were unable to extract the full press release text automatically from the secure portal. You may view the original publication directly via the official network source.</p>
                      <a href="${story.link}" target="_blank" class="trade-btn buy-btn" style="margin-top: 1rem; padding: 0.5rem 1.25rem; font-size: 0.75rem; text-decoration: none; border-radius: 0.25rem; font-weight: 600;">
                        VIEW SOURCE ANNOUNCEMENT ↗
                      </a>
                    </div>
                  `;
                }
              }
            });
          }
        }
      };

      // If we already have the press release cached (or if it's Pratt Miller), populate it immediately
      if (!story.isPrattMiller && story.link && story.fullPressRelease) {
        const bodyEl = document.getElementById('rss-press-release-body');
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div class="article-body" style="line-height: 1.6; color: #fff;">
              ${story.fullPressRelease}
            </div>
          `;
        }
      }
    }
  }

  // Bind click handlers for direct quick trade execution
  const buyBtn = document.getElementById('article-buy-btn');

  const sellBtn = document.getElementById('article-sell-btn');
  const openTerminalLnk = document.getElementById('article-open-terminal-lnk');

  const artQtyInput = document.getElementById('article-qty-input');
  if (artQtyInput) {
    artQtyInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = Math.min(999999999, parseInt(cleanVal, 10)).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);
    });
  }

  const executeQuickTrade = (side) => {
    const qtyInput = document.getElementById('article-qty-input');
    const qty = qtyInput ? parseInt(qtyInput.value.replace(/,/g, ''), 10) || 1 : 1;

    // Set the main trading terminal's active state
    const mapPath = document.getElementById(story.stateId);
    if (state && mapPath) {
      selectState(state, mapPath);
    }

    // Sync quantity inputs
    const mainQtyInput = document.getElementById('order-qty');
    if (mainQtyInput) {
      mainQtyInput.value = qty;
      updateOrderSummary();
    }

    // Execute trade using the core transaction engine
    window.executeTrade(side);

    // Navigate back to the trading terminal dashboard and smooth scroll to chart
    window.location.hash = '#table';
    setTimeout(() => {
      const terminalEl = document.getElementById('table');
      if (terminalEl) {
        terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  if (buyBtn) buyBtn.onclick = () => executeQuickTrade('buy');
  if (sellBtn) sellBtn.onclick = () => executeQuickTrade('sell');

  if (openTerminalLnk) {
    openTerminalLnk.onclick = (e) => {
      e.preventDefault();
      const mapPath = document.getElementById(story.stateId);
      if (state && mapPath) {
        selectState(state, mapPath);
      }
      window.location.hash = '#table';
      setTimeout(() => {
        const terminalEl = document.getElementById('table');
        if (terminalEl) {
          terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    };
  }
}

function initCalculatorUI() {
  const container = document.getElementById('calc-variables-container');
  const presetSelect = document.getElementById('calc-state-preset');
  const resetBtn = document.getElementById('calc-reset-btn');

  if (!container) return;

  const variables = [
    { id: 'gdp', label: 'Gross Domestic Product (GDP)', min: 10, max: 4000, step: 10, defVal: 600, defWeight: 0.25, unit: 'B', format: (v) => `$${v.toLocaleString()}B`, normalize: (v) => v / 100 },
    { id: 'growth', label: 'GDP Growth Rate', min: -10, max: 20, step: 0.1, defVal: 2.0, defWeight: 0.10, unit: '%', format: (v) => `${v.toFixed(1)}%`, normalize: (v) => v },
    { id: 'tax', label: 'Tax Revenue', min: 1, max: 400, step: 1, defVal: 40, defWeight: 0.10, unit: 'B', format: (v) => `$${v}B`, normalize: (v) => v / 10 },
    { id: 'employment', label: 'Employment Rate', min: 80, max: 100, step: 0.1, defVal: 95.0, defWeight: 0.15, unit: '%', format: (v) => `${v.toFixed(1)}%`, normalize: (v) => v - 90 },
    { id: 'business', label: 'Business Formation Rate', min: 5, max: 1200, step: 5, defVal: 150, defWeight: 0.10, unit: 'k', format: (v) => `${v.toLocaleString()}k`, normalize: (v) => v / 50 },
    { id: 'investment', label: 'Investment Inflow', min: 1, max: 600, step: 1, defVal: 50, defWeight: 0.15, unit: 'B', format: (v) => `$${v}B`, normalize: (v) => v / 10 },
    { id: 'productivity', label: 'Productivity Rate', min: 10, max: 150, step: 1, defVal: 65, defWeight: 0.15, unit: '', format: (v) => `Score ${v}`, normalize: (v) => v / 10 }
  ];

  // Populate presets
  presetSelect.innerHTML = '<option value="">-- Load State Profile --</option>';
  statesData.sort((x, y) => x.name.localeCompare(y.name)).forEach(state => {
    presetSelect.innerHTML += `<option value="${state.id}">${state.name}</option>`;
  });

  // Render controls
  container.innerHTML = '';
  variables.forEach((v, index) => {
    const char = ['a', 'b', 'c', 'd', 'e', 'f', 'g'][index];
    const row = document.createElement('div');
    row.style.background = 'rgba(255,255,255,0.01)';
    row.style.border = '1px solid rgba(255,255,255,0.03)';
    row.style.borderRadius = '0.5rem';
    row.style.padding = '1rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.75rem';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">${v.label} <span style="font-family: monospace; font-size: 0.75rem; color: var(--accent-blue);">(${char})</span></span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Weight:</label>
          <input type="number" id="calc-weight-${v.id}" class="order-input" style="width: 70px; padding: 0.25rem 0.5rem; text-align: center; font-size: 0.75rem; border-radius: 0.25rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;" step="0.01" min="0" max="1" value="${v.defWeight}">
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 105px; gap: 1rem; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
          <input type="range" id="calc-slider-${v.id}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.defVal}" style="flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; cursor: pointer; -webkit-appearance: none;">
        </div>
        <div style="display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
          <input type="number" id="calc-val-input-${v.id}" class="order-input" style="width: 75px; padding: 0.35rem 0.5rem; text-align: center; font-family: monospace; font-size: 0.8rem; color: var(--accent-gold); font-weight: 700; border-radius: 0.35rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); outline: none;" step="${v.step}" value="${v.defVal}">
          <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; min-width: 15px; text-align: left;">${v.unit}</span>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // Append Inflation Deflator card
  const inflationRow = document.createElement('div');
  inflationRow.style.background = 'rgba(239, 68, 68, 0.02)';
  inflationRow.style.border = '1px solid rgba(239, 68, 68, 0.1)';
  inflationRow.style.borderRadius = '0.5rem';
  inflationRow.style.padding = '1rem';
  inflationRow.style.display = 'flex';
  inflationRow.style.flexDirection = 'column';
  inflationRow.style.gap = '0.75rem';
  inflationRow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">
        Inflation Rate (CPI) <span style="font-family: monospace; font-size: 0.75rem; color: #ef4444;">(Deflator)</span>
      </span>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span id="calc-inflation-impact" style="font-size: 0.75rem; color: #ef4444; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(239, 68, 68, 0.2);">Penalty: 0.0%</span>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 105px; gap: 1rem; align-items: center;">
      <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
        <input type="range" id="calc-slider-inflation" min="0" max="15" step="0.1" value="2.0" style="flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; cursor: pointer; -webkit-appearance: none;">
      </div>
      <div style="display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
        <input type="number" id="calc-val-input-inflation" class="order-input" style="width: 75px; padding: 0.35rem 0.5rem; text-align: center; font-family: monospace; font-size: 0.8rem; color: #ef4444; font-weight: 700; border-radius: 0.35rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); outline: none;" step="0.1" value="2.0">
        <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; min-width: 15px; text-align: left;">%</span>
      </div>
    </div>
  `;
  container.appendChild(inflationRow);

  // Calculate EOI function
  const calculateSimulatedEOI = () => {
    let eoi = 0;
    let sumOfWeights = 0;
    const contributions = [];

    variables.forEach((v, index) => {
      const valInput = document.getElementById(`calc-val-input-${v.id}`);
      const weightInput = document.getElementById(`calc-weight-${v.id}`);

      const rawVal = parseFloat(valInput.value) || 0;
      const weight = parseFloat(weightInput.value) || 0;

      const normVal = v.normalize(rawVal);
      const contrib = normVal * weight;

      eoi += contrib;
      sumOfWeights += weight;
      contributions.push({ id: v.id, label: v.label, contrib, weight });
    });

    eoi = parseFloat(Math.max(0, eoi).toFixed(2));

    // Inflation Deflator
    const inflationInput = document.getElementById('calc-val-input-inflation');
    const inflationVal = inflationInput ? (parseFloat(inflationInput.value) || 0) : 2.0;
    const TARGET_INFLATION = 2.0;
    const SENSITIVITY = 0.05;
    const penaltyAmount = Math.max(0, inflationVal - TARGET_INFLATION);
    const inflationFactor = Math.max(0, 1 - (SENSITIVITY * penaltyAmount));
    const penaltyPct = ((1 - inflationFactor) * 100).toFixed(1);

    const inflationImpactEl = document.getElementById('calc-inflation-impact');
    if (inflationImpactEl) {
      if (parseFloat(penaltyPct) > 0) {
        inflationImpactEl.innerText = `Penalty: -${penaltyPct}% EOI`;
        inflationImpactEl.style.color = '#ef4444';
        inflationImpactEl.style.background = 'rgba(239, 68, 68, 0.1)';
        inflationImpactEl.style.borderColor = 'rgba(239, 68, 68, 0.2)';
      } else {
        inflationImpactEl.innerText = `Penalty: 0.0%`;
        inflationImpactEl.style.color = '#10b981';
        inflationImpactEl.style.background = 'rgba(16, 185, 129, 0.1)';
        inflationImpactEl.style.borderColor = 'rgba(16, 185, 129, 0.2)';
      }
    }

    eoi = eoi * inflationFactor;
    eoi = parseFloat(Math.max(0, eoi).toFixed(2));

    // Update Result Score
    const scoreEl = document.getElementById('calc-result-score');
    const ratingEl = document.getElementById('calc-result-rating');
    scoreEl.innerText = eoi.toFixed(2);

    // Update rating thresholds
    let rating = 'Weak';
    let ratingColor = '#ef4444';
    let ratingBg = 'rgba(239, 68, 68, 0.1)';
    let ratingBorder = 'rgba(239, 68, 68, 0.2)';

    if (eoi >= 20.0) {
      rating = 'Exceptional';
      ratingColor = '#06b6d4';
      ratingBg = 'rgba(6, 182, 212, 0.1)';
      ratingBorder = 'rgba(6, 182, 212, 0.2)';
    } else if (eoi >= 12.0) {
      rating = 'Strong';
      ratingColor = '#10b981';
      ratingBg = 'rgba(16, 185, 129, 0.1)';
      ratingBorder = 'rgba(16, 185, 129, 0.2)';
    } else if (eoi >= 5.0) {
      rating = 'Moderate';
      ratingColor = '#f59e0b';
      ratingBg = 'rgba(245, 158, 11, 0.1)';
      ratingBorder = 'rgba(245, 158, 11, 0.2)';
    }

    ratingEl.innerText = rating;
    ratingEl.style.color = ratingColor;
    ratingEl.style.background = ratingBg;
    ratingEl.style.borderColor = ratingBorder;

    // Update Valuation Indicators
    const contractPrice = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
    const sovereignYield = (contractPrice * 0.2).toFixed(2);

    document.getElementById('calc-contract-price').innerText = `$${contractPrice}`;
    document.getElementById('calc-sovereign-yield').innerText = `$${sovereignYield}`;

    // Dynamic Contribution Bar
    const contribBar = document.getElementById('calc-contribution-bar');
    contribBar.innerHTML = '';
    const colors = ['#fbbf24', '#60a5fa', '#3b82f6', '#1d4ed8', '#f8fafc', '#cbd5e1', '#94a3b8'];

    // Calculate total absolute contribution for relative scaling
    const absContribTotal = contributions.reduce((s, c) => s + Math.max(0, c.contrib), 0);

    if (absContribTotal > 0) {
      contributions.forEach((c, index) => {
        const pct = (Math.max(0, c.contrib) / absContribTotal) * 100;
        if (pct > 0) {
          const subBar = document.createElement('div');
          subBar.style.width = `${pct}%`;
          subBar.style.height = '100%';
          subBar.style.background = colors[index % colors.length];
          subBar.title = `${c.label}: ${(pct).toFixed(0)}% contribution`;
          contribBar.appendChild(subBar);
        }
      });
    }
  };

  // Wire up event listeners
  variables.forEach(v => {
    const slider = document.getElementById(`calc-slider-${v.id}`);
    const valInput = document.getElementById(`calc-val-input-${v.id}`);
    const weightInput = document.getElementById(`calc-weight-${v.id}`);

    slider.addEventListener('input', () => {
      valInput.value = slider.value;
      calculateSimulatedEOI();
    });

    valInput.addEventListener('input', () => {
      const val = parseFloat(valInput.value) || 0;

      // Dynamically auto-scale slider limits if input exceeds them
      if (val > parseFloat(slider.max)) {
        slider.max = val;
      }
      if (val < parseFloat(slider.min)) {
        slider.min = val;
      }

      slider.value = val;
      calculateSimulatedEOI();
    });

    weightInput.addEventListener('input', calculateSimulatedEOI);
  });

  // Wire up inflation listeners
  const infSlider = document.getElementById('calc-slider-inflation');
  const infInput = document.getElementById('calc-val-input-inflation');
  if (infSlider && infInput) {
    infSlider.addEventListener('input', () => {
      infInput.value = infSlider.value;
      calculateSimulatedEOI();
    });

    infInput.addEventListener('input', () => {
      const val = parseFloat(infInput.value) || 0;
      if (val > parseFloat(infSlider.max)) infSlider.max = val;
      if (val < parseFloat(infSlider.min)) infSlider.min = val;
      infSlider.value = val;
      calculateSimulatedEOI();
    });
  }

  // Preset Selection Loader
  presetSelect.addEventListener('change', (e) => {
    const stateId = e.target.value;
    if (!stateId) return;

    const state = statesData.find(s => s.id === stateId);
    if (!state) return;

    // Load actual state values
    const setVal = (id, val) => {
      const slider = document.getElementById(`calc-slider-${id}`);
      const valInput = document.getElementById(`calc-val-input-${id}`);

      // Auto-scale slider range to fit loaded state value if it exceeds defaults
      if (val > parseFloat(slider.max)) slider.max = val;
      if (val < parseFloat(slider.min)) slider.min = val;

      slider.value = val;
      valInput.value = val;
    };

    setVal('gdp', state.gdp);
    setVal('growth', state.growth);
    setVal('tax', state.tax);
    setVal('employment', state.employment);
    setVal('business', state.business);
    setVal('investment', state.investment);
    setVal('productivity', state.productivity);

    const infSliderEl = document.getElementById('calc-slider-inflation');
    const infInputEl = document.getElementById('calc-val-input-inflation');
    if (infSliderEl && infInputEl) {
      const val = state.inflation || 2.0;
      if (val > parseFloat(infSliderEl.max)) infSliderEl.max = val;
      if (val < parseFloat(infSliderEl.min)) infSliderEl.min = val;
      infSliderEl.value = val;
      infInputEl.value = val;
    }

    // Load actual state weights
    document.getElementById('calc-weight-gdp').value = 0.25;
    document.getElementById('calc-weight-growth').value = 0.10;
    document.getElementById('calc-weight-tax').value = 0.10;
    document.getElementById('calc-weight-employment').value = 0.15;
    document.getElementById('calc-weight-business').value = 0.10;
    document.getElementById('calc-weight-investment').value = 0.15;
    document.getElementById('calc-weight-productivity').value = 0.15;

    calculateSimulatedEOI();
  });

  // Reset Button
  resetBtn.addEventListener('click', () => {
    presetSelect.value = '';

    variables.forEach(v => {
      const slider = document.getElementById(`calc-slider-${v.id}`);
      const valInput = document.getElementById(`calc-val-input-${v.id}`);

      // Reset slider ranges to default limits
      slider.min = v.min;
      slider.max = v.max;

      slider.value = v.defVal;
      valInput.value = v.defVal;

      document.getElementById(`calc-weight-${v.id}`).value = v.defWeight;
    });

    const infSliderEl = document.getElementById('calc-slider-inflation');
    const infInputEl = document.getElementById('calc-val-input-inflation');
    if (infSliderEl && infInputEl) {
      infSliderEl.min = 0;
      infSliderEl.max = 15;
      infSliderEl.value = 2.0;
      infInputEl.value = 2.0;
    }

    calculateSimulatedEOI();
  });

  // Run initial calculation
  calculateSimulatedEOI();
}

// ==========================================
// SPA ROUTER IMPLEMENTATION
// ==========================================

function initRouter() {
  window.addEventListener('hashchange', handleRouting);
  window.addEventListener('load', handleRouting);
  handleRouting();
}

function handleRouting() {
  const hash = window.location.hash || '#map';
  const dashboardPage = document.getElementById('dashboard-page');
  const newsPage = document.getElementById('news-page');
  const articlePage = document.getElementById('article-page');
  const calculatorPage = document.getElementById('calculator-page');
  const marketsPage = document.getElementById('markets-page');
  const networkPage = document.getElementById('network-page');
  const walletPage = document.getElementById('wallet-page');
  const scannerPage = document.getElementById('scanner-page');

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === hash || (href === '#screener' && (hash === '#screener-gx' || hash === '#screener-sga'))) {
      link.classList.add('active');
    }
  });

  // Hide all pages first
  if (dashboardPage) dashboardPage.classList.add('hidden');
  if (newsPage) newsPage.classList.add('hidden');
  if (articlePage) articlePage.classList.add('hidden');
  if (calculatorPage) calculatorPage.classList.add('hidden');
  if (marketsPage) marketsPage.classList.add('hidden');
  if (networkPage) networkPage.classList.add('hidden');
  if (walletPage) walletPage.classList.add('hidden');
  if (scannerPage) scannerPage.classList.add('hidden');

  if (hash.startsWith('#article-')) {
    if (articlePage) {
      articlePage.classList.remove('hidden');
      const storyId = hash.replace('#article-', '');
      renderArticleDetail(storyId);
    }
  } else if (hash === '#news') {
    if (newsPage) newsPage.classList.remove('hidden');
    renderNews();
  } else if (hash === '#markets' || hash === '#calculator') {
    if (marketsPage) {
      marketsPage.classList.remove('hidden');
      renderMarketsPage();
    }
  } else if (hash === '#screener' || hash === '#screener-gx' || hash === '#screener-sga') {
    if (scannerPage) {
      scannerPage.classList.remove('hidden');
      const targetMode = hash === '#screener-gx' ? 'gx' : (hash === '#screener-sga' ? 'sga' : (window.currentScannerMode || localStorage.getItem('sga_scanner_mode') || 'sga'));
      if (window.switchScannerMode) {
        window.switchScannerMode(targetMode);
      } else {
        loadScreenerContent();
      }
    }
  } else if (hash === '#network') {
    if (networkPage) {
      networkPage.classList.remove('hidden');
      renderNetworkPage();
    }
  } else if (hash === '#wallet') {
    if (walletPage) {
      walletPage.classList.remove('hidden');
      renderWalletPage();
    }
  } else {
    if (dashboardPage) dashboardPage.classList.remove('hidden');

    if (hash === '#map' || hash === '#table' || hash === '#ledger' || hash === '#screener') {
      const elementId = hash.substring(1);
      const element = document.getElementById(elementId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }
}

// Stock Screener functionality
function loadScreenerContent() {
  const container = document.getElementById('screener-container');
  if (!container) {
    console.error('Screener container not found');
    return;
  }

  // Check if already loaded (has actual content, not just the placeholder)
  if (container.innerHTML.trim() !== '' && !container.innerHTML.includes('Screener content will be loaded here')) {
    console.log('Screener already loaded');
    return;
  }

  console.log('Loading screener content...');

  // Load the screener HTML content directly
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
      <div class="screener-tabs">
        <button class="screener-tab-btn active" data-tab="shares">SHARES</button>
        <button class="screener-tab-btn" data-tab="futures">FUTURES</button>
        <button class="screener-tab-btn" data-tab="pairs">PAIRS</button>
        <button class="screener-tab-btn" data-tab="options">OPTIONS</button>
        <button class="screener-tab-btn" data-tab="yield">📅 Yield Schedule</button>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button onclick="toggleNewStockPosition()" class="screener-design-toggle" id="new-stock-position-btn" title="Toggle new stocks position">
          ⬇️ BOTTOM
        </button>
        <button onclick="toggleScreenerDesign()" class="screener-design-toggle">
          🎨 SWITCH DESIGN
        </button>
      </div>
    </div>

    <div id="screener-content-area">
      <!-- Main screener content -->
      <div class="screener-stats-bar">
        <div class="screener-stat-item">
          <span class="screener-stat-label">TOTAL</span>
          <span class="screener-stat-value" id="total-stocks">0</span>
        </div>
        <div class="screener-stat-item">
          <span class="screener-stat-label">AVG 5M-RVOL</span>
          <span class="screener-stat-value" id="avg-5min-rvol">0.00x</span>
        </div>
        <div class="screener-stat-item">
          <span class="screener-stat-label">GAINERS</span>
          <span class="screener-stat-value green" id="total-gainers">0</span>
        </div>
        <div class="screener-stat-item">
          <span class="screener-stat-label" style="color: #ef4444;">LOSERS</span>
          <span class="screener-stat-value" style="color: #ef4444;" id="total-losers">0</span>
        </div>
      </div>

      <div class="screener-controls">
        <div class="screener-search-box">
          <input type="text" id="search-input" placeholder="SEARCH TICKER...">
        </div>
        <button class="screener-filter-btn active" data-filter="all">ALL</button>
        <button class="screener-filter-btn" data-filter="gainers">GAINERS</button>
        <button class="screener-filter-btn" data-filter="losers">LOSERS</button>
        <button class="screener-filter-btn" data-filter="hot">HOT</button>
        <button class="screener-filter-btn" data-filter="trending">TRENDING</button>
        <button class="screener-filter-btn" data-filter="high-mcap">LARGE CAP</button>
        <div class="screener-float-filter">
          <input type="number" id="float-filter-input" placeholder="FLOAT" min="0" step="0.1">
          <span class="screener-float-label">B</span>
        </div>
        <div class="screener-float-filter">
          <input type="number" id="rvol-filter-input" placeholder="RVOL" min="0" step="0.1">
          <span class="screener-float-label">x</span>
        </div>
        <div class="screener-float-filter">
          <input type="number" id="gain-filter-input" placeholder="GAIN" min="0" step="0.1">
          <span class="screener-float-label">%</span>
        </div>
        <div class="screener-float-filter">
          <input type="number" id="delta-filter-input" placeholder="DELTA" min="0" step="0.1">
          <span class="screener-float-label">M</span>
        </div>
      </div>

      <div class="screener-table-container">
        <div class="screener-table-wrapper">
          <table class="screener-table">
            <thead>
              <tr>
                <th onclick="sortTable('ticker')">Ticker <span class="screener-sort-icon" id="sort-ticker">↕</span></th>
                <th onclick="sortTable('change')">Chg % <span class="screener-sort-icon" id="sort-change">↕</span></th>
                <th class="screener-news-col-header">News</th>
                <th onclick="sortTable('price')">Price <span class="screener-sort-icon" id="sort-price">↕</span></th>
                <th onclick="sortTable('marketCap')">Mkt Cap <span class="screener-sort-icon" id="sort-marketCap">↕</span></th>
                <th onclick="sortTable('float')">Float <span class="screener-sort-icon" id="sort-float">↕</span></th>
                <th onclick="sortTable('volume')">Volume <span class="screener-sort-icon" id="sort-volume">↕</span></th>
                <th onclick="sortTable('fiveMinRvol')">5m RVOL <span class="screener-sort-icon" id="sort-fiveMinRvol">↕</span></th>
                <th onclick="sortTable('fiveMinDelta')">5m Delta <span class="screener-sort-icon" id="sort-fiveMinDelta">↕</span></th>
              </tr>
            </thead>
            <tbody id="screener-body">
              <!-- Data will be populated by JavaScript -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="yield-schedule-content" style="display: none;">
      <!-- Yield schedule will be rendered here -->
    </div>
  `;

  // Initialize the screener scripts
  initializeScreener();
}

// Toggle between day trader terminal and elegant design
window.toggleScreenerDesign = function() {
  const screenerContainer = document.getElementById('screener-container');
  if (screenerContainer) {
    screenerContainer.classList.toggle('elegant-design');
  }
};

// Toggle new stocks position (top vs bottom)
window.newStocksFromBottom = false;
window.toggleNewStockPosition = function() {
  window.newStocksFromBottom = !window.newStocksFromBottom;
  const btn = document.getElementById('new-stock-position-btn');
  if (btn) {
    btn.textContent = window.newStocksFromBottom ? '⬆️ TOP' : '⬇️ BOTTOM';
  }
};

function initializeScreener() {
  // Mock SGA stock data with realistic market metrics
  const sgaStocks = [
    {
      ticker: 'SGA-Virginia',
      sgaTicker: 'SGA-Virginia',
      symbol: 'VIR',
      division: 'Virginia',
      country: 'United States',
      name: 'Virginia, United States',
      price: 15.80,
      change: 3456.78,
      monthlyRvol: 3.45,
      fiveMinRvol: 4.56,
      fiveMinDelta: 5678000,
      marketCap: 1580000000000,
      float: 80000000000,
      volume: 1234000000,
      volumePercentage: 0.0012340
    },
    {
      ticker: 'SGA-California',
      sgaTicker: 'SGA-California',
      symbol: 'CAL',
      division: 'California',
      country: 'United States',
      name: 'California, United States',
      price: 89.45,
      change: 20456.78,
      monthlyRvol: 5.67,
      fiveMinRvol: 8.92,
      fiveMinDelta: 8900000,
      marketCap: 89450000000000,
      float: 45000000000,
      volume: 89000000000,
      volumePercentage: 0.0890000
    },
    {
      ticker: 'SGA-New York',
      sgaTicker: 'SGA-New York',
      symbol: 'NYK',
      division: 'New York',
      country: 'United States',
      name: 'New York, United States',
      price: 287.20,
      change: 892.45,
      monthlyRvol: 2.15,
      fiveMinRvol: 3.45,
      fiveMinDelta: 2340000,
      marketCap: 28720000000000,
      float: 85000000000,
      volume: 34567800000,
      volumePercentage: 0.0345678
    },
    {
      ticker: 'SGA-Texas',
      sgaTicker: 'SGA-Texas',
      symbol: 'TEX',
      division: 'Texas',
      country: 'United States',
      name: 'Texas, United States',
      price: 198.50,
      change: 645.67,
      monthlyRvol: 1.92,
      fiveMinRvol: 2.78,
      fiveMinDelta: 1567000,
      marketCap: 19850000000000,
      float: 75000000000,
      volume: 23456700000,
      volumePercentage: 0.0234567
    },
    {
      ticker: 'SGA-Florida',
      sgaTicker: 'SGA-Florida',
      symbol: 'FLO',
      division: 'Florida',
      country: 'United States',
      name: 'Florida, United States',
      price: 156.30,
      change: 823.12,
      monthlyRvol: 2.34,
      fiveMinRvol: 3.12,
      fiveMinDelta: 1890000,
      marketCap: 15630000000000,
      float: 65000000000,
      volume: 18901200000,
      volumePercentage: 0.0189012
    },
    {
      ticker: 'SGA-United States',
      sgaTicker: 'SGA-United States',
      symbol: 'USA',
      division: 'National Jurisdiction',
      country: 'United States',
      name: 'United States (National)',
      price: 432.50,
      change: 756.34,
      monthlyRvol: 1.85,
      fiveMinRvol: 2.45,
      fiveMinDelta: 1250000,
      marketCap: 43250000000000,
      float: 100000000000,
      volume: 45678900000,
      volumePercentage: 0.0456789
    },
    {
      ticker: 'SGA-Illinois',
      sgaTicker: 'SGA-Illinois',
      symbol: 'ILL',
      division: 'Illinois',
      country: 'United States',
      name: 'Illinois, United States',
      price: 145.60,
      change: 687.23,
      monthlyRvol: 1.89,
      fiveMinRvol: 2.56,
      fiveMinDelta: 1234000,
      marketCap: 14560000000000,
      float: 60000000000,
      volume: 12345600000,
      volumePercentage: 0.0123456
    },
    {
      ticker: 'SGA-Pennsylvania',
      sgaTicker: 'SGA-Pennsylvania',
      symbol: 'PEN',
      division: 'Pennsylvania',
      country: 'United States',
      name: 'Pennsylvania, United States',
      price: 134.50,
      change: 534.89,
      monthlyRvol: 1.67,
      fiveMinRvol: 2.34,
      fiveMinDelta: 987000,
      marketCap: 13450000000000,
      float: 55000000000,
      volume: 10987600000,
      volumePercentage: 0.0109876
    },
    {
      ticker: 'SGA-Ohio',
      sgaTicker: 'SGA-Ohio',
      symbol: 'OHI',
      division: 'Ohio',
      country: 'United States',
      name: 'Ohio, United States',
      price: 98.70,
      change: 456.12,
      monthlyRvol: 1.45,
      fiveMinRvol: 2.12,
      fiveMinDelta: 765000,
      marketCap: 9870000000000,
      float: 50000000000,
      volume: 8765400000,
      volumePercentage: 0.0087654
    },
    {
      ticker: 'SGA-Georgia',
      sgaTicker: 'SGA-Georgia',
      symbol: 'GEO',
      division: 'Georgia',
      country: 'United States',
      name: 'Georgia, United States',
      price: 87.60,
      change: 789.34,
      monthlyRvol: 1.78,
      fiveMinRvol: 2.45,
      fiveMinDelta: 1345000,
      marketCap: 8760000000000,
      float: 45000000000,
      volume: 7654300000,
      volumePercentage: 0.0076543
    },
    {
      ticker: 'SGA-North Carolina',
      sgaTicker: 'SGA-North Carolina',
      symbol: 'NCA',
      division: 'North Carolina',
      country: 'United States',
      name: 'North Carolina, United States',
      price: 76.50,
      change: 623.45,
      monthlyRvol: 1.92,
      fiveMinRvol: 2.67,
      fiveMinDelta: 1123000,
      marketCap: 7650000000000,
      float: 40000000000,
      volume: 6543200000,
      volumePercentage: 0.0065432
    },
    {
      ticker: 'SGA-Michigan',
      sgaTicker: 'SGA-Michigan',
      symbol: 'MIC',
      division: 'Michigan',
      country: 'United States',
      name: 'Michigan, United States',
      price: 65.40,
      change: 567.89,
      monthlyRvol: 1.56,
      fiveMinRvol: 2.23,
      fiveMinDelta: 987000,
      marketCap: 6540000000000,
      float: 35000000000,
      volume: 5432100000,
      volumePercentage: 0.0054321
    },
    {
      ticker: 'SGA-Washington',
      sgaTicker: 'SGA-Washington',
      symbol: 'WAS',
      division: 'Washington',
      country: 'United States',
      name: 'Washington, United States',
      price: 54.30,
      change: 478.23,
      monthlyRvol: 1.34,
      fiveMinRvol: 2.01,
      fiveMinDelta: 876000,
      marketCap: 5430000000000,
      float: 30000000000,
      volume: 4321000000,
      volumePercentage: 0.0043210
    },
    {
      ticker: 'SGA-Arizona',
      sgaTicker: 'SGA-Arizona',
      symbol: 'ARZ',
      division: 'Arizona',
      country: 'United States',
      name: 'Arizona, United States',
      price: 43.20,
      change: 389.56,
      monthlyRvol: 1.67,
      fiveMinRvol: 2.15,
      fiveMinDelta: 765000,
      marketCap: 4320000000000,
      float: 25000000000,
      volume: 3210900000,
      volumePercentage: 0.0032109
    },
    {
      ticker: 'SGA-Massachusetts',
      sgaTicker: 'SGA-Massachusetts',
      symbol: 'MAS',
      division: 'Massachusetts',
      country: 'United States',
      name: 'Massachusetts, United States',
      price: 32.10,
      change: 356.78,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.98,
      fiveMinDelta: 654000,
      marketCap: 3210000000000,
      float: 20000000000,
      volume: 2109800000,
      volumePercentage: 0.0021098
    },
    {
      ticker: 'SGA-Indiana',
      sgaTicker: 'SGA-Indiana',
      symbol: 'IND',
      division: 'Indiana',
      country: 'United States',
      name: 'Indiana, United States',
      price: 29.80,
      change: 234.12,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.89,
      fiveMinDelta: 543000,
      marketCap: 2980000000000,
      float: 18000000000,
      volume: 1987600000,
      volumePercentage: 0.0019876
    },
    {
      ticker: 'SGA-Missouri',
      sgaTicker: 'SGA-Missouri',
      symbol: 'MOS',
      division: 'Missouri',
      country: 'United States',
      name: 'Missouri, United States',
      price: 28.70,
      change: 189.45,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.67,
      fiveMinDelta: 432000,
      marketCap: 2870000000000,
      float: 17000000000,
      volume: 1876500000,
      volumePercentage: 0.0018765
    },
    {
      ticker: 'SGA-Tennessee',
      sgaTicker: 'SGA-Tennessee',
      symbol: 'TEN',
      division: 'Tennessee',
      country: 'United States',
      name: 'Tennessee, United States',
      price: 27.60,
      change: 167.89,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.78,
      fiveMinDelta: 321000,
      marketCap: 2760000000000,
      float: 16000000000,
      volume: 1765400000,
      volumePercentage: 0.0017654
    },
    {
      ticker: 'SGA-Colorado',
      sgaTicker: 'SGA-Colorado',
      symbol: 'COL',
      division: 'Colorado',
      country: 'United States',
      name: 'Colorado, United States',
      price: 26.50,
      change: 145.23,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.92,
      fiveMinDelta: 287000,
      marketCap: 2650000000000,
      float: 15000000000,
      volume: 1654300000,
      volumePercentage: 0.0016543
    },
    {
      ticker: 'SGA-Minnesota',
      sgaTicker: 'SGA-Minnesota',
      symbol: 'MIN',
      division: 'Minnesota',
      country: 'United States',
      name: 'Minnesota, United States',
      price: 25.40,
      change: 123.67,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.56,
      fiveMinDelta: 234000,
      marketCap: 2540000000000,
      float: 14000000000,
      volume: 1543200000,
      volumePercentage: 0.0015432
    },
    {
      ticker: 'SGA-Wisconsin',
      sgaTicker: 'SGA-Wisconsin',
      symbol: 'WIS',
      division: 'Wisconsin',
      country: 'United States',
      name: 'Wisconsin, United States',
      price: 24.30,
      change: 98.45,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.67,
      fiveMinDelta: 187000,
      marketCap: 2430000000000,
      float: 13000000000,
      volume: 1432100000,
      volumePercentage: 0.0014321
    },
    {
      ticker: 'SGA-Oregon',
      sgaTicker: 'SGA-Oregon',
      symbol: 'ORE',
      division: 'Oregon',
      country: 'United States',
      name: 'Oregon, United States',
      price: 18.90,
      change: 87.34,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.78,
      fiveMinDelta: 165000,
      marketCap: 1890000000000,
      float: 12000000000,
      volume: 1321000000,
      volumePercentage: 0.0013210
    },
    {
      ticker: 'SGA-South Carolina',
      sgaTicker: 'SGA-South Carolina',
      symbol: 'SCA',
      division: 'South Carolina',
      country: 'United States',
      name: 'South Carolina, United States',
      price: 12.30,
      change: 67.89,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.56,
      fiveMinDelta: 143000,
      marketCap: 1230000000000,
      float: 10000000000,
      volume: 987000000,
      volumePercentage: 0.0009870
    },
    {
      ticker: 'SGA-Nevada',
      sgaTicker: 'SGA-Nevada',
      symbol: 'NEV',
      division: 'Nevada',
      country: 'United States',
      name: 'Nevada, United States',
      price: 13.45,
      change: 3123.45,
      monthlyRvol: 3.23,
      fiveMinRvol: 4.12,
      fiveMinDelta: 5234000,
      marketCap: 1345000000000,
      float: 75000000000,
      volume: 1098000000,
      volumePercentage: 0.0010980
    },
    {
      ticker: 'SGA-Kentucky',
      sgaTicker: 'SGA-Kentucky',
      symbol: 'KEN',
      division: 'Kentucky',
      country: 'United States',
      name: 'Kentucky, United States',
      price: 22.30,
      change: 234.56,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.89,
      fiveMinDelta: 432000,
      marketCap: 2230000000000,
      float: 90000000000,
      volume: 876000000,
      volumePercentage: 0.0008760
    },
    {
      ticker: 'SGA-Alabama',
      sgaTicker: 'SGA-Alabama',
      symbol: 'ALA',
      division: 'Alabama',
      country: 'United States',
      name: 'Alabama, United States',
      price: 19.45,
      change: 189.34,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.78,
      fiveMinDelta: 345000,
      marketCap: 1945000000000,
      float: 85000000000,
      volume: 765000000,
      volumePercentage: 0.0007650
    },
    {
      ticker: 'SGA-Mississippi',
      sgaTicker: 'SGA-Mississippi',
      symbol: 'MIS',
      division: 'Mississippi',
      country: 'United States',
      name: 'Mississippi, United States',
      price: 17.80,
      change: 156.78,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.67,
      fiveMinDelta: 287000,
      marketCap: 1780000000000,
      float: 80000000000,
      volume: 654000000,
      volumePercentage: 0.0006540
    },
    {
      ticker: 'SGA-Louisiana',
      sgaTicker: 'SGA-Louisiana',
      symbol: 'LOU',
      division: 'Louisiana',
      country: 'United States',
      name: 'Louisiana, United States',
      price: 16.30,
      change: 123.45,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.56,
      fiveMinDelta: 234000,
      marketCap: 1630000000000,
      float: 75000000000,
      volume: 543000000,
      volumePercentage: 0.0005430
    },
    {
      ticker: 'SGA-Oklahoma',
      sgaTicker: 'SGA-Oklahoma',
      symbol: 'OKL',
      division: 'Oklahoma',
      country: 'United States',
      name: 'Oklahoma, United States',
      price: 15.20,
      change: 98.67,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.89,
      fiveMinDelta: 187000,
      marketCap: 1520000000000,
      float: 70000000000,
      volume: 432000000,
      volumePercentage: 0.0004320
    },
    {
      ticker: 'SGA-Guangdong',
      sgaTicker: 'SGA-Guangdong',
      symbol: 'GDG',
      division: 'Guangdong',
      country: 'China',
      name: 'Guangdong, China',
      price: 371.00,
      change: -1.23,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.85,
      fiveMinDelta: -890000,
      marketCap: 37100000000000,
      float: 100000000000,
      volume: 34567800000,
      volumePercentage: 0.0345678
    },
    {
      ticker: 'SGA-Bavaria',
      sgaTicker: 'SGA-Bavaria',
      symbol: 'BAV',
      division: 'Bavaria',
      country: 'Germany',
      name: 'Bavaria, Germany',
      price: 284.50,
      change: 1.87,
      monthlyRvol: 1.92,
      fiveMinRvol: 2.15,
      fiveMinDelta: 567000,
      marketCap: 28450000000000,
      float: 100000000000,
      volume: 23456700000,
      volumePercentage: 0.0234567
    },
    {
      ticker: 'SGA-Tokyo',
      sgaTicker: 'SGA-Tokyo',
      symbol: 'TKO',
      division: 'Tokyo',
      country: 'Japan',
      name: 'Tokyo, Japan',
      price: 257.80,
      change: 0.92,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.67,
      fiveMinDelta: 234000,
      marketCap: 25780000000000,
      float: 100000000000,
      volume: 18901200000,
      volumePercentage: 0.0189012
    },
    {
      ticker: 'SGA-England',
      sgaTicker: 'SGA-England',
      symbol: 'ENG',
      division: 'England',
      country: 'United Kingdom',
      name: 'England, United Kingdom',
      price: 198.50,
      change: -0.45,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.34,
      fiveMinDelta: -123000,
      marketCap: 19850000000000,
      float: 100000000000,
      volume: 15678900000,
      volumePercentage: 0.0156789
    },
    {
      ticker: 'SGA-Île-de-France',
      sgaTicker: 'SGA-Île-de-France',
      symbol: 'IDF',
      division: 'Île-de-France',
      country: 'France',
      name: 'Île-de-France, France',
      price: 134.50,
      change: 1.45,
      monthlyRvol: 1.56,
      fiveMinRvol: 1.89,
      fiveMinDelta: 345000,
      marketCap: 13450000000000,
      float: 100000000000,
      volume: 10987600000,
      volumePercentage: 0.0109876
    },
    {
      ticker: 'SGA-Lombardy',
      sgaTicker: 'SGA-Lombardy',
      symbol: 'LOM',
      division: 'Lombardy',
      country: 'Italy',
      name: 'Lombardy, Italy',
      price: 98.70,
      change: -2.12,
      monthlyRvol: 1.78,
      fiveMinRvol: 2.01,
      fiveMinDelta: -456000,
      marketCap: 9870000000000,
      float: 100000000000,
      volume: 8765400000,
      volumePercentage: 0.0087654
    },
    {
      ticker: 'SGA-Seoul',
      sgaTicker: 'SGA-Seoul',
      symbol: 'SEO',
      division: 'Seoul',
      country: 'South Korea',
      name: 'Seoul, South Korea',
      price: 76.50,
      change: 2.56,
      monthlyRvol: 2.12,
      fiveMinRvol: 2.67,
      fiveMinDelta: 567000,
      marketCap: 7650000000000,
      float: 100000000000,
      volume: 6543200000,
      volumePercentage: 0.0065432
    },
    {
      ticker: 'SGA-Moscow',
      sgaTicker: 'SGA-Moscow',
      symbol: 'MOW',
      division: 'Moscow',
      country: 'Russia',
      name: 'Moscow, Russia',
      price: 65.40,
      change: -3.45,
      monthlyRvol: 2.89,
      fiveMinRvol: 3.45,
      fiveMinDelta: -789000,
      marketCap: 6540000000000,
      float: 100000000000,
      volume: 5432100000,
      volumePercentage: 0.0054321
    },
    {
      ticker: 'SGA-New South Wales',
      sgaTicker: 'SGA-New South Wales',
      symbol: 'NSW',
      division: 'New South Wales',
      country: 'Australia',
      name: 'New South Wales, Australia',
      price: 54.30,
      change: 1.23,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.78,
      fiveMinDelta: 234000,
      marketCap: 5430000000000,
      float: 100000000000,
      volume: 4321000000,
      volumePercentage: 0.0043210
    },
    {
      ticker: 'SGA-Madrid',
      sgaTicker: 'SGA-Madrid',
      symbol: 'MAD',
      division: 'Madrid',
      country: 'Spain',
      name: 'Madrid, Spain',
      price: 43.20,
      change: -0.89,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.56,
      fiveMinDelta: -123000,
      marketCap: 4320000000000,
      float: 100000000000,
      volume: 3210900000,
      volumePercentage: 0.0032109
    },
    {
      ticker: 'SGA-Nuevo León',
      sgaTicker: 'SGA-Nuevo León',
      symbol: 'NLN',
      division: 'Nuevo León',
      country: 'Mexico',
      name: 'Nuevo León, Mexico',
      price: 32.10,
      change: 1.67,
      monthlyRvol: 1.67,
      fiveMinRvol: 2.12,
      fiveMinDelta: 345000,
      marketCap: 3210000000000,
      float: 100000000000,
      volume: 2109800000,
      volumePercentage: 0.0021098
    },
    {
      ticker: 'SGA-Jakarta',
      sgaTicker: 'SGA-Jakarta',
      symbol: 'JKT',
      division: 'Jakarta',
      country: 'Indonesia',
      name: 'Jakarta, Indonesia',
      price: 29.80,
      change: 2.34,
      monthlyRvol: 1.89,
      fiveMinRvol: 2.34,
      fiveMinDelta: 456000,
      marketCap: 2980000000000,
      float: 100000000000,
      volume: 1987600000,
      volumePercentage: 0.0019876
    },
    {
      ticker: 'SGA-North Holland',
      sgaTicker: 'SGA-North Holland',
      symbol: 'NHD',
      division: 'North Holland',
      country: 'Netherlands',
      name: 'North Holland, Netherlands',
      price: 28.70,
      change: 0.56,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.34,
      fiveMinDelta: 89000,
      marketCap: 2870000000000,
      float: 100000000000,
      volume: 1876500000,
      volumePercentage: 0.0018765
    },
    {
      ticker: 'SGA-Riyadh',
      sgaTicker: 'SGA-Riyadh',
      symbol: 'RUH',
      division: 'Riyadh',
      country: 'Saudi Arabia',
      name: 'Riyadh, Saudi Arabia',
      price: 27.60,
      change: 1.89,
      monthlyRvol: 2.23,
      fiveMinRvol: 2.89,
      fiveMinDelta: 567000,
      marketCap: 2760000000000,
      float: 100000000000,
      volume: 1765400000,
      volumePercentage: 0.0017654
    },
    {
      ticker: 'SGA-Istanbul',
      sgaTicker: 'SGA-Istanbul',
      symbol: 'IST',
      division: 'Istanbul',
      country: 'Turkey',
      name: 'Istanbul, Turkey',
      price: 26.50,
      change: -1.23,
      monthlyRvol: 1.78,
      fiveMinRvol: 2.12,
      fiveMinDelta: -234000,
      marketCap: 2650000000000,
      float: 100000000000,
      volume: 1654300000,
      volumePercentage: 0.0016543
    },
    {
      ticker: 'SGA-Zurich',
      sgaTicker: 'SGA-Zurich',
      symbol: 'ZRH',
      division: 'Zurich',
      country: 'Switzerland',
      name: 'Zurich, Switzerland',
      price: 25.40,
      change: 0.78,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.56,
      fiveMinDelta: 123000,
      marketCap: 2540000000000,
      float: 100000000000,
      volume: 1543200000,
      volumePercentage: 0.0015432
    },
    {
      ticker: 'SGA-Stockholm',
      sgaTicker: 'SGA-Stockholm',
      symbol: 'STO',
      division: 'Stockholm',
      country: 'Sweden',
      name: 'Stockholm, Sweden',
      price: 24.30,
      change: 1.45,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.78,
      fiveMinDelta: 234000,
      marketCap: 2430000000000,
      float: 100000000000,
      volume: 1432100000,
      volumePercentage: 0.0014321
    },
    {
      ticker: 'SGA-São Paulo',
      sgaTicker: 'SGA-São Paulo',
      symbol: 'SPO',
      division: 'São Paulo',
      country: 'Brazil',
      name: 'São Paulo, Brazil',
      price: 18.90,
      change: 4.12,
      monthlyRvol: 2.67,
      fiveMinRvol: 3.45,
      fiveMinDelta: 1234000,
      marketCap: 1890000000000,
      float: 100000000000,
      volume: 1321000000,
      volumePercentage: 0.0013210
    },
    {
      ticker: 'SGA-Gauteng',
      sgaTicker: 'SGA-Gauteng',
      symbol: 'GAU',
      division: 'Gauteng',
      country: 'South Africa',
      name: 'Gauteng, South Africa',
      price: 12.30,
      change: -2.89,
      monthlyRvol: 1.98,
      fiveMinRvol: 2.34,
      fiveMinDelta: -567000,
      marketCap: 1230000000000,
      float: 100000000000,
      volume: 987000000,
      volumePercentage: 0.0009870
    }
  ];

  // Mock SGA Futures data
  const sgaFutures = [
    {
      ticker: 'SGA-US-F',
      name: 'United States SGA Futures',
      price: 432500.00,
      change: 2.34,
      monthlyRvol: 1.85,
      fiveMinRvol: 2.45,
      fiveMinDelta: 1250000,
      marketCap: 43250000000000,
      float: 1000000000,
      volume: 45678900000,
      volumePercentage: 0.0456789,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-CN-F',
      name: 'China SGA Futures',
      price: 371000.00,
      change: -1.23,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.85,
      fiveMinDelta: -890000,
      marketCap: 37100000000000,
      float: 1000000000,
      volume: 34567800000,
      volumePercentage: 0.0345678,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-DE-F',
      name: 'Germany SGA Futures',
      price: 284500.00,
      change: 1.87,
      monthlyRvol: 1.92,
      fiveMinRvol: 2.15,
      fiveMinDelta: 567000,
      marketCap: 28450000000000,
      float: 1000000000,
      volume: 23456700000,
      volumePercentage: 0.0234567,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-JP-F',
      name: 'Japan SGA Futures',
      price: 257800.00,
      change: 0.92,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.67,
      fiveMinDelta: 234000,
      marketCap: 25780000000000,
      float: 1000000000,
      volume: 18901200000,
      volumePercentage: 0.0189012,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-GB-F',
      name: 'UK SGA Futures',
      price: 198500.00,
      change: -0.45,
      monthlyRvol: 1.12,
      fiveMinRvol: 1.34,
      fiveMinDelta: -123000,
      marketCap: 19850000000000,
      float: 1000000000,
      volume: 15678900000,
      volumePercentage: 0.0156789,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-IN-F',
      name: 'India SGA Futures',
      price: 145600.00,
      change: 3.21,
      monthlyRvol: 2.34,
      fiveMinRvol: 3.12,
      fiveMinDelta: 890000,
      marketCap: 14560000000000,
      float: 1000000000,
      volume: 12345600000,
      volumePercentage: 0.0123456,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-FR-F',
      name: 'France SGA Futures',
      price: 134500.00,
      change: 1.45,
      monthlyRvol: 1.56,
      fiveMinRvol: 1.89,
      fiveMinDelta: 345000,
      marketCap: 13450000000000,
      float: 1000000000,
      volume: 10987600000,
      volumePercentage: 0.0109876,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-IT-F',
      name: 'Italy SGA Futures',
      price: 98700.00,
      change: -2.12,
      monthlyRvol: 1.78,
      fiveMinRvol: 2.01,
      fiveMinDelta: -456000,
      marketCap: 9870000000000,
      float: 1000000000,
      volume: 8765400000,
      volumePercentage: 0.0087654,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-CA-F',
      name: 'Canada SGA Futures',
      price: 87600.00,
      change: 0.87,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.45,
      fiveMinDelta: 178000,
      marketCap: 8760000000000,
      float: 1000000000,
      volume: 7654300000,
      volumePercentage: 0.0076543,
      contractSize: 10,
      expiry: '2024-12-20'
    },
    {
      ticker: 'SGA-AU-F',
      name: 'Australia SGA Futures',
      price: 54300.00,
      change: 1.23,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.78,
      fiveMinDelta: 234000,
      marketCap: 5430000000000,
      float: 1000000000,
      volume: 4321000000,
      volumePercentage: 0.0043210,
      contractSize: 10,
      expiry: '2024-12-20'
    }
  ];

  // Mock SGA Pairs data
  const sgaPairs = [
    {
      ticker: 'SGA-US/CN',
      name: 'US/China SGA Pair',
      price: 1.1654,
      change: 0.45,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.67,
      fiveMinDelta: 234000,
      marketCap: 0,
      float: 0,
      volume: 5678900000,
      volumePercentage: 0.0234567,
      baseCurrency: 'SGA-US',
      quoteCurrency: 'SGA-CN'
    },
    {
      ticker: 'SGA-US/DE',
      name: 'US/Germany SGA Pair',
      price: 1.5198,
      change: 0.67,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.89,
      fiveMinDelta: 345000,
      marketCap: 0,
      float: 0,
      volume: 4567890000,
      volumePercentage: 0.0189012,
      baseCurrency: 'SGA-US',
      quoteCurrency: 'SGA-DE'
    },
    {
      ticker: 'SGA-US/JP',
      name: 'US/Japan SGA Pair',
      price: 1.6789,
      change: -0.23,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.56,
      fiveMinDelta: -123000,
      marketCap: 0,
      float: 0,
      volume: 3456780000,
      volumePercentage: 0.0156789,
      baseCurrency: 'SGA-US',
      quoteCurrency: 'SGA-JP'
    },
    {
      ticker: 'SGA-US/GB',
      name: 'US/UK SGA Pair',
      price: 2.1789,
      change: 0.89,
      monthlyRvol: 1.56,
      fiveMinRvol: 1.78,
      fiveMinDelta: 456000,
      marketCap: 0,
      float: 0,
      volume: 2345670000,
      volumePercentage: 0.0123456,
      baseCurrency: 'SGA-US',
      quoteCurrency: 'SGA-GB'
    },
    {
      ticker: 'SGA-CN/JP',
      name: 'China/Japan SGA Pair',
      price: 1.4456,
      change: -0.45,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.45,
      fiveMinDelta: -234000,
      marketCap: 0,
      float: 0,
      volume: 1987650000,
      volumePercentage: 0.0109876,
      baseCurrency: 'SGA-CN',
      quoteCurrency: 'SGA-JP'
    },
    {
      ticker: 'SGA-DE/FR',
      name: 'Germany/France SGA Pair',
      price: 2.1234,
      change: 0.34,
      monthlyRvol: 1.67,
      fiveMinRvol: 1.89,
      fiveMinDelta: 345000,
      marketCap: 0,
      float: 0,
      volume: 1765430000,
      volumePercentage: 0.0087654,
      baseCurrency: 'SGA-DE',
      quoteCurrency: 'SGA-FR'
    },
    {
      ticker: 'SGA-GB/EU',
      name: 'UK/Eurozone SGA Pair',
      price: 1.4567,
      change: -0.67,
      monthlyRvol: 1.45,
      fiveMinRvol: 1.67,
      fiveMinDelta: -456000,
      marketCap: 0,
      float: 0,
      volume: 1543210000,
      volumePercentage: 0.0076543,
      baseCurrency: 'SGA-GB',
      quoteCurrency: 'SGA-EU'
    },
    {
      ticker: 'SGA-IN/JP',
      name: 'India/Japan SGA Pair',
      price: 0.5678,
      change: 1.23,
      monthlyRvol: 1.89,
      fiveMinRvol: 2.12,
      fiveMinDelta: 567000,
      marketCap: 0,
      float: 0,
      volume: 1321090000,
      volumePercentage: 0.0065432,
      baseCurrency: 'SGA-IN',
      quoteCurrency: 'SGA-JP'
    },
    {
      ticker: 'SGA-AU/JP',
      name: 'Australia/Japan SGA Pair',
      price: 0.4321,
      change: 0.78,
      monthlyRvol: 1.34,
      fiveMinRvol: 1.56,
      fiveMinDelta: 234000,
      marketCap: 0,
      float: 0,
      volume: 1098760000,
      volumePercentage: 0.0054321,
      baseCurrency: 'SGA-AU',
      quoteCurrency: 'SGA-JP'
    },
    {
      ticker: 'SGA-CA/US',
      name: 'Canada/US SGA Pair',
      price: 0.2023,
      change: -0.12,
      monthlyRvol: 1.23,
      fiveMinRvol: 1.34,
      fiveMinDelta: -123000,
      marketCap: 0,
      float: 0,
      volume: 987654000,
      volumePercentage: 0.0043210,
      baseCurrency: 'SGA-CA',
      quoteCurrency: 'SGA-US'
    }
  ];

  // Mock SGA Options data
  const sgaOptions = [
    {
      ticker: 'SGA-US-450C',
      name: 'SGA-US $450 Call',
      price: 12.50,
      change: 156.78,
      monthlyRvol: 2.45,
      fiveMinRvol: 3.12,
      fiveMinDelta: 890000,
      marketCap: 0,
      float: 0,
      volume: 456789000,
      volumePercentage: 0.0234567,
      strikePrice: 450,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-US',
      impliedVolatility: 0.45,
      openInterest: 250000
    },
    {
      ticker: 'SGA-US-420P',
      name: 'SGA-US $420 Put',
      price: 8.75,
      change: -89.34,
      monthlyRvol: 1.89,
      fiveMinRvol: 2.34,
      fiveMinDelta: -567000,
      marketCap: 0,
      float: 0,
      volume: 345678000,
      volumePercentage: 0.0189012,
      strikePrice: 420,
      expiry: '2024-03-15',
      type: 'Put',
      underlying: 'SGA-US',
      impliedVolatility: 0.52,
      openInterest: 180000
    },
    {
      ticker: 'SGA-NY-300C',
      name: 'SGA-NY $300 Call',
      price: 45.20,
      change: 234.56,
      monthlyRvol: 3.12,
      fiveMinRvol: 4.23,
      fiveMinDelta: 1234000,
      marketCap: 0,
      float: 0,
      volume: 567890000,
      volumePercentage: 0.0345678,
      strikePrice: 300,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-NY',
      impliedVolatility: 0.58,
      openInterest: 320000
    },
    {
      ticker: 'SGA-NY-250P',
      name: 'SGA-NY $250 Put',
      price: 15.80,
      change: -123.45,
      monthlyRvol: 2.34,
      fiveMinRvol: 3.01,
      fiveMinDelta: -789000,
      marketCap: 0,
      float: 0,
      volume: 234567000,
      volumePercentage: 0.0156789,
      strikePrice: 250,
      expiry: '2024-03-15',
      type: 'Put',
      underlying: 'SGA-NY',
      impliedVolatility: 0.48,
      openInterest: 150000
    },
    {
      ticker: 'SGA-TX-200C',
      name: 'SGA-TX $200 Call',
      price: 32.40,
      change: 189.67,
      monthlyRvol: 2.78,
      fiveMinRvol: 3.45,
      fiveMinDelta: 987000,
      marketCap: 0,
      float: 0,
      volume: 456789000,
      volumePercentage: 0.0234567,
      strikePrice: 200,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-TX',
      impliedVolatility: 0.51,
      openInterest: 280000
    },
    {
      ticker: 'SGA-TX-150P',
      name: 'SGA-TX $150 Put',
      price: 9.60,
      change: -78.90,
      monthlyRvol: 1.67,
      fiveMinRvol: 2.12,
      fiveMinDelta: -456000,
      marketCap: 0,
      float: 0,
      volume: 189012000,
      volumePercentage: 0.0123456,
      strikePrice: 150,
      expiry: '2024-03-15',
      type: 'Put',
      underlying: 'SGA-TX',
      impliedVolatility: 0.44,
      openInterest: 120000
    },
    {
      ticker: 'SGA-CA-100C',
      name: 'SGA-CA $100 Call',
      price: 8.90,
      change: 3456.78,
      monthlyRvol: 5.67,
      fiveMinRvol: 8.92,
      fiveMinDelta: 2345000,
      marketCap: 0,
      float: 0,
      volume: 890000000,
      volumePercentage: 0.0456789,
      strikePrice: 100,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-CA',
      impliedVolatility: 0.85,
      openInterest: 500000
    },
    {
      ticker: 'SGA-CA-50P',
      name: 'SGA-CA $50 Put',
      price: 3.20,
      change: -1234.56,
      monthlyRvol: 4.56,
      fiveMinRvol: 6.78,
      fiveMinDelta: -1890000,
      marketCap: 0,
      float: 0,
      volume: 567890000,
      volumePercentage: 0.0345678,
      strikePrice: 50,
      expiry: '2024-03-15',
      type: 'Put',
      underlying: 'SGA-CA',
      impliedVolatility: 0.72,
      openInterest: 350000
    },
    {
      ticker: 'SGA-VA-20C',
      name: 'SGA-VA $20 Call',
      price: 5.40,
      change: 567.89,
      monthlyRvol: 3.45,
      fiveMinRvol: 4.56,
      fiveMinDelta: 567800,
      marketCap: 0,
      float: 0,
      volume: 234567000,
      volumePercentage: 0.0189012,
      strikePrice: 20,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-VA',
      impliedVolatility: 0.62,
      openInterest: 180000
    },
    {
      ticker: 'SGA-NV-15C',
      name: 'SGA-NV $15 Call',
      price: 4.80,
      change: 512.34,
      monthlyRvol: 3.23,
      fiveMinRvol: 4.12,
      fiveMinDelta: 523400,
      marketCap: 0,
      float: 0,
      volume: 198760000,
      volumePercentage: 0.0156789,
      strikePrice: 15,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-NV',
      impliedVolatility: 0.58,
      openInterest: 160000
    },
    {
      ticker: 'SGA-FL-180C',
      name: 'SGA-FL $180 Call',
      price: 28.70,
      change: 345.67,
      monthlyRvol: 2.89,
      fiveMinRvol: 3.67,
      fiveMinDelta: 1123000,
      marketCap: 0,
      float: 0,
      volume: 345678000,
      volumePercentage: 0.0234567,
      strikePrice: 180,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-FL',
      impliedVolatility: 0.55,
      openInterest: 240000
    },
    {
      ticker: 'SGA-IL-160C',
      name: 'SGA-IL $160 Call',
      price: 24.50,
      change: 289.12,
      monthlyRvol: 2.67,
      fiveMinRvol: 3.34,
      fiveMinDelta: 987000,
      marketCap: 0,
      float: 0,
      volume: 287650000,
      volumePercentage: 0.0189012,
      strikePrice: 160,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-IL',
      impliedVolatility: 0.53,
      openInterest: 210000
    },
    {
      ticker: 'SGA-PA-140C',
      name: 'SGA-PA $140 Call',
      price: 18.90,
      change: 234.56,
      monthlyRvol: 2.45,
      fiveMinRvol: 3.12,
      fiveMinDelta: 876000,
      marketCap: 0,
      float: 0,
      volume: 234567000,
      volumePercentage: 0.0156789,
      strikePrice: 140,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-PA',
      impliedVolatility: 0.49,
      openInterest: 190000
    },
    {
      ticker: 'SGA-OH-100C',
      name: 'SGA-OH $100 Call',
      price: 15.30,
      change: 198.45,
      monthlyRvol: 2.23,
      fiveMinRvol: 2.89,
      fiveMinDelta: 765000,
      marketCap: 0,
      float: 0,
      volume: 198760000,
      volumePercentage: 0.0123456,
      strikePrice: 100,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-OH',
      impliedVolatility: 0.47,
      openInterest: 170000
    },
    {
      ticker: 'SGA-GA-80C',
      name: 'SGA-GA $80 Call',
      price: 12.40,
      change: 267.89,
      monthlyRvol: 2.56,
      fiveMinRvol: 3.23,
      fiveMinDelta: 654000,
      marketCap: 0,
      float: 0,
      volume: 210987000,
      volumePercentage: 0.0134567,
      strikePrice: 80,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-GA',
      impliedVolatility: 0.51,
      openInterest: 180000
    },
    {
      ticker: 'SGA-NC-70C',
      name: 'SGA-NC $70 Call',
      price: 10.80,
      change: 223.45,
      monthlyRvol: 2.34,
      fiveMinRvol: 2.98,
      fiveMinDelta: 543000,
      marketCap: 0,
      float: 0,
      volume: 187650000,
      volumePercentage: 0.0112345,
      strikePrice: 70,
      expiry: '2024-03-15',
      type: 'Call',
      underlying: 'SGA-NC',
      impliedVolatility: 0.48,
      openInterest: 150000
    }
  ];

  // Mock SGA Yield Schedule data
  const sgaYieldSchedule = [
    {
      day: 1,
      country: 'United States',
      ticker: 'SGA-US',
      region: 'Americas',
      liquidity: 'Highest',
      volume: 45678900000,
      marketCap: 43250000000000,
      yieldDate: '2024-10-01',
      yieldRate: 0.55
    },
    {
      day: 2,
      country: 'China',
      ticker: 'SGA-CN',
      region: 'Asia Pacific',
      liquidity: 'High',
      volume: 34567800000,
      marketCap: 37100000000000,
      yieldDate: '2024-10-02',
      yieldRate: 0.62
    },
    {
      day: 3,
      country: 'Germany',
      ticker: 'SGA-DE',
      region: 'Europe',
      liquidity: 'High',
      volume: 23456700000,
      marketCap: 28450000000000,
      yieldDate: '2024-10-03',
      yieldRate: 0.48
    },
    {
      day: 4,
      country: 'Japan',
      ticker: 'SGA-JP',
      region: 'Asia Pacific',
      liquidity: 'High',
      volume: 18901200000,
      marketCap: 25780000000000,
      yieldDate: '2024-10-04',
      yieldRate: 0.72
    },
    {
      day: 5,
      country: 'United Kingdom',
      ticker: 'SGA-GB',
      region: 'Europe',
      liquidity: 'Medium-High',
      volume: 15678900000,
      marketCap: 19850000000000,
      yieldDate: '2024-10-05',
      yieldRate: 0.58
    },
    {
      day: 6,
      country: 'India',
      ticker: 'SGA-IN',
      region: 'Asia Pacific',
      liquidity: 'Medium-High',
      volume: 12345600000,
      marketCap: 14560000000000,
      yieldDate: '2024-10-06',
      yieldRate: 0.68
    },
    {
      day: 7,
      country: 'France',
      ticker: 'SGA-FR',
      region: 'Europe',
      liquidity: 'Medium',
      volume: 10987600000,
      marketCap: 13450000000000,
      yieldDate: '2024-10-07',
      yieldRate: 0.52
    },
    {
      day: 8,
      country: 'Italy',
      ticker: 'SGA-IT',
      region: 'Europe',
      liquidity: 'Medium',
      volume: 8765400000,
      marketCap: 9870000000000,
      yieldDate: '2024-10-08',
      yieldRate: 0.61
    },
    {
      day: 9,
      country: 'Canada',
      ticker: 'SGA-CA',
      region: 'Americas',
      liquidity: 'Medium',
      volume: 7654300000,
      marketCap: 8760000000000,
      yieldDate: '2024-10-09',
      yieldRate: 0.49
    },
    {
      day: 10,
      country: 'South Korea',
      ticker: 'SGA-KR',
      region: 'Asia Pacific',
      liquidity: 'Medium',
      volume: 6543200000,
      marketCap: 7650000000000,
      yieldDate: '2024-10-10',
      yieldRate: 0.75
    },
    {
      day: 11,
      country: 'Russia',
      ticker: 'SGA-RU',
      region: 'Europe',
      liquidity: 'Medium-Low',
      volume: 5432100000,
      marketCap: 6540000000000,
      yieldDate: '2024-10-11',
      yieldRate: 0.85
    },
    {
      day: 12,
      country: 'Australia',
      ticker: 'SGA-AU',
      region: 'Asia Pacific',
      liquidity: 'Medium-Low',
      volume: 4321000000,
      marketCap: 5430000000000,
      yieldDate: '2024-10-12',
      yieldRate: 0.54
    },
    {
      day: 13,
      country: 'Spain',
      ticker: 'SGA-ES',
      region: 'Europe',
      liquidity: 'Low-Medium',
      volume: 3210900000,
      marketCap: 4320000000000,
      yieldDate: '2024-10-13',
      yieldRate: 0.47
    },
    {
      day: 14,
      country: 'Mexico',
      ticker: 'SGA-MX',
      region: 'Americas',
      liquidity: 'Low-Medium',
      volume: 2109800000,
      marketCap: 3210000000000,
      yieldDate: '2024-10-14',
      yieldRate: 0.69
    },
    {
      day: 15,
      country: 'Indonesia',
      ticker: 'SGA-ID',
      region: 'Asia Pacific',
      liquidity: 'Low',
      volume: 1987600000,
      marketCap: 2980000000000,
      yieldDate: '2024-10-15',
      yieldRate: 0.72
    },
    {
      day: 16,
      country: 'Netherlands',
      ticker: 'SGA-NL',
      region: 'Europe',
      liquidity: 'Low',
      volume: 1876500000,
      marketCap: 2870000000000,
      yieldDate: '2024-10-16',
      yieldRate: 0.45
    },
    {
      day: 17,
      country: 'Saudi Arabia',
      ticker: 'SGA-SA',
      region: 'Middle East',
      liquidity: 'Low',
      volume: 1765400000,
      marketCap: 2760000000000,
      yieldDate: '2024-10-17',
      yieldRate: 0.92
    },
    {
      day: 18,
      country: 'Turkey',
      ticker: 'SGA-TR',
      region: 'Europe',
      liquidity: 'Low',
      volume: 1654300000,
      marketCap: 2650000000000,
      yieldDate: '2024-10-18',
      yieldRate: 0.88
    },
    {
      day: 19,
      country: 'Switzerland',
      ticker: 'SGA-CH',
      region: 'Europe',
      liquidity: 'Low',
      volume: 1543200000,
      marketCap: 2540000000000,
      yieldDate: '2024-10-19',
      yieldRate: 0.38
    },
    {
      day: 20,
      country: 'Sweden',
      ticker: 'SGA-SE',
      region: 'Europe',
      liquidity: 'Low',
      volume: 1432100000,
      marketCap: 2430000000000,
      yieldDate: '2024-10-20',
      yieldRate: 0.51
    },
    {
      day: 21,
      country: 'Brazil',
      ticker: 'SGA-BR',
      region: 'Americas',
      liquidity: 'Low',
      volume: 1321000000,
      marketCap: 1890000000000,
      yieldDate: '2024-10-21',
      yieldRate: 0.78
    },
    {
      day: 22,
      country: 'South Africa',
      ticker: 'SGA-ZA',
      region: 'Africa',
      liquidity: 'Low',
      volume: 987000000,
      marketCap: 1230000000000,
      yieldDate: '2024-10-22',
      yieldRate: 0.65
    }
  ];

  let currentFilter = 'all';
  let currentSort = { column: null, ascending: true };
  let currentTab = 'shares';
  let filteredStocks = [...sgaStocks];

  // Set all SGA share floats strictly in the 50B - 60B range (50,000,000,000 to 60,000,000,000)
  sgaStocks.forEach((stock, idx) => {
    const hash = ((stock.symbol || stock.ticker).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 19 + idx * 37) % 100;
    const variationB = (hash / 100) * 10; // 0.0 to 10.0 billion
    stock.float = Math.round((50 + variationB) * 10) / 10 * 1e9; // 50.0B to 60.0B
    if (stock.price) {
      stock.marketCap = Math.round(stock.float * stock.price);
    }
  });

  // Calculate accurate estimated volume based on float (50-60B) and relative volume (RVOL)
  function calculateEstimatedVolume(stock) {
    const baseTurnoverRate = 0.022; // 2.2% baseline daily turnover of float
    const rvol = (typeof stock.monthlyRvol === 'number' && stock.monthlyRvol > 0) ? stock.monthlyRvol : 1.0;
    
    // Ensure float is strictly in the 50B - 60B range for all shares
    if (!stock.float || stock.float < 50000000000 || stock.float > 60000000000) {
      stock.float = (50 + Math.floor(Math.random() * 101) / 10) * 1e9; // 50.0B - 60.0B
    }
    
    // Estimated daily volume: Float * baseTurnoverRate * RVOL
    const estimatedVol = Math.round(stock.float * baseTurnoverRate * rvol);
    stock.volume = Math.max(1000, estimatedVol);
    stock.volumePercentage = stock.volume / stock.float;
    return stock.volume;
  }

  // Apply accurate volume estimation across all initial instruments
  [sgaStocks, sgaFutures, sgaPairs, sgaOptions].forEach(dataset => {
    if (Array.isArray(dataset)) {
      dataset.forEach(stock => {
        calculateEstimatedVolume(stock);
      });
    }
  });

  // Format large numbers (handles positive and negative numbers compactly)
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const isNeg = num < 0;
    const abs = Math.abs(num);
    let str;
    if (abs >= 1e12) str = (abs / 1e12).toFixed(2) + 'T';
    else if (abs >= 1e9) str = (abs / 1e9).toFixed(2) + 'B';
    else if (abs >= 1e6) str = (abs / 1e6).toFixed(2) + 'M';
    else if (abs >= 1e3) str = (abs / 1e3).toFixed(2) + 'K';
    else str = abs.toFixed(2);
    return (isNeg ? '-' : '') + str;
  }

  // Format currency
  function formatCurrency(num) {
    if (num === null || num === undefined || isNaN(num)) return '$0.00';
    const isNeg = num < 0;
    const abs = Math.abs(num);
    return (isNeg ? '-$' : '$') + formatNumber(abs);
  }

  // Get RVOL class
  function getRvolClass(rvol) {
    if (rvol >= 2.0) return 'screener-rvol-high';
    if (rvol >= 1.5) return 'screener-rvol-medium';
    return 'screener-rvol-low';
  }

  // Get change class
  function getChangeClass(change) {
    return change >= 0 ? 'screener-change-positive' : 'screener-change-negative';
  }

  // Get delta class
  function getDeltaClass(delta) {
    const absDelta = Math.abs(delta);
    if (absDelta >= 2000000) return 'screener-delta-high';
    if (absDelta >= 1000000) return 'screener-delta-medium';
    return 'screener-delta-low';
  }

  // Color scale for Market Cap (cool slate → cyan → green → gold → bright orange)
  function getMarketCapColor(mcap) {
    if (!mcap || mcap <= 0) return '#64748b';
    const tril = mcap / 1e12; // convert to trillions
    if (tril < 2)  return '#64748b'; // slate — small
    if (tril < 5)  return '#7dd3fc'; // light blue
    if (tril < 10) return '#67e8f9'; // cyan
    if (tril < 20) return '#34d399'; // emerald
    if (tril < 40) return '#a3e635'; // lime-green
    if (tril < 60) return '#fbbf24'; // amber/gold
    return '#f97316';               // orange — mega cap
  }

  // Color scale for Volume (dim → blue → cyan → green → bright)
  function getVolumeColor(vol) {
    if (!vol || vol <= 0) return '#64748b';
    const bil = vol / 1e9; // convert to billions
    if (bil < 2)  return '#64748b'; // slate — low
    if (bil < 5)  return '#7dd3fc'; // light blue
    if (bil < 10) return '#67e8f9'; // cyan
    if (bil < 20) return '#34d399'; // emerald
    if (bil < 40) return '#a3e635'; // lime-green
    if (bil < 60) return '#fbbf24'; // amber
    return '#f97316';               // orange — ultra high
  }

  // Get badge
  function getBadge(stock) {
    return '';
  }

  // Get liquidity class for yield schedule
  function getLiquidityClass(liquidity) {
    switch(liquidity) {
      case 'Highest': return 'liquidity-highest';
      case 'High': return 'liquidity-high';
      case 'Medium-High': return 'liquidity-medium-high';
      case 'Medium': return 'liquidity-medium';
      case 'Medium-Low': return 'liquidity-medium-low';
      case 'Low-Medium': return 'liquidity-low-medium';
      case 'Low': return 'liquidity-low';
      default: return 'liquidity-low';
    }
  }

  // Render yield schedule
  function renderYieldSchedule() {
    const contentArea = document.getElementById('screener-content-area');
    const yieldContent = document.getElementById('yield-schedule-content');

    if (!contentArea || !yieldContent) return;

    // Hide main screener content
    contentArea.style.display = 'none';
    yieldContent.style.display = 'block';

    // Group by region
    const regions = {};
    sgaYieldSchedule.forEach(country => {
      if (!regions[country.region]) {
        regions[country.region] = [];
      }
      regions[country.region].push(country);
    });

    // Calculate stats
    const totalScheduleDays = sgaYieldSchedule.length;
    const totalVolume = sgaYieldSchedule.reduce((sum, c) => sum + c.volume, 0);
    const totalMarketCap = sgaYieldSchedule.reduce((sum, c) => sum + c.marketCap, 0);

    // Build HTML
    let html = `
      <div class="yield-schedule-header">
        <div class="yield-schedule-title">
          <h3>📅 SGA Yield Distribution Schedule</h3>
          <p class="yield-schedule-subtitle">Organized by liquidity and regional market depth</p>
        </div>
        <div class="yield-schedule-stats">
          <div class="yield-stat">
            <span class="yield-stat-label">Schedule Days</span>
            <span class="yield-stat-value">${totalScheduleDays}</span>
          </div>
          <div class="yield-stat">
            <span class="yield-stat-label">Total Volume</span>
            <span class="yield-stat-value">${formatNumber(totalVolume)}</span>
          </div>
          <div class="yield-stat">
            <span class="yield-stat-label">Total Market Cap</span>
            <span class="yield-stat-value">${formatNumber(totalMarketCap)}</span>
          </div>
        </div>
      </div>

      <div class="yield-regions-container">
    `;

    // Render each region
    Object.keys(regions).forEach(region => {
      const countries = regions[region];
      const regionVolume = countries.reduce((sum, c) => sum + c.volume, 0);
      const regionMarketCap = countries.reduce((sum, c) => sum + c.marketCap, 0);

      html += `
        <div class="yield-region-card">
          <div class="yield-region-header">
            <div class="yield-region-title">
              <span class="yield-region-name">${region}</span>
              <span class="yield-region-count">${countries.length} countries</span>
            </div>
            <div class="yield-region-stats">
              <div class="yield-region-stat">
                <span class="yield-region-stat-label">Volume</span>
                <span class="yield-region-stat-value">${formatNumber(regionVolume)}</span>
              </div>
              <div class="yield-region-stat">
                <span class="yield-region-stat-label">Market Cap</span>
                <span class="yield-region-stat-value">${formatNumber(regionMarketCap)}</span>
              </div>
            </div>
          </div>
          <div class="yield-country-grid">
      `;

      // Render each country in the region
      countries.forEach(country => {
        html += `
          <div class="yield-country-card ${getLiquidityClass(country.liquidity)}">
            <div class="yield-country-header">
              <span class="yield-country-day">Day ${country.day}</span>
              <span class="yield-country-liquidity">${country.liquidity}</span>
            </div>
            <div class="yield-country-info">
              <div class="yield-country-name">${country.country}</div>
              <div class="yield-country-ticker">${country.ticker}</div>
            </div>
            <div class="yield-country-metrics">
              <div class="yield-metric">
                <span class="yield-metric-label">Volume</span>
                <span class="yield-metric-value">${formatNumber(country.volume)}</span>
              </div>
              <div class="yield-metric">
                <span class="yield-metric-label">Market Cap</span>
                <span class="yield-metric-value">${formatNumber(country.marketCap)}</span>
              </div>
              <div class="yield-metric">
                <span class="yield-metric-label">Yield Rate</span>
                <span class="yield-metric-value">${(country.yieldRate * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div class="yield-country-date">
              <span class="yield-date-label">Yield Date</span>
              <span class="yield-date-value">${country.yieldDate}</span>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
      </div>
    `;

    yieldContent.innerHTML = html;
  }

  // Render table
  function renderTable() {
    const tbody = document.getElementById('screener-body');
    if (!tbody) {
      console.error('Screener tbody not found');
      return;
    }
    
    console.log('Rendering table with', filteredStocks.length, 'instruments for tab:', currentTab);
    tbody.innerHTML = '';

    // Update table headers based on current tab
    updateTableHeaders();

    filteredStocks.forEach(stock => {
      const row = document.createElement('tr');
      
      // Add highlighting for new stocks
      if (stock.isNew) {
        row.classList.add('new-stock-highlight');
        row.style.animation = 'newStockGlow 2s ease-in-out';
      }
      
      // Format price based on tab type
      let priceDisplay;
      if (currentTab === 'pairs') {
        priceDisplay = stock.price.toFixed(4); // Pairs show 4 decimal places
      } else if (currentTab === 'shares' && stock.price < 1) {
        priceDisplay = stock.price.toFixed(4); // Low-priced shares show 4 decimals
      } else {
        priceDisplay = formatCurrency(stock.price);
      }

      // Handle market cap and float for different instrument types
      let marketCapDisplay, floatDisplay;

      if (currentTab === 'pairs') {
        marketCapDisplay = stock.baseCurrency + '/' + stock.quoteCurrency;
        floatDisplay = formatNumber(stock.volume);
      } else if (currentTab === 'futures') {
        marketCapDisplay = stock.contractSize + 'x';
        floatDisplay = stock.expiry;
      } else if (currentTab === 'options') {
        marketCapDisplay = '$' + stock.strikePrice;
        floatDisplay = stock.expiry;
      } else {
        marketCapDisplay = formatCurrency(stock.marketCap);
        floatDisplay = formatNumber(stock.float);
      }
      const symbolCode = stock.symbol || (stock.ticker.startsWith('SGA-') ? stock.ticker.replace('SGA-', '').substring(0, 3).toUpperCase() : stock.ticker);
      const divisionText = stock.division || '';
      const countryText = stock.country || '';

      const locationSubtitle = divisionText && countryText
        ? `<span class="screener-div-name">${divisionText}</span><span class="screener-country-dot">•</span><span class="screener-country-name">${countryText}</span>`
        : `<span class="screener-div-name">${stock.name}</span>`;

      row.innerHTML = `
        <td>
          <div class="screener-ticker-cell">
            <div>
              <div class="screener-ticker-symbol">${symbolCode}</div>
              <div class="screener-ticker-name" title="${divisionText ? divisionText + ', ' + countryText : stock.name}">${locationSubtitle}</div>
            </div>
            ${getBadge(stock)}
          </div>
        </td>
        <td class="screener-change-cell ${getChangeClass(stock.change)}">${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%</td>
        <td class="screener-news-cell">${getInlineNews(stock)}</td>
        <td class="screener-price-cell">${priceDisplay}</td>
        <td class="screener-market-cap-cell" style="color: ${getMarketCapColor(stock.marketCap)}">${marketCapDisplay}</td>
        <td class="screener-float-cell">${floatDisplay}</td>
        <td class="screener-volume-cell" style="color: ${getVolumeColor(stock.volume)}">${formatNumber(stock.volume)}</td>
        <td class="screener-rvol-cell ${getRvolClass(stock.fiveMinRvol)}">${stock.fiveMinRvol.toFixed(2)}x</td>
        <td class="screener-delta-cell ${getDeltaClass(stock.fiveMinDelta)}">${formatNumber(stock.fiveMinDelta)}</td>
      `;
      tbody.appendChild(row);
    });

    updateStats();
    console.log('Table render complete');
  }

  // Update table headers based on current tab
  function updateTableHeaders() {
    const thead = document.querySelector('.screener-table thead tr');
    if (!thead) return;

    const marketCapTh = thead.children[4];
    const floatTh = thead.children[5];

    if (currentTab === 'pairs') {
      marketCapTh.textContent = 'Spread';
      floatTh.textContent = 'Liquidity';
    } else if (currentTab === 'futures') {
      marketCapTh.textContent = 'Contract Size';
      floatTh.textContent = 'Expiry';
    } else if (currentTab === 'options') {
      marketCapTh.textContent = 'Strike';
      floatTh.textContent = 'Expiry';
    } else {
      marketCapTh.innerHTML = 'Mkt Cap <span class="screener-sort-icon" id="sort-marketCap">↕</span>';
      floatTh.innerHTML = 'Float <span class="screener-sort-icon" id="sort-float">↕</span>';
    }
  }

  // Update statistics
  function updateStats() {
    const totalStocksEl = document.getElementById('total-stocks');
    const avgMonthlyRvolEl = document.getElementById('avg-monthly-rvol');
    const avg5minRvolEl = document.getElementById('avg-5min-rvol');
    const totalGainersEl = document.getElementById('total-gainers');
    const totalLosersEl = document.getElementById('total-losers');

    if (totalStocksEl) totalStocksEl.textContent = filteredStocks.length;

    if (avgMonthlyRvolEl) {
      const avgMonthlyRvol = filteredStocks.length > 0 ? filteredStocks.reduce((sum, s) => sum + s.monthlyRvol, 0) / filteredStocks.length : 0;
      avgMonthlyRvolEl.textContent = avgMonthlyRvol.toFixed(2) + 'x';
    }

    if (avg5minRvolEl) {
      const avg5minRvol = filteredStocks.length > 0 ? filteredStocks.reduce((sum, s) => sum + s.fiveMinRvol, 0) / filteredStocks.length : 0;
      avg5minRvolEl.textContent = avg5minRvol.toFixed(2) + 'x';
    }

    if (totalGainersEl) {
      const gainers = filteredStocks.filter(s => s.change > 0).length;
      totalGainersEl.textContent = gainers;
    }

    if (totalLosersEl) {
      const losers = filteredStocks.filter(s => s.change < 0).length;
      totalLosersEl.textContent = losers;
    }
  }

  // Helper function for search match
  function matchesSearchTerm(s, term) {
    if (!term) return true;
    return (s.ticker && s.ticker.toLowerCase().includes(term)) ||
           (s.sgaTicker && s.sgaTicker.toLowerCase().includes(term)) ||
           (s.symbol && s.symbol.toLowerCase().includes(term)) ||
           (s.division && s.division.toLowerCase().includes(term)) ||
           (s.country && s.country.toLowerCase().includes(term)) ||
           (s.name && s.name.toLowerCase().includes(term));
  }

  // Filter stocks
  function filterStocks(filter) {
    currentFilter = filter;
    
    // Get current dataset based on tab
    let currentDataset = getCurrentDataset();
    
    // Update button states
    document.querySelectorAll('.screener-filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === filter) {
        btn.classList.add('active');
      }
    });

    switch(filter) {
      case 'all':
        filteredStocks = [...currentDataset];
        break;
      case 'gainers':
        filteredStocks = currentDataset.filter(s => s.change > 0);
        break;
      case 'losers':
        filteredStocks = currentDataset.filter(s => s.change < 0);
        break;
      case 'hot':
        filteredStocks = currentDataset.filter(s => s.fiveMinRvol >= 2.0);
        break;
      case 'trending':
        filteredStocks = currentDataset.filter(s => s.fiveMinDelta > 0);
        break;
      case 'high-mcap':
        if (currentTab !== 'options') {
          filteredStocks = currentDataset.filter(s => s.marketCap >= 10000000000);
        }
        break;
    }

    // Apply float filter if set (skip for options since they don't have float)
    const floatInput = document.getElementById('float-filter-input');
    if (floatInput && floatInput.value && currentTab !== 'options') {
      const maxFloat = parseFloat(floatInput.value) * 1000000000; // Convert B to actual number
      if (!isNaN(maxFloat) && maxFloat > 0) {
        filteredStocks = filteredStocks.filter(s => s.float > 0 && s.float <= maxFloat);
      }
    }

    // Apply RVOL filter if set
    const rvolInput = document.getElementById('rvol-filter-input');
    if (rvolInput && rvolInput.value) {
      const minRvol = parseFloat(rvolInput.value);
      if (!isNaN(minRvol) && minRvol > 0) {
        filteredStocks = filteredStocks.filter(s => s.fiveMinRvol >= minRvol);
      }
    }

    // Apply gain percentage filter if set
    const gainInput = document.getElementById('gain-filter-input');
    if (gainInput && gainInput.value) {
      const minGain = parseFloat(gainInput.value);
      if (!isNaN(minGain) && minGain > 0) {
        filteredStocks = filteredStocks.filter(s => s.change >= minGain);
      }
    }

    // Apply delta filter if set (in millions)
    const deltaInput = document.getElementById('delta-filter-input');
    if (deltaInput && deltaInput.value) {
      const minDelta = parseFloat(deltaInput.value) * 1000000; // Convert to actual dollars
      if (!isNaN(minDelta) && minDelta > 0) {
        filteredStocks = filteredStocks.filter(s => s.fiveMinDelta >= minDelta);
      }
    }

    // Apply search if exists
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
      const searchTerm = searchInput.value.toLowerCase();
      filteredStocks = filteredStocks.filter(s => matchesSearchTerm(s, searchTerm));
    }

    // Apply current sort
    if (currentSort.column) {
      sortTable(currentSort.column, false);
    }

    renderTable();
  }

  // Get current dataset based on active tab
  function getCurrentDataset() {
    switch(currentTab) {
      case 'shares':
        return sgaStocks;
      case 'futures':
        return sgaFutures;
      case 'pairs':
        return sgaPairs;
      case 'options':
        return sgaOptions;
      default:
        return sgaStocks;
    }
  }

  // Switch between tabs
  function switchTab(tab) {
    currentTab = tab;

    // Update tab button states
    document.querySelectorAll('.screener-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
      }
    });

    // Handle yield tab specially
    if (tab === 'yield') {
      renderYieldSchedule();
      return;
    }

    // Show main screener content
    const contentArea = document.getElementById('screener-content-area');
    const yieldContent = document.getElementById('yield-schedule-content');
    if (contentArea) contentArea.style.display = 'block';
    if (yieldContent) yieldContent.style.display = 'none';

    // Reset filter and get new dataset
    currentFilter = 'all';
    currentSort = { column: null, ascending: true };

    // Update filter buttons
    document.querySelectorAll('.screener-filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === 'all') {
        btn.classList.add('active');
      }
    });

    // Load new data
    filteredStocks = [...getCurrentDataset()];
    renderTable();
  }

  // Sort table
  function sortTable(column, updateUI = true) {
    if (updateUI) {
      if (currentSort.column === column) {
        currentSort.ascending = !currentSort.ascending;
      } else {
        currentSort.column = column;
        currentSort.ascending = true;
      }

      // Update sort icons
      document.querySelectorAll('.screener-sort-icon').forEach(icon => {
        icon.classList.remove('active');
        icon.textContent = '↕';
      });
      
      const activeIcon = document.getElementById(`sort-${column}`);
      if (activeIcon) {
        activeIcon.classList.add('active');
        activeIcon.textContent = currentSort.ascending ? '↑' : '↓';
      }
    }

    filteredStocks.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      if (valA < valB) return currentSort.ascending ? -1 : 1;
      if (valA > valB) return currentSort.ascending ? 1 : -1;
      return 0;
    });

    if (updateUI) {
      renderTable();
    }
  }

  // Search functionality
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      if (searchTerm === '') {
        filterStocks(currentFilter);
      } else {
        const dataset = getCurrentDataset();
        filteredStocks = dataset.filter(s => matchesSearchTerm(s, searchTerm));
        
        // Apply current filter on top of search
        if (currentFilter !== 'all') {
          switch(currentFilter) {
            case 'gainers':
              filteredStocks = filteredStocks.filter(s => s.change > 0);
              break;
            case 'losers':
              filteredStocks = filteredStocks.filter(s => s.change < 0);
              break;
            case 'hot':
              filteredStocks = filteredStocks.filter(s => s.fiveMinRvol >= 2.0);
              break;
            case 'trending':
              filteredStocks = filteredStocks.filter(s => s.fiveMinDelta > 0);
              break;
            case 'high-mcap':
              filteredStocks = filteredStocks.filter(s => s.marketCap >= 10000000000);
              break;
            case 'low-float':
              filteredStocks = filteredStocks.filter(s => s.float < 50000000);
              break;
          }
        }
        
        renderTable();
      }
    });
  }

  // Filter button clicks
  document.querySelectorAll('.screener-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterStocks(btn.dataset.filter);
    });
  });

  // Float filter input changes
  const floatInput = document.getElementById('float-filter-input');
  if (floatInput) {
    floatInput.addEventListener('input', () => {
      filterStocks(currentFilter);
    });
  }

  // RVOL filter input changes
  const rvolInput = document.getElementById('rvol-filter-input');
  if (rvolInput) {
    rvolInput.addEventListener('input', () => {
      filterStocks(currentFilter);
    });
  }

  // Gain filter input changes
  const gainInput = document.getElementById('gain-filter-input');
  if (gainInput) {
    gainInput.addEventListener('input', () => {
      filterStocks(currentFilter);
    });
  }

  // Delta filter input changes
  const deltaInput = document.getElementById('delta-filter-input');
  if (deltaInput) {
    deltaInput.addEventListener('input', () => {
      filterStocks(currentFilter);
    });
  }

  // Tab button clicks
  document.querySelectorAll('.screener-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh-screener-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Visual feedback
      refreshBtn.textContent = '⏳ Loading...';
      refreshBtn.disabled = true;
      
      setTimeout(() => {
        // Simulate data refresh with more dramatic changes for all datasets
        [sgaStocks, sgaFutures, sgaPairs, sgaOptions].forEach(dataset => {
          dataset.forEach(stock => {
            const priceChange = (Math.random() - 0.5) * (stock.price * 0.005);
            stock.price = Math.max(0.01, stock.price + priceChange);

            // Only update change for non-US stocks (preserve high percentage values for US stocks)
            const isUSStock = stock.country === 'United States' || (stock.ticker && stock.ticker.startsWith('SGA-US'));

            if (!isUSStock) {
              stock.change = (Math.random() - 0.5) * 10; // More dramatic change
            }

            stock.monthlyRvol = Math.max(0.5, stock.monthlyRvol + (Math.random() - 0.5) * 0.5);
            stock.fiveMinRvol = Math.max(0.5, stock.fiveMinRvol + (Math.random() - 0.5) * 0.8);
            stock.fiveMinDelta = Math.floor((Math.random() - 0.5) * 5000000);
            stock.volume += Math.floor(Math.random() * 10000000);
            stock.volumePercentage = Math.min(0.1, Math.max(0.001, stock.volumePercentage + (Math.random() - 0.5) * 0.01));
          });
        });

        filterStocks(currentFilter);
        
        // Reset button
        refreshBtn.textContent = '🔄 Refresh Data';
        refreshBtn.disabled = false;
      }, 500);
    });
  }

  // Load Screener button (manual trigger)
  const loadBtn = document.getElementById('load-screener-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadBtn.textContent = '⏳ Loading...';
      loadBtn.disabled = true;
      
      setTimeout(() => {
        loadScreenerContent();
        loadBtn.textContent = '📊 Load Screener';
        loadBtn.disabled = false;
      }, 300);
    });
  }

  // Make functions globally available for sorting
  window.sortTable = sortTable;

  // Initial render with delay to ensure DOM is ready
  setTimeout(() => {
    console.log('Attempting initial render...');
    renderTable();
  }, 100);

  // Simulate live updates with more noticeable changes
  setInterval(() => {
    // Update all datasets
    [sgaStocks, sgaFutures, sgaPairs, sgaOptions].forEach(dataset => {
      dataset.forEach(stock => {
        // More noticeable random price movement
        const priceChange = (Math.random() - 0.5) * (stock.price * 0.002);
        stock.price = Math.max(0.01, stock.price + priceChange);

        // Only update change for non-US stocks (preserve high percentage values for US stocks)
        const isUSStock = stock.country === 'United States' || (stock.ticker && stock.ticker.startsWith('SGA-US'));

        if (!isUSStock) {
          // More dramatic change percentage updates
          stock.change += (Math.random() - 0.5) * 0.3;
          // Keep change within reasonable bounds
          stock.change = Math.max(-15, Math.min(15, stock.change));
        }

        // More dynamic RVOL updates
        stock.fiveMinRvol = Math.max(0.3, Math.min(5.0, stock.fiveMinRvol + (Math.random() - 0.5) * 0.3));
        stock.monthlyRvol = Math.max(0.5, Math.min(3.0, stock.monthlyRvol + (Math.random() - 0.5) * 0.1));

        // More significant delta updates
        stock.fiveMinDelta += Math.floor((Math.random() - 0.5) * 300000);

        // Incremental live volume updates accurately estimated from current volume & 5-minute RVOL
        const baseTick = Math.max(500, Math.floor(stock.volume * 0.0003));
        const tickVolume = Math.floor(baseTick * (stock.fiveMinRvol || 1.0) * (0.8 + Math.random() * 0.4));
        stock.volume += tickVolume;

        // Keep volume percentage strictly accurate to float
        if (stock.float && stock.float > 0) {
          stock.volumePercentage = stock.volume / stock.float;
        }
      });
    });

    // Re-render with current filter
    filterStocks(currentFilter);
  }, 2000); // Update every 2 seconds for more responsiveness

  // Continuously add authentic new SGA first-level divisions without numbers
  const additionalSubdivisions = [
    { sgaTicker: 'SGA-Alberta', symbol: 'ALB', division: 'Alberta', country: 'Canada', basePrice: 42.50, sector: 'Energy' },
    { sgaTicker: 'SGA-British Columbia', symbol: 'BCL', division: 'British Columbia', country: 'Canada', basePrice: 58.20, sector: 'Technology' },
    { sgaTicker: 'SGA-Quebec', symbol: 'QBC', division: 'Quebec', country: 'Canada', basePrice: 46.80, sector: 'Industrials' },
    { sgaTicker: 'SGA-Saxony', symbol: 'SAX', division: 'Saxony', country: 'Germany', basePrice: 62.40, sector: 'Technology' },
    { sgaTicker: 'SGA-Hesse', symbol: 'HES', division: 'Hesse', country: 'Germany', basePrice: 84.10, sector: 'Financials' },
    { sgaTicker: 'SGA-Osaka', symbol: 'OSA', division: 'Osaka', country: 'Japan', basePrice: 78.50, sector: 'Industrials' },
    { sgaTicker: 'SGA-Kyoto', symbol: 'KYO', division: 'Kyoto', country: 'Japan', basePrice: 69.30, sector: 'Technology' },
    { sgaTicker: 'SGA-Victoria', symbol: 'VIC', division: 'Victoria', country: 'Australia', basePrice: 51.60, sector: 'Financials' },
    { sgaTicker: 'SGA-Queensland', symbol: 'QLD', division: 'Queensland', country: 'Australia', basePrice: 44.90, sector: 'Energy' },
    { sgaTicker: 'SGA-Scotland', symbol: 'SCT', division: 'Scotland', country: 'United Kingdom', basePrice: 56.40, sector: 'Energy' },
    { sgaTicker: 'SGA-Wales', symbol: 'WLS', division: 'Wales', country: 'United Kingdom', basePrice: 38.20, sector: 'Industrials' },
    { sgaTicker: 'SGA-Minas Gerais', symbol: 'MGE', division: 'Minas Gerais', country: 'Brazil', basePrice: 31.80, sector: 'Consumer' },
    { sgaTicker: 'SGA-Rio de Janeiro', symbol: 'RDJ', division: 'Rio de Janeiro', country: 'Brazil', basePrice: 36.50, sector: 'Energy' },
    { sgaTicker: 'SGA-Karnataka', symbol: 'KTK', division: 'Karnataka', country: 'India', basePrice: 48.70, sector: 'Technology' },
    { sgaTicker: 'SGA-Tamil Nadu', symbol: 'TND', division: 'Tamil Nadu', country: 'India', basePrice: 42.10, sector: 'Industrials' },
    { sgaTicker: 'SGA-Gujarat', symbol: 'GUJ', division: 'Gujarat', country: 'India', basePrice: 45.60, sector: 'Energy' },
    { sgaTicker: 'SGA-Catalonia', symbol: 'CAT', division: 'Catalonia', country: 'Spain', basePrice: 53.40, sector: 'Consumer' },
    { sgaTicker: 'SGA-Andalusia', symbol: 'AND', division: 'Andalusia', country: 'Spain', basePrice: 39.80, sector: 'Consumer' },
    { sgaTicker: 'SGA-Busan', symbol: 'BUS', division: 'Busan', country: 'South Korea', basePrice: 52.30, sector: 'Industrials' },
    { sgaTicker: 'SGA-Incheon', symbol: 'INC', division: 'Incheon', country: 'South Korea', basePrice: 49.60, sector: 'Technology' },
    { sgaTicker: 'SGA-Auvergne-Rhône-Alpes', symbol: 'ARA', division: 'Auvergne-Rhône-Alpes', country: 'France', basePrice: 65.20, sector: 'Healthcare' },
    { sgaTicker: 'SGA-Jalisco', symbol: 'JAL', division: 'Jalisco', country: 'Mexico', basePrice: 34.70, sector: 'Technology' },
    { sgaTicker: 'SGA-West Java', symbol: 'WJV', division: 'West Java', country: 'Indonesia', basePrice: 32.40, sector: 'Consumer' },
    { sgaTicker: 'SGA-Eastern Province', symbol: 'EAS', division: 'Eastern Province', country: 'Saudi Arabia', basePrice: 61.50, sector: 'Energy' },
    { sgaTicker: 'SGA-Geneva', symbol: 'GVA', division: 'Geneva', country: 'Switzerland', basePrice: 89.20, sector: 'Financials' }
  ];
  
  let newSGAIndex = 0;
  
  setInterval(() => {
    // Only add if on the shares tab
    if (currentTab !== 'shares') return;
    
    const item = additionalSubdivisions[newSGAIndex % additionalSubdivisions.length];
    newSGAIndex++;
    
    // Check if this jurisdiction already exists in the list
    if (sgaStocks.some(s => s.symbol === item.symbol || s.sgaTicker === item.sgaTicker)) {
      return;
    }
    
    const floatVal = (50 + Math.floor(Math.random() * 101) / 10) * 1e9; // 50.0B - 60.0B float
    const newSGA = {
      ticker: item.sgaTicker,
      sgaTicker: item.sgaTicker,
      symbol: item.symbol,
      division: item.division,
      country: item.country,
      name: `${item.division}, ${item.country}`,
      price: Number((item.basePrice + (Math.random() - 0.5) * 4).toFixed(2)),
      change: Number(((Math.random() - 0.5) * 15).toFixed(2)),
      monthlyRvol: Number((Math.random() * 2 + 0.8).toFixed(2)),
      fiveMinRvol: Number((Math.random() * 3 + 0.8).toFixed(2)),
      fiveMinDelta: Math.floor((Math.random() - 0.5) * 2000000),
      float: floatVal,
      marketCap: Math.round(floatVal * item.basePrice),
      sector: item.sector,
      isNew: true
    };
    calculateEstimatedVolume(newSGA);
    
    if (window.newStocksFromBottom) {
      sgaStocks.push(newSGA);
    } else {
      sgaStocks.unshift(newSGA);
    }
    
    // Remove the "isNew" flag after a few seconds
    setTimeout(() => {
      newSGA.isNew = false;
    }, 5000);
    
    // Keep array size manageable (max 50 stocks)
    if (sgaStocks.length > 50) {
      if (window.newStocksFromBottom) {
        sgaStocks.shift(); // Remove from top when adding to bottom
      } else {
        sgaStocks.pop(); // Remove from bottom when adding to top
      }
    }
    
    // Re-render if on shares tab
    if (currentTab === 'shares') {
      filterStocks(currentFilter);
    }
  }, 4000);

  // ========== SCREENER NEWS FEED ==========
  
  // News database keyed by ticker / symbol / division name with diverse, concise keyword headlines
  const screenerNewsDB = {
    'VIR': [
      { keyword: 'Defense AI Hub Contract $6B', title: 'Virginia Defense Tech Consortium Awards $6B Autonomous Systems Contract', time: '2 min ago', source: 'Richmond Times', description: 'Northern Virginia defense corridor integrates sovereign digital settlement for multi-branch defense procurement.' },
      { keyword: 'Treasury Reserve Approved', title: 'Virginia State Treasury Approves SGA-Virginia Reserve Liquidity Framework', time: '25 min ago', source: 'Reuters', description: 'Commonwealth officials authorize expanded digital reserve allocation for sovereign state settlement.' },
      { keyword: 'Port Clearance Live', title: 'Virginia Port Authority Integrates SGA-Virginia for Maritime Trade Clearance', time: '1 hr ago', source: 'WSJ', description: 'Port of Virginia accelerates cross-border trade clearance using real-time SGA-Virginia settlements.' },
      { keyword: 'Dulles Data Link Online', title: 'Hyperscale Data Center Cluster Activates Dedicated SGA Settlement Pipeline', time: '3 hr ago', source: 'Bloomberg', description: 'Loudoun County tech corridor launches direct sovereign asset liquidity bridge.' }
    ],
    'VA': [
      { keyword: 'Defense AI Hub Contract $6B', title: 'Virginia Defense Tech Consortium Awards $6B Autonomous Systems Contract', time: '2 min ago', source: 'Richmond Times', description: 'Northern Virginia defense corridor integrates sovereign digital settlement for multi-branch defense procurement.' }
    ],
    'Virginia': [
      { keyword: 'Defense AI Hub Contract $6B', title: 'Virginia Defense Tech Consortium Awards $6B Autonomous Systems Contract', time: '2 min ago', source: 'Richmond Times', description: 'Northern Virginia defense corridor integrates sovereign digital settlement for multi-branch defense procurement.' }
    ],
    'USA': [
      { keyword: 'Fed Policy Guidance Bullish', title: 'Federal Reserve Signals Positive Outlook for Sovereign-Backed Asset Frameworks', time: '2 min ago', source: 'Reuters', description: 'Fed Chair highlights the growing importance of subnational digital assets in modern interbank liquidity.' },
      { keyword: 'Treasury Compliance Protocol', title: 'U.S. Treasury Department Finalizes National Sovereign Asset Standards', time: '18 min ago', source: 'Bloomberg', description: 'Updated regulatory architecture standardizes multi-state digital reserve operations.' },
      { keyword: 'Triple-A Sovereign Rating OK', title: 'Major Credit Agencies Affirm Sovereign Asset Reserve Stability', time: '45 min ago', source: 'CNBC', description: 'Comprehensive audit validates national asset collateral ratios and liquidity backing.' }
    ],
    'US': [
      { keyword: 'Fed Policy Guidance Bullish', title: 'Federal Reserve Signals Positive Outlook for Sovereign-Backed Asset Frameworks', time: '2 min ago', source: 'Reuters', description: 'Fed Chair highlights the growing importance of subnational digital assets in modern interbank liquidity.' }
    ],
    'NYK': [
      { keyword: 'Wall St Custody Protocol Live', title: 'Tier-1 Wall Street Custodians Launch Institutional SGA-New York Vaults', time: '5 min ago', source: 'Bloomberg', description: 'Major investment banks activate institutional custody and clearing solutions for SGA-NY.' },
      { keyword: 'State Infra Bond $3.5B OK', title: 'New York State Bond Offering Backed by Sovereign Assets Oversubscribed', time: '22 min ago', source: 'NY Times', description: 'Landmark infrastructure bond attracts strong domestic and sovereign wealth participation.' }
    ],
    'NY': [
      { keyword: 'Wall St Custody Protocol Live', title: 'Tier-1 Wall Street Custodians Launch Institutional SGA-New York Vaults', time: '5 min ago', source: 'Bloomberg', description: 'Major investment banks activate institutional custody and clearing solutions for SGA-NY.' }
    ],
    'TEX': [
      { keyword: 'ERCOT Energy Grid Settlement', title: 'Texas Energy Grid Integrates SGA-Texas for Wholesale Power Clearing', time: '8 min ago', source: 'Houston Chronicle', description: 'ERCOT automated wholesale power settlements transition to instantaneous SGA-TX liquidity rails.' },
      { keyword: 'Semiconductor Fab Groundbreaking', title: 'Samsung and TI Expand Austin-Sherman Chip Hub Sovereign Settlement Pact', time: '35 min ago', source: 'Bloomberg', description: 'State semiconductor manufacturing facilities anchor long-term sovereign settlement backing.' }
    ],
    'TX': [
      { keyword: 'ERCOT Energy Grid Settlement', title: 'Texas Energy Grid Integrates SGA-Texas for Wholesale Power Clearing', time: '8 min ago', source: 'Houston Chronicle', description: 'ERCOT automated wholesale power settlements transition to instantaneous SGA-TX liquidity rails.' }
    ],
    'CAL': [
      { keyword: 'CalPERS Pension Stake 3%', title: 'California State Pension Board Approves SGA Allocation Strategy', time: '12 min ago', source: 'LA Times', description: 'CalPERS adopts sovereign asset reserve strategy to hedge institutional portfolio against inflation.' },
      { keyword: 'Clean Grid Intertie Online', title: 'California ISO Launches SGA-CA Renewable Power Certificate Clearing', time: '30 min ago', source: 'TechCrunch', description: 'State grid operator deploys automated settlement for statewide clean energy storage.' }
    ],
    'CA': [
      { keyword: 'CalPERS Pension Stake 3%', title: 'California State Pension Board Approves SGA-California Allocation Strategy', time: '12 min ago', source: 'LA Times', description: 'CalPERS adopts sovereign asset reserve strategy to hedge institutional portfolio against inflation.' }
    ],
    'FLO': [
      { keyword: 'Space Coast Defense Pact', title: 'Florida Space Coast Corridor Inks Sovereign Aerospace Settlement Accord', time: '7 min ago', source: 'Miami Herald', description: 'Commercial launch providers and NASA contractors integrate SGA-Florida for rapid aerospace logistics.' },
      { keyword: 'Miami FinTech Clearing Hub', title: 'Miami Global Financial Center Launches Dedicated Sovereign Trading Desks', time: '40 min ago', source: 'Bloomberg', description: 'International institutions establish high-speed trading and settlement infrastructure in Miami.' }
    ],
    'FL': [
      { keyword: 'Space Coast Defense Pact', title: 'Florida Space Coast Corridor Inks Sovereign Aerospace Settlement Accord', time: '7 min ago', source: 'Miami Herald', description: 'Commercial launch providers and NASA contractors integrate SGA-Florida for rapid aerospace logistics.' }
    ],
    'ILL': [
      { keyword: 'Mercantile Agri Swap Live', title: 'Chicago Trading Floors Launch SGA-Illinois Agricultural Commodities Swaps', time: '15 min ago', source: 'Chicago Tribune', description: 'Midwest grain producers and mercantile traders utilize SGA-IL for instant cross-state commodity settlement.' }
    ],
    'PEN': [
      { keyword: 'Keystone Energy Grid Upgrade', title: 'Pennsylvania Natural Gas & Power Producers Adopt SGA-Pennsylvania', time: '20 min ago', source: 'Philadelphia Inquirer', description: 'Energy producers link wholesale pipeline settlements to state sovereign asset framework.' }
    ],
    'NCA': [
      { keyword: 'Research Triangle Bio Hub', title: 'North Carolina Biotech Corridor Secures $4B Research Expansion Accord', time: '28 min ago', source: 'Raleigh News', description: 'Research Triangle Park life sciences hubs integrate sovereign asset reserve framework.' }
    ],
    'WAS': [
      { keyword: 'Cloud & Aerospace Export Pact', title: 'Washington State Aerospace & Cloud Leaders Expand Sovereign Settlement', time: '14 min ago', source: 'Seattle Times', description: 'Commercial aviation supply chains and hyperscale cloud providers deploy SGA-Washington liquidity.' }
    ],
    'OHI': [
      { keyword: 'Silicon Heartland Fab Online', title: 'Ohio Semiconductor Hub Activates Sovereign Manufacturing Supply Network', time: '32 min ago', source: 'Columbus Dispatch', description: 'Major manufacturing corridor integrates automated sovereign asset settlement.' }
    ],
    'GEO': [
      { keyword: 'Savannah Port Volume Record', title: 'Port of Savannah Deploys SGA-Georgia for Global Maritime Clearance', time: '19 min ago', source: 'Atlanta Journal', description: 'Container terminal logistics integrate high-efficiency sovereign settlement protocols.' }
    ]
  };

  // Generate diverse, realistic concise keyword news across various economic sectors
  function generateGenericNews(ticker, name, stock) {
    const sgaLabel = stock && stock.sgaTicker ? stock.sgaTicker : ticker;
    const divName = stock && stock.division ? stock.division : name;
    const symbolCode = stock && stock.symbol ? stock.symbol : ticker;
    
    // Diverse pool of topics: bonds, budgets, clean energy, tech, trade, ratings, pensions, agriculture, logistics
    const topicPool = [
      { keyword: `${divName} State Bonds Oversubscribed`, title: `${divName} Successfully Places Multi-Billion Sovereign Municipal Bond Offering`, time: '12 min ago', source: 'Bloomberg', description: `Investor demand surpasses issuance quota for ${sgaLabel}-backed institutional securities.` },
      { keyword: `Triple-A Credit Rating Affirmed`, title: `Major Rating Agencies Affirm AAA Sovereign Credit Rating for ${divName}`, time: '35 min ago', source: 'Reuters', description: `Auditors cite robust reserve balances, fiscal discipline, and transparent ${sgaLabel} backing.` },
      { keyword: `Budget Surplus Beats Forecast`, title: `${divName} State Treasury Reports Fiscal Revenue Exceeding Projections by 9.4%`, time: '1 hr ago', source: 'WSJ', description: `Strong regional economic output bolsters reserve capitalizations across ${sgaLabel} liquidity pools.` },
      { keyword: `Clean Energy Grid Link Live`, title: `${divName} Activates Sovereign Settlement Protocol for Regional Renewable Energy Grid`, time: '2 hr ago', source: 'Financial Times', description: `Utility consortium connects automated clean energy power clearance to ${sgaLabel} digital infrastructure.` },
      { keyword: `Maritime Logistics Protocol OK`, title: `${divName} Trade Hub Integrates Real-Time Cargo Clearance Using ${sgaLabel}`, time: '3 hr ago', source: 'AP', description: `Logistics terminals reduce container turnaround times with instant cross-jurisdiction trade clearing.` },
      { keyword: `Semiconductor Supply Expansion`, title: `High-Tech Manufacturing Corridor in ${divName} Secures $8B Capital Commitment`, time: '4 hr ago', source: 'TechCrunch', description: `Advanced industrial cluster anchors long-term settlement demand for ${sgaLabel} instruments.` },
      { keyword: `Pension Board Adds 2.5% Allocation`, title: `${divName} Public Employees Retirement System Authorizes Sovereign Reserve Stake`, time: '5 hr ago', source: 'Pensions & Investments', description: `Institutional trustees diversify sovereign portfolios with strategic ${sgaLabel} holdings.` },
      { keyword: `Real-Time T+0 Clearing Live`, title: `Inter-Jurisdictional Trade Desks Launch Instant T+0 Clearing for ${sgaLabel}`, time: '6 hr ago', source: 'MarketWatch', description: `Cross-border merchant settlement network eliminates multi-day clearing delays.` },
      { keyword: `Agri-Export Corridor Pact Signed`, title: `${divName} Agricultural Exporters Deploy ${sgaLabel} for International Trade Settlement`, time: '7 hr ago', source: 'CNBC', description: `Bulk grain and commodity exporters streamline bilateral financing with sovereign asset reserves.` }
    ];

    // Pick deterministic variety based on symbol/ticker hash
    const hash = (symbolCode + divName).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const primaryTopic = topicPool[hash % topicPool.length];
    const secondaryTopic = topicPool[(hash + 3) % topicPool.length];
    const tertiaryTopic = topicPool[(hash + 6) % topicPool.length];

    return [primaryTopic, secondaryTopic, tertiaryTopic];
  }

  // Get news for a given stock (not all SGAs have active news)
  function getNewsForStock(stock) {
    if (!stock) return [];
    const symbolKey = stock.symbol || '';
    const tickerKey = stock.ticker || '';
    const sgaKey = stock.sgaTicker || '';
    const divKey = stock.division || '';
    const rawKey = tickerKey.replace('SGA-', '');

    // Check specific featured news first
    if (screenerNewsDB[symbolKey]) return screenerNewsDB[symbolKey];
    if (screenerNewsDB[tickerKey]) return screenerNewsDB[tickerKey];
    if (screenerNewsDB[sgaKey]) return screenerNewsDB[sgaKey];
    if (screenerNewsDB[divKey]) return screenerNewsDB[divKey];
    if (screenerNewsDB[rawKey]) return screenerNewsDB[rawKey];

    // For other SGAs, only ~25-30% have breaking news (or high RVOL catalysts)
    const hash = (symbolKey + divKey + tickerKey).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hasBreakingNews = (hash % 4 === 0) || (stock.fiveMinRvol && stock.fiveMinRvol >= 3.0);
    
    if (hasBreakingNews) {
      return generateGenericNews(stock.ticker, stock.name, stock);
    }
    
    return [];
  }

  // Get inline news HTML for a table cell (short keyword headline, no bullish/bearish tag)
  function getInlineNews(stock) {
    const newsItems = getNewsForStock(stock);
    if (!newsItems || newsItems.length === 0) return '<span class="screener-news-dash">—</span>';
    
    // Pick the top (most recent) news item
    const news = newsItems[0];
    const headline = news.keyword || news.title;
    const tooltipText = news.title ? (news.title + (news.description ? ' — ' + news.description : '')) : headline;
    
    return '<div class="screener-news-inline" title="' + tooltipText + '">' +
      '<span class="screener-news-headline">' + headline + '</span>' +
    '</div>';
  }
}

init();
init();


/* MARKETS TAB JAVASCRIPT FUNCTIONS */

// ==================================================
// GLOBAL STATE
// ==================================================
let currentUserId = 'SGA-USR-9042';

// ==================================================
// FEE SETTINGS INTEGRATION
// ==================================================
// Initialize additional fees object if not exists
if (!window.additionalFees) {
  window.additionalFees = {
    globalExchangeNetwork: 0,
    sgaPairs: 0,
    futures: 0.05, // 0.05% futures fee
    options: 0.05,
    fxFee: 0.25,
    gxFee: 0.5 // 0.5% GX fee
  };
}

const sgaUsers = {
    'SGA-USR-9042': { id: 'SGA-USR-9042', name: 'Hamza (Primary Trader)', type: 'Institutional', restrictions: { 'LSE': { type: 'temp', reason: 'Illegal Arbitrage (Cross-Market Latency Abuse)', expiresAt: new Date(Date.now() + 24*3600*1000).toISOString() } } },
    'SGA-USR-1092': { id: 'SGA-USR-1092', name: 'High-Freq Algo Bot #4', type: 'AMM', restrictions: { 'NASDAQ': { type: 'permanent', reason: 'Wash Trading / Spoofing / Manipulation', expiresAt: null } } },
    'SGA-USR-5521': { id: 'SGA-USR-5521', name: 'Global Arbitrage Fund', type: 'Hedge Fund', restrictions: { 'HKEX': { type: 'temp', reason: 'Liquidity Reserve Overdraft Default', expiresAt: new Date(Date.now() + 7*24*3600*1000).toISOString() } } }
};

const testProfiles = [
    { id: 'SGA-USR-9042', name: 'Hamza (Primary Trader)' },
    { id: 'SGA-USR-1092', name: 'Algo HFT Bot #4' },
    { id: 'SGA-USR-5521', name: 'Global Arbitrage Fund' },
    { id: 'SGA-USR-7734', name: 'Shadow Latency Trader' },
    { id: 'SGA-USR-4099', name: 'Vanguard Institutional' },
    { id: 'SGA-USR-6120', name: 'Cross-Market Spoofer' }
];

const fxRates = { 
    USD:1, 
    EUR:0.9215, 
    GBP:0.789, 
    JPY:156.45, 
    CAD:1.365, 
    AUD:1.512, 
    CHF:0.898, 
    CNY:7.245, 
    HKD:7.812, 
    SGD:1.349, 
    SEK:10.52, 
    NOK:10.85, 
    DKK:6.85, 
    PLN:3.95, 
    CZK:23.15, 
    HUF:365.5, 
    RON:4.65, 
    RUB:92.5, 
    UAH:39.5, 
    TRY:32.5, 
    ILS:3.75, 
    KRW:1378.5, 
    THB:35.5, 
    IDR:15750, 
    MYR:4.75, 
    VND:25350, 
    PHP:56.5, 
    TWD:31.5, 
    NZD:1.65, 
    INR:83.45, 
    SAR:3.75, 
    AED:3.6725,
    MXN:17.5,
    BRL:5.15,
    ARS:850.5,
    CLP:980.5,
    COP:4150,
    PEN:3.75,
    VES:36.5,
    ZAR:18.75,
    NGN:1550,
    EGP:48.5,
    MAD:10.25,
    KES:155,
    PKR:280.5,
    BDT:110.5,
    LKR:320,
    NPR:133.5,
    MMK:2100,
    KHR:4150,
    LAK:21500,
    BND:1.35,
    MVR:15.5,
    ISK:140.5,
    QAR:3.65,
    KWD:0.31,
    BHD:0.38,
    OMR:0.39,
    BGN:1.85,
    BAM:1.85,
    MKD:58.5,
    RSD:105.5,
    MXN:17.5
};
const currencySymbols = { 
    USD:'$', 
    EUR:'€', 
    GBP:'£', 
    JPY:'¥', 
    CAD:'CA$', 
    AUD:'A$', 
    CHF:'Fr.', 
    CNY:'¥', 
    HKD:'HK$', 
    SGD:'S$', 
    SEK:'kr', 
    NOK:'kr', 
    DKK:'kr', 
    PLN:'zł', 
    CZK:'Kč', 
    HUF:'Ft', 
    RON:'lei', 
    RUB:'₽', 
    UAH:'₴', 
    TRY:'₺', 
    ILS:'₪', 
    KRW:'₩', 
    THB:'฿', 
    IDR:'Rp', 
    MYR:'RM', 
    VND:'₫', 
    PHP:'₱', 
    TWD:'NT$', 
    NZD:'NZ$', 
    INR:'₹', 
    SAR:'SR', 
    AED:'AED',
    MXN:'MX$',
    BRL:'R$',
    ARS:'AR$',
    CLP:'CL$',
    COP:'COL$',
    PEN:'S/',
    VES:'Bs.',
    ZAR:'R',
    NGN:'₦',
    EGP:'E£',
    MAD:'DH',
    KES:'KSh',
    PKR:'₨',
    BDT:'৳',
    LKR:'Rs',
    NPR:'₨',
    MMK:'K',
    KHR:'៛',
    LAK:'₭',
    BND:'B$',
    MVR:'Rf',
    ISK:'kr',
    QAR:'QR',
    KWD:'KD',
    BHD:'BD',
    OMR:'﷼',
    BGN:'лв',
    BAM:'КМ',
    MKD:'ден',
    RSD:'дин'
};
const sgaReserves = { USD:500000000, EUR:460750000, GBP:394500000, JPY:78225000000, CAD:682500000, AUD:756000000, CHF:449000000, CNY:3622500000, HKD:3906000000, SGD:674500000, SEK:5260000000, KRW:689250000000, INR:41725000000, SAR:1875000000, AED:1836250000, RUB:46250000000 };

let currentStock = { symbol:'AAPL', name:'Apple Inc.', price:310.45, change:1.10, changePercent:0.36 };
let currentExchange = 'NASDAQ';
let currentPrice = 310.45;
let prevPrice = 309.35;
let activeAssetMode = 'stock';
let selectedBondId = 'AAPL-2043';
let activeBondCategory = 'all';
let userBondsPar = 0;
let userShares = 154.285;
let activeTab = 'buy';
let activeCurrency = 'USD';
let orderMethod = 'currency';
let priceHistory = [];
let timeLabels = [];
recentTrades = [];

// Exchange Data
const exchangeData = {
    NASDAQ: { 
        name:'NASDAQ', country:'USA', currency:'USD', flag:'🇺🇸', region:'Americas',
        stocks:[
            {symbol:'AAPL',name:'Apple Inc.',price:310.45,change:1.10,changePercent:0.36,sector:'Technology',marketCap:'$4.76T',volume:'48.2M',peRatio:33.2,'52wHigh':325.00,'52wLow':245.00,fiveMinRvol:2.15,fiveMinDelta:2450000},
            {symbol:'MSFT',name:'Microsoft Corp',price:448.90,change:3.20,changePercent:0.72,sector:'Technology',marketCap:'$3.33T',volume:'22.4M',peRatio:35.8,'52wHigh':468.00,'52wLow':366.00,fiveMinRvol:1.85,fiveMinDelta:1820000},
            {symbol:'NVDA',name:'NVIDIA Corp',price:128.20,change:4.50,changePercent:3.64,sector:'Technology',marketCap:'$3.15T',volume:'65.8M',peRatio:62.4,'52wHigh':140.76,'52wLow':45.50,fiveMinRvol:3.42,fiveMinDelta:5400000},
            {symbol:'AMZN',name:'Amazon.com Inc',price:186.50,change:-0.80,changePercent:-0.43,sector:'Consumer Discretionary',marketCap:'$1.94T',volume:'31.2M',peRatio:42.1,'52wHigh':201.20,'52wLow':118.30,fiveMinRvol:1.45,fiveMinDelta:-650000},
            {symbol:'GOOGL',name:'Alphabet Inc',price:179.40,change:1.50,changePercent:0.84,sector:'Communication',marketCap:'$2.22T',volume:'24.1M',peRatio:24.5,'52wHigh':191.75,'52wLow':129.40,fiveMinRvol:1.68,fiveMinDelta:980000},
            {symbol:'META',name:'Meta Platforms',price:508.30,change:10.70,changePercent:2.15,sector:'Communication',marketCap:'$1.29T',volume:'18.5M',peRatio:28.2,'52wHigh':542.80,'52wLow':279.40,fiveMinRvol:2.85,fiveMinDelta:2150000},
            {symbol:'TSLA',name:'Tesla Inc',price:254.80,change:11.70,changePercent:4.82,sector:'Consumer Discretionary',marketCap:'$812B',volume:'78.4M',peRatio:71.5,'52wHigh':271.00,'52wLow':138.80,fiveMinRvol:4.12,fiveMinDelta:4200000},
            {symbol:'AVGO',name:'Broadcom Inc',price:168.40,change:3.10,changePercent:1.88,sector:'Technology',marketCap:'$785B',volume:'14.2M',peRatio:38.4,'52wHigh':185.16,'52wLow':80.80,fiveMinRvol:2.05,fiveMinDelta:1150000},
            {symbol:'COST',name:'Costco Wholesale',price:848.20,change:8.00,changePercent:0.95,sector:'Consumer Staples',marketCap:'$376B',volume:'4.8M',peRatio:51.2,'52wHigh':896.60,'52wLow':545.00,fiveMinRvol:1.24,fiveMinDelta:420000},
            {symbol:'AMD',name:'Advanced Micro Devices',price:156.80,change:4.75,changePercent:3.12,sector:'Technology',marketCap:'$253B',volume:'36.4M',peRatio:48.0,'52wHigh':227.30,'52wLow':94.00,fiveMinRvol:2.78,fiveMinDelta:1950000},
            {symbol:'NFLX',name:'Netflix Inc',price:682.50,change:9.75,changePercent:1.45,sector:'Communication',marketCap:'$293B',volume:'5.6M',peRatio:41.2,'52wHigh':711.33,'52wLow':344.70,fiveMinRvol:1.92,fiveMinDelta:860000},
            {symbol:'QCOM',name:'Qualcomm Inc',price:174.60,change:-1.50,changePercent:-0.85,sector:'Technology',marketCap:'$195B',volume:'12.8M',peRatio:21.4,'52wHigh':230.63,'52wLow':104.30,fiveMinRvol:1.15,fiveMinDelta:-480000}
        ] 
    },
    NYSE: { 
        name:'NYSE', country:'USA', currency:'USD', flag:'🇺🇸', region:'Americas',
        stocks:[
            {symbol:'JPM',name:'JPMorgan Chase',price:198.50,change:2.10,changePercent:1.07,sector:'Financials',marketCap:'$568B',volume:'14.8M',peRatio:11.8,'52wHigh':217.40,'52wLow':140.20,fiveMinRvol:1.65,fiveMinDelta:1240000},
            {symbol:'V',name:'Visa Inc.',price:274.30,change:-1.20,changePercent:-0.44,sector:'Financials',marketCap:'$562B',volume:'8.9M',peRatio:29.5,'52wHigh':290.96,'52wLow':227.70,fiveMinRvol:1.20,fiveMinDelta:-350000},
            {symbol:'WMT',name:'Walmart Inc',price:67.80,change:0.90,changePercent:1.35,sector:'Consumer Staples',marketCap:'$545B',volume:'22.4M',peRatio:28.4,'52wHigh':71.30,'52wLow':49.80,fiveMinRvol:1.75,fiveMinDelta:920000},
            {symbol:'UNH',name:'UnitedHealth Group',price:492.10,change:5.60,changePercent:1.15,sector:'Healthcare',marketCap:'$452B',volume:'5.2M',peRatio:21.0,'52wHigh':558.10,'52wLow':436.40,fiveMinRvol:1.55,fiveMinDelta:780000},
            {symbol:'DIS',name:'Walt Disney Co',price:98.50,change:1.20,changePercent:1.23,sector:'Communication',marketCap:'$179B',volume:'12.4M',peRatio:36.8,'52wHigh':123.74,'52wLow':78.70,fiveMinRvol:1.40,fiveMinDelta:540000},
            {symbol:'BRK.A',name:'Berkshire Hathaway',price:685400.00,change:4420.00,changePercent:0.65,sector:'Financials',marketCap:'$984B',volume:'2.1K',peRatio:19.8,'52wHigh':720000.00,'52wLow':515000.00,fiveMinRvol:1.10,fiveMinDelta:320000},
            {symbol:'LLY',name:'Eli Lilly & Co',price:912.40,change:20.90,changePercent:2.34,sector:'Healthcare',marketCap:'$867B',volume:'6.8M',peRatio:88.5,'52wHigh':972.50,'52wLow':516.20,fiveMinRvol:2.65,fiveMinDelta:2450000},
            {symbol:'XOM',name:'Exxon Mobil Corp',price:116.80,change:-0.65,changePercent:-0.55,sector:'Energy',marketCap:'$464B',volume:'18.2M',peRatio:13.5,'52wHigh':126.34,'52wLow':95.80,fiveMinRvol:1.25,fiveMinDelta:-410000},
            {symbol:'MA',name:'Mastercard Inc',price:478.20,change:3.90,changePercent:0.82,sector:'Financials',marketCap:'$444B',volume:'4.8M',peRatio:34.2,'52wHigh':495.00,'52wLow':363.00,fiveMinRvol:1.35,fiveMinDelta:620000},
            {symbol:'JNJ',name:'Johnson & Johnson',price:162.40,change:0.75,changePercent:0.45,sector:'Healthcare',marketCap:'$391B',volume:'10.4M',peRatio:16.8,'52wHigh':175.90,'52wLow':143.10,fiveMinRvol:1.15,fiveMinDelta:290000},
            {symbol:'PG',name:'Procter & Gamble',price:168.90,change:1.20,changePercent:0.72,sector:'Consumer Staples',marketCap:'$397B',volume:'9.1M',peRatio:26.4,'52wHigh':177.94,'52wLow':141.40,fiveMinRvol:1.30,fiveMinDelta:450000},
            {symbol:'HD',name:'Home Depot',price:374.50,change:4.15,changePercent:1.12,sector:'Consumer Discretionary',marketCap:'$372B',volume:'6.4M',peRatio:24.8,'52wHigh':395.20,'52wLow':274.30,fiveMinRvol:1.48,fiveMinDelta:580000},
            {symbol:'BAC',name:'Bank of America',price:39.80,change:0.38,changePercent:0.95,sector:'Financials',marketCap:'$312B',volume:'38.5M',peRatio:13.2,'52wHigh':44.44,'52wLow':24.90,fiveMinRvol:1.60,fiveMinDelta:1150000},
            {symbol:'CVX',name:'Chevron Corp',price:148.60,change:-1.15,changePercent:-0.78,sector:'Energy',marketCap:'$274B',volume:'12.1M',peRatio:12.8,'52wHigh':167.10,'52wLow':139.60,fiveMinRvol:1.18,fiveMinDelta:-380000},
            {symbol:'ORCL',name:'Oracle Corp',price:168.50,change:4.65,changePercent:2.85,sector:'Technology',marketCap:'$465B',volume:'16.4M',peRatio:38.9,'52wHigh':175.00,'52wLow':99.30,fiveMinRvol:2.95,fiveMinDelta:1950000}
        ] 
    },
    LSE: { 
        name:'LSE', country:'UK', currency:'GBP', flag:'🇬🇧', region:'Europe',
        stocks:[
            {symbol:'AZN.L',name:'AstraZeneca',price:122.40,change:1.80,changePercent:1.49,sector:'Healthcare',marketCap:'£189B',volume:'3.4M',peRatio:38.2,'52wHigh':133.50,'52wLow':97.60,fiveMinRvol:1.85,fiveMinDelta:820000},
            {symbol:'SHEL.L',name:'Shell PLC',price:27.85,change:-0.22,changePercent:-0.78,sector:'Energy',marketCap:'£178B',volume:'14.8M',peRatio:11.4,'52wHigh':29.60,'52wLow':23.20,fiveMinRvol:1.35,fiveMinDelta:-450000},
            {symbol:'HSBA.L',name:'HSBC Holdings',price:6.88,change:0.04,changePercent:0.61,sector:'Financials',marketCap:'£128B',volume:'28.5M',peRatio:6.8,'52wHigh':7.20,'52wLow':5.60,fiveMinRvol:1.55,fiveMinDelta:740000},
            {symbol:'ULVR.L',name:'Unilever PLC',price:43.50,change:0.35,changePercent:0.81,sector:'Consumer Staples',marketCap:'£108B',volume:'5.2M',peRatio:19.5,'52wHigh':45.80,'52wLow':36.80,fiveMinRvol:1.20,fiveMinDelta:380000},
            {symbol:'BP.L',name:'BP PLC',price:4.78,change:-0.03,changePercent:-0.64,sector:'Energy',marketCap:'£78.4B',volume:'32.1M',peRatio:10.8,'52wHigh':5.60,'52wLow':4.40,fiveMinRvol:1.40,fiveMinDelta:-320000},
            {symbol:'GSK.L',name:'GSK PLC',price:16.40,change:0.15,changePercent:0.92,sector:'Healthcare',marketCap:'£67.2B',volume:'8.4M',peRatio:14.2,'52wHigh':18.20,'52wLow':13.80,fiveMinRvol:1.30,fiveMinDelta:410000},
            {symbol:'RIO.L',name:'Rio Tinto PLC',price:49.80,change:1.05,changePercent:2.15,sector:'Materials',marketCap:'£62.4B',volume:'4.8M',peRatio:10.5,'52wHigh':58.50,'52wLow':46.20,fiveMinRvol:2.10,fiveMinDelta:680000},
            {symbol:'BATS.L',name:'British American Tobacco',price:27.60,change:0.12,changePercent:0.45,sector:'Consumer Staples',marketCap:'£61.8B',volume:'6.2M',peRatio:7.2,'52wHigh':29.40,'52wLow':22.10,fiveMinRvol:1.10,fiveMinDelta:190000},
            {symbol:'BARC.L',name:'Barclays PLC',price:2.28,change:0.04,changePercent:1.75,sector:'Financials',marketCap:'£34.5B',volume:'45.2M',peRatio:5.8,'52wHigh':2.45,'52wLow':1.38,fiveMinRvol:1.95,fiveMinDelta:920000},
            {symbol:'LSEG.L',name:'London Stock Exchange Group',price:98.60,change:1.15,changePercent:1.20,sector:'Financials',marketCap:'£52.1B',volume:'1.8M',peRatio:28.4,'52wHigh':104.50,'52wLow':79.20,fiveMinRvol:1.45,fiveMinDelta:310000}
        ] 
    },
    XETRA: { 
        name:'XETRA', country:'Germany', currency:'EUR', flag:'🇩🇪', region:'Europe',
        stocks:[
            {symbol:'SAP.DE',name:'SAP SE',price:182.40,change:2.60,changePercent:1.45,sector:'Technology',marketCap:'€224B',volume:'4.8M',peRatio:32.5,'52wHigh':196.20,'52wLow':120.40,fiveMinRvol:2.15,fiveMinDelta:980000},
            {symbol:'SIE.DE',name:'Siemens AG',price:174.20,change:1.80,changePercent:1.04,sector:'Industrials',marketCap:'€138B',volume:'3.2M',peRatio:16.8,'52wHigh':188.40,'52wLow':128.20,fiveMinRvol:1.55,fiveMinDelta:620000},
            {symbol:'ALV.DE',name:'Allianz SE',price:265.80,change:-0.90,changePercent:-0.34,sector:'Financials',marketCap:'€104B',volume:'2.1M',peRatio:10.5,'52wHigh':278.00,'52wLow':210.50,fiveMinRvol:1.15,fiveMinDelta:-150000},
            {symbol:'AIR.DE',name:'Airbus SE',price:158.30,change:3.10,changePercent:2.00,sector:'Industrials',marketCap:'€124B',volume:'2.8M',peRatio:28.4,'52wHigh':172.50,'52wLow':125.00,fiveMinRvol:2.45,fiveMinDelta:850000},
            {symbol:'DTG.DE',name:'Daimler Truck',price:37.40,change:0.45,changePercent:1.22,sector:'Industrials',marketCap:'€30.8B',volume:'3.9M',peRatio:8.9,'52wHigh':47.60,'52wLow':28.50,fiveMinRvol:1.40,fiveMinDelta:260000},
            {symbol:'BMW.DE',name:'BMW AG',price:84.60,change:1.30,changePercent:1.55,sector:'Consumer Discretionary',marketCap:'€54.2B',volume:'2.4M',peRatio:5.8,'52wHigh':115.00,'52wLow':77.20,fiveMinRvol:1.75,fiveMinDelta:420000},
            {symbol:'MBG.DE',name:'Mercedes-Benz Group',price:62.80,change:0.75,changePercent:1.25,sector:'Consumer Discretionary',marketCap:'€66.5B',volume:'4.1M',peRatio:5.4,'52wHigh':77.40,'52wLow':56.20,fiveMinRvol:1.60,fiveMinDelta:390000},
            {symbol:'DTE.DE',name:'Deutsche Telekom',price:24.80,change:0.20,changePercent:0.85,sector:'Communication',marketCap:'€123B',volume:'12.8M',peRatio:15.2,'52wHigh':26.20,'52wLow':19.80,fiveMinRvol:1.30,fiveMinDelta:540000},
            {symbol:'BAS.DE',name:'BASF SE',price:45.20,change:-0.42,changePercent:-0.92,sector:'Materials',marketCap:'€40.2B',volume:'3.8M',peRatio:14.8,'52wHigh':54.90,'52wLow':41.20,fiveMinRvol:1.20,fiveMinDelta:-280000},
            {symbol:'BAYN.DE',name:'Bayer AG',price:27.40,change:-0.52,changePercent:-1.85,sector:'Healthcare',marketCap:'€26.8B',volume:'6.4M',peRatio:12.1,'52wHigh':46.50,'52wLow':25.00,fiveMinRvol:1.50,fiveMinDelta:-410000}
        ] 
    },
    TSE: { 
        name:'TSE', country:'Canada', currency:'CAD', flag:'🇨🇦', region:'Americas',
        stocks:[
            {symbol:'RY.TO',name:'Royal Bank of Canada',price:146.20,change:1.10,changePercent:0.76,sector:'Financials',marketCap:'C$206B',volume:'4.8M',peRatio:12.8,'52wHigh':154.00,'52wLow':118.00,fiveMinRvol:1.40,fiveMinDelta:420000},
            {symbol:'TD.TO',name:'TD Bank',price:75.80,change:-0.40,changePercent:-0.52,sector:'Financials',marketCap:'C$134B',volume:'7.2M',peRatio:10.4,'52wHigh':89.50,'52wLow':73.20,fiveMinRvol:1.25,fiveMinDelta:-210000},
            {symbol:'SHOP.TO',name:'Shopify Inc',price:92.40,change:3.80,changePercent:4.29,sector:'Technology',marketCap:'C$118B',volume:'9.8M',peRatio:68.2,'52wHigh':120.00,'52wLow':65.00,fiveMinRvol:3.85,fiveMinDelta:1850000},
            {symbol:'ENB.TO',name:'Enbridge Inc',price:49.60,change:0.30,changePercent:0.61,sector:'Energy',marketCap:'C$105B',volume:'8.4M',peRatio:17.5,'52wHigh':52.80,'52wLow':43.20,fiveMinRvol:1.35,fiveMinDelta:320000},
            {symbol:'CNR.TO',name:'CN Rail',price:162.50,change:1.20,changePercent:0.74,sector:'Industrials',marketCap:'C$104B',volume:'2.1M',peRatio:19.8,'52wHigh':178.50,'52wLow':144.00,fiveMinRvol:1.20,fiveMinDelta:280000},
            {symbol:'BNS.TO',name:'Bank of Nova Scotia',price:65.40,change:0.30,changePercent:0.45,sector:'Financials',marketCap:'C$79.8B',volume:'5.6M',peRatio:10.2,'52wHigh':72.00,'52wLow':56.00,fiveMinRvol:1.15,fiveMinDelta:190000},
            {symbol:'BMO.TO',name:'Bank of Montreal',price:118.20,change:0.75,changePercent:0.65,sector:'Financials',marketCap:'C$85.4B',volume:'3.4M',peRatio:11.5,'52wHigh':132.00,'52wLow':104.00,fiveMinRvol:1.25,fiveMinDelta:260000},
            {symbol:'SU.TO',name:'Suncor Energy',price:52.80,change:0.60,changePercent:1.15,sector:'Energy',marketCap:'C$68.2B',volume:'7.8M',peRatio:9.2,'52wHigh':57.40,'52wLow':40.80,fiveMinRvol:1.65,fiveMinDelta:480000},
            {symbol:'TRI.TO',name:'Thomson Reuters',price:224.00,change:3.00,changePercent:1.35,sector:'Industrials',marketCap:'C$102B',volume:'1.2M',peRatio:38.5,'52wHigh':235.00,'52wLow':172.00,fiveMinRvol:1.45,fiveMinDelta:360000},
            {symbol:'BAM.TO',name:'Brookfield Asset Mgmt',price:54.80,change:1.12,changePercent:2.10,sector:'Financials',marketCap:'C$88.4B',volume:'4.1M',peRatio:24.8,'52wHigh':58.00,'52wLow':41.00,fiveMinRvol:2.10,fiveMinDelta:590000}
        ] 
    },
    HKEX: { 
        name:'HKEX', country:'Hong Kong', currency:'HKD', flag:'🇭🇰', region:'APAC',
        stocks:[
            {symbol:'0700.HK',name:'Tencent Holdings',price:382.40,change:6.80,changePercent:1.81,sector:'Communication',marketCap:'HK$3.58T',volume:'24.5M',peRatio:22.4,'52wHigh':412.00,'52wLow':260.00,fiveMinRvol:2.40,fiveMinDelta:2450000},
            {symbol:'9988.HK',name:'Alibaba Group',price:78.50,change:-1.20,changePercent:-1.51,sector:'Consumer Discretionary',marketCap:'HK$1.52T',volume:'42.8M',peRatio:12.8,'52wHigh':89.50,'52wLow':65.20,fiveMinRvol:1.80,fiveMinDelta:-1200000},
            {symbol:'1299.HK',name:'AIA Group',price:56.80,change:0.90,changePercent:1.61,sector:'Financials',marketCap:'HK$638B',volume:'28.4M',peRatio:18.5,'52wHigh':74.20,'52wLow':46.80,fiveMinRvol:1.95,fiveMinDelta:820000},
            {symbol:'3690.HK',name:'Meituan',price:118.20,change:4.10,changePercent:3.59,sector:'Consumer Discretionary',marketCap:'HK$734B',volume:'36.5M',peRatio:26.8,'52wHigh':136.00,'52wLow':62.00,fiveMinRvol:3.45,fiveMinDelta:2150000},
            {symbol:'0941.HK',name:'China Mobile',price:75.10,change:0.40,changePercent:0.54,sector:'Communication',marketCap:'HK$1.60T',volume:'18.2M',peRatio:10.4,'52wHigh':78.50,'52wLow':61.00,fiveMinRvol:1.25,fiveMinDelta:450000},
            {symbol:'9618.HK',name:'JD.com Inc',price:104.20,change:2.50,changePercent:2.45,sector:'Consumer Discretionary',marketCap:'HK$328B',volume:'14.8M',peRatio:11.2,'52wHigh':138.00,'52wLow':85.00,fiveMinRvol:2.35,fiveMinDelta:780000},
            {symbol:'1810.HK',name:'Xiaomi Corp',price:18.60,change:0.75,changePercent:4.14,sector:'Technology',marketCap:'HK$465B',volume:'68.4M',peRatio:24.5,'52wHigh':20.50,'52wLow':11.20,fiveMinRvol:3.80,fiveMinDelta:3200000},
            {symbol:'2318.HK',name:'Ping An Insurance HK',price:38.40,change:0.70,changePercent:1.85,sector:'Financials',marketCap:'HK$700B',volume:'22.1M',peRatio:7.2,'52wHigh':46.00,'52wLow':31.00,fiveMinRvol:1.75,fiveMinDelta:680000},
            {symbol:'0388.HK',name:'Hong Kong Exchanges',price:245.60,change:3.00,changePercent:1.25,sector:'Financials',marketCap:'HK$311B',volume:'4.8M',peRatio:26.4,'52wHigh':310.00,'52wLow':215.00,fiveMinRvol:1.60,fiveMinDelta:520000},
            {symbol:'9888.HK',name:'Baidu Inc',price:86.40,change:1.20,changePercent:1.40,sector:'Technology',marketCap:'HK$242B',volume:'8.5M',peRatio:12.1,'52wHigh':120.00,'52wLow':78.00,fiveMinRvol:1.55,fiveMinDelta:410000}
        ] 
    },
    TADAWUL: { 
        name:'Tadawul', country:'Saudi Arabia', currency:'SAR', flag:'🇸🇦', region:'Middle East',
        stocks:[
            {symbol:'2222.SR',name:'Saudi Aramco',price:28.15,change:0.25,changePercent:0.90,sector:'Energy',marketCap:'SAR 6.81T',volume:'24.8M',peRatio:15.2,'52wHigh':34.50,'52wLow':27.00,fiveMinRvol:1.55,fiveMinDelta:1850000},
            {symbol:'1120.SR',name:'Al Rajhi Bank',price:84.50,change:1.20,changePercent:1.44,sector:'Financials',marketCap:'SAR 338B',volume:'8.4M',peRatio:18.4,'52wHigh':92.00,'52wLow':68.00,fiveMinRvol:1.85,fiveMinDelta:860000},
            {symbol:'2010.SR',name:'SABIC',price:76.80,change:-0.60,changePercent:-0.77,sector:'Materials',marketCap:'SAR 230B',volume:'3.2M',peRatio:24.5,'52wHigh':89.00,'52wLow':72.00,fiveMinRvol:1.20,fiveMinDelta:-240000},
            {symbol:'1180.SR',name:'Saudi National Bank',price:38.40,change:0.50,changePercent:1.32,sector:'Financials',marketCap:'SAR 230B',volume:'9.8M',peRatio:11.8,'52wHigh':44.50,'52wLow':32.80,fiveMinRvol:1.60,fiveMinDelta:540000},
            {symbol:'7010.SR',name:'Saudi Telecom (STC)',price:40.20,change:0.35,changePercent:0.85,sector:'Communication',marketCap:'SAR 201B',volume:'4.5M',peRatio:15.6,'52wHigh':43.50,'52wLow':36.00,fiveMinRvol:1.30,fiveMinDelta:290000},
            {symbol:'2020.SR',name:'SABIC Agri-Nutrients',price:118.40,change:1.35,changePercent:1.15,sector:'Materials',marketCap:'SAR 56.4B',volume:'1.8M',peRatio:16.2,'52wHigh':136.00,'52wLow':108.00,fiveMinRvol:1.45,fiveMinDelta:310000},
            {symbol:'1010.SR',name:'Riyad Bank',price:27.60,change:0.20,changePercent:0.72,sector:'Financials',marketCap:'SAR 82.8B',volume:'5.4M',peRatio:10.4,'52wHigh':32.00,'52wLow':25.00,fiveMinRvol:1.25,fiveMinDelta:220000},
            {symbol:'1211.SR',name:'Maaden (Saudi Mining)',price:48.50,change:1.35,changePercent:2.85,sector:'Materials',marketCap:'SAR 178B',volume:'6.8M',peRatio:32.1,'52wHigh':56.00,'52wLow':38.50,fiveMinRvol:2.65,fiveMinDelta:920000},
            {symbol:'2082.SR',name:'ACWA Power',price:412.00,change:13.80,changePercent:3.45,sector:'Utilities',marketCap:'SAR 301B',volume:'2.1M',peRatio:82.0,'52wHigh':495.00,'52wLow':190.00,fiveMinRvol:3.10,fiveMinDelta:1450000},
            {symbol:'2380.SR',name:'Rabigh Refining',price:8.92,change:0.08,changePercent:0.90,sector:'Energy',marketCap:'SAR 14.9B',volume:'12.1M',peRatio:18.5,'52wHigh':11.50,'52wLow':7.40,fiveMinRvol:1.35,fiveMinDelta:180000}
        ] 
    },
    NSE: { 
        name:'NSE', country:'India', currency:'INR', flag:'🇮🇳', region:'APAC',
        stocks:[
            {symbol:'RELIANCE',name:'Reliance Industries',price:2940.50,change:35.20,changePercent:1.21,sector:'Energy',marketCap:'₹19.9T',volume:'12.8M',peRatio:26.4,'52wHigh':3217.90,'52wLow':2221.00,fiveMinRvol:1.85,fiveMinDelta:1650000},
            {symbol:'TCS',name:'Tata Consultancy',price:3820.00,change:-18.50,changePercent:-0.48,sector:'Technology',marketCap:'₹13.8T',volume:'3.4M',peRatio:29.5,'52wHigh':4592.00,'52wLow':3312.00,fiveMinRvol:1.15,fiveMinDelta:-280000},
            {symbol:'HDFCBANK',name:'HDFC Bank',price:1540.80,change:12.40,changePercent:0.81,sector:'Financials',marketCap:'₹11.7T',volume:'18.5M',peRatio:18.2,'52wHigh':1794.00,'52wLow':1363.00,fiveMinRvol:1.50,fiveMinDelta:820000},
            {symbol:'INFY',name:'Infosys Ltd',price:1495.00,change:22.10,changePercent:1.50,sector:'Technology',marketCap:'₹6.20T',volume:'9.8M',peRatio:24.1,'52wHigh':1991.00,'52wLow':1358.00,fiveMinRvol:2.10,fiveMinDelta:950000},
            {symbol:'ICICI',name:'ICICI Bank',price:1125.40,change:8.60,changePercent:0.77,sector:'Financials',marketCap:'₹7.90T',volume:'15.2M',peRatio:17.5,'52wHigh':1300.00,'52wLow':913.00,fiveMinRvol:1.45,fiveMinDelta:640000},
            {symbol:'BHARTIARTL',name:'Bharti Airtel',price:1420.00,change:29.80,changePercent:2.15,sector:'Communication',marketCap:'₹8.10T',volume:'8.4M',peRatio:52.0,'52wHigh':1540.00,'52wLow':890.00,fiveMinRvol:2.45,fiveMinDelta:1150000},
            {symbol:'SBIN',name:'State Bank of India',price:842.50,change:11.20,changePercent:1.35,sector:'Financials',marketCap:'₹7.51T',volume:'22.4M',peRatio:11.2,'52wHigh':912.00,'52wLow':555.00,fiveMinRvol:1.90,fiveMinDelta:1320000},
            {symbol:'ITC',name:'ITC Limited',price:432.00,change:2.80,changePercent:0.65,sector:'Consumer Staples',marketCap:'₹5.39T',volume:'14.1M',peRatio:26.8,'52wHigh':499.00,'52wLow':399.00,fiveMinRvol:1.20,fiveMinDelta:320000},
            {symbol:'LT',name:'Larsen & Toubro',price:3580.00,change:63.20,changePercent:1.80,sector:'Industrials',marketCap:'₹4.92T',volume:'4.2M',peRatio:36.4,'52wHigh':3919.00,'52wLow':2860.00,fiveMinRvol:2.15,fiveMinDelta:890000},
            {symbol:'HINDUNILVR',name:'Hindustan Unilever',price:2480.00,change:11.00,changePercent:0.45,sector:'Consumer Staples',marketCap:'₹5.83T',volume:'2.8M',peRatio:56.2,'52wHigh':2769.00,'52wLow':2172.00,fiveMinRvol:1.10,fiveMinDelta:210000}
        ] 
    },
    ASX: { 
        name:'ASX', country:'Australia', currency:'AUD', flag:'🇦🇺', region:'APAC',
        stocks:[
            {symbol:'BHP.AX',name:'BHP Group',price:43.80,change:0.65,changePercent:1.51,sector:'Materials',marketCap:'A$222B',volume:'11.4M',peRatio:12.4,'52wHigh':49.80,'52wLow':38.80,fiveMinRvol:1.85,fiveMinDelta:920000},
            {symbol:'CBA.AX',name:'Commonwealth Bank',price:121.50,change:1.80,changePercent:1.50,sector:'Financials',marketCap:'A$203B',volume:'3.8M',peRatio:20.5,'52wHigh':144.00,'52wLow':96.00,fiveMinRvol:1.75,fiveMinDelta:780000},
            {symbol:'CSL.AX',name:'CSL Limited',price:292.40,change:-2.10,changePercent:-0.71,sector:'Healthcare',marketCap:'A$141B',volume:'1.8M',peRatio:38.2,'52wHigh':312.00,'52wLow':228.00,fiveMinRvol:1.20,fiveMinDelta:-240000},
            {symbol:'NAB.AX',name:'NAB',price:34.60,change:0.35,changePercent:1.02,sector:'Financials',marketCap:'A$108B',volume:'6.8M',peRatio:14.5,'52wHigh':39.20,'52wLow':27.80,fiveMinRvol:1.50,fiveMinDelta:460000},
            {symbol:'WDS.AX',name:'Woodside Energy',price:26.90,change:-0.40,changePercent:-1.47,sector:'Energy',marketCap:'A$51.0B',volume:'8.5M',peRatio:11.2,'52wHigh':36.40,'52wLow':25.00,fiveMinRvol:1.35,fiveMinDelta:-320000},
            {symbol:'WBC.AX',name:'Westpac Banking',price:26.80,change:0.23,changePercent:0.85,sector:'Financials',marketCap:'A$93.5B',volume:'7.2M',peRatio:13.1,'52wHigh':32.50,'52wLow':20.80,fiveMinRvol:1.40,fiveMinDelta:390000},
            {symbol:'ANZ.AX',name:'ANZ Group Holdings',price:28.90,change:0.27,changePercent:0.95,sector:'Financials',marketCap:'A$86.8B',volume:'6.4M',peRatio:12.2,'52wHigh':31.80,'52wLow':23.60,fiveMinRvol:1.35,fiveMinDelta:360000},
            {symbol:'FMG.AX',name:'Fortescue Metals',price:21.40,change:0.60,changePercent:2.85,sector:'Materials',marketCap:'A$65.8B',volume:'14.2M',peRatio:8.5,'52wHigh':29.80,'52wLow':17.80,fiveMinRvol:2.65,fiveMinDelta:980000},
            {symbol:'MQG.AX',name:'Macquarie Group',price:194.50,change:2.40,changePercent:1.25,sector:'Financials',marketCap:'A$74.2B',volume:'1.4M',peRatio:21.0,'52wHigh':226.00,'52wLow':158.00,fiveMinRvol:1.60,fiveMinDelta:420000},
            {symbol:'TLS.AX',name:'Telstra Group',price:3.82,change:0.02,changePercent:0.55,sector:'Communication',marketCap:'A$44.1B',volume:'24.8M',peRatio:22.4,'52wHigh':4.15,'52wLow':3.55,fiveMinRvol:1.15,fiveMinDelta:210000}
        ] 
    },
    SIX: { 
        name:'SIX Swiss', country:'Switzerland', currency:'CHF', flag:'🇨🇭', region:'Europe',
        stocks:[
            {symbol:'NESN.SW',name:'Nestlé SA',price:94.80,change:-0.50,changePercent:-0.52,sector:'Consumer Staples',marketCap:'CHF 251B',volume:'4.8M',peRatio:21.8,'52wHigh':108.50,'52wLow':88.00,fiveMinRvol:1.15,fiveMinDelta:-220000},
            {symbol:'NOVN.SW',name:'Novartis AG',price:92.40,change:1.10,changePercent:1.20,sector:'Healthcare',marketCap:'CHF 188B',volume:'3.8M',peRatio:15.4,'52wHigh':102.40,'52wLow':82.50,fiveMinRvol:1.65,fiveMinDelta:580000},
            {symbol:'ROG.SW',name:'Roche Holding',price:232.00,change:2.80,changePercent:1.22,sector:'Healthcare',marketCap:'CHF 185B',volume:'2.1M',peRatio:16.2,'52wHigh':278.00,'52wLow':214.00,fiveMinRvol:1.70,fiveMinDelta:610000},
            {symbol:'UBSG.SW',name:'UBS Group AG',price:27.40,change:0.45,changePercent:1.67,sector:'Financials',marketCap:'CHF 92.4B',volume:'14.8M',peRatio:14.5,'52wHigh':29.20,'52wLow':20.40,fiveMinRvol:2.15,fiveMinDelta:820000},
            {symbol:'ABBN.SW',name:'ABB Ltd',price:48.90,change:0.70,changePercent:1.45,sector:'Industrials',marketCap:'CHF 91.2B',volume:'3.9M',peRatio:24.8,'52wHigh':52.40,'52wLow':31.80,fiveMinRvol:1.90,fiveMinDelta:540000},
            {symbol:'ZURN.SW',name:'Zurich Insurance',price:478.00,change:4.00,changePercent:0.85,sector:'Financials',marketCap:'CHF 69.8B',volume:'850K',peRatio:12.8,'52wHigh':504.00,'52wLow':410.00,fiveMinRvol:1.35,fiveMinDelta:320000},
            {symbol:'CFR.SW',name:'Richemont (Cartier)',price:142.50,change:3.00,changePercent:2.15,sector:'Consumer Discretionary',marketCap:'CHF 82.4B',volume:'1.9M',peRatio:22.4,'52wHigh':158.00,'52wLow':102.00,fiveMinRvol:2.45,fiveMinDelta:680000},
            {symbol:'SREN.SW',name:'Swiss Re',price:112.40,change:0.72,changePercent:0.65,sector:'Financials',marketCap:'CHF 32.5B',volume:'1.2M',peRatio:10.4,'52wHigh':119.50,'52wLow':92.00,fiveMinRvol:1.20,fiveMinDelta:190000},
            {symbol:'GIVN.SW',name:'Givaudan SA',price:4120.00,change:38.80,changePercent:0.95,sector:'Materials',marketCap:'CHF 38.0B',volume:'120K',peRatio:38.2,'52wHigh':4450.00,'52wLow':2890.00,fiveMinRvol:1.40,fiveMinDelta:280000},
            {symbol:'LONN.SW',name:'Lonza Group',price:524.00,change:9.25,changePercent:1.80,sector:'Healthcare',marketCap:'CHF 39.2B',volume:'450K',peRatio:42.0,'52wHigh':568.00,'52wLow':312.00,fiveMinRvol:2.20,fiveMinDelta:510000}
        ] 
    },
    BM: { 
        name:'BME', country:'Spain', currency:'EUR', flag:'🇪🇸', region:'Europe',
        stocks:[
            {symbol:'SAN.MC',name:'Banco Santander',price:4.58,change:0.06,changePercent:1.33,sector:'Financials',marketCap:'€72.4B',volume:'38.4M',peRatio:6.5,'52wHigh':4.92,'52wLow':3.35,fiveMinRvol:1.75,fiveMinDelta:890000},
            {symbol:'ITX.MC',name:'Inditex (Zara)',price:46.20,change:0.80,changePercent:1.76,sector:'Consumer Discretionary',marketCap:'€144B',volume:'4.8M',peRatio:24.5,'52wHigh':49.80,'52wLow':33.20,fiveMinRvol:2.15,fiveMinDelta:920000},
            {symbol:'BBVA.MC',name:'BBVA',price:10.15,change:-0.08,changePercent:-0.78,sector:'Financials',marketCap:'€59.8B',volume:'22.1M',peRatio:6.8,'52wHigh':11.20,'52wLow':7.10,fiveMinRvol:1.30,fiveMinDelta:-310000},
            {symbol:'IBE.MC',name:'Iberdrola',price:12.10,change:0.15,changePercent:1.26,sector:'Utilities',marketCap:'€78.2B',volume:'14.8M',peRatio:14.8,'52wHigh':12.80,'52wLow':10.20,fiveMinRvol:1.60,fiveMinDelta:520000},
            {symbol:'TEF.MC',name:'Telefónica',price:4.12,change:0.02,changePercent:0.49,sector:'Communication',marketCap:'€23.6B',volume:'18.2M',peRatio:11.2,'52wHigh':4.45,'52wLow':3.50,fiveMinRvol:1.15,fiveMinDelta:160000},
            {symbol:'REP.MC',name:'Repsol SA',price:14.80,change:-0.13,changePercent:-0.85,sector:'Energy',marketCap:'€18.4B',volume:'8.9M',peRatio:5.4,'52wHigh':16.20,'52wLow':12.80,fiveMinRvol:1.25,fiveMinDelta:-190000},
            {symbol:'AMS.MC',name:'Amadeus IT Group',price:64.20,change:0.88,changePercent:1.40,sector:'Technology',marketCap:'€28.9B',volume:'2.1M',peRatio:24.8,'52wHigh':68.40,'52wLow':51.20,fiveMinRvol:1.70,fiveMinDelta:380000},
            {symbol:'CABK.MC',name:'CaixaBank',price:4.95,change:0.06,changePercent:1.15,sector:'Financials',marketCap:'€36.4B',volume:'19.5M',peRatio:7.2,'52wHigh':5.40,'52wLow':3.60,fiveMinRvol:1.55,fiveMinDelta:420000},
            {symbol:'FER.MC',name:'Ferrovial',price:36.80,change:0.60,changePercent:1.65,sector:'Industrials',marketCap:'€26.8B',volume:'1.8M',peRatio:28.5,'52wHigh':39.50,'52wLow':27.00,fiveMinRvol:1.80,fiveMinDelta:340000},
            {symbol:'ELE.MC',name:'Endesa',price:19.40,change:0.14,changePercent:0.75,sector:'Utilities',marketCap:'€20.5B',volume:'3.2M',peRatio:13.4,'52wHigh':20.80,'52wLow':16.50,fiveMinRvol:1.20,fiveMinDelta:180000}
        ] 
    },
    EURONEXT: { 
        name:'Euronext', country:'Europe', currency:'EUR', flag:'🇪🇺', region:'Europe',
        stocks:[
            {symbol:'ASML',name:'ASML Holding',price:784.00,change:21.80,changePercent:2.85,sector:'Technology',marketCap:'€312B',volume:'2.4M',peRatio:42.5,'52wHigh':1020.00,'52wLow':560.00,fiveMinRvol:3.10,fiveMinDelta:2450000},
            {symbol:'MC.PA',name:'LVMH Moët Hennessy',price:685.00,change:11.10,changePercent:1.65,sector:'Consumer Discretionary',marketCap:'€342B',volume:'1.2M',peRatio:24.1,'52wHigh':885.00,'52wLow':620.00,fiveMinRvol:2.15,fiveMinDelta:1420000},
            {symbol:'TTE.PA',name:'TotalEnergies SE',price:63.40,change:-0.42,changePercent:-0.65,sector:'Energy',marketCap:'€148B',volume:'8.5M',peRatio:7.4,'52wHigh':70.20,'52wLow':55.80,fiveMinRvol:1.25,fiveMinDelta:-390000},
            {symbol:'RMS.PA',name:'Hermès International',price:2150.00,change:38.00,changePercent:1.80,sector:'Consumer Discretionary',marketCap:'€226B',volume:'180K',peRatio:48.0,'52wHigh':2430.00,'52wLow':1680.00,fiveMinRvol:2.35,fiveMinDelta:980000},
            {symbol:'OR.PA',name:'L\'Oréal SA',price:412.00,change:3.05,changePercent:0.75,sector:'Consumer Staples',marketCap:'€220B',volume:'850K',peRatio:32.5,'52wHigh':460.00,'52wLow':365.00,fiveMinRvol:1.30,fiveMinDelta:420000},
            {symbol:'SAN.PA',name:'Sanofi SA',price:92.50,change:0.87,changePercent:0.95,sector:'Healthcare',marketCap:'€116B',volume:'3.8M',peRatio:18.2,'52wHigh':104.00,'52wLow':81.00,fiveMinRvol:1.45,fiveMinDelta:490000},
            {symbol:'SU.PA',name:'Schneider Electric',price:218.00,change:3.95,changePercent:1.85,sector:'Industrials',marketCap:'€122B',volume:'1.9M',peRatio:28.5,'52wHigh':242.00,'52wLow':148.00,fiveMinRvol:2.20,fiveMinDelta:760000},
            {symbol:'AI.PA',name:'Air Liquide',price:168.40,change:1.42,changePercent:0.85,sector:'Materials',marketCap:'€88.5B',volume:'1.4M',peRatio:26.4,'52wHigh':194.00,'52wLow':154.00,fiveMinRvol:1.35,fiveMinDelta:380000},
            {symbol:'EL.PA',name:'EssilorLuxottica',price:204.00,change:2.20,changePercent:1.10,sector:'Healthcare',marketCap:'€93.2B',volume:'980K',peRatio:34.0,'52wHigh':222.00,'52wLow':164.00,fiveMinRvol:1.55,fiveMinDelta:440000},
            {symbol:'BNP.PA',name:'BNP Paribas',price:64.80,change:0.92,changePercent:1.45,sector:'Financials',marketCap:'€74.5B',volume:'4.8M',peRatio:6.8,'52wHigh':71.50,'52wLow':52.00,fiveMinRvol:1.80,fiveMinDelta:620000}
        ]
    },
    TSE_JP: { 
        name:'TSE Tokyo', country:'Japan', currency:'JPY', flag:'🇯🇵', region:'APAC',
        stocks:[
            {symbol:'7203.T',name:'Toyota Motor',price:3280,change:45,changePercent:1.39,sector:'Consumer Discretionary',marketCap:'¥44.8T',volume:'28.5M',peRatio:9.8,'52wHigh':3870,'52wLow':2450,fiveMinRvol:1.90,fiveMinDelta:1420000},
            {symbol:'6758.T',name:'Sony Group',price:12850,change:210,changePercent:1.66,sector:'Consumer Discretionary',marketCap:'¥15.9T',volume:'6.4M',peRatio:16.4,'52wHigh':14500,'52wLow':11800,fiveMinRvol:2.15,fiveMinDelta:860000},
            {symbol:'9984.T',name:'SoftBank Group',price:9420,change:-150,changePercent:-1.57,sector:'Technology',marketCap:'¥13.8T',volume:'14.2M',peRatio:28.5,'52wHigh':11500,'52wLow':5800,fiveMinRvol:1.80,fiveMinDelta:-620000},
            {symbol:'8306.T',name:'Mitsubishi UFJ',price:1610,change:25,changePercent:1.58,sector:'Financials',marketCap:'¥19.4T',volume:'48.2M',peRatio:11.2,'52wHigh':1780,'52wLow':1140,fiveMinRvol:2.05,fiveMinDelta:1250000},
            {symbol:'6861.T',name:'Keyence Corp',price:68500,change:800,changePercent:1.18,sector:'Technology',marketCap:'¥16.6T',volume:'1.2M',peRatio:42.1,'52wHigh':74800,'52wLow':56200,fiveMinRvol:1.65,fiveMinDelta:540000},
            {symbol:'8035.T',name:'Tokyo Electron',price:26400,change:880,changePercent:3.45,sector:'Technology',marketCap:'¥12.4T',volume:'5.8M',peRatio:28.4,'52wHigh':39500,'52wLow':19800,fiveMinRvol:3.40,fiveMinDelta:1650000},
            {symbol:'7974.T',name:'Nintendo Co',price:8120,change:68,changePercent:0.85,sector:'Communication',marketCap:'¥9.6T',volume:'4.5M',peRatio:21.0,'52wHigh':9100,'52wLow':6200,fiveMinRvol:1.45,fiveMinDelta:380000},
            {symbol:'9432.T',name:'NTT Group',price:154.20,change:0.50,changePercent:0.35,sector:'Communication',marketCap:'¥13.2T',volume:'112M',peRatio:10.8,'52wHigh':192,'52wLow':145,fiveMinRvol:1.20,fiveMinDelta:420000},
            {symbol:'9983.T',name:'Fast Retailing (Uniqlo)',price:43800,change:900,changePercent:2.10,sector:'Consumer Discretionary',marketCap:'¥13.4T',volume:'1.8M',peRatio:38.5,'52wHigh':48200,'52wLow':33500,fiveMinRvol:2.35,fiveMinDelta:740000},
            {symbol:'6501.T',name:'Hitachi Ltd',price:3420,change:82,changePercent:2.45,sector:'Industrials',marketCap:'¥15.8T',volume:'8.9M',peRatio:24.2,'52wHigh':3850,'52wLow':2150,fiveMinRvol:2.60,fiveMinDelta:890000}
        ] 
    },
    SSE: { 
        name: 'SSE Shanghai', country: 'China', currency: 'CNY', flag: '🇨🇳', 
        stocks: [
            { symbol: '600519', name: 'Kweichow Moutai (贵州茅台)', price: 1720.50, change: 18.20, changePercent: 1.07, sector: 'Consumer Staples', marketCap: '¥2.16T', volume: '3.82M', peRatio: 29.4, '52wHigh': 1850.00, '52wLow': 1580.00 },
            { symbol: '601398', name: 'Industrial & Commercial Bank (工商银行)', price: 5.84, change: 0.05, changePercent: 0.86, sector: 'Financials', marketCap: '¥2.08T', volume: '88.4M', peRatio: 5.8, '52wHigh': 6.12, '52wLow': 4.72 },
            { symbol: '601857', name: 'PetroChina (中国石油)', price: 8.42, change: -0.12, changePercent: -1.41, sector: 'Energy', marketCap: '¥1.54T', volume: '45.1M', peRatio: 9.2, '52wHigh': 10.15, '52wLow': 7.10 },
            { symbol: '601988', name: 'Bank of China (中国银行)', price: 4.52, change: 0.03, changePercent: 0.67, sector: 'Financials', marketCap: '¥1.33T', volume: '62.0M', peRatio: 5.4, '52wHigh': 4.88, '52wLow': 3.95 },
            { symbol: '601288', name: 'Agricultural Bank of China (农业银行)', price: 4.28, change: 0.04, changePercent: 0.94, sector: 'Financials', marketCap: '¥1.50T', volume: '75.3M', peRatio: 5.6, '52wHigh': 4.55, '52wLow': 3.60 },
            { symbol: '601628', name: 'China Life Insurance (中国人寿)', price: 32.10, change: 0.85, changePercent: 2.72, sector: 'Financials', marketCap: '¥907B', volume: '18.4M', peRatio: 18.2, '52wHigh': 36.50, '52wLow': 26.10 },
            { symbol: '600036', name: 'China Merchants Bank (招商银行)', price: 34.80, change: 0.60, changePercent: 1.75, sector: 'Financials', marketCap: '¥877B', volume: '28.9M', peRatio: 6.1, '52wHigh': 38.20, '52wLow': 29.50 },
            { symbol: '600028', name: 'Sinopec Corp (中国石化)', price: 6.35, change: -0.05, changePercent: -0.78, sector: 'Energy', marketCap: '¥772B', volume: '38.5M', peRatio: 11.4, '52wHigh': 7.10, '52wLow': 5.40 },
            { symbol: '601088', name: 'China Shenhua Energy (中国神华)', price: 41.20, change: 0.95, changePercent: 2.36, sector: 'Energy', marketCap: '¥818B', volume: '14.2M', peRatio: 13.5, '52wHigh': 44.80, '52wLow': 31.20 },
            { symbol: '600900', name: 'China Yangtze Power (长江电力)', price: 29.80, change: 0.35, changePercent: 1.19, sector: 'Utilities', marketCap: '¥729B', volume: '22.1M', peRatio: 22.8, '52wHigh': 31.50, '52wLow': 22.80 },
            { symbol: '601318', name: 'Ping An Insurance SSE (中国平安)', price: 45.60, change: 1.20, changePercent: 2.70, sector: 'Financials', marketCap: '¥831B', volume: '35.4M', peRatio: 9.8, '52wHigh': 52.00, '52wLow': 37.80 },
            { symbol: '600030', name: 'CITIC Securities (中信证券)', price: 19.85, change: 0.45, changePercent: 2.32, sector: 'Financials', marketCap: '¥294B', volume: '41.2M', peRatio: 14.8, '52wHigh': 24.20, '52wLow': 17.50 },
            { symbol: '601899', name: 'Zijin Mining Group (紫金矿业)', price: 17.45, change: 0.65, changePercent: 3.87, sector: 'Materials', marketCap: '¥460B', volume: '58.9M', peRatio: 18.5, '52wHigh': 19.80, '52wLow': 11.20 },
            { symbol: '600276', name: 'Jiangsu Hengrui Pharma (恒瑞医药)', price: 42.15, change: -0.35, changePercent: -0.82, sector: 'Healthcare', marketCap: '¥268B', volume: '12.4M', peRatio: 48.2, '52wHigh': 49.80, '52wLow': 36.20 },
            { symbol: '600104', name: 'SAIC Motor Corp (上汽集团)', price: 14.85, change: 0.15, changePercent: 1.02, sector: 'Consumer Discretionary', marketCap: '¥171B', volume: '15.8M', peRatio: 12.1, '52wHigh': 17.20, '52wLow': 13.10 },
            { symbol: '601668', name: 'China State Construction (中国建筑)', price: 5.68, change: 0.08, changePercent: 1.43, sector: 'Industrials', marketCap: '¥236B', volume: '52.1M', peRatio: 4.3, '52wHigh': 6.25, '52wLow': 4.80 },
            { symbol: '600000', name: 'Shanghai Pudong Dev Bank (浦发银行)', price: 8.12, change: 0.10, changePercent: 1.25, sector: 'Financials', marketCap: '¥238B', volume: '19.4M', peRatio: 6.8, '52wHigh': 9.10, '52wLow': 6.40 },
            { symbol: '600887', name: 'Inner Mongolia Yili (伊利股份)', price: 26.40, change: -0.15, changePercent: -0.57, sector: 'Consumer Staples', marketCap: '¥168B', volume: '16.2M', peRatio: 16.2, '52wHigh': 30.50, '52wLow': 24.10 },
            { symbol: '601728', name: 'China Telecom (中国电信)', price: 6.15, change: 0.07, changePercent: 1.15, sector: 'Communication', marketCap: '¥562B', volume: '28.4M', peRatio: 17.5, '52wHigh': 6.80, '52wLow': 4.90 },
            { symbol: '600941', name: 'China Mobile SSE (中国移动)', price: 104.50, change: 1.80, changePercent: 1.75, sector: 'Communication', marketCap: '¥2.23T', volume: '9.8M', peRatio: 16.4, '52wHigh': 110.00, '52wLow': 88.00 },
            { symbol: '601138', name: 'Foxconn Industrial Internet (工业富联)', price: 24.50, change: 1.10, changePercent: 4.70, sector: 'Technology', marketCap: '¥486B', volume: '68.5M', peRatio: 21.8, '52wHigh': 28.90, '52wLow': 13.50 },
            { symbol: '601818', name: 'China Everbright Bank (光大银行)', price: 3.25, change: 0.02, changePercent: 0.62, sector: 'Financials', marketCap: '¥192B', volume: '24.1M', peRatio: 4.8, '52wHigh': 3.60, '52wLow': 2.85 },
            { symbol: '601601', name: 'China Pacific Insurance (中国太保)', price: 27.80, change: 0.55, changePercent: 2.02, sector: 'Financials', marketCap: '¥267B', volume: '11.8M', peRatio: 9.4, '52wHigh': 32.40, '52wLow': 22.10 },
            { symbol: '600438', name: 'Tongwei Co Ltd (通威股份)', price: 20.40, change: -0.60, changePercent: -2.86, sector: 'Technology', marketCap: '¥91.8B', volume: '21.5M', peRatio: 15.2, '52wHigh': 33.20, '52wLow': 18.50 },
            { symbol: '601012', name: 'LONGi Green Energy SSE (隆基绿能)', price: 16.85, change: -0.45, changePercent: -2.60, sector: 'Technology', marketCap: '¥127B', volume: '48.2M', peRatio: 19.8, '52wHigh': 29.80, '52wLow': 14.10 },
            { symbol: '601919', name: 'COSCO SHIPPING Holdings (中远海控)', price: 13.60, change: 0.42, changePercent: 3.19, sector: 'Industrials', marketCap: '¥217B', volume: '42.8M', peRatio: 8.5, '52wHigh': 15.80, '52wLow': 9.20 },
            { symbol: '600050', name: 'China Unicom (中国联通)', price: 4.88, change: 0.06, changePercent: 1.24, sector: 'Communication', marketCap: '¥155B', volume: '33.1M', peRatio: 18.1, '52wHigh': 5.60, '52wLow': 4.10 },
            { symbol: '601800', name: 'China Communications Constr (中国交建)', price: 8.95, change: 0.18, changePercent: 2.05, sector: 'Industrials', marketCap: '¥144B', volume: '19.8M', peRatio: 6.2, '52wHigh': 11.20, '52wLow': 7.60 },
            { symbol: '601390', name: 'China Railway Group (中国中铁)', price: 6.42, change: 0.09, changePercent: 1.42, sector: 'Industrials', marketCap: '¥158B', volume: '22.5M', peRatio: 4.9, '52wHigh': 7.80, '52wLow': 5.50 },
            { symbol: '601186', name: 'China Railway Construction (中国铁建)', price: 8.15, change: 0.12, changePercent: 1.49, sector: 'Industrials', marketCap: '¥110B', volume: '17.4M', peRatio: 4.2, '52wHigh': 10.10, '52wLow': 7.00 },
            { symbol: '600016', name: 'China Minsheng Banking (民生银行)', price: 3.82, change: 0.03, changePercent: 0.79, sector: 'Financials', marketCap: '¥167B', volume: '26.8M', peRatio: 4.5, '52wHigh': 4.20, '52wLow': 3.40 },
            { symbol: '600309', name: 'Wanhua Chemical (万华化学)', price: 78.50, change: 1.60, changePercent: 2.08, sector: 'Materials', marketCap: '¥246B', volume: '8.4M', peRatio: 14.6, '52wHigh': 92.00, '52wLow': 68.50 },
            { symbol: '601658', name: 'Postal Savings Bank (邮储银行)', price: 4.95, change: 0.07, changePercent: 1.43, sector: 'Financials', marketCap: '¥491B', volume: '31.2M', peRatio: 5.5, '52wHigh': 5.40, '52wLow': 4.20 },
            { symbol: '600585', name: 'Anhui Conch Cement (海螺水泥)', price: 23.40, change: 0.30, changePercent: 1.30, sector: 'Materials', marketCap: '¥124B', volume: '9.6M', peRatio: 11.2, '52wHigh': 27.50, '52wLow': 20.10 },
            { symbol: '600048', name: 'Poly Developments (保利发展)', price: 9.15, change: -0.22, changePercent: -2.35, sector: 'Real Estate', marketCap: '¥109B', volume: '36.4M', peRatio: 9.1, '52wHigh': 13.80, '52wLow': 8.20 },
            { symbol: '601766', name: 'CRRC Corporation (中国中车)', price: 7.25, change: 0.14, changePercent: 1.97, sector: 'Industrials', marketCap: '¥208B', volume: '25.6M', peRatio: 16.8, '52wHigh': 8.10, '52wLow': 5.10 },
            { symbol: '600690', name: 'Haier Smart Home (海尔智家)', price: 28.60, change: 0.45, changePercent: 1.60, sector: 'Consumer Discretionary', marketCap: '¥269B', volume: '14.2M', peRatio: 15.8, '52wHigh': 31.20, '52wLow': 20.80 },
            { symbol: '600346', name: 'Hengli Petrochemical (恒力石化)', price: 14.12, change: 0.18, changePercent: 1.29, sector: 'Energy', marketCap: '¥99.4B', volume: '7.8M', peRatio: 13.8, '52wHigh': 16.90, '52wLow': 12.00 },
            { symbol: '601939', name: 'China Construction Bank SSE (建设银行)', price: 7.42, change: 0.08, changePercent: 1.09, sector: 'Financials', marketCap: '¥1.85T', volume: '41.5M', peRatio: 5.6, '52wHigh': 7.90, '52wLow': 6.10 },
            { symbol: '600809', name: 'Shanxi Xinghuacun Fen Wine (山西汾酒)', price: 215.00, change: 3.50, changePercent: 1.65, sector: 'Consumer Staples', marketCap: '¥262B', volume: '2.8M', peRatio: 24.1, '52wHigh': 265.00, '52wLow': 185.00 },
            { symbol: '601211', name: 'Guotai Junan Securities (国泰君安)', price: 14.20, change: 0.25, changePercent: 1.79, sector: 'Financials', marketCap: '¥126B', volume: '15.4M', peRatio: 12.8, '52wHigh': 16.80, '52wLow': 13.10 },
            { symbol: '601688', name: 'Huatai Securities (华泰证券)', price: 13.85, change: 0.30, changePercent: 2.21, sector: 'Financials', marketCap: '¥125B', volume: '18.9M', peRatio: 10.9, '52wHigh': 16.50, '52wLow': 12.40 },
            { symbol: '600703', name: 'Sanan Optoelectronics (三安光电)', price: 12.10, change: -0.15, changePercent: -1.22, sector: 'Technology', marketCap: '¥60.3B', volume: '24.1M', peRatio: 65.4, '52wHigh': 16.20, '52wLow': 10.80 },
            { symbol: '600584', name: 'JCET Group (长电科技)', price: 28.90, change: 0.75, changePercent: 2.66, sector: 'Technology', marketCap: '¥51.7B', volume: '19.6M', peRatio: 34.2, '52wHigh': 34.50, '52wLow': 22.40 },
            { symbol: '688981', name: 'SMIC STAR (中芯国际)', price: 46.80, change: 1.85, changePercent: 4.12, sector: 'Technology', marketCap: '¥371B', volume: '32.4M', peRatio: 82.5, '52wHigh': 58.00, '52wLow': 38.20 },
            { symbol: '688012', name: 'AMEC STAR (中微公司)', price: 142.00, change: 4.20, changePercent: 3.05, sector: 'Technology', marketCap: '¥87.8B', volume: '4.1M', peRatio: 52.8, '52wHigh': 175.00, '52wLow': 112.00 },
            { symbol: '688008', name: 'Montage Technology STAR (澜起科技)', price: 58.40, change: 2.10, changePercent: 3.73, sector: 'Technology', marketCap: '¥66.7B', volume: '8.9M', peRatio: 61.2, '52wHigh': 69.80, '52wLow': 42.10 },
            { symbol: '688036', name: 'Appotronics STAR (光峰科技)', price: 18.20, change: 0.35, changePercent: 1.96, sector: 'Technology', marketCap: '¥8.3B', volume: '3.2M', peRatio: 42.1, '52wHigh': 26.40, '52wLow': 15.10 },
            { symbol: '688111', name: 'Kingsoft Office STAR (金山办公)', price: 268.00, change: -5.40, changePercent: -1.98, sector: 'Technology', marketCap: '¥123B', volume: '1.9M', peRatio: 92.4, '52wHigh': 340.00, '52wLow': 220.00 },
            { symbol: '688396', name: 'CR Micro STAR (华润微)', price: 38.50, change: 0.90, changePercent: 2.39, sector: 'Technology', marketCap: '¥50.9B', volume: '5.4M', peRatio: 36.8, '52wHigh': 52.10, '52wLow': 33.00 },
            { symbol: '688599', name: 'Trina Solar STAR (天合光能)', price: 18.90, change: -0.40, changePercent: -2.07, sector: 'Technology', marketCap: '¥41.2B', volume: '18.7M', peRatio: 12.4, '52wHigh': 31.50, '52wLow': 16.80 },
            { symbol: '688009', name: 'CRSC STAR (中国通号)', price: 5.42, change: 0.08, changePercent: 1.50, sector: 'Industrials', marketCap: '¥57.4B', volume: '12.1M', peRatio: 15.1, '52wHigh': 6.20, '52wLow': 4.50 },
            { symbol: '603259', name: 'WuXi AppTec (药明康德)', price: 42.80, change: -0.95, changePercent: -2.17, sector: 'Healthcare', marketCap: '¥126B', volume: '22.8M', peRatio: 13.5, '52wHigh': 78.50, '52wLow': 37.20 },
            { symbol: '600196', name: 'Fosun Pharma (复星医药)', price: 23.50, change: 0.20, changePercent: 0.86, sector: 'Healthcare', marketCap: '¥62.8B', volume: '8.4M', peRatio: 24.8, '52wHigh': 29.80, '52wLow': 21.40 },
            { symbol: '600406', name: 'NARI Tech (国电南瑞)', price: 24.10, change: 0.35, changePercent: 1.47, sector: 'Industrials', marketCap: '¥193B', volume: '11.5M', peRatio: 26.2, '52wHigh': 27.20, '52wLow': 20.80 },
            { symbol: '601166', name: 'Industrial Bank (兴业银行)', price: 16.20, change: 0.22, changePercent: 1.38, sector: 'Financials', marketCap: '¥336B', volume: '29.4M', peRatio: 4.4, '52wHigh': 17.80, '52wLow': 14.10 },
            { symbol: '601229', name: 'Bank of Shanghai (上海银行)', price: 7.45, change: 0.08, changePercent: 1.09, sector: 'Financials', marketCap: '¥105B', volume: '14.8M', peRatio: 4.6, '52wHigh': 8.10, '52wLow': 6.20 },
            { symbol: '600919', name: 'Bank of Jiangsu (江苏银行)', price: 7.85, change: 0.12, changePercent: 1.55, sector: 'Financials', marketCap: '¥144B', volume: '34.2M', peRatio: 4.8, '52wHigh': 8.30, '52wLow': 6.50 },
            { symbol: '601998', name: 'China CITIC Bank (中信银行)', price: 6.82, change: 0.09, changePercent: 1.34, sector: 'Financials', marketCap: '¥333B', volume: '18.2M', peRatio: 5.1, '52wHigh': 7.40, '52wLow': 5.20 },
            { symbol: '600019', name: 'Baoshan Iron & Steel (宝钢股份)', price: 6.55, change: 0.11, changePercent: 1.71, sector: 'Materials', marketCap: '¥143B', volume: '21.0M', peRatio: 12.1, '52wHigh': 7.20, '52wLow': 5.60 },
            { symbol: '601985', name: 'China National Nuclear Power (中国核电)', price: 9.85, change: 0.22, changePercent: 2.28, sector: 'Utilities', marketCap: '¥186B', volume: '38.4M', peRatio: 17.4, '52wHigh': 10.80, '52wLow': 7.20 },
            { symbol: '600011', name: 'Huaneng Power Intl (华能国际)', price: 8.60, change: 0.15, changePercent: 1.78, sector: 'Utilities', marketCap: '¥135B', volume: '24.1M', peRatio: 14.2, '52wHigh': 9.80, '52wLow': 7.10 },
            { symbol: '600029', name: 'China Southern Airlines (南方航空)', price: 5.82, change: 0.05, changePercent: 0.87, sector: 'Industrials', marketCap: '¥105B', volume: '18.4M', peRatio: 28.4, '52wHigh': 6.90, '52wLow': 5.20 },
            { symbol: '601111', name: 'Air China (中国国航)', price: 7.15, change: 0.08, changePercent: 1.13, sector: 'Industrials', marketCap: '¥115B', volume: '16.9M', peRatio: 31.2, '52wHigh': 8.50, '52wLow': 6.40 },
            { symbol: '600115', name: 'China Eastern Airlines (中国东航)', price: 3.85, change: 0.03, changePercent: 0.79, sector: 'Industrials', marketCap: '¥85.8B', volume: '21.4M', peRatio: 35.1, '52wHigh': 4.60, '52wLow': 3.50 },
            { symbol: '600015', name: 'Hua Xia Bank (华夏银行)', price: 6.25, change: 0.06, changePercent: 0.97, sector: 'Financials', marketCap: '¥99.4B', volume: '12.8M', peRatio: 4.1, '52wHigh': 6.80, '52wLow': 5.20 },
            { symbol: '601995', name: 'CICC (中金公司)', price: 31.40, change: 0.65, changePercent: 2.11, sector: 'Financials', marketCap: '¥151B', volume: '11.2M', peRatio: 21.8, '52wHigh': 39.50, '52wLow': 28.00 },
            { symbol: '600150', name: 'China CSSC Holdings (中国船舶)', price: 36.50, change: 1.40, changePercent: 3.99, sector: 'Industrials', marketCap: '¥163B', volume: '29.8M', peRatio: 42.1, '52wHigh': 42.00, '52wLow': 26.80 },
            { symbol: '600066', name: 'Yutong Bus (宇通客车)', price: 23.80, change: 0.60, changePercent: 2.59, sector: 'Consumer Discretionary', marketCap: '¥52.7B', volume: '8.4M', peRatio: 17.5, '52wHigh': 26.50, '52wLow': 13.20 },
            { symbol: '600188', name: 'Yankuang Energy (兖矿能源)', price: 16.40, change: 0.35, changePercent: 2.18, sector: 'Energy', marketCap: '¥122B', volume: '15.6M', peRatio: 7.2, '52wHigh': 21.80, '52wLow': 14.50 },
            { symbol: '600025', name: 'Huaneng Lancang River (华能水电)', price: 10.25, change: 0.18, changePercent: 1.79, sector: 'Utilities', marketCap: '¥184B', volume: '14.1M', peRatio: 22.4, '52wHigh': 11.20, '52wLow': 8.10 },
            { symbol: '600905', name: 'Three Gorges Energy (三峡能源)', price: 4.52, change: 0.05, changePercent: 1.12, sector: 'Utilities', marketCap: '¥129B', volume: '31.5M', peRatio: 17.8, '52wHigh': 5.20, '52wLow': 4.10 },
            { symbol: '601618', name: 'Metallurgical Corp (中国中冶)', price: 3.12, change: 0.04, changePercent: 1.30, sector: 'Industrials', marketCap: '¥64.6B', volume: '22.4M', peRatio: 7.5, '52wHigh': 3.70, '52wLow': 2.85 },
            { symbol: '600111', name: 'China Northern Rare Earth (北方稀土)', price: 18.20, change: 0.55, changePercent: 3.12, sector: 'Materials', marketCap: '¥65.8B', volume: '34.2M', peRatio: 28.5, '52wHigh': 24.80, '52wLow': 15.20 },
            { symbol: '600383', name: 'Gemdale Corporation (金地集团)', price: 3.85, change: -0.12, changePercent: -3.02, sector: 'Real Estate', marketCap: '¥17.4B', volume: '28.1M', peRatio: 12.8, '52wHigh': 6.80, '52wLow': 3.10 }
        ]
    },
    SZSE: {
        name: 'SZSE Shenzhen', country: 'China', currency: 'CNY', flag: '🇨🇳',
        stocks: [
            { symbol: '002594', name: 'BYD Company (比亚迪)', price: 254.20, change: 6.80, changePercent: 2.75, sector: 'Consumer Discretionary', marketCap: '¥740B', volume: '14.8M', peRatio: 22.4, '52wHigh': 282.00, '52wLow': 168.00 },
            { symbol: '000858', name: 'Wuliangye Yibin (五粮液)', price: 132.50, change: 1.90, changePercent: 1.45, sector: 'Consumer Staples', marketCap: '¥514B', volume: '9.2M', peRatio: 16.5, '52wHigh': 168.00, '52wLow': 120.00 },
            { symbol: '000333', name: 'Midea Group (美的集团)', price: 63.80, change: 0.90, changePercent: 1.43, sector: 'Consumer Discretionary', marketCap: '¥446B', volume: '18.4M', peRatio: 13.1, '52wHigh': 70.50, '52wLow': 48.20 },
            { symbol: '300750', name: 'CATL ChiNext (宁德时代)', price: 182.40, change: 5.20, changePercent: 2.93, sector: 'Industrials', marketCap: '¥802B', volume: '22.1M', peRatio: 17.8, '52wHigh': 210.00, '52wLow': 140.00 },
            { symbol: '002475', name: 'Luxshare Precision (立讯精密)', price: 38.60, change: 1.25, changePercent: 3.35, sector: 'Technology', marketCap: '¥277B', volume: '34.8M', peRatio: 25.1, '52wHigh': 42.00, '52wLow': 26.50 },
            { symbol: '000001', name: 'Ping An Bank (平安银行)', price: 10.45, change: 0.15, changePercent: 1.46, sector: 'Financials', marketCap: '¥203B', volume: '42.1M', peRatio: 4.5, '52wHigh': 12.20, '52wLow': 8.90 },
            { symbol: '000651', name: 'Gree Electric (格力电器)', price: 41.20, change: 0.40, changePercent: 0.98, sector: 'Consumer Discretionary', marketCap: '¥232B', volume: '16.5M', peRatio: 8.2, '52wHigh': 44.80, '52wLow': 31.50 },
            { symbol: '002714', name: 'Muyuan Foods (牧原股份)', price: 43.50, change: -0.60, changePercent: -1.36, sector: 'Consumer Staples', marketCap: '¥237B', volume: '12.8M', peRatio: 18.4, '52wHigh': 52.00, '52wLow': 34.20 },
            { symbol: '300015', name: 'Aier Eye Hospital ChiNext (爱尔眼科)', price: 12.40, change: -0.18, changePercent: -1.43, sector: 'Healthcare', marketCap: '¥115B', volume: '28.4M', peRatio: 32.5, '52wHigh': 18.50, '52wLow': 11.20 },
            { symbol: '000725', name: 'BOE Technology (京东方A)', price: 4.12, change: 0.05, changePercent: 1.23, sector: 'Technology', marketCap: '¥155B', volume: '88.5M', peRatio: 42.1, '52wHigh': 4.60, '52wLow': 3.65 },
            { symbol: '300059', name: 'East Money Info ChiNext (东方财富)', price: 11.85, change: 0.35, changePercent: 3.04, sector: 'Financials', marketCap: '¥188B', volume: '95.2M', peRatio: 22.8, '52wHigh': 16.20, '52wLow': 10.10 },
            { symbol: '002415', name: 'Hikvision (海康威视)', price: 29.40, change: 0.30, changePercent: 1.03, sector: 'Technology', marketCap: '¥274B', volume: '14.2M', peRatio: 19.4, '52wHigh': 37.80, '52wLow': 26.80 },
            { symbol: '000568', name: 'Luzhou Laojiao (泸州老窖)', price: 145.00, change: 2.10, changePercent: 1.47, sector: 'Consumer Staples', marketCap: '¥213B', volume: '5.8M', peRatio: 15.8, '52wHigh': 195.00, '52wLow': 130.00 },
            { symbol: '300760', name: 'Mindray Bio-Medical ChiNext (迈瑞医疗)', price: 242.00, change: 3.80, changePercent: 1.60, sector: 'Healthcare', marketCap: '¥293B', volume: '4.2M', peRatio: 25.4, '52wHigh': 310.00, '52wLow': 225.00 },
            { symbol: '002352', name: 'SF Holding (顺丰控股)', price: 36.80, change: 0.45, changePercent: 1.24, sector: 'Industrials', marketCap: '¥177B', volume: '11.8M', peRatio: 21.2, '52wHigh': 45.20, '52wLow': 32.10 },
            { symbol: '000100', name: 'TCL Technology (TCL科技)', price: 4.45, change: 0.08, changePercent: 1.83, sector: 'Technology', marketCap: '¥83.6B', volume: '54.1M', peRatio: 31.5, '52wHigh': 5.20, '52wLow': 3.90 },
            { symbol: '002460', name: 'Ganfeng Lithium (赣锋锂业)', price: 28.50, change: -0.80, changePercent: -2.73, sector: 'Materials', marketCap: '¥57.5B', volume: '22.8M', peRatio: 24.1, '52wHigh': 46.80, '52wLow': 24.50 },
            { symbol: '002466', name: 'Tianqi Lithium (天齐锂业)', price: 32.40, change: -0.95, changePercent: -2.85, sector: 'Materials', marketCap: '¥53.2B', volume: '26.4M', peRatio: 21.8, '52wHigh': 56.00, '52wLow': 29.80 },
            { symbol: '300124', name: 'Inovance Tech ChiNext (汇川技术)', price: 58.20, change: 1.40, changePercent: 2.46, sector: 'Industrials', marketCap: '¥156B', volume: '9.8M', peRatio: 32.4, '52wHigh': 68.50, '52wLow': 48.00 },
            { symbol: '002230', name: 'iFLYTEK (科大讯飞)', price: 42.50, change: 1.80, changePercent: 4.42, sector: 'Technology', marketCap: '¥98.4B', volume: '38.5M', peRatio: 85.2, '52wHigh': 56.00, '52wLow': 36.20 },
            { symbol: '000792', name: 'Qinghai Salt Lake (盐湖股份)', price: 16.20, change: 0.25, changePercent: 1.57, sector: 'Materials', marketCap: '¥88.0B', volume: '19.4M', peRatio: 11.8, '52wHigh': 19.50, '52wLow': 13.80 },
            { symbol: '300274', name: 'Sungrow Power ChiNext (阳光电源)', price: 72.50, change: 2.40, changePercent: 3.42, sector: 'Industrials', marketCap: '¥107B', volume: '28.1M', peRatio: 11.2, '52wHigh': 98.00, '52wLow': 58.20 },
            { symbol: '002142', name: 'Bank of Ningbo (宁波银行)', price: 21.80, change: 0.35, changePercent: 1.63, sector: 'Financials', marketCap: '¥144B', volume: '18.9M', peRatio: 5.6, '52wHigh': 26.50, '52wLow': 19.20 },
            { symbol: '000776', name: 'GF Securities (广发证券)', price: 13.10, change: 0.22, changePercent: 1.71, sector: 'Financials', marketCap: '¥99.8B', volume: '16.4M', peRatio: 12.4, '52wHigh': 15.80, '52wLow': 11.80 },
            { symbol: '000166', name: 'Shenwan Hongyuan (申万宏源)', price: 4.52, change: 0.06, changePercent: 1.35, sector: 'Financials', marketCap: '¥113B', volume: '21.0M', peRatio: 18.2, '52wHigh': 5.20, '52wLow': 3.95 },
            { symbol: '002027', name: 'Focus Media (分众传媒)', price: 6.18, change: 0.08, changePercent: 1.31, sector: 'Communication', marketCap: '¥89.3B', volume: '32.1M', peRatio: 18.4, '52wHigh': 7.20, '52wLow': 5.50 },
            { symbol: '300122', name: 'Zhifei Bio ChiNext (智飞生物)', price: 28.90, change: -0.65, changePercent: -2.20, sector: 'Healthcare', marketCap: '¥69.2B', volume: '15.4M', peRatio: 8.4, '52wHigh': 58.00, '52wLow': 25.80 },
            { symbol: '002601', name: 'LB Group (龙佰集团)', price: 17.80, change: 0.28, changePercent: 1.60, sector: 'Materials', marketCap: '¥42.5B', volume: '10.2M', peRatio: 13.2, '52wHigh': 21.40, '52wLow': 15.20 },
            { symbol: '002001', name: 'Zhejiang NHU (新和成)', price: 19.50, change: 0.30, changePercent: 1.56, sector: 'Healthcare', marketCap: '¥60.3B', volume: '8.1M', peRatio: 18.2, '52wHigh': 22.80, '52wLow': 15.80 },
            { symbol: '300408', name: 'Three-Circle ChiNext (三环集团)', price: 29.40, change: 0.60, changePercent: 2.08, sector: 'Technology', marketCap: '¥55.8B', volume: '7.8M', peRatio: 28.9, '52wHigh': 33.50, '52wLow': 24.20 },
            { symbol: '002371', name: 'Naura Tech (北方华创)', price: 312.00, change: 9.50, changePercent: 3.14, sector: 'Technology', marketCap: '¥165B', volume: '4.8M', peRatio: 42.8, '52wHigh': 345.00, '52wLow': 220.00 },
            { symbol: '000938', name: 'Unisplendour (紫光股份)', price: 22.80, change: 0.75, changePercent: 3.40, sector: 'Technology', marketCap: '¥65.2B', volume: '38.2M', peRatio: 30.1, '52wHigh': 26.80, '52wLow': 18.20 },
            { symbol: '300498', name: 'Wens Foodstuff ChiNext (温氏股份)', price: 19.20, change: 0.15, changePercent: 0.79, sector: 'Consumer Staples', marketCap: '¥127B', volume: '14.5M', peRatio: 22.1, '52wHigh': 22.50, '52wLow': 16.80 },
            { symbol: '002241', name: 'Goertek (歌尔股份)', price: 21.40, change: 0.85, changePercent: 4.14, sector: 'Technology', marketCap: '¥73.1B', volume: '48.9M', peRatio: 68.2, '52wHigh': 25.80, '52wLow': 14.50 },
            { symbol: '002050', name: 'Sanfeng Intelligent (三丰智能)', price: 4.25, change: 0.12, changePercent: 2.91, sector: 'Industrials', marketCap: '¥5.9B', volume: '11.2M', peRatio: 38.5, '52wHigh': 5.40, '52wLow': 3.20 },
            { symbol: '300014', name: 'EVE Energy ChiNext (亿纬锂能)', price: 36.50, change: 1.10, changePercent: 3.11, sector: 'Industrials', marketCap: '¥74.7B', volume: '21.4M', peRatio: 18.5, '52wHigh': 52.00, '52wLow': 31.00 },
            { symbol: '002812', name: 'Energy New Material (恩捷股份)', price: 26.80, change: -0.75, changePercent: -2.72, sector: 'Materials', marketCap: '¥26.2B', volume: '14.1M', peRatio: 15.4, '52wHigh': 58.00, '52wLow': 24.10 },
            { symbol: '000002', name: 'China Vanke (万科A)', price: 6.85, change: -0.25, changePercent: -3.52, sector: 'Real Estate', marketCap: '¥81.7B', volume: '62.4M', peRatio: 6.8, '52wHigh': 11.50, '52wLow': 6.20 },
            { symbol: '000963', name: 'Huadong Medicine (华东医药)', price: 29.80, change: 0.40, changePercent: 1.36, sector: 'Healthcare', marketCap: '¥52.3B', volume: '6.4M', peRatio: 17.8, '52wHigh': 38.50, '52wLow': 27.20 },
            { symbol: '300347', name: 'Tigermed ChiNext (泰格医药)', price: 48.50, change: -1.10, changePercent: -2.22, sector: 'Healthcare', marketCap: '¥42.3B', volume: '7.8M', peRatio: 21.4, '52wHigh': 72.00, '52wLow': 42.00 },
            { symbol: '002129', name: 'TCL Zhonghuan (TCL中环)', price: 9.85, change: -0.30, changePercent: -2.96, sector: 'Industrials', marketCap: '¥39.8B', volume: '32.1M', peRatio: 12.8, '52wHigh': 18.50, '52wLow': 9.20 },
            { symbol: '000983', name: 'Shanxi Coking Coal (山西焦煤)', price: 8.45, change: 0.18, changePercent: 2.18, sector: 'Energy', marketCap: '¥48.0B', volume: '18.4M', peRatio: 7.2, '52wHigh': 11.20, '52wLow': 7.60 },
            { symbol: '002493', name: 'Rongsheng Petrochem (荣盛石化)', price: 9.12, change: 0.10, changePercent: 1.11, sector: 'Energy', marketCap: '¥92.3B', volume: '11.5M', peRatio: 78.4, '52wHigh': 12.50, '52wLow': 8.50 },
            { symbol: '300413', name: 'Mango Media ChiNext (芒果超媒)', price: 22.40, change: 0.50, changePercent: 2.28, sector: 'Communication', marketCap: '¥41.9B', volume: '14.2M', peRatio: 23.5, '52wHigh': 31.00, '52wLow': 19.80 },
            { symbol: '000538', name: 'Yunnan Baiyao (云南白药)', price: 54.20, change: 0.60, changePercent: 1.12, sector: 'Healthcare', marketCap: '¥96.8B', volume: '4.8M', peRatio: 23.4, '52wHigh': 59.80, '52wLow': 48.00 },
            { symbol: '002236', name: 'Dahua Tech (大华股份)', price: 15.60, change: 0.25, changePercent: 1.63, sector: 'Technology', marketCap: '¥51.4B', volume: '16.8M', peRatio: 14.2, '52wHigh': 21.00, '52wLow': 14.10 },
            { symbol: '300033', name: 'RoyalFlush ChiNext (同花顺)', price: 118.00, change: 4.50, changePercent: 3.96, sector: 'Financials', marketCap: '¥63.4B', volume: '8.4M', peRatio: 45.2, '52wHigh': 165.00, '52wLow': 98.00 },
            { symbol: '002304', name: 'Yanghe Brewery (洋河股份)', price: 82.50, change: 0.90, changePercent: 1.10, sector: 'Consumer Staples', marketCap: '¥124B', volume: '4.2M', peRatio: 12.4, '52wHigh': 125.00, '52wLow': 76.00 },
            { symbol: '000425', name: 'XCMG Machinery (徐工机械)', price: 6.82, change: 0.14, changePercent: 2.10, sector: 'Industrials', marketCap: '¥80.6B', volume: '28.4M', peRatio: 14.8, '52wHigh': 7.60, '52wLow': 5.20 },
            { symbol: '000157', name: 'Zoomlion Heavy (中联重科)', price: 7.15, change: 0.12, changePercent: 1.71, sector: 'Industrials', marketCap: '¥62.0B', volume: '19.5M', peRatio: 17.2, '52wHigh': 8.40, '52wLow': 5.80 },
            { symbol: '000338', name: 'Weichai Power (潍柴动力)', price: 14.80, change: 0.35, changePercent: 2.42, sector: 'Industrials', marketCap: '¥129B', volume: '24.8M', peRatio: 13.8, '52wHigh': 17.50, '52wLow': 12.10 },
            { symbol: '300142', name: 'Walvax Biotech ChiNext (沃森生物)', price: 13.20, change: -0.30, changePercent: -2.22, sector: 'Healthcare', marketCap: '¥21.2B', volume: '16.4M', peRatio: 48.0, '52wHigh': 24.00, '52wLow': 12.50 },
            { symbol: '002078', name: 'FTD Semiconductor (FTD微)', price: 15.40, change: 0.45, changePercent: 3.01, sector: 'Technology', marketCap: '¥14.2B', volume: '8.9M', peRatio: 42.1, '52wHigh': 19.80, '52wLow': 12.10 },
            { symbol: '002405', name: 'NavInfo (四维图新)', price: 7.85, change: 0.22, changePercent: 2.88, sector: 'Technology', marketCap: '¥18.6B', volume: '26.4M', peRatio: 52.0, '52wHigh': 11.20, '52wLow': 6.90 },
            { symbol: '000625', name: 'Changan Automobile (长安汽车)', price: 12.85, change: 0.30, changePercent: 2.39, sector: 'Consumer Discretionary', marketCap: '¥127B', volume: '48.2M', peRatio: 11.8, '52wHigh': 18.20, '52wLow': 11.40 },
            { symbol: '000550', name: 'Jiangling Motors (江铃汽车)', price: 21.40, change: 0.50, changePercent: 2.39, sector: 'Consumer Discretionary', marketCap: '¥18.5B', volume: '4.8M', peRatio: 12.1, '52wHigh': 26.80, '52wLow': 16.40 },
            { symbol: '300661', name: 'Sangfor Tech ChiNext (深信服)', price: 54.20, change: 1.80, changePercent: 3.44, sector: 'Technology', marketCap: '¥22.7B', volume: '5.4M', peRatio: 68.4, '52wHigh': 85.00, '52wLow': 46.00 },
            { symbol: '002179', name: 'AVICopter (中直股份)', price: 38.50, change: 0.90, changePercent: 2.39, sector: 'Industrials', marketCap: '¥31.4B', volume: '6.2M', peRatio: 54.2, '52wHigh': 46.00, '52wLow': 32.00 },
            { symbol: '000768', name: 'AVIC Aircraft (中航西飞)', price: 24.80, change: 0.60, changePercent: 2.48, sector: 'Industrials', marketCap: '¥68.9B', volume: '14.2M', peRatio: 72.0, '52wHigh': 29.50, '52wLow': 20.40 },
            { symbol: '002049', name: 'Unigroup Guoxin (紫光国微)', price: 56.40, change: 1.90, changePercent: 3.49, sector: 'Technology', marketCap: '¥47.9B', volume: '18.4M', peRatio: 28.5, '52wHigh': 78.00, '52wLow': 48.00 },
            { symbol: '300308', name: 'Innolight ChiNext (中际旭创)', price: 135.00, change: 6.20, changePercent: 4.81, sector: 'Technology', marketCap: '¥151B', volume: '24.8M', peRatio: 38.4, '52wHigh': 168.00, '52wLow': 82.00 },
            { symbol: '002555', name: '37 Interactive ChiNext (三七互娱)', price: 14.20, change: 0.30, changePercent: 2.16, sector: 'Communication', marketCap: '¥31.5B', volume: '22.1M', peRatio: 11.5, '52wHigh': 22.00, '52wLow': 13.00 },
            { symbol: '002602', name: 'Century Huatong (世纪华通)', price: 3.85, change: 0.08, changePercent: 2.12, sector: 'Communication', marketCap: '¥28.7B', volume: '34.2M', peRatio: 45.0, '52wHigh': 5.80, '52wLow': 3.40 },
            { symbol: '000688', name: 'Guocheng Mining (国城矿业)', price: 12.40, change: 0.25, changePercent: 2.06, sector: 'Materials', marketCap: '¥13.8B', volume: '4.8M', peRatio: 88.0, '52wHigh': 15.80, '52wLow': 9.80 },
            { symbol: '300724', name: 'Jiejia Weichuang ChiNext (捷佳伟创)', price: 52.80, change: 1.40, changePercent: 2.72, sector: 'Technology', marketCap: '¥18.4B', volume: '6.2M', peRatio: 11.8, '52wHigh': 78.00, '52wLow': 46.00 },
            { symbol: '002202', name: 'Goldwind (金风科技)', price: 7.85, change: 0.14, changePercent: 1.82, sector: 'Industrials', marketCap: '¥33.2B', volume: '18.4M', peRatio: 22.4, '52wHigh': 9.50, '52wLow': 6.80 },
            { symbol: '002410', name: 'Glodon (广联达)', price: 11.20, change: -0.25, changePercent: -2.18, sector: 'Technology', marketCap: '¥18.6B', volume: '12.4M', peRatio: 78.0, '52wHigh': 22.00, '52wLow': 10.20 },
            { symbol: '300450', name: 'Lead Intelligent ChiNext (先导智能)', price: 18.50, change: 0.45, changePercent: 2.49, sector: 'Industrials', marketCap: '¥29.0B', volume: '14.8M', peRatio: 16.4, '52wHigh': 31.00, '52wLow': 16.50 },
            { symbol: '002625', name: 'Yidao Tech (光启技术)', price: 16.40, change: 0.60, changePercent: 3.80, sector: 'Industrials', marketCap: '¥35.3B', volume: '28.1M', peRatio: 64.2, '52wHigh': 21.50, '52wLow': 12.80 },
            { symbol: '000876', name: 'New Hope Liuhe (新希望)', price: 9.15, change: 0.10, changePercent: 1.10, sector: 'Consumer Staples', marketCap: '¥41.6B', volume: '14.2M', peRatio: 34.0, '52wHigh': 11.80, '52wLow': 8.10 },
            { symbol: '300433', name: 'Blue Sail Medical ChiNext (蓝帆医疗)', price: 5.25, change: 0.08, changePercent: 1.55, sector: 'Healthcare', marketCap: '¥5.28B', volume: '4.8M', peRatio: 28.0, '52wHigh': 7.20, '52wLow': 4.60 },
            { symbol: '002024', name: 'Suning.com (ST苏宁)', price: 1.42, change: 0.02, changePercent: 1.43, sector: 'Consumer Discretionary', marketCap: '¥13.2B', volume: '24.1M', peRatio: 15.0, '52wHigh': 2.10, '52wLow': 1.15 },
            { symbol: '002311', name: 'Haid Group (海大集团)', price: 44.50, change: 0.70, changePercent: 1.60, sector: 'Consumer Staples', marketCap: '¥74.0B', volume: '5.2M', peRatio: 22.8, '52wHigh': 52.00, '52wLow': 38.50 },
            { symbol: '300601', name: 'Kangtai Bio ChiNext (康泰生物)', price: 18.40, change: -0.35, changePercent: -1.87, sector: 'Healthcare', marketCap: '¥20.5B', volume: '8.4M', peRatio: 24.2, '52wHigh': 29.00, '52wLow': 16.80 },
            { symbol: '000786', name: 'North China Pharma (华北制药)', price: 4.82, change: 0.05, changePercent: 1.05, sector: 'Healthcare', marketCap: '¥8.27B', volume: '6.1M', peRatio: 38.2, '52wHigh': 6.10, '52wLow': 4.20 }
        ]
    },
    MOEX: {
        name: 'MOEX', country: 'Russia', currency: 'RUB', flag: '🇷🇺', region: 'Europe',
        stocks: [
            { symbol: 'SBER', name: 'Sberbank (Сбербанк)', price: 295.40, change: 3.80, changePercent: 1.30, sector: 'Financials', marketCap: '₽6.68T', volume: '48.2M', peRatio: 4.2, '52wHigh': 330.00, '52wLow': 240.00, fiveMinRvol: 1.85, fiveMinDelta: 1650000 },
            { symbol: 'GAZP', name: 'Gazprom (Газпром)', price: 168.20, change: -1.10, changePercent: -0.65, sector: 'Energy', marketCap: '₽3.98T', volume: '38.4M', peRatio: 3.8, '52wHigh': 185.00, '52wLow': 115.00, fiveMinRvol: 1.30, fiveMinDelta: -820000 },
            { symbol: 'LKOH', name: 'Lukoil (Лукойл)', price: 6940.00, change: 82.00, changePercent: 1.20, sector: 'Energy', marketCap: '₽4.81T', volume: '1.4M', peRatio: 4.9, '52wHigh': 7980.00, '52wLow': 6100.00, fiveMinRvol: 2.10, fiveMinDelta: 940000 },
            { symbol: 'ROSN', name: 'Rosneft (Роснефть)', price: 542.50, change: 6.20, changePercent: 1.16, sector: 'Energy', marketCap: '₽5.75T', volume: '8.2M', peRatio: 4.5, '52wHigh': 605.00, '52wLow': 475.00, fiveMinRvol: 1.65, fiveMinDelta: 620000 },
            { symbol: 'NVTK', name: 'Novatek (Новатэк)', price: 1124.00, change: 18.50, changePercent: 1.67, sector: 'Energy', marketCap: '₽3.41T', volume: '3.6M', peRatio: 6.2, '52wHigh': 1780.00, '52wLow': 980.00, fiveMinRvol: 1.75, fiveMinDelta: 480000 },
            { symbol: 'GMKN', name: 'Norilsk Nickel (Норникель)', price: 148.80, change: 1.60, changePercent: 1.09, sector: 'Materials', marketCap: '₽2.28T', volume: '14.5M', peRatio: 7.4, '52wHigh': 182.00, '52wLow': 128.00, fiveMinRvol: 1.50, fiveMinDelta: 520000 },
            { symbol: 'YDEX', name: 'Yandex (Яндекс)', price: 4180.00, change: 112.00, changePercent: 2.75, sector: 'Technology', marketCap: '₽1.62T', volume: '2.1M', peRatio: 18.4, '52wHigh': 4550.00, '52wLow': 3200.00, fiveMinRvol: 2.85, fiveMinDelta: 1250000 },
            { symbol: 'PLZL', name: 'Polyus (Полюс)', price: 13240.00, change: 240.00, changePercent: 1.85, sector: 'Materials', marketCap: '₽1.80T', volume: '320K', peRatio: 8.1, '52wHigh': 15100.00, '52wLow': 10500.00, fiveMinRvol: 1.95, fiveMinDelta: 380000 },
            { symbol: 'CHMF', name: 'Severstal (Северсталь)', price: 1528.00, change: 22.00, changePercent: 1.46, sector: 'Materials', marketCap: '₽1.28T', volume: '1.8M', peRatio: 6.5, '52wHigh': 1950.00, '52wLow': 1220.00, fiveMinRvol: 1.40, fiveMinDelta: 310000 },
            { symbol: 'TATN', name: 'Tatneft (Татнефть)', price: 684.00, change: 9.50, changePercent: 1.41, sector: 'Energy', marketCap: '₽1.59T', volume: '4.8M', peRatio: 5.1, '52wHigh': 755.00, '52wLow': 580.00, fiveMinRvol: 1.60, fiveMinDelta: 420000 },
            { symbol: 'VTBR', name: 'VTB Bank (Банк ВТБ)', price: 96.40, change: 1.20, changePercent: 1.26, sector: 'Financials', marketCap: '₽980B', volume: '18.2M', peRatio: 2.8, '52wHigh': 118.00, '52wLow': 74.00, fiveMinRvol: 1.70, fiveMinDelta: 680000 },
            { symbol: 'MGNT', name: 'Magnit (Магнит)', price: 6240.00, change: -45.00, changePercent: -0.72, sector: 'Consumer Staples', marketCap: '₽636B', volume: '620K', peRatio: 7.9, '52wHigh': 8400.00, '52wLow': 5600.00, fiveMinRvol: 1.20, fiveMinDelta: -190000 },
            { symbol: 'MTSS', name: 'MTS (МТС)', price: 248.50, change: 2.10, changePercent: 0.85, sector: 'Communication', marketCap: '₽497B', volume: '5.4M', peRatio: 8.8, '52wHigh': 345.00, '52wLow': 210.00, fiveMinRvol: 1.35, fiveMinDelta: 240000 },
            { symbol: 'MOEX', name: 'Moscow Exchange (МосБиржа)', price: 218.40, change: 4.80, changePercent: 2.25, sector: 'Financials', marketCap: '₽497B', volume: '6.8M', peRatio: 7.2, '52wHigh': 260.00, '52wLow': 175.00, fiveMinRvol: 2.20, fiveMinDelta: 580000 },
            { symbol: 'OZON', name: 'Ozon Holdings (Озон)', price: 3860.00, change: 95.00, changePercent: 2.52, sector: 'Consumer Discretionary', marketCap: '₽834B', volume: '1.9M', peRatio: 32.4, '52wHigh': 4400.00, '52wLow': 2650.00, fiveMinRvol: 2.40, fiveMinDelta: 820000 },
            { symbol: 'PHOR', name: 'PhosAgro (ФосАгро)', price: 5820.00, change: 48.00, changePercent: 0.83, sector: 'Materials', marketCap: '₽754B', volume: '410K', peRatio: 7.8, '52wHigh': 7200.00, '52wLow': 5100.00, fiveMinRvol: 1.25, fiveMinDelta: 210000 },
            { symbol: 'SNGS', name: 'Surgutneftegas (Сургутнефтегаз)', price: 32.80, change: 0.35, changePercent: 1.08, sector: 'Energy', marketCap: '₽1.42T', volume: '28.5M', peRatio: 3.1, '52wHigh': 37.50, '52wLow': 26.80, fiveMinRvol: 1.45, fiveMinDelta: 390000 },
            { symbol: 'ALRS', name: 'ALROSA (АЛРОСА)', price: 68.90, change: 0.70, changePercent: 1.03, sector: 'Materials', marketCap: '₽507B', volume: '11.4M', peRatio: 5.9, '52wHigh': 85.00, '52wLow': 58.00, fiveMinRvol: 1.35, fiveMinDelta: 280000 },
            { symbol: 'AFLT', name: 'Aeroflot (Аэрофлот)', price: 54.80, change: 1.40, changePercent: 2.62, sector: 'Industrials', marketCap: '₽218B', volume: '16.8M', peRatio: 12.5, '52wHigh': 64.00, '52wLow': 34.00, fiveMinRvol: 2.15, fiveMinDelta: 620000 },
            { symbol: 'IRAO', name: 'Inter RAO (Интер РАО)', price: 4.18, change: 0.05, changePercent: 1.21, sector: 'Utilities', marketCap: '₽436B', volume: '42.1M', peRatio: 4.1, '52wHigh': 4.65, '52wLow': 3.75, fiveMinRvol: 1.30, fiveMinDelta: 310000 }
        ]
    }
};

// Bond helper
function makeBond(id,cat,issuer,name,coupon,couponN,mat,par,unit,ytm,ratings,tax,country,curr,badge,badgeText,desc) {
    return {id,category:cat,issuer,name,coupon,couponNum:couponN,maturity:mat,pricePar:par,pricePerUnit:unit,ytm,ratings,taxStatus:tax,country,currency:curr,minIncrement:1000,badgeClass:badge,badgeText,description:desc};
}

const exchangeBondsData = {
    NASDAQ: [
        makeBond('AAPL-2043','aapl','Apple Inc.','Apple 3.850% Sr Notes 2043','3.850%',3.85,'05/04/2043',96.5,965,4.82,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'US Corporate Taxable','USA','USD','badge-aapl','Apple Senior','Flagship Apple corporate debt'),
        makeBond('AAPL-GREEN-2030','aapl','Apple Inc.','Apple Green Bond 2.650% 2030','2.650%',2.65,'05/11/2030',93.8,938,4.15,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'US Green ESG','USA','USD','badge-aapl','Apple Green ESG','Clean energy financing'),
        makeBond('NYC-MUNI-2035','muni','City of New York','NYC Muni GO 4.250% 2035','4.250%',4.25,'08/01/2035',102.15,1021.5,3.92,{moodys:'Aa2',sp:'AA',fitch:'AA'},'US Tax-Exempt','USA','USD','badge-muni','NYC Municipal','Tax-exempt GO bond'),
        makeBond('US-SOV-10Y','sovereign','US Treasury','US Treasury 10Y 4.250% 2034','4.250%',4.25,'05/15/2034',98.75,987.5,4.41,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'US State Tax-Exempt','USA','USD','badge-sovereign','US Sovereign','Risk-free benchmark'),
        makeBond('MSFT-CORP-2032','corp','Microsoft Corp','Microsoft 2.921% Sr Note 2032','2.921%',2.921,'03/17/2032',94.2,942,3.82,{moodys:'Aaa',sp:'AAA',fitch:'AAA'},'US Corporate Taxable','USA','USD','badge-corp','Corporate (MSFT)','AAA-rated Microsoft debt')
    ],
    NYSE: [
        makeBond('AAPL-2043-NYSE','aapl','Apple Inc.','Apple 3.850% Sr Notes 2043','3.850%',3.85,'05/04/2043',96.5,965,4.82,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'US Corporate Taxable','USA','USD','badge-aapl','Apple Senior','NYSE-listed Apple note'),
        makeBond('NY-MUNI-2036','muni','State of New York','NY State GO 3.95% 2036','3.950%',3.95,'06/15/2036',100.8,1008,3.85,{moodys:'Aa1',sp:'AA+',fitch:'AA+'},'US Tax-Exempt','USA','USD','badge-muni','NY State Muni','State tax-exempt bond'),
        makeBond('US-SOV-30Y','sovereign','US Treasury','US Treasury 30Y 4.625% 2054','4.625%',4.625,'05/15/2054',97.2,972,4.79,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'US Tax-Exempt','USA','USD','badge-sovereign','US Sovereign 30Y','Long-term benchmark'),
        makeBond('JPM-CORP-2033','corp','JPMorgan Chase','JPMorgan 4.850% Sr 2033','4.850%',4.85,'07/25/2033',101.5,1015,4.62,{moodys:'Aa2',sp:'A+',fitch:'AA-'},'US Corporate Taxable','USA','USD','badge-corp','Corporate (JPM)','Major bank debt')
    ],
    LSE: [
        makeBond('AAPL-GBP-2031','aapl','Apple Inc.','Apple GBP 1.375% 2031','1.375%',1.375,'10/01/2031',91.2,912,2.85,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'UK Corporate','UK','GBP','badge-aapl','Apple GBP Note','Sterling-denominated Apple debt'),
        makeBond('UK-GILT-2034','sovereign','HM Treasury','UK Gilt 4.125% 2034','4.125%',4.125,'01/29/2034',97.8,978,4.42,{moodys:'Aa3',sp:'AA',fitch:'AA-'},'UK Sovereign','UK','GBP','badge-sovereign','UK Gilt','UK government benchmark'),
        makeBond('LON-MUNI-TFL','muni','Transport for London','TfL Bond 3.875% 2036','3.875%',3.875,'09/15/2036',98.5,985,4.08,{moodys:'Aa3',sp:'AA-',fitch:'AA-'},'UK Municipal','UK','GBP','badge-muni','TfL Municipal','London transport bond'),
        makeBond('BP-CORP-2032','corp','BP PLC','BP 3.25% Sr Note 2032','3.250%',3.25,'06/28/2032',95.4,954,4.01,{moodys:'A2',sp:'A-',fitch:'A'},'UK Corporate','UK','GBP','badge-corp','Corporate (BP)','Energy major debt')
    ],
    XETRA: [
        makeBond('AAPL-EUR-2029','aapl','Apple Inc.','Apple EUR 0.500% 2029','0.500%',0.5,'11/15/2029',92.1,921,2.45,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'EU Corporate','Germany','EUR','badge-aapl','Apple EUR Note','Euro-denominated Apple debt'),
        makeBond('DE-BUND-10Y','sovereign','German Federal Republic','Bund 2.300% 2033','2.300%',2.3,'02/15/2033',98.6,986,2.48,{moodys:'Aaa',sp:'AAA',fitch:'AAA'},'EU Sovereign','Germany','EUR','badge-sovereign','German Bund','AAA benchmark'),
        makeBond('NRW-MUNI','muni','State of NRW','NRW Landeschatz 1.875% 2034','1.875%',1.875,'03/20/2034',95.8,958,2.42,{moodys:'Aa1',sp:'AA',fitch:'AA'},'EU Municipal','Germany','EUR','badge-muni','NRW Municipal','German state bond'),
        makeBond('SAP-CORP-2031','corp','SAP SE','SAP 1.250% Sr 2031','1.250%',1.25,'04/14/2031',93.5,935,2.48,{moodys:'A2',sp:'A',fitch:'A'},'EU Corporate','Germany','EUR','badge-corp','Corporate (SAP)','Tech corporate note')
    ],
    TSE: [
        makeBond('AAPL-CAD-2030','aapl','Apple Inc.','Apple CAD 2.100% 2030','2.100%',2.1,'09/01/2030',94.5,945,3.28,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'CA Corporate','Canada','CAD','badge-aapl','Apple CAD Note','Canadian dollar Apple debt'),
        makeBond('CA-GOV-10Y','sovereign','Govt of Canada','Canada Bond 3.25% 2034','3.250%',3.25,'06/01/2034',99.1,991,3.37,{moodys:'Aaa',sp:'AAA',fitch:'AA+'},'CA Sovereign','Canada','CAD','badge-sovereign','Canada Sovereign','Triple-A sovereign'),
        makeBond('ON-MUNI-2033','muni','Province of Ontario','Ontario Bond 3.50% 2033','3.500%',3.5,'06/02/2033',98.2,982,3.74,{moodys:'Aa3',sp:'A+',fitch:'AA-'},'CA Provincial','Canada','CAD','badge-muni','Ontario Provincial','Provincial bond'),
        makeBond('RY-CORP-2032','corp','Royal Bank of Canada','RBC 3.875% Sr 2032','3.875%',3.875,'05/01/2032',99.8,998,3.91,{moodys:'Aa2',sp:'AA-',fitch:'AA'},'CA Corporate','Canada','CAD','badge-corp','Corporate (RBC)','Major bank debt')
    ],
    HKEX: [
        makeBond('AAPL-HKD-2031','aapl','Apple Inc.','Apple HKD 1.650% 2031','1.650%',1.65,'03/15/2031',93.2,932,2.98,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'HK Corporate','Hong Kong','HKD','badge-aapl','Apple HKD Note','HK dollar Apple bond'),
        makeBond('HK-GBOND-2034','sovereign','HKSAR Government','HK Govt Bond 3.00% 2034','3.000%',3.0,'07/28/2034',99.4,994,3.07,{moodys:'Aa3',sp:'AA+',fitch:'AA+'},'HK Sovereign','Hong Kong','HKD','badge-sovereign','HK Sovereign','HKSAR benchmark'),
        makeBond('HK-MTR-MUNI','muni','MTR Corporation','MTR Bond 2.85% 2035','2.850%',2.85,'11/20/2035',96.8,968,3.24,{moodys:'Aa2',sp:'AA',fitch:'AA'},'HK Municipal','Hong Kong','HKD','badge-muni','MTR Municipal','Transport infrastructure'),
        makeBond('TENCENT-CORP','corp','Tencent Holdings','Tencent 3.24% Sr 2033','3.240%',3.24,'06/03/2033',97.5,975,3.58,{moodys:'A1',sp:'A+',fitch:'A+'},'HK Corporate','Hong Kong','HKD','badge-corp','Corporate (Tencent)','Tech giant debt')
    ],
    TADAWUL: [
        makeBond('AAPL-SAR-2032','aapl','Apple Inc.','Apple SAR 3.500% 2032','3.500%',3.5,'08/20/2032',97.5,975,3.88,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'SA Corporate','Saudi Arabia','SAR','badge-aapl','Apple SAR Note','Riyal Apple bond'),
        makeBond('SA-SUKUK-2034','sovereign','Kingdom of Saudi Arabia','Saudi Sukuk 4.00% 2034','4.000%',4.0,'04/17/2034',100.2,1002,3.96,{moodys:'A1',sp:'A',fitch:'A'},'Islamic Sovereign','Saudi Arabia','SAR','badge-sovereign','Saudi Sukuk','Sharia-compliant sovereign'),
        makeBond('RIYADH-MUNI','muni','Riyadh Development Authority','Riyadh Green Sukuk 3.75% 2035','3.750%',3.75,'09/15/2035',99.4,994,3.82,{moodys:'A1',sp:'A',fitch:'A'},'SA Municipal','Saudi Arabia','SAR','badge-muni','Riyadh Municipal','Vision 2030 bond'),
        makeBond('ARAMCO-CORP','corp','Saudi Aramco','Aramco 3.50% Sr 2033','3.500%',3.5,'04/16/2033',98.8,988,3.65,{moodys:'A1',sp:'A',fitch:'A'},'SA Corporate','Saudi Arabia','SAR','badge-corp','Corporate (Aramco)','Energy sovereign corporate')
    ],
    NSE: [
        makeBond('AAPL-INR-2031','aapl','Apple Inc.','Apple INR 6.850% 2031','6.850%',6.85,'06/15/2031',101.2,1012,6.60,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'IN Corporate','India','INR','badge-aapl','Apple INR Note','Rupee-denominated Apple'),
        makeBond('IN-GOV-10Y','sovereign','Govt of India','India G-Sec 7.18% 2033','7.180%',7.18,'08/14/2033',100.8,1008,7.08,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'IN Sovereign','India','INR','badge-sovereign','India G-Sec','Government security'),
        makeBond('MH-SDL-MUNI','muni','State of Maharashtra','Maharashtra SDL 7.25% 2034','7.250%',7.25,'03/28/2034',99.8,998,7.28,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'IN State Dev Loan','India','INR','badge-muni','Maharashtra SDL','State development loan'),
        makeBond('RELIANCE-CORP','corp','Reliance Industries','Reliance 7.50% NCD 2032','7.500%',7.5,'12/10/2032',102.1,1021,7.12,{moodys:'Baa2',sp:'BBB+',fitch:'BBB+'},'IN Corporate','India','INR','badge-corp','Corporate (RIL)','Major conglomerate debt')
    ],
    ASX: [
        makeBond('AAPL-AUD-2030','aapl','Apple Inc.','Apple AUD 3.200% 2030','3.200%',3.2,'11/20/2030',96.5,965,3.92,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'AU Corporate','Australia','AUD','badge-aapl','Apple AUD Note','AUD Apple bond'),
        makeBond('AU-GOV-10Y','sovereign','Commonwealth of Australia','ACGB 3.750% 2034','3.750%',3.75,'04/21/2034',99.2,992,3.84,{moodys:'Aaa',sp:'AAA',fitch:'AAA'},'AU Sovereign','Australia','AUD','badge-sovereign','ACGB Sovereign','AAA government benchmark'),
        makeBond('NSW-TCorp','muni','NSW Treasury Corp','NSW T-Corp 3.50% 2035','3.500%',3.5,'05/20/2035',97.4,974,3.82,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'AU Semi-Govt','Australia','AUD','badge-muni','NSW Municipal','State semi-government'),
        makeBond('BHP-CORP-2033','corp','BHP Group','BHP 3.85% Sr 2033','3.850%',3.85,'08/15/2033',98.5,985,4.05,{moodys:'A3',sp:'A',fitch:'A+'},'AU Corporate','Australia','AUD','badge-corp','Corporate (BHP)','Mining major debt')
    ],
    SIX: [
        makeBond('AAPL-CHF-2029','aapl','Apple Inc.','Apple CHF 0.375% 2029','0.375%',0.375,'11/10/2029',94.5,945,1.68,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'CH Corporate','Switzerland','CHF','badge-aapl','Apple CHF Note','Franc Apple bond'),
        makeBond('CH-CONF-2034','sovereign','Swiss Confederation','Swiss Confederation 1.25% 2034','1.250%',1.25,'06/22/2034',99.8,998,1.28,{moodys:'Aaa',sp:'AAA',fitch:'AAA'},'CH Sovereign','Switzerland','CHF','badge-sovereign','Swiss Sovereign','Safe-haven AAA'),
        makeBond('ZH-KANTON','muni','Canton of Zurich','Zurich Canton 0.75% 2033','0.750%',0.75,'10/15/2033',96.2,962,1.21,{moodys:'Aaa',sp:'AAA',fitch:'AAA'},'CH Cantonal','Switzerland','CHF','badge-muni','Zurich Cantonal','Canton bond'),
        makeBond('NESN-CORP-2032','corp','Nestlé SA','Nestlé 1.00% Sr 2032','1.000%',1.0,'03/28/2032',94.8,948,1.72,{moodys:'Aa3',sp:'AA-',fitch:'AA'},'CH Corporate','Switzerland','CHF','badge-corp','Corporate (Nestlé)','Consumer staples note')
    ],
    BM: [
        makeBond('AAPL-EUR-BM','aapl','Apple Inc.','Apple EUR 0.875% 2029','0.875%',0.875,'05/24/2029',93.5,935,2.62,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'EU Corporate','Spain','EUR','badge-aapl','Apple EUR Note','Euro Apple bond'),
        makeBond('ES-BONO-2034','sovereign','Kingdom of Spain','Spanish Bono 3.45% 2034','3.450%',3.45,'07/30/2034',99.2,992,3.54,{moodys:'Baa1',sp:'A',fitch:'A-'},'EU Sovereign','Spain','EUR','badge-sovereign','Spain Sovereign','Spanish benchmark'),
        makeBond('MADRID-MUNI','muni','Comunidad de Madrid','Madrid Autonomous 2.80% 2033','2.800%',2.8,'11/15/2033',97.8,978,3.12,{moodys:'Baa1',sp:'A',fitch:'A-'},'EU Municipal','Spain','EUR','badge-muni','Madrid Municipal','Regional autonomous'),
        makeBond('SAN-CORP-2032','corp','Banco Santander','Santander 3.90% Sr 2032','3.900%',3.9,'01/18/2032',99.8,998,3.94,{moodys:'A2',sp:'A',fitch:'A-'},'EU Corporate','Spain','EUR','badge-corp','Corporate (Santander)','Banking major debt')
    ],
    TSE_JP: [
        makeBond('AAPL-JPY-2031','aapl','Apple Inc.','Apple JPY 0.750% 2031','0.750%',0.75,'02/20/2031',97.5,975,1.12,{moodys:'Aaa',sp:'AA+',fitch:'AA+'},'JP Corporate','Japan','JPY','badge-aapl','Apple JPY Note','Yen Apple samurai bond'),
        makeBond('JP-JGB-10Y','sovereign','Govt of Japan','JGB 10Y 0.950% 2034','0.950%',0.95,'03/20/2034',99.6,996,0.99,{moodys:'A1',sp:'A+',fitch:'A+'},'JP Sovereign','Japan','JPY','badge-sovereign','Japan JGB','Benchmark JGB'),
        makeBond('TOKYO-METRO','muni','Tokyo Metropolitan Govt','Tokyo Metro Bond 0.85% 2033','0.850%',0.85,'09/20/2033',98.2,982,1.08,{moodys:'A1',sp:'A+',fitch:'A+'},'JP Municipal','Japan','JPY','badge-muni','Tokyo Municipal','Tokyo metro bond'),
        makeBond('TOYOTA-CORP','corp','Toyota Motor','Toyota 1.050% Sr 2033','1.050%',1.05,'09/20/2033',99.2,992,1.14,{moodys:'A1',sp:'A+',fitch:'A+'},'JP Corporate','Japan','JPY','badge-corp','Corporate (Toyota)','Automotive giant debt')
    ],
    SSE: [
        makeBond('MOUTAI-2032','corp','Kweichow Moutai','Moutai Corporate 2.850% 2032','2.850%',2.85,'06/18/2032',101.5,1015,2.65,{moodys:'Aa3',sp:'A+',fitch:'AA-'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (Moutai)','Flagship Moutai state debt'),
        makeBond('CN-SOV-10Y','sovereign','Ministry of Finance China','China Treasury Bond 10Y 2.250% 2034','2.250%',2.25,'05/20/2034',99.8,998,2.27,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Sovereign Tax-Exempt','China','CNY','badge-sovereign','China Sovereign','National Treasury Benchmark'),
        makeBond('SHANGHAI-MUNI','muni','Shanghai Municipal Govt','Shanghai Infra GO Bond 2.60% 2035','2.600%',2.60,'09/15/2035',100.4,1004,2.56,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Municipal','China','CNY','badge-muni','Shanghai Muni','Pudong infrastructure bond'),
        makeBond('ICBC-CORP-2033','corp','ICBC Bank','ICBC Senior Note 3.10% 2033','3.100%',3.10,'04/10/2033',102.1,1021,2.88,{moodys:'A1',sp:'A',fitch:'A'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (ICBC)','State-owned bank senior note')
    ],
    SZSE: [
        makeBond('BYD-GREEN-2031','corp','BYD Company','BYD Green Bond 2.950% 2031','2.950%',2.95,'11/12/2031',100.8,1008,2.82,{moodys:'A3',sp:'A-',fitch:'A-'},'CN Green ESG','China','CNY','badge-aapl','BYD Green ESG','EV battery expansion financing'),
        makeBond('CN-SOV-30Y','sovereign','Ministry of Finance China','China Ultra-Long Sovereign 30Y 2.570% 2054','2.570%',2.57,'06/15/2054',98.9,989,2.62,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Sovereign','China','CNY','badge-sovereign','China Sov 30Y','Long term sovereign benchmark'),
        makeBond('SHENZHEN-MUNI','muni','Shenzhen Municipal Govt','Shenzhen Special Econ Zone GO 2.45% 2034','2.450%',2.45,'08/01/2034',100.1,1001,2.44,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Municipal','China','CNY','badge-muni','Shenzhen Muni','Tech hub infrastructure bond'),
        makeBond('CATL-CORP-2032','corp','Contemporary Amperex','CATL 3.20% Green Bond 2032','3.200%',3.20,'07/25/2032',101.8,1018,2.96,{moodys:'Baa1',sp:'BBB+',fitch:'A-'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (CATL)','Clean energy supply debt')
    ],
    MOEX: [
        makeBond('OFZ-10Y-26238','sovereign','Ministry of Finance Russia','Russia OFZ 10Y 7.100% 2034','7.100%',7.10,'05/15/2034',88.5,885,12.45,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'RU Sovereign Tax-Exempt','Russia','RUB','badge-sovereign','Russia OFZ 10Y','Federal loan bond benchmark'),
        makeBond('OFZ-5Y-26242','sovereign','Ministry of Finance Russia','Russia OFZ 5Y 9.000% 2029','9.000%',9.00,'08/29/2029',92.4,924,13.10,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'RU Sovereign','Russia','RUB','badge-sovereign','Russia OFZ 5Y','Medium-term treasury bond'),
        makeBond('MOSCOW-MUNI-2031','muni','City of Moscow','Moscow City Green GO 7.38% 2031','7.380%',7.38,'05/27/2031',94.2,942,11.85,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'RU Municipal','Russia','RUB','badge-muni','Moscow Municipal','Moscow urban development bond'),
        makeBond('SBER-CORP-2032','corp','Sberbank','Sberbank Subordinated 8.50% 2032','8.500%',8.50,'10/14/2032',96.8,968,11.20,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'RU Corporate Taxable','Russia','RUB','badge-corp','Corporate (Sberbank)','State banking institution debt'),
        makeBond('GAZP-CORP-2030','corp','Gazprom Capital','Gazprom Bond 8.150% 2030','8.150%',8.15,'02/19/2030',95.0,950,11.60,{moodys:'Baa3',sp:'BBB-',fitch:'BBB-'},'RU Corporate Taxable','Russia','RUB','badge-corp','Corporate (Gazprom)','Energy infrastructure corporate debt')
    ]
};

function getActiveExchangeBonds() { return exchangeBondsData[currentExchange] || exchangeBondsData.NASDAQ; }
function getRatingClass(r) { if(['Aaa','AAA'].includes(r)) return 'rating-prime'; if(['Aa1','Aa2','Aa3','AA+','AA','AA-'].includes(r)) return 'rating-high'; return 'rating-upper-medium'; }

// ==================================================
// GOVERNANCE & COMPLIANCE
// ==================================================
function toggleModal(show) {
    const m = document.getElementById('guidelines-modal');
    if (show) m.classList.add('open'); else m.classList.remove('open');
}

function toggleGainersModal(show) {
    const m = document.getElementById('gainers-modal');
    if (show) {
        m.classList.add('open');
        renderGainersModal();
    } else {
        m.classList.remove('open');
    }
}

function renderGainersModal() {
    const filterSelect = document.getElementById('gainers-exchange-filter');
    const selectedFilter = filterSelect ? filterSelect.value : 'CURRENT';
    const searchQuery = (document.getElementById('gainers-search-input')?.value || '').toLowerCase().trim();

    const tbody = document.getElementById('gainers-modal-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let stockList = [];

    if (selectedFilter === 'ALL') {
        Object.keys(exchangeData).forEach(exKey => {
            const exInfo = exchangeData[exKey];
            exInfo.stocks.forEach(st => {
                stockList.push({ ...st, exchangeKey: exKey, exchangeInfo: exInfo });
            });
        });
    } else if (selectedFilter === 'CURRENT') {
        const exInfo = exchangeData[currentExchange] || exchangeData['NASDAQ'];
        exInfo.stocks.forEach(st => {
            stockList.push({ ...st, exchangeKey: currentExchange, exchangeInfo: exInfo });
        });
    } else {
        const exInfo = exchangeData[selectedFilter];
        if (exInfo) {
            exInfo.stocks.forEach(st => {
                stockList.push({ ...st, exchangeKey: selectedFilter, exchangeInfo: exInfo });
            });
        }
    }

    if (searchQuery) {
        stockList = stockList.filter(s => s.symbol.toLowerCase().includes(searchQuery) || s.name.toLowerCase().includes(searchQuery));
    }

    stockList.sort((a, b) => b.changePercent - a.changePercent);

    if (stockList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:#94a3b8;">No matching stocks found.</td></tr>`;
        return;
    }

    stockList.forEach(item => {
        const isUp = item.changePercent >= 0;
        const rate = fxRates[item.exchangeInfo.currency] || 1;
        const sym = currencySymbols[item.exchangeInfo.currency] || '$';
        const usdValue = item.price / rate;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => {
            if (currentExchange !== item.exchangeKey) {
                changeExchange(item.exchangeKey);
            }
            updateCurrentStock(item);
            toggleGainersModal(false);
        };

        tr.innerHTML = `
            <td style="padding:8px 6px;">
                <span style="font-size:14px; margin-right:4px;">${item.exchangeInfo.flag}</span>
                <span style="font-weight:700; font-size:11px; color:#475569;">${item.exchangeInfo.name}</span>
            </td>
            <td style="padding:8px 6px;">
                <div style="font-weight:700; color:#0f172a;">${item.symbol}</div>
                <div style="font-size:10px; color:#64748b;">${item.name}</div>
            </td>
            <td style="padding:8px 6px; font-weight:700; color:#0f172a;">
                ${sym}${item.price.toFixed(2)} ${item.exchangeInfo.currency}
            </td>
            <td style="padding:8px 6px; font-size:11px; color:#64748b;">
                ≈ $${usdValue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} USD
            </td>
            <td style="padding:8px 6px; font-weight:700; color:${isUp ? '#00c805' : '#ef4444'};">
                ${isUp ? '+' : ''}${item.change.toFixed(2)} (${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%)
            </td>
            <!-- <td style="padding:8px 6px; text-align:right;">
                <button type="button" style="background:#00c805; color:#fff; border:none; border-radius:14px; padding:5px 10px; font-size:10px; font-weight:700; cursor:pointer;" onclick="event.stopPropagation(); if(currentExchange!=='${item.exchangeKey}'){changeExchange('${item.exchangeKey}');} updateCurrentStock(exchangeData['${item.exchangeKey}'].stocks.find(s=>s.symbol==='${item.symbol}')); toggleGainersModal(false);">
                    ⚡ Select Stock
                </button>
            </td> -->
        `;
        tbody.appendChild(tr);
    });
}

// ==================================================
// GOVERNANCE & COMPLIANCE
// ==================================================
const bannedExchanges = {};
const removedExchanges = {};
const bannedBrokerages = {};

function isExchangeBanned(ex) {
    const ban = bannedExchanges[ex];
    if (!ban) return false;
    if (ban.type === 'temp' && ban.expiresAt && new Date(ban.expiresAt) < new Date()) {
        delete bannedExchanges[ex];
        return false;
    }
    return true;
}

function getExchangeBanInfo(ex) {
    if (!isExchangeBanned(ex)) return null;
    return bannedExchanges[ex];
}

function isBrokerageBanned(brokerage) {
    if (!brokerage) return false;
    const ban = bannedBrokerages[brokerage];
    if (!ban) return false;
    if (ban.type === 'temp' && ban.expiresAt && new Date(ban.expiresAt) < new Date()) {
        delete bannedBrokerages[brokerage];
        return false;
    }
    return true;
}

function getBrokerageBanInfo(brokerage) {
    if (!isBrokerageBanned(brokerage)) return null;
    return bannedBrokerages[brokerage];
}

function banBrokerage(brokerage, type, reason, hours = 24) {
    if (!brokerage) return;
    
    if (type === 'lift') {
        delete bannedBrokerages[brokerage];
    } else if (type === 'permanent' || type === 'brokerage_ban') {
        bannedBrokerages[brokerage] = {
            type: 'permanent',
            reason: reason || 'Brokerage Regulatory Action',
            bannedAt: new Date().toISOString(),
            expiresAt: null
        };
    } else {
        bannedBrokerages[brokerage] = {
            type: 'temp',
            reason: reason || 'Temporary Brokerage Suspension',
            bannedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString()
        };
    }
}

function banExchange(ex, type, reason, hours = 24) {
    const targets = ex === 'ALL'
        ? ['NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE','MOEX']
        : [ex];

    targets.forEach(t => {
        if (type === 'lift') {
            delete bannedExchanges[t];
            if (removedExchanges[t]) {
                exchangeData[t] = removedExchanges[t];
                delete removedExchanges[t];
            }
            const selector = document.getElementById('exchange-select');
            if (selector && exchangeData[t] && !selector.querySelector(`option[value="${t}"]`)) {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = `${exchangeData[t].flag} ${exchangeData[t].name} (${exchangeData[t].country})`;
                selector.appendChild(opt);
            }
        } else if (type === 'remove') {
            if (exchangeData[t]) {
                removedExchanges[t] = JSON.parse(JSON.stringify(exchangeData[t]));
            }
            bannedExchanges[t] = {
                type: 'removed',
                reason: reason || 'Removed from SGA Registry',
                bannedAt: new Date().toISOString(),
                expiresAt: null
            };
        } else if (type === 'permanent' || type === 'exchange_ban') {
            bannedExchanges[t] = {
                type: 'permanent',
                reason: reason || 'Network Regulatory Action',
                bannedAt: new Date().toISOString(),
                expiresAt: null
            };
        } else {
            bannedExchanges[t] = {
                type: 'temp',
                reason: reason || 'Temporary Network Suspension',
                bannedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString()
            };
        }
    });
}

function toggleGovernanceModal(show) {
    const m = document.getElementById('governance-modal');
    if (show) { 
        m.classList.add('open'); 
        populateGovUserSelect(); 
        updateGovModalUI(); 
    } else { 
        m.classList.remove('open'); 
    }
}

function populateGovUserSelect() {
    const c = document.getElementById('test-profiles-list');
    if (!c) return;
    c.innerHTML = '';
    testProfiles.forEach(p => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `test-profile-chip ${p.id === currentUserId ? 'active-chip' : ''}`;
        chip.textContent = `${p.id} (${p.name})`;
        chip.onclick = () => selectTestProfile(p.id, p.name);
        c.appendChild(chip);
    });
}

function selectTestProfile(id, name) {
    currentUserId = id;
    if (!sgaUsers[id]) sgaUsers[id] = { id, name, type:'Test', restrictions:{} };
    const uidEl = document.getElementById('gov-target-user-id');
    const unameEl = document.getElementById('gov-target-user-name');
    if (uidEl) uidEl.value = id;
    if (unameEl) unameEl.value = name;
    populateGovUserSelect(); updateGovModalUI(); checkUserExchangeCompliance();
}

function handleUserInputChanges() {
    const uidEl = document.getElementById('gov-target-user-id');
    const unameEl = document.getElementById('gov-target-user-name');
    const id = (uidEl ? uidEl.value.trim() : '') || 'SGA-USR-CUSTOM';
    const name = (unameEl ? unameEl.value.trim() : '') || 'Custom';
    currentUserId = id;
    if (!sgaUsers[id]) sgaUsers[id] = { id, name, type:'Custom', restrictions:{} };
    else sgaUsers[id].name = name;
    populateGovUserSelect(); updateGovModalUI(); checkUserExchangeCompliance();
}

function toggleDurationField(type) {
    const d = document.getElementById('gov-duration-group');
    const b = document.getElementById('gov-apply-btn');

    if (type === 'temp' || type === 'exchange_temp' || type === 'brokerage_temp') {
        if (d) d.style.display = 'block';
        if (b) {
            b.className = 'gov-action-btn bank-btn bank-btn-danger';
            b.style.background = '#f59e0b';
            if (type === 'exchange_temp') {
                b.textContent = 'Suspend Exchange Network-Wide';
            } else if (type === 'brokerage_temp') {
                b.textContent = 'Suspend Brokerage Network-Wide';
            } else {
                b.textContent = 'Apply Temporary User Suspension';
            }
        }
    } else if (type === 'permanent' || type === 'exchange_ban' || type === 'brokerage_ban') {
        if (d) d.style.display = 'none';
        if (b) {
            b.className = 'gov-action-btn bank-btn bank-btn-danger';
            b.style.background = '#dc2626';
            if (type === 'exchange_ban') {
                b.textContent = 'Ban Exchange Network-Wide';
            } else if (type === 'brokerage_ban') {
                b.textContent = 'Ban Brokerage Network-Wide';
            } else {
                b.textContent = 'Apply Permanent User Ban';
            }
        }
    } else if (type === 'remove') {
        if (d) d.style.display = 'none';
        if (b) {
            b.className = 'gov-action-btn bank-btn bank-btn-danger';
            b.style.background = '#991b1b';
            b.textContent = 'Remove Exchange from Registry';
        }
    } else {
        if (d) d.style.display = 'none';
        if (b) {
            b.className = 'gov-action-btn bank-btn';
            b.style.background = '#059669';
            b.textContent = 'Lift Ban & Reinstate Venue';
        }
    }
}

function applyGovernanceAction() {
    try {
        const exchange = document.getElementById('gov-target-exchange-select').value;
        const brokerage = document.getElementById('gov-target-brokerage-select').value;
        const actionType = document.getElementById('gov-enforcement-type').value;
        const hours = parseInt(document.getElementById('gov-suspension-duration').value) || 24;
        const reason = document.getElementById('gov-violation-reason').value;

        // Brokerage Network Enforcement
        if (actionType === 'brokerage_ban' || actionType === 'brokerage_temp') {
            if (!brokerage) {
                alert('Please select a brokerage to apply this enforcement action.');
                return;
            }
            banBrokerage(brokerage, actionType === 'brokerage_ban' ? 'permanent' : 'temp', reason, hours);
            const label = actionType === 'brokerage_ban' ? 'Permanently Banned' : `Suspended ${hours}h`;

            recentTrades.unshift({
                time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
                routing: `${brokerage} Compliance`,
                side: actionType === 'brokerage_ban' ? 'BROKERAGE_BANNED' : 'BROKERAGE_SUSPENDED',
                shares: 'NETWORK',
                priceUSD: 0,
                currency: 'USD',
                totalNative: 0
            });
            updateTradesTable();

            const toast = document.getElementById('gov-toast-feedback');
            if (toast) {
                toast.style.display = 'block';
                toast.style.background = '#fee2e2';
                toast.style.color = '#991b1b';
                toast.style.border = '1px solid #fca5a5';
                toast.innerHTML = `⛔ ENFORCED: ${brokerage} ${label} network-wide`;
                setTimeout(() => { toast.style.display = 'none'; }, 4000);
            }

            updateGovModalUI();
            alert(`🛡️ BROKERAGE NETWORK ACTION ENFORCED!\n\nTarget Brokerage: ${brokerage}\nStatus: ${label}\nReason: ${reason}\n\n⚡ Broadcast signed compliance flag to SGA Ledger.`);
            return;
        }

        // Exchange Network Enforcement
        if (actionType === 'exchange_ban' || actionType === 'exchange_temp' || actionType === 'remove') {
            banExchange(exchange, actionType === 'exchange_ban' ? 'permanent' : actionType === 'remove' ? 'remove' : 'temp', reason, hours);
            const label = actionType === 'exchange_ban' ? 'Permanently Banned' : actionType === 'remove' ? 'Removed from Registry' : `Suspended ${hours}h`;

            recentTrades.unshift({
                time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
                routing: `${exchange === 'ALL' ? 'GLOBAL NETWORK' : exchange} Compliance`,
                side: actionType === 'remove' ? 'EXCH_REMOVED' : 'EXCH_BANNED',
                shares: 'NETWORK',
                priceUSD: 0,
                currency: 'USD',
                totalNative: 0
            });
            updateTradesTable();

            const toast = document.getElementById('gov-toast-feedback');
            if (toast) {
                toast.style.display = 'block';
                toast.style.background = '#fee2e2';
                toast.style.color = '#991b1b';
                toast.style.border = '1px solid #fca5a5';
                toast.innerHTML = `⛔ ENFORCED: ${exchange} ${label} network-wide`;
                setTimeout(() => { toast.style.display = 'none'; }, 4000);
            }

            updateGovModalUI();
            checkUserExchangeCompliance();
            alert(`🛡️ EXCHANGE NETWORK ACTION ENFORCED!\n\nTarget Exchange: ${exchange}\nStatus: ${label}\nReason: ${reason}\n\n⚡ Broadcast signed compliance flag to SGA Ledger.`);
            return;
        }

        // Lift / Reinstate Action (Restores Exchange to Registry if removed, lifts network bans and user restrictions)
        if (actionType === 'lift') {
            // Handle brokerage lift
            if (brokerage) {
                banBrokerage(brokerage, 'lift', '', 0);
                recentTrades.unshift({
                    time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
                    routing: `${brokerage} Compliance`,
                    side: 'BROKERAGE_REINSTATED',
                    shares: 'NETWORK',
                    priceUSD: 0,
                    currency: 'USD',
                    totalNative: 0
                });
                updateTradesTable();

                const toast = document.getElementById('gov-toast-feedback');
                if (toast) {
                    toast.style.display = 'block';
                    toast.style.background = '#dcfce7';
                    toast.style.color = '#15803d';
                    toast.style.border = '1px solid #86efac';
                    toast.innerHTML = `✓ REINSTATED: ${brokerage} restored to SGA Network`;
                    setTimeout(() => { toast.style.display = 'none'; }, 4000);
                }

                updateGovModalUI();
                alert(`🛡️ BROKERAGE GOVERNANCE ACTION ENFORCED!\n\nBrokerage: ${brokerage}\nStatus: Reinstated & Restored to SGA Network\n\n⚡ Broadcast signed compliance flag to SGA Ledger.`);
                return;
            }

            // Handle exchange lift
            banExchange(exchange, 'lift', '', 0);
            const userId = (document.getElementById('gov-target-user-id').value.trim()) || currentUserId;
            if (sgaUsers[userId] && sgaUsers[userId].restrictions) {
                const targets = exchange === 'ALL' ? ['NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE','MOEX'] : [exchange];
                targets.forEach(ex => delete sgaUsers[userId].restrictions[ex]);
            }
            recentTrades.unshift({
                time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
                routing: `${exchange === 'ALL' ? 'GLOBAL NETWORK' : exchange} Compliance`,
                side: 'REINSTATED',
                shares: userId,
                priceUSD: 0,
                currency: 'USD',
                totalNative: 0
            });
            updateTradesTable();

            const toast = document.getElementById('gov-toast-feedback');
            if (toast) {
                toast.style.display = 'block';
                toast.style.background = '#dcfce7';
                toast.style.color = '#15803d';
                toast.style.border = '1px solid #86efac';
                toast.innerHTML = `✓ REINSTATED: ${exchange} restored to SGA Registry & Network`;
                setTimeout(() => { toast.style.display = 'none'; }, 4000);
            }

            updateGovModalUI();
            checkUserExchangeCompliance();
            alert(`🛡️ GOVERNANCE ACTION ENFORCED!\n\nExchange / User: ${exchange}\nStatus: Reinstated & Restored to SGA Registry\n\n⚡ Broadcast signed compliance flag to SGA Ledger.`);
            return;
        }

        // User Scope Enforcement (temp / permanent)
        const uidEl = document.getElementById('gov-target-user-id');
        const unameEl = document.getElementById('gov-target-user-name');
        const userId = (uidEl ? uidEl.value.trim() : '') || currentUserId;
        const userName = (unameEl ? unameEl.value.trim() : '') || 'Custom';
        currentUserId = userId;

        if (!sgaUsers[userId]) sgaUsers[userId] = { id:userId, name:userName, type:'Custom', restrictions:{} };
        else sgaUsers[userId].name = userName;
        if (!sgaUsers[userId].restrictions) sgaUsers[userId].restrictions = {};

        const user = sgaUsers[userId];
        const targets = exchange === 'ALL' ? ['NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE','MOEX'] : [exchange];

        targets.forEach(ex => {
            if (actionType === 'permanent') user.restrictions[ex] = { type:'permanent', reason, expiresAt:null };
            else user.restrictions[ex] = { type:'temp', reason, expiresAt: new Date(Date.now() + hours*3600*1000).toISOString() };
        });

        recentTrades.unshift({ 
            time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}), 
            routing: `${exchange==='ALL'?'GLOBAL':exchange} Compliance`, 
            side: 'ENFORCEMENT', 
            shares: userId, 
            priceUSD: 0, 
            currency: 'USD', 
            totalNative: 0 
        });
        updateTradesTable();

        const label = actionType==='permanent' ? 'Permanently Banned' : `Suspended ${hours}h`;
        const toast = document.getElementById('gov-toast-feedback');
        if (toast) {
            toast.style.display = 'block';
            toast.style.background = '#fee2e2';
            toast.style.color = '#991b1b';
            toast.style.border = '1px solid #fca5a5';
            toast.innerHTML = `⛔ ENFORCED: ${userId} ${label} on ${exchange}`;
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }

        populateGovUserSelect(); 
        updateGovModalUI(); 
        checkUserExchangeCompliance();
        alert(`🛡️ USER GOVERNANCE ACTION!\n\nUser: ${userId} (${userName})\nExchange: ${exchange}\nStatus: ${label}\nReason: ${reason}\n\n⚡ Broadcast to SGA Ledger.`);
    } catch(e) { console.error(e); alert('Error: ' + e.message); }
}

function updateExchangeSelectorUI() {
    const selector = document.getElementById('exchange-select');
    if (!selector) return;
    
    Array.from(selector.options).forEach(opt => {
        const ex = opt.value;
        const info = exchangeData[ex];
        if (!info) return;
        
        if (isExchangeBanned(ex)) {
            const banInfo = getExchangeBanInfo(ex);
            const tag = banInfo.type === 'removed' ? 'REMOVED' : banInfo.type === 'temp' ? 'SUSPENDED' : 'BANNED';
            opt.textContent = `🔴 ${info.name} (${tag})`;
        } else {
            opt.textContent = `${info.flag} ${info.name} (${info.country})`;
        }
    });
}

function updateGovModalUI() {
    const user = sgaUsers[currentUserId];
    const labelEl = document.getElementById('modal-active-user-label');
    if (labelEl && user) labelEl.textContent = `${currentUserId} - ${user.name}`;

    const exchangeSelect = document.getElementById('gov-target-exchange-select');
    if (exchangeSelect) {
        const currentValue = exchangeSelect.value;
        exchangeSelect.innerHTML = `<option value="ALL">ALL EXCHANGES (Global Action)</option>`;
        ['NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE','MOEX'].forEach(ex => {
            const isBanned = isExchangeBanned(ex);
            const banInfo = getExchangeBanInfo(ex);
            const option = document.createElement('option');
            option.value = ex;
            let tag = '';
            if (isBanned && banInfo) {
                tag = banInfo.type === 'removed' ? ' 🔴 (REMOVED FROM REGISTRY)' : ' 🔴 (BANNED)';
            }
            option.textContent = `${ex}${tag}`;
            exchangeSelect.appendChild(option);
        });
        exchangeSelect.value = currentValue || 'ALL';
    }

    const brokerageSelect = document.getElementById('gov-target-brokerage-select');
    if (brokerageSelect) {
        const currentValue = brokerageSelect.value;
        const brokerages = ['Federal Reserve System', 'JP Morgan Clearing Corp', 'Self-Clearing', 'Morgan Stanley Clearing', 'Goldman Sachs Clearing', 'Citigroup Clearing', 'Bank of America Clearing', 'Webull', 'Robinhood', 'Public', 'Fidelity', 'Interactive Brokers', 'Charles Schwab', 'TD Ameritrade', 'E*TRADE'];
        brokerageSelect.innerHTML = `<option value="">-- Select Brokerage (Optional) --</option>`;
        brokerages.forEach(brokerage => {
            const isBanned = isBrokerageBanned(brokerage);
            const banInfo = getBrokerageBanInfo(brokerage);
            const option = document.createElement('option');
            option.value = brokerage;
            let tag = '';
            if (isBanned && banInfo) {
                tag = banInfo.type === 'temp' ? ' ⏳ (SUSPENDED)' : ' 🔴 (BANNED)';
            }
            option.textContent = `${brokerage}${tag}`;
            brokerageSelect.appendChild(option);
        });
        brokerageSelect.value = currentValue || '';
    }

    const tbody = document.getElementById('gov-matrix-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    ['NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE','MOEX'].forEach(ex => {
        const tr = document.createElement('tr');
        
        // 1. Check Exchange Network Ban or Registry Removal FIRST
        if (isExchangeBanned(ex)) {
            const banInfo = getExchangeBanInfo(ex);
            let st = '<span class="status-pill-banned">🔴 Exch Banned</span>';
            if (banInfo.type === 'removed') {
                st = '<span class="status-pill-banned" style="background:#fee2e2; color:#991b1b;">🔴 Removed</span>';
            } else if (banInfo.type === 'temp') {
                st = '<span class="status-pill-temp">⏳ Exch Suspended</span>';
            }
            const dt = banInfo.reason || 'SGA Registry Action';
            tr.innerHTML = `<td style="font-weight:600;">${ex}</td><td>${st}</td><td style="font-size:9px;color:#94a3b8;">${dt}</td>`;
            tbody.appendChild(tr);
            return;
        }

        // 2. Check User Restriction
        const r = user ? user.restrictions[ex] : null;
        let st = '<span class="status-pill-ok">Compliant</span>', dt = 'Full Access';
        if (r) {
            if (r.type === 'permanent') { 
                st = '<span class="status-pill-banned">🔴 User Banned</span>'; 
                dt = r.reason; 
            } else { 
                const exp = new Date(r.expiresAt); 
                if (exp < new Date()) { 
                    if (user) delete user.restrictions[ex]; 
                } else { 
                    st = '<span class="status-pill-temp">⏳ User Suspended</span>'; 
                    dt = r.reason; 
                } 
            }
        }
        tr.innerHTML = `<td style="font-weight:600;">${ex}</td><td>${st}</td><td style="font-size:9px;color:#94a3b8;">${dt}</td>`;
        tbody.appendChild(tr);
    });

    // Update Brokerage Matrix
    const brokerageTbody = document.getElementById('gov-brokerage-matrix-tbody');
    if (brokerageTbody) {
        brokerageTbody.innerHTML = '';
        const brokerages = ['Federal Reserve System', 'JP Morgan Clearing Corp', 'Self-Clearing', 'Morgan Stanley Clearing', 'Goldman Sachs Clearing', 'Citigroup Clearing', 'Bank of America Clearing', 'Webull', 'Robinhood', 'Public', 'Fidelity', 'Interactive Brokers', 'Charles Schwab', 'TD Ameritrade', 'E*TRADE'];
        brokerages.forEach(brokerage => {
            const tr = document.createElement('tr');
            const isBanned = isBrokerageBanned(brokerage);
            const banInfo = getBrokerageBanInfo(brokerage);
            let st = '<span class="status-pill-ok">Compliant</span>';
            let dt = 'Full Access';
            if (isBanned && banInfo) {
                if (banInfo.type === 'temp') {
                    st = '<span class="status-pill-temp">⏳ Suspended</span>';
                } else {
                    st = '<span class="status-pill-banned">🔴 Banned</span>';
                }
                dt = banInfo.reason || 'Brokerage Regulatory Action';
            }
            tr.innerHTML = `<td style="font-weight:600;">${brokerage}</td><td>${st}</td><td style="font-size:9px;color:#94a3b8;">${dt}</td>`;
            brokerageTbody.appendChild(tr);
        });
    }
}


function checkUserExchangeCompliance() {
    updateExchangeSelectorUI();
    const banner = document.getElementById('user-compliance-banner');
    const btn = document.getElementById('action-btn');
    const dot = document.getElementById('header-status-dot');
    const idText = document.getElementById('header-user-id-text');

    // 1. Check Exchange Network-Wide Ban FIRST
    if (isExchangeBanned(currentExchange)) {
        const banInfo = getExchangeBanInfo(currentExchange);
        if (banner) {
            banner.style.display = 'block';
            banner.style.background = '#fef2f2';
            banner.style.borderColor = '#fca5a5';
            banner.style.color = '#991b1b';
            const titleEl = banner.querySelector('.banner-alert-title');
            if (titleEl) {
                const badgeText = banInfo.type === 'removed' ? 'Registry Removed' : 'Network Ban';
                const headerText = banInfo.type === 'removed' ? '⛔ EXCHANGE REMOVED FROM SGA REGISTRY' : '⛔ EXCHANGE BANNED FROM SGA NETWORK';
                titleEl.innerHTML = `<span>${headerText}</span><span class="restriction-badge" style="background:#dc2626;">${badgeText}</span>`;
            }
            const reasonEl = document.getElementById('restriction-reason-msg');
            if (reasonEl) {
                const subText = banInfo.type === 'removed' ? 'are removed from the SGA Clearing Network by Governance.' : 'are suspended by SGA Network Governance.';
                reasonEl.innerHTML = `Settlement channels for <strong>${currentExchange}</strong> ${subText}<br>Reason: <strong>${banInfo.reason}</strong>`;
            }
            const timerEl = document.getElementById('restriction-timer-msg');
            if (timerEl) {
                if (banInfo.type === 'removed') {
                    timerEl.textContent = '⛔ Exchange removed from SGA Registry.';
                } else if (banInfo.type === 'permanent') {
                    timerEl.textContent = '⛔ Permanent exchange network ban active.';
                } else {
                    const exp = new Date(banInfo.expiresAt);
                    timerEl.textContent = `⏳ Suspension active until: ${exp.toLocaleString()}`;
                }
            }
        }
        if (dot) dot.className = 'user-status-dot dot-banned';
        if (btn) {
            btn.disabled = true;
            btn.style.background = '#94a3b8';
            btn.style.cursor = 'not-allowed';
            btn.style.boxShadow = 'none';
            btn.textContent = banInfo.type === 'removed' ? `⛔ EXCHANGE REMOVED (${currentExchange})` : `⛔ EXCHANGE BANNED (${currentExchange})`;
        }
        return;
    }

    // 2. Check User Restriction
    const user = sgaUsers[currentUserId] || sgaUsers['SGA-USR-9042'];
    if (idText) idText.textContent = user.id;
    const r = user.restrictions ? user.restrictions[currentExchange] : null;

    if (r) {
        if (r.type === 'temp' && new Date(r.expiresAt) < new Date()) { 
            delete user.restrictions[currentExchange]; 
            return checkUserExchangeCompliance(); 
        }
        if (banner) {
            banner.style.display = 'block';
            banner.style.background = '#fef2f2';
            banner.style.borderColor = '#fca5a5';
            banner.style.color = '#991b1b';
            const titleEl = banner.querySelector('.banner-alert-title');
            if (titleEl) {
                titleEl.innerHTML = `<span>⛔ USER TRADING SUSPENDED</span><span class="restriction-badge ${r.type==='temp'?'temp':''}">${r.type==='temp'?'Temp Suspension':'Permanent Ban'}</span>`;
            }
            const reasonEl = document.getElementById('restriction-reason-msg');
            if (reasonEl) {
                reasonEl.innerHTML = `SGA ID <strong>${user.id}</strong> restricted on <strong>${currentExchange}</strong>: <strong>${r.reason}</strong>`;
            }
            const badge = document.getElementById('restriction-type-badge');
            const timer = document.getElementById('restriction-timer-msg');
            if (r.type === 'permanent') { 
                if (badge) { badge.className='restriction-badge'; badge.textContent='Permanent'; }
                if (timer) timer.textContent='⛔ Permanent ban enforced.'; 
                if (dot) dot.className='user-status-dot dot-banned'; 
            } else { 
                if (badge) { badge.className='restriction-badge temp'; badge.textContent='Temp'; }
                const exp = new Date(r.expiresAt); 
                if (timer) timer.textContent=`⏳ Expires: ${exp.toLocaleString()}`; 
                if (dot) dot.className='user-status-dot dot-suspended'; 
            }
        }
        if (btn) { 
            btn.disabled = true; 
            btn.style.background = '#94a3b8'; 
            btn.style.cursor = 'not-allowed'; 
            btn.style.boxShadow = 'none'; 
            btn.textContent = `⛔ Restricted on ${currentExchange}`; 
        }
    } else {
        if (banner) banner.style.display = 'none';
        if (dot) dot.className = 'user-status-dot';
        if (btn) { 
            btn.disabled = false; 
            btn.style.cursor = 'pointer'; 
            if (activeTab === 'buy') {
                btn.className = 'review-btn';
                btn.style.background = '#00c805';
                btn.style.boxShadow = '0 2px 4px rgba(0,200,5,0.2)';
                btn.textContent = activeAssetMode === 'bonds' ? 'Buy Bonds' : 'Buy Order';
            } else {
                btn.className = 'review-btn btn-sell';
                btn.style.background = '#ef4444';
                btn.style.boxShadow = '0 2px 4px rgba(239,68,68,0.2)';
                btn.textContent = activeAssetMode === 'bonds' ? 'Sell Bonds' : 'Sell Order';
            } 
        }
    }
}


// ==================================================
// TRADING FUNCTIONS
// ==================================================
function executeMarketTrade() {
    if (isExchangeBanned(currentExchange)) {
        const banInfo = getExchangeBanInfo(currentExchange);
        alert(`⛔ TRADE REJECTED!\n\nExchange ${currentExchange} is banned from the SGA Clearing Network.\nReason: ${banInfo.reason}`);
        return;
    }

    const user = sgaUsers[currentUserId] || sgaUsers['SGA-USR-9042'];
    if (user.restrictions[currentExchange]) { alert(`⛔ TRADE REJECTED!\n\n${user.id} restricted on ${currentExchange}.\nReason: ${user.restrictions[currentExchange].reason}`); return; }


    const input = document.getElementById('trade-amount');
    const amount = parseFloat(input.value.replace(/,/g,'')) || 0;
    const rate = fxRates[activeCurrency] || 1;
    const sym = currencySymbols[activeCurrency] || '$';
    if (amount <= 0) { alert('Enter a valid amount.'); return; }

    let usdVal=0, natVal=0, qty=0;
    if (activeAssetMode === 'bonds') {
        const bond = getActiveExchangeBonds().find(b=>b.id===selectedBondId) || getActiveExchangeBonds()[0];
        usdVal = amount * (bond.pricePar/100); natVal = usdVal * rate; qty = amount/1000;
    } else {
        if (orderMethod==='currency') { natVal=amount; usdVal=amount/rate; qty=usdVal/currentPrice; }
        else { qty=amount; usdVal=qty*currentPrice; natVal=usdVal*rate; }
    }

    const fxFee = activeCurrency==='USD' ? 0 : natVal*0.001;
    const clearFee = 0.5 * rate;
    const isFXTransaction = activeCurrency !== 'USD';

    if (activeTab === 'buy') {
        const debit = natVal + fxFee + clearFee;
        sgaReserves[activeCurrency] -= debit;
        if (activeAssetMode==='bonds') userBondsPar += amount; else userShares += qty;
        recentTrades.unshift({ time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}), routing:`${activeCurrency} Tranche`, side:activeAssetMode==='bonds'?'BUY BOND':'BUY', shares:qty.toFixed(activeAssetMode==='bonds'?1:4), priceUSD:currentPrice, currency:activeCurrency, totalNative:debit });
        
        // Record FX transaction to network ledger if non-native currency
        if (isFXTransaction && typeof recordFXTransactionToNetworkLedger === 'function') {
            recordFXTransactionToNetworkLedger({
                sourceCurrency: activeCurrency,
                destinationCurrency: 'USD',
                sourceAmount: natVal,
                destinationAmount: usdVal,
                exchangeRate: rate,
                stateId: currentStock?.symbol || 'N/A',
                instrumentType: activeAssetMode === 'bonds' ? 'Bond' : 'Stock',
                qty: qty,
                price: currentPrice
            });
        }
        
        alert(`✅ ${activeAssetMode==='bonds'?'BOND':'STOCK'} BUY EXECUTED!\nQty: ${qty.toFixed(4)}\nTotal: ${sym}${debit.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}\n⚡ SGA T+0 cleared.`);
    } else {
        if (activeAssetMode==='bonds' && amount > userBondsPar) { alert('Insufficient bond holdings.'); return; }
        if (activeAssetMode!=='bonds' && qty > userShares) { alert('Insufficient share holdings.'); return; }
        const credit = Math.max(0, natVal - fxFee - clearFee);
        sgaReserves[activeCurrency] += credit;
        if (activeAssetMode==='bonds') userBondsPar -= amount; else userShares -= qty;
        recentTrades.unshift({ time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}), routing:`${activeCurrency} Tranche`, side:activeAssetMode==='bonds'?'SELL BOND':'SELL', shares:qty.toFixed(activeAssetMode==='bonds'?1:4), priceUSD:currentPrice, currency:activeCurrency, totalNative:credit });
        
        // Record FX transaction to network ledger if non-native currency
        if (isFXTransaction && typeof recordFXTransactionToNetworkLedger === 'function') {
            recordFXTransactionToNetworkLedger({
                sourceCurrency: 'USD',
                destinationCurrency: activeCurrency,
                sourceAmount: usdVal,
                destinationAmount: credit,
                exchangeRate: rate,
                stateId: currentStock?.symbol || 'N/A',
                instrumentType: activeAssetMode === 'bonds' ? 'Bond' : 'Stock',
                qty: qty,
                price: currentPrice
            });
        }
        
        alert(`✅ ${activeAssetMode==='bonds'?'BOND':'STOCK'} SELL EXECUTED!\nQty: ${qty.toFixed(4)}\nCredit: ${sym}${credit.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}\n⚡ SGA T+0 cleared.`);
    }
    input.value = orderMethod==='currency' ? '1,000.00' : '10';
    document.getElementById('user-shares-holding').textContent = `${userShares.toFixed(4)} Shares`;
    document.getElementById('user-bonds-holding').textContent = `$${userBondsPar.toLocaleString('en-US',{minimumFractionDigits:2})} Par`;
    updateCalculations(); updateLedgerDisplay(); updateTradesTable();
}

function switchTab(tab) {
    activeTab = tab;
    const b = document.getElementById('tab-buy'), s = document.getElementById('tab-sell'), a = document.getElementById('action-btn');
    if (tab==='buy') { b.className='trade-tab active-buy'; s.className='trade-tab'; if(a){a.className='review-btn';a.style.background='#00c805';a.textContent=activeAssetMode==='bonds'?'Buy Bonds':'Buy Order';} }
    else { b.className='trade-tab'; s.className='trade-tab active-sell'; if(a){a.className='review-btn btn-sell';a.style.background='#ef4444';a.textContent=activeAssetMode==='bonds'?'Sell Bonds':'Sell Order';} }
    checkUserExchangeCompliance(); updateCalculations();
}

function toggleOrderMethod() {
    const input = document.getElementById('trade-amount');
    if (orderMethod==='currency') {
        orderMethod='shares';
        document.getElementById('toggle-method-btn').textContent = 'Switch to ' + activeCurrency;
        document.getElementById('input-label').textContent = activeTab==='buy' ? 'Shares to Buy' : 'Shares to Sell';
        document.getElementById('input-prefix').style.display = 'none';
        document.getElementById('input-suffix').textContent = 'Shares';
        if (input) { input.value = '10'; input.style.paddingLeft = '12px'; input.style.paddingRight = '56px'; }
    } else {
        orderMethod='currency';
        document.getElementById('toggle-method-btn').textContent = 'Switch to Shares';
        document.getElementById('input-label').textContent = activeTab==='buy' ? 'Investment Amount' : 'Target Revenue';
        document.getElementById('input-prefix').style.display = 'inline';
        document.getElementById('input-suffix').textContent = activeCurrency;
        if (input) { input.value = '1,000.00'; input.style.paddingLeft = '28px'; input.style.paddingRight = '48px'; }
    }
    updateCalculations();
}

function setCurrency(curr) {
    activeCurrency = curr;
    const sel = document.getElementById('payment-currency');
    if (sel && sel.value !== curr) sel.value = curr;
    updateCurrencyUI(); updateCalculations(); updateLedgerDisplay();
}

function updateCurrencyUI() {
    const sym = currencySymbols[activeCurrency] || '$';
    const pfx = document.getElementById('input-prefix');
    if (pfx) pfx.textContent = sym;
    if (orderMethod==='currency') { const sfx = document.getElementById('input-suffix'); if (sfx) sfx.textContent = activeCurrency; }
    const rate = fxRates[activeCurrency] || 1;
    const conv = currentPrice * rate;
    const pc = document.getElementById('stock-price-converted');
    if (pc) pc.textContent = `≈ ${sym}${conv.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`;
    const fr = document.getElementById('fx-rate');
    if (fr) fr.textContent = `${rate.toFixed(4)} ${activeCurrency}/USD`;
}

function handleInput(el) { el.value = el.value.replace(/[^0-9.]/g,''); updateCalculations(); }
function formatInput(el) { let v = parseFloat(el.value.replace(/,/g,''))||0; el.value = orderMethod==='currency' ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : Math.floor(v).toString(); updateCalculations(); }

function updateCalculations() {
    const input = document.getElementById('trade-amount');
    const amount = parseFloat(input ? input.value.replace(/,/g,'') : '0') || 0;
    const rate = fxRates[activeCurrency] || 1;
    const sym = currencySymbols[activeCurrency] || '$';
    let usdVal=0, natVal=0, qty=0;
    if (activeAssetMode==='bonds') {
        const bond = getActiveExchangeBonds().find(b=>b.id===selectedBondId) || getActiveExchangeBonds()[0];
        usdVal = amount*(bond.pricePar/100); natVal = usdVal*rate; qty = amount/1000;
    } else {
        if (orderMethod==='currency') { natVal=amount; usdVal=amount/rate; qty=usdVal/currentPrice; }
        else { qty=amount; usdVal=qty*currentPrice; natVal=usdVal*rate; }
    }
    
    // Get fee rates from saved settings or use defaults
    let fxFeeRate = 0.0025; // Default 0.25%
    let gxFeeRate = 0.005; // Default 0.5% GX fee
    let settlementFeeRate = 0; // Default 0 (removed)
    
    // Try to get from saved additional fees
    if (window.additionalFees) {
        if (window.additionalFees.fxFee !== undefined) {
            fxFeeRate = window.additionalFees.fxFee / 100; // Convert percentage to decimal
        }
        if (window.additionalFees.gxFee !== undefined) {
            gxFeeRate = window.additionalFees.gxFee / 100; // Convert percentage to decimal
        }
    }
    // Try to get from FeeSchedule if available
    else if (window.sgaNetwork && window.sgaNetwork.feeSchedule) {
        const schedule = window.sgaNetwork.feeSchedule;
        if (schedule.fxFeeBps) {
            fxFeeRate = schedule.fxFeeBps / 10000; // Convert bps to decimal
        }
        if (schedule.gxFeeBps) {
            gxFeeRate = schedule.gxFeeBps / 10000; // Convert bps to decimal
        }
    }
    
    // Get current exchange currency
    const exchangeInfo = exchangeData[currentExchange] || exchangeData['NASDAQ'];
    const exchangeCurrency = exchangeInfo.currency;
    
    // Calculate fees based on currency and exchange
    let fxFee = 0;
    let gxFee = 0;
    
    // FX fee: if payment currency is not USD
    if (activeCurrency !== 'USD') {
        fxFee = natVal * fxFeeRate;
    }
    
    // GX fee: if payment currency is different from exchange currency
    // Also apply GX fee if payment currency differs from USD (default exchange)
    if (activeCurrency !== exchangeCurrency || (activeCurrency !== 'USD' && exchangeCurrency === 'USD')) {
        gxFee = natVal * gxFeeRate;
    }
    
    // If both FX and GX fees apply, cap at 1% total
    if (fxFee > 0 && gxFee > 0) {
        const totalCombinedFee = fxFee + gxFee;
        const cappedFee = natVal * 0.01; // 1% cap
        if (totalCombinedFee > cappedFee) {
            // Proportionally reduce both fees to stay under 1%
            const reductionFactor = cappedFee / totalCombinedFee;
            fxFee = fxFee * reductionFactor;
            gxFee = gxFee * reductionFactor;
        }
    }
    
    // If both FX and GX fees apply, cap at 1% total
    if (fxFee > 0 && gxFee > 0) {
        const totalCombinedFee = fxFee + gxFee;
        const cappedFee = natVal * 0.01; // 1% cap
        if (totalCombinedFee > cappedFee) {
            // Proportionally reduce both fees to stay under 1%
            const reductionFactor = cappedFee / totalCombinedFee;
            fxFee = fxFee * reductionFactor;
            gxFee = gxFee * reductionFactor;
        }
    }
    
    const clearFee = 0; // Settlement fee removed
    const total = activeTab==='buy' ? natVal+fxFee+gxFee+clearFee : Math.max(0,natVal-fxFee-gxFee-clearFee);

    const el = (id,t) => { const e=document.getElementById(id); if(e) e.textContent=t; };
    el('fee-shares-qty', qty.toLocaleString('en-US',{maximumFractionDigits:4}));
    el('fee-converted-valuation', `$${usdVal.toLocaleString('en-US',{minimumFractionDigits:2})} USD`);
    
    // Show both fees if applicable
    if (fxFee > 0 && gxFee > 0) {
        el('fee-conversion-charge', `${sym}${fxFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency} (FX)`);
        el('fee-settlement-charge', `${sym}${gxFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency} (GX)`);
    } else if (fxFee > 0) {
        el('fee-conversion-charge', `${sym}${fxFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency} (FX)`);
        el('fee-settlement-charge', `${sym}${clearFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
    } else if (gxFee > 0) {
        el('fee-conversion-charge', `${sym}${gxFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency} (GX)`);
        el('fee-settlement-charge', `${sym}${clearFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
    } else {
        el('fee-conversion-charge', `${sym}${clearFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
        el('fee-settlement-charge', `${sym}${clearFee.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
    }
    
    el('fee-total-cost', `${sym}${total.toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
    el('buying-power-reserves', `${sym}${(sgaReserves[activeCurrency]||0).toLocaleString('en-US',{minimumFractionDigits:2})} ${activeCurrency}`);
    el('user-shares-holding', `${userShares.toFixed(4)} Shares`);
}

function updateLedgerDisplay() {
    const c = document.getElementById('ledger-rows-container');
    if (!c) return;
    c.innerHTML = '';
    ['USD','EUR','GBP','JPY','SAR','HKD','INR'].forEach(curr => {
        const bal = sgaReserves[curr]; const sym = currencySymbols[curr]||'$'; const active = curr===activeCurrency;
        const d = document.createElement('div');
        d.className = `ledger-row ${active?'active':''}`;
        d.innerHTML = `<span>${curr} ${active?'• Active':''}</span><span>${sym}${bal.toLocaleString('en-US',{minimumFractionDigits:2})}</span>`;
        c.appendChild(d);
    });
}

function updateTradesTable() {
    const t = document.getElementById('recent-trades-body');
    if (!t) return;
    t.innerHTML = '';
    recentTrades.slice(0,6).forEach(tr => {
        const sym = currencySymbols[tr.currency]||'$';
        const row = document.createElement('tr');
        row.innerHTML = `<td>${tr.time}</td><td style="font-weight:500;">${tr.routing}</td><td><span class="${tr.side.includes('BUY')?'trade-side-buy':'trade-side-sell'}">${tr.side}</span></td><td>$${tr.priceUSD.toFixed(2)}</td><td style="font-weight:600;">${tr.shares}</td><td style="font-weight:600;">${sym}${tr.totalNative.toLocaleString('en-US',{minimumFractionDigits:2})} ${tr.currency}</td>`;
        t.appendChild(row);
    });
}

// ==================================================
// CHART
// ==================================================
function initPriceHistory() {
    priceHistory = []; timeLabels = [];
    let base = 305; const now = new Date();
    for (let i=20; i>=0; i--) { base += (Math.random()-0.48)*0.45; priceHistory.push(base); timeLabels.push(new Date(now.getTime()-i*60000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})); }
    currentPrice = priceHistory[priceHistory.length-1];
}

function drawMarketsChart() {
    const c = document.getElementById('chart-svg-container');
    if (!c || !priceHistory.length) return;
    const w = c.clientWidth||800, h = c.clientHeight||280;
    const pad = {top:20,right:10,bottom:20,left:10};
    const pw = w-pad.left-pad.right, ph = h-pad.top-pad.bottom;
    const mn = Math.min(...priceHistory)*0.999, mx = Math.max(...priceHistory)*1.001, rng = (mx-mn)||1;
    const pts = priceHistory.map((v,i) => ({x:pad.left+(i/(priceHistory.length-1))*pw, y:pad.top+ph-((v-mn)/rng)*ph, price:v, i}));
    const poly = pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${pts[0].x.toFixed(1)},${(pad.top+ph).toFixed(1)} ${poly} ${pts[pts.length-1].x.toFixed(1)},${(pad.top+ph).toFixed(1)}`;
    const up = priceHistory[priceHistory.length-1] >= priceHistory[0];
    const col = up ? '#00c805' : '#ef4444';
    c.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" style="overflow:visible;">
            <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${col}" stop-opacity="0.12"/>
                    <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polygon points="${area}" fill="url(#ag)"/>
            <polyline points="${poly}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line id="hover-line" x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.15)" stroke-width="1" stroke-dasharray="3,3" style="display:none;" />
            <circle id="hover-dot" cx="0" cy="0" r="4" fill="${col}" stroke="#ffffff" stroke-width="2" style="display:none;" />
        </svg>
        <div id="chart-tooltip" style="display:none; position:absolute; background:#1e293b; color:#fff; padding:5px 9px; border-radius:6px; font-size:11px; pointer-events:none; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,0.15); transform:translate(-50%,-120%); font-family:inherit;">
            <div id="tooltip-time" style="color:#94a3b8; font-size:9px; font-weight:600;"></div>
            <div id="tooltip-price" style="font-weight:700; font-size:12px; color:#00c805;"></div>
        </div>
    `;
    setupChartHover(pts, pad, pw);
}

function setupChartHover(pts, pad, pw) {
    const container = document.getElementById('chart-svg-container');
    const tooltip = document.getElementById('chart-tooltip');
    if (!container) return;

    container.onmousemove = function(e) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relativeX = mouseX - pad.left;
        const ratio = relativeX / pw;
        let idx = Math.round(ratio * (pts.length - 1));
        idx = Math.max(0, Math.min(pts.length - 1, idx));
        const pt = pts[idx];
        const hoverLine = document.getElementById('hover-line');
        const hoverDot = document.getElementById('hover-dot');
        if (hoverLine && hoverDot && pt) {
            hoverLine.setAttribute('x1', pt.x); hoverLine.setAttribute('y1', pad.top);
            hoverLine.setAttribute('x2', pt.x); hoverLine.setAttribute('y2', rect.height - pad.bottom);
            hoverLine.style.display = 'inline';
            hoverDot.setAttribute('cx', pt.x); hoverDot.setAttribute('cy', pt.y);
            hoverDot.style.display = 'inline';
            if (tooltip) {
                tooltip.style.display = 'block';
                tooltip.style.left = `${pt.x}px`; tooltip.style.top = `${pt.y}px`;
                const ttTime = document.getElementById('tooltip-time');
                if (ttTime) ttTime.textContent = timeLabels[pt.i] || '';
                const ttPrice = document.getElementById('tooltip-price');
                if (ttPrice) ttPrice.textContent = `$${pt.price.toFixed(2)}`;
            }
        }
    };
    container.onmouseleave = function() {
        const hoverLine = document.getElementById('hover-line');
        const hoverDot = document.getElementById('hover-dot');
        if (hoverLine) hoverLine.style.display = 'none';
        if (hoverDot) hoverDot.style.display = 'none';
        if (tooltip) tooltip.style.display = 'none';
    };
}

function switchTimeframe(tf, btn) {
    document.querySelectorAll('.time-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initPriceHistory(); drawMarketsChart();
}

// ==================================================
// BONDS UI
// ==================================================
function renderBondsGrid(cat='all') {
    activeBondCategory = cat;
    const c = document.getElementById('bonds-grid-container');
    if (!c) return;
    c.innerHTML = '';
    let list = getActiveExchangeBonds();
    if (cat!=='all') list = list.filter(b=>b.category===cat);
    list.forEach(bond => {
        const sel = bond.id===selectedBondId && activeAssetMode==='bonds';
        const card = document.createElement('div');
        card.className = `bond-card-item ${sel?'selected-active':''}`;
        card.innerHTML = `<div><div class="bond-card-header"><div><div class="bond-issuer">${bond.issuer}</div><div class="bond-name">${bond.name}</div></div><span class="bond-badge ${bond.badgeClass}">${bond.badgeText}</span></div><div class="bond-ratings-row"><span class="rating-tag"><span class="rating-agency">Moody's:</span> <span class="rating-value ${getRatingClass(bond.ratings.moodys)}">${bond.ratings.moodys}</span></span><span class="rating-tag"><span class="rating-agency">S&P:</span> <span class="rating-value ${getRatingClass(bond.ratings.sp)}">${bond.ratings.sp}</span></span><span class="rating-tag"><span class="rating-agency">Fitch:</span> <span class="rating-value ${getRatingClass(bond.ratings.fitch)}">${bond.ratings.fitch}</span></span></div></div><div style="font-size:10px;color:#94a3b8;"><strong>Tax:</strong> ${bond.taxStatus}</div><div class="bond-metrics"><div class="metric-cell"><span class="metric-lbl">Coupon</span><span class="metric-val">${bond.coupon}</span></div><div class="metric-cell"><span class="metric-lbl">YTM</span><span class="metric-val ytm-green">${bond.ytm.toFixed(2)}%</span></div><div class="metric-cell"><span class="metric-lbl">Par</span><span class="metric-val">${bond.pricePar.toFixed(2)}%</span></div></div><button class="bond-buy-btn ${sel?'selected-btn':''}" onclick="selectBond('${bond.id}')">${sel?'✓ Selected':'⚡ Trade Bond'}</button>`;
        c.appendChild(card);
    });
}

function filterBondsCategory(cat) {
    document.querySelectorAll('.bond-cat-btn').forEach(b=>b.classList.remove('active'));
    event.target.classList.add('active');
    renderBondsGrid(cat);
}

function selectBond(id) { selectedBondId=id; switchAssetMode('bonds'); renderBondsGrid(activeBondCategory); }
function selectBondFromDropdown(id) { selectedBondId=id; updateBondBanner(); renderBondsGrid(activeBondCategory); updateCalculations(); }

function updateBondDropdown() {
    const s = document.getElementById('bond-instrument-select');
    if (!s) return;
    s.innerHTML = '';
    getActiveExchangeBonds().forEach(b => {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = `[${b.ratings.moodys}] ${b.name} (${b.ytm}% YTM)`;
        if (b.id===selectedBondId) o.selected = true;
        s.appendChild(o);
    });
}

function updateBondBanner() {
    try {
        const list = getActiveExchangeBonds();
        const bond = list.find(b=>b.id===selectedBondId) || list[0];
        const n = document.getElementById('banner-bond-name');
        if (n) n.textContent = bond.name;
        const bg = document.getElementById('banner-bond-badge');
        if (bg) { bg.className = `bond-badge ${bond.badgeClass}`; bg.textContent = bond.badgeText; }
        const sub = document.getElementById('banner-bond-sub');
        if (sub) sub.textContent = `Coupon: ${bond.coupon} • YTM: ${bond.ytm.toFixed(2)}% • Par: ${bond.pricePar.toFixed(2)}% ($${bond.pricePerUnit.toFixed(2)}/unit) • ${bond.taxStatus}`;
        const rc = document.getElementById('banner-bond-ratings');
        if (rc) rc.innerHTML = `<span class="rating-tag"><span class="rating-agency">Moody's:</span> <span class="rating-value ${getRatingClass(bond.ratings.moodys)}">${bond.ratings.moodys}</span></span><span class="rating-tag"><span class="rating-agency">S&P:</span> <span class="rating-value ${getRatingClass(bond.ratings.sp)}">${bond.ratings.sp}</span></span><span class="rating-tag"><span class="rating-agency">Fitch:</span> <span class="rating-value ${getRatingClass(bond.ratings.fitch)}">${bond.ratings.fitch}</span></span>`;
    } catch(e) { console.warn(e); }
}

function switchAssetMode(mode) {
    activeAssetMode = mode;
    const sb = document.getElementById('mode-stock-btn'), bb = document.getElementById('mode-bond-btn');
    const bn = document.getElementById('bond-selected-banner'), bf = document.getElementById('bond-selector-field');
    const tb = document.getElementById('tab-buy'), ts = document.getElementById('tab-sell');
    if (mode==='bonds') {
        if(sb) sb.className='asset-mode-btn'; if(bb) bb.className='asset-mode-btn active-bond';
        if(bn) bn.style.display='block'; if(bf) bf.style.display='block';
        if(tb) tb.textContent='Buy Bonds'; if(ts) ts.textContent='Sell Bonds';
        updateBondDropdown(); updateBondBanner();
    } else {
        if(sb) sb.className='asset-mode-btn active'; if(bb) bb.className='asset-mode-btn';
        if(bn) bn.style.display='none'; if(bf) bf.style.display='none';
        if(tb) tb.textContent=`Buy ${currentStock.symbol}`; if(ts) ts.textContent=`Sell ${currentStock.symbol}`;
    }
    renderBondsGrid(activeBondCategory); updateCalculations(); checkUserExchangeCompliance();
}

// ==================================================
// EXCHANGE & GAINERS
// ==================================================
function changeExchange(ex) {
    currentExchange = ex;
    const info = exchangeData[ex];
    currentStock = info.stocks[0]; currentPrice = currentStock.price; prevPrice = currentPrice;
    document.getElementById('exchange-select').value = ex;
    document.getElementById('active-exchange-flag').textContent = info.flag;
    document.getElementById('stock-symbol').textContent = currentStock.symbol;
    document.getElementById('stock-name').textContent = currentStock.name;
    document.getElementById('stock-exchange-tag').textContent = `${info.name} (${info.country})`;
    document.getElementById('stock-price').textContent = `$${currentPrice.toFixed(2)}`;
    const isUp = currentStock.change >= 0;
    const chEl = document.getElementById('stock-change');
    chEl.textContent = `${isUp?'+':''}${currentStock.change.toFixed(2)} (${isUp?'+':''}${currentStock.changePercent.toFixed(2)}%) Today`;
    chEl.className = `stock-change ${isUp?'':'negative'}`;
    document.getElementById('gainers-exchange-label').textContent = info.name;
    setCurrency(info.currency); initPriceHistory(); updateTopGainers();
    const al = getActiveExchangeBonds(); if (al.length) selectedBondId = al[0].id;
    const sub = document.querySelector('.bonds-subtitle');
    if (sub) sub.textContent = `${info.name} Fixed Income: ${info.country} Municipal Bonds, ${info.currency} Sovereign Debt & Apple Notes`;
    renderBondsGrid(activeBondCategory); updateBondDropdown(); updateBondBanner(); updateCalculations(); drawMarketsChart();
    checkUserExchangeCompliance();
}

function updateTopGainers() {
    const c = document.getElementById('top-gainers-list');
    if (!c) return;
    c.innerHTML = '';
    const info = exchangeData[currentExchange];
    info.stocks.forEach(stock => {
        const d = document.createElement('div');
        d.className = 'gainer-item';
        d.onclick = () => updateCurrentStock(stock);
        const up = stock.change >= 0;
        const sym = currencySymbols[info.currency] || '$';
        d.innerHTML = `<div class="gainer-info"><span class="gainer-symbol">${stock.symbol}</span><span class="gainer-name">${stock.name}</span></div><div class="gainer-stats"><span class="gainer-price">${sym}${stock.price.toFixed(2)}</span><span class="gainer-change">${up?'+':''}${stock.changePercent.toFixed(2)}%</span></div>`;
        c.appendChild(d);
    });
}

function updateCurrentStock(stock) {
    currentStock = stock; currentPrice = stock.price; prevPrice = stock.price;
    document.getElementById('stock-symbol').textContent = stock.symbol;
    document.getElementById('stock-name').textContent = stock.name;
    document.getElementById('stock-price').textContent = `$${stock.price.toFixed(2)}`;
    const up = stock.change >= 0;
    const ch = document.getElementById('stock-change');
    ch.textContent = `${up?'+':''}${stock.change.toFixed(2)} (${up?'+':''}${stock.changePercent.toFixed(2)}%) Today`;
    ch.className = `stock-change ${up?'':'negative'}`;
    initPriceHistory(); updateCalculations(); drawMarketsChart();
}

// ==================================================
// INIT & TICKERS
// ==================================================
document.addEventListener('DOMContentLoaded', () => {
    initPriceHistory();
    updateCurrencyUI(); updateCalculations(); updateLedgerDisplay();
    updateTopGainers(); renderBondsGrid('all'); updateBondDropdown(); updateBondBanner();
    drawMarketsChart(); checkUserExchangeCompliance();
    setInterval(tickPrice, 2000);
    setInterval(simulateTrades, 3500);
    setInterval(simulateFX, 5000);
});

function tickPrice() {
    const drift = 0.0001, vol = 0.00085;
    prevPrice = currentPrice;
    currentPrice *= (1 + (Math.random()-0.49)*vol + drift);
    if (priceHistory.length) { priceHistory.push(currentPrice); priceHistory.shift(); }
    if (timeLabels.length) { timeLabels.push(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})); timeLabels.shift(); }
    document.getElementById('stock-price').textContent = `$${currentPrice.toFixed(2)}`;
    updateCurrencyUI(); updateCalculations(); drawMarketsChart();
}

function simulateTrades() {
    const tranches = ['SGA-East','SGA-West','EUR Tranche','GBP Tranche','JPY Tranche','HKD Tranche'];
    const currs = ['USD','EUR','GBP','JPY','SAR','HKD'];
    const side = Math.random()>0.5 ? 'BUY' : 'SELL';
    const qty = Math.floor(Math.random()*35)+1;
    const pr = currentPrice + (Math.random()-0.5)*0.12;
    const cr = currs[Math.floor(Math.random()*currs.length)];
    const rate = fxRates[cr]||1;
    recentTrades.unshift({ time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}), routing:tranches[Math.floor(Math.random()*tranches.length)], side, shares:qty.toString(), priceUSD:pr, currency:cr, totalNative:qty*pr*rate });
    if (recentTrades.length > 20) recentTrades.pop();
    updateTradesTable();
}

function simulateFX() {
    const keys = Object.keys(fxRates).filter(c=>c!=='USD');
    const t = keys[Math.floor(Math.random()*keys.length)];
    fxRates[t] = Math.max(0.1, fxRates[t] * (1 + (Math.random()-0.5)*0.0012));
    updateCurrencyUI(); updateCalculations(); updateLedgerDisplay();
}

window.addEventListener('resize', drawMarketsChart);


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
        drawMarketsChart();
        checkUserExchangeCompliance();
        setInterval(tickPrice, 2000);
        setInterval(simulateTrades, 3500);
        setInterval(simulateFX, 4000);
    } else {
        drawMarketsChart();
        updateCurrencyUI();
        updateCalculations();
        checkUserExchangeCompliance();
    }
}
window.renderMarketsPage = renderMarketsPage;


// ==================================================
// CHINA STOCK MARKET SCREENER LOGIC
// ==================================================
let screenerState = {
    activeExchange: 'ALL',
    searchQuery: '',
    sectorFilter: 'ALL',
    quickFilter: 'ALL',
    sortColumn: 'marketCap',
    sortDir: 'desc',
    currentPage: 1,
    pageSize: 20
};

function switchMarketsTab(tabName) {
    const tradingView = document.getElementById('markets-trading-view');
    const screenerView = document.getElementById('markets-screener-view');
    const btnTrading = document.getElementById('tab-btn-trading');
    const btnScreener = document.getElementById('tab-btn-screener');

    if (!tradingView || !screenerView) return;

    // Hide all views
    tradingView.classList.add('hidden');
    screenerView.classList.add('hidden');

    // Remove active from all buttons
    if (btnTrading) btnTrading.classList.remove('active');
    if (btnScreener) btnScreener.classList.remove('active');

    // Show selected view and activate button
    if (tabName === 'screener') {
        screenerView.classList.remove('hidden');
        if (btnScreener) btnScreener.classList.add('active');
        renderScreener();
    } else {
        tradingView.classList.remove('hidden');
        if (btnTrading) btnTrading.classList.add('active');
    }
}

function getChinaScreenerStocks() {
    let list = [];
    if (screenerState.activeExchange === 'ALL' || screenerState.activeExchange === 'SSE') {
        if (exchangeData.SSE && exchangeData.SSE.stocks) {
            list = list.concat(exchangeData.SSE.stocks.map(s => ({ ...s, exchange: 'SSE', exFlag: '🇨🇳', currencySymbol: '¥' })));
        }
    }
    if (screenerState.activeExchange === 'ALL' || screenerState.activeExchange === 'SZSE') {
        if (exchangeData.SZSE && exchangeData.SZSE.stocks) {
            list = list.concat(exchangeData.SZSE.stocks.map(s => ({ ...s, exchange: 'SZSE', exFlag: '🇨🇳', currencySymbol: '¥' })));
        }
    }
    return list;
}

function parseMarketCapValue(mc) {
    if (!mc) return 0;
    let str = String(mc).toUpperCase()
        .replace(/[¥$€£₹₩₽₴₺₪฿Rp₫₱NT$₫złKčFtleikrR﷼₦E£DHKSh₨৳RsдинКМ]/g, '')
        .replace('C$', '').replace('A$', '').replace('HK$', '').replace('S$', '').replace('NZ$', '').replace('B$', '')
        .replace('FR.', '').replace('SAR', '').replace('AED', '').replace('RM', '').replace('MX$', '')
        .replace('R$', '').replace('AR$', '').replace('CL$', '').replace('COL$', '').replace('S/', '')
        .replace('BS.', '').replace('QR', '').replace('KD', '').replace('BD', '').trim();
    if (str.endsWith('T')) return parseFloat(str) * 1e12;
    if (str.endsWith('B')) return parseFloat(str) * 1e9;
    if (str.endsWith('M')) return parseFloat(str) * 1e6;
    return parseFloat(str) || 0;
}

function parseVolumeValue(vol) {
    if (!vol) return 0;
    let str = String(vol).toUpperCase()
        .replace(/[¥$€£₹₩₽₴₺₪฿Rp₫₱NT$₫złKčFtleikrR﷼₦E£DHKSh₨৳RsдинКМ]/g, '')
        .replace('C$', '').replace('A$', '').replace('HK$', '').replace('S$', '').replace('NZ$', '').replace('B$', '')
        .replace('FR.', '').replace('SAR', '').replace('AED', '').replace('RM', '').replace('MX$', '')
        .replace('R$', '').replace('AR$', '').replace('CL$', '').replace('COL$', '').replace('S/', '')
        .replace('BS.', '').replace('QR', '').replace('KD', '').replace('BD', '').trim();
    if (str.endsWith('M')) return parseFloat(str) * 1e6;
    if (str.endsWith('B')) return parseFloat(str) * 1e9;
    if (str.endsWith('K')) return parseFloat(str) * 1e3;
    return parseFloat(str) || 0;
}

function renderScreener() {
    const searchInput = document.getElementById('screener-search-input');
    const sectorSelect = document.getElementById('screener-sector-select');
    
    if (searchInput) screenerState.searchQuery = searchInput.value.toLowerCase().trim();
    if (sectorSelect) screenerState.sectorFilter = sectorSelect.value;

    let stocks = getChinaScreenerStocks();

    // 1. Text Search Filter
    if (screenerState.searchQuery) {
        stocks = stocks.filter(s => 
            s.symbol.toLowerCase().includes(screenerState.searchQuery) ||
            s.name.toLowerCase().includes(screenerState.searchQuery) ||
            s.sector.toLowerCase().includes(screenerState.searchQuery)
        );
    }

    // 2. Sector Filter
    if (screenerState.sectorFilter !== 'ALL') {
        stocks = stocks.filter(s => s.sector && s.sector.toLowerCase().includes(screenerState.sectorFilter.toLowerCase()));
    }

    // 3. Quick Filter Pills
    if (screenerState.quickFilter === 'GAINERS') {
        stocks = stocks.filter(s => s.changePercent > 0);
    } else if (screenerState.quickFilter === 'LOSERS') {
        stocks = stocks.filter(s => s.changePercent < 0);
    } else if (screenerState.quickFilter === 'ACTIVE') {
        stocks = stocks.sort((a, b) => parseVolumeValue(b.volume) - parseVolumeValue(a.volume));
    } else if (screenerState.quickFilter === 'LOWPE') {
        stocks = stocks.filter(s => s.peRatio && s.peRatio > 0 && s.peRatio < 12);
    }

    // Update Market Breadth Banner Metrics
    updateMarketBreadthBanner(getChinaScreenerStocks());

    // 4. Sorting
    stocks.sort((a, b) => {
        let valA = a[screenerState.sortColumn];
        let valB = b[screenerState.sortColumn];

        if (screenerState.sortColumn === 'marketCap') {
            valA = parseMarketCapValue(valA);
            valB = parseMarketCapValue(valB);
        } else if (screenerState.sortColumn === 'volume') {
            valA = parseVolumeValue(valA);
            valB = parseVolumeValue(valB);
        }

        if (typeof valA === 'string') {
            return screenerState.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return screenerState.sortDir === 'asc' ? valA - valB : valB - valA;
    });

    // Meta Count
    const metaCount = document.getElementById('screener-meta-count');
    if (metaCount) metaCount.textContent = stocks.length;

    // 5. Pagination
    const totalPages = Math.ceil(stocks.length / screenerState.pageSize) || 1;
    if (screenerState.currentPage > totalPages) screenerState.currentPage = totalPages;
    if (screenerState.currentPage < 1) screenerState.currentPage = 1;

    const pageInfo = document.getElementById('screener-page-info');
    if (pageInfo) pageInfo.textContent = `Page ${screenerState.currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('screener-prev-btn');
    const nextBtn = document.getElementById('screener-next-btn');
    if (prevBtn) prevBtn.disabled = screenerState.currentPage === 1;
    if (nextBtn) nextBtn.disabled = screenerState.currentPage === totalPages;

    const startIndex = (screenerState.currentPage - 1) * screenerState.pageSize;
    const paginatedStocks = stocks.slice(startIndex, startIndex + screenerState.pageSize);

    // Render Table Rows
    const tbody = document.getElementById('screener-tbody');
    if (!tbody) return;

    if (paginatedStocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">No Chinese stocks found matching your filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginatedStocks.map(s => {
        const isGain = s.changePercent >= 0;
        const changeClass = isGain ? 'screener-gain' : 'screener-loss';
        const changeSign = isGain ? '+' : '';
        const sectorClass = getSectorBadgeClass(s.sector);

        return `<tr>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <span class="screener-ticker">${s.symbol}</span>
                        <span class="screener-ex-tag">${s.exchange}</span>
                    </div>
                    <span class="screener-name">${s.name}</span>
                </div>
            </td>
            <td><span class="screener-sector-badge ${sectorClass}">${s.sector || 'General'}</span></td>
            <td class="num-col font-mono" style="font-weight: 600; color: #fff;">¥${s.price.toFixed(2)}</td>
            <td class="num-col font-mono ${changeClass}" style="font-weight: 700;">
                ${changeSign}${s.changePercent.toFixed(2)}%
                <div style="font-size: 0.68rem; opacity: 0.8;">${changeSign}¥${Math.abs(s.change || 0).toFixed(2)}</div>
            </td>
            <td class="num-col font-mono" style="color: #cbd5e1;">${s.marketCap || 'N/A'}</td>
            <td class="num-col font-mono" style="color: #94a3b8;">${s.volume || 'N/A'}</td>
            <td class="num-col font-mono" style="color: #cbd5e1;">${s.peRatio ? s.peRatio.toFixed(1) : 'N/A'}</td>
            <td class="num-col font-mono" style="font-size: 0.7rem; color: #94a3b8;">
                ¥${s['52wLow'] ? s['52wLow'].toFixed(2) : '-'} - ¥${s['52wHigh'] ? s['52wHigh'].toFixed(2) : '-'}
            </td>
            <!-- <td style="text-align: center;">
                <button onclick="window.inspectScreenerStock('${s.symbol}', '${s.exchange}')" class="screener-inspect-btn">
                    📊 Trade
                </button>
            </td> -->
        </tr>`;
    }).join('');
}

function getSectorBadgeClass(sector) {
    if (!sector) return 'sector-general';
    const s = sector.toLowerCase();
    if (s.includes('tech') || s.includes('chip') || s.includes('semiconductor')) return 'sector-tech';
    if (s.includes('finan') || s.includes('bank')) return 'sector-financials';
    if (s.includes('staples') || s.includes('spirit') || s.includes('food')) return 'sector-consumer-staples';
    if (s.includes('discretion') || s.includes('auto') || s.includes('appliance')) return 'sector-consumer-discretionary';
    if (s.includes('health') || s.includes('pharma') || s.includes('bio')) return 'sector-healthcare';
    if (s.includes('industr') || s.includes('defense') || s.includes('rail')) return 'sector-industrials';
    if (s.includes('ener') || s.includes('oil') || s.includes('coal')) return 'sector-energy';
    if (s.includes('mater') || s.includes('mining') || s.includes('lithium')) return 'sector-materials';
    if (s.includes('util') || s.includes('power')) return 'sector-utilities';
    if (s.includes('communic')) return 'sector-communication';
    return 'sector-general';
}

function updateMarketBreadthBanner(allStocks) {
    let total = allStocks.length;
    let up = allStocks.filter(s => s.changePercent > 0).length;
    let down = allStocks.filter(s => s.changePercent < 0).length;
    let pct = total > 0 ? Math.round((up / total) * 100) : 0;

    const bPct = document.getElementById('screener-breadth-pct');
    const bCounts = document.getElementById('screener-breadth-counts');
    if (bPct) {
        bPct.textContent = `${pct}% Gainers`;
        bPct.className = `breadth-card-value ${pct >= 50 ? 'gain' : 'loss'}`;
    }
    if (bCounts) {
        bCounts.textContent = `${up} Up · ${down} Down`;
    }
}

function sortScreenerBy(column) {
    if (screenerState.sortColumn === column) {
        screenerState.sortDir = screenerState.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        screenerState.sortColumn = column;
        screenerState.sortDir = 'desc';
    }
    renderScreener();
}

function setScreenerQuickFilter(filter) {
    screenerState.quickFilter = filter;
    screenerState.currentPage = 1;
    
    ['all', 'gainers', 'losers', 'active', 'lowpe'].forEach(f => {
        const btn = document.getElementById(`pill-filter-${f}`);
        if (btn) {
            if (f.toUpperCase() === filter) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    renderScreener();
}

function changeScreenerExchange(ex) {
    screenerState.activeExchange = ex;
    screenerState.currentPage = 1;
    renderScreener();
}

function changeScreenerPage(delta) {
    screenerState.currentPage += delta;
    renderScreener();
}

function inspectScreenerStock(symbol, exchange) {
    // Navigate to markets page for trading
    window.location.hash = '#markets';
    if (window.changeExchange) {
        window.changeExchange(exchange);
    }
    const exData = exchangeData[exchange];
    if (exData && exData.stocks) {
        const found = exData.stocks.find(s => s.symbol === symbol);
        if (found && window.selectStock) {
            window.selectStock(found);
        }
    }
}

// EXPOSE MARKETS FUNCTIONS TO WINDOW FOR INLINE HTML EVENT HANDLERS
window.switchMarketsTab = switchMarketsTab;
window.getChinaScreenerStocks = getChinaScreenerStocks;
window.renderScreener = renderScreener;
window.sortScreenerBy = sortScreenerBy;
window.setScreenerQuickFilter = setScreenerQuickFilter;
window.changeScreenerExchange = changeScreenerExchange;
window.changeScreenerPage = changeScreenerPage;
window.inspectScreenerStock = inspectScreenerStock;

window.toggleGovernanceModal = toggleGovernanceModal;
window.toggleModal = toggleModal;
window.toggleGainersModal = toggleGainersModal;
window.renderGainersModal = renderGainersModal;
window.populateGovUserSelect = populateGovUserSelect;
window.selectTestProfile = selectTestProfile;
window.handleUserInputChanges = handleUserInputChanges;
window.toggleDurationField = toggleDurationField;
window.applyGovernanceAction = applyGovernanceAction;
window.updateGovModalUI = updateGovModalUI;
window.checkUserExchangeCompliance = checkUserExchangeCompliance;
window.executeMarketTrade = executeMarketTrade;
window.switchTab = switchTab;
window.toggleOrderMethod = toggleOrderMethod;
window.setCurrency = setCurrency;
window.updateCurrencyUI = updateCurrencyUI;
window.handleInput = handleInput;
window.formatInput = formatInput;
window.updateCalculations = updateCalculations;
window.updateLedgerDisplay = updateLedgerDisplay;
window.updateTradesTable = updateTradesTable;
window.initPriceHistory = initPriceHistory;
window.drawMarketsChart = drawMarketsChart;
window.setupChartHover = setupChartHover;
window.switchTimeframe = switchTimeframe;
window.renderBondsGrid = renderBondsGrid;
window.filterBondsCategory = filterBondsCategory;
window.selectBond = selectBond;
window.selectBondFromDropdown = selectBondFromDropdown;
window.updateBondDropdown = updateBondDropdown;
window.updateBondBanner = updateBondBanner;
window.switchAssetMode = switchAssetMode;
window.changeExchange = changeExchange;
window.updateTopGainers = updateTopGainers;
window.updateCurrentStock = updateCurrentStock;
window.tickPrice = tickPrice;
window.simulateTrades = simulateTrades;
window.simulateFX = simulateFX;
window.isExchangeBanned = isExchangeBanned;
window.getExchangeBanInfo = getExchangeBanInfo;
window.banExchange = banExchange;
window.isBrokerageBanned = isBrokerageBanned;
window.getBrokerageBanInfo = getBrokerageBanInfo;
window.banBrokerage = banBrokerage;

// ========================================================
// SCANNER MODE CONTROLLER (SGA VS GLOBAL EXCHANGE GX)
// ========================================================
window.currentScannerMode = localStorage.getItem('sga_scanner_mode') || 'sga';

window.switchScannerMode = function(mode) {
    window.currentScannerMode = mode;
    try {
        localStorage.setItem('sga_scanner_mode', mode);
    } catch (e) {}

    const sgaBtn = document.getElementById('scanner-mode-sga-btn');
    const gxBtn = document.getElementById('scanner-mode-gx-btn');
    const track = document.getElementById('scanner-toggle-track');
    const indicator = document.getElementById('scanner-toggle-indicator');
    const titleText = document.getElementById('scanner-header-text');
    const subtitleText = document.getElementById('scanner-header-subtitle');
    const dot = document.getElementById('scanner-header-dot');
    const sgaContainer = document.getElementById('screener-container');
    const gxContainer = document.getElementById('gx-screener-container');

    if (mode === 'gx') {
        if (sgaBtn) sgaBtn.classList.remove('active');
        if (gxBtn) gxBtn.classList.add('active');
        if (track) track.classList.add('gx-active');
        if (indicator) {
            indicator.textContent = 'GX';
            indicator.style.color = '#fbbf24';
        }
        if (titleText) titleText.textContent = 'Global Exchange (GX) World Scanner';
        if (subtitleText) subtitleText.textContent = 'Real-time multi-exchange scanner tracking world equities across NASDAQ, NYSE, LSE, XETRA, TSE, HKEX, Tadawul, NSE, ASX, SIX, BME, Euronext, SSE, SZSE, and MOEX';
        if (dot) {
            dot.style.background = '#fbbf24';
            dot.style.boxShadow = '0 0 10px #fbbf24';
        }
        if (sgaContainer) sgaContainer.classList.add('hidden');
        if (gxContainer) gxContainer.classList.remove('hidden');

        loadGxScreenerContent();
        renderGxTable();
    } else {
        if (sgaBtn) sgaBtn.classList.add('active');
        if (gxBtn) gxBtn.classList.remove('active');
        if (track) track.classList.remove('gx-active');
        if (indicator) {
            indicator.textContent = 'SGA';
            indicator.style.color = '#38bdf8';
        }
        if (titleText) titleText.textContent = 'SGA Stock Market Scanner';
        if (subtitleText) subtitleText.textContent = 'Real-time sovereign growth asset data with advanced metrics including RVOL, Delta, and institutional flow analysis';
        if (dot) {
            dot.style.background = 'var(--accent-blue)';
            dot.style.boxShadow = '0 0 10px var(--accent-blue)';
        }
        if (sgaContainer) sgaContainer.classList.remove('hidden');
        if (gxContainer) gxContainer.classList.add('hidden');

        if (typeof loadScreenerContent === 'function') {
            loadScreenerContent();
        }
    }
};

window.toggleScannerModeQuick = function() {
    const nextMode = window.currentScannerMode === 'sga' ? 'gx' : 'sga';
    window.switchScannerMode(nextMode);
};

// ========================================================
// GLOBAL EXCHANGE (GX) SCANNER IMPLEMENTATION
// ========================================================

const gxScreenerState = {
    region: 'ALL',
    exchange: 'ALL',
    sector: 'ALL',
    quickFilter: 'all',
    searchQuery: '',
    minRvol: 0,
    minGain: 0,
    minDelta: 0,
    minMarketCap: 0,
    maxMarketCap: 0,
    minFloat: 0,
    maxFloat: 0,
    sortColumn: 'marketCap',
    sortAscending: false,
    currentPage: 1,
    pageSize: 25,
    nativeCurrency: 'USD' // Investor's native currency for price conversion (auto-detected)
};

// Country Code to Currency Mapping (ISO 3166-1 alpha-2)
const countryToCurrency = {
    'US': 'USD',
    'CA': 'CAD',
    'GB': 'GBP',
    'AU': 'AUD',
    'NZ': 'NZD',
    'IE': 'EUR',
    'FR': 'EUR',
    'DE': 'EUR',
    'ES': 'EUR',
    'IT': 'EUR',
    'NL': 'EUR',
    'PT': 'EUR',
    'GR': 'EUR',
    'FI': 'EUR',
    'SE': 'SEK',
    'NO': 'NOK',
    'DK': 'DKK',
    'PL': 'PLN',
    'CZ': 'CZK',
    'HU': 'HUF',
    'RO': 'RON',
    'BG': 'BGN',
    'HR': 'EUR',
    'SI': 'EUR',
    'SK': 'EUR',
    'EE': 'EUR',
    'LV': 'EUR',
    'LT': 'EUR',
    'AT': 'EUR',
    'BE': 'EUR',
    'LU': 'EUR',
    'CY': 'EUR',
    'MT': 'EUR',
    'JP': 'JPY',
    'KR': 'KRW',
    'CN': 'CNY',
    'HK': 'HKD',
    'TW': 'TWD',
    'SG': 'SGD',
    'IN': 'INR',
    'TH': 'THB',
    'ID': 'IDR',
    'MY': 'MYR',
    'VN': 'VND',
    'PH': 'PHP',
    'SA': 'SAR',
    'AE': 'AED',
    'QA': 'QAR',
    'KW': 'KWD',
    'BH': 'BHD',
    'OM': 'OMR',
    'IL': 'ILS',
    'TR': 'TRY',
    'RU': 'RUB',
    'UA': 'UAH',
    'RS': 'RSD',
    'BA': 'BAM',
    'MK': 'MKD',
    'ME': 'EUR',
    'AL': 'EUR',
    'XK': 'EUR',
    'CH': 'CHF',
    'IS': 'ISK',
    'NO': 'NOK',
    'MX': 'MXN',
    'BR': 'BRL',
    'AR': 'ARS',
    'CL': 'CLP',
    'CO': 'COP',
    'PE': 'PEN',
    'VE': 'VES',
    'ZA': 'ZAR',
    'NG': 'NGN',
    'EG': 'EGP',
    'MA': 'MAD',
    'KE': 'KES',
    'PK': 'PKR',
    'BD': 'BDT',
    'LK': 'LKR',
    'NP': 'NPR',
    'MM': 'MMK',
    'KH': 'KHR',
    'LA': 'LAK',
    'BN': 'BND',
    'MV': 'MVR',
    'default': 'USD'
};

// Detect user's currency based on IP geolocation
async function detectUserCurrency() {
    try {
        // Try multiple free IP geolocation APIs
        const apis = [
            'https://ipapi.co/json/',
            'https://ip-api.com/json/',
            'https://api.ipify.org?format=json' // Fallback to just get IP
        ];
        
        for (const apiUrl of apis) {
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                // Extract country code from different API response formats
                let countryCode = null;
                
                if (data.country_code) {
                    countryCode = data.country_code.toUpperCase();
                } else if (data.countryCode) {
                    countryCode = data.countryCode.toUpperCase();
                } else if (data.ip) {
                    // If we only got IP, try a different approach
                    continue;
                }
                
                if (countryCode && countryToCurrency[countryCode]) {
                    console.log('Detected country:', countryCode, 'from IP geolocation');
                    return countryToCurrency[countryCode];
                }
                
            } catch (e) {
                console.warn('API failed:', apiUrl, e);
                continue;
            }
        }
        
        // If all APIs fail, fallback to browser timezone detection
        console.warn('IP geolocation failed, falling back to timezone');
        return detectCurrencyFromTimezone();
        
    } catch (e) {
        console.warn('Currency detection failed:', e);
        return detectCurrencyFromTimezone();
    }
}

// Fallback: Detect currency from timezone
function detectCurrencyFromTimezone() {
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('Using timezone:', timezone);
        
        // Map common timezones to currencies
        const timezoneToCurrency = {
            'America/New_York': 'USD',
            'America/Chicago': 'USD',
            'America/Denver': 'USD',
            'America/Los_Angeles': 'USD',
            'America/Toronto': 'CAD',
            'America/Vancouver': 'CAD',
            'Europe/London': 'GBP',
            'Europe/Paris': 'EUR',
            'Europe/Berlin': 'EUR',
            'Europe/Rome': 'EUR',
            'Europe/Madrid': 'EUR',
            'Europe/Amsterdam': 'EUR',
            'Europe/Brussels': 'EUR',
            'Europe/Vienna': 'EUR',
            'Europe/Zurich': 'CHF',
            'Asia/Tokyo': 'JPY',
            'Asia/Seoul': 'KRW',
            'Asia/Shanghai': 'CNY',
            'Asia/Hong_Kong': 'HKD',
            'Asia/Singapore': 'SGD',
            'Asia/Kolkata': 'INR',
            'Asia/Bangkok': 'THB',
            'Asia/Jakarta': 'IDR',
            'Asia/Kuala_Lumpur': 'MYR',
            'Asia/Ho_Chi_Minh': 'VND',
            'Asia/Manila': 'PHP',
            'Asia/Riyadh': 'SAR',
            'Asia/Dubai': 'AED',
            'Asia/Tel_Aviv': 'ILS',
            'Asia/Istanbul': 'TRY',
            'Europe/Moscow': 'RUB',
            'Europe/Kiev': 'UAH',
            'Australia/Sydney': 'AUD',
            'Pacific/Auckland': 'NZD',
            'America/Sao_Paulo': 'BRL',
            'America/Mexico_City': 'MXN',
            'America/Buenos_Aires': 'ARS',
            'Africa/Johannesburg': 'ZAR',
            'Africa/Cairo': 'EGP'
        };
        
        if (timezoneToCurrency[timezone]) {
            return timezoneToCurrency[timezone];
        }
        
        // Try partial match (e.g., 'America/' → USD)
        if (timezone.startsWith('America/')) return 'USD';
        if (timezone.startsWith('Europe/')) return 'EUR';
        if (timezone.startsWith('Asia/')) return 'USD'; // Most of Asia uses USD or local currencies
        
        return 'USD';
    } catch (e) {
        console.warn('Timezone detection failed:', e);
        return 'USD';
    }
}

// Initialize auto-detected currency on page load
async function initializeAutoCurrency() {
    try {
        const detectedCurrency = await detectUserCurrency();
        gxScreenerState.nativeCurrency = detectedCurrency;
        console.log('Auto-detected currency:', detectedCurrency);
    } catch (e) {
        console.warn('Currency initialization failed:', e);
        gxScreenerState.nativeCurrency = 'USD';
    }
}

// Consolidated World Stocks Provider
function getAllWorldStocks() {
    let list = [];
    if (!exchangeData) return list;

    Object.keys(exchangeData).forEach(exKey => {
        const exInfo = exchangeData[exKey];
        if (!exInfo || !Array.isArray(exInfo.stocks)) return;

        exInfo.stocks.forEach(stock => {
            const price = typeof stock.price === 'number' ? stock.price : parseFloat(stock.price) || 100;
            const change = typeof stock.change === 'number' ? stock.change : parseFloat(stock.change) || 0;
            const changePercent = typeof stock.changePercent === 'number' ? stock.changePercent : parseFloat(stock.changePercent) || 0;
            const currency = exInfo.currency || 'USD';
            const rate = fxRates[currency] || 1;
            const usdPrice = currency === 'USD' ? price : (price / rate);

            // Parse market cap to numeric value
            const mcapValue = parseMarketCapValue(stock.marketCap || '$120B');
            
            // Calculate realistic volume based on market cap
            // Large cap (>$100B): 0.5-1.5% of market cap daily
            // Mid cap ($10B-$100B): 1-2.5% of market cap daily
            // Small cap (<$10B): 2-4% of market cap daily
            let volumeRatio;
            if (mcapValue >= 100e9) {
                volumeRatio = 0.005 + (Math.random() * 0.01); // 0.5-1.5%
            } else if (mcapValue >= 10e9) {
                volumeRatio = 0.01 + (Math.random() * 0.015); // 1-2.5%
            } else {
                volumeRatio = 0.02 + (Math.random() * 0.02); // 2-4%
            }
            
            const calculatedVolume = mcapValue * volumeRatio;
            
            // Format volume to readable string
            let volumeStr;
            if (calculatedVolume >= 1e9) {
                volumeStr = (calculatedVolume / 1e9).toFixed(2) + 'B';
            } else if (calculatedVolume >= 1e6) {
                volumeStr = (calculatedVolume / 1e6).toFixed(2) + 'M';
            } else if (calculatedVolume >= 1e3) {
                volumeStr = (calculatedVolume / 1e3).toFixed(2) + 'K';
            } else {
                volumeStr = calculatedVolume.toFixed(2);
            }

            // Estimate RVOL if not present
            const fiveMinRvol = typeof stock.fiveMinRvol === 'number' && stock.fiveMinRvol > 0 
                ? stock.fiveMinRvol 
                : Math.max(0.6, Number((1.1 + Math.abs(changePercent) * 0.35 + (stock.symbol.charCodeAt(0) % 5) * 0.25).toFixed(2)));

            // Estimate Delta if not present
            const fiveMinDelta = typeof stock.fiveMinDelta === 'number' 
                ? stock.fiveMinDelta 
                : Math.round((changePercent >= 0 ? 1 : -1) * (Math.abs(changePercent) * 450000 + 350000 + (stock.symbol.charCodeAt(0) % 10) * 120000));

            // Estimate 52w high and low if not present
            const high52 = stock['52wHigh'] ? (typeof stock['52wHigh'] === 'number' ? stock['52wHigh'] : parseFloat(stock['52wHigh'])) : Number((price * 1.28).toFixed(2));
            const low52 = stock['52wLow'] ? (typeof stock['52wLow'] === 'number' ? stock['52wLow'] : parseFloat(stock['52wLow'])) : Number((price * 0.76).toFixed(2));

            list.push({
                ...stock,
                price,
                change,
                changePercent,
                usdPrice,
                exchange: exKey,
                exchangeName: exInfo.name || exKey,
                country: exInfo.country || 'Global',
                currency: currency,
                flag: exInfo.flag || '🌐',
                region: exInfo.region || (exKey === 'NASDAQ' || exKey === 'NYSE' || exKey === 'TSE' ? 'Americas' : (exKey === 'LSE' || exKey === 'XETRA' || exKey === 'SIX' || exKey === 'BM' || exKey === 'EURONEXT' || exKey === 'MOEX' ? 'Europe' : (exKey === 'TADAWUL' ? 'Middle East' : 'APAC'))),
                sector: stock.sector || 'General Equities',
                marketCap: stock.marketCap || '$120B',
                volume: volumeStr,
                peRatio: stock.peRatio ? parseFloat(stock.peRatio) : 18.5,
                '52wHigh': high52,
                '52wLow': low52,
                fiveMinRvol,
                fiveMinDelta
            });
        });
    });

    return list;
}

function loadGxScreenerContent() {
    const container = document.getElementById('gx-screener-container');
    if (!container) return;

    if (container.innerHTML.trim() !== '' && !container.innerHTML.includes('GX Screener content will be loaded here')) {
        return;
    }

    // Auto-detect and set user's currency on first load (async)
    if (!gxScreenerState.currencyInitialized) {
        initializeAutoCurrency().then(() => {
            gxScreenerState.currencyInitialized = true;
            // Update currency selector after detection
            const currencySelect = document.getElementById('gx-native-currency-select');
            if (currencySelect) {
                currencySelect.value = gxScreenerState.nativeCurrency || 'USD';
            }
            renderGxTable();
        });
    }

    container.innerHTML = `
        <div class="gx-screener-wrapper">
            <!-- Top Bar with Region Tabs and Controls -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.75rem;">
                <div class="screener-tabs gx-region-tabs">
                    <button class="screener-tab-btn active" data-gx-region="ALL" onclick="window.switchGxRegion('ALL')">🌐 ALL REGIONS</button>
                    <button class="screener-tab-btn" data-gx-region="Americas" onclick="window.switchGxRegion('Americas')">🌎 AMERICAS</button>
                    <button class="screener-tab-btn" data-gx-region="Europe" onclick="window.switchGxRegion('Europe')">🌍 EUROPE</button>
                    <button class="screener-tab-btn" data-gx-region="APAC" onclick="window.switchGxRegion('APAC')">🌏 ASIA-PACIFIC</button>
                    <button class="screener-tab-btn" data-gx-region="Middle East" onclick="window.switchGxRegion('Middle East')">🕌 MIDDLE EAST</button>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <button onclick="window.switchScannerMode('sga')" class="screener-design-toggle" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.08);" title="Switch to SGA Sovereign Scanner">
                        🏛️ SGA SCANNER
                    </button>
                    <button onclick="window.refreshGxData()" class="screener-design-toggle" id="refresh-gx-btn" title="Refresh Live World Market Quotes">
                        🔄 REFRESH
                    </button>
                    <button onclick="window.toggleScreenerDesign()" class="screener-design-toggle" title="Switch Day Trader / Modern Design">
                        🎨 SWITCH DESIGN
                    </button>
                    <!-- Native Currency Toggle -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 0.5rem; backdrop-filter: blur(10px);">
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">View in:</span>
                        <select id="gx-native-currency-select" onchange="window.setGxNativeCurrency(this.value)" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 0.3rem 0.6rem; border-radius: 0.35rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; outline: none;">
                            <option value="USD">🇺🇸 USD</option>
                            <option value="EUR">🇪🇺 EUR</option>
                            <option value="GBP">🇬🇧 GBP</option>
                            <option value="JPY">🇯🇵 JPY</option>
                            <option value="CAD">🇨🇦 CAD</option>
                            <option value="AUD">🇦🇺 AUD</option>
                            <option value="CHF">🇨🇭 CHF</option>
                            <option value="CNY">🇨🇳 CNY</option>
                            <option value="HKD">🇭🇰 HKD</option>
                            <option value="SGD">🇸🇬 SGD</option>
                            <option value="INR">🇮🇳 INR</option>
                            <option value="SAR">🇸🇦 SAR</option>
                            <option value="AED">🇦🇪 AED</option>
                            <option value="SEK">🇸🇪 SEK</option>
                            <option value="NOK">🇳🇴 NOK</option>
                            <option value="DKK">🇩🇰 DKK</option>
                            <option value="PLN">🇵🇱 PLN</option>
                            <option value="CZK">🇨🇿 CZK</option>
                            <option value="HUF">🇭🇺 HUF</option>
                            <option value="RON">🇷🇴 RON</option>
                            <option value="RUB">🇷🇺 RUB</option>
                            <option value="UAH">🇺🇦 UAH</option>
                            <option value="TRY">🇹🇷 TRY</option>
                            <option value="ILS">🇮🇱 ILS</option>
                            <option value="KRW">🇰🇷 KRW</option>
                            <option value="THB">🇹🇭 THB</option>
                            <option value="IDR">🇮🇩 IDR</option>
                            <option value="MYR">🇲🇾 MYR</option>
                            <option value="VND">🇻🇳 VND</option>
                            <option value="PHP">🇵🇭 PHP</option>
                            <option value="TWD">🇹🇼 TWD</option>
                            <option value="NZD">🇳🇿 NZD</option>
                            <option value="MXN">🇲🇽 MXN</option>
                            <option value="BRL">🇧🇷 BRL</option>
                            <option value="ARS">🇦🇷 ARS</option>
                            <option value="CLP">🇨🇱 CLP</option>
                            <option value="COP">🇨🇴 COP</option>
                            <option value="PEN">🇵🇪 PEN</option>
                            <option value="VES">🇻🇪 VES</option>
                            <option value="ZAR">🇿🇦 ZAR</option>
                            <option value="NGN">🇳🇬 NGN</option>
                            <option value="EGP">🇪🇬 EGP</option>
                            <option value="MAD">🇲🇦 MAD</option>
                            <option value="KES">🇰🇪 KES</option>
                            <option value="PKR">🇵🇰 PKR</option>
                            <option value="BDT">🇧🇩 BDT</option>
                            <option value="LKR">🇱🇰 LKR</option>
                            <option value="NPR">🇳🇵 NPR</option>
                            <option value="MMK">🇲🇲 MMK</option>
                            <option value="KHR">🇰🇭 KHR</option>
                            <option value="LAK">🇱🇦 LAK</option>
                            <option value="BND">🇧🇳 BND</option>
                            <option value="MVR">🇲🇻 MVR</option>
                            <option value="ISK">🇮🇸 ISK</option>
                            <option value="QAR">🇶🇦 QAR</option>
                            <option value="KWD">🇰🇼 KWD</option>
                            <option value="BHD">🇧🇭 BHD</option>
                            <option value="OMR">🇴🇲 OMR</option>
                            <option value="BGN">🇧🇬 BGN</option>
                            <option value="BAM">🇧🇦 BAM</option>
                            <option value="MKD">🇲🇰 MKD</option>
                            <option value="RSD">🇷🇸 RSD</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- GX Stats Bar -->
            <div class="screener-stats-bar gx-stats-bar">
                <div class="screener-stat-item">
                    <span class="screener-stat-label">WORLD STOCKS</span>
                    <span class="screener-stat-value" id="gx-total-stocks" style="color: #38bdf8;">0</span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">CURRENCY</span>
                    <span class="screener-stat-value" id="gx-currency-display" style="color: #fbbf24;">USD</span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">BREADTH</span>
                    <span class="screener-stat-value green" id="gx-breadth-pct">0% Gainers</span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">GAINERS / LOSERS</span>
                    <span class="screener-stat-value" id="gx-gainers-losers-counts"><span style="color: #10b981;">0 Up</span> · <span style="color: #ef4444;">0 Down</span></span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">AVG 5M-RVOL</span>
                    <span class="screener-stat-value" id="gx-avg-rvol">0.00x</span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">NET 5M DELTA</span>
                    <span class="screener-stat-value green" id="gx-net-delta">+$0.0M</span>
                </div>
                <div class="screener-stat-item">
                    <span class="screener-stat-label">EXCHANGES</span>
                    <span class="screener-stat-value" id="gx-active-exchanges-count" style="color: #fbbf24;">16 EX</span>
                </div>
            </div>

            <!-- GX Controls Bar -->
            <div class="screener-controls gx-controls">
                <div class="screener-search-box">
                    <input type="text" id="gx-search-input" placeholder="🔍 SEARCH TICKER, COMPANY, COUNTRY, OR EXCHANGE..." oninput="window.filterGxStocks()">
                </div>

                <!-- Exchange Filter Dropdown -->
                <div class="screener-filter-select-wrapper">
                    <select id="gx-exchange-select" class="gov-select" onchange="window.filterGxStocks()" style="background: rgba(15, 23, 42, 0.85); border: 1px solid var(--glass-border); color: #fff; padding: 0.5rem 0.8rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; outline: none;">
                        <option value="ALL">🌐 All World Exchanges (GX)</option>
                        <optgroup label="Americas">
                            <option value="NASDAQ">🇺🇸 NASDAQ (USA)</option>
                            <option value="NYSE">🇺🇸 NYSE (USA)</option>
                            <option value="TSE">🇨🇦 TSX (Canada)</option>
                        </optgroup>
                        <optgroup label="Europe">
                            <option value="LSE">🇬🇧 LSE London (UK)</option>
                            <option value="XETRA">🇩🇪 XETRA Frankfurt (Germany)</option>
                            <option value="SIX">🇨🇭 SIX Swiss (Switzerland)</option>
                            <option value="BM">🇪🇸 BME Madrid (Spain)</option>
                            <option value="EURONEXT">🇪🇺 Euronext (Europe)</option>
                            <option value="MOEX">🇷🇺 MOEX Moscow (Russia)</option>
                        </optgroup>
                        <optgroup label="Asia-Pacific">
                            <option value="TSE_JP">🇯🇵 TSE Tokyo (Japan)</option>
                            <option value="SSE">🇨🇳 SSE Shanghai (China)</option>
                            <option value="SZSE">🇨🇳 SZSE Shenzhen (China)</option>
                            <option value="HKEX">🇭🇰 HKEX (Hong Kong)</option>
                            <option value="NSE">🇮🇳 NSE (India)</option>
                            <option value="ASX">🇦🇺 ASX Sydney (Australia)</option>
                        </optgroup>
                        <optgroup label="Middle East">
                            <option value="TADAWUL">🇸🇦 Tadawul (Saudi Arabia)</option>
                        </optgroup>
                    </select>
                </div>

                <!-- Sector Filter Dropdown -->
                <div class="screener-filter-select-wrapper">
                    <select id="gx-sector-select" class="gov-select" onchange="window.filterGxStocks()" style="background: rgba(15, 23, 42, 0.85); border: 1px solid var(--glass-border); color: #fff; padding: 0.5rem 0.8rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; outline: none;">
                        <option value="ALL">All Sectors</option>
                        <option value="Technology">Technology & AI</option>
                        <option value="Financials">Financials & Banking</option>
                        <option value="Healthcare">Healthcare & Pharma</option>
                        <option value="Consumer Discretionary">Consumer Discretionary</option>
                        <option value="Consumer Staples">Consumer Staples</option>
                        <option value="Energy">Energy & Oil/Gas</option>
                        <option value="Industrials">Industrials & Aerospace</option>
                        <option value="Materials">Materials & Mining</option>
                        <option value="Utilities">Utilities & Clean Energy</option>
                        <option value="Communication">Communication & Media</option>
                    </select>
                </div>

                <!-- Quick Filter Buttons -->
                <button class="screener-filter-btn active" id="btn-gx-filter-all" data-gx-filter="all" onclick="window.setGxQuickFilter('all')">ALL</button>
                <button class="screener-filter-btn" id="btn-gx-filter-gainers" data-gx-filter="gainers" onclick="window.setGxQuickFilter('gainers')">🚀 GAINERS</button>
                <button class="screener-filter-btn" id="btn-gx-filter-losers" data-gx-filter="losers" onclick="window.setGxQuickFilter('losers')">🔻 LOSERS</button>
                <button class="screener-filter-btn" id="btn-gx-filter-hot" data-gx-filter="hot" onclick="window.setGxQuickFilter('hot')">🔥 HOT RVOL</button>
                <button class="screener-filter-btn" id="btn-gx-filter-trending" data-gx-filter="trending" onclick="window.setGxQuickFilter('trending')">⚡ DELTA FLOW</button>
                <button class="screener-filter-btn" id="btn-gx-filter-megacap" data-gx-filter="megacap" onclick="window.setGxQuickFilter('megacap')">🏛️ MEGA CAP</button>
                <button class="screener-filter-btn" id="btn-gx-filter-value" data-gx-filter="value" onclick="window.setGxQuickFilter('value')">💎 VALUE</button>

                <!-- Day Trader Numeric Filters -->
                <div class="screener-float-filter" title="Minimum 5m RVOL multiplier">
                    <input type="number" id="gx-rvol-filter-input" placeholder="RVOL" min="0" step="0.1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">x</span>
                </div>
                <div class="screener-float-filter" title="Minimum Session Gain %">
                    <input type="number" id="gx-gain-filter-input" placeholder="GAIN" min="0" step="0.1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">%</span>
                </div>
                <div class="screener-float-filter" title="Minimum 5m Net Order Flow Delta in Millions">
                    <input type="number" id="gx-delta-filter-input" placeholder="DELTA" min="0" step="0.1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">M</span>
                </div>
                <div class="screener-float-filter" title="Minimum Market Cap">
                    <input type="number" id="gx-mcap-min-filter-input" placeholder="Min MC" min="0" step="1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">B</span>
                </div>
                <div class="screener-float-filter" title="Maximum Market Cap">
                    <input type="number" id="gx-mcap-max-filter-input" placeholder="Max MC" min="0" step="1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">B</span>
                </div>
                <div class="screener-float-filter" title="Minimum Float">
                    <input type="number" id="gx-float-min-filter-input" placeholder="Min Float" min="0" step="1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">M</span>
                </div>
                <div class="screener-float-filter" title="Maximum Float">
                    <input type="number" id="gx-float-max-filter-input" placeholder="Max Float" min="0" step="1" oninput="window.filterGxStocks()">
                    <span class="screener-float-label">M</span>
                </div>
            </div>

            <!-- GX Table Meta & Pagination bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; padding: 0.4rem 0.5rem; font-size: 0.78rem; color: var(--text-secondary); flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    Showing <strong id="gx-meta-count" style="color: #fff;">0</strong> world stocks matching criteria
                    <span id="gx-exchange-pill-indicator" style="margin-left: 0.5rem; font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600;">Worldwide</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div id="gx-page-info">Page 1 of 1</div>
                    <div class="screener-page-btns">
                        <button class="screener-page-btn" id="gx-prev-btn" onclick="window.changeGxPage(-1)">← Previous</button>
                        <button class="screener-page-btn" id="gx-next-btn" onclick="window.changeGxPage(1)">Next →</button>
                    </div>
                </div>
            </div>

            <!-- GX Table -->
            <div class="screener-table-container">
                <div class="screener-table-wrapper">
                    <table class="screener-table gx-table">
                        <thead>
                            <tr>
                                <th onclick="window.sortGxTable('symbol')">Symbol / Company <span class="screener-sort-icon" id="gx-sort-symbol">↕</span></th>
                                <th onclick="window.sortGxTable('exchange')">Exchange <span class="screener-sort-icon" id="gx-sort-exchange">↕</span></th>
                                <th onclick="window.sortGxTable('sector')">Sector <span class="screener-sort-icon" id="gx-sort-sector">↕</span></th>
                                <th onclick="window.sortGxTable('price')">Price <span class="screener-sort-icon" id="gx-sort-price">↕</span></th>
                                <th onclick="window.sortGxTable('changePercent')">Chg % <span class="screener-sort-icon" id="gx-sort-changePercent">↕</span></th>
                                <th onclick="window.sortGxTable('marketCap')">Mkt Cap <span class="screener-sort-icon" id="gx-sort-marketCap">↕</span></th>
                                <th onclick="window.sortGxTable('volume')">Volume <span class="screener-sort-icon" id="gx-sort-volume">↕</span></th>
                                <th onclick="window.sortGxTable('fiveMinRvol')">5m RVOL <span class="screener-sort-icon" id="gx-sort-fiveMinRvol">↕</span></th>
                                <th onclick="window.sortGxTable('fiveMinDelta')">5m Delta <span class="screener-sort-icon" id="gx-sort-fiveMinDelta">↕</span></th>
                                <th onclick="window.sortGxTable('peRatio')">P/E <span class="screener-sort-icon" id="gx-sort-peRatio">↕</span></th>
                                <th>52W Range</th>
                                <!-- <th style="text-align: center;">Action</th> -->
                            </tr>
                        </thead>
                        <tbody id="gx-screener-body">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    renderGxTable();
    
    // Initialize currency selector
    const currencySelect = document.getElementById('gx-native-currency-select');
    if (currencySelect) {
        currencySelect.value = gxScreenerState.nativeCurrency || 'USD';
    }
}

function formatGxPrice(stock) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const nativeSym = currencySymbols[nativeCurrency] || '$';
    
    // Convert price to native currency
    let displayPrice = stock.price;
    let originalCurrency = stock.currency;
    
    if (nativeCurrency !== originalCurrency) {
        // Convert from original currency to USD, then to native currency
        const originalToUsdRate = fxRates[originalCurrency] || 1;
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        const usdPrice = originalCurrency === 'USD' ? stock.price : (stock.price / originalToUsdRate);
        displayPrice = usdPrice * usdToNativeRate;
    }
    
    if (displayPrice >= 1000) {
        return nativeSym + displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' <span style="font-size: 0.8em; opacity: 0.75;">' + nativeCurrency + '</span>';
    }
    return nativeSym + displayPrice.toFixed(2) + ' <span style="font-size: 0.8em; opacity: 0.75;">' + nativeCurrency + '</span>';
}

function formatGxUsdPrice(stock) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const nativeSym = currencySymbols[nativeCurrency] || '$';
    
    if (!stock.usdPrice || isNaN(stock.usdPrice)) return '0.00';
    
    // Convert USD price to native currency
    let nativePrice = stock.usdPrice;
    if (nativeCurrency !== 'USD') {
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        nativePrice = stock.usdPrice * usdToNativeRate;
    }
    
    if (nativePrice >= 1000) {
        return nativeSym + nativePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return nativeSym + nativePrice.toFixed(2);
}

function calculateRangePct(stock) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const originalCurrency = stock.currency || 'USD';
    
    // Convert prices to native currency for consistent calculation
    const convertToNative = (price) => {
        if (!price || isNaN(price)) return price;
        if (nativeCurrency === originalCurrency) return price;
        
        const originalToUsdRate = fxRates[originalCurrency] || 1;
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        const usdPrice = originalCurrency === 'USD' ? price : (price / originalToUsdRate);
        return usdPrice * usdToNativeRate;
    };
    
    // Convert all prices to native currency
    const currentPrice = convertToNative(stock.price);
    const low = convertToNative(stock['52wLow']) || (currentPrice * 0.8);
    const high = convertToNative(stock['52wHigh']) || (currentPrice * 1.2);
    
    if (high <= low) return 50;
    const pct = Math.max(5, Math.min(95, ((currentPrice - low) / (high - low)) * 100));
    return Math.round(pct);
}

function formatGxRangePrice(price, stockCurrency) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const nativeSym = currencySymbols[nativeCurrency] || '$';
    
    if (!price || isNaN(price)) return '-';
    
    // Convert to native currency if needed
    let nativePrice = price;
    const originalCurrency = stockCurrency || 'USD';
    
    if (nativeCurrency !== originalCurrency) {
        const originalToUsdRate = fxRates[originalCurrency] || 1;
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        const usdPrice = originalCurrency === 'USD' ? price : (price / originalToUsdRate);
        nativePrice = usdPrice * usdToNativeRate;
    }
    
    if (nativePrice >= 1000) {
        return nativeSym + nativePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return nativeSym + nativePrice.toFixed(2);
}

function formatGxNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const isNeg = num < 0;
    const abs = Math.abs(num);
    let str;
    if (abs >= 1e12) str = (abs / 1e12).toFixed(2) + 'T';
    else if (abs >= 1e9) str = (abs / 1e9).toFixed(2) + 'B';
    else if (abs >= 1e6) str = (abs / 1e6).toFixed(2) + 'M';
    else if (abs >= 1e3) str = (abs / 1e3).toFixed(2) + 'K';
    else str = abs.toFixed(2);
    return (isNeg ? '-' : '') + str;
}

function formatGxMarketCap(stock) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const nativeSym = currencySymbols[nativeCurrency] || '$';
    
    // Parse market cap string to numeric value
    let mcapValue = parseMarketCapValue(stock.marketCap);
    
    // Convert to native currency if needed
    if (nativeCurrency !== 'USD' && mcapValue > 0) {
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        mcapValue = mcapValue * usdToNativeRate;
    }
    
    return nativeSym + formatGxNumber(mcapValue) + ' <span style="font-size: 0.8em; opacity: 0.75;">' + nativeCurrency + '</span>';
}

function formatGxVolume(stock) {
    const nativeCurrency = gxScreenerState.nativeCurrency || 'USD';
    const nativeSym = currencySymbols[nativeCurrency] || '$';
    
    // Parse volume string to numeric value
    let volValue = parseVolumeValue(stock.volume);
    
    // Convert to native currency if needed
    if (nativeCurrency !== 'USD' && volValue > 0) {
        const usdToNativeRate = fxRates[nativeCurrency] || 1;
        volValue = volValue * usdToNativeRate;
    }
    
    return nativeSym + formatGxNumber(volValue) + ' <span style="font-size: 0.8em; opacity: 0.75;">' + nativeCurrency + '</span>';
}

function getGxRvolClass(rvol) {
    if (rvol >= 2.0) return 'screener-rvol-high';
    if (rvol >= 1.5) return 'screener-rvol-medium';
    return 'screener-rvol-low';
}

function getGxDeltaClass(delta) {
    return delta >= 0 ? 'screener-delta-positive' : 'screener-delta-negative';
}

function getGxMarketCapColor(mcap) {
    if (!mcap || mcap <= 0) return '#64748b';
    const bil = mcap / 1e9;
    if (bil < 10) return '#64748b';
    if (bil < 50) return '#7dd3fc';
    if (bil < 100) return '#67e8f9';
    if (bil < 500) return '#34d399';
    if (bil < 1000) return '#a3e635';
    if (bil < 2000) return '#fbbf24';
    return '#f97316';
}

function getGxVolumeColor(vol) {
    if (!vol || vol <= 0) return '#64748b';
    const mil = vol / 1e6;
    if (mil < 2) return '#64748b';
    if (mil < 10) return '#7dd3fc';
    if (mil < 25) return '#34d399';
    if (mil < 50) return '#fbbf24';
    return '#f97316';
}

function renderGxTable() {
    const tbody = document.getElementById('gx-screener-body');
    if (!tbody) return;

    let stocks = getAllWorldStocks();

    // 1. Search Query Filter
    const searchInput = document.getElementById('gx-search-input');
    if (searchInput) {
        gxScreenerState.searchQuery = searchInput.value.toLowerCase().trim();
    }

    if (gxScreenerState.searchQuery) {
        const query = gxScreenerState.searchQuery;
        stocks = stocks.filter(s => 
            (s.symbol && s.symbol.toLowerCase().includes(query)) ||
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.country && s.country.toLowerCase().includes(query)) ||
            (s.exchange && s.exchange.toLowerCase().includes(query)) ||
            (s.sector && s.sector.toLowerCase().includes(query))
        );
    }

    // 2. Region Filter
    if (gxScreenerState.region !== 'ALL') {
        stocks = stocks.filter(s => s.region && s.region.toLowerCase() === gxScreenerState.region.toLowerCase());
    }

    // 3. Exchange Filter
    const exSelect = document.getElementById('gx-exchange-select');
    if (exSelect) gxScreenerState.exchange = exSelect.value;
    if (gxScreenerState.exchange !== 'ALL') {
        stocks = stocks.filter(s => s.exchange === gxScreenerState.exchange);
    }

    // 4. Sector Filter
    const secSelect = document.getElementById('gx-sector-select');
    if (secSelect) gxScreenerState.sector = secSelect.value;
    if (gxScreenerState.sector !== 'ALL') {
        stocks = stocks.filter(s => s.sector && s.sector.toLowerCase().includes(gxScreenerState.sector.toLowerCase()));
    }

    // 5. Quick Filter Pills
    if (gxScreenerState.quickFilter === 'gainers') {
        stocks = stocks.filter(s => s.changePercent > 0);
    } else if (gxScreenerState.quickFilter === 'losers') {
        stocks = stocks.filter(s => s.changePercent < 0);
    } else if (gxScreenerState.quickFilter === 'hot') {
        stocks = stocks.filter(s => s.fiveMinRvol >= 2.0);
    } else if (gxScreenerState.quickFilter === 'trending') {
        stocks = stocks.filter(s => s.fiveMinDelta > 0);
    } else if (gxScreenerState.quickFilter === 'megacap') {
        stocks = stocks.filter(s => parseMarketCapValue(s.marketCap) >= 100e9);
    } else if (gxScreenerState.quickFilter === 'value') {
        stocks = stocks.filter(s => s.peRatio && s.peRatio > 0 && s.peRatio < 15);
    }

    // 6. Day Trader Numeric Filters
    const rvolInput = document.getElementById('gx-rvol-filter-input');
    if (rvolInput && rvolInput.value) {
        const minRvol = parseFloat(rvolInput.value);
        if (!isNaN(minRvol) && minRvol > 0) {
            stocks = stocks.filter(s => s.fiveMinRvol >= minRvol);
        }
    }

    const gainInput = document.getElementById('gx-gain-filter-input');
    if (gainInput && gainInput.value) {
        const minGain = parseFloat(gainInput.value);
        if (!isNaN(minGain) && minGain > 0) {
            stocks = stocks.filter(s => s.changePercent >= minGain);
        }
    }

    const deltaInput = document.getElementById('gx-delta-filter-input');
    if (deltaInput && deltaInput.value) {
        const minDelta = parseFloat(deltaInput.value) * 1e6;
        if (!isNaN(minDelta) && minDelta > 0) {
            stocks = stocks.filter(s => s.fiveMinDelta >= minDelta);
        }
    }

    // Market Cap Filters
    const mcapMinInput = document.getElementById('gx-mcap-min-filter-input');
    const mcapMaxInput = document.getElementById('gx-mcap-max-filter-input');
    
    if (mcapMinInput && mcapMinInput.value) {
        const minMcap = parseFloat(mcapMinInput.value) * 1e9; // Convert B to numeric
        if (!isNaN(minMcap) && minMcap > 0) {
            stocks = stocks.filter(s => parseMarketCapValue(s.marketCap) >= minMcap);
        }
    }
    
    if (mcapMaxInput && mcapMaxInput.value) {
        const maxMcap = parseFloat(mcapMaxInput.value) * 1e9; // Convert B to numeric
        if (!isNaN(maxMcap) && maxMcap > 0) {
            stocks = stocks.filter(s => parseMarketCapValue(s.marketCap) <= maxMcap);
        }
    }

    // Float Filters (if float data exists)
    const floatMinInput = document.getElementById('gx-float-min-filter-input');
    const floatMaxInput = document.getElementById('gx-float-max-filter-input');
    
    if (floatMinInput && floatMinInput.value) {
        const minFloat = parseFloat(floatMinInput.value) * 1e6; // Convert M to numeric
        if (!isNaN(minFloat) && minFloat > 0) {
            stocks = stocks.filter(s => {
                const floatVal = parseVolumeValue(s.float);
                return floatVal >= minFloat;
            });
        }
    }
    
    if (floatMaxInput && floatMaxInput.value) {
        const maxFloat = parseFloat(floatMaxInput.value) * 1e6; // Convert M to numeric
        if (!isNaN(maxFloat) && maxFloat > 0) {
            stocks = stocks.filter(s => {
                const floatVal = parseVolumeValue(s.float);
                return floatVal <= maxFloat;
            });
        }
    }

    // Update Market Breadth & Stats Bar
    updateGxStatsBar(stocks);

    // 7. Sort
    stocks.sort((a, b) => {
        let valA = a[gxScreenerState.sortColumn];
        let valB = b[gxScreenerState.sortColumn];

        if (gxScreenerState.sortColumn === 'marketCap') {
            valA = parseMarketCapValue(valA);
            valB = parseMarketCapValue(valB);
        } else if (gxScreenerState.sortColumn === 'volume') {
            valA = parseVolumeValue(valA);
            valB = parseVolumeValue(valB);
        }

        if (typeof valA === 'string') {
            return gxScreenerState.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return gxScreenerState.sortAscending ? (valA - valB) : (valB - valA);
    });

    // 8. Pagination
    const totalCount = stocks.length;
    const metaCount = document.getElementById('gx-meta-count');
    if (metaCount) metaCount.textContent = totalCount;

    const totalPages = Math.ceil(totalCount / gxScreenerState.pageSize) || 1;
    if (gxScreenerState.currentPage > totalPages) gxScreenerState.currentPage = totalPages;
    if (gxScreenerState.currentPage < 1) gxScreenerState.currentPage = 1;

    const pageInfo = document.getElementById('gx-page-info');
    if (pageInfo) pageInfo.textContent = `Page ${gxScreenerState.currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('gx-prev-btn');
    const nextBtn = document.getElementById('gx-next-btn');
    if (prevBtn) prevBtn.disabled = gxScreenerState.currentPage === 1;
    if (nextBtn) nextBtn.disabled = gxScreenerState.currentPage === totalPages;

    const startIndex = (gxScreenerState.currentPage - 1) * gxScreenerState.pageSize;
    const paginatedStocks = stocks.slice(startIndex, startIndex + gxScreenerState.pageSize);

    if (paginatedStocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 0.9rem;">No world stocks found matching your criteria. Try adjusting your exchange or filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginatedStocks.map(stock => {
        const isGain = stock.changePercent >= 0;
        const changeClass = isGain ? 'screener-change-positive' : 'screener-change-negative';
        const changeSign = isGain ? '+' : '';
        const sectorClass = getSectorBadgeClass(stock.sector);

        return `<tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="gx-flag">${stock.flag}</span>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span class="screener-ticker-symbol" style="font-size: 0.85rem; font-weight: 700;">${stock.symbol}</span>
                            <span class="gx-ex-badge">${stock.exchange}</span>
                        </div>
                        <div class="screener-ticker-name" style="max-width: 170px;" title="${stock.name}">${stock.name}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-size: 0.78rem; font-weight: 600; color: #cbd5e1;">${stock.exchangeName || stock.exchange}</div>
                <div style="font-size: 0.68rem; color: #64748b;">${stock.country}</div>
            </td>
            <td><span class="screener-sector-badge ${sectorClass}">${stock.sector || 'General'}</span></td>
            <td class="num-col font-mono" style="font-weight: 600; color: #94a3b8;">
                ${formatGxPrice(stock)}
            </td>
            <td class="num-col font-mono ${changeClass}" style="font-weight: 700;">
                ${changeSign}${stock.changePercent.toFixed(2)}%
                <div style="font-size: 0.68rem; opacity: 0.85;">${changeSign}${Math.abs(stock.change || 0).toFixed(2)}</div>
            </td>
            <td class="num-col font-mono" style="color: ${getGxMarketCapColor(parseMarketCapValue(stock.marketCap))}; font-weight: 600;">${formatGxMarketCap(stock)}</td>
            <td class="num-col font-mono" style="color: ${getGxVolumeColor(parseVolumeValue(stock.volume))};">${formatGxVolume(stock)}</td>
            <td class="screener-rvol-cell ${getGxRvolClass(stock.fiveMinRvol)}">${stock.fiveMinRvol.toFixed(2)}x</td>
            <td class="screener-delta-cell ${getGxDeltaClass(stock.fiveMinDelta)}">${formatGxNumber(stock.fiveMinDelta)}</td>
            <td class="num-col font-mono" style="color: #cbd5e1;">${stock.peRatio ? stock.peRatio.toFixed(1) : '-'}</td>
            <td>
                <div class="screener-range-bar-wrapper">
                    <span style="font-size: 0.65rem; color: #64748b;">${formatGxRangePrice(stock['52wLow'], stock.currency)}</span>
                    <div class="screener-range-track"><div class="screener-range-fill" style="width: ${calculateRangePct(stock)}%;"></div></div>
                    <span style="font-size: 0.65rem; color: #64748b;">${formatGxRangePrice(stock['52wHigh'], stock.currency)}</span>
                </div>
            </td>
            <!-- <td style="text-align: center;">
                <button class="gx-trade-btn" onclick="window.inspectScreenerStock('${stock.symbol}', '${stock.exchange}')">
                    📊 Trade
                </button>
            </td> -->
        </tr>`;
    }).join('');
}

function updateGxStatsBar(stocks) {
    const totalEl = document.getElementById('gx-total-stocks');
    const currencyEl = document.getElementById('gx-currency-display');
    const breadthEl = document.getElementById('gx-breadth-pct');
    const countsEl = document.getElementById('gx-gainers-losers-counts');
    const avgRvolEl = document.getElementById('gx-avg-rvol');
    const netDeltaEl = document.getElementById('gx-net-delta');
    const pillInd = document.getElementById('gx-exchange-pill-indicator');

    if (totalEl) totalEl.textContent = stocks.length;
    
    if (currencyEl) {
        currencyEl.textContent = `${currencySymbols[gxScreenerState.nativeCurrency] || '$'} ${gxScreenerState.nativeCurrency}`;
    }

    const gainers = stocks.filter(s => s.changePercent > 0).length;
    const losers = stocks.filter(s => s.changePercent < 0).length;
    const total = stocks.length;
    const gPct = total > 0 ? Math.round((gainers / total) * 100) : 0;

    if (breadthEl) {
        breadthEl.textContent = `${gPct}% Gainers`;
        breadthEl.className = `screener-stat-value ${gPct >= 50 ? 'green' : ''}`;
        if (gPct < 50) breadthEl.style.color = '#ef4444';
        else breadthEl.style.color = '#10b981';
    }

    if (countsEl) {
        countsEl.innerHTML = `<span style="color: #10b981;">${gainers} Up</span> · <span style="color: #ef4444;">${losers} Down</span>`;
    }

    if (avgRvolEl) {
        const avgRvol = total > 0 ? stocks.reduce((sum, s) => sum + (s.fiveMinRvol || 1), 0) / total : 1.0;
        avgRvolEl.textContent = avgRvol.toFixed(2) + 'x';
    }

    if (netDeltaEl) {
        const netDelta = stocks.reduce((sum, s) => sum + (s.fiveMinDelta || 0), 0);
        netDeltaEl.textContent = formatGxNumber(netDelta);
        netDeltaEl.className = `screener-stat-value ${netDelta >= 0 ? 'green' : ''}`;
        netDeltaEl.style.color = netDelta >= 0 ? '#10b981' : '#ef4444';
    }

    if (pillInd) {
        if (gxScreenerState.exchange !== 'ALL') {
            pillInd.textContent = `${gxScreenerState.exchange} Market`;
        } else if (gxScreenerState.region !== 'ALL') {
            pillInd.textContent = `${gxScreenerState.region} Region`;
        } else {
            pillInd.textContent = 'Worldwide (15 Exchanges)';
        }
    }
}

window.filterGxStocks = function() {
    gxScreenerState.currentPage = 1;
    renderGxTable();
};

window.setGxQuickFilter = function(filter) {
    gxScreenerState.quickFilter = filter;
    gxScreenerState.currentPage = 1;

    document.querySelectorAll('[data-gx-filter]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-gx-filter') === filter) {
            btn.classList.add('active');
        }
    });

    renderGxTable();
};

window.switchGxRegion = function(region) {
    gxScreenerState.region = region;
    gxScreenerState.currentPage = 1;

    document.querySelectorAll('[data-gx-region]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-gx-region') === region) {
            btn.classList.add('active');
        }
    });

    renderGxTable();
};

window.sortGxTable = function(col) {
    if (gxScreenerState.sortColumn === col) {
        gxScreenerState.sortAscending = !gxScreenerState.sortAscending;
    } else {
        gxScreenerState.sortColumn = col;
        gxScreenerState.sortAscending = false;
    }

    // Update icon indicators
    document.querySelectorAll('.gx-table .screener-sort-icon').forEach(icon => {
        icon.classList.remove('active');
        icon.textContent = '↕';
    });

    const activeIcon = document.getElementById(`gx-sort-${col}`);
    if (activeIcon) {
        activeIcon.classList.add('active');
        activeIcon.textContent = gxScreenerState.sortAscending ? '↑' : '↓';
    }

    renderGxTable();
};

window.changeGxPage = function(delta) {
    gxScreenerState.currentPage += delta;
    renderGxTable();
};

window.setGxNativeCurrency = function(currency) {
    gxScreenerState.nativeCurrency = currency;
    renderGxTable();
};

window.refreshGxData = function() {
    const btn = document.getElementById('refresh-gx-btn');
    if (btn) {
        btn.textContent = '⏳ Refreshing...';
        btn.disabled = true;
    }

    // Slightly adjust prices for visual feedback
    if (exchangeData) {
        Object.keys(exchangeData).forEach(exKey => {
            const exInfo = exchangeData[exKey];
            if (!exInfo || !Array.isArray(exInfo.stocks)) return;
            exInfo.stocks.forEach(stock => {
                const tick = (Math.random() - 0.48) * (stock.price * 0.003);
                stock.price = Math.max(0.01, Number((stock.price + tick).toFixed(2)));
                stock.changePercent = Number((stock.changePercent + (Math.random() - 0.48) * 0.15).toFixed(2));
                if (stock.fiveMinRvol) {
                    stock.fiveMinRvol = Math.max(0.5, Number((stock.fiveMinRvol + (Math.random() - 0.5) * 0.2).toFixed(2)));
                }
            });
        });
    }

    setTimeout(() => {
        renderGxTable();
        if (btn) {
            btn.textContent = '🔄 REFRESH';
            btn.disabled = false;
        }
    }, 300);
};

// Periodic real-time market updates for Global Exchange stocks
setInterval(() => {
    if (!exchangeData) return;
    
    // Simulate subtle ticks across world stocks
    Object.keys(exchangeData).forEach(exKey => {
        const exInfo = exchangeData[exKey];
        if (!exInfo || !Array.isArray(exInfo.stocks)) return;
        
        exInfo.stocks.forEach(stock => {
            const priceChange = (Math.random() - 0.49) * (stock.price * 0.0018);
            stock.price = Math.max(0.01, Number((stock.price + priceChange).toFixed(stock.price > 100 ? 2 : 3)));
            
            const deltaPct = (Math.random() - 0.49) * 0.06;
            stock.changePercent = Number((stock.changePercent + deltaPct).toFixed(2));
            stock.change = Number((stock.change + priceChange).toFixed(2));
            
            if (stock.fiveMinRvol) {
                stock.fiveMinRvol = Math.max(0.4, Number((stock.fiveMinRvol + (Math.random() - 0.5) * 0.12).toFixed(2)));
            }
            if (typeof stock.fiveMinDelta === 'number') {
                stock.fiveMinDelta += Math.floor((Math.random() - 0.49) * 95000);
            }
        });
    });

    // If currently viewing GX screener, update table in-place
    if (window.currentScannerMode === 'gx') {
        const gxContainer = document.getElementById('gx-screener-container');
        if (gxContainer && !gxContainer.classList.contains('hidden')) {
            renderGxTable();
        }
    }
}, 2500);

// EXPOSE GX FUNCTIONS TO WINDOW FOR GLOBAL ACCESS
window.getAllWorldStocks = getAllWorldStocks;
window.loadGxScreenerContent = loadGxScreenerContent;
window.renderGxTable = renderGxTable;









