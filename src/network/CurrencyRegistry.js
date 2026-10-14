/**
 * SGA Network — Currency Registry
 * 
 * Central registry of all currencies in the network.
 * Supports three currency types: sga-state, sga-country, fiat.
 * Dynamically generates SGA currencies from existing economic data.
 * Adding a new currency never requires modifying other modules.
 */

// ─── Currency Types ───────────────────────────────────────
export const CURRENCY_TYPES = {
  SGA_STATE: 'sga-state',
  SGA_COUNTRY: 'sga-country',
  FIAT: 'fiat'
};

// ─── Currency Status ──────────────────────────────────────
export const CURRENCY_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended'
};

// ─── US State Ticker Map ──────────────────────────────────
// 3-letter tickers for US states (matching prompt examples)
const STATE_TICKERS = {
  AL: 'ALA', AK: 'ALK', AZ: 'ARZ', AR: 'ARK', CA: 'CAL',
  CO: 'COL', CT: 'CON', DE: 'DEL', FL: 'FLO', GA: 'GEO',
  HI: 'HAW', ID: 'IDA', IL: 'ILL', IN: 'IND', IA: 'IOW',
  KS: 'KAN', KY: 'KEN', LA: 'LOU', ME: 'MAI', MD: 'MRY',
  MA: 'MAS', MI: 'MIC', MN: 'MIN', MS: 'MIS', MO: 'MOS',
  MT: 'MON', NE: 'NEB', NV: 'NEV', NH: 'NHP', NJ: 'NJR',
  NM: 'NMX', NY: 'NYK', NC: 'NCA', ND: 'NDA', OH: 'OHI',
  OK: 'OKL', OR: 'ORE', PA: 'PEN', RI: 'RHO', SC: 'SCA',
  SD: 'SDA', TN: 'TEN', TX: 'TEX', UT: 'UTA', VT: 'VER',
  VA: 'VIR', WA: 'WAS', WV: 'WVA', WI: 'WIS', WY: 'WYO'
};

// ─── Fiat Currency Definitions ────────────────────────────
const FIAT_CURRENCIES = [
  { ticker: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, jurisdiction: 'United States' },
  { ticker: 'EUR', name: 'Euro', symbol: '€', decimals: 2, jurisdiction: 'European Union' },
  { ticker: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, jurisdiction: 'United Kingdom' },
  { ticker: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, jurisdiction: 'Japan' },
  { ticker: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, jurisdiction: 'China' },
  { ticker: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, jurisdiction: 'Switzerland' },
  { ticker: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, jurisdiction: 'Canada' },
  { ticker: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, jurisdiction: 'Australia' },
  { ticker: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, jurisdiction: 'India' },
  { ticker: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, jurisdiction: 'South Korea' },
  { ticker: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, jurisdiction: 'Brazil' },
  { ticker: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2, jurisdiction: 'Mexico' },
  { ticker: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, jurisdiction: 'Singapore' },
  { ticker: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, jurisdiction: 'Hong Kong' },
  { ticker: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, jurisdiction: 'Sweden' },
  { ticker: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, jurisdiction: 'Norway' },
  { ticker: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2, jurisdiction: 'New Zealand' },
  { ticker: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, jurisdiction: 'South Africa' },
  { ticker: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, jurisdiction: 'United Arab Emirates' },
  { ticker: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, jurisdiction: 'Saudi Arabia' }
];

