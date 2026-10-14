/**
 * SGA Network — Network Account Service
 * 
 * Multicurrency accounts that can hold balances in any registered currency.
 * A user has ONE account capable of holding USD, VIR, CAL, CHN, EUR, etc.
 * Supports individual, business, institutional, treasury, and market-maker types.
 */

// ─── Account Types ────────────────────────────────────────
export const ACCOUNT_TYPES = {
  INDIVIDUAL: 'individual',
  BUSINESS: 'business',
  INSTITUTIONAL: 'institutional',
  TREASURY: 'treasury',
  MARKET_MAKER: 'market_maker',
  RESERVE: 'reserve',
  FEE_COLLECTOR: 'fee_collector'
};

// ─── Account Class ────────────────────────────────────────
export class NetworkAccount {
  constructor({ accountId, name, type = ACCOUNT_TYPES.INDIVIDUAL, metadata = {} }) {
    this.accountId = accountId;
    this.name = name;
    this.type = type;
    this.metadata = metadata;
    /** @type {Map<string, number>} currency ticker → balance */
    this._balances = new Map();
    /** @type {Array} balance change history */
    this._history = [];
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.isActive = true;
  }

  /**
   * Credit (add) an amount in a specific currency.
   * @param {string} currency  Ticker
   * @param {number} amount    Positive number
   * @param {string} reason    Audit reason
   * @returns {number} New balance
   */
  credit(currency, amount, reason = '') {
    if (amount <= 0) throw new Error(`Credit amount must be positive: ${amount}`);
    const current = this._balances.get(currency) || 0;
    const newBalance = current + amount;
    this._balances.set(currency, newBalance);
    this._recordHistory('credit', currency, amount, newBalance, reason);
    this.updatedAt = Date.now();
    return newBalance;
  }

  /**
   * Debit (subtract) an amount in a specific currency.
   * @param {string} currency  Ticker
   * @param {number} amount    Positive number
   * @param {string} reason    Audit reason
   * @returns {number} New balance
   * @throws {Error} If insufficient balance
   */
  debit(currency, amount, reason = '') {
    if (amount <= 0) throw new Error(`Debit amount must be positive: ${amount}`);
    const current = this._balances.get(currency) || 0;
    if (current < amount) {
      throw new Error(
        `Insufficient ${currency} balance: have ${current.toFixed(4)}, need ${amount.toFixed(4)}`
      );
    }
    const newBalance = current - amount;
    this._balances.set(currency, newBalance);
    this._recordHistory('debit', currency, amount, newBalance, reason);
    this.updatedAt = Date.now();
    return newBalance;
  }

  /**
   * Get balance for a specific currency.
   * @param {string} currency
   * @returns {number}
   */
  getBalance(currency) {
    return this._balances.get(currency) || 0;
  }

  /**
   * Get all balances as a plain object.
   * @returns {Object<string, number>}
   */
  getAllBalances() {
    const result = {};
    for (const [currency, balance] of this._balances) {
      if (balance > 0) {
        result[currency] = balance;
      }
    }
    return result;
  }

  /**
   * Get all currencies this account holds (non-zero balance).
   * @returns {string[]}
   */
  getHeldCurrencies() {
    return [...this._balances.entries()]
      .filter(([, balance]) => balance > 0)
      .map(([currency]) => currency);
  }

  /**
   * Get the number of distinct currencies held.
   * @returns {number}
   */
  get currencyCount() {
    return this.getHeldCurrencies().length;
  }

  /**
   * Check if account has sufficient balance for a debit.
   * @param {string} currency
   * @param {number} amount
   * @returns {boolean}
   */
  hasSufficientBalance(currency, amount) {
    return (this._balances.get(currency) || 0) >= amount;
  }

  /**
   * Get balance history, optionally filtered.
   * @param {object} filters  { currency?, type?, limit? }
   * @returns {Array}
   */
  getHistory(filters = {}) {
    let history = [...this._history];
    if (filters.currency) {
      history = history.filter(h => h.currency === filters.currency);
    }
    if (filters.type) {
      history = history.filter(h => h.type === filters.type);
    }
    if (filters.limit) {
      history = history.slice(-filters.limit);
    }
    return history;
  }

  /** @private */
  _recordHistory(type, currency, amount, newBalance, reason) {
    this._history.push({
      type,
      currency,
      amount,
      newBalance,
      reason,
      timestamp: Date.now()
    });
    // Keep history bounded to prevent memory issues
    if (this._history.length > 10000) {
      this._history = this._history.slice(-5000);
    }
  }

  /**
   * Serialize for storage.
   */
  toJSON() {
    return {
      accountId: this.accountId,
      name: this.name,
      type: this.type,
      metadata: this.metadata,
      balances: this.getAllBalances(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive
    };
  }

  /**
   * Restore from serialized data.
   * @param {object} data
   * @returns {NetworkAccount}
   */
  static fromJSON(data) {
    const account = new NetworkAccount({
      accountId: data.accountId,
      name: data.name,
      type: data.type,
      metadata: data.metadata || {}
    });
    account.createdAt = data.createdAt;
    account.updatedAt = data.updatedAt;
    account.isActive = data.isActive;
    if (data.balances) {
      for (const [currency, balance] of Object.entries(data.balances)) {
        account._balances.set(currency, balance);
      }
    }
    return account;
  }
}

// ─── Account Service ──────────────────────────────────────
export class NetworkAccountService {
  constructor() {
    /** @type {Map<string, NetworkAccount>} accountId → NetworkAccount */
    this._accounts = new Map();
    this._nextId = 1;
  }

