/**
 * SGA Network — Fee Schedule
 * 
 * Configurable network fee calculator for:
 *   - FX Transaction Fee (1.00% / 100 bps)
 *     → Collected on all foreign exchange transactions conducted through the network
 *     → Revenue directed to the country whose currency/FX activity generated the transaction
 *     → Purpose: eliminate annual budget deficits, then reduce outstanding government debt
 *     → Scales proportionally with global FX trading volume
 * 
 *   - Equities Transaction Fee (0.30% / 30 bps initial rate)
 *     → Collected on all equity transactions processed through the platform
 *     → Provides consistent, sustainable revenue for platform operation and development
 *     → Rate may be reduced by the governing entity as volume increases
 *     → Reductions subject to governance and regulatory requirements
 * 
 *   - Currency conversion (internal network)
 *   - Cross-border payments
 *   - Network transfers
 *   - FX Fee
 */

export class FeeSchedule {
  constructor() {
    // ─── FX Transaction Fee ───────────────────────────────────────────
    // 1.00% (100 bps) network FX transaction fee
    // Applied to all FX transactions conducted through the SGA Network.
    // Revenue is directed to the country whose currency/FX activity 
    // generated the transaction, first to eliminate annual budget deficits,
    // then to reduce outstanding government debt.
    this.fxTransactionBps = 100;  // 1.00% (100 bps)

    // ─── Equities Transaction Fee ─────────────────────────────────────
    // 0.30% (30 bps) initial equities transaction fee
    // Provides consistent, sustainable revenue while supporting platform
    // operation and development. Rate may be reviewed and reduced by the
    // governing entity based on trading volume, market participation,
    // operating costs, and overall financial performance.
    this.equitiesTransactionBps = 30;  // 0.30% (30 bps)
    this.equitiesMinBps = 5;           // Floor: 0.05% minimum (governance limit)
    this.equitiesAdjustable = true;    // Rate may be reduced at governing entity discretion

    // ─── Internal Network Fees ────────────────────────────────────────
    this.conversionBps = 10;      // 0.10% (10 bps) internal conversion
    this.crossBorderFlat = 1.0;   // $1.00 flat fee equivalent
    this.crossBorderBps = 15;     // 0.15% cross-border
    this.fxFeeBps = 25;          // 0.25% FX Fee
    this.futuresFeeBps = 5;      // 0.05% futures fee
    this.gxFeeBps = 50;          // 0.50% GX fee

    // ─── Revenue Tracking ─────────────────────────────────────────────
    // Track cumulative fee revenue by country for deficit paydown
    this._fxRevenueByCountry = new Map();
    this._equitiesRevenueTotal = 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FX TRANSACTION FEE SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate the 1% FX transaction fee.
   * The fee is collected on eligible foreign exchange activity and directed
   * toward paying down the budget deficit of the country whose currency
   * or FX activity generated the transaction.
   * 
   * @param {number} transactionValue - The notional value of the FX transaction
   * @param {string} [currencyTicker] - The currency ticker to attribute revenue to
   * @returns {object} Fee breakdown including amount and revenue attribution
   */
  calculateFXTransactionFee(transactionValue, currencyTicker = null) {
    const feeRate = this.fxTransactionBps / 10000;
    const feeAmount = transactionValue * feeRate;

    // Attribute revenue to the country whose currency generated the transaction
    if (currencyTicker && feeAmount > 0) {
      const current = this._fxRevenueByCountry.get(currencyTicker) || 0;
      this._fxRevenueByCountry.set(currencyTicker, current + feeAmount);
    }

    return {
      feeRate,
      feeRateBps: this.fxTransactionBps,
      feeRatePercent: this.fxTransactionBps / 100,
      feeAmount,
      transactionValue,
      attributedCurrency: currencyTicker,
      revenueAllocation: 'budget_deficit_paydown',
      description: `SGA Network FX Transaction Fee: ${this.fxTransactionBps / 100}% of ${transactionValue.toLocaleString()}`
    };
  }

  /**
   * Get the FX fee rate in basis points.
   * @returns {number} Fee rate in bps (100 = 1%)
   */
  getFXTransactionFeeBps() {
    return this.fxTransactionBps;
  }

  /**
   * Get cumulative FX fee revenue attributed to a specific country/currency.
   * @param {string} currencyTicker 
   * @returns {number} Total revenue attributed to this currency
   */
  getFXRevenueByCountry(currencyTicker) {
    return this._fxRevenueByCountry.get(currencyTicker) || 0;
  }

  /**
   * Get all cumulative FX fee revenue across all countries.
   * @returns {Map<string, number>} Map of currency ticker to cumulative revenue
   */
  getAllFXRevenue() {
    return new Map(this._fxRevenueByCountry);
  }

  /**
   * Get total aggregate FX fee revenue across all countries.
   * @returns {number} Total FX fee revenue
   */
  getTotalFXRevenue() {
    let total = 0;
    for (const amount of this._fxRevenueByCountry.values()) {
      total += amount;
    }
    return total;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EQUITIES TRANSACTION FEE SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate the equities transaction fee (initially 0.30% / 30 bps).
   * The fee provides consistent and sustainable revenue while supporting
   * the operation and development of the platform.
   * 
   * @param {number} transactionValue - The notional value of the equity transaction
   * @param {object} [options] - Additional options
   * @param {string} [options.transactionType] - 'buy', 'sell', or 'trade'
   * @param {string} [options.securityTicker] - The equity ticker symbol
   * @returns {object} Fee breakdown
   */
  calculateEquitiesTransactionFee(transactionValue, options = {}) {
    const feeRate = this.equitiesTransactionBps / 10000;
    const feeAmount = transactionValue * feeRate;

    this._equitiesRevenueTotal += feeAmount;

    return {
      feeRate,
      feeRateBps: this.equitiesTransactionBps,
      feeRatePercent: this.equitiesTransactionBps / 100,
      feeAmount,
      transactionValue,
      transactionType: options.transactionType || 'trade',
      securityTicker: options.securityTicker || null,
      isAdjustable: this.equitiesAdjustable,
      minFeeBps: this.equitiesMinBps,
      revenueAllocation: 'platform_operations',
      description: `SGA Network Equities Fee: ${this.equitiesTransactionBps / 100}% of ${transactionValue.toLocaleString()}`
    };
  }

  /**
   * Get the current equities fee rate in basis points.
   * @returns {number} Fee rate in bps (30 = 0.30%)
   */
  getEquitiesFeeBps() {
    return this.equitiesTransactionBps;
  }

  /**
   * Adjust the equities transaction fee rate (governance action).
   * The fee rate may be reviewed and reduced at the discretion of the
   * governing entity, subject to trading volume, market participation,
   * operating costs, and overall financial performance. Reductions are
   * permitted; increases above the initial 30 bps are not allowed.
   * 
   * @param {number} newBps - New fee rate in basis points
   * @returns {object} Result of the adjustment
   */
  adjustEquitiesFeeRate(newBps) {
    if (!this.equitiesAdjustable) {
      return { success: false, reason: 'Fee rate adjustment is currently disabled' };
    }

    if (newBps > 30) {
      return { 
        success: false, 
        reason: 'Fee rate cannot exceed the initial rate of 30 bps (0.30%). Only reductions are permitted.' 
      };
    }

    if (newBps < this.equitiesMinBps) {
      return { 
        success: false, 
        reason: `Fee rate cannot be reduced below the governance floor of ${this.equitiesMinBps} bps (${this.equitiesMinBps / 100}%).` 
      };
    }

    const previousBps = this.equitiesTransactionBps;
    this.equitiesTransactionBps = newBps;

    return {
      success: true,
      previousBps,
      newBps,
      previousPercent: previousBps / 100,
      newPercent: newBps / 100,
      description: `Equities fee rate adjusted from ${previousBps} bps (${previousBps / 100}%) to ${newBps} bps (${newBps / 100}%)`
    };
  }

  /**
   * Get cumulative equities fee revenue.
   * @returns {number} Total equities fee revenue
   */
  getTotalEquitiesRevenue() {
    return this._equitiesRevenueTotal;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXISTING NETWORK FEES (Internal Routing, Cross-Border, Settlement)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate conversion fee (internal network routing fee).
   */
  calculateConversionFee(amount, isExternal = false) {
    const bps = this.conversionBps + (isExternal ? this.fxFeeBps : 0);
    return (amount * bps) / 10000;
  }

  /**
   * Calculate cross-border payment fee.
   */
  calculatePaymentFee(amount) {
    return this.crossBorderFlat + (amount * this.crossBorderBps) / 10000;
  }

  /**
   * Calculate settlement fee.
   */
  calculateSettlementFee() {
    return this.settlementFlat;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FEE SCHEDULE SUMMARY
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get a complete summary of the current fee schedule.
   * @returns {object} Full fee schedule summary
   */
  getSummary() {
    return {
      fxTransaction: {
        rateBps: this.fxTransactionBps,
        ratePercent: `${this.fxTransactionBps / 100}%`,
        description: 'Applied to all FX transactions; revenue directed to originating country for deficit paydown',
        totalRevenue: this.getTotalFXRevenue(),
        revenueByCountry: Object.fromEntries(this._fxRevenueByCountry)
      },
      equitiesTransaction: {
        rateBps: this.equitiesTransactionBps,
        ratePercent: `${this.equitiesTransactionBps / 100}%`,
        isAdjustable: this.equitiesAdjustable,
        minBps: this.equitiesMinBps,
        description: 'Applied to all equity transactions; supports platform operation and development',
        totalRevenue: this._equitiesRevenueTotal
      },
      internalConversion: {
        rateBps: this.conversionBps,
        ratePercent: `${this.conversionBps / 100}%`
      },
      crossBorder: {
        flatFee: this.crossBorderFlat,
        rateBps: this.crossBorderBps,
        ratePercent: `${this.crossBorderBps / 100}%`
      },
      settlement: {
        flatFee: this.settlementFlat
      },
      fxFee: {
        rateBps: this.fxFeeBps,
        ratePercent: `${this.fxFeeBps / 100}%`
      },
      gxFee: {
        rateBps: this.gxFeeBps,
        ratePercent: `${this.gxFeeBps / 100}%`
      },
      futures: {
        rateBps: this.futuresFeeBps,
        ratePercent: `${this.futuresFeeBps / 100}%`
      }
    };
  }
}
