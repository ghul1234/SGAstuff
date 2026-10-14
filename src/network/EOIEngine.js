/**
 * SGA Network — EOI Engine
 * 
 * Extracted Economic Opportunity Index calculation engine.
 * Maintains separate price concepts:
 *   - Economic Value (EOI score)
 *   - Reference Price (derived from EOI)
 *   - Market Price (live trading — may diverge)
 *   - FX Rate (cross-currency exchange rate)
 *   - Settlement Price (official clearing price)
 */

// ─── Price Types ──────────────────────────────────────────
export const PRICE_TYPES = {
  ECONOMIC_VALUE: 'economic_value',   // Raw EOI score
  REFERENCE_PRICE: 'reference_price', // EOI / 100
  MARKET_PRICE: 'market_price',       // Live trading price
  FX_RATE: 'fx_rate',                 // Exchange rate between two currencies
  SETTLEMENT_PRICE: 'settlement_price' // Official settlement
};

// ─── EOI Engine ───────────────────────────────────────────
export class EOIEngine {
  constructor() {
    /** @type {Map<string, object>} ticker → { economicValue, referencePrice, marketPrice, settlementPrice, updatedAt } */
    this._prices = new Map();
  }

  /**
   * Initialize from currency registry.
   * @param {import('./CurrencyRegistry.js').CurrencyRegistry} currencyRegistry
   */
  init(currencyRegistry) {
    for (const currency of currencyRegistry.getAll()) {
      this._prices.set(currency.ticker, {
        economicValue: currency.economicIndex,
        referencePrice: currency.referencePrice,
        marketPrice: currency.referencePrice, // Initially = reference
        settlementPrice: currency.referencePrice,
        updatedAt: Date.now()
      });
    }
    return this;
  }

  /**
   * Calculate EOI from raw economic metrics.
   * This is the core formula — extracted from the existing codebase.
   * 
   * @param {object} metrics  { gdp, growth, tax, employment, business, investment, productivity, inflation }
   * @returns {number} EOI score
   */
  calculateEOI(metrics) {
    const {
      gdp = 0,
      growth = 0,
      employment = 0,
      business = 0,
      investment = 0,
      productivity = 0,
      inflation = 0
    } = metrics;

    // Weighted composite index
    // Positive factors
    const growthScore = growth * 8;
    const employmentScore = (employment - 90) * 5;  // Baseline 90%
    const businessScore = Math.log10(Math.max(business, 1) + 1) * 15;
    const investmentScore = Math.log10(Math.max(investment, 1) + 1) * 12;
    const productivityScore = productivity * 0.6;
    const gdpScore = Math.log10(Math.max(gdp, 1) + 1) * 20;

    // Negative factors
    const inflationPenalty = Math.max(0, inflation - 2) * 3; // Penalty above 2%

    const raw = gdpScore + growthScore + employmentScore + businessScore +
                investmentScore + productivityScore - inflationPenalty;

    return Math.max(0, parseFloat(raw.toFixed(1)));
  }

  /**
   * Get the economic value (EOI score) for a currency.
   * @param {string} ticker
   * @returns {number}
   */
  getEconomicValue(ticker) {
    return this._prices.get(ticker)?.economicValue || 0;
  }

  /**
   * Get the reference price for a currency.
   * @param {string} ticker
   * @returns {number}
   */
  getReferencePrice(ticker) {
    return this._prices.get(ticker)?.referencePrice || 1.0;
  }

  /**
   * Get the market price for a currency.
   * @param {string} ticker
   * @returns {number}
   */
  getMarketPrice(ticker) {
    return this._prices.get(ticker)?.marketPrice || this.getReferencePrice(ticker);
  }

  /**
   * Get the settlement price for a currency.
   * @param {string} ticker
   * @returns {number}
   */
  getSettlementPrice(ticker) {
    return this._prices.get(ticker)?.settlementPrice || this.getReferencePrice(ticker);
  }

  /**
   * Update the market price for a currency (from live trading).
   * @param {string} ticker
   * @param {number} price
   */
  setMarketPrice(ticker, price) {
    const entry = this._prices.get(ticker);
    if (entry) {
      entry.marketPrice = price;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Update the settlement price (e.g., at end of trading day).
   * @param {string} ticker
   * @param {number} price
   */
  setSettlementPrice(ticker, price) {
    const entry = this._prices.get(ticker);
    if (entry) {
      entry.settlementPrice = price;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Update economic data and recalculate EOI + reference price.
   * @param {string} ticker
   * @param {object} metrics
   * @param {import('./CurrencyRegistry.js').CurrencyRegistry} currencyRegistry
   */
  updateEconomicData(ticker, metrics, currencyRegistry) {
    const newEOI = this.calculateEOI(metrics);
    const refPrice = newEOI / 100;

    const entry = this._prices.get(ticker);
    if (entry) {
      entry.economicValue = newEOI;
      entry.referencePrice = refPrice;
      entry.updatedAt = Date.now();
    }

    // Also update the currency registry
    if (currencyRegistry) {
      currencyRegistry.updateEconomicIndex(ticker, newEOI);
    }

    return { eoi: newEOI, referencePrice: refPrice };
  }

  /**
   * Compute the FX rate between two currencies using their market prices.
   * Rate = price(base) / price(quote)
   * So 1 unit of `base` = rate units of `quote`.
   * 
   * @param {string} base   Base currency ticker
   * @param {string} quote  Quote currency ticker
   * @returns {number} Exchange rate
   */
  getFXRate(base, quote) {
    const basePrice = this.getMarketPrice(base);
    const quotePrice = this.getMarketPrice(quote);
    if (quotePrice === 0) return 0;
    return basePrice / quotePrice;
  }

  /**
   * Get all price data for a ticker.
   * @param {string} ticker
   */
  getAllPrices(ticker) {
    const entry = this._prices.get(ticker);
    if (!entry) return null;
    return {
      ticker,
      economicValue: entry.economicValue,
      referencePrice: entry.referencePrice,
      marketPrice: entry.marketPrice,
      settlementPrice: entry.settlementPrice,
      deviation: entry.marketPrice / entry.referencePrice - 1, // How far market deviates from reference
      updatedAt: entry.updatedAt
    };
  }

  /**
   * Get all currencies with their prices, sorted by economic value.
   * @returns {Array}
   */
  getLeaderboard() {
    return [...this._prices.entries()]
      .map(([ticker, data]) => ({
        ticker,
        ...data,
        deviation: data.marketPrice / data.referencePrice - 1
      }))
      .sort((a, b) => b.economicValue - a.economicValue);
  }
}
