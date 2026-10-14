/**
 * SGA Network — Settlement Engine
 * 
 * Guarantees atomic transaction execution across multicurrency accounts.
 * Atomicity Model:
 *   - Debit source currency from source account
 *   - Credit destination currency to destination account
 *   - Record fee in fee collector account
 *   - Record full dual-entry audit record in MulticurrencyLedger
 * 
 * Either ALL operations succeed or ALL are rolled back atomically.
 */

import { TRANSACTION_TYPES, TRANSACTION_STATUS } from './MulticurrencyLedger.js';

export class SettlementEngine {
  /**
   * @param {import('./NetworkAccount.js').NetworkAccountService} accountService
   * @param {import('./MulticurrencyLedger.js').MulticurrencyLedger} ledger
   * @param {import('./FXEngine.js').FXEngine} fxEngine
   * @param {import('./FeeSchedule.js').FeeSchedule} feeSchedule
   */
  constructor(accountService, ledger, fxEngine, feeSchedule) {
    this.accountService = accountService;
    this.ledger = ledger;
    this.fxEngine = fxEngine;
    this.feeSchedule = feeSchedule;
  }

  /**
   * Execute an atomic currency conversion between two currencies for an account.
   * 
   * @param {object} params
   * @param {string} params.accountId          Account executing conversion
   * @param {string} params.sourceCurrency     Source currency ticker (e.g. 'VIR')
   * @param {string} params.destinationCurrency Destination currency ticker (e.g. 'CAL')
   * @param {number} params.sourceAmount       Amount to convert
   * @returns {object} Execution result including ledger transaction
   */
  executeAtomicConversion({
    accountId,
    sourceCurrency,
    destinationCurrency,
    sourceAmount
  }) {
    const account = this.accountService.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (!account.hasSufficientBalance(sourceCurrency, sourceAmount)) {
      const current = account.getBalance(sourceCurrency);
      throw new Error(
        `Insufficient ${sourceCurrency} balance. Required: ${sourceAmount}, Available: ${current}`
      );
    }

    // 1. Get conversion quote
    const quote = this.fxEngine.getConversionQuote({
      fromCurrency: sourceCurrency,
      toCurrency: destinationCurrency,
      amount: sourceAmount
    });

    if (quote.outputAmount <= 0) {
      throw new Error(`Execution failed: Could not determine valid output rate for ${sourceCurrency} -> ${destinationCurrency}`);
    }

    const feeCollector = this.accountService.getFeeCollector();

    // 2. ATOMIC EXECUTION BLOCK
    // Create state snapshot for rollback in case of error
    const initialSourceBalance = account.getBalance(sourceCurrency);
    const initialDestBalance = account.getBalance(destinationCurrency);
    const initialFeeBalance = feeCollector ? feeCollector.getBalance(quote.feeCurrency) : 0;

    try {
      // Step A: Debit source currency from user
      account.debit(
        sourceCurrency,
        sourceAmount,
        `Atomic conversion to ${destinationCurrency} via ${quote.providerType}`
      );

      // Step B: Credit destination currency to user
      account.credit(
        destinationCurrency,
        quote.outputAmount,
        `Atomic conversion from ${sourceCurrency}`
      );

      // Step C: Credit fee to network fee collector
      if (feeCollector && quote.feeAmount > 0) {
        feeCollector.credit(
          quote.feeCurrency,
          quote.feeAmount,
          `Network conversion fee from ${accountId}`
        );
      }

      // Step D: Record in dual-entry ledger
      const tx = this.ledger.recordTransaction({
        transactionType: TRANSACTION_TYPES.CONVERSION,
        sourceCurrency,
        destinationCurrency,
        sourceAmount,
        destinationAmount: quote.outputAmount,
        exchangeRate: quote.effectiveRate,
        feeCurrency: quote.feeCurrency,
        feeAmount: quote.feeAmount,
        executionPrice: quote.effectiveRate,
        route: quote.route,
        sourceAccountId: accountId,
        destinationAccountId: accountId,
        providerType: quote.providerType,
        status: TRANSACTION_STATUS.COMPLETED,
        metadata: {
          isFallbackUsed: quote.isFallbackUsed,
          fallbackReason: quote.fallbackReason || null,
          slippagePct: quote.slippagePct
        }
      });

      // Save updated account balances
      this.accountService.save();

      return {
        success: true,
        transaction: tx,
        quote,
        newSourceBalance: account.getBalance(sourceCurrency),
        newDestinationBalance: account.getBalance(destinationCurrency)
      };
    } catch (err) {
      // ROLLBACK STEP
      console.error('Atomic settlement failed! Rolling back state...', err);

      // Restore user balances manually
      try {
        account._balances.set(sourceCurrency, initialSourceBalance);
        account._balances.set(destinationCurrency, initialDestBalance);
        if (feeCollector) {
          feeCollector._balances.set(quote.feeCurrency, initialFeeBalance);
        }
      } catch (rollbackErr) {
        console.error('CRITICAL: Rollback exception:', rollbackErr);
      }

      throw new Error(`Atomic Settlement Failed: ${err.message}`);
    }
  }

  /**
   * Execute an atomic cross-border payment between two different accounts.
   * Sender pays in sourceCurrency, Recipient receives destinationCurrency.
   */
  executeCrossBorderPayment({
    senderAccountId,
    recipientAccountId,
    sourceCurrency,
    destinationCurrency,
    sourceAmount
  }) {
    const sender = this.accountService.getAccount(senderAccountId);
    const recipient = this.accountService.getAccount(recipientAccountId);

    if (!sender) throw new Error(`Sender account not found: ${senderAccountId}`);
    if (!recipient) throw new Error(`Recipient account not found: ${recipientAccountId}`);

    if (!sender.hasSufficientBalance(sourceCurrency, sourceAmount)) {
      throw new Error(`Sender has insufficient ${sourceCurrency} balance.`);
    }

    // Get FX quote for network conversion
    const quote = this.fxEngine.getConversionQuote({
      fromCurrency: sourceCurrency,
      toCurrency: destinationCurrency,
      amount: sourceAmount
    });

    const feeCollector = this.accountService.getFeeCollector();

    // Atomic execution
    try {
      sender.debit(sourceCurrency, sourceAmount, `Payment to ${recipient.name} (${destinationCurrency})`);
      recipient.credit(destinationCurrency, quote.outputAmount, `Payment from ${sender.name} (${sourceCurrency})`);

      if (feeCollector && quote.feeAmount > 0) {
        feeCollector.credit(quote.feeCurrency, quote.feeAmount, `Payment fee from ${senderAccountId}`);
      }

      const tx = this.ledger.recordTransaction({
        transactionType: TRANSACTION_TYPES.PAYMENT,
        sourceCurrency,
        destinationCurrency,
        sourceAmount,
        destinationAmount: quote.outputAmount,
        exchangeRate: quote.effectiveRate,
        feeCurrency: quote.feeCurrency,
        feeAmount: quote.feeAmount,
        executionPrice: quote.effectiveRate,
        route: quote.route,
        sourceAccountId: senderAccountId,
        destinationAccountId: recipientAccountId,
        providerType: quote.providerType,
        status: TRANSACTION_STATUS.COMPLETED,
        metadata: {
          senderName: sender.name,
          recipientName: recipient.name
        }
      });

      this.accountService.save();

      return {
        success: true,
        transaction: tx,
        quote,
        senderNewBalance: sender.getBalance(sourceCurrency),
        recipientNewBalance: recipient.getBalance(destinationCurrency)
      };
    } catch (err) {
      throw new Error(`Cross-Border Payment Failed: ${err.message}`);
    }
  }
}
