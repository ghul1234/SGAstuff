/**
 * SGA Network — Swap Simulation Engine
 * 
 * Drives realistic FX/swap price action using:
 *   1. Ornstein-Uhlenbeck mean-reverting stochastic process
 *   2. Session-based volatility multipliers (Asian/London/NY)
 *   3. Multi-participant order flow simulation (institutional/retail/arb)
 *   4. Dynamic bid/ask spread adjustment
 *   5. 24h rolling metrics (high/low/volume/change/OHLC)
 *   6. Price history buffer for sparkline charts
 * 
 * Each tick:
 *   - Generates simulated order flow
 *   - Applies OU mean-reversion drift toward EOI reference rate
 *   - Adds session-volatility-scaled noise
 *   - Routes trades through LiquidityPool for realistic price impact
 *   - Updates MarketPair bid/ask/spread/volume/24h stats
 *   - Pushes price point to sparkline history buffer
 */

// ─── Pair Classification ──────────────────────────────────
const PAIR_CLASS = {
  MAJOR_FIAT: 'major_fiat',
  HUB_SGA: 'hub_sga',
  STATE_SGA: 'state_sga',
  COUNTRY_SGA: 'country_sga',
  CROSS_SGA: 'cross_sga'
};

// ─── Volatility & Mean-Reversion Calibration ──────────────
const PAIR_PARAMS = {
  [PAIR_CLASS.MAJOR_FIAT]: {
    baseVol: 0.0003,          // 0.03% per tick
    meanRevSpeed: 0.02,       // slow drift to fundamental
    minSpread: 0.0010,        // 0.10%
    maxSpread: 0.0025,        // 0.25%
    depth: 2_500_000_000_000, // $2.5 Trillion depth
    avgTradeSize: 15_000_000_000, // $15 Billion avg institutional trade
    base24hVolume: 850_000_000_000 // $850B baseline 24h volume
  },
  [PAIR_CLASS.HUB_SGA]: {
    baseVol: 0.0008,
    meanRevSpeed: 0.05,
    minSpread: 0.0020,
    maxSpread: 0.0050,
    depth: 1_200_000_000_000, // $1.2 Trillion depth
    avgTradeSize: 8_000_000_000,  // $8 Billion avg trade
    base24hVolume: 250_000_000_000 // $250B baseline 24h volume
  },
  [PAIR_CLASS.STATE_SGA]: {
    baseVol: 0.0012,
    meanRevSpeed: 0.08,
    minSpread: 0.0035,
    maxSpread: 0.0080,
    depth: 500_000_000_000,   // $500 Billion depth
    avgTradeSize: 3_000_000_000,  // $3 Billion avg trade
    base24hVolume: 45_000_000_000 // $45B baseline 24h volume
  },
  [PAIR_CLASS.COUNTRY_SGA]: {
    baseVol: 0.0010,
    meanRevSpeed: 0.06,
    minSpread: 0.0025,
    maxSpread: 0.0060,
    depth: 800_000_000_000,   // $800 Billion depth
    avgTradeSize: 5_000_000_000,  // $5 Billion avg trade
    base24hVolume: 75_000_000_000 // $75B baseline 24h volume
  },
  [PAIR_CLASS.CROSS_SGA]: {
    baseVol: 0.0015,
    meanRevSpeed: 0.10,
    minSpread: 0.0040,
    maxSpread: 0.0100,
    depth: 300_000_000_000,   // $300 Billion depth
    avgTradeSize: 1_500_000_000,  // $1.5 Billion avg trade
    base24hVolume: 25_000_000_000 // $25B baseline 24h volume
  }
};

