/**
 * SGA Multicurrency Network — Frontend UI Renderer
 * 
 * Renders:
 *   1. Multicurrency Network Dashboard (#network-page)
 *   2. Multicurrency Wallet & FX Terminal (#wallet-page)
 *   3. FX Liquidity Routing & Pair Depth (#fx-page)
 */

import { sgaNetwork } from './network/index.js';
import { statesData } from './data.js';
import { worldData } from './worldData.js';

export async function initNetworkUI() {
  await sgaNetwork.init(statesData, worldData);
  window.sgaNetwork = sgaNetwork; // Expose globally for interactive buttons
  
  // Load user profile
  loadUserProfile();

  // Auto-refresh network transactions after a short delay to capture any FX transactions
  setTimeout(() => {
    if (window.refreshNetworkTransactions) {
      window.refreshNetworkTransactions();
    }
  }, 1000);
}

/**
 * Render the main SGA Network Dashboard HTML page.
 */
export function renderNetworkPage() {
  const container = document.getElementById('network-page');
  if (!container) return;

  // Load user profile name
  const userName = loadUserProfile();
  
  const registry = sgaNetwork.currencyRegistry;
  const eoiEngine = sgaNetwork.eoiEngine;
  const reserveMgr = sgaNetwork.reserveManager;
  const summary = reserveMgr.getNetworkSummary();

  const currencies = registry.getActive();
  const states = registry.getByType('sga-state');
  const countries = registry.getByType('sga-country');
  const fiats = registry.getByType('fiat');
  const tickers = registry.getAllTickers();

  // Calculate combined EOI scores for fiat currencies based on their constituent divisions
  function calculateCombinedEOI(currencyTicker) {
    let combinedEOI = 0;
    
    switch(currencyTicker) {
      case 'USD':
        // Sum all US states
        combinedEOI = statesData.reduce((sum, state) => sum + (state.eoi || 0), 0);
        break;
      case 'EUR':
        // Sum European countries (Germany, France, Italy, Spain, Netherlands, etc.)
        const euroCountryIds = ['de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'pt', 'gr', 'ie', 'fi', 'lt', 'lv', 'ee', 'sk', 'si', 'hr', 'cy', 'mt', 'lu'];
        combinedEOI = worldData.filter(c => euroCountryIds.includes(c.id)).reduce((sum, country) => sum + (country.eoi || 0), 0);
        break;
      case 'GBP':
        // UK is a single country in our data
        const ukCountry = worldData.find(c => c.id === 'gb');
        combinedEOI = ukCountry ? ukCountry.eoi : 0;
        break;
      case 'JPY':
        // Japan is a single country in our data
        const japanCountry = worldData.find(c => c.id === 'jp');
        combinedEOI = japanCountry ? japanCountry.eoi : 0;
        break;
      case 'CAD':
        // Canada is a single country in our data
        const canadaCountry = worldData.find(c => c.id === 'ca');
        combinedEOI = canadaCountry ? canadaCountry.eoi : 0;
        break;
      case 'AUD':
        // Australia is a single country in our data
        const australiaCountry = worldData.find(c => c.id === 'au');
        combinedEOI = australiaCountry ? australiaCountry.eoi : 0;
        break;
      case 'CHF':
        // Switzerland is a single country in our data
        const switzerlandCountry = worldData.find(c => c.id === 'ch');
        combinedEOI = switzerlandCountry ? switzerlandCountry.eoi : 0;
        break;
      case 'CNY':
        // China is a single country in our data
        const chinaCountry = worldData.find(c => c.id === 'cn');
        combinedEOI = chinaCountry ? chinaCountry.eoi : 0;
        break;
      case 'SAR':
        // Saudi Arabia is a single country in our data
        const saudiCountry = worldData.find(c => c.id === 'sa');
        combinedEOI = saudiCountry ? saudiCountry.eoi : 0;
        break;
      default:
        // For other currencies, use the existing EOI engine value
        combinedEOI = eoiEngine.getEconomicValue(currencyTicker);
    }
    
    return combinedEOI;
  }

  // Institution data with verified IDs and details
  const institutionData = {
    'US Government': {
      name: 'US Government',
      institutionId: 'INST-US-GOV-00001',
      institutionType: 'Government',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000001',
      brokerageParticipant: 'Federal Reserve System'
    },
    'Federal Reserve': {
      name: 'Federal Reserve',
      institutionId: 'INST-US-FED-00002',
      institutionType: 'Central Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000002',
      brokerageParticipant: 'Self-Clearing'
    },
    'American Bank': {
      name: 'American Bank',
      institutionId: 'INST-US-AB-00003',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000003',
      brokerageParticipant: 'JP Morgan Clearing Corp'
    },
    'JPMorgan Chase': {
      name: 'JPMorgan Chase',
      institutionId: 'INST-US-JPM-00004',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000004',
      brokerageParticipant: 'Self-Clearing'
    },
    'Bank of America': {
      name: 'Bank of America',
      institutionId: 'INST-US-BOA-00005',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000005',
      brokerageParticipant: 'Self-Clearing'
    },
    'Wells Fargo': {
      name: 'Wells Fargo',
      institutionId: 'INST-US-WF-00006',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000006',
      brokerageParticipant: 'Self-Clearing'
    },
    'Citigroup': {
      name: 'Citigroup',
      institutionId: 'INST-US-CITI-00007',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000007',
      brokerageParticipant: 'Self-Clearing'
    },
    'Goldman Sachs': {
      name: 'Goldman Sachs',
      institutionId: 'INST-US-GS-00001',
      institutionType: 'Investment Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000184',
      brokerageParticipant: 'Self-Clearing'
    },
    'Morgan Stanley': {
      name: 'Morgan Stanley',
      institutionId: 'INST-US-MS-00008',
      institutionType: 'Investment Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000008',
      brokerageParticipant: 'Self-Clearing'
    },
    'US Treasury': {
      name: 'US Treasury',
      institutionId: 'INST-US-TREAS-00009',
      institutionType: 'Government',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000009',
      brokerageParticipant: 'Federal Reserve System'
    },
    'European Central Bank': {
      name: 'European Central Bank',
      institutionId: 'INST-EU-ECB-00010',
      institutionType: 'Central Bank',
      jurisdiction: 'European Union',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000010',
      brokerageParticipant: 'Self-Clearing'
    },
    'Bank of England': {
      name: 'Bank of England',
      institutionId: 'INST-UK-BOE-00011',
      institutionType: 'Central Bank',
      jurisdiction: 'United Kingdom',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000011',
      brokerageParticipant: 'Self-Clearing'
    },
    'User Account': {
      name: 'User Account',
      institutionId: 'INST-US-USER-00001',
      institutionType: 'Individual',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000999',
      brokerageParticipant: 'Self-Clearing'
    },
    'SGA Network': {
      name: 'SGA Network',
      institutionId: 'INST-SGA-NET-00001',
      institutionType: 'Network',
      jurisdiction: 'Global',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000888',
      brokerageParticipant: 'Self-Clearing'
    }
  };

  container.innerHTML = `
    <div style="background: linear-gradient(180deg, #005a9e 0%, #004080 100%); padding: 20px; border-bottom: 3px solid #003366; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 24px; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">SGA Network - Banking Portal</h1>
        <p style="color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; margin: 8px 0 0 0;">Secure Financial Network for Sovereign Growth Assets</p>
      </div>
      <button onclick="window.openFeeSettingsModal()" style="background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; backdrop-filter: blur(4px);" onmouseover="this.style.background='rgba(255,255,255,0.2)'; this.style.borderColor='rgba(255,255,255,0.5)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.3)'">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>

    <!-- Status Bar -->
    <div style="background: #f0f0f0; border: 1px solid #999; padding: 8px 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <span><strong>Status:</strong> Online | <strong>Connection:</strong> Secure | <strong>Server:</strong> US-East-1</span>
      <span>${new Date().toLocaleString()}</span>
    </div>

    <!-- User Profile Section -->
    <div style="background: linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%); border: 2px solid #666; border-radius: 6px; padding: 15px; margin-bottom: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.2);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 8px 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; border: 2px solid #666; border-bottom: none;">
        <h3 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">User Profile</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Your Name</div>
          <input type="text" id="user-profile-name" placeholder="Enter your name or institution" style="width: 100%; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; background: #ffffff;" value="User Account">
        </div>
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Account Type</div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #333; font-weight: 600;">Individual</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
        <button onclick="window.saveUserProfile()" style="padding: 8px; background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); border: 1px solid #003366; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">Save Profile</button>
        <button onclick="window.resetUserProfile()" style="padding: 8px; background: linear-gradient(180deg, #666 0%, #444 100%); border: 1px solid #333; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">Reset Name</button>
        <button onclick="window.resetForexLedger()" style="padding: 8px; background: linear-gradient(180deg, #d4a017 0%, #a06000 100%); border: 1px solid #7a4500; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">Reset Ledger</button>
      </div>
    </div>

    <!-- Network Health Metrics - Windows XP Style -->
    <div style="background: linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%); border: 2px solid #666; border-radius: 6px; padding: 15px; margin-bottom: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.2);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 8px 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; border: 2px solid #666; border-bottom: none;">
        <h3 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">Network Overview</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Active Currencies</div>
          <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 20px; color: #0066cc; font-weight: bold;">${currencies.length}</div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-top: 5px;">${states.length} States | ${countries.length} Nations | ${fiats.length} Fiats</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Active Market Pairs</div>
          <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 20px; color: #0066cc; font-weight: bold;">${sgaNetwork.marketEngine.getAllPairs().length}</div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-top: 5px;">Dynamic Inter-SGA Liquidity</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Total Network Reserves</div>
          <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 20px; color: #006600; font-weight: bold;">$${(summary.totalReservesAggregate / 1e9).toFixed(1)}B</div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-top: 5px;">${summary.healthyCount}/${summary.currencyCount} Reserves Healthy (>20%)</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #999; padding: 12px; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Instant Settlement</div>
          <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 20px; color: #0066cc; font-weight: bold;">T+0 (Instant)</div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-top: 5px;">All-or-Nothing Dual-Entry</div>
        </div>
      </div>
    </div>

    <!-- SGA Network Fee Schedule Trigger Button Bar -->
    <div style="background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%); border: 1px solid #999; border-radius: 4px; padding: 10px 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">📋</span>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; font-weight: bold; color: #333;">SGA Network Fee System</span>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #e9ecef; border: 1px solid #ced4da; padding: 1px 8px; border-radius: 10px;">FX 1.00% | Equities 0.30% <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></span>
      </div>
      <button onclick="window.openFeeScheduleModal()" style="padding: 6px 14px; background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); border: 1px solid #003366; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3); box-shadow: 0 1px 2px rgba(0,0,0,0.2);">View Fee Schedule ↗</button>
    </div>

    <!-- Active SGA Currencies Grid - Windows 7 Style -->
    <div style="background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%); border: 1px solid #999; border-radius: 4px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
      <div style="background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%); padding: 8px 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; border-bottom: 1px solid #ccc;">
        <h3 style="color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; font-weight: bold;">Participating SGA Currencies</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
        ${currencies.slice(0, 16).map(c => {
          const eoi = calculateCombinedEOI(c.ticker);
          const price = eoiEngine.getMarketPrice(c.ticker);
          return `
            <div style="background: #ffffff; border: 1px solid #ccc; padding: 10px; border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)'" onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.1)'">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <div style="font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; color: #0066cc; font-size: 14px;">${c.ticker}</div>
                <span style="background: #e8f4ff; border: 1px solid #99ccff; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #0066cc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${c.type}</span>
              </div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; margin-bottom: 8px;">${c.name}</div>
              <div style="border-top: 1px solid #e0e0e0; padding-top: 8px; font-size: 11px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span style="color: #666;">EOI Score:</span>
                  <span style="color: #006600; font-weight: bold;">${eoi.toFixed(1)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #666;">Ref Price:</span>
                  <span style="color: #0066cc; font-weight: bold;">$${price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Cross-Border Payment Engine -->
    <!--
    <div style="background: linear-gradient(180deg, #fff9e6 0%, #fff3cd 100%); border: 1px solid #d4a017; border-radius: 4px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="font-size: 18px;">💸</span>
        <h3 style="color: #8b6914; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; font-weight: bold;">Cross-Border Payment Engine</h3>
      </div>
      <p style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #666; margin: 0;">Send payments across jurisdictions without requiring USD as an intermediary (e.g. VIR → CAL, CAL → CHN).</p>
    </div>
    -->

    <!-- FX Swap Terminal - Windows XP Style -->
    <!--
    <div style="background: linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%); border: 2px solid #666; border-radius: 6px; padding: 15px; margin-bottom: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.2);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 8px 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; border: 2px solid #666; border-bottom: none;">
        <h3 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">💱 FX Swap Terminal</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Source Currency</div>
          <select id="network-fx-source" onchange="window.updateNetworkFXQuote()" style="width: 100%; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; background: #ffffff;">
            ${[...states, ...countries].map(c => `<option value="${c.ticker}" ${c.ticker === 'CAL' ? 'selected' : ''}>${c.ticker} — ${c.name}</option>`).join('')}
            <!-- Commented out fiat currencies - SGAs only
            ${fiats.map(c => `<option value="${c.ticker}">${c.ticker} — ${c.name}</option>`).join('')}
            -->
          </select>
        </div>
        <div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Target Currency</div>
          <select id="network-fx-target" onchange="window.updateNetworkFXQuote()" style="width: 100%; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; background: #ffffff;">
            ${[...states, ...countries].map(c => `<option value="${c.ticker}" ${c.ticker === 'NY' ? 'selected' : ''}>${c.ticker} — ${c.name}</option>`).join('')}
            <!-- Commented out fiat currencies - SGAs only
            ${fiats.map(c => `<option value="${c.ticker}">${c.ticker} — ${c.name}</option>`).join('')}
            -->
          </select>
        </div>
      </div>
      <div style="margin-top: 15px;">
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">Amount</div>
        <input type="number" id="network-fx-amount" value="10000" min="1" step="100" oninput="window.updateNetworkFXQuote()" style="width: 100%; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px;">
      </div>
      <div id="network-fx-quote-container" style="margin-top: 15px; background: #f5f5f5; border: 1px solid #ccc; padding: 12px; border-radius: 3px;">
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Enter amount and select currencies to get quote</div>
      </div>
      <button onclick="window.executeNetworkFXSwap()" style="margin-top: 15px; width: 100%; padding: 8px; background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); border: 1px solid #003366; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">Execute Atomic Swap</button>
    </div>
    -->

    <!-- Forex Transactions Section - Classic Table Style -->
    <div style="background: #ffffff; border: 1px solid #999; border-radius: 4px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
      <div style="background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%); padding: 8px 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; font-weight: bold;">Forex Transactions</h3>
        <div style="display: flex; gap: 8px;">
          <select id="tx-filter-currency" onchange="window.filterNetworkTransactions()" style="padding: 4px 8px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; background: #ffffff;">
            <option value="all">All Currencies</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
            <option value="CHF">CHF</option>
            <option value="CNY">CNY</option>
          </select>
          <select id="tx-filter-status" onchange="window.filterNetworkTransactions()" style="padding: 4px 8px; border: 1px solid #999; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; background: #ffffff;">
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
          <button onclick="window.refreshNetworkTransactions()" style="padding: 4px 8px; background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); border: 1px solid #003366; border-radius: 3px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; font-weight: bold; cursor: pointer;">🔄 Refresh</button>
        </div>
      </div>

      <div style="overflow-x: auto; border: 1px solid #ccc;">
        <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px;">
          <thead>
            <tr style="background: linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%); border-bottom: 2px solid #999;">
              <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">Transaction ID</th>
              <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">From Institution</th>
              <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">To Institution</th>
              <th style="text-align: right; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">Amount</th>
              <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">Currency</th>
              <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #ccc;">Timestamp</th>
              <th style="text-align: center; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px;">Status</th>
            </tr>
          </thead>
          <tbody id="network-transactions-body">
            <!-- Transactions will be rendered here -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Generate and render transactions
  renderNetworkTransactions();

  // Initialize FX swap terminal
  if (window.updateNetworkFXQuote) {
    window.updateNetworkFXQuote();
  }
}

/**
 * Render sparkline chart on mini canvas.
 */
function renderSparklineCanvas(canvas, data) {
  if (!canvas || !data || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const isUp = data[data.length - 1] >= data[0];
  ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  data.forEach((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

/**
 * Generate and render forex transactions for the SGA Network page
 */
function renderNetworkTransactions() {
  // Institution data with verified IDs and details
  const institutionData = {
    'US Government': {
      name: 'US Government',
      institutionId: 'INST-US-GOV-00001',
      institutionType: 'Government',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000001',
      brokerageParticipant: 'Federal Reserve System'
    },
    'Federal Reserve': {
      name: 'Federal Reserve',
      institutionId: 'INST-US-FED-00002',
      institutionType: 'Central Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000002',
      brokerageParticipant: 'Self-Clearing'
    },
    'American Bank': {
      name: 'American Bank',
      institutionId: 'INST-US-AB-00003',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000003',
      brokerageParticipant: 'JP Morgan Clearing Corp'
    },
    'JPMorgan Chase': {
      name: 'JPMorgan Chase',
      institutionId: 'INST-US-JPM-00004',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000004',
      brokerageParticipant: 'Self-Clearing'
    },
    'Bank of America': {
      name: 'Bank of America',
      institutionId: 'INST-US-BOA-00005',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000005',
      brokerageParticipant: 'Self-Clearing'
    },
    'Wells Fargo': {
      name: 'Wells Fargo',
      institutionId: 'INST-US-WF-00006',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000006',
      brokerageParticipant: 'Self-Clearing'
    },
    'Citigroup': {
      name: 'Citigroup',
      institutionId: 'INST-US-CITI-00007',
      institutionType: 'Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000007',
      brokerageParticipant: 'Self-Clearing'
    },
    'Goldman Sachs': {
      name: 'Goldman Sachs',
      institutionId: 'INST-US-GS-00001',
      institutionType: 'Investment Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000184',
      brokerageParticipant: 'Self-Clearing'
    },
    'Morgan Stanley': {
      name: 'Morgan Stanley',
      institutionId: 'INST-US-MS-00008',
      institutionType: 'Investment Bank',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000008',
      brokerageParticipant: 'Self-Clearing'
    },
    'US Treasury': {
      name: 'US Treasury',
      institutionId: 'INST-US-TREAS-00009',
      institutionType: 'Government',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000009',
      brokerageParticipant: 'Federal Reserve System'
    },
    'European Central Bank': {
      name: 'European Central Bank',
      institutionId: 'INST-EU-ECB-00010',
      institutionType: 'Central Bank',
      jurisdiction: 'European Union',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000010',
      brokerageParticipant: 'Self-Clearing'
    },
    'Bank of England': {
      name: 'Bank of England',
      institutionId: 'INST-UK-BOE-00011',
      institutionType: 'Central Bank',
      jurisdiction: 'United Kingdom',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000011',
      brokerageParticipant: 'Self-Clearing'
    },
    'User Account': {
      name: 'User Account',
      institutionId: 'INST-US-USER-00001',
      institutionType: 'Individual',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000999',
      brokerageParticipant: 'Self-Clearing'
    },
    'SGA Network': {
      name: 'SGA Network',
      institutionId: 'INST-SGA-NET-00001',
      institutionType: 'Network',
      jurisdiction: 'Global',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000888',
      brokerageParticipant: 'Self-Clearing'
    }
  };

  const institutions = Object.keys(institutionData);

  // Get forex transactions from the multicurrency ledger
  let forexTransactions = [];
  if (window.sgaNetwork && window.sgaNetwork.ledger) {
    const ledgerRecords = window.sgaNetwork.ledger.getRecords({});
    const userName = getUserDisplayName();
    
    // Update user institution data with custom name
    const userInstitutionData = {
      ...institutionData['User Account'],
      name: userName
    };
    
    forexTransactions = ledgerRecords
      .filter(tx => tx.transactionType === 'conversion' && tx.sourceCurrency !== 'USD')
      .map(tx => ({
        id: tx.id,
        fromInstitution: userName,
        toInstitution: 'SGA Network',
        fromInstitutionData: userInstitutionData,
        toInstitutionData: institutionData['SGA Network'],
        amount: tx.sourceAmount,
        currency: tx.sourceCurrency,
        timestamp: tx.timestamp,
        status: tx.status === 'completed' ? 'Completed' : 'Pending',
        settlementStatus: 'Settled',
        isForexTransaction: true,
        metadata: tx.metadata,
        exchangeRate: tx.exchangeRate,
        toCurrency: tx.destinationCurrency
      }));
  }

  // Generate sample inter-bank transactions
  const sampleTransactions = [];
  const fxRates = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 149.50,
    'CAD': 1.36,
    'AUD': 1.53,
    'CHF': 0.89,
    'CNY': 7.24,
    'SAR': 3.75
  };
  
  for (let i = 0; i < 30; i++) {
    const fromInstitution = institutions[Math.floor(Math.random() * institutions.length)];
    const toInstitution = institutions[Math.floor(Math.random() * institutions.length)];
    const amount = (Math.random() * 10000000 + 100000).toFixed(2);
    const currency = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SAR'][Math.floor(Math.random() * 7)];
    const timestamp = new Date(Date.now() - Math.random() * 86400000 * 7).toISOString();
    const settlementStatus = Math.random() > 0.15 ? 'Settled' : (Math.random() > 0.5 ? 'Pending' : 'Failed');
    
    sampleTransactions.push({
      id: `TX-${Date.now()}-${i}`,
      fromInstitution,
      toInstitution,
      fromInstitutionData: institutionData[fromInstitution],
      toInstitutionData: institutionData[toInstitution],
      amount: parseFloat(amount),
      currency,
      timestamp,
      status: Math.random() > 0.1 ? 'Completed' : 'Pending',
      settlementStatus,
      isForexTransaction: false,
      exchangeRate: fxRates[currency] || 1.0,
      toCurrency: 'USD' // Default to USD for sample transactions
    });
  }

  // Combine forex transactions with sample transactions
  const forexTransactionsList = [...forexTransactions, ...sampleTransactions];

  // Sort by timestamp (newest first)
  forexTransactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Store for filtering
  window.networkTransactions = forexTransactionsList;

  // Render initial transactions
  updateNetworkTransactionsTable(forexTransactionsList);
}

/**
 * Update the transactions table with filtered data
 */
function updateNetworkTransactionsTable(transactions) {
  const tbody = document.getElementById('network-transactions-body');
  if (!tbody) return;

  tbody.innerHTML = transactions.map((tx, index) => {
    // Use same white background for all transactions (forex and regular)
    const rowBackground = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
    
    const hoverBackground = '#e8f4ff';
    
    return `
    <tr class="network-tx-row" data-tx-id="${tx.id}" style="border-bottom: 1px solid #e0e0e0; background: ${rowBackground}; cursor: pointer;" onmouseover="this.style.background='${hoverBackground}'" onmouseout="this.style.background='${rowBackground}'">
      <td style="padding: 8px 12px; font-family: 'Consolas', 'Courier New', monospace; color: #0052cc; font-size: 11px; border-right: 1px solid #e0e0e0;">
        ${tx.id}
      </td>
      <td style="padding: 8px 12px; font-weight: 600; color: #333; font-size: 12px; border-right: 1px solid #e0e0e0;">${tx.fromInstitution}</td>
      <td style="padding: 8px 12px; font-weight: 600; color: #333; font-size: 12px; border-right: 1px solid #e0e0e0;">${tx.toInstitution}</td>
      <td style="padding: 8px 12px; text-align: right; font-family: 'Consolas', 'Courier New', monospace; color: #0052cc; font-weight: 700; font-size: 12px; border-right: 1px solid #e0e0e0;">$${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 8px 12px; border-right: 1px solid #e0e0e0;">
        <span style="padding: 2px 6px; background: #e8f4ff; border: 1px solid #99ccff; border-radius: 3px; font-size: 10px; font-weight: 600; color: #0052cc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${tx.currency}</span>
        ${tx.isForexTransaction ? '<span style="margin-left: 4px; font-size: 9px; background: #d4a017; color: white; padding: 1px 3px; border-radius: 2px; font-weight: bold;">FX</span>' : ''}
      </td>
      <td style="padding: 8px 12px; color: #666; font-size: 11px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border-right: 1px solid #e0e0e0;">${new Date(tx.timestamp).toLocaleString()}</td>
      <td style="padding: 8px 12px; text-align: center;">
        <span style="padding: 2px 8px; background: ${tx.status === 'Completed' ? '#e8f5e8' : '#fff3cd'}; border: 1px solid ${tx.status === 'Completed' ? '#99cc99' : '#ffd700'}; border-radius: 3px; font-size: 10px; font-weight: 700; color: ${tx.status === 'Completed' ? '#006600' : '#8b6914'}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${tx.status}</span>
      </td>
    </tr>
  `}).join('');

  // Add click handlers to transaction rows
  tbody.querySelectorAll('.network-tx-row').forEach(row => {
    row.addEventListener('click', () => {
      const txId = row.dataset.txId;
      const transaction = window.networkTransactions.find(tx => tx.id === txId);
      if (transaction) {
        openTransactionDetailPanel(transaction);
      }
    });
  });
}

/**
 * Filter network transactions based on selected criteria
 */
window.filterNetworkTransactions = () => {
  const currencyFilter = document.getElementById('tx-filter-currency')?.value || 'all';
  const statusFilter = document.getElementById('tx-filter-status')?.value || 'all';
  
  let filtered = window.networkTransactions;
  
  if (currencyFilter !== 'all') {
    filtered = filtered.filter(tx => tx.currency === currencyFilter);
  }
  
  if (statusFilter !== 'all') {
    filtered = filtered.filter(tx => tx.status === statusFilter);
  }
  
  updateNetworkTransactionsTable(filtered);
};

/**
 * Refresh network transactions to include new forex transactions from ledger
 */
window.refreshNetworkTransactions = () => {
  if (!window.sgaNetwork || !window.sgaNetwork.ledger) {
    console.warn('SGA Network ledger not available for refresh');
    return;
  }

  // Get new forex transactions from ledger
  const ledgerRecords = window.sgaNetwork.ledger.getRecords({});
  const institutionData = {
    'User Account': {
      name: getUserDisplayName(),
      institutionId: 'INST-US-USER-00001',
      institutionType: 'Individual',
      jurisdiction: 'United States',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000999',
      brokerageParticipant: 'Self-Clearing'
    },
    'SGA Network': {
      name: 'SGA Network',
      institutionId: 'INST-SGA-NET-00001',
      institutionType: 'Network',
      jurisdiction: 'Global',
      regulatoryStatus: 'Verified',
      networkParticipationId: 'NPID-INST-000888',
      brokerageParticipant: 'Self-Clearing'
    }
  };
  
  const newForexTransactions = ledgerRecords
    .filter(tx => tx.transactionType === 'conversion' && tx.sourceCurrency !== 'USD')
    .map(tx => ({
      id: tx.id,
      fromInstitution: getUserDisplayName(),
      toInstitution: 'SGA Network',
      fromInstitutionData: institutionData['User Account'],
      toInstitutionData: institutionData['SGA Network'],
      amount: tx.sourceAmount,
      currency: tx.sourceCurrency,
      timestamp: tx.timestamp,
      status: tx.status === 'completed' ? 'Completed' : 'Pending',
      settlementStatus: 'Settled',
      isForexTransaction: true,
      metadata: tx.metadata,
      exchangeRate: tx.exchangeRate,
      toCurrency: tx.destinationCurrency
    }));

  // Add new transactions to the existing list (avoid duplicates)
  const existingIds = new Set(window.networkTransactions.map(tx => tx.id));
  newForexTransactions.forEach(tx => {
    if (!existingIds.has(tx.id)) {
      window.networkTransactions.unshift(tx); // Add to beginning
    }
  });

  // Re-sort by timestamp (newest first)
  window.networkTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Re-render the table
  window.filterNetworkTransactions();
};

/**
 * Get exchange rate relative to USD
 */
function getExchangeRate(currency) {
  const fxRates = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 149.50,
    'CAD': 1.36,
    'AUD': 1.53,
    'CHF': 0.89,
    'CNY': 7.24,
    'SAR': 3.75
  };
  return fxRates[currency] || 1.0;
}

/**
 * Save user profile name to localStorage
 */
window.saveUserProfile = () => {
  const nameInput = document.getElementById('user-profile-name');
  if (nameInput) {
    const userName = nameInput.value.trim() || 'User Account';
    localStorage.setItem('sga_user_profile_name', userName);
    
    // Update the user account name in the network
    if (window.sgaNetwork && window.sgaNetwork.accountService) {
      const userAccount = window.sgaNetwork.accountService.getUserAccount();
      if (userAccount) {
        userAccount.name = userName;
        window.sgaNetwork.accountService.save();
      }
    }
    
    // Refresh the transactions to use the new name
    window.refreshNetworkTransactions();
    
    alert('Profile saved successfully! Your name will now appear in transactions.');
  }
};

/**
 * Reset user profile to default "User Account"
 */
window.resetUserProfile = () => {
  if (confirm('Are you sure you want to reset your profile name back to "User Account"?')) {
    localStorage.removeItem('sga_user_profile_name');
    
    // Reset the user account name in the network
    if (window.sgaNetwork && window.sgaNetwork.accountService) {
      const userAccount = window.sgaNetwork.accountService.getUserAccount();
      if (userAccount) {
        userAccount.name = 'User Account';
        window.sgaNetwork.accountService.save();
      }
    }
    
    // Update the input field
    const nameInput = document.getElementById('user-profile-name');
    if (nameInput) {
      nameInput.value = 'User Account';
    }
    
    // Refresh the transactions to use the default name
    window.refreshNetworkTransactions();
    
    alert('Profile reset successfully!');
  }
};

/**
 * Reset the forex ledger to remove custom transactions and restore original banking transactions
 */
window.resetForexLedger = () => {
  if (confirm('Are you sure you want to reset the forex ledger? This will remove all custom transactions and restore the original banking transactions.')) {
    // Clear the multicurrency ledger
    if (window.sgaNetwork && window.sgaNetwork.ledger) {
      window.sgaNetwork.ledger.clearAll();
    }
    
    // Reset network transactions to only include original sample banking transactions
    const institutions = ['US Government', 'Federal Reserve', 'American Bank', 'JPMorgan Chase', 'Bank of America', 'Wells Fargo', 'Citigroup', 'Goldman Sachs', 'Morgan Stanley', 'US Treasury', 'European Central Bank', 'Bank of England'];
    const institutionData = {
      'US Government': {
        name: 'US Government',
        institutionId: 'INST-US-GOV-00001',
        institutionType: 'Government',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000001',
        brokerageParticipant: 'Federal Reserve System'
      },
      'Federal Reserve': {
        name: 'Federal Reserve',
        institutionId: 'INST-US-FED-00002',
        institutionType: 'Central Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000002',
        brokerageParticipant: 'Self-Clearing'
      },
      'American Bank': {
        name: 'American Bank',
        institutionId: 'INST-US-AB-00003',
        institutionType: 'Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000003',
        brokerageParticipant: 'JP Morgan Clearing Corp'
      },
      'JPMorgan Chase': {
        name: 'JPMorgan Chase',
        institutionId: 'INST-US-JPM-00004',
        institutionType: 'Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000004',
        brokerageParticipant: 'Self-Clearing'
      },
      'Bank of America': {
        name: 'Bank of America',
        institutionId: 'INST-US-BOA-00005',
        institutionType: 'Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000005',
        brokerageParticipant: 'Self-Clearing'
      },
      'Wells Fargo': {
        name: 'Wells Fargo',
        institutionId: 'INST-US-WF-00006',
        institutionType: 'Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000006',
        brokerageParticipant: 'Self-Clearing'
      },
      'Citigroup': {
        name: 'Citigroup',
        institutionId: 'INST-US-CITI-00007',
        institutionType: 'Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000007',
        brokerageParticipant: 'Self-Clearing'
      },
      'Goldman Sachs': {
        name: 'Goldman Sachs',
        institutionId: 'INST-US-GS-00001',
        institutionType: 'Investment Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000184',
        brokerageParticipant: 'Self-Clearing'
      },
      'Morgan Stanley': {
        name: 'Morgan Stanley',
        institutionId: 'INST-US-MS-00008',
        institutionType: 'Investment Bank',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000008',
        brokerageParticipant: 'Self-Clearing'
      },
      'US Treasury': {
        name: 'US Treasury',
        institutionId: 'INST-US-TREAS-00009',
        institutionType: 'Government',
        jurisdiction: 'United States',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000009',
        brokerageParticipant: 'Federal Reserve System'
      },
      'European Central Bank': {
        name: 'European Central Bank',
        institutionId: 'INST-EU-ECB-00010',
        institutionType: 'Central Bank',
        jurisdiction: 'European Union',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000010',
        brokerageParticipant: 'Self-Clearing'
      },
      'Bank of England': {
        name: 'Bank of England',
        institutionId: 'INST-UK-BOE-00011',
        institutionType: 'Central Bank',
        jurisdiction: 'United Kingdom',
        regulatoryStatus: 'Verified',
        networkParticipationId: 'NPID-INST-000011',
        brokerageParticipant: 'Self-Clearing'
      }
    };
    
    const sampleTransactions = [];
    const fxRates = { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149.50, 'CAD': 1.36, 'AUD': 1.53, 'CHF': 0.89, 'CNY': 7.24, 'SAR': 3.75 };
    
    // Generate original sample banking transactions
    for (let i = 0; i < 20; i++) {
      const fromInstitution = institutions[Math.floor(Math.random() * institutions.length)];
      let toInstitution = institutions[Math.floor(Math.random() * institutions.length)];
      while (toInstitution === fromInstitution) {
        toInstitution = institutions[Math.floor(Math.random() * institutions.length)];
      }
      
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SAR'];
      const currency = currencies[Math.floor(Math.random() * currencies.length)];
      const amount = (Math.random() * 10000000 + 100000).toFixed(2);
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      const settlementStatus = Math.random() > 0.1 ? 'Settled' : 'Pending';
      
      sampleTransactions.push({
        id: `TX-${String(i + 1).padStart(6, '0')}`,
        fromInstitution,
        toInstitution,
        fromInstitutionData: institutionData[fromInstitution],
        toInstitutionData: institutionData[toInstitution],
        amount: parseFloat(amount),
        currency,
        timestamp,
        status: Math.random() > 0.1 ? 'Completed' : 'Pending',
        settlementStatus,
        isForexTransaction: false,
        exchangeRate: fxRates[currency] || 1.0,
        toCurrency: 'USD'
      });
    }
    
    // Sort by timestamp (newest first)
    sampleTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Update network transactions
    window.networkTransactions = sampleTransactions;
    
    // Re-render the transactions
    window.filterNetworkTransactions();
    
    alert('Forex ledger reset successfully! Original banking transactions have been restored.');
  }
};

/**
 * Load user profile name from localStorage
 */
function loadUserProfile() {
  const savedName = localStorage.getItem('sga_user_profile_name');
  if (savedName) {
    const nameInput = document.getElementById('user-profile-name');
    if (nameInput) {
      nameInput.value = savedName;
    }
    
    // Update the user account name in the network
    if (window.sgaNetwork && window.sgaNetwork.accountService) {
      const userAccount = window.sgaNetwork.accountService.getUserAccount();
      if (userAccount) {
        userAccount.name = savedName;
      }
    }
  } else {
    // Set default value if no saved name
    const nameInput = document.getElementById('user-profile-name');
    if (nameInput) {
      nameInput.value = 'User Account';
    }
  }
  return savedName || 'User Account';
}

/**
 * Get the current user's display name
 */
function getUserDisplayName() {
  return localStorage.getItem('sga_user_profile_name') || 'User Account';
}

/**
 * Open transaction detail panel with institution information
 */
function openTransactionDetailPanel(transaction) {
  // Create panel overlay if it doesn't exist
  let overlay = document.getElementById('network-tx-detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'network-tx-detail-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7); z-index: 10000;
      display: none; align-items: center; justify-content: center;
    `;
    document.body.appendChild(overlay);
  }

  const settlementStatusColors = {
    'Settled': '#10b981',
    'Pending': '#f59e0b',
    'Failed': '#ef4444'
  };

  const fromInst = transaction.fromInstitutionData;
  const toInst = transaction.toInstitutionData;

  overlay.innerHTML = `
    <div style="background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%); border: 2px solid #666; border-radius: 8px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 15px 20px; border-radius: 6px 6px 0 0; border: 2px solid #666; border-bottom: none; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; margin: 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">Transaction Details</h2>
          <div style="color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; margin-top: 4px;">${transaction.id}</div>
        </div>
        <button onclick="document.getElementById('network-tx-detail-overlay').style.display='none'" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #ffffff; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 16px; font-weight: bold;">✕</button>
      </div>

      <div style="padding: 20px;">
        <!-- Transaction Overview -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0 0 15px 0; font-weight: bold; border-bottom: 2px solid #0078d7; padding-bottom: 8px;">
            Transaction Overview
            ${transaction.isForexTransaction ? '<span style="margin-left: 10px; background: #d4a017; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold;">Forex Conversion</span>' : ''}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Amount</div>
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 18px; color: #0066cc; font-weight: bold;">$${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Currency</div>
              <div style="font-size: 16px; color: #333; font-weight: 600;">${transaction.currency}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Timestamp</div>
              <div style="font-size: 13px; color: #333;">${new Date(transaction.timestamp).toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Settlement Status</div>
              <span style="padding: 4px 12px; background: ${settlementStatusColors[transaction.settlementStatus]}22; border: 1px solid ${settlementStatusColors[transaction.settlementStatus]}55; border-radius: 4px; font-size: 12px; font-weight: 700; color: ${settlementStatusColors[transaction.settlementStatus]};">${transaction.settlementStatus}</span>
            </div>
            ${transaction.isForexTransaction && transaction.metadata ? `
            <div style="grid-column: span 2;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Transaction Description</div>
              <div style="font-size: 13px; color: #333; background: #f9f9f9; padding: 8px; border-radius: 3px; border-left: 3px solid #0078d7;">${transaction.metadata.description || 'Forex conversion for SGA purchase'}</div>
            </div>
            ` : ''}
            ${transaction.currency !== 'USD' ? `
            <div style="grid-column: span 2; background: #f9f9f9; border: 1px solid #ccc; border-radius: 4px; padding: 10px; margin-top: 10px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: bold;">💱 Currency Conversion Information</div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; color: #666;">
                <div>
                  <span style="font-weight: bold;">From Currency:</span> ${transaction.toCurrency || 'USD'}
                </div>
                <div>
                  <span style="font-weight: bold;">To Currency:</span> ${transaction.currency}
                </div>
                <div>
                  <span style="font-weight: bold;">Exchange Rate:</span> ${transaction.exchangeRate ? (1 / transaction.exchangeRate).toFixed(4) : (1 / getExchangeRate(transaction.currency)).toFixed(4)} ${transaction.currency} per ${transaction.toCurrency || 'USD'}
                </div>
                <div>
                  <span style="font-weight: bold;">Converted Amount:</span> $${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${transaction.currency}
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- From Institution Details -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0 0 15px 0; font-weight: bold; border-bottom: 2px solid #0078d7; padding-bottom: 8px;">From Institution: ${fromInst.name}</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution Name</div>
              <div style="font-size: 13px; color: #333; font-weight: 600;">${fromInst.name}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution ID</div>
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #0066cc;">${fromInst.institutionId}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution Type</div>
              <div style="font-size: 13px; color: #333;">${fromInst.institutionType}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Jurisdiction</div>
              <div style="font-size: 13px; color: #333;">${fromInst.jurisdiction}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Regulatory Status</div>
              <span style="padding: 2px 8px; background: #e8f5e8; border: 1px solid #99cc99; border-radius: 3px; font-size: 11px; font-weight: 700; color: #006600;">${fromInst.regulatoryStatus}</span>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Network Participation ID</div>
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #0066cc;">${fromInst.networkParticipationId}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Brokerage/Clearing Participant</div>
              <div style="font-size: 13px; color: #333;">${fromInst.brokerageParticipant}</div>
            </div>
          </div>
        </div>

        <!-- To Institution Details -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0 0 15px 0; font-weight: bold; border-bottom: 2px solid #0078d7; padding-bottom: 8px;">To Institution: ${toInst.name}</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution Name</div>
              <div style="font-size: 13px; color: #333; font-weight: 600;">${toInst.name}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution ID</div>
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #0066cc;">${toInst.institutionId}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Institution Type</div>
              <div style="font-size: 13px; color: #333;">${toInst.institutionType}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Jurisdiction</div>
              <div style="font-size: 13px; color: #333;">${toInst.jurisdiction}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Regulatory Status</div>
              <span style="padding: 2px 8px; background: #e8f5e8; border: 1px solid #99cc99; border-radius: 3px; font-size: 11px; font-weight: 700; color: #006600;">${toInst.regulatoryStatus}</span>
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Network Participation ID</div>
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #0066cc;">${toInst.networkParticipationId}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px; font-weight: bold;">Brokerage/Clearing Participant</div>
              <div style="font-size: 13px; color: #333;">${toInst.brokerageParticipant}</div>
            </div>
          </div>
        </div>

        <!-- Audit Trail Information -->
        <div style="background: linear-gradient(180deg, #fff9e6 0%, #fff3cd 100%); border: 1px solid #d4a017; border-radius: 4px; padding: 15px;">
          <h3 style="color: #8b6914; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">🔒 Audit Trail & Security</h3>
          <div style="font-size: 12px; color: #666; line-height: 1.6;">
            <div style="margin-bottom: 6px;"><strong>• Append-Only Ledger:</strong> This transaction is permanently recorded and cannot be modified or deleted.</div>
            <div style="margin-bottom: 6px;"><strong>• Tamper-Evident:</strong> Any attempt to alter historical records will be detected and flagged.</div>
            <div style="margin-bottom: 6px;"><strong>• Verified IDs:</strong> Institution IDs and Network Participation IDs are cryptographically verified and authenticated.</div>
            <div><strong>• Complete Audit Trail:</strong> All transaction details are logged with timestamps for full traceability.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function closeOnEscape(e) {
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      overlay.style.display = 'none';
      document.removeEventListener('keydown', closeOnEscape);
    }
  });
}

/**
 * Update FX quote for the Network page swap terminal
 */
window.updateNetworkFXQuote = () => {
  const sourceEl = document.getElementById('network-fx-source');
  const targetEl = document.getElementById('network-fx-target');
  const amountEl = document.getElementById('network-fx-amount');
  const container = document.getElementById('network-fx-quote-container');

  if (!sourceEl || !targetEl || !amountEl || !container) return;

  const source = sourceEl.value;
  const target = targetEl.value;
  const amount = parseFloat(amountEl.value) || 0;

  if (amount <= 0 || source === target) {
    container.innerHTML = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Select two distinct currencies and enter a valid amount.</div>`;
    return;
  }

  const quote = sgaNetwork.fxEngine.getConversionQuote({
    fromCurrency: source,
    toCurrency: target,
    amount
  });

  const providerBadge = quote.providerType === 'internal'
    ? `<span style="background: #e8f5e8; border: 1px solid #99cc99; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; color: #006600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">SGA Internal Liquidity</span>`
    : `<span style="background: #fff3cd; border: 1px solid #ffd700; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; color: #8b6914; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">External FX Fallback</span>`;

  const routeFormatted = quote.route.map(step => `<span style="font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #0066cc; font-weight: bold;">${step}</span>`).join(' <span style="color: #666;">➔</span> ');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; text-transform: uppercase;">Optimal Execution Path</span>
      ${providerBadge}
    </div>
    <div style="margin-bottom: 10px; font-size: 12px;">
      ${routeFormatted}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; border-top: 1px solid #ccc; padding-top: 10px;">
      <div>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #666;">Exchange Rate:</span>
        <strong style="color: #0066cc; font-family: 'Consolas', 'Courier New', monospace; display: block;">1 ${source} = ${quote.effectiveRate.toFixed(4)} ${target}</strong>
      </div>
      <div>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #666;">Estimated Output:</span>
        <strong style="color: #006600; font-family: 'Consolas', 'Courier New', monospace; display: block;">${quote.outputAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${target}</strong>
      </div>
      <div>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #666;">Fee:</span>
        <strong style="color: #333; font-family: 'Consolas', 'Courier New', monospace; display: block;">${quote.feeAmount.toFixed(2)} ${quote.feeCurrency}</strong>
      </div>
      <div>
        <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #666;">Est. Slippage:</span>
        <strong style="color: #333; font-family: 'Consolas', 'Courier New', monospace; display: block;">${(quote.slippagePct * 100).toFixed(2)}%</strong>
      </div>
    </div>
  `;
};

/**
 * Execute atomic swap from the Network page
 */
window.executeNetworkFXSwap = () => {
  const sourceEl = document.getElementById('network-fx-source');
  const targetEl = document.getElementById('network-fx-target');
  const amountEl = document.getElementById('network-fx-amount');

  if (!sourceEl || !targetEl || !amountEl) return;

  const sourceCurrency = sourceEl.value;
  const destinationCurrency = targetEl.value;
  const sourceAmount = parseFloat(amountEl.value) || 0;

  const userAccount = sgaNetwork.accountService.getUserAccount();

  try {
    const result = sgaNetwork.settlementEngine.executeAtomicConversion({
      accountId: userAccount.accountId,
      sourceCurrency,
      destinationCurrency,
      sourceAmount
    });

    alert(`✅ Successfully converted ${sourceAmount.toLocaleString()} ${sourceCurrency} ➔ ${result.quote.outputAmount.toFixed(2)} ${destinationCurrency}\nProvider: ${result.quote.providerType}`);
    
    // Refresh the page to show updated balances
    renderNetworkPage();
  } catch (err) {
    alert(`❌ Swap failed: ${err.message}`);
  }
};

/**
 * Render the Multicurrency Wallet & FX Converter Page.
 */
export function renderWalletPage() {
  const container = document.getElementById('wallet-page');
  if (!container) return;

  const userAccount = sgaNetwork.accountService.getUserAccount();
  const balances = userAccount.getAllBalances();
  const tickers = sgaNetwork.currencyRegistry.getAllTickers();

  const risk = sgaNetwork.riskEngine.assessWalletRisk(userAccount, 'USD');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1rem;">
      <!-- Wallet Balances -->
      <div>
        <div class="glass-card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h2 style="margin: 0;">Multicurrency Wallet</h2>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${userAccount.name} (${userAccount.accountId})</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Estimated Value (USD)</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: #10b981; font-family: monospace;">$${risk.totalBaseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <span class="provider-badge provider-internal" style="font-size: 0.65rem;">${risk.riskLevel}</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${userAccount.currencyCount} Currencies Held</span>
          </div>

          <!-- Balances List -->
          <div>
            ${Object.entries(balances).map(([cur, amount]) => {
              const rate = sgaNetwork.eoiEngine.getFXRate(cur, 'USD');
              const usdVal = amount * rate;
              return `
                <div class="balance-row">
                  <div>
                    <div style="font-weight: 700; color: var(--accent-gold); font-family: monospace;">${cur}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${sgaNetwork.currencyRegistry.get(cur)?.name || cur}</div>
                  </div>
                  <div style="text-align: right;">
                    <div class="balance-amount">${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">≈ $${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- FX Conversion Engine -->
      <div>
        <div class="fx-terminal">
          <h3 style="margin-bottom: 1rem; color: var(--accent-gold);">💱 Direct FX Conversion Engine</h3>

          <div class="form-group">
            <label>Source Currency (Paying)</label>
            <select id="fx-source-currency" onchange="window.updateFXQuote()">
              ${tickers.map(t => `<option value="${t}" ${t === 'VIR' ? 'selected' : ''}>${t} — ${sgaNetwork.currencyRegistry.get(t)?.name || t}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Target Currency (Receiving)</label>
            <select id="fx-target-currency" onchange="window.updateFXQuote()">
              ${tickers.map(t => `<option value="${t}" ${t === 'CAL' ? 'selected' : ''}>${t} — ${sgaNetwork.currencyRegistry.get(t)?.name || t}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Amount to Convert</label>
            <input type="number" id="fx-amount" value="10000" min="1" step="100" oninput="window.updateFXQuote()">
          </div>

          <!-- Dynamic Route Box -->
          <div id="fx-route-container" class="fx-route-box">
            <!-- Rendered by updateFXQuote -->
          </div>

          <button class="trade-btn buy-btn" style="width: 100%; margin-top: 1rem;" onclick="window.executeFXConversion()">
            Execute Atomic Swap
          </button>
        </div>
      </div>
    </div>
  `;

  // Trigger initial quote calculation
  window.updateFXQuote();
}

/**
 * Recalculate dynamic FX quote for the UI.
 */
window.updateFXQuote = () => {
  const sourceEl = document.getElementById('fx-source-currency');
  const targetEl = document.getElementById('fx-target-currency');
  const amountEl = document.getElementById('fx-amount');
  const container = document.getElementById('fx-route-container');

  if (!sourceEl || !targetEl || !amountEl || !container) return;

  const source = sourceEl.value;
  const target = targetEl.value;
  const amount = parseFloat(amountEl.value) || 0;

  if (amount <= 0 || source === target) {
    container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem;">Select two distinct currencies and enter a valid amount.</div>`;
    return;
  }

  const quote = sgaNetwork.fxEngine.getConversionQuote({
    fromCurrency: source,
    toCurrency: target,
    amount
  });

  const providerBadge = quote.providerType === 'internal'
    ? `<span class="provider-badge provider-internal">SGA Internal Liquidity</span>`
    : `<span class="provider-badge provider-external">External FX Fallback</span>`;

  const routeFormatted = quote.route.map(step => `<span class="route-step">${step}</span>`).join(' <span class="route-arrow">➔</span> ');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
      <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Optimal Execution Path</span>
      ${providerBadge}
    </div>

    <div style="margin-bottom: 1rem; font-size: 1rem;">
      ${routeFormatted}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.75rem;">
      <div>
        <span style="color: var(--text-secondary);">Exchange Rate:</span>
        <strong style="color: var(--accent-gold); font-family: monospace; display: block;">1 ${source} = ${quote.effectiveRate.toFixed(4)} ${target}</strong>
      </div>
      <div>
        <span style="color: var(--text-secondary);">Estimated Output:</span>
        <strong style="color: #10b981; font-family: monospace; display: block;">${quote.outputAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${target}</strong>
      </div>
      <div>
        <span style="color: var(--text-secondary);">Fee:</span>
        <strong style="color: var(--text-primary); font-family: monospace; display: block;">${quote.feeAmount.toFixed(2)} ${quote.feeCurrency}</strong>
      </div>
      <div>
        <span style="color: var(--text-secondary);">Est. Slippage:</span>
        <strong style="color: var(--text-primary); font-family: monospace; display: block;">${(quote.slippagePct * 100).toFixed(2)}%</strong>
      </div>
    </div>
  `;
};

/**
 * Execute atomic conversion from the UI.
 */
window.executeFXConversion = () => {
  const sourceEl = document.getElementById('fx-source-currency');
  const targetEl = document.getElementById('fx-target-currency');
  const amountEl = document.getElementById('fx-amount');

  if (!sourceEl || !targetEl || !amountEl) return;

  const sourceCurrency = sourceEl.value;
  const destinationCurrency = targetEl.value;
  const sourceAmount = parseFloat(amountEl.value) || 0;

  const userAccount = sgaNetwork.accountService.getUserAccount();

  try {
    const result = sgaNetwork.settlementEngine.executeAtomicConversion({
      accountId: userAccount.accountId,
      sourceCurrency,
      destinationCurrency,
      sourceAmount
    });

    if (window.showTradeNotification) {
      window.showTradeNotification(
        `✅ Converted ${sourceAmount.toLocaleString()} ${sourceCurrency} ➔ ${result.quote.outputAmount.toFixed(2)} ${destinationCurrency} (${result.quote.providerType})`,
        'buy'
      );
    }

    renderWalletPage();
  } catch (err) {
    if (window.showTradeNotification) {
      window.showTradeNotification(`❌ ${err.message}`, 'sell');
    }
  }
};

/**
 * Open Fee Settings Modal (Editable)
 */
window.openFeeSettingsModal = function() {
  let overlay = document.getElementById('fee-settings-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fee-settings-modal-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); z-index: 10000;
      display: none; align-items: center; justify-content: center;
      backdrop-filter: blur(2px);
    `;
    document.body.appendChild(overlay);
  }

  // Get current fee values from FeeSchedule
  const feeSchedule = window.sgaNetwork ? window.sgaNetwork.feeSchedule : null;
  const currentFees = feeSchedule ? {
    fxTransaction: feeSchedule.fxTransactionBps / 100,
    equitiesTransaction: feeSchedule.equitiesTransactionBps / 100,
    conversion: feeSchedule.conversionBps / 100,
    crossBorder: feeSchedule.crossBorderBps / 100,
    crossBorderFlat: feeSchedule.crossBorderFlat,
    fxFee: feeSchedule.fxFeeBps / 100, // FX Fee
    gxFee: feeSchedule.gxFeeBps / 100, // GX Fee
    // Additional fee categories
    globalExchangeNetwork: 0,
    sgaPairs: 0,
    futures: 0.05,
    stocks: 0.05,
    options: 0.05
  } : {
    fxTransaction: 1.0,
    equitiesTransaction: 0.3,
    conversion: 0.1,
    crossBorder: 0.15,
    crossBorderFlat: 1.0,
    fxFee: 0.25, // FX Fee
    gxFee: 0.5, // GX Fee
    sgaPairs: 0,
    futures: 0.05, // 0.05% futures fee
    stocks: 0.05,
    options: 0.05
  };

  overlay.innerHTML = `
    <div style="background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%); border: 2px solid #666; border-radius: 8px; width: 90%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 15px 20px; border-radius: 6px 6px 0 0; border-bottom: 2px solid #003366; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10;">
        <div>
          <h2 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; margin: 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">⚙️ Fee System Settings</h2>
          <div style="color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; margin-top: 4px;">Configure all digital asset trading fees • <span style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 3px; font-weight: 600;">Roundtrip Fees</span></div>
        </div>
        <button onclick="document.getElementById('fee-settings-modal-overlay').style.display='none'" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #ffffff; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 16px; font-weight: bold;">✕</button>
      </div>

      <div style="padding: 20px;">
        <!-- Global Exchange Network Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🌐</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">Global Exchange Network Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Cross-exchange access fee <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-global-exchange-network" value="${currentFees.globalExchangeNetwork}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Charged when a brokerage routes your trade to an exchange that isn't native to it. <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- SGA Pairs Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🔄</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">SGA Pairs Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Cross-country composite pairs <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-sga-pairs" value="${currentFees.sgaPairs}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Equity-ratio and EOI-Differential cross-futures (e.g., USA-SGA/JPY-SGA). <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- FX Transaction Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">💱</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">FX Transaction Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Foreign Exchange Activity <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-fx-transaction" value="${currentFees.fxTransaction}" step="0.01" min="0" max="3" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Revenue directed to the country whose currency/FX activity generated the transaction. <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- Futures Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📊</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">Futures Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Derivatives trading <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-futures" value="${currentFees.futures}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Exit-only and profit-conditional futures trading fee. <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- Stocks Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📈</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">Stocks Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Equity trading <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-stocks" value="${currentFees.stocks}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Purchase-side ad valorem fee on full transaction value. <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- Options Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🎯</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">Options Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Options trading <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="fee-options" value="${currentFees.options}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
            </div>
          </div>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 3px;">
            Flat fee on full daily notional value. <span style="color: #0066cc; font-weight: 600;">Roundtrip fee</span>
          </div>
        </div>

        <!-- Internal Network Fees -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; font-weight: bold; color: #333; margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Internal Network Fees <span style="color: #0066cc; font-weight: 600; font-size: 12px;">(Roundtrip)</span></div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px;">Conversion Fee</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="fee-conversion" value="${currentFees.conversion}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
                <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
              </div>
            </div>
            <div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px;">Cross-Border Fee</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="fee-cross-border" value="${currentFees.crossBorder}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
                <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
              </div>
            </div>
            <div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px;">Cross-Border Flat Fee</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">$</span>
                <input type="number" id="fee-cross-border-flat" value="${currentFees.crossBorderFlat}" step="0.1" min="0" max="10" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
              </div>
            </div>
            <div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px;">FX Fee <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="fee-fx" value="${currentFees.fxFee}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
                <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
              </div>
            </div>
            <div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px;">GX Fee <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="fee-gx" value="${currentFees.gxFee || 0.5}" step="0.01" min="0" max="1" style="width: 80px; padding: 6px; border: 1px solid #999; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 14px; text-align: right;">
                <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #666;">%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button onclick="window.saveFeeSettings()" style="flex: 1; padding: 12px; background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); border: 1px solid #003366; border-radius: 4px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">💾 Save Changes</button>
          <button onclick="window.resetFeeSettings()" style="flex: 1; padding: 12px; background: linear-gradient(180deg, #666 0%, #444 100%); border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">🔄 Reset to Defaults</button>
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
};

/**
 * Save Fee Settings
 */
window.saveFeeSettings = function() {
  const feeSchedule = window.sgaNetwork ? window.sgaNetwork.feeSchedule : null;
  if (!feeSchedule) {
    alert('Fee schedule not available');
    return;
  }

  // Get values from inputs
  const newFees = {
    globalExchangeNetwork: parseFloat(document.getElementById('fee-global-exchange-network').value) || 0,
    sgaPairs: parseFloat(document.getElementById('fee-sga-pairs').value) || 0,
    fxTransaction: parseFloat(document.getElementById('fee-fx-transaction').value) || 0,
    futures: parseFloat(document.getElementById('fee-futures').value) || 0,
    stocks: parseFloat(document.getElementById('fee-stocks').value) || 0,
    options: parseFloat(document.getElementById('fee-options').value) || 0,
    conversion: parseFloat(document.getElementById('fee-conversion').value) || 0,
    crossBorder: parseFloat(document.getElementById('fee-cross-border').value) || 0,
    crossBorderFlat: parseFloat(document.getElementById('fee-cross-border-flat').value) || 0,
    fxFee: parseFloat(document.getElementById('fee-fx').value) || 0, // FX Fee
    gxFee: parseFloat(document.getElementById('fee-gx').value) || 0.5 // GX Fee
  };

  // Update FeeSchedule values
  feeSchedule.fxTransactionBps = newFees.fxTransaction * 100;
  feeSchedule.equitiesTransactionBps = newFees.stocks * 100;
  feeSchedule.futuresFeeBps = newFees.futures * 100; // Futures fee
  feeSchedule.conversionBps = newFees.conversion * 100;
  feeSchedule.crossBorderBps = newFees.crossBorder * 100;
  feeSchedule.crossBorderFlat = newFees.crossBorderFlat;
  feeSchedule.fxFeeBps = newFees.fxFee * 100; // FX Fee
  feeSchedule.gxFeeBps = newFees.gxFee * 100; // GX Fee

  // Store additional fees in window object for future use
  window.additionalFees = {
    globalExchangeNetwork: newFees.globalExchangeNetwork,
    sgaPairs: newFees.sgaPairs,
    futures: newFees.futures,
    options: newFees.options,
    fxFee: newFees.fxFee,
    gxFee: newFees.gxFee
  };

  // Show success message
  alert('Fee settings saved successfully!');
  
  // Close modal
  document.getElementById('fee-settings-modal-overlay').style.display = 'none';
  
  // Refresh UI to show updated fees
  if (window.renderNetworkPage) {
    window.renderNetworkPage();
  }
  
  // Refresh markets page calculations if it exists
  if (window.updateCalculations) {
    window.updateCalculations();
  }
  
  // Refresh futures terminal order summary if it exists
  if (window.updateOrderSummary) {
    window.updateOrderSummary();
  }
};

/**
 * Reset Fee Settings to Defaults
 */
window.resetFeeSettings = function() {
  if (!confirm('Are you sure you want to reset all fee settings to defaults?')) {
    return;
  }

  const defaultFees = {
    globalExchangeNetwork: 0,
    sgaPairs: 0,
    fxTransaction: 1.0,
    futures: 0.05, // 0.05% futures fee
    stocks: 0.05,
    options: 0.05,
    conversion: 0.1,
    crossBorder: 0.15,
    crossBorderFlat: 1.0,
    fxFee: 0.25,
    gxFee: 0.5 // 0.5% GX fee
  };

  // Update input values
  document.getElementById('fee-global-exchange-network').value = defaultFees.globalExchangeNetwork;
  document.getElementById('fee-sga-pairs').value = defaultFees.sgaPairs;
  document.getElementById('fee-fx-transaction').value = defaultFees.fxTransaction;
  document.getElementById('fee-futures').value = defaultFees.futures;
  document.getElementById('fee-stocks').value = defaultFees.stocks;
  document.getElementById('fee-options').value = defaultFees.options;
  document.getElementById('fee-conversion').value = defaultFees.conversion;
  document.getElementById('fee-cross-border').value = defaultFees.crossBorder;
  document.getElementById('fee-cross-border-flat').value = defaultFees.crossBorderFlat;
  document.getElementById('fee-fx').value = defaultFees.fxFee; // FX Fee
  document.getElementById('fee-gx').value = defaultFees.gxFee; // GX Fee

  alert('Fee settings reset to defaults');
};

/**
 * Open Fee Schedule Detail Popup Modal
 */
window.openFeeScheduleModal = function() {
  let overlay = document.getElementById('network-fee-schedule-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'network-fee-schedule-modal-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); z-index: 10000;
      display: none; align-items: center; justify-content: center;
      backdrop-filter: blur(2px);
    `;
    document.body.appendChild(overlay);
  }

  // Get current fee values from FeeSchedule
  const feeSchedule = window.sgaNetwork ? window.sgaNetwork.feeSchedule : null;
  const currentFees = feeSchedule ? {
    fxTransaction: feeSchedule.fxTransactionBps / 100,
    equitiesTransaction: feeSchedule.equitiesTransactionBps / 100,
    conversion: feeSchedule.conversionBps / 100,
    crossBorder: feeSchedule.crossBorderBps / 100,
    crossBorderFlat: feeSchedule.crossBorderFlat,
    fxFee: feeSchedule.fxFeeBps / 100, // FX Fee
    gxFee: feeSchedule.gxFeeBps / 100, // GX Fee
    futures: feeSchedule.futuresFeeBps / 100 // Futures fee
  } : {
    fxTransaction: 1.0,
    equitiesTransaction: 0.3,
    conversion: 0.1,
    crossBorder: 0.15,
    crossBorderFlat: 1.0,
    fxFee: 0.25,
    gxFee: 0.5, // GX Fee
    futures: 0.05 // 0.05% futures fee
  };

  overlay.innerHTML = `
    <div style="background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%); border: 2px solid #666; border-radius: 8px; width: 90%; max-width: 850px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
      <div style="background: linear-gradient(180deg, #0078d7 0%, #005a9e 100%); padding: 15px 20px; border-radius: 6px 6px 0 0; border-bottom: 2px solid #003366; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10;">
        <div>
          <h2 style="color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; margin: 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">📋 SGA Network Transaction Fee Schedule</h2>
          <div style="color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; margin-top: 4px;">Official Fee Structure for FX & Equities Activity • <span style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 3px; font-weight: 600;">Roundtrip Fees</span></div>
        </div>
        <button onclick="document.getElementById('network-fee-schedule-modal-overlay').style.display='none'" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #ffffff; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 16px; font-weight: bold;">✕</button>
      </div>

      <div style="padding: 20px;">
        <!-- FX Transaction Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">💱</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">FX Transaction Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Foreign Exchange Activity</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 26px; font-weight: bold; color: #0066cc;">${currentFees.fxTransaction.toFixed(2)}%</div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; color: #666;">${(currentFees.fxTransaction * 100).toFixed(0)} basis points</div>
            </div>
          </div>
          <div style="border-top: 1px solid #e0e0e0; padding-top: 12px;">
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #444; line-height: 1.7;">
              <div style="margin-bottom: 8px; padding: 10px; background: #f0f7ff; border-left: 3px solid #0078d7; border-radius: 0 3px 3px 0;">
                <strong>Policy:</strong> The SGA Network applies a 1% roundtrip transaction fee to FX transactions conducted through the network. The fee is collected on eligible foreign exchange activity and directed toward paying down the budget deficit of the country whose currency or FX activity generated the transaction. Each country therefore receives the transaction-fee revenue attributable to its respective FX market. As FX trading volume increases, fee revenue increases proportionally, providing a continuous source of funding that can first eliminate the country's annual budget deficit and subsequently contribute toward reducing its outstanding government debt. <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                <div style="padding: 8px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 3px;">
                  <div style="font-size: 10px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Revenue Allocation</div>
                  <div style="font-size: 12px; color: #006600; font-weight: 600;">Country of originating currency</div>
                  <div style="font-size: 11px; color: #666; margin-top: 2px;">→ First: eliminate annual budget deficit</div>
                  <div style="font-size: 11px; color: #666;">→ Then: reduce outstanding government debt</div>
                </div>
                <div style="padding: 8px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 3px;">
                  <div style="font-size: 10px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Scale Design</div>
                  <div style="font-size: 12px; color: #0066cc; font-weight: 600;">Volume-proportional revenue</div>
                  <div style="font-size: 11px; color: #666; margin-top: 2px;">Leverages global FX market scale to generate continuous sovereign funding.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Equities Transaction Fee -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📈</span>
              <div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: bold; color: #333;">Equities Transaction Fee</div>
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #666;">Securities & Equity Trading <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 26px; font-weight: bold; color: #006600;">${currentFees.equitiesTransaction.toFixed(2)}%</div>
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; color: #666;">${(currentFees.equitiesTransaction * 100).toFixed(0)} basis points</div>
              <span style="display: inline-block; margin-top: 3px; padding: 1px 6px; background: #fff3cd; border: 1px solid #ffd700; border-radius: 3px; font-size: 9px; font-weight: 700; color: #8b6914; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">ADJUSTABLE</span>
            </div>
          </div>
          <div style="border-top: 1px solid #e0e0e0; padding-top: 12px;">
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #444; line-height: 1.7;">
              <div style="margin-bottom: 8px; padding: 10px; background: #f0fff0; border-left: 3px solid #006600; border-radius: 0 3px 3px 0;">
                <strong>Policy:</strong> The applicable roundtrip transaction fee for equities shall initially be established at 0.30% (30 basis points) of the applicable transaction value. The fee is intended to provide a consistent and sustainable source of revenue while supporting the operation and development of the platform. The applicable fee rate may be reviewed and reduced in the future at the discretion of the governing entity, subject to trading volume, market participation, operating costs, and overall financial performance. <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                <div style="padding: 8px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 3px;">
                  <div style="font-size: 10px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Revenue Allocation</div>
                  <div style="font-size: 12px; color: #006600; font-weight: 600;">Platform operation & development</div>
                  <div style="font-size: 11px; color: #666; margin-top: 2px;">Consistent, sustainable revenue for system financial sustainability and objectives.</div>
                </div>
                <div style="padding: 8px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 3px;">
                  <div style="font-size: 10px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Rate Adjustability</div>
                  <div style="font-size: 12px; color: #8b6914; font-weight: 600;">Subject to governance review</div>
                  <div style="font-size: 11px; color: #666; margin-top: 2px;">May be reduced based on trading volume, market participation, and financial performance.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fee Schedule Summary Table -->
        <div style="background: #ffffff; border: 1px solid #ccc; border-radius: 4px; overflow: hidden;">
          <div style="background: linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%); padding: 6px 12px; border-bottom: 1px solid #999;">
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; font-weight: bold; color: #4a4a4a; text-transform: uppercase;">Complete Fee Schedule Summary <span style="color: #0066cc; font-weight: 600; text-transform: none;">(Roundtrip)</span></div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px;">
            <thead>
              <tr style="background: #f5f5f5; border-bottom: 1px solid #ccc;">
                <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #e0e0e0;">Fee Type</th>
                <th style="text-align: center; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #e0e0e0;">Rate</th>
                <th style="text-align: center; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px; border-right: 1px solid #e0e0e0;">Basis Points</th>
                <th style="text-align: left; padding: 8px 12px; color: #4a4a4a; font-weight: bold; font-size: 11px;">Revenue Destination</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e0e0e0; background: #f0f7ff;">
                <td style="padding: 8px 12px; font-weight: 600; color: #0066cc; border-right: 1px solid #e0e0e0;">💱 FX Transaction Fee</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; font-weight: bold; color: #0066cc; border-right: 1px solid #e0e0e0;">${currentFees.fxTransaction.toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.fxTransaction * 100).toFixed(0)} bps</td>
                <td style="padding: 8px 12px; color: #444;">Originating country — deficit paydown & debt reduction <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0; background: #f0fff0;">
                <td style="padding: 8px 12px; font-weight: 600; color: #006600; border-right: 1px solid #e0e0e0;">📈 Stocks Fee</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; font-weight: bold; color: #006600; border-right: 1px solid #e0e0e0;">${currentFees.stocks.toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.stocks * 100).toFixed(0)} bps</td>
                <td style="padding: 8px 12px; color: #444;">Platform operation & development <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 8px 12px; color: #666; border-right: 1px solid #e0e0e0;">Internal Conversion</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${currentFees.conversion.toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.conversion * 100).toFixed(0)} bps</td>
                <td style="padding: 8px 12px; color: #666;">Network liquidity pool <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 8px 12px; color: #666; border-right: 1px solid #e0e0e0;">Cross-Border Payment</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${currentFees.crossBorder.toFixed(2)}% + $${currentFees.crossBorderFlat.toFixed(2)}</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.crossBorder * 100).toFixed(0)} bps + flat</td>
                <td style="padding: 8px 12px; color: #666;">Network operations <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #666; border-right: 1px solid #e0e0e0;">FX Fee</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${currentFees.fxFee.toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.fxFee * 100).toFixed(0)} bps</td>
                <td style="padding: 8px 12px; color: #666;">FX transactions <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #666; border-right: 1px solid #e0e0e0;">GX Fee</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${currentFees.gxFee.toFixed(2)}%</td>
                <td style="padding: 8px 12px; text-align: center; font-family: 'Consolas', monospace; border-right: 1px solid #e0e0e0;">${(currentFees.gxFee * 100).toFixed(0)} bps</td>
                <td style="padding: 8px 12px; color: #666;">Global Exchange network access <span style="color: #0066cc; font-weight: 600;">(Roundtrip)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
};