// ─── Country ISO Alpha-3 Map ──────────────────────────────
const COUNTRY_TICKERS = {
  us: 'USA', cn: 'CHN', jp: 'JPN', de: 'DEU', in: 'IND',
  gb: 'GBR', fr: 'FRA', it: 'ITA', br: 'BRA', ca: 'CAN',
  ru: 'RUS', kr: 'KOR', au: 'AUS', mx: 'MEX', es: 'ESP',
  id: 'IDN', tr: 'TUR', nl: 'NLD', sa: 'SAU', ch: 'CHE',
  ar: 'ARG', se: 'SWE', pl: 'POL', be: 'BEL', th: 'THA',
  ie: 'IRL', at: 'AUT', no: 'NOR', il: 'ISR', ae: 'ARE',
  ng: 'NGA', eg: 'EGY', za: 'ZAF', vn: 'VNM', ph: 'PHL',
  bd: 'BGD', my: 'MYS', sg: 'SGP', hk: 'HKG', dk: 'DNK',
  fi: 'FIN', cz: 'CZE', ro: 'ROU', gr: 'GRC', pt: 'PRT',
  hu: 'HUN', nz: 'NZL', cl: 'CHL', co: 'COL', pe: 'PER',
  pk: 'PAK', ua: 'UKR', iq: 'IRQ', kz: 'KAZ', dz: 'DZA',
  qa: 'QAT', kw: 'KWT', om: 'OMN', cr: 'CRI', pa: 'PAN',
  uy: 'URY', lu: 'LUX', is: 'ISL', mt: 'MLT', cy: 'CYP',
  lv: 'LVA', ee: 'EST', lt: 'LTU', sk: 'SVK', si: 'SVN',
  hr: 'HRV', bg: 'BGR', mk: 'MKD', rs: 'SRB', ba: 'BIH',
  me: 'MNE', ge: 'GEO', am: 'ARM', az: 'AZE', by: 'BLR',
  md: 'MDA', uz: 'UZB', kg: 'KGZ', tj: 'TJK', tm: 'TKM',
  mn: 'MNG', np: 'NPL', lk: 'LKA', mm: 'MMR', kh: 'KHM',
  la: 'LAO', bn: 'BRN', bt: 'BTN', mv: 'MDV', af: 'AFG',
  ir: 'IRN', sy: 'SYR', lb: 'LBN', jo: 'JOR', ye: 'YEM',
  et: 'ETH', ke: 'KEN', ma: 'MAR', tn: 'TUN', ly: 'LBY',
  sd: 'SDN', ao: 'AGO', gh: 'GHA', tz: 'TZA', ug: 'UGA',
  zm: 'ZMB', zw: 'ZWE', mu: 'MUS', bw: 'BWA', na: 'NAM',
  mg: 'MDG', ci: 'CIV', sn: 'SEN', ml: 'MLI', bf: 'BFA',
  ne: 'NER', cg: 'COG', cd: 'COD', cm: 'CMR', ga: 'GAB',
  rw: 'RWA', mo: 'MOZ', mw: 'MWI', bo: 'BOL', ec: 'ECU',
  py: 'PRY', gy: 'GUY', sr: 'SUR', jm: 'JAM', tt: 'TTO',
  bb: 'BRB', bs: 'BHS', do: 'DOM', ht: 'HTI', cu: 'CUB',
  gt: 'GTM', hn: 'HND', sv: 'SLV', ni: 'NIC', ve: 'VEN',
  fj: 'FJI', pg: 'PNG', vu: 'VUT', sb: 'SLB', to: 'TON',
  ws: 'WSM', ki: 'KIR', tv: 'TUV', nr: 'NRU', pw: 'PLW',
  fm: 'FSM', mh: 'MHL', al: 'ALB', ad: 'AND', ag: 'ATG',
  ai: 'AIA'
};

// ─── Currency Class ───────────────────────────────────────
export class Currency {
  constructor({
    ticker,
    type,
    name,
    symbol,
    jurisdiction,
    economicIndex,
    networkId,
    referencePrice,
    decimals = 2,
    status = CURRENCY_STATUS.ACTIVE,
    sourceDataId = null
  }) {
    this.ticker = ticker;
    this.type = type;
    this.name = name;
    this.symbol = symbol || ticker;
    this.jurisdiction = jurisdiction;
    this.economicIndex = economicIndex || 0;
    this.networkId = networkId || `SGA-${ticker}`;
    this.referencePrice = referencePrice || 1.0;
    this.decimals = decimals;
    this.status = status;
    this.sourceDataId = sourceDataId; // Links back to statesData/worldData id
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }
}

// ─── Currency Registry ────────────────────────────────────
export class CurrencyRegistry {
  constructor() {
    /** @type {Map<string, Currency>} ticker → Currency */
    this._currencies = new Map();
    /** @type {Map<string, string>} sourceDataId → ticker */
    this._sourceIdIndex = new Map();
  }