// ─── Trading Sessions ─────────────────────────────────────
const SESSIONS = [
  { name: 'Asian',           startHour: 0,  endHour: 8,  volMultiplier: 0.7,  activityMultiplier: 0.5 },
  { name: 'London',          startHour: 8,  endHour: 12, volMultiplier: 1.2,  activityMultiplier: 1.3 },
  { name: 'London/NY',       startHour: 12, endHour: 16, volMultiplier: 1.5,  activityMultiplier: 1.8 },
  { name: 'New York',        startHour: 16, endHour: 21, volMultiplier: 1.1,  activityMultiplier: 1.2 },
  { name: 'Off-Hours',       startHour: 21, endHour: 24, volMultiplier: 0.5,  activityMultiplier: 0.3 }
];

// ─── Participant Types ────────────────────────────────────
const PARTICIPANTS = {
  INSTITUTIONAL: { weight: 0.60, sizeMultiplier: 5.0,  biasStrength: 0.6 },
  RETAIL:        { weight: 0.25, sizeMultiplier: 0.3,  biasStrength: 0.1 },
  ARBITRAGEUR:   { weight: 0.15, sizeMultiplier: 2.0,  biasStrength: 0.9 }
};

// ─── Known Currency Sets ──────────────────────────────────
const MAJOR_FIATS = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'INR', 'KRW', 'BRL', 'MXN', 'SGD', 'HKD', 'SEK', 'NOK', 'NZD', 'ZAR', 'AED', 'SAR']);
const HUB_SGAS = new Set(['CAL', 'TEX', 'NYK', 'VIR', 'FLO', 'ILL', 'PEN', 'OHI', 'GEO', 'NCA', 'MIC', 'NJR', 'WAS', 'MAS', 'COL', 'MRY', 'MIN', 'TEN', 'IND', 'ARZ']);
const HUB_COUNTRIES = new Set(['CHN', 'JPN', 'DEU', 'GBR', 'FRA', 'IND', 'BRA', 'CAN', 'AUS', 'KOR', 'MEX', 'ESP', 'IDN', 'NLD', 'SAU', 'CHE', 'TUR', 'POL', 'SWE', 'BEL']);

// ─── Utility: Box-Muller Gaussian Random ──────────────────
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Classify a Market Pair ───────────────────────────────
function classifyPair(baseCurrency, quoteCurrency) {
  const bothFiat = MAJOR_FIATS.has(baseCurrency) && MAJOR_FIATS.has(quoteCurrency);
  if (bothFiat) return PAIR_CLASS.MAJOR_FIAT;

  const hasHub = HUB_SGAS.has(baseCurrency) || HUB_SGAS.has(quoteCurrency);
  const hasFiat = MAJOR_FIATS.has(baseCurrency) || MAJOR_FIATS.has(quoteCurrency);
  const hasCountry = HUB_COUNTRIES.has(baseCurrency) || HUB_COUNTRIES.has(quoteCurrency);

  if (hasFiat && hasHub) return PAIR_CLASS.HUB_SGA;
  if (hasFiat && hasCountry) return PAIR_CLASS.COUNTRY_SGA;
  if (hasHub && hasHub) return PAIR_CLASS.CROSS_SGA;
  if (hasFiat) return PAIR_CLASS.STATE_SGA;
  if (hasCountry) return PAIR_CLASS.COUNTRY_SGA;

  return PAIR_CLASS.CROSS_SGA;
}

// ─── Get Current Session ──────────────────────────────────
function getCurrentSession(simulatedHour = null) {
  const hour = simulatedHour !== null ? simulatedHour : new Date().getUTCHours();
  for (const session of SESSIONS) {
    if (hour >= session.startHour && hour < session.endHour) return session;
  }
  return SESSIONS[0]; // Fallback to Asian
}


// ═══════════════════════════════════════════════════════════
// SWAP SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════

