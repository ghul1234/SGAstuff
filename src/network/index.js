/**
 * SGA Multicurrency Financial Network — Main Facade & Entrypoint
 * 
 * Bundles all 14 service modules:
 *   1. CurrencyRegistry
 *   2. SGARegistry
 *   3. EOIEngine
 *   4. NetworkAccountService
 *   5. MulticurrencyLedger
 *   6. MarketEngine
 *   7. LiquidityPool
 *   8. FXEngine
 *   9. LiquidityRouter
 *  10. ExternalFXAdapter
 *  11. SettlementEngine
 *  12. ReserveManager
 *  13. FeeSchedule
 *  14. PaymentEngine / RiskEngine
 */

import { CurrencyRegistry } from './CurrencyRegistry.js';
import { SGARegistry } from './SGARegistry.js';
import { EOIEngine } from './EOIEngine.js';
import { NetworkAccountService } from './NetworkAccount.js';
import { MulticurrencyLedger } from './MulticurrencyLedger.js';
import { MarketEngine } from './MarketEngine.js';
import { FXEngine } from './FXEngine.js';
import { LiquidityRouter } from './LiquidityRouter.js';
import { SettlementEngine } from './SettlementEngine.js';
import { ReserveManager } from './ReserveManager.js';
import { FeeSchedule } from './FeeSchedule.js';
import { PaymentEngine } from './PaymentEngine.js';
import { RiskEngine } from './RiskEngine.js';
import { SwapSimulationEngine } from './SwapSimulationEngine.js';

export class SGANetwork {
  constructor() {
    this.currencyRegistry = new CurrencyRegistry();
    this.sgaRegistry = new SGARegistry(this.currencyRegistry);
    this.eoiEngine = new EOIEngine();
    this.accountService = new NetworkAccountService();
    this.ledger = new MulticurrencyLedger();
    this.marketEngine = new MarketEngine();
    this.router = new LiquidityRouter(this.marketEngine, this.currencyRegistry);
    this.fxEngine = new FXEngine(this.marketEngine, this.router, this.eoiEngine);
    this.feeSchedule = new FeeSchedule();
    this.settlementEngine = new SettlementEngine(
      this.accountService,
      this.ledger,
      this.fxEngine,
      this.feeSchedule
    );
    this.reserveManager = new ReserveManager();
    this.paymentEngine = new PaymentEngine(this.settlementEngine, this.accountService);
    this.riskEngine = new RiskEngine(this.eoiEngine, this.reserveManager);
    this.swapSimulation = new SwapSimulationEngine(this.marketEngine, this.eoiEngine);

    this.isInitialized = false;
  }

  /**
   * Boot up the SGA Network with existing datasets.
   */
  async init(statesData = [], worldData = []) {
    if (this.isInitialized) return this;

    // 1. Boot currency & SGA registries
    this.currencyRegistry.init(statesData, worldData);
    this.sgaRegistry.init();

    // 2. Boot EOI engine
    this.eoiEngine.init(this.currencyRegistry);

    // 3. Boot accounts & ledger
    const loadedAccounts = this.accountService.load();
    if (!loadedAccounts) {
      this.accountService.init();
    }
    await this.ledger.init();

    // 4. Boot markets & liquidity
    this.marketEngine.init(this.currencyRegistry, this.eoiEngine);

    // 5. Boot reserves
    this.reserveManager.init(this.currencyRegistry);

    // 6. Boot swap price simulation
    this.swapSimulation.init();
    this.swapSimulation.start(2000);

    this.isInitialized = true;
    console.log('🌐 SGA Multicurrency Network Initialized successfully!');
    console.log('   Registry:', this.currencyRegistry.summary());
    console.log('   Reserves:', this.reserveManager.getNetworkSummary());
    console.log('   Simulation:', this.swapSimulation.getStatus());

    return this;
  }
}

// Global Singleton Instance
export const sgaNetwork = new SGANetwork();
