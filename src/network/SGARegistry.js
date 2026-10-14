/**
 * SGA Network — SGA Registry
 * 
 * SGA-specific management layer on top of CurrencyRegistry.
 * Handles jurisdiction metadata, settlement rules, and the
 * "Add New Jurisdiction" workflow.
 */

import { CurrencyRegistry, Currency, CURRENCY_TYPES, CURRENCY_STATUS } from './CurrencyRegistry.js';

// ─── Settlement Rule Templates ────────────────────────────
export const SETTLEMENT_RULES = {
  T0: { label: 'T+0 (Instant)', delayMs: 0 },
  T1: { label: 'T+1 (Next Day)', delayMs: 86400000 },
  T2: { label: 'T+2 (Standard)', delayMs: 172800000 }
};

// ─── SGA Metadata ─────────────────────────────────────────
export class SGAMetadata {
  constructor({
    ticker,
    jurisdiction,
    jurisdictionType,     // 'state', 'country', 'province', 'territory'
    parentJurisdiction,   // e.g., 'USA' for states, null for countries
    economicDataSource,   // 'FRED', 'worldData', 'manual'
    settlementRule,       // SETTLEMENT_RULES key
    governanceModel,      // 'sovereign', 'federated', 'autonomous'
    createdAt
  }) {
    this.ticker = ticker;
    this.jurisdiction = jurisdiction;
    this.jurisdictionType = jurisdictionType || 'country';
    this.parentJurisdiction = parentJurisdiction || null;
    this.economicDataSource = economicDataSource || 'manual';
    this.settlementRule = settlementRule || 'T0';
    this.governanceModel = governanceModel || 'sovereign';
    this.createdAt = createdAt || Date.now();
    this.isValidated = false;
    this.validatedAt = null;
    this.markets = [];  // Tickers of connected liquidity markets
  }
}

// ─── SGA Registry ─────────────────────────────────────────
export class SGARegistry {
  /**
   * @param {CurrencyRegistry} currencyRegistry
   */
  constructor(currencyRegistry) {
    this.currencyRegistry = currencyRegistry;
    /** @type {Map<string, SGAMetadata>} ticker → SGAMetadata */
    this._metadata = new Map();
  }

  /**
   * Initialize SGA metadata from existing currency registry data.
   * Called after CurrencyRegistry.init().
   */
  init() {
    // Register metadata for all SGA-state currencies
    const states = this.currencyRegistry.getByType(CURRENCY_TYPES.SGA_STATE);
    for (const currency of states) {
      this._metadata.set(currency.ticker, new SGAMetadata({
        ticker: currency.ticker,
        jurisdiction: currency.jurisdiction,
        jurisdictionType: 'state',
        parentJurisdiction: 'USA',
        economicDataSource: 'FRED',
        settlementRule: 'T0',
        governanceModel: 'federated'
      }));
    }

    // Register metadata for all SGA-country currencies
    const countries = this.currencyRegistry.getByType(CURRENCY_TYPES.SGA_COUNTRY);
    for (const currency of countries) {
      this._metadata.set(currency.ticker, new SGAMetadata({
        ticker: currency.ticker,
        jurisdiction: currency.jurisdiction,
        jurisdictionType: 'country',
        parentJurisdiction: null,
        economicDataSource: 'worldData',
        settlementRule: 'T0',
        governanceModel: 'sovereign'
      }));
    }

    return this;
  }

  /**
   * Get SGA metadata for a ticker.
   * @param {string} ticker
   * @returns {SGAMetadata|null}
   */
  getMetadata(ticker) {
    return this._metadata.get(ticker) || null;
  }