export class SwapSimulationEngine {
  /**
   * @param {import('./MarketEngine.js').MarketEngine} marketEngine
   * @param {import('./EOIEngine.js').EOIEngine} eoiEngine
   */
  constructor(marketEngine, eoiEngine) {
    this.marketEngine = marketEngine;
    this.eoiEngine = eoiEngine;

    /** @type {Map<string, object>} pairId → simulation state */
    this._pairState = new Map();

    /** @type {Map<string, number[]>} pairId → price history buffer (for sparklines) */
    this._priceHistory = new Map();

    /** @type {number|null} interval handle */
    this._intervalHandle = null;

    /** @type {number} tick interval in ms */
    this._tickIntervalMs = 2000;

    /** @type {number} simulated hour (null = use real clock) */
    this._simulatedHour = null;

    /** @type {number} total ticks executed */
    this._tickCount = 0;

    /** @type {number} max history points per pair */
    this._maxHistoryPoints = 120; // 4 minutes at 2s ticks

    /** @type {Set<Function>} tick listeners */
    this._onTickListeners = new Set();

    /** @type {Map<string, object>} pairId → 24h rolling stats */
    this._stats24h = new Map();

    // Institutional flow bias — rotates slowly to create trends
    this._institutionalBias = new Map();
    this._biasRotationCounter = 0;
  }

  // ─── Initialization ───────────────────────────────────────

  /**
   * Initialize simulation state for all active market pairs.
   */
  init() {
    const pairs = this.marketEngine.getAllPairs();

    for (const pair of pairs) {
      const pairClass = classifyPair(pair.baseCurrency, pair.quoteCurrency);
      const params = PAIR_PARAMS[pairClass];

      // Initialize simulation state
      this._pairState.set(pair.pairId, {
        pairClass,
        params,
        previousPrice: pair.lastPrice,
        referenceRate: pair.referenceRate,
        momentum: 0,           // Accumulated momentum from order flow
        activityLevel: 1.0,    // Current activity multiplier
        lastDirection: 0,      // Last price movement direction (-1, 0, 1)
        consecutiveDir: 0,     // How many ticks in same direction
        ticksSinceLastTrade: 0  // Quiet period counter
      });

      // Initialize price history
      this._priceHistory.set(pair.pairId, [pair.lastPrice]);

      // Initialize 24h stats with realistic baseline volume calibrated to ~$4.5 Trillion aggregate network volume
      const baseVol = params.base24hVolume * (0.85 + Math.random() * 0.3);
      this._stats24h.set(pair.pairId, {
        open: pair.lastPrice,
        high: pair.lastPrice * (1 + Math.random() * 0.006),
        low: pair.lastPrice * (1 - Math.random() * 0.006),
        close: pair.lastPrice,
        volume: baseVol,
        change: 0,
        changePct: (Math.random() - 0.48) * 0.6,
        tradeCount: Math.floor(25000 + Math.random() * 40000),
        resetAt: Date.now()
      });

      // Initialize institutional bias (rotates periodically)
      this._institutionalBias.set(pair.pairId, (Math.random() - 0.5) * 0.4);
    }

    return this;
  }

  // ─── Core Tick ─────────────────────────────────────────────

  /**
   * Execute one simulation tick across all pairs.
   * This is the heartbeat of the price simulation.
   */
  tick() {
    const session = getCurrentSession(this._simulatedHour);
    const pairs = this.marketEngine.getAllPairs();
    const tickResults = [];

    // Rotate institutional bias every 30 ticks (~60 seconds)
    this._biasRotationCounter++;
    if (this._biasRotationCounter >= 30) {
      this._rotateInstitutionalBias();
      this._biasRotationCounter = 0;
    }

    for (const pair of pairs) {
      const state = this._pairState.get(pair.pairId);
      if (!state) continue;

      const result = this._tickPair(pair, state, session);
      if (result) tickResults.push(result);
    }

    this._tickCount++;

    // Notify listeners
    for (const listener of this._onTickListeners) {
      try { listener(tickResults, this._tickCount, session); } catch (e) { /* ignore */ }
    }

    return tickResults;
  }

