/**
 * SGA Network — Risk Engine
 * 
 * Risk assessment service.
 * Computes:
 *   - Multicurrency wallet risk & exposure breakdown
 *   - Currency concentration risk
 *   - Network liquidity risk
 *   - Volatility indicators
 */

export class RiskEngine {
  /**
   * @param {import('./EOIEngine.js').EOIEngine} eoiEngine
   * @param {import('./ReserveManager.js').ReserveManager} reserveManager
   */
  constructor(eoiEngine, reserveManager) {
    this.eoiEngine = eoiEngine;
    this.reserveManager = reserveManager;
  }

  /**
   * Assess risk profile for a multicurrency wallet.
   * 
   * @param {import('./NetworkAccount.js').NetworkAccount} account
   * @param {string} baseFiat  Base currency to express net worth (e.g., 'USD')
   */
  assessWalletRisk(account, baseFiat = 'USD') {
    const balances = account.getAllBalances();
    let totalBaseValue = 0;
    const currencyValues = [];

    for (const [ticker, amount] of Object.entries(balances)) {
      const rate = this.eoiEngine ? this.eoiEngine.getFXRate(ticker, baseFiat) : 1.0;
      const baseValue = amount * rate;
      totalBaseValue += baseValue;
      currencyValues.push({ ticker, amount, rate, baseValue });
    }

    if (totalBaseValue === 0) {
      return { totalBaseValue: 0, concentrationRiskScore: 0, topCurrencySharePct: 0, breakdown: [] };
    }

    // Sort by base value descending
    currencyValues.sort((a, b) => b.baseValue - a.baseValue);

    // Calculate concentration metrics (Herfindahl-Hirschman Index - HHI)
    let hhi = 0;
    const breakdown = currencyValues.map(item => {
      const sharePct = (item.baseValue / totalBaseValue) * 100;
      hhi += Math.pow(sharePct / 100, 2);
      return {
        ...item,
        sharePct: parseFloat(sharePct.toFixed(2))
      };
    });

    const topShare = breakdown.length > 0 ? breakdown[0].sharePct : 0;
    const riskLevel = hhi > 0.6 ? 'High Risk (Concentrated)' : hhi > 0.3 ? 'Moderate Risk' : 'Low Risk (Diversified)';

    return {
      totalBaseValue,
      concentrationHHI: parseFloat(hhi.toFixed(4)),
      topCurrencySharePct: topShare,
      riskLevel,
      breakdown
    };
  }

  /**
   * Assess overall network risk metrics.
   */
  assessNetworkRisk() {
    const summary = this.reserveManager ? this.reserveManager.getNetworkSummary() : { healthyCount: 0, currencyCount: 1 };
    const healthRatio = summary.currencyCount > 0 ? summary.healthyCount / summary.currencyCount : 1.0;

    return {
      healthRatio: parseFloat(healthRatio.toFixed(2)),
      healthyCurrencies: summary.healthyCount,
      totalCurrencies: summary.currencyCount,
      networkRiskStatus: healthRatio >= 0.8 ? 'Optimal' : healthRatio >= 0.5 ? 'Caution' : 'High Risk'
    };
  }
}
