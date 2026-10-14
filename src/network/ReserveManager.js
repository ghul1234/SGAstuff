/**
 * SGA Network — Reserve Manager
 * 
 * Tracks reserves for each participating SGA/currency.
 * Reserve accounts are separate from user balances.
 * Tracks:
 *   - totalReserves
 *   - availableLiquidity
 *   - lockedLiquidity
 *   - settlementLiquidity
 *   - emergencyLiquidity
 */

export class ReserveAccount {
  constructor({
    ticker,
    totalReserves = 100_000_000,
    lockedLiquidity = 20_000_000,
    settlementLiquidity = 10_000_000,
    emergencyLiquidity = 5_000_000
  }) {
    this.ticker = ticker;
    this.totalReserves = totalReserves;
    this.lockedLiquidity = lockedLiquidity;
    this.settlementLiquidity = settlementLiquidity;
    this.emergencyLiquidity = emergencyLiquidity;
    this.updatedAt = Date.now();
  }

  get availableLiquidity() {
    const locked = this.lockedLiquidity + this.settlementLiquidity + this.emergencyLiquidity;
    return Math.max(0, this.totalReserves - locked);
  }

  /**
   * Check if reserve ratio is healthy (> 20% available).
   */
  get isHealthy() {
    if (this.totalReserves === 0) return false;
    return (this.availableLiquidity / this.totalReserves) >= 0.20;
  }
}

export class ReserveManager {
  constructor() {
    /** @type {Map<string, ReserveAccount>} ticker -> ReserveAccount */
    this._reserves = new Map();
  }

  /**
   * Initialize reserves for all registered currencies.
   * @param {import('./CurrencyRegistry.js').CurrencyRegistry} currencyRegistry
   */
  init(currencyRegistry) {
    for (const currency of currencyRegistry.getAll()) {
      const isFiat = currency.type === 'fiat';
      const baseVal = isFiat ? 1_000_000_000 : 500_000_000;

      this._reserves.set(currency.ticker, new ReserveAccount({
        ticker: currency.ticker,
        totalReserves: baseVal,
        lockedLiquidity: baseVal * 0.15,
        settlementLiquidity: baseVal * 0.05,
        emergencyLiquidity: baseVal * 0.02
      }));
    }
    return this;
  }

  /**
   * Get reserve details for a currency.
   * @param {string} ticker
   * @returns {ReserveAccount|null}
   */
  getReserve(ticker) {
    return this._reserves.get(ticker) || null;
  }

  /**
   * Get total network reserves summary across all currencies.
   */
  getNetworkSummary() {
    let total = 0;
    let healthyCount = 0;
    for (const res of this._reserves.values()) {
      total += res.totalReserves;
      if (res.isHealthy) healthyCount++;
    }
    return {
      currencyCount: this._reserves.size,
      healthyCount,
      totalReservesAggregate: total
    };
  }
}