  /**
   * Simulate one tick for a single market pair.
   */
  _tickPair(pair, state, session) {
    const { params, referenceRate } = state;
    const currentPrice = pair.lastPrice;

    if (currentPrice <= 0 || referenceRate <= 0) return null;

    // ─── 1. Mean-Reversion (Ornstein-Uhlenbeck) ───────────
    const deviation = (referenceRate - currentPrice) / referenceRate;
    const meanReversionPull = params.meanRevSpeed * deviation * currentPrice;

    // ─── 2. Session-Scaled Volatility ─────────────────────
    const volScale = session.volMultiplier;
    const noise = gaussianRandom() * params.baseVol * currentPrice * volScale;

    // ─── 3. Simulated Order Flow ──────────────────────────
    const orderFlowImpact = this._generateOrderFlow(pair, state, session);

    // ─── 4. Momentum Decay ────────────────────────────────
    state.momentum *= 0.92; // Momentum decays 8% per tick
    state.momentum += orderFlowImpact * 0.3;

    // ─── 5. Compute New Price ─────────────────────────────
    const priceChange = meanReversionPull + noise + state.momentum + orderFlowImpact;
    let newPrice = currentPrice + priceChange;

    // Floor: never go below 0.01% of reference
    newPrice = Math.max(referenceRate * 0.0001, newPrice);

    // Ceiling: never exceed 500% of reference (circuit breaker)
    newPrice = Math.min(referenceRate * 5.0, newPrice);

    // ─── 6. Dynamic Spread ────────────────────────────────
    const activityFactor = session.activityMultiplier;
    const spreadRange = params.maxSpread - params.minSpread;
    const dynamicSpread = params.minSpread + spreadRange * (1 - Math.min(1, activityFactor * 0.7));

    // ─── 7. Apply to MarketPair ───────────────────────────
    const previousPrice = pair.lastPrice;
    pair.lastPrice = newPrice;
    pair.bid = newPrice * (1 - dynamicSpread / 2);
    pair.ask = newPrice * (1 + dynamicSpread / 2);
    pair.spread = pair.ask - pair.bid;
    pair.spreadPct = dynamicSpread;
    pair.updatedAt = Date.now();

    // Track direction for flash effects
    const direction = newPrice > previousPrice ? 1 : newPrice < previousPrice ? -1 : 0;
    if (direction === state.lastDirection && direction !== 0) {
      state.consecutiveDir++;
    } else {
      state.consecutiveDir = 0;
    }
    state.lastDirection = direction;
    state.previousPrice = previousPrice;

    // ─── 8. Update 24h Stats ──────────────────────────────
    const tickTradeVol = state.lastTickVolume || (Math.random() < 0.3 ? params.avgTradeSize * 0.2 : 0);
    this._update24hStats(pair.pairId, newPrice, tickTradeVol);

    // ─── 9. Push Price History ────────────────────────────
    const history = this._priceHistory.get(pair.pairId);
    if (history) {
      history.push(newPrice);
      if (history.length > this._maxHistoryPoints) {
        history.shift();
      }
    }

    return {
      pairId: pair.pairId,
      base: pair.baseCurrency,
      quote: pair.quoteCurrency,
      previousPrice,
      newPrice,
      change: newPrice - previousPrice,
      changePct: ((newPrice - previousPrice) / previousPrice) * 100,
      direction,
      bid: pair.bid,
      ask: pair.ask,
      spread: dynamicSpread,
      session: session.name,
      pairClass: state.pairClass,
      tickVolume: tickTradeVol,
      depth: params.depth
    };
  }

  // ─── Order Flow Generation ────────────────────────────────

