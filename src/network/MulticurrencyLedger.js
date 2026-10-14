/**
 * SGA Network — Multicurrency Ledger
 * 
 * Replaces the single-currency ledger with a dual-entry multicurrency ledger.
 * Every transaction records:
 *  - source_currency & destination_currency
 *  - source_amount & destination_amount
 *  - exchange_rate
 *  - fee_currency & fee_amount
 *  - execution_price
 *  - route
 *  - source_account_id & destination_account_id
 *  - provider_type ("internal" vs "external")
 */

export const TRANSACTION_TYPES = {
  CONVERSION: 'conversion',
  TRANSFER: 'transfer',
  PAYMENT: 'payment',
  SETTLEMENT: 'settlement',
  LIQUIDITY_ADD: 'liquidity_add',
  LIQUIDITY_REMOVE: 'liquidity_remove'
};

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed'
};

export class MulticurrencyTransaction {
  constructor({
    id,
    timestamp,
    transactionType = TRANSACTION_TYPES.CONVERSION,
    sourceCurrency,
    destinationCurrency,
    sourceAmount,
    destinationAmount,
    exchangeRate,
    feeCurrency = null,
    feeAmount = 0,
    executionPrice = null,
    route = [],
    sourceAccountId = null,
    destinationAccountId = null,
    providerType = 'internal',
    status = TRANSACTION_STATUS.COMPLETED,
    metadata = {}
  }) {
    this.id = id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.timestamp = timestamp || new Date().toISOString();
    this.transactionType = transactionType;
    this.sourceCurrency = sourceCurrency;
    this.destinationCurrency = destinationCurrency;
    this.sourceAmount = sourceAmount;
    this.destinationAmount = destinationAmount;
    this.exchangeRate = exchangeRate;
    this.feeCurrency = feeCurrency || sourceCurrency;
    this.feeAmount = feeAmount;
    this.executionPrice = executionPrice || exchangeRate;
    this.route = Array.isArray(route) ? route : [sourceCurrency, destinationCurrency];
    this.sourceAccountId = sourceAccountId;
    this.destinationAccountId = destinationAccountId;
    this.providerType = providerType; // 'internal' | 'external'
    this.status = status;
    this.metadata = metadata;
  }
}

export class MulticurrencyLedger {
  constructor() {
    /** @type {MulticurrencyTransaction[]} */
    this.chain = [];
  }

  async init() {
    const stored = localStorage.getItem('sga_multicurrency_ledger');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.chain = parsed.map(tx => new MulticurrencyTransaction(tx));
      } catch (e) {
        console.warn('Failed to parse multicurrency ledger from storage:', e);
        this._createGenesisBlock();
      }
    } else {
      this._createGenesisBlock();
    }
  }

  _createGenesisBlock() {
    const genesisTx = new MulticurrencyTransaction({
      id: '0',
      timestamp: new Date().toISOString(),
      transactionType: TRANSACTION_TYPES.SETTLEMENT,
      sourceCurrency: 'USD',
      destinationCurrency: 'USD',
      sourceAmount: 0,
      destinationAmount: 0,
      exchangeRate: 1.0,
      feeCurrency: 'USD',
      feeAmount: 0,
      executionPrice: 1.0,
      route: ['USD'],
      providerType: 'internal',
      status: TRANSACTION_STATUS.COMPLETED,
      metadata: { description: 'Multicurrency Ledger Genesis Block' }
    });

    this.chain = [genesisTx];
    this.save();
  }

  /**
   * Record a new transaction in the ledger.
   * @param {object} txData
   * @returns {MulticurrencyTransaction}
   */
  recordTransaction(txData) {
    const tx = new MulticurrencyTransaction(txData);
    this.chain.push(tx);
    this.save();
    return tx;
  }

  save() {
    try {
      localStorage.setItem('sga_multicurrency_ledger', JSON.stringify(this.chain));
    } catch (e) {
      console.warn('Failed to save multicurrency ledger:', e);
    }
  }

  clearAll() {
    this.chain = [];
    localStorage.removeItem('sga_multicurrency_ledger');
    this._createGenesisBlock();
  }

  /**
   * Query records by filters.
   * @param {object} filters
   * @returns {MulticurrencyTransaction[]}
   */
  getRecords(filters = {}) {
    let records = this.chain.filter(tx => tx.id !== '0');

    if (filters.currency) {
      const cur = filters.currency.toUpperCase();
      records = records.filter(
        r => r.sourceCurrency === cur || r.destinationCurrency === cur
      );
    }
    if (filters.sourceCurrency) {
      records = records.filter(r => r.sourceCurrency === filters.sourceCurrency.toUpperCase());
    }
    if (filters.destinationCurrency) {
      records = records.filter(r => r.destinationCurrency === filters.destinationCurrency.toUpperCase());
    }
    if (filters.account) {
      records = records.filter(
        r => r.sourceAccountId === filters.account || r.destinationAccountId === filters.account
      );
    }
    if (filters.transactionType) {
      records = records.filter(r => r.transactionType === filters.transactionType);
    }
    if (filters.providerType) {
      records = records.filter(r => r.providerType === filters.providerType);
    }
    if (filters.startDate) {
      records = records.filter(r => new Date(r.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      records = records.filter(r => new Date(r.timestamp) <= endDate);
    }

    return records.slice().reverse(); // Reverse chronological order
  }

  /**
   * Calculate total volume for a currency or overall.
   */
  getVolume(currency = null) {
    let records = this.chain.filter(tx => tx.id !== '0' && tx.status === TRANSACTION_STATUS.COMPLETED);
    if (currency) {
      const cur = currency.toUpperCase();
      records = records.filter(r => r.sourceCurrency === cur || r.destinationCurrency === cur);
    }
    return records.reduce((sum, tx) => sum + tx.sourceAmount, 0);
  }
}
