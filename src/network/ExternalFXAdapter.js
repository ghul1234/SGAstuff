/**
 * SGA Network — External FX Adapter
 * 
 * Fallback mechanism for currency conversions when internal SGA network liquidity is insufficient.
 * Explicitly auditable: system marks external transactions as providerType = "external".
 */

export class ExternalFXAdapter {
  constructor() {
    this.name = 'Global Interbank FX Gateway';
    // SGA Network FX Transaction Fee: 1% (100 bps) applied to all FX activity
    // Revenue directed to originating country for deficit paydown
    this.feeBps = 100; // 1.00% (100 bps) FX transaction fee
  }

  /**
   * Check if external FX provider can service this pair/amount.
   */
  canExecute(fromCurrency, toCurrency, amount) {
    return amount > 0 && fromCurrency !== toCurrency;
  }

  /**
   * Get quote from external FX provider.
   * Rates are derived using reference prices with external markup.
   */
  getQuote(fromCurrency, toCurrency, amount, eoiEngine) {
    const basePrice = eoiEngine ? eoiEngine.getMarketPrice(fromCurrency) : 1.0;
    const quotePrice = eoiEngine ? eoiEngine.getMarketPrice(toCurrency) : 1.0;

    const rawRate = quotePrice > 0 ? basePrice / quotePrice : 1.0;
    const feePct = this.feeBps / 10000;
    const feeAmount = amount * feePct;

    // External spread markdown (0.3% worse rate)
    const externalRate = rawRate * 0.997;
    const outputAmount = (amount - feeAmount) * externalRate;

    return {
      providerName: this.name,
      fromCurrency,
      toCurrency,
      inputAmount: amount,
      outputAmount: Math.max(0, outputAmount),
      effectiveRate: externalRate,
      feeCurrency: fromCurrency,
      feeAmount,
      slippagePct: 0.001,
      providerType: 'external',
      route: [fromCurrency, 'EXT-FX', toCurrency]
    };
  }

  /**
   * Execute conversion through external provider.
   */
  execute(fromCurrency, toCurrency, amount, eoiEngine) {
    const quote = this.getQuote(fromCurrency, toCurrency, amount, eoiEngine);
    return {
      ...quote,
      status: 'completed',
      executedAt: Date.now()
    };
  }
}