  /**
   * Initialize with default system accounts.
   */
  init() {
    // System fee collector account
    this.createAccount({
      name: 'SGA Network Fee Collector',
      type: ACCOUNT_TYPES.FEE_COLLECTOR
    });

    // Default user demo account with starting balances
    const userAccount = this.createAccount({
      name: 'Demo User',
      type: ACCOUNT_TYPES.INDIVIDUAL
    });
    userAccount.credit('USD', 100000, 'Initial demo balance');
    userAccount.credit('VIR', 50000, 'Initial demo balance');
    userAccount.credit('CAL', 30000, 'Initial demo balance');
    userAccount.credit('TEX', 20000, 'Initial demo balance');
    userAccount.credit('EUR', 15000, 'Initial demo balance');
    userAccount.credit('CHN', 10000, 'Initial demo balance');

    // Demo business treasury account
    const bizAccount = this.createAccount({
      name: 'Acme Corp Treasury',
      type: ACCOUNT_TYPES.BUSINESS,
      metadata: { sector: 'Technology', headquarters: 'Virginia' }
    });
    bizAccount.credit('USD', 2000000, 'Corporate treasury deposit');
    bizAccount.credit('VIR', 500000, 'Virginia operations balance');
    bizAccount.credit('CAL', 300000, 'California operations balance');
    bizAccount.credit('EUR', 1000000, 'European operations balance');

    // Demo market maker account
    const mmAccount = this.createAccount({
      name: 'SGA Market Makers LLC',
      type: ACCOUNT_TYPES.MARKET_MAKER,
      metadata: { providerId: 'MM-001' }
    });
    mmAccount.credit('USD', 50000000, 'Market maker funding');
    mmAccount.credit('VIR', 10000000, 'Liquidity provision');
    mmAccount.credit('CAL', 10000000, 'Liquidity provision');
    mmAccount.credit('TEX', 10000000, 'Liquidity provision');
    mmAccount.credit('NYK', 10000000, 'Liquidity provision');
    mmAccount.credit('CHN', 5000000, 'Liquidity provision');
    mmAccount.credit('EUR', 5000000, 'Liquidity provision');

    return this;
  }

  /**
   * Create a new account.
   * @param {object} params  { name, type, metadata }
   * @returns {NetworkAccount}
   */
  createAccount({ name, type = ACCOUNT_TYPES.INDIVIDUAL, metadata = {} }) {
    const accountId = `acc_${String(this._nextId++).padStart(6, '0')}`;
    const account = new NetworkAccount({ accountId, name, type, metadata });
    this._accounts.set(accountId, account);
    return account;
  }

  /**
   * Get an account by ID.
   * @param {string} accountId
   * @returns {NetworkAccount|null}
   */
  getAccount(accountId) {
    return this._accounts.get(accountId) || null;
  }

  /**
   * Get the first account of a specific type.
   * @param {string} type  ACCOUNT_TYPES value
   * @returns {NetworkAccount|null}
   */
  getFirstByType(type) {
    for (const account of this._accounts.values()) {
      if (account.type === type) return account;
    }
    return null;
  }

  /**
   * Get all accounts of a specific type.
   * @param {string} type
   * @returns {NetworkAccount[]}
   */
  getByType(type) {
    return [...this._accounts.values()].filter(a => a.type === type);
  }

  /**
   * Get the demo user account (convenience).
   * @returns {NetworkAccount}
   */
  getUserAccount() {
    return this.getFirstByType(ACCOUNT_TYPES.INDIVIDUAL);
  }

  /**
   * Get the fee collector account (convenience).
   * @returns {NetworkAccount}
   */
  getFeeCollector() {
    return this.getFirstByType(ACCOUNT_TYPES.FEE_COLLECTOR);
  }

  /**
   * Get all accounts.
   * @returns {NetworkAccount[]}
   */
  getAll() {
    return [...this._accounts.values()];
  }

  /**
   * Total number of accounts.
   * @returns {number}
   */
  get size() {
    return this._accounts.size;
  }

  /**
   * Persist all accounts to localStorage.
   */
  save() {
    const data = {};
    for (const [id, account] of this._accounts) {
      data[id] = account.toJSON();
    }
    localStorage.setItem('sga_network_accounts', JSON.stringify(data));
  }

  /**
   * Load accounts from localStorage.
   */
  load() {
    const stored = localStorage.getItem('sga_network_accounts');
    if (!stored) return false;
    try {
      const data = JSON.parse(stored);
      for (const [id, accountData] of Object.entries(data)) {
        this._accounts.set(id, NetworkAccount.fromJSON(accountData));
      }
      this._nextId = this._accounts.size + 1;
      return true;
    } catch (e) {
      console.warn('Failed to load network accounts:', e);
      return false;
    }
  }
}