  /**
   * Add a new jurisdiction to the network.
   * Follows the workflow:
   *   Create jurisdiction → Validate economic data → Create SGA →
   *   Register currency → Create liquidity markets →
   *   Connect reserve → Enable settlement → Enable transfers
   * 
   * @param {object} params
   * @param {string} params.ticker          3-letter ticker
   * @param {string} params.name            Full name (e.g., "Puerto Rico SGA")
   * @param {string} params.jurisdiction    Jurisdiction name
   * @param {string} params.jurisdictionType  'state'|'country'|'province'|'territory'
   * @param {string} params.parentJurisdiction  Parent (e.g., 'USA')
   * @param {number} params.economicIndex   Initial EOI value
   * @param {string} params.settlementRule  SETTLEMENT_RULES key
   * @returns {{ currency: Currency, metadata: SGAMetadata, steps: string[] }}
   */
  addJurisdiction({
    ticker,
    name,
    jurisdiction,
    jurisdictionType = 'country',
    parentJurisdiction = null,
    economicIndex = 50,
    settlementRule = 'T0'
  }) {
    const steps = [];

    // Step 1: Validate no duplicate
    if (this.currencyRegistry.has(ticker)) {
      throw new Error(`Currency ${ticker} already registered in the network.`);
    }
    steps.push(`✓ Validated: ${ticker} is unique in the network`);

    // Step 2: Validate economic data
    if (economicIndex <= 0 || economicIndex > 500) {
      throw new Error(`Invalid economic index: ${economicIndex}. Must be between 1 and 500.`);
    }
    steps.push(`✓ Economic data validated: EOI = ${economicIndex}`);

    // Step 3: Create and register currency
    const type = jurisdictionType === 'state' || jurisdictionType === 'province'
      ? CURRENCY_TYPES.SGA_STATE
      : CURRENCY_TYPES.SGA_COUNTRY;

    const currency = this.currencyRegistry.register(new Currency({
      ticker,
      type,
      name,
      symbol: ticker,
      jurisdiction,
      economicIndex,
      referencePrice: economicIndex / 100,
      decimals: 4,
      status: CURRENCY_STATUS.PENDING // Start as pending until markets are created
    }));
    steps.push(`✓ SGA currency created: ${ticker} (${name})`);

    // Step 4: Register SGA metadata
    const metadata = new SGAMetadata({
      ticker,
      jurisdiction,
      jurisdictionType,
      parentJurisdiction,
      economicDataSource: 'manual',
      settlementRule,
      governanceModel: parentJurisdiction ? 'federated' : 'sovereign'
    });
    this._metadata.set(ticker, metadata);
    steps.push(`✓ Jurisdiction registered: ${jurisdiction} (${jurisdictionType})`);

    // Step 5: Mark as validated
    metadata.isValidated = true;
    metadata.validatedAt = Date.now();
    steps.push(`✓ Jurisdiction validated at ${new Date().toISOString()}`);

    // Steps 6-8 (liquidity markets, reserves, settlement) are handled by other engines
    // when they detect a new PENDING currency and activate it.
    steps.push(`⏳ Liquidity markets: awaiting MarketEngine activation`);
    steps.push(`⏳ Reserve: awaiting ReserveManager connection`);
    steps.push(`⏳ Settlement: awaiting SettlementEngine enablement`);

    return { currency, metadata, steps };
  }

  /**
   * Activate a pending jurisdiction (called after markets/reserves/settlement are ready).
   * @param {string} ticker
   */
  activateJurisdiction(ticker) {
    this.currencyRegistry.activate(ticker);
    const metadata = this._metadata.get(ticker);
    if (metadata) {
      metadata.isValidated = true;
      metadata.validatedAt = Date.now();
    }
  }

  /**
   * Get all SGAs grouped by jurisdiction type.
   */
  getGrouped() {
    const result = { states: [], countries: [], provinces: [], territories: [] };
    for (const [, meta] of this._metadata) {
      const currency = this.currencyRegistry.get(meta.ticker);
      if (!currency) continue;
      const entry = { ...meta, currency };
      switch (meta.jurisdictionType) {
        case 'state': result.states.push(entry); break;
        case 'country': result.countries.push(entry); break;
        case 'province': result.provinces.push(entry); break;
        case 'territory': result.territories.push(entry); break;
      }
    }
    return result;
  }

  /**
   * Get all SGAs under a parent jurisdiction.
   * @param {string} parent  e.g., 'USA'
   * @returns {SGAMetadata[]}
   */
  getByParent(parent) {
    return [...this._metadata.values()].filter(m => m.parentJurisdiction === parent);
  }

  /**
   * Summary for debugging.
   */
  summary() {
    const grouped = this.getGrouped();
    return {
      total: this._metadata.size,
      states: grouped.states.length,
      countries: grouped.countries.length,
      provinces: grouped.provinces.length,
      territories: grouped.territories.length
    };
  }
}