  /**
   * Generate simulated order flow for a pair.
   * Returns a signed price impact value.
   */
  _generateOrderFlow(pair, state, session) {
    const { params } = state;
    let totalImpact = 0;
    let tickVolume = 0;

    // Probability of any trade occurring this tick (activity-dependent)
    const tradeProbability = Math.min(0.95, 0.4 * session.activityMultiplier);

    // ─── Institutional Flow (60%) ─────────────────────────
    if (Math.random() < tradeProbability * PARTICIPANTS.INSTITUTIONAL.weight) {
      const bias = this._institutionalBias.get(pair.pairId) || 0;
      const direction = Math.random() < (0.5 + bias) ? 1 : -1;
      const size = params.avgTradeSize * PARTICIPANTS.INSTITUTIONAL.sizeMultiplier * (0.5 + Math.random());
      const impact = (size / params.depth) * direction * params.baseVol * 10;
      totalImpact += impact * pair.lastPrice;
      tickVolume += size;

      state.ticksSinceLastTrade = 0;
    }

    // ─── Retail Noise (25%) ───────────────────────────────
    if (Math.random() < tradeProbability * PARTICIPANTS.RETAIL.weight * 2) {
      const direction = Math.random() < 0.5 ? 1 : -1;
      const size = params.avgTradeSize * PARTICIPANTS.RETAIL.sizeMultiplier * (0.2 + Math.random() * 0.8);
      const impact = (size / params.depth) * direction * params.baseVol * 5;
      totalImpact += impact * pair.lastPrice;
      tickVolume += size;
    }

    // ─── Arbitrageur Correction (15%) ─────────────────────
    const pctDeviation = Math.abs(pair.lastPrice - state.referenceRate) / state.referenceRate;
    if (pctDeviation > 0.005) {
      const correctionDirection = pair.lastPrice > state.referenceRate ? -1 : 1;
      const correctionStrength = Math.min(1, pctDeviation * 20);
      const size = params.avgTradeSize * PARTICIPANTS.ARBITRAGEUR.sizeMultiplier * correctionStrength;
      const impact = (size / params.depth) * correctionDirection * params.baseVol * 8;
      totalImpact += impact * pair.lastPrice * PARTICIPANTS.ARBITRAGEUR.biasStrength;
      tickVolume += size;
    }

    // Quiet period counter
    if (totalImpact === 0) {
      state.ticksSinceLastTrade++;
    }

    state.lastTickVolume = tickVolume;
    return totalImpact;
  }

  // ─── Institutional Bias Rotation ──────────────────────────

  /**
   * Slowly rotate institutional order flow bias to create realistic trends.
   * Bias drifts randomly with autocorrelation.
   */
  _rotateInstitutionalBias() {
    for (const [pairId, currentBias] of this._institutionalBias) {
      // Random walk with mean reversion to zero and clamping
      const drift = gaussianRandom() * 0.1;
      const newBias = currentBias * 0.85 + drift * 0.15; // Autocorrelated
      this._institutionalBias.set(pairId, Math.max(-0.4, Math.min(0.4, newBias)));
    }
  }

  // ─── 24h Stats ────────────────────────────────────────────

