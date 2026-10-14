/**
 * SGA Network — Liquidity Router
 * 
 * Graph-based routing engine.
 * Currencies are nodes; liquidity markets are edges.
 * Uses graph search (Dijkstra / BFS / candidate path evaluator) to find the optimal path
 * considering:
 *   - Exchange rate
 *   - Available liquidity
 *   - Spread & fees
 *   - Slippage
 *   - Execution risk
 */

export class LiquidityRouter {
  /**
   * @param {import('./MarketEngine.js').MarketEngine} marketEngine
   * @param {import('./CurrencyRegistry.js').CurrencyRegistry} currencyRegistry
   */
  constructor(marketEngine, currencyRegistry) {
    this.marketEngine = marketEngine;
    this.currencyRegistry = currencyRegistry;
  }

  /**
   * Build network adjacency graph.
   * Node: ticker
   * Edge: { target: ticker, pair: MarketPair, isDirect: boolean }
   */
  buildGraph() {
    const graph = new Map();
    const pairs = this.marketEngine.getAllPairs();

    for (const pair of pairs) {
      if (!pair.isActive) continue;

      const base = pair.baseCurrency;
      const quote = pair.quoteCurrency;

      if (!graph.has(base)) graph.set(base, []);
      if (!graph.has(quote)) graph.set(quote, []);

      // Base -> Quote
      graph.get(base).push({
        target: quote,
        pairId: pair.pairId,
        rate: pair.bid,
        spread: pair.spreadPct,
        depth: pair.depthBase
      });

      // Quote -> Base (inverse)
      graph.get(quote).push({
        target: base,
        pairId: pair.pairId,
        rate: pair.ask > 0 ? 1 / pair.ask : 0,
        spread: pair.spreadPct,
        depth: pair.depthQuote
      });
    }

    return graph;
  }

  /**
   * Find candidate conversion paths between source and target currency.
   * Limits path depth to 3 hops (e.g. VIR -> USD -> CHN -> CAL).
   * 
   * @param {string} sourceCurrency
   * @param {string} targetCurrency
   * @param {number} maxHops
   * @returns {string[][]} Array of routes, e.g. [ ['VIR', 'CAL'], ['VIR', 'USD', 'CAL'] ]
   */
  findCandidateRoutes(sourceCurrency, targetCurrency, maxHops = 3) {
    if (sourceCurrency === targetCurrency) return [[sourceCurrency]];

    const graph = this.buildGraph();
    const routes = [];

    const dfs = (current, path, visited) => {
      if (path.length > maxHops + 1) return;
      if (current === targetCurrency) {
        routes.push([...path]);
        return;
      }

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.target)) {
          visited.add(neighbor.target);
          path.push(neighbor.target);
          dfs(neighbor.target, path, visited);
          path.pop();
          visited.delete(neighbor.target);
        }
      }
    };

    const visited = new Set([sourceCurrency]);
    dfs(sourceCurrency, [sourceCurrency], visited);

    return routes;
  }

  /**
   * Evaluate a route for a given input amount.
   * Returns estimated output, total fees, slippage, and effective rate.
   * 
   * @param {string[]} route  Array of tickers e.g. ['VIR', 'USD', 'CAL']
   * @param {number} inputAmount
   */
  evaluateRoute(route, inputAmount) {
    if (route.length < 2) {
      return { route, outputAmount: inputAmount, effectiveRate: 1.0, fees: 0, slippagePct: 0, isValid: false };
    }

    let currentAmount = inputAmount;
    let totalFee = 0;
    let maxSlippage = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to = route[i + 1];
      const pair = this.marketEngine.getPair(from, to);

      if (!pair) {
        return { route, outputAmount: 0, effectiveRate: 0, fees: 0, slippagePct: 0, isValid: false };
      }

      const rate = pair.isInverse
        ? (pair.originalPair.ask > 0 ? 1 / pair.originalPair.ask : 0)
        : pair.bid;

      if (rate <= 0) {
        return { route, outputAmount: 0, effectiveRate: 0, fees: 0, slippagePct: 0, isValid: false };
      }

      // SGA Network FX Transaction Fee: 1% (100 bps) per hop
      // Revenue directed to originating country for deficit paydown
      const fee = currentAmount * 0.01; // 1.00% FX transaction fee
      totalFee += fee;
      const amountAfterFee = currentAmount - fee;

      // Estimate slippage based on depth
      const depth = pair.depthBase || 1_000_000;
      const hopSlippage = Math.min(0.05, amountAfterFee / depth);
      maxSlippage += hopSlippage;

      currentAmount = amountAfterFee * rate * (1 - hopSlippage);
    }

    const effectiveRate = inputAmount > 0 ? currentAmount / inputAmount : 0;

    return {
      route,
      inputAmount,
      outputAmount: Math.max(0, currentAmount),
      effectiveRate,
      fees: totalFee,
      slippagePct: maxSlippage,
      isValid: currentAmount > 0
    };
  }

  /**
   * Find the single optimal route between source and destination currency.
   * 
   * @param {string} sourceCurrency
   * @param {string} targetCurrency
   * @param {number} inputAmount
   */
  findOptimalRoute(sourceCurrency, targetCurrency, inputAmount = 1000) {
    const candidates = this.findCandidateRoutes(sourceCurrency, targetCurrency, 3);
    if (candidates.length === 0) return null;

    const evaluated = candidates
      .map(r => this.evaluateRoute(r, inputAmount))
      .filter(res => res.isValid);

    if (evaluated.length === 0) return null;

    // Sort by best output amount descending
    evaluated.sort((a, b) => b.outputAmount - a.outputAmount);

    return evaluated[0];
  }
}
