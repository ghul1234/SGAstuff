/**
 * SGA Network — Market Engine
 * 
 * Dynamic currency pair market management.
 * Pairs are NOT hard-coded. They are created dynamically between any active currencies.
 * Each market maintains:
 *   - baseCurrency, quoteCurrency
 *   - bid, ask, spread, depth, 24h volume, liquidity
 *   - order book simulation data
 */

export class MarketPair {
  constructor({
    baseCurrency,
    quoteCurrency,
    referenceRate = 1.0,
    spreadPct = 0.002 // 0.2% default spread
  }) {
    this.pairId = `${baseCurrency}/${quoteCurrency}`;
    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.lastPrice = referenceRate;
    this.referenceRate = referenceRate;
    this.spreadPct = spreadPct;
    
    // Order book metrics
    this.bid = referenceRate * (1 - spreadPct / 2);
    this.ask = referenceRate * (1 + spreadPct / 2);
    this.spread = this.ask - this.bid;
    this.depthBase = 1_500_000_000_000;  // Liquidity depth in base currency ($1.5 Trillion)
    this.depthQuote = 1_500_000_000_000 * referenceRate; // Liquidity depth in quote currency
    this.volume24h = 0;
    this.high24h = referenceRate * 1.02;
    this.low24h = referenceRate * 0.98;
    this.change24hPct = 0.0;
    this.updatedAt = Date.now();
    this.isActive = true;
  }

  /**
   * Update market quotes based on trade or price walk.
   */
  updatePrice(newPrice) {
    this.lastPrice = newPrice;
    this.bid = newPrice * (1 - this.spreadPct / 2);
    this.ask = newPrice * (1 + this.spreadPct / 2);
    this.spread = this.ask - this.bid;
    if (newPrice > this.high24h) this.high24h = newPrice;
    if (newPrice < this.low24h) this.low24h = newPrice;
    this.updatedAt = Date.now();
  }

  /**
   * Record a trade execution.
   */
  recordTrade(amountBase, price) {
    this.updatePrice(price);
    this.volume24h += amountBase;
  }
}

export class MarketEngine {
  constructor() {
    /** @type {Map<string, MarketPair>} pairId ("VIR/CAL") -> MarketPair */
    this._markets = new Map();
  }

  /**
   * Initialize market pairs between registered currencies.
   * Creates direct pairs against key pivot currencies (USD, EUR, CHN, CAL, VIR) and top SGA currencies.
   * @param {import('./CurrencyRegistry.js').CurrencyRegistry} currencyRegistry
   * @param {import('./EOIEngine.js').EOIEngine} eoiEngine
   */
  init(currencyRegistry, eoiEngine) {
    const currencies = currencyRegistry.getActive().map(c => c.ticker);
    
    // Key liquidity hubs
    const hubs = ['USD', 'EUR', 'CAL', 'VIR', 'CHN', 'TEX', 'NYK', 'JPN', 'DEU'];

    // 1. Create pairs between all hub currencies
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        const base = hubs[i];
        const quote = hubs[j];
        if (currencyRegistry.has(base) && currencyRegistry.has(quote)) {
          this.createPair(base, quote, eoiEngine);
        }
      }
    }

    // 2. Create pairs between every currency and USD / major regional hub
    for (const ticker of currencies) {
      if (!hubs.includes(ticker)) {
        if (currencyRegistry.has('USD')) {
          this.createPair(ticker, 'USD', eoiEngine);
        }
      }
    }

    return this;
  }

  /**
   * Create or get a market pair.
   */
  createPair(baseCurrency, quoteCurrency, eoiEngine) {
    const pairId = `${baseCurrency}/${quoteCurrency}`;
    if (this._markets.has(pairId)) return this._markets.get(pairId);

    const refRate = eoiEngine ? eoiEngine.getFXRate(baseCurrency, quoteCurrency) : 1.0;

    const pair = new MarketPair({
      baseCurrency,
      quoteCurrency,
      referenceRate: refRate > 0 ? refRate : 1.0,
      spreadPct: 0.002
    });

    this._markets.set(pairId, pair);
    return pair;
  }

  /**
   * Get pair by ID or base/quote.
   */
  getPair(baseCurrency, quoteCurrency) {
    const directId = `${baseCurrency}/${quoteCurrency}`;
    if (this._markets.has(directId)) return this._markets.get(directId);

    // Try inverted
    const inverseId = `${quoteCurrency}/${baseCurrency}`;
    if (this._markets.has(inverseId)) {
      const invPair = this._markets.get(inverseId);
      // Create synthetic view or rate
      return {
        pairId: directId,
        baseCurrency,
        quoteCurrency,
        lastPrice: invPair.lastPrice > 0 ? 1 / invPair.lastPrice : 0,
        bid: invPair.ask > 0 ? 1 / invPair.ask : 0,
        ask: invPair.bid > 0 ? 1 / invPair.bid : 0,
        spread: (invPair.ask > 0 ? 1 / invPair.bid : 0) - (invPair.ask > 0 ? 1 / invPair.ask : 0),
        depthBase: invPair.depthQuote,
        depthQuote: invPair.depthBase,
        isInverse: true,
        originalPair: invPair
      };
    }

    return null;
  }

  /**
   * Get all active market pairs.
   */
  getAllPairs() {
    return [...this._markets.values()];
  }

  /**
   * Get all markets involving a specific currency.
   */
  getMarketsForCurrency(ticker) {
    return [...this._markets.values()].filter(
      p => p.baseCurrency === ticker || p.quoteCurrency === ticker
    );
  }

  /**
   * Simulate periodic market updates.
   * Delegates to SwapSimulationEngine when available.
   * Kept for backward compatibility — prefer using SwapSimulationEngine directly.
   * @param {import('./SwapSimulationEngine.js').SwapSimulationEngine} [simEngine]
   */
  tickSimulatedMarkets(simEngine) {
    if (simEngine) {
      return simEngine.tick();
    }
    // Legacy fallback (minimal random walk)
    for (const pair of this._markets.values()) {
      const drift = (Math.random() - 0.498) * 0.001 * pair.lastPrice;
      const newPrice = Math.max(0.0001, pair.lastPrice + drift);
      pair.updatePrice(newPrice);
    }
  }

  /**
   * Get 24h stats for a pair. Requires SwapSimulationEngine reference.
   * @param {string} pairId
   * @param {import('./SwapSimulationEngine.js').SwapSimulationEngine} [simEngine]
   * @returns {object|null}
   */
  get24hStats(pairId, simEngine) {
    if (simEngine) return simEngine.get24hStats(pairId);
    // Fallback: return basic data from pair itself
    const pair = this._markets.get(pairId);
    if (!pair) return null;
    return {
      open: pair.referenceRate,
      high: pair.high24h,
      low: pair.low24h,
      close: pair.lastPrice,
      volume: pair.volume24h,
      changePct: pair.change24hPct
    };
  }

  /**
   * Get price history for sparkline charts.
   * @param {string} pairId
   * @param {number} nPoints
   * @param {import('./SwapSimulationEngine.js').SwapSimulationEngine} [simEngine]
   * @returns {number[]}
   */
  getPriceHistory(pairId, nPoints = 60, simEngine) {
    if (simEngine) return simEngine.getPriceHistory(pairId, nPoints);
    const pair = this._markets.get(pairId);
    if (!pair) return [];
    return [pair.lastPrice]; // Single point if no simulation engine
  }
}
