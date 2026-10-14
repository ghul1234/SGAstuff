/**
 * SGA Network — Liquidity Pool
 * 
 * Manages liquidity pools for currency pairs.
 * Computes execution prices, slippage curves, and market depth.
 */

export class LiquidityPool {
  constructor({
    pairId,
    baseCurrency,
    quoteCurrency,
    baseReserve = 1_000_000_000_000,
    quoteReserve = 1_000_000_000_000,
    feePct = 0.0015 // 0.15% pool fee
  }) {
    this.pairId = pairId;
    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.baseReserve = baseReserve;
    this.quoteReserve = quoteReserve;
    this.feePct = feePct;
    this.updatedAt = Date.now();
  }

  /**
   * Get current pool price (quoteReserve / baseReserve).
   */
  get SpotPrice() {
    if (this.baseReserve === 0) return 0;
    return this.quoteReserve / this.baseReserve;
  }

  /**
   * Calculate output amount and slippage for a swap using constant product formula (k = x * y).
   * 
   * @param {string} inputCurrency  Currency being provided
   * @param {number} inputAmount    Amount provided
   * @returns {{ outputAmount: number, executionPrice: number, fee: number, slippagePct: number }}
   */
  quoteSwap(inputCurrency, inputAmount) {
    const isBaseInput = inputCurrency === this.baseCurrency;
    const inputReserve = isBaseInput ? this.baseReserve : this.quoteReserve;
    const outputReserve = isBaseInput ? this.quoteReserve : this.baseReserve;

    if (inputReserve === 0 || outputReserve === 0 || inputAmount <= 0) {
      return { outputAmount: 0, executionPrice: 0, fee: 0, slippagePct: 0 };
    }

    // Apply fee to input amount
    const fee = inputAmount * this.feePct;
    const inputAmountWithFee = inputAmount - fee;

    // Constant product formula: dx * dy = (x + dx_in) * (y - dy_out) => dy_out = y * dx_in / (x + dx_in)
    const outputAmount = (outputReserve * inputAmountWithFee) / (inputReserve + inputAmountWithFee);

    // Effective execution price
    const executionPrice = isBaseInput
      ? outputAmount / inputAmount  // quote received per base
      : inputAmount / outputAmount; // quote spent per base

    const spotPrice = this.SpotPrice;
    const idealOutput = isBaseInput ? inputAmountWithFee * spotPrice : inputAmountWithFee / spotPrice;
    const slippagePct = Math.max(0, (idealOutput - outputAmount) / idealOutput);

    return {
      outputAmount,
      executionPrice,
      fee,
      slippagePct,
      isBaseInput
    };
  }

  /**
   * Execute swap on the pool (mutates reserves).
   */
  executeSwap(inputCurrency, inputAmount) {
    const quote = this.quoteSwap(inputCurrency, inputAmount);
    if (quote.outputAmount <= 0) {
      throw new Error(`Insufficient pool liquidity for swap of ${inputAmount} ${inputCurrency}`);
    }

    if (quote.isBaseInput) {
      this.baseReserve += inputAmount;
      this.quoteReserve -= quote.outputAmount;
    } else {
      this.quoteReserve += inputAmount;
      this.baseReserve -= quote.outputAmount;
    }

    this.updatedAt = Date.now();
    return quote;
  }
}