  /**
   * Initialize from existing data sources.
   * @param {Array} statesData  US states from data.js
   * @param {Array} worldData   Countries from worldData.js
   */
  init(statesData = [], worldData = []) {
    // 1. Register fiat currencies
    for (const fiat of FIAT_CURRENCIES) {
      this.register(new Currency({
        ticker: fiat.ticker,
        type: CURRENCY_TYPES.FIAT,
        name: fiat.name,
        symbol: fiat.symbol,
        jurisdiction: fiat.jurisdiction,
        referencePrice: 1.0, // Fiat reference is self (1 USD = 1 USD)
        decimals: fiat.decimals,
        status: CURRENCY_STATUS.ACTIVE
      }));
    }

    // 2. Register US state SGA currencies
    for (const state of statesData) {
      const ticker = STATE_TICKERS[state.id];
      if (!ticker) continue;
      
      const eoi = state.eoi || 0;
      // Reference price derived from EOI: scale to a reasonable currency unit
      // Use EOI / 100 to get values like 0.83 for Alabama (EOI 83.2) or 2.72 for California (EOI 272)
      const refPrice = eoi / 100;

      this.register(new Currency({
        ticker,
        type: CURRENCY_TYPES.SGA_STATE,
        name: `${state.name} SGA`,
        symbol: ticker,
        jurisdiction: state.name,
        economicIndex: eoi,
        referencePrice: refPrice,
        decimals: 4,
        status: CURRENCY_STATUS.ACTIVE,
        sourceDataId: state.id
      }));
    }

    // 3. Register country SGA currencies
    for (const country of worldData) {
      const ticker = COUNTRY_TICKERS[country.id];
      if (!ticker) continue;

      const eoi = country.eoi || 0;
      const refPrice = eoi / 100;

      this.register(new Currency({
        ticker,
        type: CURRENCY_TYPES.SGA_COUNTRY,
        name: `${country.name} SGA`,
        symbol: ticker,
        jurisdiction: country.name,
        economicIndex: eoi,
        referencePrice: refPrice,
        decimals: 4,
        status: CURRENCY_STATUS.ACTIVE,
        sourceDataId: country.id
      }));
    }

    return this;
  }

  /**
   * Register a new currency. Idempotent — updates if ticker exists.
   * @param {Currency} currency
   */
  register(currency) {
    this._currencies.set(currency.ticker, currency);
    if (currency.sourceDataId) {
      this._sourceIdIndex.set(currency.sourceDataId, currency.ticker);
    }
    return currency;
  }

  /**
   * Look up a currency by ticker.
   * @param {string} ticker
   * @returns {Currency|null}
   */
  get(ticker) {
    return this._currencies.get(ticker) || null;
  }

  /**
   * Look up a currency by its source data ID (e.g., 'CA', 'us', 'CN.GD').
   * @param {string} sourceId
   * @returns {Currency|null}
   */
  getBySourceId(sourceId) {
    const ticker = this._sourceIdIndex.get(sourceId);
    return ticker ? this.get(ticker) : null;
  }

  /**
   * Check if a ticker is registered.
   * @param {string} ticker
   * @returns {boolean}
   */
  has(ticker) {
    return this._currencies.has(ticker);
  }

  /**
   * Get all currencies of a specific type.
   * @param {string} type  One of CURRENCY_TYPES values
   * @returns {Currency[]}
   */
  getByType(type) {
    return [...this._currencies.values()].filter(c => c.type === type);
  }

  /**
   * Get all active currencies.
   * @returns {Currency[]}
   */
  getActive() {
    return [...this._currencies.values()].filter(c => c.status === CURRENCY_STATUS.ACTIVE);
  }

  /**
   * Get all registered currencies.
   * @returns {Currency[]}
   */
  getAll() {
    return [...this._currencies.values()];
  }

  /**
   * Get all tickers.
   * @returns {string[]}
   */
  getAllTickers() {
    return [...this._currencies.keys()];
  }

  /**
   * Total count of registered currencies.
   * @returns {number}
   */
  get size() {
    return this._currencies.size;
  }

  /**
   * Update the economic index and reference price for an SGA currency.
   * @param {string} ticker
   * @param {number} newEOI
   */
  updateEconomicIndex(ticker, newEOI) {
    const currency = this.get(ticker);
    if (!currency) return null;
    currency.economicIndex = newEOI;
    currency.referencePrice = newEOI / 100;
    currency.updatedAt = Date.now();
    return currency;
  }

  /**
   * Suspend a currency (disable trading).
   * @param {string} ticker
   */
  suspend(ticker) {
    const currency = this.get(ticker);
    if (currency) {
      currency.status = CURRENCY_STATUS.SUSPENDED;
      currency.updatedAt = Date.now();
    }
    return currency;
  }

  /**
   * Reactivate a suspended currency.
   * @param {string} ticker
   */
  activate(ticker) {
    const currency = this.get(ticker);
    if (currency) {
      currency.status = CURRENCY_STATUS.ACTIVE;
      currency.updatedAt = Date.now();
    }
    return currency;
  }

  /**
   * Get a formatted summary for debugging.
   */
  summary() {
    const fiat = this.getByType(CURRENCY_TYPES.FIAT).length;
    const states = this.getByType(CURRENCY_TYPES.SGA_STATE).length;
    const countries = this.getByType(CURRENCY_TYPES.SGA_COUNTRY).length;
    return { total: this.size, fiat, sgaStates: states, sgaCountries: countries };
  }
}