  _update24hStats(pairId, price, volume) {
    const stats = this._stats24h.get(pairId);
    if (!stats) return;

    // Reset if more than 24 simulated hours (we compress time for demo)
    // Reset every 500 ticks (~16 minutes at 2s ticks) for visible dynamics
    const ticksSinceReset = this._tickCount - (stats._resetTick || 0);
    if (ticksSinceReset > 500) {
      stats.open = price;
      stats.high = price;
      stats.low = price;
      stats.volume = 0;
      stats.tradeCount = 0;
      stats._resetTick = this._tickCount;
    }

    stats.close = price;
    if (price > stats.high) stats.high = price;
    if (price < stats.low) stats.low = price;
    stats.volume += volume;
    stats.tradeCount++;

    // Calculate change from open
    stats.change = stats.close - stats.open;
    stats.changePct = stats.open > 0 ? ((stats.close - stats.open) / stats.open) * 100 : 0;
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Get 24h stats for a pair.
   * @param {string} pairId e.g. "USD/EUR"
   * @returns {object|null}
   */
  get24hStats(pairId) {
    return this._stats24h.get(pairId) || null;
  }

  /**
   * Get all 24h stats.
   * @returns {Map<string, object>}
   */
  getAll24hStats() {
    return new Map(this._stats24h);
  }

  /**
   * Get price history for sparkline rendering.
   * @param {string} pairId
   * @param {number} nPoints  Number of most recent points to return
   * @returns {number[]}
   */
  getPriceHistory(pairId, nPoints = 60) {
    const history = this._priceHistory.get(pairId);
    if (!history) return [];
    return history.slice(-nPoints);
  }

  /**
   * Get simulation state for a pair (for debug/display).
   * @param {string} pairId
   * @returns {object|null}
   */
  getPairState(pairId) {
    return this._pairState.get(pairId) || null;
  }

  /**
   * Get the top N most active pairs by 24h volume, sorted descending.
   * @param {number} n
   * @returns {Array<{pairId, pair, stats, state}>}
   */
  getTopActivePairs(n = 12) {
    const result = [];
    for (const [pairId, stats] of this._stats24h) {
      const pair = this.marketEngine.getAllPairs().find(p => p.pairId === pairId);
      const state = this._pairState.get(pairId);
      if (pair && state) {
        result.push({ pairId, pair, stats, state });
      }
    }

    // Sort by volume descending, with hub/major pairs boosted
    result.sort((a, b) => {
      const aBoost = a.state.pairClass === PAIR_CLASS.MAJOR_FIAT || a.state.pairClass === PAIR_CLASS.HUB_SGA ? 10 : 1;
      const bBoost = b.state.pairClass === PAIR_CLASS.MAJOR_FIAT || b.state.pairClass === PAIR_CLASS.HUB_SGA ? 10 : 1;
      return (b.stats.volume * bBoost) - (a.stats.volume * aBoost);
    });

    return result.slice(0, n);
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Start automatic tick simulation.
   * @param {number} intervalMs  Tick interval in milliseconds (default 2000)
   */
  start(intervalMs = 2000) {
    if (this._intervalHandle) return;
    this._tickIntervalMs = intervalMs;
    this._intervalHandle = setInterval(() => this.tick(), this._tickIntervalMs);
    console.log(`⚡ Swap Simulation started (${this._tickIntervalMs}ms tick, ${this.marketEngine.getAllPairs().length} pairs)`);
  }

  /**
   * Stop automatic simulation.
   */
  stop() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
      console.log('⏸ Swap Simulation stopped');
    }
  }

  /**
   * Is simulation currently running?
   */
  get isRunning() {
    return this._intervalHandle !== null;
  }

  /**
   * Change the tick interval while running.
   * @param {number} intervalMs
   */
  setTickInterval(intervalMs) {
    const wasRunning = this.isRunning;
    this.stop();
    this._tickIntervalMs = intervalMs;
    if (wasRunning) this.start(intervalMs);
  }

  /**
   * Register a tick listener. Called after each tick with (results, tickCount, session).
   * @param {Function} fn
   * @returns {Function} Unsubscribe function
   */
  onTick(fn) {
    this._onTickListeners.add(fn);
    return () => this._onTickListeners.delete(fn);
  }

  /**
   * Get total aggregate 24h swap volume across all active pairs.
   * @returns {number} Volume in USD (e.g. ~4_500_000_000_000 for $4.5T)
   */
  getTotal24hVolume() {
    let total = 0;
    for (const stats of this._stats24h.values()) {
      total += stats.volume || 0;
    }
    return total;
  }

  /**
   * Format volume/depth number into human-readable string (Trillions, Billions, Millions).
   * @param {number} val 
   * @returns {string} e.g. "$4.52T", "$850.4B"
   */
  static formatVolume(val) {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  }

  /**
   * Get engine status summary.
   */
  getStatus() {
    const totalVol = this.getTotal24hVolume();
    return {
      isRunning: this.isRunning,
      tickCount: this._tickCount,
      tickIntervalMs: this._tickIntervalMs,
      pairsTracked: this._pairState.size,
      currentSession: getCurrentSession(this._simulatedHour).name,
      total24hVolume: totalVol,
      formattedTotal24hVolume: SwapSimulationEngine.formatVolume(totalVol)
    };
  }
}
