/**
 * SGA Network — Payment Engine
 * 
 * Orchestrates multicurrency cross-border payments, business payments, and treasury transfers.
 * Sender pays in Currency A, recipient receives Currency B.
 * Preserves complete audit trail.
 */

export class PaymentEngine {
  /**
   * @param {import('./SettlementEngine.js').SettlementEngine} settlementEngine
   * @param {import('./NetworkAccount.js').NetworkAccountService} accountService
   */
  constructor(settlementEngine, accountService) {
    this.settlementEngine = settlementEngine;
    this.accountService = accountService;
  }

  /**
   * Send a payment across jurisdictions.
   * 
   * Example:
   *   Sender (Virginia, holds VIR) -> SGA Network -> Recipient (California, gets CAL)
   * 
   * @param {object} params
   * @param {string} params.senderAccountId
   * @param {string} params.recipientAccountId
   * @param {string} params.sendCurrency        Currency sender pays in (e.g. 'VIR')
   * @param {string} params.receiveCurrency     Currency recipient receives in (e.g. 'CAL')
   * @param {number} params.sendAmount          Amount sender is paying
   */
  sendPayment({
    senderAccountId,
    recipientAccountId,
    sendCurrency,
    receiveCurrency,
    sendAmount
  }) {
    return this.settlementEngine.executeCrossBorderPayment({
      senderAccountId,
      recipientAccountId,
      sourceCurrency: sendCurrency,
      destinationCurrency: receiveCurrency,
      sourceAmount: sendAmount
    });
  }

  /**
   * Get payment history for an account.
   * @param {string} accountId
   * @param {import('./MulticurrencyLedger.js').MulticurrencyLedger} ledger
   */
  getPaymentHistory(accountId, ledger) {
    return ledger.getRecords({ account: accountId, transactionType: 'payment' });
  }
}
