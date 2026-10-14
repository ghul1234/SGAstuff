/**
 * SGA Network — FX Engine
 * 
 * Top-level currency conversion engine.
 * Selects optimal route between internal network liquidity and external FX fallback.
 * Determines execution route without assuming USD is always the intermediary.
 */

import { ExternalFXAdapter } from './ExternalFXAdapter.js';

export class FXEngine {
  /**
   * @param {import('./MarketEngine.js').MarketEngine} marketEngine
   * @param {import('./LiquidityRouter.js').LiquidityRouter} router
   * @param {import('./EOIEngine.js').EOIEngine} eoiEngine
   */
  constructor(marketEngine, router, eoiEngine) {
    this.marketEngine = marketEngine;
    this.router = router;
    this.eoiEngine = eoiEngine;
    this.externalAdapter = new ExternalFXAdapter();
  }

  /**
   * Calculate conversion estimate for A -> B.
   * Compares internal network liquidity path vs external FX fallback.
   * 
   * @param {object} params
   * @param {string} params.fromCurrency
   * @param {string} params.toCurrency
   * @param {number} params.amount
   * @param {boolean} params.forceExternal
   */
  getConversionQuote({ fromCurrency, toCurrency, amount, forceExternal = false }) {
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        inputAmount: amount,
        outputAmount: amount,
        effectiveRate: 1.0,
        feeCurrency: fromCurrency,
        feeAmount: 0,
        slippagePct: 0,
        route: [fromCurrency],
        providerType: 'internal',
        isFallbackUsed: false
      };
    }

    // 1. Evaluate internal network route unless external forced
    let internalQuote = null;
    if (!forceExternal) {
      const bestRoute = this.router.findOptimalRoute(fromCurrency, toCurrency, amount);
      if (bestRoute && bestRoute.outputAmount > 0) {
        internalQuote = {
          fromCurrency,
          toCurrency,
          inputAmount: amount,
          outputAmount: bestRoute.outputAmount,
          effectiveRate: bestRoute.effectiveRate,
          feeCurrency: fromCurrency,
          feeAmount: bestRoute.fees,
          slippagePct: bestRoute.slippagePct,
          route: bestRoute.route,
          providerType: 'internal',
          isFallbackUsed: false
        };
      }
    }

    // 2. Evaluate external FX quote
    const externalQuote = this.externalAdapter.getQuote(fromCurrency, toCurrency, amount, this.eoiEngine);

    // 3. Select best execution route
    // Use internal if it gives better or equal output, otherwise fallback to external
    if (internalQuote && internalQuote.outputAmount >= externalQuote.outputAmount) {
      return internalQuote;
    } else {
      return {
        ...externalQuote,
        isFallbackUsed: true,
        fallbackReason: internalQuote ? 'External FX provided better net yield' : 'Insufficient internal network liquidity'
      };
    }
  }
}
