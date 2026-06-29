import './style.css';
import { statesData, calculateEOI, getPayoutSplit } from './data.js';
import { SGALedger, TAXONOMY } from './ledger.js';
import { FREDService } from './fredService.js';

const ledger = new SGALedger();
const fredService = new FREDService();

window.postedArticleUrls = new Set();

let totalNationalEOI = statesData.reduce((sum, state) => sum + calculateEOI(state), 0);

// SGA Futures Contract Specifications
const CONTRACT_SPECS = {
  tickSize: 1.00, // Price moves in whole dollars
  tickValue: 10.00, // 1 tick = $10.00 change in contract value
  multiplier: 10, // Contract multiplier set to 10
  initialMarginPct: 0.10,
  maintenanceMarginPct: 0.08,
  pricingScale: 2000 // EOI index points to USD pricing multiplier ($2,000 per EOI point)
};

let positions = [];
let positionIdCounter = 1;
let currentLivePrice = 0;
let currentBid = 0;
let currentAsk = 0;
let currentTradingStateData = null;
let liveTickInterval = null;
let backgroundSimInterval = null;
let sovereignReinvestmentInterval = null;

// Drawdown short-selling restriction: after 1.6% drawdown yield, no shorts for 5 minutes
let drawdownCooldownExpiry = 0; // Unix ms timestamp; 0 = no active cooldown

// Trillion-dollar real-time Limit Order Book & Trades
let orderBook = { bids: [], asks: [] };
let recentTrades = [];
window.allTransactions = [];
window.userTradeHistory = [];
window.clearingRevenue = {
  total: 0,
  mm: 0,
  llc: 0,
  state: 0,
  totalTradesCount: 0,
  lossRebatesIssued: 0,
  federal: 0
};
window.txFilter = 'all';
window.tickCounter = 0;
window.priceMomentum = 0;

/*
// State-tailored economic news pool for all 50 states representing realistic local economic drivers
const STATE_NEWS_POOL = {
  AL: {
    bullish: {
      title: "Alabama Aerospace Corridor Lands $2.4B Rocket Expansion",
      description: "Huntsville technology hub expands defense propulsion production, adding 3,500 advanced technical engineering positions to the sovereign growth corridor."
    },
    bearish: {
      title: "Automotive Part Shortages Slow Production Lines at Alabama Assembly Plants",
      description: "Global micro-component logistics delays trigger temporary line halts, lowering near-term manufacturing output indices."
    }
  },
  AK: {
    bullish: {
      title: "Alaska Sovereign Oil Lease Sales Surge to Record Highs",
      description: "State Department of Natural Resources reports unprecedented bidding volume, bolstering long-term sovereign wealth reserves."
    },
    bearish: {
      title: "Alaskan Salmon Catch Falls 22%, Disputing Regional Export Models",
      description: "Bristol Bay commercial fisheries report significantly lowered yields under warm current pressures, impacting regional seafood trade balances."
    }
  },
  AZ: {
    bullish: {
      title: "Phoenix Microelectronics Hub Attracts $15B Megafab Capital Influx",
      description: "Federal and state grants successfully attract global microchip manufacturers, expanding local cleanrooms and advanced technical labor pools."
    },
    bearish: {
      title: "Water Allocation Caps Limit Commercial Real Estate Construction in Phoenix Metro",
      description: "New environmental directives restrict high-volume commercial starts, cooling near-term industrial development indices."
    }
  },
  AR: {
    bullish: {
      title: "Arkansas Logistics Infrastructure Hub Receives $1.2B Cargo Expansion",
      description: "Intermodal freight centers in West Memphis secure private funding to double shipping capacity, boosting agricultural trade streams."
    },
    bearish: {
      title: "Poultry Feed Cost Inflation Triggers Operating Margin Contractions for Arkansas Producers",
      description: "Surging grain prices impact agricultural earnings, creating temporary pricing friction in state sovereign index yields."
    }
  },
  CA: {
    bullish: {
      title: "Silicon Valley AI Boom Drives California Tech Tax Windfall",
      description: "State finance department records massive capital gains tax receipts from tech IPOs, bolstering the general fund surplus and growth outlook."
    },
    bearish: {
      title: "Agricultural Water Allotments Reduced in Central Valley Specialty Farms",
      description: "Strict conservation limits on almond and grape farms lead to projected lower specialty crop export revenues."
    }
  },
  CO: {
    bullish: {
      title: "Colorado Aerospace Clusters Win Massive $8B Orbital Systems Procurement Contract",
      description: "Denver-Boulder defense and space agencies partner with federal labs to construct next-generation satellite arrays."
    },
    bearish: {
      title: "Rocky Mountain Recreational Tourism Revenues Soften After Unseasonably Warm Weather",
      description: "Ski resort operators report lower visitor numbers in late winter, impacting seasonal service tax revenues."
    }
  },
  CT: {
    bullish: {
      title: "Connecticut Submarine and Naval Manufacturing Base Wins Historic Order",
      description: "Defense contractors in Groton secure long-term allocations, initiating heavy technical recruitment for shipyards."
    },
    bearish: {
      title: "Corporate Relocations to Lower-Cost Regions Cool Stamford Financial Sector",
      description: "Several large insurance and hedge fund operators shift back-office workloads out of state, dampening corporate tax bases."
    }
  },
  DE: {
    bullish: {
      title: "Delaware Corporate Registrations Spike 14%, Driving Franchise Tax Surpluses",
      description: "State corporate division records historic levels of new filings, solidifying corporate franchise revenues and financial security."
    },
    bearish: {
      title: "Credit Processing Volume Slowdowns Dampen Delaware Banking Revenues",
      description: "Financial service tax revenues cool as consumer credit transaction volumes decline slightly from high-growth benchmarks."
    }
  },
  FL: {
    bullish: {
      title: "Florida Space Coast Spacecraft Cargo Shipments Jump on Strong Demand",
      description: "Port Canaveral and Orlando hospitality operators record record-breaking quarterly visitor volumes, boosting hotel tax yields."
    },
    bearish: {
      title: "Florida Agricultural Exports Disrupted Due to Severe Weather Warnings",
      description: "Supply chain bottlenecks emerge as major agricultural hubs in Central Florida brace for severe weather, raising near-term cargo logistics and crop yield concerns."
    }
  },
  GA: {
    bullish: {
      title: "Georgia Port Authority Reports Record TEU Cargo Throughput at Savannah Port",
      description: "The Port of Savannah records a 9% year-over-year cargo volume spike, reflecting resilient consumer demand and highlighting the state's strategic logistics position."
    },
    bearish: {
      title: "Southeastern Logistics Delays Impede Georgia Logistics Corridor Delivery Times",
      description: "Interstate freight flows face gridlock due to heavy construction backlogs, raising transport costs for Atl-region hubs."
    }
  },
  HI: {
    bullish: {
      title: "Hawaii Commercial Tourism Spending Hits Record Highs as International Routes Reopen",
      description: "Hotel occupancies and luxury hospitality tax revenues surge, fueling state infrastructure capital investments."
    },
    bearish: {
      title: "Hawaiian Clean Energy Shift Delayed by Undersea Cable Regulatory Impasses",
      description: "Grid modernization efforts on Oahu stall, raising near-term commercial electricity costs for resort operators."
    }
  },
  ID: {
    bullish: {
      title: "Idaho Agricultural Tech Hub Launches $800M Sustainable Food Processing Site",
      description: "Boise metro attracts food science companies, leveraging state potato and dairy surpluses into premium export products."
    },
    bearish: {
      title: "Timber Export Tariffs Slow Down Logging Operations in Northern Idaho Forests",
      description: "International trade disputes reduce lumber demand, causing local mills to trim active production shifts."
    }
  },
  IL: {
    bullish: {
      title: "Illinois Municipal Debt Refinanced with Historic High-Demand Bond Placement",
      description: "Chicago and state treasuries complete a major debt optimization program, lowering interest costs and clearing the path for new public transit capital investments."
    },
    bearish: {
      title: "Chicago Logistics Hub Experiences Rail Container Stagnation",
      description: "Freight congestion at massive intermodal yards slows industrial deliveries, creating headwinds for manufacturing."
    }
  },
  IN: {
    bullish: {
      title: "Indiana EV Battery Plant Starts Construction, Representing $3.5B Capital Inflow",
      description: "State commerce department welcomes high-tech manufacturing, creating thousands of clean energy jobs."
    },
    bearish: {
      title: "Steel Mill Production Decelerates in Gary Due to Lower Heavy-Industrial Orders",
      description: "Primary metal manufacturers adjust output downwards, reflecting soft domestic automotive demand."
    }
  },
  IA: {
    bullish: {
      title: "Iowa Agricultural Yield Forecasts Raised on Favorable Soil Moisture Levels",
      description: "Corn and soybean yields project above historical averages, supporting high farm-state trade balances."
    },
    bearish: {
      title: "Ethanol Production Capacity Constrained by Regulatory Carbon Capture Delays in Iowa",
      description: "Environmental review extensions delay pipeline networks, stalling biofuels export expansions."
    }
  },
  KS: {
    bullish: {
      title: "Kansas Aviation Hub lands Major Defense Contract for Advanced Drone Assembly",
      description: "Wichita aerospace suppliers expand operations, driving job growth in the composite materials sector."
    },
    bearish: {
      title: "Severe Drought Damages Winter Wheat Crops Across Western Kansas Counties",
      description: "Agricultural analysts project substantial yield drawdowns, impacting farm income and crop tax revenues."
    }
  },
  KY: {
    bullish: {
      title: "Kentucky Automotive Production Hits Record Highs on Solid Utility Truck Demand",
      description: "Assembly plants in Louisville run at full capacity, driving local parts manufacturing hiring."
    },
    bearish: {
      title: "High Freight Costs Pinch Bourbon Distilleries' Global Shipping Volumes in Kentucky",
      description: "Premium spirits exports face distribution bottlenecks at ports, slowing barrel-aging inventory turnover."
    }
  },
  LA: {
    bullish: {
      title: "Louisiana Liquefied Natural Gas (LNG) Terminal Wins Permits for $8B Expansion",
      description: "Sovereign growth models show a significant capital influx as major energy ports expand cryogenic storage capacity."
    },
    bearish: {
      title: "Gulf Coast Petrochemical Fabs Face Shutdowns for Mandatory Pipeline Maintenance",
      description: "Chemical manufacturing output in Baton Rouge declines temporarily, lowering quarterly export values."
    }
  },
  ME: {
    bullish: {
      title: "Maine Aquaculture Sector Receives Federal Approval for Clean Salmon Farms",
      description: "Offshore marine science projects expand, establishing Maine as a premium cold-water seafood export base."
    },
    bearish: {
      title: "Paper Pulp Mill Halts Operations in Northern Maine Due to Falling Global Demand",
      description: "Reduced paper and packaging demand forces structural layoffs, impacting forest-product economies."
    }
  },
  MD: {
    bullish: {
      title: "Maryland Cybersecurity and Biotech Sectors Land Massive Government Contracts",
      description: "Fort Meade and Bethesda research institutions draw billions in private capital, boosting professional service taxes."
    },
    bearish: {
      title: "Baltimore Port Cargo Throughput Declines Following Regional Bridge Construction Delays",
      description: "Logistics diversions impact port terminal operations, temporarily lowering commercial shipping tariffs."
    }
  },
  MA: {
    bullish: {
      title: "Boston Biotech Clusters Secure Historic $4.2B Venture Capital Inflow",
      description: "Life science start-ups in Cambridge drive commercial lab demand, supporting high state productivity indexes."
    },
    bearish: {
      title: "Massachusetts Biotech R&D Output Declines Slightly as Venture Deals Cool",
      description: "Life sciences funding contracts in the Cambridge cluster, leading to a temporary slowdown in commercial lab real estate demand."
    }
  },
  MI: {
    bullish: {
      title: "Michigan EV Manufacturing Center Completes Major Capital Tooling Upgrades",
      description: "Leading automotive manufacturers re-open expanded assembly lines, ramping up commercial production of next-gen batteries."
    },
    bearish: {
      title: "Automotive Supply Chain Disruptions Cool Detroit Manufacturing Activity",
      description: "Micro-sensor delivery delays slow assembly line output, leading to temporary manufacturing production decelerations."
    }
  },
  MN: {
    bullish: {
      title: "Minnesota Medical Device Industry Tops Global Market Share Reports",
      description: "Twin Cities medical tech corridor reports unprecedented export demand for advanced pacemakers and surgical equipment."
    },
    bearish: {
      title: "Iron Ore Shipment Volumes Cool Off at Lake Superior Ports in Minnesota",
      description: "Slowing heavy construction demand reduces domestic steel demand, dampening Iron Range mining activities."
    }
  },
  MS: {
    bullish: {
      title: "Mississippi Defense Shipyards Secure $3.8B Navy Vessel Construction Pipeline",
      description: "Shipyards in Pascagoula win multi-year warship orders, expanding advanced technical employment."
    },
    bearish: {
      title: "Agricultural Crop Yields Downgraded in Mississippi Delta Following Spring Floods",
      description: "Heavy rains delay planting windows, lowering cotton and soybean production forecasts."
    }
  },
  MO: {
    bullish: {
      title: "Missouri AgTech Sector Expands with $1.2B Plant Science Research Hub",
      description: "St. Louis research facilities attract global funding, boosting biotech-driven agricultural exports."
    },
    bearish: {
      title: "Automotive Assembly Plant in Kansas City Trims Shifts on Slowing SUV Inventory",
      description: "Leading automaker balances dealer supplies, reducing temporary assembly jobs in the KC area."
    }
  },
  MT: {
    bullish: {
      title: "Montana Tourism Industry Projects Record Summer Season for National Parks",
      description: "Bozeman and Flathead hospitality operators report unprecedented bookings, lifting regional hotel tax revenues."
    },
    bearish: {
      title: "Early Spring Mountain Runoff Reduces Water Reserves for Eastern Montana Ranches",
      description: "Insufficient soil moisture limits forage growth, raising operating costs for livestock producers."
    }
  },
  NE: {
    bullish: {
      title: "Nebraska Agricultural Exports Rise 18% on Heavy Global Beef Demand",
      description: "Omaha-region meatpackers expand refrigeration infrastructure, reaching new international consumer markets."
    },
    bearish: {
      title: "High Irrigation Fuel Costs Squeeze Operating Margins for Nebraska Farmers",
      description: "Rising energy expenses erode agricultural profitability, dampening rural business equipment sales."
    }
  },
  NV: {
    bullish: {
      title: "Nevada Lithium Mining Receives Federal Approval for Massive Extraction Site",
      description: "Thacker Pass project expands development, positioning Nevada as the primary source of domestic battery materials."
    },
    bearish: {
      title: "Nevada Gaming Revenues Dip Slightly as Travel Spending Faces Short-Term Cooling",
      description: "State gaming board reports a minor contraction in leisure spending, slightly lowering tax yields."
    }
  },
  NH: {
    bullish: {
      title: "New Hampshire High-Tech Optics Sector Wins Global Aerospace Contracts",
      description: "Precision engineering companies in Merrimack Valley expand manufacturing of laser guidance equipment."
    },
    bearish: {
      title: "Residential Housing Shortage Restrains Professional Talent Migration to New Hampshire",
      description: "Limited inventory drives up labor costs, causing some technical employers to freeze local hiring."
    }
  },
  NJ: {
    bullish: {
      title: "New Jersey Biotech and Pharmaceutical Hubs Partner with Global Research Pools",
      description: "Major drug developers in Newark and Princeton secure funding for clinical pipelines, lifting local GDP."
    },
    bearish: {
      title: "Congestion Pricing Implementation Near Jersey Ports Slows Freight Trucking",
      description: "New transit tariffs add shipping friction, raising operational costs for regional logistics carriers."
    }
  },
  NM: {
    bullish: {
      title: "New Mexico Space and Defense Research Labs Land $2B Strategic Grant",
      description: "Los Alamos and Sandia national labs expand clean energy research, boosting professional technical services."
    },
    bearish: {
      title: "Oil Production Leases Facing Regulatory Delays in New Mexico Permian Basin",
      description: "Bureau of Land Management extends environmental reviews, capping short-term drilling expansion."
    }
  },
  NY: {
    bullish: {
      title: "Wall Street Transaction Volume Surges, Boosting NY Fiscal Forecast",
      description: "Sovereign growth models show a significant spike in state financial services tax revenue as equity and bond markets experience record quarterly trading volumes."
    },
    bearish: {
      title: "Commercial Office Vacancy Rates Weigh on Manhattan Real Estate Tax Revenues",
      description: "Persistent hybrid work trends lower commercial office valuations, impacting long-term municipal revenue models."
    }
  },
  NC: {
    bullish: {
      title: "North Carolina Financial Services Sector Grows in Charlotte Hub",
      description: "Charlotte-based commercial banks expand hiring, driving domestic growth numbers and sovereign service sector indices."
    },
    bearish: {
      title: "Research Triangle Park Tech Firms Announce Selective Hiring Freezes",
      description: "Software developers trim operational expenditures, slowing down luxury residential starts in Raleigh-Durham."
    }
  },
  ND: {
    bullish: {
      title: "North Dakota Bakken Oil Field Production Reaches Five-Year Output Peaks",
      description: "Sovereign wealth reserves grow as automated drilling tech improves per-well production efficiency."
    },
    bearish: {
      title: "Plunging Natural Gas Export Prices Compress North Dakota Drilling Revenues",
      description: "Regional supply glut lowers extraction royalty payments, reducing state capital project budgets."
    }
  },
  OH: {
    bullish: {
      title: "Ohio Aerospace and Steel Hub Lands $3.2B Clean Steel Mill Project",
      description: "Next-gen electric arc furnace facility breaks ground near Toledo, promising zero-emission industrial output."
    },
    bearish: {
      title: "Ohio Industrial Manufacturing Hub Facing Supply Chain De-Stocking",
      description: "Automotive and aerospace suppliers record temporary inventory drawdowns, leading to minor manufacturing production decelerations in the Rust Belt corridor."
    }
  },
  OK: {
    bullish: {
      title: "Oklahoma Wind Energy Infrastructure Attracts Major Tech Datacenter Grid Contracts",
      description: "Massive wind farms in the panhandle supply green energy directly to next-gen AI server farms, generating local utility tax windfalls."
    },
    bearish: {
      title: "Severe Weather Events Disrupt Pipeline Networks in Cushing, Oklahoma Oil Hub",
      description: "Crude oil storage terminals face operational pauses due to localized power grid damage, stalling trade."
    }
  },
  OR: {
    bullish: {
      title: "Oregon Silicon Forest Tech Clusters Announce $1.8B Microchip Substrate Fab",
      description: "Hillsboro microelectronics suppliers expand advanced manufacturing capacity, boosting international high-tech exports."
    },
    bearish: {
      title: "Pacific Northwest Timber Mill Slowdowns Impede Oregon Forestry Shipments",
      description: "Low domestic homebuilding volumes reduce lumber orders, prompting mills to pause processing shifts."
    }
  },
  PA: {
    bullish: {
      title: "Pennsylvania Healthcare Systems Hub Lands Massive Federal Life-Sciences Grant",
      description: "University research networks in Philadelphia and Pittsburgh expand medical training, driving urban growth."
    },
    bearish: {
      title: "Pennsylvania Steel and Heavy Energy Projects Face Delayed Regulatory Approvals",
      description: "Infrastructure projects in Western PA experience administrative review backlogs, delaying job growth and state treasury investment disbursements."
    }
  },
  RI: {
    bullish: {
      title: "Rhode Island Offshore Wind Power Corridor Completes Deepwater Grid Connection",
      description: "Narragansett Bay wind arrays begin commercial transmission, lowering retail electricity costs for state manufacturers."
    },
    bearish: {
      title: "Rhode Island Marine Tourism and Commercial Harbors Slow Down on Bad Weather",
      description: "Unseasonable summer precipitation drops tourist arrivals in Newport, impacting seasonal hospitality revenues."
    }
  },
  SC: {
    bullish: {
      title: "South Carolina Automotive Port Export Capacity Doubles in Charleston Expansion",
      description: "State port authority opens automated terminal, streamlining international vehicle shipments."
    },
    bearish: {
      title: "Textile and Synthetic Fiber Fabs in Upstate South Carolina Announce Workforce Cuts",
      description: "Global competition and high raw polymer costs force operating cutbacks at regional chemical plants."
    }
  },
  SD: {
    bullish: {
      title: "South Dakota Corporate Financial Services Sector Welcomes Record Asset Influx",
      description: "Favorable trust and regulatory laws attract domestic wealth offices, lifting state banking taxes."
    },
    bearish: {
      title: "Agricultural Dry Spell Hampers South Dakota Grassland Ranching Forage Yields",
      description: "Ranchers face diminished hay volumes, prompting early herd sales and dampening agricultural index forecasts."
    }
  },
  TN: {
    bullish: {
      title: "Tennessee Advanced Manufacturing Hub Lands $4B EV Powertrain Megafactory",
      description: "Spring Hill assembly site expands electric utility vehicle production, drawing automotive suppliers state-wide."
    },
    bearish: {
      title: "Logistical Bottlenecks on Tennessee Waterways Stall Agricultural Barge Shipping",
      description: "Low water levels on key rivers restrict barge freight limits, slowing grain shipping out of Memphis."
    }
  },
  TX: {
    bullish: {
      title: "Texas Allocates $5B Surplus for High-Speed Grid Expansion",
      description: "The Texas Legislature has approved a landmark $5 billion funding package from its sovereign treasury to expand high-voltage transmission lines, fortifying the energy grid and supporting large-scale tech migrations."
    },
    bearish: {
      title: "Texas Refining Capacity Capped Temporarily Following Gulf Coast Plant Incident",
      description: "Major energy complexes in Houston undergo unscheduled maintenance, tightening national product supplies."
    }
  },
  UT: {
    bullish: {
      title: "Utah Silicon Slopes Tech Hub Attracts Global Enterprise Software Inflows",
      description: "Salt Lake Valley tech ecosystem records a major capital influx, expanding office development and technical jobs."
    },
    bearish: {
      title: "Winter Resort Operators in Utah Report Late Snowpack Lowering Ski Pass Bookings",
      description: "Shorter winter season limits hospitality services tax, cooling the local recreation GDP indices."
    }
  },
  VT: {
    bullish: {
      title: "Vermont Green Transit Grid Funded by Historic Clean Energy Bonds",
      description: "State treasury issues green bonds to finance state-wide EV charging corridors and municipal battery sites."
    },
    bearish: {
      title: "Maple Syrup Yields in Vermont Decline Due to Unseasonable Temperature Fluctuations",
      description: "Early sap runs shorten harvesting windows, reducing export crop volumes for specialty food markets."
    }
  },
  VA: {
    bullish: {
      title: "Virginia Data Center Alley Lands $6B Infrastructure Pipeline",
      description: "Loudoun County cloud infrastructure expands, driving high fiber tax revenues and commercial grid upgrades."
    },
    bearish: {
      title: "Defense Procurement Cool-Off Limits Northern Virginia Consulting Outflows",
      description: "Federal budget caps slow down professional service agreements, dampening regional wage growth models."
    }
  },
  WA: {
    bullish: {
      title: "Washington State Aerospace Exports Jump 14% on Commercial Jet Deliveries",
      description: "A sharp increase in wide-body aircraft shipments drives robust international trade numbers for Seattle-region ports, supporting strong sovereign productivity metrics."
    },
    bearish: {
      title: "Tech Sector Software Licensing Income Slows Down in Seattle Tech Hub",
      description: "Cloud computing growth rates level off, reducing corporate tax payments to the state general fund."
    }
  },
  WV: {
    bullish: {
      title: "West Virginia Secures Massive Rare Earth Element Processing Facility",
      description: "Former mining centers pivot to technical mineral extraction, creating high-tech chemical refining positions."
    },
    bearish: {
      title: "Thermal Coal Export Volumes Face Structural Contracting at West Virginia Rail Hubs",
      description: "International shifts to renewable power sources compress mining royalty distributions."
    }
  },
  WI: {
    bullish: {
      title: "Wisconsin Bio-Manufacturing and Dairy Exporters Secure Premium Trade Deals",
      description: "State agricultural products win exclusive supply agreements with international markets, lifting export GDP."
    },
    bearish: {
      title: "Supply Chain Congestion at Wisconsin Casting Foundries Delays Heavy Machinery Shipments",
      description: "Metal fabrication plants face inventory backlogs, slightly slowing industrial production indices."
    }
  },
  WY: {
    bullish: {
      title: "Wyoming Carbon Capture and Sequestration Project Lands $1.5B Federal Grant",
      description: "Major geologic storage hub begins construction, drawing carbon storage engineering teams to the state."
    },
    bearish: {
      title: "Natural Gas Drilling Activity Softens in Wyoming Over Pipeline Capacity Limits",
      description: "Producers reduce active drilling rigs due to high regional shipping tariffs to major consumption hubs."
    }
  }
};
*/

function generateInitialNewsData() {
  return [
    {
      id: 1,
      time: "02:07:16 AM",
      stateId: "MI",
      title: "Pratt Miller Engineering & Fabrication Expands New Hudson, Michigan, Operations",
      description: "Engineering and technology company Pratt Miller Engineering & Fabrication plans to expand its operations in New Hudson, Michigan. The approximately $3 million project is expected to create 50 jobs.",
      sentiment: "Bullish",
      impactScore: 68,
      isPrattMiller: true
    }
  ];
}


let newsData = generateInitialNewsData();
let newsIdCounter = newsData.length + 1;

function formatCurrency(value) {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const BASE_MARKET_STATS = {
  vol24h: 2.3e12,
  avg7d: 2.1e12,
  oi: 15.6e12,
  outstanding: 110e6
};

function formatScaledValue(baseValue, proportion, isContracts = false) {
  const val = baseValue * proportion;
  if (isContracts) {
    let stateValStr;
    if (val >= 1e6) stateValStr = `${(val / 1e6).toFixed(1)}M`;
    else if (val >= 1e3) stateValStr = `${(val / 1e3).toFixed(1)}K`;
    else stateValStr = val.toFixed(0);

    let baseValStr = baseValue >= 1e6 ? `${(baseValue / 1e6).toFixed(0)}M` : baseValue.toLocaleString();
    return `${stateValStr} <span style="font-size: 0.6rem; color: var(--text-secondary); font-weight: normal; margin-left: 2px;">(Global: ${baseValStr})</span>`;
  } else {
    let stateValStr;
    if (val >= 1e12) stateValStr = `$${(val / 1e12).toFixed(2)}T`;
    else if (val >= 1e9) stateValStr = `$${(val / 1e9).toFixed(1)}B`;
    else if (val >= 1e6) stateValStr = `$${(val / 1e6).toFixed(1)}M`;
    else stateValStr = `$${val.toLocaleString()}`;

    let baseValStr = baseValue >= 1e12 ? `$${(baseValue / 1e12).toFixed(1)}T` : `$${(baseValue / 1e9).toFixed(0)}B`;
    return `${stateValStr} <span style="font-size: 0.6rem; color: var(--text-secondary); font-weight: normal; margin-left: 2px;">(Global: ${baseValStr})</span>`;
  }
}

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-container">
    <div class="ticker-wrap" style="overflow: hidden; background: rgba(255,255,255,0.03); border-radius: 2rem; padding: 0.5rem 1rem; margin-bottom: 1rem; font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">
      <div class="ticker" style="display: inline-block; animation: scroll 30s linear infinite;">
        <span style="margin-right: 3rem;">NY-SGA: 2,450.21 <span style="color: #10b981">+1.2%</span></span>
        <span style="margin-right: 3rem;">TX-SGA: 3,120.45 <span style="color: #10b981">+2.4%</span></span>
        <span style="margin-right: 3rem;">CA-SGA: 4,560.00 <span style="color: #ef4444">-0.5%</span></span>
        <span style="margin-right: 3rem;">FL-SGA: 1,890.12 <span style="color: #10b981">+0.8%</span></span>
        <span style="margin-right: 3rem;">US-SGA-GLOBAL: 12,450.00 <span style="color: var(--accent-gold)">+1.1%</span></span>
        <span style="margin-right: 3rem;">NOWCASTING: Q3 US GDP EXPECTED +2.8%</span>
      </div>
    </div>
    <header>
      <div class="logo">Sovereign Growth Assets</div>
      <nav style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <a href="#map" class="nav-link">Market Map</a>
        <a href="#table" class="nav-link">Sovereign Index</a>
        <a href="#ledger" class="nav-link">SGA Ledger</a>
        <a href="#calculator" class="nav-link">SGA Calculator</a>
        <a href="#news" id="header-news-lnk" class="nav-link" style="display: flex; align-items: center; gap: 0.4rem; border: 1px solid rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.05); color: var(--accent-gold); padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 0.5rem; text-decoration: none; margin-left: 1.5rem; height: 32px; box-shadow: 0 0 10px rgba(251, 191, 36, 0.05); transition: all 0.2s ease;">
          <span style="display: inline-block; width: 6px; height: 6px; background: var(--accent-gold); border-radius: 50%; animation: pulse 2s infinite;"></span>
          SGA News <span id="header-news-count" class="news-badge-reg" style="background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); color: var(--accent-gold); padding: 0.05rem 0.25rem; font-size: 0.6rem; border-radius: 3px; font-weight: 700; margin-left: 2px;">50</span>
        </a>
      </nav>
    </header>

    <div id="dashboard-page">
      <section class="hero">
        <h1>The Future of <span style="color: var(--accent-gold)">State Growth</span></h1>
        <p>Sovereign Growth Assets (SGAs) are next-generation futures contracts tied to real-time economic performance. Trade expectations, hedge macro-risk, and fund public infrastructure automatically.</p>
      </section>

    <div class="dashboard-grid" id="map">
      <div class="map-section glass-card">
        <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--accent-blue)">●</span> Interactive State Futures Map
        </h3>
        <div id="svg-placeholder" class="map-container">
          <!-- SVG will be loaded here -->
        </div>
      </div>

      <div class="details-panel" id="state-details">
        <div class="glass-card">
          <div class="stat-label">Selected State</div>
          <h2 id="selected-state-name" style="font-size: 2rem; margin-bottom: 1rem;">Select a State</h2>
          <div class="stat-item">
            <div class="stat-label">Current Sovereign EOI</div>
            <div class="stat-value eoi-value" id="eoi-value">--</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">SGA Contract Price</div>
            <div class="stat-value" id="contract-price" style="color: var(--accent-blue)">--</div>
          </div>
        </div>

        <div class="glass-card">
          <div class="stat-label">Payout Simulation & Market Exposure ($1 Trillion Injection)</div>
          <div class="split-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
            <div class="split-bar">
              <div class="market-share" id="market-bar"></div>
              <div class="state-share" id="state-bar"></div>
            </div>
            <div class="split-legend" style="display: flex; flex-direction: column; gap: 0.8rem;">
              <!-- Market Notional Activity & Exposure -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <span style="font-size: 0.7rem; color: var(--accent-blue); font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Market Activity</span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">24h Volume: <strong id="market-24h-vol" style="color: #fff; font-family: monospace;">--</strong></span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">7-Day Avg: <strong id="market-7d-avg" style="color: #fff; font-family: monospace;">--</strong></span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <span style="font-size: 0.7rem; color: var(--accent-blue); font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Market Exposure</span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">Open Interest: <strong id="market-oi" style="color: #fff; font-family: monospace;">--</strong></span>
                  <span style="font-size: 0.72rem; color: var(--text-secondary);">Contracts Out: <strong id="market-outstanding" style="color: #fff; font-family: monospace;">--</strong></span>
                </div>
              </div>
              
              <!-- Public (Sovereign Value Locked) -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <div class="dot" style="background: var(--accent-gold); width: 8px; height: 8px; border-radius: 50%;"></div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold);">Sovereign Value Locked (20%):</span>
                  </div>
                  <strong id="public-payout" style="color: var(--accent-gold); font-family: monospace; font-size: 0.85rem;">--</strong>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span style="font-size: 0.65rem; color: var(--text-secondary); margin-left: 0.75rem;">↳ 1.6% Monthly Drawdown Value:</span>
                  <strong id="public-drawdown-payout" style="color: #10b981; font-family: monospace; font-size: 0.85rem;">--</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="stat-label">Economic Pulse</div>
          <div id="mini-stats" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
            <div>
              <div class="stat-label" style="font-size: 0.6rem;">GDP Growth</div>
              <div class="stat-value" id="stat-growth" style="font-size: 1rem;">--</div>
            </div>
            <div>
              <div class="stat-label" style="font-size: 0.6rem;">Employment</div>
              <div class="stat-value" id="stat-employment" style="font-size: 1rem;">--</div>
            </div>
            <div>
              <div class="stat-label" style="font-size: 0.6rem; color: #ef4444;">Inflation (CPI)</div>
              <div class="stat-value" id="stat-inflation" style="font-size: 1rem; color: #ef4444;">--</div>
            </div>
          </div>
        </div>

        <div class="glass-card" id="state-wealth-fund-card">
          <div class="stat-label">Sovereign Wealth & Reinvestment</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Sovereign Value Locked (20%):</span>
              <strong id="stat-sovereign-wealth-pool" style="font-family: monospace; font-size: 0.95rem; color: var(--accent-gold);">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">State Treasury Cash (Paid):</span>
              <strong id="stat-treasury-cash" style="font-family: monospace; font-size: 0.95rem; color: #f59e0b;">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Available Drawdown (1.6%):</span>
              <strong id="stat-monthly-reinvestment" style="font-family: monospace; font-size: 0.95rem; color: #10b981;">$0.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Accumulated Volume:</span>
              <strong id="stat-accumulated-volume" style="font-family: monospace; font-size: 0.95rem; color: var(--accent-blue);">0 contracts</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.2rem;">
              <span class="stat-label" style="font-size: 0.65rem; margin: 0;">Investment Inflow Index:</span>
              <strong id="stat-investment-inflow-index" style="font-family: monospace; font-size: 0.95rem; color: #38bdf8;">0.00</strong>
            </div>
            
            <button id="drawdown-btn" class="trade-btn" style="width: 100%; margin-top: 0.5rem; padding: 0.55rem; font-size: 0.75rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2)); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 0.35rem; color: #10b981; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="window.triggerSovereignDrawdown()">
              <span>⚡</span> Draw Down 1.6% Yield
            </button>
          </div>
        </div>
      </div>
    </div>

    <section class="trading-section" id="table" style="margin-top: 4rem;">
      <h3 style="margin-bottom: 2rem;">Real-time Sovereign Index & Trading Terminal</h3>
      <div style="display: grid; grid-template-columns: 1fr 450px; gap: 2rem;">
        
        <div class="table-container" style="overflow-x: auto; max-height: 750px; overflow-y: auto;">
          <table id="state-table">
            <thead style="position: sticky; top: 0; z-index: 5;">
              <tr>
                <th>State</th>
                <th>GDP ($B)</th>
                <th>Growth (%)</th>
                <th>Inflation (%)</th>
                <th>EOI Index</th>
                <th>SGA Price</th>
                <th>24h Chg</th>
              </tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>

        <div class="trading-terminal glass-card" style="display: flex; flex-direction: column; gap: 0;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <div class="stat-label">Futures Contract</div>
              <h2 id="trading-state-name" style="margin: 0; font-size: 1.4rem;">Select a State</h2>
            </div>
            <div style="text-align: right;">
              <div class="stat-label">Mark Price</div>
              <div id="trading-price" class="live-price" style="font-size: 1.5rem; font-weight: bold; color: var(--accent-blue);">--</div>
            </div>
          </div>

          <!-- Contract Specs Strip -->
          <div class="contract-specs-strip">
            <div class="spec-item"><span class="spec-label">Tick</span><span class="spec-val">0.01</span></div>
            <div class="spec-item"><span class="spec-label">Tick Val</span><span class="spec-val">$10</span></div>
            <div class="spec-item"><span class="spec-label">Mult</span><span class="spec-val">$1,000</span></div>
            <div class="spec-item"><span class="spec-label">Init Margin</span><span class="spec-val" id="spec-margin">--</span></div>
            <div class="spec-item"><span class="spec-label">Expiry</span><span class="spec-val" id="spec-expiry">--</span></div>
          </div>

          <!-- Chart Container -->
          <div style="position: relative; margin: 0.75rem 0;">
            <!-- Chart Canvas Container -->
            <div id="trading-chart" style="height: 200px; width: 100%; background: rgba(0,0,0,0.2); border-radius: 0.5rem; position: relative;">
            </div>
            
            <!-- Glassmorphic Chart Toolbar -->
            <div class="chart-toolbar" style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding: 0.35rem 0.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.35rem; font-size: 0.7rem;">
              <div style="display: flex; gap: 0.35rem;">
                <button type="button" id="chart-btn-pan-left" class="chart-tool-btn" title="Scroll Back in Time" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">◀ Past</button>
                <button type="button" id="chart-btn-pan-right" class="chart-tool-btn" title="Scroll to Present" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">Future ▶</button>
              </div>
              
              <!-- Custom styled scroll slider -->
              <input type="range" id="chart-timeline-slider" min="0" max="155" value="0" style="flex: 1; margin: 0 0.75rem; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; -webkit-appearance: none; cursor: pointer;">
              
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button type="button" id="chart-btn-zoom-out" class="chart-tool-btn" title="Zoom Out (Show More)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">−</button>
                <button type="button" id="chart-btn-zoom-in" class="chart-tool-btn" title="Zoom In (Show Fewer)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem;">＋</button>
                <button type="button" id="chart-btn-live" class="chart-tool-btn" title="Snap to Real-Time Feed" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; border-radius: 0.25rem; padding: 0.2rem 0.4rem; cursor: pointer; font-size: 0.65rem; font-weight: bold; display: flex; align-items: center; gap: 2px;"><span style="display:inline-block; width:4px; height:4px; background:#10b981; border-radius:50%;"></span>LIVE</button>
              </div>
            </div>
          </div>

          <!-- Limit Order Book & Depth -->
          <div class="order-book-panel" style="margin: 0.5rem 0; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--glass-border); border-radius: 0.5rem; overflow: hidden; font-family: monospace;">
            <div class="ob-header" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.35rem 0.5rem; font-size: 0.6rem; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 700; text-transform: uppercase;">
              <span>Price ($)</span>
              <span style="text-align: right;">Size (Qty)</span>
              <span style="text-align: right;">Total ($M)</span>
            </div>
            <div id="ob-asks" style="display: flex; flex-direction: column;"></div>
            
            <div class="ob-spread-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; padding: 0.35rem 0.5rem; font-size: 0.8rem; font-weight: bold; background: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.03); align-items: center;">
              <div id="ob-last-price" style="display: flex; align-items: center; gap: 0.4rem;">
                <span id="ob-last-val" style="font-weight: bold;">--</span>
                <span id="ob-direction-arrow"></span>
              </div>
              <div id="ob-spread-val" style="text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-weight: normal;">Spread: --</div>
            </div>
            
            <div id="ob-bids" style="display: flex; flex-direction: column;"></div>
          </div>

          <!-- Order Entry -->
          <div class="order-entry">
            <div class="order-row">
              <div class="order-field">
                <label>Order Type</label>
                <select id="order-type" class="order-input">
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>
              <div class="order-field">
                <label>Contracts</label>
                <div class="qty-control">
                  <button class="qty-btn" onclick="adjustQty(-1)">−</button>
                  <input type="text" id="order-qty" value="1" inputmode="numeric">
                  <button class="qty-btn" onclick="adjustQty(1)">+</button>
                </div>
              </div>
              <div class="order-field" id="limit-price-field" style="display: none;">
                <label>Price</label>
                <input type="number" id="limit-price" class="order-input" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="order-summary" style="display: flex; flex-direction: column; gap: 0.35rem; border-top: 1px solid var(--glass-border); padding: 0.5rem 0;">
              <div style="display: flex; justify-content: space-between; width: 100%;">
                <span>Notional Value:</span>
                <strong id="order-notional">--</strong>
              </div>
              <div style="display: flex; justify-content: space-between; width: 100%;">
                <span>Required Margin (10%):</span>
                <strong id="order-margin">--</strong>
              </div>
              <div style="display: flex; flex-direction: column; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.35rem; gap: 0.25rem;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                  <span>Exchange Fee ($0.50/Contract):</span>
                  <strong id="order-fee" style="color: #10b981;">$0.00 (Free &lt; $25k)</strong>
                </div>
                <div id="order-fee-split" style="font-size: 0.55rem; color: var(--text-secondary); display: none; flex-direction: column; width: 100%; font-family: monospace; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 0.15rem; gap: 0.1rem; text-align: left;">
                  <span id="fee-split-mm">↳ Rebate to MM (34%): $0.00</span>
                  <span id="fee-split-llc">↳ Royalty to SGA LLC (33%): $0.00</span>
                  <span id="fee-split-state">↳ Sovereign Yield (33%): $0.00</span>
                </div>
                <div style="display: flex; justify-content: space-between; width: 100%; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 0.15rem;">
                  <span>Federal Reg Fee (0.04%):</span>
                  <strong id="order-fed-fee" style="color: #38bdf8; font-family: monospace;">$0.00</strong>
                </div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">
              <button class="trade-btn buy-btn" onclick="executeTrade('buy')">
                <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">LONG</span>
                BUY
              </button>
              <button class="trade-btn sell-btn" onclick="executeTrade('sell')">
                <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>
                SELL
              </button>
            </div>
            
            <!-- Live Trade Feed -->
            <div class="live-feed-panel" style="padding: 0.35rem 0.5rem; background: rgba(0, 0, 0, 0.2); border-radius: 0.4rem; border: 1px solid rgba(255,255,255,0.03);">
              <div style="display: flex; justify-content: space-between; font-size: 0.55rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold; margin-bottom: 0.2rem;">
                <span>Live Feed</span>
                <span style="color: var(--accent-gold);">● Trillion-$ Pool</span>
              </div>
              <div id="live-trades-list" style="display: flex; flex-direction: column; gap: 0.15rem; font-family: monospace; font-size: 0.65rem; height: 38px; overflow: hidden; justify-content: center;">
                <div style="color: var(--text-secondary); text-align: center;">Awaiting market activity...</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Open Positions Panel -->
      <div class="positions-panel glass-card" style="margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <span style="display: inline-block; width: 8px; height: 8px; background: var(--accent-blue); border-radius: 50%; animation: pulse 2s infinite;"></span>
            Open Positions
            <span class="position-badge" id="position-count">0</span>
          </h4>
          <div style="display: flex; align-items: center; gap: 2rem;">
            <div>
              <span class="stat-label" style="margin: 0; font-size: 0.6rem;">UNREALIZED P&L</span>
              <div id="total-pnl" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">$0.00</div>
            </div>
            <div>
              <span class="stat-label" style="margin: 0; font-size: 0.6rem;">TOTAL MARGIN</span>
              <div id="total-margin" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">$0.00</div>
            </div>
          </div>
        </div>
        <div class="table-container" style="max-height: 220px; overflow-y: auto;">
          <table id="positions-table">
            <thead style="position: sticky; top: 0; z-index: 5;">
              <tr>
                <th>Contract</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>P&L</th>
                <th>Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="positions-body">
              <tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No open positions. Place a trade to begin.</td></tr>
            </tbody>
          </table>
        </div>
    </section>

    <!-- TRADE HISTORY TAB -->
    <section class="trade-history-section glass-card" style="margin-top: 2rem; padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff;">
          <span style="display: inline-block; width: 8px; height: 8px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span>
          Trade History
          <span class="position-badge" id="history-count" style="background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.3);">0</span>
        </h4>
        <div style="display: flex; align-items: center; gap: 2rem;">
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">TOTAL REALIZED P&L</span>
            <div id="history-total-pnl" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary); font-family: monospace;">$0.00</div>
          </div>
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">TOTAL FEES PAID</span>
            <div id="history-total-fees" style="font-weight: 700; font-size: 1.1rem; color: var(--accent-gold); font-family: monospace;">$0.00</div>
          </div>
          <div style="text-align: right;">
            <span class="stat-label" style="margin: 0; font-size: 0.55rem; display: block;">WIN RATE</span>
            <div id="history-win-rate" style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary); font-family: monospace;">—</div>
          </div>
        </div>
      </div>

      <!-- Summary Cards Row -->
      <div id="history-summary-cards" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.6rem; margin-bottom: 1rem;">
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Total Volume</span>
          <span id="history-total-volume" style="font-weight: 700; color: #fff; font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
        <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #10b981; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Best Trade</span>
          <span id="history-best-trade" style="font-weight: 700; color: #10b981; font-family: monospace; font-size: 0.85rem;">—</span>
        </div>
        <div style="background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #ef4444; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Worst Trade</span>
          <span id="history-worst-trade" style="font-weight: 700; color: #ef4444; font-family: monospace; font-size: 0.85rem;">—</span>
        </div>
        <div style="background: rgba(56,189,248,0.05); border: 1px solid rgba(56,189,248,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: #38bdf8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Federal Fees</span>
          <span id="history-fed-fees" style="font-weight: 700; color: #38bdf8; font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
        <div style="background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.12); padding: 0.5rem 0.7rem; border-radius: 0.4rem;">
          <span style="font-size: 0.55rem; color: var(--accent-gold); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Exchange Fees</span>
          <span id="history-exch-fees" style="font-weight: 700; color: var(--accent-gold); font-family: monospace; font-size: 0.85rem;">$0.00</span>
        </div>
      </div>

      <div class="table-container" style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.03); border-radius: 0.4rem;">
        <table id="trade-history-table" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="position: sticky; top: 0; background: #0c0f16; z-index: 5; border-bottom: 1px solid var(--glass-border);">
            <tr>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Time</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Contract</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Side</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Qty</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Entry</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Exit</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Notional</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">P&L</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">RoM%</th>
              <th style="padding: 0.6rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Fees</th>
            </tr>
          </thead>
          <tbody id="trade-history-body">
            <tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">No closed trades yet. Open and close a position to see your history.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- REAL-TIME TRANSACTION LEDGER & CLEARING HOUSE REVENUE TRACKER -->
    <section class="trading-ledger-section glass-card" style="margin-top: 2rem; padding: 1.5rem;">
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;">
        
        <!-- Left: Live Transactions Log -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff;">
              <span style="display: inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%; animation: pulse 1.5s infinite;"></span>
              Transaction Ledger
            </h4>
            
            <div style="display: flex; gap: 0.25rem; background: rgba(0,0,0,0.25); padding: 0.2rem; border-radius: 0.35rem; border: 1px solid rgba(255,255,255,0.05);">
              <button id="tx-filter-all" class="tab-btn active" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 0.25rem; background: rgba(251, 191, 36, 0.15); color: var(--accent-gold); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onclick="setTxFilter('all')">All Activity</button>
              <button id="tx-filter-user" class="tab-btn" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; border: 1px solid transparent; border-radius: 0.25rem; background: transparent; color: var(--text-secondary); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onclick="setTxFilter('user')">My Trades Only</button>
            </div>
          </div>
          
          <div class="table-container" style="max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.03); border-radius: 0.4rem;">
            <table id="transactions-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead style="position: sticky; top: 0; background: #0c0f16; z-index: 5; border-bottom: 1px solid var(--glass-border);">
                <tr>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Timestamp</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Contract</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Party</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Side</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Qty</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Price</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Notional</th>
                  <th style="padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05);">Clearing Fee</th>
                </tr>
              </thead>
              <tbody id="transactions-body">
                <tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">Awaiting clearing house transactions...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Right: Real-time Clearing House Fee Revenue Tracker -->
        <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.9rem;">
          <h4 style="margin: 0; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent-gold); display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
            <svg style="width: 15px; height: 15px; fill: var(--accent-gold);" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            Clearing Revenue
          </h4>
          
          <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.6rem;">
            <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; display: block; margin-bottom: 2px;">Total Accumulated Fees</span>
            <div id="revenue-total" style="font-size: 2rem; font-weight: 800; color: #fff; text-shadow: 0 0 15px rgba(16, 185, 129, 0.25); font-family: monospace; letter-spacing: -0.02em;">$0.00</div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-secondary);">Market Maker Rebate (34%)</span>
              <span id="revenue-mm" style="font-weight: bold; color: var(--text-primary); font-family: monospace;">$0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.4rem; margin-bottom: 0.1rem;">
              <span style="color: var(--accent-gold); font-weight: 600;">Creator Royalty (33%)</span>
              <span id="revenue-llc" style="font-weight: bold; color: var(--accent-gold); font-family: monospace;">$0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.4rem; margin-bottom: 0.1rem;">
              <span style="color: var(--text-secondary);">State Treasury Yield (33%)</span>
              <span id="revenue-state" style="font-weight: bold; color: var(--text-primary); font-family: monospace;">$0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #38bdf8; font-weight: 600;">Federal Win Tax (0.25% / 10% Cap, >=$1k Profit)</span>
              <span id="revenue-federal" style="font-weight: bold; color: #38bdf8; font-family: monospace;">$0.00</span>
            </div>
          </div>
          
          <div style="margin-top: 0.4rem; padding-top: 0.8rem; border-top: 1px solid rgba(255,255,255,0.06); display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; font-size: 0.65rem;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.4rem 0.6rem; border-radius: 0.35rem;">
              <span style="color: var(--text-secondary); display: block; margin-bottom: 3px; font-size: 0.55rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em;">Avg Fee/Trade</span>
              <span id="revenue-avg" style="font-weight: bold; color: #fff; font-family: monospace; font-size: 0.75rem;">$0.00</span>
            </div>
            <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.12); padding: 0.4rem 0.6rem; border-radius: 0.35rem;">
              <span style="color: #ef4444; display: block; margin-bottom: 3px; font-size: 0.55rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em;">Loss Rebates</span>
              <span id="revenue-loss-rebates" style="font-weight: bold; color: #ef4444; font-family: monospace; font-size: 0.75rem;">$0.00</span>
            </div>
          </div>
          
          <div style="font-size: 0.55rem; color: var(--text-secondary); text-align: center; margin-top: 0.1rem; font-style: italic; line-height: 1.3;">
            Tracks institutional LOB blocks & user fills in real time under CFTC 40.2 protocols.
          </div>
        </div>
        
      </div>
    </section>

    <section class="formula-section glass-card" style="margin-top: 4rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem;">
        <div>
          <h3 style="color: var(--accent-gold); margin-bottom: 1rem;">The EOI Formula</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The Sovereign Economic Output Index is a composite metric of a nation's macroeconomic health:</p>
          <div style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); font-size: 0.95rem; line-height: 1.6;">
            <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-gold); margin-bottom: 0.75rem; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Economic Output Index (EOI)</div>
            <div style="color: #fff; margin-bottom: 0.5rem; font-size: 1rem; word-break: break-word; font-weight: 500; letter-spacing: 0.05em;">
              EOI = [a·GDP + b·Growth + c·Tax + d·Employment + e·Business + f·Investment + g·Productivity] × <span style="color: #ef4444;">Inflation Factor</span>
            </div>
            <div style="color: var(--accent-gold); font-size: 0.85rem; margin-bottom: 0.5rem; font-family: system-ui, sans-serif; font-weight: 700;">
              SGA Futures Contract Price = EOI × $2,000.00
            </div>
            <div style="color: var(--text-secondary); font-size: 0.75rem; margin-bottom: 1rem; font-family: system-ui, sans-serif; line-height: 1.4;">
              <span style="color: #ef4444;">Inflation Factor</span> = 1 − (0.05 × max(0, State CPI − 2.0%)) · <span style="opacity: 0.7;">At or below 2% = no penalty. Each 1% above = 5% EOI haircut.</span>
            </div>
            <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem 1rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.75rem; line-height: 1.5;">
              <div><strong style="color: var(--accent-blue)">GDP:</strong> Gross Domestic Product (a = 0.25)</div>
              <div><strong style="color: var(--accent-blue)">Growth:</strong> GDP Growth Rate (b = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Tax:</strong> Tax Revenue (c = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Employment:</strong> Employment Rate (d = 0.15)</div>
              <div><strong style="color: var(--accent-blue)">Business:</strong> Business Formation Rate (e = 0.10)</div>
              <div><strong style="color: var(--accent-blue)">Investment:</strong> Investment Inflow (f = 0.15)</div>
              <div><strong style="color: var(--accent-blue)">Productivity:</strong> Productivity Rate (g = 0.15)</div>
              <div><strong style="color: #ef4444">Inflation:</strong> CPI Deflator (h = 0.05)</div>
            </div>
          </div>
          
          <div style="margin-top: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 0.5rem; font-family: system-ui, sans-serif;">
            <h4 style="color: #fff; margin: 0 0 1rem 0; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent-gold);">Weight & Metric Explanation</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 1.25rem 0; line-height: 1.4;">
              Here is how each of the seven key economic factors and the inflation deflator contribute to the Sovereign Economic Index:
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              
              <!-- GDP -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-gold); font-size: 0.85rem; display: block; margin-bottom: 2px;">Gross Domestic Product (GDP)</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures the total size and value of all goods and services produced. It represents the foundational anchor of a state's economic power.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-gold); font-family: monospace; font-size: 1rem; background: rgba(251, 191, 36, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(251, 191, 36, 0.2); min-width: 55px; text-align: center;">25%</div>
              </div>

              <!-- Employment -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Employment Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures job security and labor market participation. High employment fuels household income and consumer spending.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Investment -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Investment Inflow</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks outside capital flowing into regional industries, demonstrating global investor trust and powering business growth.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Productivity -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: var(--accent-blue); font-size: 0.85rem; display: block; margin-bottom: 2px;">Productivity Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures economic efficiency per capita. High productivity is a sign of technological innovation and skilled workforces.</span>
                </div>
                <div style="font-weight: 700; color: var(--accent-blue); font-family: monospace; font-size: 1rem; background: rgba(96, 165, 250, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(96, 165, 250, 0.2); min-width: 55px; text-align: center;">15%</div>
              </div>

              <!-- Growth -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">GDP Growth Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Measures how fast the economy is expanding. It captures short-term economic momentum and expansionary velocity.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

              <!-- Tax -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">Tax Revenue</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks fiscal collection, representing a state's funding capacity for public infrastructure and developmental yield.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

              <!-- Business -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 0.4rem; gap: 1.5rem;">
                <div>
                  <strong style="color: #e2e8f0; font-size: 0.85rem; display: block; margin-bottom: 2px;">Business Formation Rate</strong>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Tracks the launch rate of new businesses, representing entrepreneurial dynamism and future growth potential.</span>
                </div>
                <div style="font-weight: 700; color: #e2e8f0; font-family: monospace; font-size: 1rem; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); min-width: 55px; text-align: center;">10%</div>
              </div>

            </div>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1rem;">Weights are determined by independent economic committees to ensure stability and accuracy.</p>
        </div>
        <div>
          <h3 style="color: var(--accent-blue); margin-bottom: 1rem;">Sovereign Benefit Rule</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Unlike traditional futures, SGAs mandate a public yield. Every contract settlement is automatically split:</p>
          <ul style="color: var(--text-secondary); list-style: none; display: flex; flex-direction: column; gap: 0.75rem;">
            <li><strong style="color: #fff">80% Market Volume:</strong> High-liquidity environment for open market trading.</li>
            <li><strong style="color: #fff">20% Sovereign Yield:</strong> Automatic reinvestment into the state’s economic and social infrastructure.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- SGA LEDGER SECTION -->
    <section class="ledger-section" id="ledger" style="margin-top: 4rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h3>SGA Tamper-Evident Ledger</h3>
        <div style="display: flex; gap: 1rem;">
          <button id="reset-ledger-btn" class="trade-btn sell-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem;">Reset Ledger</button>
          <button id="verify-ledger-btn" class="trade-btn" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; font-size: 0.8rem;">Verify Integrity</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 360px 1fr; gap: 2rem; align-items: start;">
        <!-- Entry Form -->
        <div class="glass-card ledger-form-container">
          <div class="allocations-header">
            <h4 style="color: var(--accent-gold); font-size: 1.15rem; font-weight: 700; margin: 0;">Create New SGA Entry</h4>
            <button type="button" id="add-split-btn" class="add-split-btn">
              <span>+</span> Add Split
            </button>
          </div>
          <form id="ledger-form">
            <div id="allocations-container" class="allocations-scroll-container">
              <!-- Dynamically populated splits go here -->
            </div>
            
            <div class="splits-summary-box">
              <span class="sum-label">Total Volume</span>
              <span class="sum-value" id="splits-total-amount">$0</span>
            </div>

            <!-- Media & Documentation Section -->
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem; margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                <span style="font-size: 0.62rem; color: var(--accent-blue); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">📎 Media &amp; Documentation</span>
                <button type="button" id="add-media-btn" class="add-split-btn" style="font-size: 0.6rem; padding: 0.2rem 0.5rem;">+ Add URL</button>
              </div>
              <div id="media-urls-container" style="display: flex; flex-direction: column; gap: 0.35rem;"></div>
              <div style="font-size: 0.52rem; color: var(--text-secondary); margin-top: 0.25rem; font-style: italic;">Supports YouTube/Vimeo, images (.jpg/.png), PDFs, or any document URL.</div>
            </div>

            <!-- Audit Report Section -->
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem; margin-top: 0.75rem; margin-bottom: 0.75rem;">
              <div style="margin-bottom: 0.45rem;">
                <span style="font-size: 0.62rem; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">🔍 Audit Report</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label>AUDITOR / FIRM</label>
                  <input type="text" id="audit-firm" placeholder="e.g. Deloitte &amp; Touche LLP">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>AUDIT DATE</label>
                    <input type="date" id="audit-date">
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>STATUS</label>
                    <select id="audit-status">
                      <option value="">— No Audit —</option>
                      <option value="Pending">⏳ Pending Review</option>
                      <option value="Passed">✓ Passed</option>
                      <option value="Qualified">⚠ Qualified Opinion</option>
                      <option value="Failed">✗ Failed</option>
                    </select>
                  </div>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label>REPORT URL</label>
                  <input type="url" id="audit-report-url" placeholder="https://example.com/audit-report.pdf">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label>AUDIT NOTES</label>
                  <textarea id="audit-notes" rows="2" placeholder="Optional: key findings, scope, qualifications..."></textarea>
                </div>
              </div>
            </div>

            <button type="submit" class="trade-btn buy-btn" style="width: 100%;">Record to Ledger</button>
          </form>
        </div>

        <!-- Ledger View & Filters -->
        <div class="ledger-view-container glass-card" style="display: flex; flex-direction: column;">
          <div class="ledger-filters" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <div class="filter-group">
              <label>Category</label>
              <select id="filter-category"><option value="All">All Categories</option></select>
            </div>
            <div class="filter-group">
              <label>Region</label>
              <select id="filter-region"><option value="All">All Regions</option></select>
            </div>
            <div class="filter-group">
              <label>Agency</label>
              <input type="text" id="filter-agency" placeholder="Search Agency...">
            </div>
            <div class="filter-group">
              <label>From Date</label>
              <input type="date" id="filter-start">
            </div>
            <div class="filter-group">
              <label>To Date</label>
              <input type="date" id="filter-end">
            </div>
          </div>

          <div class="table-container" style="flex: 1; overflow-y: auto; max-height: 500px;">
            <table id="ledger-table">
              <thead style="position: sticky; top: 0; z-index: 5;">
                <tr>
                  <th>Date</th>
                  <th style="text-align: center;">Region</th>
                  <th>Category</th>
                  <th>Agency</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th style="text-align: right;">Hash Anchor</th>
                </tr>
              </thead>
              <tbody id="ledger-body">
                <!-- populated by JS -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
    </div> <!-- end of dashboard-page -->

    <!-- DEDICATED FULL-SCREEN NEWS TERMINAL PAGE -->
    <div id="news-page" class="hidden" style="margin-top: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--accent-gold); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; background: var(--accent-gold); border-radius: 50%; animation: pulse 2s infinite;"></span>
            Live Intelligence Datastream
          </div>
          <h2 style="font-size: 2rem; margin: 0; color: #fff; font-weight: 800;">Sovereign Growth News Terminal</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; border-radius: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Active Monitors: <strong style="color: #fff">50 States</strong></span>
          <span style="color: var(--glass-border)">|</span>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Last Update: <strong id="news-last-tick" style="color: var(--accent-blue)">Just Now</strong></span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;">
        <!-- Left Column: News List & Filters -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Filters Card -->
          <div class="glass-card news-filters" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <div class="filter-group" style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Search Intelligence</label>
              <input type="text" id="news-search-main" placeholder="Search headline, summary or region..." style="width: 100%; padding: 0.5rem 0.75rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; transition: border-color 0.2s;">
            </div>
            <div class="filter-group" style="width: 150px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Region</label>
              <select id="news-filter-state-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All States</option>
              </select>
            </div>
            <div class="filter-group" style="width: 120px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Sentiment</label>
              <select id="news-filter-sentiment-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All Sentiments</option>
                <option value="Bullish">Bullish</option>
                <option value="Bearish">Bearish</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>
            <div class="filter-group" style="width: 130px; display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Impact</label>
              <select id="news-filter-impact-main" style="width: 100%; padding: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; outline: none; cursor: pointer;">
                <option value="All">All Severity</option>
                <option value="High">High Severity (>50)</option>
                <option value="Med">Medium Severity (20-50)</option>
                <option value="Low">Low Severity (<20)</option>
              </select>
            </div>
          </div>
          
          <!-- Feed list container -->
          <div id="news-feed-main" style="display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; max-height: 800px; padding-right: 0.5rem;"></div>
        </div>
        
        <!-- Right Column: Analytics Sidebar -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Sentiment Monitor Card -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-blue);">●</span> Macro Sentiment Monitor
            </h4>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                <span>Bullish Index Catalyst</span>
                <span id="sentiment-bullish-pct" style="color: #10b981; font-weight: 700;">--</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; display: flex;">
                <div id="sentiment-bar-bullish" style="height: 100%; background: #10b981; width: 0%; transition: width 0.4s ease;"></div>
                <div id="sentiment-bar-neutral" style="height: 100%; background: #94a3b8; width: 0%; transition: width 0.4s ease;"></div>
                <div id="sentiment-bar-bearish" style="height: 100%; background: #ef4444; width: 0%; transition: width 0.4s ease;"></div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 0.65rem; color: var(--text-secondary); text-align: center; margin-top: 0.25rem;">
                <div>
                  <div style="color: #10b981; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-bullish">--</div>
                  <span>Bullish</span>
                </div>
                <div>
                  <div style="color: #94a3b8; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-neutral">--</div>
                  <span>Neutral</span>
                </div>
                <div>
                  <div style="color: #ef4444; font-weight: bold; font-size: 0.85rem;" id="sentiment-count-bearish">--</div>
                  <span>Bearish</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Hot Contracts (Shocks) Card -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-gold);">●</span> High Impact Shocks
            </h4>
            <div id="hot-shocks-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <!-- Rendered dynamically -->
            </div>
          </div>
          
          <!-- State Sentiment Matrix -->
          <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); border-radius: 0.75rem;">
            <h4 style="color: var(--text-primary); font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--accent-blue);">●</span> State Sentiment Matrix
            </h4>
            <div id="state-news-matrix" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; text-align: center; font-family: monospace; font-size: 0.65rem;">
              <!-- 50 mini state pills with green/red indicator dots based on their latest news sentiment! -->
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- DEDICATED FULL-SCREEN ARTICLE VIEW PAGE -->
    <div id="article-page" class="hidden" style="margin-top: 2rem;"></div>

    <!-- DEDICATED FULL-SCREEN SGA CALCULATOR PAGE -->
    <div id="calculator-page" class="hidden" style="margin-top: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--accent-gold); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.25rem;">
            Real-Time Macroeconomic Simulator
          </div>
          <h2 style="font-size: 2.2rem; margin: 0; color: #fff; font-weight: 800;">Sovereign SGA Calculator</h2>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <select id="calc-state-preset" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.5rem; color: #fff; outline: none; cursor: pointer;">
            <option value="">-- Load State Profile --</option>
          </select>
          <button id="calc-reset-btn" class="trade-btn sell-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 0.5rem;">Reset to Defaults</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2.5rem; align-items: start;">
        <!-- Left Column: Sliders and Weight controls -->
        <div class="glass-card" style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
          <h3 style="color: #fff; margin: 0; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--accent-blue);">●</span> Macroeconomic Variables & Weights
          </h3>
          
          <div id="calc-variables-container" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Right Column: Results & Analytics -->
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <!-- Glowing Output Card -->
          <div class="glass-card" style="padding: 2rem; text-align: center; background: radial-gradient(circle at top right, rgba(251, 191, 36, 0.05), transparent 60%); border: 1px solid rgba(251, 191, 36, 0.15);">
            <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Computed Sovereign EOI Score</div>
            
            <div style="margin: 1.5rem 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <!-- Glowing score -->
              <span id="calc-result-score" style="font-size: 5rem; font-weight: 900; color: var(--accent-gold); text-shadow: 0 0 30px rgba(251, 191, 36, 0.4); line-height: 1;">--</span>
              <span id="calc-result-rating" style="margin-top: 0.75rem; padding: 0.35rem 1rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">Exceptional</span>
            </div>

            <!-- Visual contribution progress bar -->
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin: 1.5rem 0 1rem 0; display: flex;" id="calc-contribution-bar"></div>
            
            <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; justify-content: space-between;">
              <span>Min Score: 0.00</span>
              <span>SGA Capacity: Unlimited</span>
            </div>
          </div>

          <!-- Contract Valuation & Yield -->
          <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
            <h4 style="color: #fff; margin: 0; font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-blue);">SGA Valuation Impact</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.03);">
                <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">Contract Price Index</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #fff;" id="calc-contract-price">$0.00</div>
                <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.15rem;">Simulated Contract Price</div>
              </div>
              <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.03);">
                <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">20% Sovereign Yield</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-gold);" id="calc-sovereign-yield">$0.00</div>
                <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.15rem;">To Public Infrastructure</div>
              </div>
            </div>
          </div>

          <!-- Weights sum integrity validator -->
          <div class="glass-card" style="padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; border-left: 3px solid #10b981;" id="calc-weight-validator">
            <div>
              <strong style="color: #fff; font-size: 0.8rem; display: block; margin-bottom: 2px;">Weights Sum Integrity</strong>
              <span style="font-size: 0.7rem; color: var(--text-secondary);" id="calc-weight-sum-label">Weights must add up to exactly 1.00 (100%).</span>
            </div>
            <div style="font-family: monospace; font-weight: bold; font-size: 1.1rem; color: #10b981;" id="calc-weight-sum-value">1.00 / 1.00</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Detail Modal Overlay -->
  <div id="detail-modal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Ledger Entry Details</h3>
        <button id="close-modal-btn" class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body" id="modal-details-content">
        <!-- populated dynamically -->
      </div>
    </div>
  </div>

  <!-- Floating Corner News Alert Container -->
  <div id="news-flash-container" class="news-flash-alert"></div>
`;

async function init() {
  // Initialize state-level wealth fund tracking fields
  statesData.forEach(state => {
    state.sovereignFund = state.sovereignFund || 0; // treasury cash paid out
    state.lockedValue = state.lockedValue || 0;     // capital currently locked
    state.totalVolume = state.totalVolume || 0;
  });

  // Load SVG
  const response = await fetch('/src/us.svg');
  const svgText = await response.text();
  document.getElementById('svg-placeholder').innerHTML = svgText;

  const svg = document.querySelector('svg');
  svg.removeAttribute('style'); // Clear inline styles for our CSS to take over

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'map-tooltip';
  document.body.appendChild(tooltip);

  // Get min/max EOI for color mapping
  const eois = statesData.map(s => calculateEOI(s));
  const minEoi = Math.min(...eois);
  const maxEoi = Math.max(...eois);

  // Add state-path class to all paths and setup interactions
  const paths = svg.querySelectorAll('path');
  paths.forEach(path => {
    path.classList.add('state-path');
    const stateId = path.id;
    const state = statesData.find(s => s.id === stateId);

    if (state) {
      const eoi = calculateEOI(state);

      // Calculate color based on EOI (heatmap from dark blue to cyan)
      const ratio = (eoi - minEoi) / (maxEoi - minEoi);
      const hue = 220 - (ratio * 40); // 220 (blue) to 180 (cyan)
      const lightness = 25 + (ratio * 35); // 25% to 60%
      path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;

      path.addEventListener('click', () => selectState(state, path));

      // Tooltip logic
      path.addEventListener('mousemove', (e) => {
        tooltip.style.opacity = '1';
        tooltip.style.left = e.pageX + 15 + 'px';
        tooltip.style.top = e.pageY + 15 + 'px';
        tooltip.innerHTML = `<strong>${state.name}</strong><div style="display:flex; justify-content:space-between; width:120px;"><span>EOI Score:</span> <span style="color:var(--accent-gold); font-weight:bold">${eoi}</span></div><div style="display:flex; justify-content:space-between; width:120px;"><span>GDP Growth:</span> <span>${state.growth}%</span></div>`;
      });

      path.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    }
  });

  // Initialize the chart
  initChart();

  // Initial table render
  renderTable();

  // Select CA by default
  const caState = statesData.find(s => s.id === 'CA');
  const caPath = document.getElementById('CA');
  if (caState && caPath) selectState(caState, caPath);

  // Initialize Trading Terminal
  initTradingTerminal();

  // Initialize Trading Transactions and Revenue Tracker
  renderTransactions();
  renderClearingRevenue();

  // Start multi-state background simulation
  startGlobalBackgroundSimulation();

  // Initialize Ledger
  await ledger.init();
  initLedgerUI();

  // Initialize News Terminal
  initNewsUI();

  // Initialize SGA Calculator
  initCalculatorUI();

  // Initialize SPA Router
  initRouter();
}

function getDailyChangePct(state) {
  // Pseudorandom but stable daily change % based on state GDP growth
  const base = state.growth * 0.12;
  const seed = (state.id.charCodeAt(0) * 17 + state.id.charCodeAt(1) * 23) % 100;
  const variation = (seed / 100) * 0.5 - 0.25;
  const finalChange = base + variation;
  return parseFloat(finalChange.toFixed(2));
}

function selectState(state, element) {
  // Update Map UI
  document.querySelectorAll('.state-path').forEach(p => p.classList.remove('active'));
  element.classList.add('active');

  // Update Details
  const eoi = calculateEOI(state);
  const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);

  // Calculate state's proportion of the $1 Trillion collective market injection
  const stateProportion = eoi / totalNationalEOI;
  const stateInjectionAmount = 1_000_000_000_000 * stateProportion;
  const split = getPayoutSplit(stateInjectionAmount);

  const changePct = getDailyChangePct(state);
  const isUp = changePct >= 0;
  const changeText = isUp ? `+${changePct}%` : `${changePct}%`;
  const changeColor = isUp ? '#10b981' : '#ef4444';
  const arrow = isUp ? '▲' : '▼';

  const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById('selected-state-name').textContent = state.name;
  document.getElementById('eoi-value').textContent = eoi;
  document.getElementById('contract-price').textContent = `$${formattedPrice}`;

  const vol24hEl = document.getElementById('market-24h-vol');
  const avg7dEl = document.getElementById('market-7d-avg');
  const oiEl = document.getElementById('market-oi');
  const outstandingEl = document.getElementById('market-outstanding');

  if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, stateProportion);
  if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, stateProportion);
  if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
  if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);

  const publicPayoutEl = document.getElementById('public-payout');
  if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

  const publicDrawdown = stateInjectionAmount * 0.016;
  const drawdownEl = document.getElementById('public-drawdown-payout');
  if (drawdownEl) {
    drawdownEl.textContent = formatCurrency(publicDrawdown);
  }

  document.getElementById('stat-growth').textContent = `${state.growth}%`;
  document.getElementById('stat-employment').textContent = `${state.employment}%`;
  document.getElementById('stat-inflation').textContent = `${state.inflation}%`;

  // Animate bars slightly
  document.getElementById('market-bar').style.width = '80%';
  document.getElementById('state-bar').style.width = '20%';

  updateStateWealthUI(state);

  // Update Trading Terminal
  currentTradingStateData = state;
  const tradingStateName = document.getElementById('trading-state-name');
  const expiry = getNextExpiry();
  if (tradingStateName) tradingStateName.textContent = `${state.id}-SGA`;
  const tradingPrice = document.getElementById('trading-price');
  if (tradingPrice) tradingPrice.textContent = `$${formattedPrice}`;

  // Update contract specs
  const marginReq = (parseFloat(price) * CONTRACT_SPECS.multiplier * CONTRACT_SPECS.initialMarginPct);
  const specMargin = document.getElementById('spec-margin');
  if (specMargin) specMargin.textContent = formatCurrency(marginReq);
  const specExpiry = document.getElementById('spec-expiry');
  if (specExpiry) specExpiry.textContent = expiry.label;

  // Start live price simulation
  startLivePricing(parseFloat(price));

  // Update Chart with Real-Time Intraday Candlesticks (600 periods of 10-second ticks for deep scrollback history)
  const currentPrice = parseFloat(price);
  const trend = state.growth >= 0 ? 1 : -1;
  const ohlcData = new Array(600);
  let priceCursor = currentPrice;
  const now = new Date();

  // Reset chart scroll and zoom levels when a new state is loaded
  window.chartScrollOffset = 0;
  window.visibleCandlesCount = 45;

  // Generate 600 candles of 10s intervals backwards from the current mark price
  for (let i = 599; i >= 0; i--) {
    const time = new Date(now.getTime() - (599 - i) * 10000);
    const timeStr = formatTime(time);

    const close = parseFloat(priceCursor.toFixed(2));

    // 10-second scale volatility (1 to 5 ticks)
    const tickVol = CONTRACT_SPECS.tickSize * (1 + Math.random() * 4);
    const change = (Math.random() * 2 - 1) * tickVol + (trend * CONTRACT_SPECS.tickSize * 0.4);
    const open = parseFloat((close - change).toFixed(2));

    const high = parseFloat((Math.max(open, close) + Math.random() * CONTRACT_SPECS.tickSize * 2).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * CONTRACT_SPECS.tickSize * 2).toFixed(2));

    ohlcData[i] = { time: timeStr, open, high, low, close };

    // Connect next candle open to current candle's open with a minor tick gap
    priceCursor = open + (Math.random() * 2 - 1) * CONTRACT_SPECS.tickSize;
  }

  if (chartCtx) {
    currentChartData = ohlcData;
    drawChart();
  }
}

// ==========================================
// CUSTOM CANVAS CANDLESTICK CHART
// ==========================================
let chartCanvas = null;
let chartCtx = null;
let currentChartData = [];
let hoveredIndex = -1;
let isDragging = false;
let dragStartX = 0;
let dragStartOffset = 0;

function initChart() {
  const container = document.getElementById('trading-chart');
  chartCanvas = document.createElement('canvas');
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '100%';
  chartCanvas.style.cursor = 'grab'; // Visual cue for panning
  container.innerHTML = '';
  container.appendChild(chartCanvas);
  chartCtx = chartCanvas.getContext('2d');

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    chartCanvas.width = container.clientWidth;
    chartCanvas.height = container.clientHeight;
    drawChart();
  });
  resizeObserver.observe(container);

  // Initial sizing
  chartCanvas.width = container.clientWidth;
  chartCanvas.height = container.clientHeight;

  // Interactivity: Panning & Zooming
  chartCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartOffset = window.chartScrollOffset || 0;
    chartCanvas.style.cursor = 'grabbing';
    hoveredIndex = -1; // Suppress hover guide lines while actively panning
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      chartCanvas.style.cursor = 'grab';
    }
  });

  chartCanvas.addEventListener('mousemove', (e) => {
    const rect = chartCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const padding = { top: 30, right: 50, bottom: 20, left: 10 };
      const chartWidth = chartCanvas.width - padding.left - padding.right;
      const visibleCount = window.visibleCandlesCount || 45;
      const candleSpacing = chartWidth / visibleCount;

      const deltaX = e.clientX - dragStartX;
      const candlesDragged = Math.round(deltaX / candleSpacing);

      let newOffset = dragStartOffset + candlesDragged;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      newOffset = Math.max(0, Math.min(newOffset, maxOffset));

      if (window.chartScrollOffset !== newOffset) {
        window.chartScrollOffset = newOffset;
        drawChart();
      }
    } else {
      handleMouseMove(x, y);
    }
  });

  chartCanvas.addEventListener('mouseleave', () => {
    if (!isDragging) {
      hoveredIndex = -1;
      drawChart();
    }
  });

  // Wheel zoom support
  chartCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.08;
    let visibleCount = window.visibleCandlesCount || 45;

    if (e.deltaY > 0) {
      // Zoom out (show more candlesticks in viewport)
      visibleCount = Math.min(150, Math.round(visibleCount * (1 + zoomIntensity)));
    } else {
      // Zoom in (show fewer candlesticks in viewport)
      visibleCount = Math.max(15, Math.round(visibleCount * (1 - zoomIntensity)));
    }

    window.visibleCandlesCount = visibleCount;

    // Clamp offset inside bounds
    const maxOffset = Math.max(0, currentChartData.length - visibleCount);
    window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));

    drawChart();
  }, { passive: false });

  // Toolbar controls support
  const slider = document.getElementById('chart-timeline-slider');
  const btnPanLeft = document.getElementById('chart-btn-pan-left');
  const btnPanRight = document.getElementById('chart-btn-pan-right');
  const btnZoomIn = document.getElementById('chart-btn-zoom-in');
  const btnZoomOut = document.getElementById('chart-btn-zoom-out');
  const btnLive = document.getElementById('chart-btn-live');

  if (btnPanLeft) {
    btnPanLeft.addEventListener('click', () => {
      const visibleCount = window.visibleCandlesCount || 45;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.min(maxOffset, (window.chartScrollOffset || 0) + 5);
      drawChart();
    });
  }

  if (btnPanRight) {
    btnPanRight.addEventListener('click', () => {
      window.chartScrollOffset = Math.max(0, (window.chartScrollOffset || 0) - 5);
      drawChart();
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      let visibleCount = window.visibleCandlesCount || 45;
      visibleCount = Math.max(15, Math.round(visibleCount * 0.8));
      window.visibleCandlesCount = visibleCount;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));
      drawChart();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      let visibleCount = window.visibleCandlesCount || 45;
      visibleCount = Math.min(150, Math.round(visibleCount * 1.2));
      window.visibleCandlesCount = visibleCount;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      window.chartScrollOffset = Math.max(0, Math.min(window.chartScrollOffset || 0, maxOffset));
      drawChart();
    });
  }

  if (btnLive) {
    btnLive.addEventListener('click', () => {
      window.chartScrollOffset = 0;
      drawChart();
    });
  }

  if (slider) {
    slider.addEventListener('input', () => {
      const visibleCount = window.visibleCandlesCount || 45;
      const maxOffset = Math.max(0, currentChartData.length - visibleCount);
      const sliderVal = parseInt(slider.value);
      window.chartScrollOffset = maxOffset - sliderVal;
      drawChart();
    });
  }
}

function handleMouseMove(x, y) {
  if (currentChartData.length === 0) return;
  const padding = { top: 30, right: 50, bottom: 20, left: 10 };
  const chartWidth = chartCanvas.width - padding.left - padding.right;

  const visibleCount = window.visibleCandlesCount || 45;
  const scrollOffset = window.chartScrollOffset || 0;
  const startIdx = Math.max(0, currentChartData.length - visibleCount - scrollOffset);
  const endIdx = Math.max(0, currentChartData.length - scrollOffset);
  const activeCount = endIdx - startIdx;

  const candleSpacing = chartWidth / activeCount;

  if (x >= padding.left && x <= padding.left + chartWidth) {
    const index = Math.floor((x - padding.left) / candleSpacing);
    if (index >= 0 && index < activeCount) {
      if (hoveredIndex !== index) {
        hoveredIndex = index;
        drawChart();
      }
    }
  } else {
    hoveredIndex = -1;
    drawChart();
  }
}

function drawChart() {
  if (!chartCtx || currentChartData.length === 0) return;

  const width = chartCanvas.width;
  const height = chartCanvas.height;

  const visibleCount = window.visibleCandlesCount || 45;
  const scrollOffset = window.chartScrollOffset || 0;
  const startIdx = Math.max(0, currentChartData.length - visibleCount - scrollOffset);
  const endIdx = Math.max(0, currentChartData.length - scrollOffset);
  const data = currentChartData.slice(startIdx, endIdx);

  chartCtx.clearRect(0, 0, width, height);

  const padding = { top: 30, right: 50, bottom: 20, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get price range of visible candlesticks for dynamic Y-axis auto-scaling
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (let d of data) {
    if (d.low < minPrice) minPrice = d.low;
    if (d.high > maxPrice) maxPrice = d.high;
  }
  const priceRange = maxPrice - minPrice || 0.1;
  minPrice -= priceRange * 0.1;
  maxPrice += priceRange * 0.1;
  const adjustedRange = maxPrice - minPrice;

  // Draw Grid & Axes
  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * (i / 4));
    chartCtx.moveTo(padding.left, y);
    chartCtx.lineTo(padding.left + chartWidth, y);
  }
  chartCtx.stroke();

  // Draw Y-Axis Labels
  chartCtx.fillStyle = '#94a3b8';
  chartCtx.font = '10px Inter, sans-serif';
  chartCtx.textAlign = 'left';
  chartCtx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * (i / 4));
    const price = maxPrice - (adjustedRange * (i / 4));
    chartCtx.fillText(price.toFixed(2), width - padding.right + 8, y);
  }

  // Draw Candlesticks
  const candleSpacing = chartWidth / data.length;
  const candleWidth = Math.max(1, candleSpacing * 0.6);

  data.forEach((d, i) => {
    const xCenter = padding.left + (i * candleSpacing) + (candleSpacing / 2);
    const yHigh = padding.top + chartHeight * (1 - ((d.high - minPrice) / adjustedRange));
    const yLow = padding.top + chartHeight * (1 - ((d.low - minPrice) / adjustedRange));
    const yOpen = padding.top + chartHeight * (1 - ((d.open - minPrice) / adjustedRange));
    const yClose = padding.top + chartHeight * (1 - ((d.close - minPrice) / adjustedRange));

    const isUp = d.close >= d.open;
    const color = isUp ? '#10b981' : '#ef4444';

    // Wick
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 1;
    chartCtx.beginPath();
    chartCtx.moveTo(xCenter, yHigh);
    chartCtx.lineTo(xCenter, yLow);
    chartCtx.stroke();

    // Body
    chartCtx.fillStyle = color;
    const bodyY = isUp ? yClose : yOpen;
    const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
    chartCtx.fillRect(xCenter - candleWidth / 2, bodyY, candleWidth, bodyHeight);
  });

  // Crosshair & Tooltip Hover
  if (hoveredIndex >= 0 && hoveredIndex < data.length) {
    const d = data[hoveredIndex];
    const xCenter = padding.left + (hoveredIndex * candleSpacing) + (candleSpacing / 2);
    const yClose = padding.top + chartHeight * (1 - ((d.close - minPrice) / adjustedRange));

    // Crosshair Lines
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    chartCtx.setLineDash([4, 4]);
    chartCtx.beginPath();
    chartCtx.moveTo(xCenter, padding.top);
    chartCtx.lineTo(xCenter, height - padding.bottom);
    chartCtx.moveTo(padding.left, yClose);
    chartCtx.lineTo(padding.left + chartWidth, yClose);
    chartCtx.stroke();
    chartCtx.setLineDash([]); // Reset

    // OHLC Overlay Box
    chartCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    chartCtx.fillRect(padding.left, 0, chartWidth, 24);
    chartCtx.fillStyle = '#fff';
    chartCtx.textAlign = 'left';
    chartCtx.font = '11px monospace';
    const ohlcText = `Time: ${d.time} | O: ${d.open.toFixed(2)}  H: ${d.high.toFixed(2)}  L: ${d.low.toFixed(2)}  C: ${d.close.toFixed(2)}`;
    chartCtx.fillText(ohlcText, padding.left + 5, 12);

    // Y-Axis Price Highlight
    chartCtx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    chartCtx.fillRect(width - padding.right, yClose - 10, padding.right, 20);
    chartCtx.fillStyle = '#000';
    chartCtx.fillText(d.close.toFixed(2), width - padding.right + 5, yClose);
  }

  // Sync timeline control slider & LIVE button styling on every draw
  const slider = document.getElementById('chart-timeline-slider');
  if (slider) {
    const maxOffset = Math.max(0, currentChartData.length - visibleCount);
    slider.max = maxOffset;
    slider.value = maxOffset - scrollOffset;

    // Visually toggle LIVE button styling based on whether viewport is panned to the present (scrollOffset === 0)
    const btnLive = document.getElementById('chart-btn-live');
    if (btnLive) {
      if (scrollOffset === 0) {
        btnLive.style.background = 'rgba(16, 185, 129, 0.25)';
        btnLive.style.borderColor = '#10b981';
        btnLive.style.color = '#10b981';
        btnLive.title = 'Snap to Real-Time Feed (Active)';
      } else {
        btnLive.style.background = 'rgba(255, 255, 255, 0.05)';
        btnLive.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        btnLive.style.color = 'var(--text-secondary)';
        btnLive.title = 'Snap to Real-Time Feed (Panned to Past)';
      }
    }
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  const sortedStates = [...statesData].sort((a, b) => b.gdp - a.gdp);

  tbody.innerHTML = sortedStates.map(state => {
    const eoi = calculateEOI(state);
    const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
    const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const changePct = getDailyChangePct(state);
    const isUp = changePct >= 0;
    const changeText = isUp ? `+${changePct}%` : `${changePct}%`;
    const changeColor = isUp ? '#10b981' : '#ef4444';
    const arrow = isUp ? '▲' : '▼';

    return `
      <tr class="state-row" data-id="${state.id}">
        <td style="font-weight: 600;">${state.name}</td>
        <td>$${state.gdp}B</td>
        <td style="color: ${state.growth >= 0 ? '#10b981' : '#ef4444'}">${state.growth}%</td>
        <td style="color: #ef4444;">${state.inflation}%</td>
        <td style="color: var(--accent-gold); font-weight: 700;">${eoi}</td>
        <td style="color: var(--accent-blue);">$${formattedPrice}</td>
        <td style="color: ${changeColor}; font-weight: 600; font-family: monospace;">${arrow} ${changeText}</td>
      </tr>
    `;
  }).join('');

  // Make rows clickable to update the map and chart
  const rows = tbody.querySelectorAll('.state-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const stateId = row.getAttribute('data-id');
      const state = statesData.find(s => s.id === stateId);
      const mapPath = document.getElementById(stateId);

      if (state && mapPath) {
        selectState(state, mapPath);
      }
    });
  });
}

// ==========================================
// FUTURES TRADING ENGINE
// ==========================================

function getNextExpiry() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const qMonths = [2, 5, 8, 11];
  let nextQ = qMonths.find(m => m > month);
  let expYear = year;
  if (nextQ === undefined) { nextQ = 2; expYear = year + 1; }
  const labels = { 2: 'MAR', 5: 'JUN', 8: 'SEP', 11: 'DEC' };
  const firstDay = new Date(expYear, nextQ, 1);
  let friday = 1 + ((5 - firstDay.getDay() + 7) % 7);
  friday += 14;
  return { label: `${labels[nextQ]} '${String(expYear).slice(2)}`, date: new Date(expYear, nextQ, friday) };
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function generateOrderBook(price) {
  const bids = [];
  const asks = [];

  // High-fidelity dynamic scaling of LOB sizing: inside levels are thin, deeper levels are thick.
  const levelScales = [
    { sizeMin: 200, sizeMax: 600 },    // Level 1: thin inside spread
    { sizeMin: 500, sizeMax: 1200 },   // Level 2: medium
    { sizeMin: 1200, sizeMax: 2800 },  // Level 3: thick
    { sizeMin: 3000, sizeMax: 6500 }   // Level 4: deep block liquidity
  ];

  const contraction = window.liquidityContraction || 1.0;

  for (let i = 1; i <= 4; i++) {
    const scale = levelScales[i - 1];
    const bidPrice = parseFloat((price - i * CONTRACT_SPECS.tickSize).toFixed(2));
    const askPrice = parseFloat((price + i * CONTRACT_SPECS.tickSize).toFixed(2));

    const bidSize = Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction);
    const askSize = Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction);

    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  orderBook = { bids, asks };
}

function replenishOrderBook() {
  if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    generateOrderBook(currentLivePrice);
    return;
  }

  const bids = [];
  const asks = [];

  const levelScales = [
    { sizeMin: 200, sizeMax: 600 },
    { sizeMin: 500, sizeMax: 1200 },
    { sizeMin: 1200, sizeMax: 2800 },
    { sizeMin: 3000, sizeMax: 6500 }
  ];

  const contraction = window.liquidityContraction || 1.0;

  for (let i = 1; i <= 4; i++) {
    const scale = levelScales[i - 1];
    const bidPrice = parseFloat((currentLivePrice - i * CONTRACT_SPECS.tickSize).toFixed(2));
    const askPrice = parseFloat((currentLivePrice + i * CONTRACT_SPECS.tickSize).toFixed(2));

    const existingBid = orderBook.bids.find(b => Math.abs(b.price - bidPrice) < 0.001);
    const existingAsk = orderBook.asks.find(a => Math.abs(a.price - askPrice) < 0.001);

    let bidSize = existingBid ? existingBid.size : Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction);
    let askSize = existingAsk ? existingAsk.size : Math.floor((scale.sizeMin + Math.random() * (scale.sizeMax - scale.sizeMin)) * contraction);

    // Smooth replenishment: Level 1 replenishes fastest (HFT market makers)
    const replenishRate = 5 - i;
    if (bidSize < scale.sizeMin * contraction) bidSize += Math.floor(Math.random() * 20 + 10) * replenishRate;
    if (askSize < scale.sizeMin * contraction) askSize += Math.floor(Math.random() * 20 + 10) * replenishRate;

    // Cap maximum level sizing to prevent runaway orderbooks
    bidSize = Math.max(scale.sizeMin * contraction, Math.min(bidSize, scale.sizeMax * 1.5 * contraction));
    askSize = Math.max(scale.sizeMin * contraction, Math.min(askSize, scale.sizeMax * 1.5 * contraction));

    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  orderBook = { bids, asks };
}

function renderOrderBook() {
  const asksDiv = document.getElementById('ob-asks');
  const bidsDiv = document.getElementById('ob-bids');
  const lastPriceVal = document.getElementById('ob-last-val');
  const directionArrow = document.getElementById('ob-direction-arrow');
  const spreadVal = document.getElementById('ob-spread-val');
  const tradesList = document.getElementById('live-trades-list');

  if (!asksDiv || !bidsDiv) return;

  const maxBidSize = Math.max(...orderBook.bids.map(b => b.size), 1);
  const maxAskSize = Math.max(...orderBook.asks.map(a => a.size), 1);
  const maxLevelSize = Math.max(maxBidSize, maxAskSize);

  // Render Asks descending from Ask 4 to Ask 1
  const asksHTML = [...orderBook.asks].reverse().map(ask => {
    const depthPct = Math.min(100, (ask.size / maxLevelSize) * 100);
    const notionalM = (ask.price * ask.size * CONTRACT_SPECS.multiplier) / 1e6;
    return `
      <div class="ob-row ask-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #ef4444; position: relative; background: linear-gradient(to left, rgba(239, 68, 68, 0.08) ${depthPct}%, transparent ${depthPct}%); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.01);" onmousedown="document.getElementById('limit-price').value = ${ask.price.toFixed(2)}">
        <span style="font-weight: bold;">$${ask.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span style="text-align: right; color: var(--text-primary);">${ask.size.toLocaleString()}</span>
        <span style="text-align: right; color: var(--text-secondary);">$${notionalM.toFixed(1)}M</span>
      </div>
    `;
  }).join('');
  asksDiv.innerHTML = asksHTML;

  // Render Bids descending from Bid 1 to Bid 4
  const bidsHTML = orderBook.bids.map(bid => {
    const depthPct = Math.min(100, (bid.size / maxLevelSize) * 100);
    const notionalM = (bid.price * bid.size * CONTRACT_SPECS.multiplier) / 1e6;
    return `
      <div class="ob-row bid-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #10b981; position: relative; background: linear-gradient(to left, rgba(16, 185, 129, 0.08) ${depthPct}%, transparent ${depthPct}%); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.01);" onmousedown="document.getElementById('limit-price').value = ${bid.price.toFixed(2)}">
        <span style="font-weight: bold;">$${bid.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span style="text-align: right; color: var(--text-primary);">${bid.size.toLocaleString()}</span>
        <span style="text-align: right; color: var(--text-secondary);">$${notionalM.toFixed(1)}M</span>
      </div>
    `;
  }).join('');
  bidsDiv.innerHTML = bidsHTML;

  // Spread calculations
  const bestBid = orderBook.bids[0]?.price || currentLivePrice;
  const bestAsk = orderBook.asks[0]?.price || currentLivePrice;
  const spread = parseFloat((bestAsk - bestBid).toFixed(2));
  const ticks = Math.round(spread / CONTRACT_SPECS.tickSize);
  if (spreadVal) {
    spreadVal.textContent = `Spread: $${spread.toFixed(2)} (${ticks}T)`;
  }

  // Last traded price display
  if (lastPriceVal) {
    const prevPrice = parseFloat(lastPriceVal.textContent.replace(/[$,]/g, '')) || 0;
    lastPriceVal.textContent = `$${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (currentLivePrice > prevPrice) {
      lastPriceVal.style.color = '#10b981';
      if (directionArrow) { directionArrow.textContent = '▲'; directionArrow.style.color = '#10b981'; }
    } else if (currentLivePrice < prevPrice) {
      lastPriceVal.style.color = '#ef4444';
      if (directionArrow) { directionArrow.textContent = '▼'; directionArrow.style.color = '#ef4444'; }
    }
  }

  // Recent Trade Feed
  if (tradesList && recentTrades.length > 0) {
    tradesList.innerHTML = [...recentTrades].reverse().slice(0, 2).map(trade => {
      const color = trade.side === 'BUY' ? '#10b981' : '#ef4444';
      const labelColor = trade.source === 'USER' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)';
      const sourceLabel = trade.source === 'USER' ? 'YOU' : 'INST';
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="color: var(--text-secondary);">${trade.time}</span>
          <span style="color: ${labelColor}; font-weight: bold; padding: 0 4px; background: rgba(255,255,255,0.05); border-radius: 2px; font-size: 0.55rem;">${sourceLabel}</span>
          <span style="color: ${color}; font-weight: bold;">${trade.side} ${trade.qty.toLocaleString()}</span>
          <span style="font-weight: bold;">$${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      `;
    }).join('');
  }
}

function startLivePricing(basePrice) {
  if (liveTickInterval) clearInterval(liveTickInterval);
  currentLivePrice = basePrice;
  window.continuousPrice = basePrice;
  window.liquidityImbalance = 0;
  window.liquidityContraction = 1.0;

  // Reset pricing variables for the new state contract
  window.tickCounter = 0;
  window.priceMomentum = 0;
  recentTrades = [];

  generateOrderBook(currentLivePrice);
  renderOrderBook();
  updateOrderSummary();

  // High-frequency 250ms tick loop for exceptionally smooth price updates
  liveTickInterval = setInterval(() => {
    const growth = currentTradingStateData ? currentTradingStateData.growth : 0;

    // Decay the liquidity contraction factor back to 1.0 (normal)
    if (window.liquidityContraction && window.liquidityContraction < 1.0) {
      window.liquidityContraction = Math.min(1.0, window.liquidityContraction + 0.04); // Recovers 4% depth per tick (approx 3.75s to recover from 40%)
    }

    // 1. Calculate price movements: drift, momentum, reversion, and liquidity pull
    const secularDrift = (growth / 100) * 0.0012; // Visual-friendly drift factor
    const noise = (Math.random() * 2 - 1) * CONTRACT_SPECS.tickSize * 0.45;
    window.priceMomentum = window.priceMomentum * 0.90 + noise * 0.35;

    const fairPrice = currentTradingStateData ? parseFloat((calculateEOI(currentTradingStateData) * CONTRACT_SPECS.pricingScale).toFixed(2)) : basePrice;
    const meanReversionPull = (fairPrice - currentLivePrice) * 0.002;

    // Scale liquidity imbalance logarithmically to prevent massive order sizes from causing pricing explosion
    const signedImbalance = window.liquidityImbalance || 0;
    const scaledImbalance = Math.sign(signedImbalance) * Math.log1p(Math.abs(signedImbalance)) * 100;
    const imbalancePull = scaledImbalance * 0.00015; // Pull price in the direction of the order flow imbalance

    let move = secularDrift + window.priceMomentum + meanReversionPull + imbalancePull + noise;



    // Smoothly decay the liquidity imbalance over time
    window.liquidityImbalance *= 0.94;

    // 2. High probability of institutional blocks hitting the limit order book (approx 8% chance per 250ms tick)
    if (Math.random() < 0.08) {
      // Trade direction is biased by active liquidity imbalance (order flow momentum)
      const buyBias = 0.50 + Math.max(-0.4, Math.min(0.4, scaledImbalance * 0.0015));
      const isBuy = Math.random() < buyBias;
      const tradeQty = Math.floor(50 + Math.random() * 550);

      if (isBuy) {
        // Walk asks
        let remaining = tradeQty;
        let finalPrice = currentLivePrice;
        for (let ask of orderBook.asks) {
          if (remaining <= 0) break;
          const fill = Math.min(remaining, ask.size);
          ask.size -= fill;
          remaining -= fill;
          finalPrice = ask.price;
        }
        window.continuousPrice = finalPrice;
        currentLivePrice = parseFloat(window.continuousPrice.toFixed(2));
        window.liquidityImbalance += tradeQty * 0.15; // Buy sweeps inject positive imbalance

        if (remaining > 0) {
          const lastAskPrice = orderBook.asks[orderBook.asks.length - 1]?.price || currentLivePrice;
          const penaltyPrice = lastAskPrice + CONTRACT_SPECS.tickSize * 2;
          window.continuousPrice = penaltyPrice;
          currentLivePrice = parseFloat(window.continuousPrice.toFixed(2));
        }
        recentTrades.push({ time: formatTime(new Date()), side: 'BUY', qty: tradeQty, price: currentLivePrice, source: 'INST' });
        if (currentTradingStateData) {
          window.calculateTradeFeeAndRecord('INST', currentTradingStateData.id, 'BUY', tradeQty, currentLivePrice, false, 0);
        }
      } else {
        // Walk bids
        let remaining = tradeQty;
        let finalPrice = currentLivePrice;
        for (let bid of orderBook.bids) {
          if (remaining <= 0) break;
          const fill = Math.min(remaining, bid.size);
          bid.size -= fill;
          remaining -= fill;
          finalPrice = bid.price;
        }
        window.continuousPrice = finalPrice;
        currentLivePrice = parseFloat(window.continuousPrice.toFixed(2));
        window.liquidityImbalance -= tradeQty * 0.15; // Sell sweeps inject negative imbalance

        if (remaining > 0) {
          const lastBidPrice = orderBook.bids[orderBook.bids.length - 1]?.price || currentLivePrice;
          const penaltyPrice = lastBidPrice - CONTRACT_SPECS.tickSize * 2;
          window.continuousPrice = penaltyPrice;
          currentLivePrice = parseFloat(window.continuousPrice.toFixed(2));
        }
        recentTrades.push({ time: formatTime(new Date()), side: 'SELL', qty: tradeQty, price: currentLivePrice, source: 'INST' });
        if (currentTradingStateData) {
          window.calculateTradeFeeAndRecord('INST', currentTradingStateData.id, 'SELL', tradeQty, currentLivePrice, false, 0);
        }
      }
    } else {
      // Direct tick movement via continuous price aggregation
      window.continuousPrice += move;
      currentLivePrice = parseFloat(window.continuousPrice.toFixed(2));
    }

    if (currentLivePrice < 0.01) {
      currentLivePrice = 0.01;
      window.continuousPrice = 0.01;
    }

    // Flashing visual active price in terminal (only when discrete tick changes, preventing visual noise)
    const priceEl = document.getElementById('trading-price');
    if (priceEl) {
      const prevPrice = parseFloat(priceEl.textContent.replace(/[$,]/g, '')) || 0;
      if (currentLivePrice !== prevPrice) {
        priceEl.textContent = `$${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        priceEl.classList.remove('price-flash-up', 'price-flash-down');
        void priceEl.offsetWidth; // Trigger reflow
        priceEl.classList.add(currentLivePrice >= prevPrice ? 'price-flash-up' : 'price-flash-down');
      }
    }

    // 3. Replenish depth and redraw order book
    replenishOrderBook();
    renderOrderBook();

    // 4. Mutate the active candlestick in real-time
    if (currentChartData.length > 0) {
      const activeCandle = currentChartData[currentChartData.length - 1];
      activeCandle.close = currentLivePrice;
      if (currentLivePrice > activeCandle.high) activeCandle.high = currentLivePrice;
      if (currentLivePrice < activeCandle.low) activeCandle.low = currentLivePrice;

      // 5. Scroll candlesticks every 40 ticks (10 seconds at 250ms interval)
      window.tickCounter++;
      if (window.tickCounter >= 40) {
        window.tickCounter = 0;
        const newTime = formatTime(new Date());

        currentChartData.push({
          time: newTime,
          open: currentLivePrice,
          high: currentLivePrice,
          low: currentLivePrice,
          close: currentLivePrice
        });

        // If the user is panned back in history, lock their viewport to the same historical time
        if (window.chartScrollOffset > 0) {
          window.chartScrollOffset++;
        }

        // Limit history to 1000 candles to prevent memory leakage while allowing rich scrollbacks
        if (currentChartData.length > 1000) {
          currentChartData.shift();
          if (window.chartScrollOffset > 0) {
            window.chartScrollOffset--;
          }
        }
      }

      drawChart();
    }

    updateOrderSummary();
    renderPositions();
  }, 250);
}

function startGlobalBackgroundSimulation() {
  if (backgroundSimInterval) clearInterval(backgroundSimInterval);

  backgroundSimInterval = setInterval(() => {
    // Pick a random state from the 50 states
    const randomState = statesData[Math.floor(Math.random() * statesData.length)];

    // Skip if it is the currently active selected state (it has its own high-frequency order book loop)
    if (currentTradingStateData && randomState.id === currentTradingStateData.id) {
      return;
    }

    // Pick a random side and quantity
    const side = Math.random() < 0.52 ? 'BUY' : 'SELL'; // Slight bullish bias matching general GDP drift
    const qty = Math.floor(50 + Math.random() * 550);

    // Calculate a realistic price with slight intraday variance
    const eoi = calculateEOI(randomState);
    const basePrice = eoi * CONTRACT_SPECS.pricingScale;
    const tickVariance = (Math.random() * 8 - 4) * CONTRACT_SPECS.tickSize; // ±4 ticks variance
    const price = parseFloat(Math.max(0.01, basePrice + tickVariance).toFixed(2));

    // Calculate and record clearing fee
    window.calculateTradeFeeAndRecord('INST', randomState.id, side, qty, price, false, 0);
  }, 1200); // Ticks every 1.2 seconds for an exceptionally active, alive transaction ledger
}

function updateStateWealthUI(state) {
  if (!state) return;
  const lockedValue = state.lockedValue || 0;
  const treasuryCash = state.sovereignFund || 0;
  const availableDrawdown = Math.min((state.investment || 0) * 0.016 * 1000000, lockedValue);
  const totalVolume = state.totalVolume || 0;

  const poolEl = document.getElementById('stat-sovereign-wealth-pool');
  const cashEl = document.getElementById('stat-treasury-cash');
  const reinvestEl = document.getElementById('stat-monthly-reinvestment');
  const volEl = document.getElementById('stat-accumulated-volume');
  const investEl = document.getElementById('stat-investment-inflow-index');

  if (poolEl) poolEl.textContent = `$${lockedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (cashEl) cashEl.textContent = `$${treasuryCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (reinvestEl) reinvestEl.textContent = `$${availableDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (volEl) volEl.textContent = `${totalVolume.toLocaleString()} contracts`;
  if (investEl) investEl.textContent = `${(state.investment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateStateMapColor(state) {
  if (!state) return;
  const path = document.getElementById(state.id);
  if (!path) return;

  const currentEOI = calculateEOI(state);
  const eois = statesData.map(s => calculateEOI(s));
  const minEoi = Math.min(...eois);
  const maxEoi = Math.max(...eois);

  const ratio = (currentEOI - minEoi) / (maxEoi - minEoi || 1);
  const hue = 220 - (ratio * 40);
  const lightness = 25 + (ratio * 35);
  path.style.fill = `hsl(${hue}, 80%, ${lightness}%)`;
}

window.triggerSovereignDrawdown = () => {
  if (!currentTradingStateData) return;
  const state = statesData.find(s => s.id === currentTradingStateData.id);
  if (!state) return;

  // Verify the state's investment index is positive
  if (state.investment <= 0) return;

  // Draw down 1.6% of the state's economic index (the 100% pool)
  const desiredIndexDeduction = parseFloat((state.investment * 0.016).toFixed(2));
  if (desiredIndexDeduction <= 0.01) {
    showNewsFlashAlert({
      id: Date.now(),
      stateId: state.id,
      sentiment: "Neutral",
      impactScore: 0,
      title: "Drawdown Limit Reached",
      description: `Sovereign index pool for ${state.name} is too low to execute a 1.6% yield drawdown.`
    });
    return;
  }

  // Calculate desired payout and cap by currently locked value
  const desiredPayout = desiredIndexDeduction * 1000000;
  const payoutDollars = Math.min(desiredPayout, state.lockedValue || 0);

  if (payoutDollars <= 0) {
    showNewsFlashAlert({
      id: Date.now(),
      stateId: state.id,
      sentiment: "Neutral",
      impactScore: 0,
      title: "No Locked Value Available",
      description: `Sovereign wealth pool for ${state.name} has no locked value available for drawdown. Execute trades to lock value first.`
    });
    return;
  }

  // Calculate actual index deduction matching the capped payout dollars
  const actualIndexDeduction = parseFloat((payoutDollars / 1000000).toFixed(2));
  if (actualIndexDeduction <= 0.01) {
    showNewsFlashAlert({
      id: Date.now(),
      stateId: state.id,
      sentiment: "Neutral",
      impactScore: 0,
      title: "Insufficient Locked Value",
      description: `Sovereign wealth pool for ${state.name} has insufficient locked value ($${(state.lockedValue || 0).toLocaleString()}) to execute a drawdown.`
    });
    return;
  }

  const previousInvestment = state.investment;
  state.investment = parseFloat((state.investment - actualIndexDeduction).toFixed(2));

  // Subtract the payout from the locked value pool and transfer to treasury cash
  state.lockedValue = parseFloat((state.lockedValue - payoutDollars).toFixed(2));
  state.sovereignFund = (state.sovereignFund || 0) + payoutDollars;

  // Calculate ex-dividend price drop based on EOI shift
  const prevEOI = calculateEOI({ ...state, investment: previousInvestment });
  const eoi = calculateEOI(state);
  const priceDrop = parseFloat(((prevEOI - eoi) * CONTRACT_SPECS.pricingScale).toFixed(2));

  // If this is the active trading contract, trigger real-time ex-dividend price drop and liquidity drain
  if (currentTradingStateData && state.id === currentTradingStateData.id) {
    currentLivePrice = Math.max(0.01, parseFloat((currentLivePrice - priceDrop).toFixed(2)));
    window.continuousPrice = currentLivePrice;

    // Trigger a 60% liquidity contraction (order book sizes fall to 40%) representing market makers backing away
    window.liquidityContraction = 0.40;

    // Instantly regenerate and redraw the book reflecting the ex-dividend adjustment and liquidity drain
    generateOrderBook(currentLivePrice);
    renderOrderBook();
    updateOrderSummary();
  }

  // Recalculate EOI, national EOI sum, and prices
  totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);
  const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
  const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Update UI immediately
  const eoiValEl = document.getElementById('eoi-value');
  const priceEl = document.getElementById('contract-price');
  const growthEl = document.getElementById('stat-growth');
  const empEl = document.getElementById('stat-employment');
  const infEl = document.getElementById('stat-inflation');

  if (eoiValEl) eoiValEl.textContent = eoi;
  if (priceEl) priceEl.textContent = `$${formattedPrice}`;
  if (growthEl) growthEl.textContent = `${state.growth}%`;
  if (empEl) empEl.textContent = `${state.employment}%`;
  if (infEl) infEl.textContent = `${state.inflation}%`;

  // Update Payout Simulation details based on new national proportions
  const stateProportion = eoi / totalNationalEOI;
  const stateInjectionAmount = 1_000_000_000_000 * stateProportion;
  const split = getPayoutSplit(stateInjectionAmount);

  const vol24hEl = document.getElementById('market-24h-vol');
  const avg7dEl = document.getElementById('market-7d-avg');
  const oiEl = document.getElementById('market-oi');
  const outstandingEl = document.getElementById('market-outstanding');

  if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, stateProportion);
  if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, stateProportion);
  if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
  if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);

  const publicPayoutEl = document.getElementById('public-payout');
  if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

  const publicDrawdown = stateInjectionAmount * 0.016;
  const drawdownEl = document.getElementById('public-drawdown-payout');
  if (drawdownEl) {
    drawdownEl.textContent = formatCurrency(publicDrawdown);
  }

  // Refresh rankings table, sidebar details, and map color
  renderTable();
  updateStateWealthUI(state);
  updateStateMapColor(state);

  // Record this public infrastructure payout in the ledger
  ledger.addRecord({
    category: 'Infrastructure',
    amount: payoutDollars,
    agency: 'State Treasury Dept',
    region: state.id,
    description: `Drawdown 1.6% Sovereign Yield: Paid $${payoutDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })} cash to Treasury from locked value. Investment Inflow index adjusted ex-dividend: ${previousInvestment} -> ${state.investment}`
  }).then(() => {
    initLedgerUI();
  });

  // Spawn a live economic news flash alert
  const newsStory = {
    id: Date.now(),
    stateId: state.id,
    sentiment: "Bullish",
    impactScore: -16, // Simulates immediate market ex-dividend downward pressure
    title: `SGA Yield Drawdown: ${state.name}`,
    description: `State Treasury department successfully drew down 1.6% of the sovereign index pool, transferring $${payoutDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })} cash from locked reserves into public treasury. Contract price adjusted ex-dividend.`
  };

  // Push to news list
  newsData.unshift(newsStory);
  if (newsData.length > 100) {
    newsData.pop();
  }
  const badgeEl = document.getElementById('header-news-count');
  if (badgeEl) {
    badgeEl.textContent = String(newsData.length);
  }

  showNewsFlashAlert(newsStory);

  // Inject a minor downward price shock to active state pricing loop to reflect the ex-dividend drop
  window.priceMomentum = (window.priceMomentum || 0) - CONTRACT_SPECS.tickSize * 4;

  // 🔒 Activate 5-minute short-selling restriction after drawdown yield
  const DRAWDOWN_SHORT_RESTRICTION_MS = 5 * 60 * 1000; // 5 minutes
  drawdownCooldownExpiry = Date.now() + DRAWDOWN_SHORT_RESTRICTION_MS;

  // Update SELL button visual to indicate cooldown is active
  updateShortRestrictionUI();

  // Notify the trader about the short restriction
  showTradeNotification(
    `⚡ DRAWDOWN COMPLETE — 🔒 SHORT POSITIONS RESTRICTED FOR 5 MIN. Only LONG positions allowed during post-drawdown stabilization period.`,
    'buy'
  );
}

// Updates the SELL/SHORT button visual state based on whether the drawdown cooldown is active
function updateShortRestrictionUI() {
  const sellBtn = document.querySelector('.sell-btn');
  if (!sellBtn) return;

  const now = Date.now();
  const isRestricted = now < drawdownCooldownExpiry;

  if (isRestricted) {
    const remainingSec = Math.ceil((drawdownCooldownExpiry - now) / 1000);
    const remainingMin = Math.floor(remainingSec / 60);
    const remainingSecDisplay = remainingSec % 60;
    sellBtn.style.opacity = '0.45';
    sellBtn.style.cursor = 'not-allowed';
    sellBtn.style.filter = 'grayscale(0.6)';
    sellBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    sellBtn.style.background = 'rgba(239, 68, 68, 0.05)';
    sellBtn.innerHTML = `
      <span style="font-size: 0.55rem; display: block; opacity: 0.8; margin-bottom: 2px; color: #ef4444;">🔒 RESTRICTED</span>
      ${remainingMin}m ${String(remainingSecDisplay).padStart(2,'0')}s
    `;

    // Re-check every second until the cooldown expires
    setTimeout(() => {
      if (Date.now() < drawdownCooldownExpiry) {
        updateShortRestrictionUI();
      } else {
        // Cooldown expired — restore normal state
        sellBtn.style.opacity = '';
        sellBtn.style.cursor = '';
        sellBtn.style.filter = '';
        sellBtn.style.borderColor = '';
        sellBtn.style.background = '';
        sellBtn.innerHTML = `
          <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>
          SELL
        `;
        showTradeNotification('✅ Short-selling restriction lifted. Normal trading resumed.', 'buy');
      }
    }, 1000);
  }
}

function updateOrderSummary() {
  const qtyEl = document.getElementById('order-qty');
  if (!qtyEl) return;
  const qty = parseInt(qtyEl.value.replace(/,/g, '')) || 1;
  const notional = currentLivePrice * CONTRACT_SPECS.multiplier * qty;
  const margin = notional * CONTRACT_SPECS.initialMarginPct;

  const notionalEl = document.getElementById('order-notional');
  const marginEl = document.getElementById('order-margin');
  const feeEl = document.getElementById('order-fee');
  const feeSplitEl = document.getElementById('order-fee-split');
  const fedFeeEl = document.getElementById('order-fed-fee');

  if (notionalEl) notionalEl.textContent = formatCurrency(notional);
  if (marginEl) marginEl.textContent = formatCurrency(margin);

  const fedFee = 0; // Exit-only tax
  if (fedFeeEl) {
    fedFeeEl.textContent = `$0.00 (Exit-Only Tax)`;
  }

  if (feeEl) {
    if (notional < 25000) {
      // FREE TIER under $25,000
      feeEl.textContent = '$0.00 (Free < $25k)';
      feeEl.style.color = '#10b981'; // Green for free
      if (feeSplitEl) feeSplitEl.style.display = 'none';
    } else {
      // CHARGED TIER ($0.50 flat fee per contract)
      const fee = qty * 0.50;
      feeEl.textContent = `$${fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      feeEl.style.color = 'var(--accent-gold)'; // Gold for active fee

      // Calculate splits
      const mmRebate = fee * 0.34;
      const sgaLlc = fee * 0.33;
      const stateYield = fee * 0.33;

      if (feeSplitEl) {
        feeSplitEl.style.display = 'flex';
        document.getElementById('fee-split-mm').textContent = `↳ Rebate to MM (34%): $${mmRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
        document.getElementById('fee-split-llc').textContent = `↳ Royalty to SGA LLC (33%): $${sgaLlc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
        document.getElementById('fee-split-state').textContent = `↳ Sovereign Yield (33%): $${stateYield.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
      }
    }
  }
}

function getMarkPrice(pos) {
  if (currentTradingStateData && pos.stateId === currentTradingStateData.id) {
    return currentLivePrice;
  }
  const sd = statesData.find(s => s.id === pos.stateId);
  return sd ? parseFloat((calculateEOI(sd) * CONTRACT_SPECS.pricingScale).toFixed(2)) : pos.entryPrice;
}

function renderPositions() {
  const tbody = document.getElementById('positions-body');
  const countEl = document.getElementById('position-count');
  const totalPnlEl = document.getElementById('total-pnl');
  const totalMarginEl = document.getElementById('total-margin');
  if (!tbody) return;
  if (positions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No open positions. Place a trade to begin.</td></tr>';
    if (countEl) countEl.textContent = '0';
    if (totalPnlEl) { totalPnlEl.textContent = '$0.00'; totalPnlEl.style.color = 'var(--text-secondary)'; }
    if (totalMarginEl) { totalMarginEl.textContent = '$0.00'; totalMarginEl.style.color = 'var(--text-secondary)'; }
    return;
  }
  let totalPnl = 0;
  let totalMargin = 0;
  tbody.innerHTML = positions.map(pos => {
    const markPrice = getMarkPrice(pos);
    const priceDiff = pos.side === 'LONG' ? (markPrice - pos.entryPrice) : (pos.entryPrice - markPrice);
    const pnlTicks = Math.round(priceDiff / CONTRACT_SPECS.tickSize);
    const pnl = pnlTicks * CONTRACT_SPECS.tickValue * pos.qty;
    const margin = pos.entryPrice * CONTRACT_SPECS.multiplier * pos.qty * CONTRACT_SPECS.initialMarginPct;
    totalPnl += pnl;
    totalMargin += margin;
    const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
    const sideColor = pos.side === 'LONG' ? '#10b981' : '#ef4444';
    return `
      <tr>
        <td style="font-weight: 600;">${pos.stateName}-SGA</td>
        <td><span style="color: ${sideColor}; font-weight: 700;">${pos.side}</span></td>
        <td>${pos.qty.toLocaleString()}</td>
        <td style="font-family: monospace;">$${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family: monospace;">$${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="color: ${pnlColor}; font-weight: 700; font-family: monospace;">${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="color: var(--text-secondary); font-family: monospace;">${formatCurrency(margin)}</td>
        <td><button class="close-pos-btn" onmousedown="closePosition(${pos.id})" title="Close position">✕</button></td>
      </tr>
    `;
  }).join('');
  if (countEl) countEl.textContent = String(positions.length);
  if (totalPnlEl) {
    totalPnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalPnlEl.style.color = totalPnl >= 0 ? '#10b981' : '#ef4444';
  }
  if (totalMarginEl) {
    totalMarginEl.textContent = formatCurrency(totalMargin);
    totalMarginEl.style.color = 'var(--text-primary)';
  }
}

window.calculateTradeFeeAndRecord = (party, stateId, side, qty, price, isClosing, realizedPnl) => {
  const multiplier = CONTRACT_SPECS.multiplier;
  const notional = qty * price * multiplier;

  let lossRebate = 0;
  let isLossMitigated = false;

  // Standard flat fee calculation: $0.50 per contract if notional >= $25k, else $0.00
  let standardFee = notional >= 25000 ? qty * 0.50 : 0;
  let finalFee = standardFee;

  // Apply 90% Loss-Mitigation Fee Rebate (slashed to $0.05 per contract) if user closes at a loss
  if (party === 'USER' && isClosing && realizedPnl < 0 && standardFee > 0) {
    finalFee = qty * 0.05;
    lossRebate = standardFee - finalFee;
    isLossMitigated = true;
  }

  // Calculate Federal Fee (0.25% notional floor with 10% profit cap)
  // Earning less than $1,000 in profit pays no Fed Fee
  let federalFee = 0;
  if (isClosing && realizedPnl >= 1000) {
    const notionalFee = notional * 0.0025; // 0.25% notional floor
    const profitCapFee = realizedPnl * 0.10; // 10% profit cap
    federalFee = Math.min(notionalFee, profitCapFee);
  }

  // Accumulate revenues
  window.clearingRevenue.total += finalFee;
  window.clearingRevenue.mm += finalFee * 0.34;
  window.clearingRevenue.llc += finalFee * 0.33;
  window.clearingRevenue.state += finalFee * 0.33;
  window.clearingRevenue.federal += federalFee;
  window.clearingRevenue.lossRebatesIssued += lossRebate;
  if (finalFee > 0 || federalFee > 0) {
    window.clearingRevenue.totalTradesCount++;
  }

  // Update state-level volume, sovereign value locked (20% of gross trade notional), and real-time investment inflows
  const state = statesData.find(s => s.id === stateId);
  if (state) {
    state.totalVolume = (state.totalVolume || 0) + qty;

    // Directional capital flow: BUY = capital inflow (+), SELL = capital outflow (-)
    const direction = (side === 'BUY') ? 1 : -1;
    state.lockedValue = Math.max(0, (state.lockedValue || 0) + (notional * 0.20 * direction));

    // Real-time investment inflows/outflows from trading volume
    const scale = 0.00000005; // $20 Million of trading volume adds 1.0 point to the Investment Index
    state.investment = parseFloat(Math.max(0, state.investment + (notional * scale * direction)).toFixed(2));

    // Recalculate national EOI sum
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    // If this is the currently selected state, update its details panel in real-time
    if (currentTradingStateData && state.id === currentTradingStateData.id) {
      const eoi = calculateEOI(state);
      const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
      const formattedPrice = parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const eoiValEl = document.getElementById('eoi-value');
      const priceEl = document.getElementById('contract-price');
      const growthEl = document.getElementById('stat-growth');
      const empEl = document.getElementById('stat-employment');
      const infEl = document.getElementById('stat-inflation');

      if (eoiValEl) eoiValEl.textContent = eoi;
      if (priceEl) priceEl.textContent = `$${formattedPrice}`;
      if (growthEl) growthEl.textContent = `${state.growth}%`;
      if (empEl) empEl.textContent = `${state.employment}%`;
      if (infEl) infEl.textContent = `${state.inflation}%`;

      // Update Payout Simulation details based on new national proportions
      const stateProportion = eoi / totalNationalEOI;
      const stateInjectionAmount = 1_000_000_000_000 * stateProportion;
      const split = getPayoutSplit(stateInjectionAmount);

      const vol24hEl = document.getElementById('market-24h-vol');
      const avg7dEl = document.getElementById('market-7d-avg');
      const oiEl = document.getElementById('market-oi');
      const outstandingEl = document.getElementById('market-outstanding');

      if (vol24hEl) vol24hEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.vol24h, stateProportion);
      if (avg7dEl) avg7dEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.avg7d, stateProportion);
      if (oiEl) oiEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.oi, stateProportion);
      if (outstandingEl) outstandingEl.innerHTML = formatScaledValue(BASE_MARKET_STATS.outstanding, stateProportion, true);

      const publicPayoutEl = document.getElementById('public-payout');
      if (publicPayoutEl) publicPayoutEl.textContent = formatCurrency(split.state);

      const publicDrawdown = stateInjectionAmount * 0.016;
      const drawdownEl = document.getElementById('public-drawdown-payout');
      if (drawdownEl) {
        drawdownEl.textContent = formatCurrency(publicDrawdown);
      }

      // Update the wealth card details
      updateStateWealthUI(state);
      updateStateMapColor(state);
    }
  }

  // Create transaction log entry
  const tx = {
    timestamp: new Date(),
    stateId: stateId,
    party: party,
    side: side,
    qty: qty,
    price: price,
    notional: notional,
    fee: finalFee,
    fedFee: federalFee,
    standardFee: standardFee,
    lossRebate: lossRebate,
    isLossMitigated: isLossMitigated,
    realizedPnl: realizedPnl,
    isClosing: isClosing
  };

  window.allTransactions.unshift(tx); // Newest first

  // Keep last 100 entries to prevent memory leak
  if (window.allTransactions.length > 100) {
    window.allTransactions.pop();
  }

  // Trigger UI updates
  renderTransactions();
  renderClearingRevenue();
};

window.setTxFilter = (filterType) => {
  window.txFilter = filterType;

  // Update button active states
  const btnAll = document.getElementById('tx-filter-all');
  const btnUser = document.getElementById('tx-filter-user');

  if (btnAll && btnUser) {
    if (filterType === 'all') {
      btnAll.classList.add('active');
      btnAll.style.background = 'rgba(251, 191, 36, 0.15)';
      btnAll.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      btnAll.style.color = 'var(--accent-gold)';

      btnUser.classList.remove('active');
      btnUser.style.background = 'transparent';
      btnUser.style.borderColor = 'transparent';
      btnUser.style.color = 'var(--text-secondary)';
    } else {
      btnUser.classList.add('active');
      btnUser.style.background = 'rgba(251, 191, 36, 0.15)';
      btnUser.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      btnUser.style.color = 'var(--accent-gold)';

      btnAll.classList.remove('active');
      btnAll.style.background = 'transparent';
      btnAll.style.borderColor = 'transparent';
      btnAll.style.color = 'var(--text-secondary)';
    }
  }

  renderTransactions();
};

function renderTransactions() {
  const tbody = document.getElementById('transactions-body');
  if (!tbody) return;

  const filtered = window.allTransactions.filter(tx => {
    if (window.txFilter === 'user') {
      return tx.party === 'USER';
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Awaiting clearing house transactions...</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const formattedTime = formatTime(tx.timestamp);
    const sideColor = tx.side === 'BUY' ? '#10b981' : '#ef4444';

    // Formatting Fee string with Clearing split and Federal fee
    const exchangeFee = tx.fee || 0;
    const fedFee = tx.fedFee || 0;
    const totalFee = exchangeFee + fedFee;

    let exFeeText = '';
    if (exchangeFee === 0) {
      exFeeText = `<span style="color: #10b981;">$0.00 (Free)</span>`;
    } else {
      exFeeText = `$${exchangeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (tx.isLossMitigated) {
        exFeeText += ` <span style="font-size: 0.55rem; color: #ef4444; border: 1px solid rgba(239,68,68,0.2); background: rgba(239,68,68,0.05); padding: 0.05rem 0.2rem; border-radius: 2px; font-weight: bold; margin-left: 2px;">Loss Rebate -50%</span>`;
      }
    }

    const feeStr = `<div style="display: flex; flex-direction: column; font-size: 0.68rem; gap: 0.1rem; line-height: 1.25; text-align: left;">
      <span style="color: var(--accent-gold); font-weight: bold; font-family: monospace;">Total: $${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span style="color: var(--text-secondary); font-size: 0.58rem; font-family: monospace;">Exch: ${exFeeText} | Fed: $${fedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>`;

    const partyColor = tx.party === 'USER' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)';
    const partyLabel = tx.party === 'USER' ? 'YOU' : 'INST';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.01);">
        <td style="color: var(--text-secondary); font-family: monospace; font-size: 0.7rem;">${formattedTime}</td>
        <td style="font-weight: 600;">${tx.stateId}-SGA</td>
        <td><span style="color: ${partyColor}; font-weight: bold; padding: 1px 4px; background: rgba(255,255,255,0.05); border-radius: 2px; font-size: 0.6rem;">${partyLabel}</span></td>
        <td><span style="color: ${sideColor}; font-weight: 700;">${tx.side}</span></td>
        <td>${tx.qty.toLocaleString()}</td>
        <td style="font-family: monospace;">$${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family: monospace; color: var(--text-primary);">${formatCurrency(tx.notional)}</td>
        <td>${feeStr}</td>
      </tr>
    `;
  }).join('');
}

function renderClearingRevenue() {
  const totalEl = document.getElementById('revenue-total');
  const mmEl = document.getElementById('revenue-mm');
  const llcEl = document.getElementById('revenue-llc');
  const stateEl = document.getElementById('revenue-state');
  const federalEl = document.getElementById('revenue-federal');
  const avgEl = document.getElementById('revenue-avg');
  const lossEl = document.getElementById('revenue-loss-rebates');

  const combinedTotal = window.clearingRevenue.total + window.clearingRevenue.federal;
  if (totalEl) totalEl.textContent = `$${combinedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (mmEl) mmEl.textContent = `$${window.clearingRevenue.mm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (llcEl) llcEl.textContent = `$${window.clearingRevenue.llc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (stateEl) stateEl.textContent = `$${window.clearingRevenue.state.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (federalEl) federalEl.textContent = `$${window.clearingRevenue.federal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (lossEl) lossEl.textContent = `$${window.clearingRevenue.lossRebatesIssued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (avgEl) {
    const avg = window.clearingRevenue.totalTradesCount > 0 ? (combinedTotal / window.clearingRevenue.totalTradesCount) : 0;
    avgEl.textContent = `$${avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function renderTradeHistory() {
  const tbody = document.getElementById('trade-history-body');
  const countEl = document.getElementById('history-count');
  const totalPnlEl = document.getElementById('history-total-pnl');
  const totalFeesEl = document.getElementById('history-total-fees');
  const winRateEl = document.getElementById('history-win-rate');
  const totalVolumeEl = document.getElementById('history-total-volume');
  const bestTradeEl = document.getElementById('history-best-trade');
  const worstTradeEl = document.getElementById('history-worst-trade');
  const fedFeesEl = document.getElementById('history-fed-fees');
  const exchFeesEl = document.getElementById('history-exch-fees');

  if (!tbody) return;

  const trades = window.userTradeHistory;
  if (trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2.5rem; font-size: 0.8rem;">No closed trades yet. Open and close a position to see your history.</td></tr>';
    return;
  }

  // Compute summary stats
  let totalPnl = 0, totalFees = 0, totalVolume = 0, totalFedFees = 0, totalExchFees = 0;
  let wins = 0, bestPnl = -Infinity, worstPnl = Infinity;

  trades.forEach(t => {
    totalPnl += t.realizedPnl;
    totalFees += t.totalFee;
    totalVolume += t.notional;
    totalFedFees += t.fedFee;
    totalExchFees += t.exchangeFee;
    if (t.realizedPnl > 0) wins++;
    if (t.realizedPnl > bestPnl) bestPnl = t.realizedPnl;
    if (t.realizedPnl < worstPnl) worstPnl = t.realizedPnl;
  });

  const winRate = ((wins / trades.length) * 100).toFixed(1);

  // Update summary header
  if (countEl) countEl.textContent = trades.length;
  if (totalPnlEl) {
    totalPnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalPnlEl.style.color = totalPnl >= 0 ? '#10b981' : '#ef4444';
  }
  if (totalFeesEl) totalFeesEl.textContent = `$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (winRateEl) {
    winRateEl.textContent = `${winRate}%`;
    winRateEl.style.color = parseFloat(winRate) >= 50 ? '#10b981' : '#ef4444';
  }

  // Update summary cards
  if (totalVolumeEl) totalVolumeEl.textContent = formatCurrency(totalVolume);
  if (bestTradeEl) bestTradeEl.textContent = `+$${bestPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (worstTradeEl) worstTradeEl.textContent = `${worstPnl >= 0 ? '+' : ''}$${worstPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (fedFeesEl) fedFeesEl.textContent = `$${totalFedFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (exchFeesEl) exchFeesEl.textContent = `$${totalExchFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Render table rows
  tbody.innerHTML = trades.map(t => {
    const formattedTime = formatTime(t.timestamp);
    const sideColor = t.side === 'LONG' ? '#10b981' : '#ef4444';
    const pnlColor = t.realizedPnl >= 0 ? '#10b981' : '#ef4444';
    const romPct = (t.returnOnMargin * 100).toFixed(1);
    const romColor = t.returnOnMargin >= 0 ? '#10b981' : '#ef4444';

    // Determine Fed Fee bracket label
    let bracketLabel = '';
    if (t.fedFee === 0) {
      bracketLabel = '<span style="color: #10b981; font-size: 0.5rem;">$0 (No Tax)</span>';
    } else {
      const notionalFee = t.notional * 0.0025;
      const profitCapFee = t.realizedPnl * 0.10;
      if (Math.abs(t.fedFee - profitCapFee) < 0.01) {
        bracketLabel = '<span style="font-size: 0.5rem; color: #f59e0b; font-weight: 600;">10% Profit Cap</span>';
      } else {
        bracketLabel = '<span style="font-size: 0.5rem; color: #38bdf8; font-weight: 600;">0.25% Notional Floor</span>';
      }
    }

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
        <td style="color: var(--text-secondary); font-family: monospace; font-size: 0.7rem; padding: 0.5rem 0.75rem;">${formattedTime}</td>
        <td style="font-weight: 600; padding: 0.5rem 0.75rem;">${t.stateId}-SGA</td>
        <td style="padding: 0.5rem 0.75rem;"><span style="color: ${sideColor}; font-weight: 700;">${t.side}</span></td>
        <td style="padding: 0.5rem 0.75rem;">${t.qty.toLocaleString()}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem;">$${t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem;">$${t.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family: monospace; padding: 0.5rem 0.75rem; color: var(--text-secondary);">${formatCurrency(t.notional)}</td>
        <td style="color: ${pnlColor}; font-weight: 700; font-family: monospace; padding: 0.5rem 0.75rem;">${t.realizedPnl >= 0 ? '+' : ''}$${t.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="color: ${romColor}; font-weight: 600; font-family: monospace; padding: 0.5rem 0.75rem;">${romPct}%</td>
        <td style="padding: 0.5rem 0.75rem;">
          <div style="display: flex; flex-direction: column; font-size: 0.65rem; gap: 0.1rem; line-height: 1.2;">
            <span style="color: var(--accent-gold); font-weight: bold; font-family: monospace;">$${t.totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style="color: var(--text-secondary); font-size: 0.55rem; font-family: monospace;">Ex: $${t.exchangeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Fed: $${t.fedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            ${bracketLabel}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function showTradeNotification(message, type) {
  const existing = document.querySelector('.trade-notification');
  if (existing) existing.remove();
  const notif = document.createElement('div');
  notif.className = `trade-notification trade-notif-${type}`;
  notif.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(notif);
  requestAnimationFrame(() => notif.classList.add('show'));
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 400);
  }, 4000);
}

function initTradingTerminal() {
  const orderType = document.getElementById('order-type');
  const limitField = document.getElementById('limit-price-field');
  if (orderType && limitField) {
    orderType.addEventListener('change', () => {
      limitField.style.display = orderType.value !== 'market' ? 'block' : 'none';
    });
  }
  const qtyInput = document.getElementById('order-qty');
  if (qtyInput) {
    qtyInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = Math.min(999999999, parseInt(cleanVal, 10)).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);

      updateOrderSummary();
    });
  }
  const expiry = getNextExpiry();
  const specExpiry = document.getElementById('spec-expiry');
  if (specExpiry) specExpiry.textContent = expiry.label;
}

window.executeTrade = (type) => {
  if (!currentTradingStateData) {
    showTradeNotification('Select a state contract first.', 'error');
    return;
  }

  // 🔒 Post-drawdown short-selling restriction (5 min lock-out after 1.6% yield drawdown)
  if (type === 'sell') {
    const now = Date.now();
    if (now < drawdownCooldownExpiry) {
      const remainingSec = Math.ceil((drawdownCooldownExpiry - now) / 1000);
      const remainingMin = Math.floor(remainingSec / 60);
      const remainingSecDisplay = remainingSec % 60;
      showTradeNotification(
        `🚫 SHORT RESTRICTED — Post-Drawdown Cooldown Active: ${remainingMin}m ${remainingSecDisplay}s remaining. Only LONG positions allowed after a 1.6% sovereign yield drawdown.`,
        'error'
      );
      return;
    }
  }

  const orderType = document.getElementById('order-type').value;
  const qty = parseInt(document.getElementById('order-qty').value.replace(/,/g, '')) || 1;
  if (qty > 10000000) {
    showTradeNotification('Order quantity exceeds maximum limit of 10,000,000 contracts.', 'error');
    return;
  }
  let fillPrice;
  let slippage = 0;

  if (orderType === 'market') {
    let remaining = qty;
    let totalNotional = 0;

    if (type === 'buy') {
      const originalBestPrice = orderBook.asks[0]?.price || currentLivePrice;

      // Sweeping Asks (Buy fills against Ask orders)
      for (let ask of orderBook.asks) {
        if (remaining <= 0) break;
        const fill = Math.min(remaining, ask.size);
        totalNotional += fill * ask.price * CONTRACT_SPECS.multiplier;
        ask.size -= fill;
        remaining -= fill;
        currentLivePrice = ask.price; // sweep physically impacts price
      }

      // If we completely exhaust LOB asks, fill remaining size with high-slippage penalty
      if (remaining > 0) {
        const lastAskPrice = orderBook.asks[orderBook.asks.length - 1]?.price || currentLivePrice;
        const penaltyPrice = lastAskPrice + CONTRACT_SPECS.tickSize * 2;
        totalNotional += remaining * penaltyPrice * CONTRACT_SPECS.multiplier;
        currentLivePrice = penaltyPrice;
      }

      fillPrice = totalNotional / (qty * CONTRACT_SPECS.multiplier);
      slippage = fillPrice - originalBestPrice;

      // Synchronize continuous price and inject massive positive imbalance for buyer impact
      window.continuousPrice = currentLivePrice;
      window.liquidityImbalance = (window.liquidityImbalance || 0) + qty * 0.4;

      recentTrades.push({
        time: formatTime(new Date()),
        side: 'BUY',
        qty: qty,
        price: fillPrice,
        source: 'USER'
      });

    } else {
      const originalBestPrice = orderBook.bids[0]?.price || currentLivePrice;

      // Sweeping Bids (Sell fills against Bid orders)
      for (let bid of orderBook.bids) {
        if (remaining <= 0) break;
        const fill = Math.min(remaining, bid.size);
        totalNotional += fill * bid.price * CONTRACT_SPECS.multiplier;
        bid.size -= fill;
        remaining -= fill;
        currentLivePrice = bid.price; // sweep physically impacts price
      }

      if (remaining > 0) {
        const lastBidPrice = orderBook.bids[orderBook.bids.length - 1]?.price || currentLivePrice;
        const penaltyPrice = lastBidPrice - CONTRACT_SPECS.tickSize * 2;
        totalNotional += remaining * penaltyPrice * CONTRACT_SPECS.multiplier;
        currentLivePrice = penaltyPrice;
      }

      fillPrice = totalNotional / (qty * CONTRACT_SPECS.multiplier);
      slippage = originalBestPrice - fillPrice;

      // Synchronize continuous price and inject massive negative imbalance for seller impact
      window.continuousPrice = currentLivePrice;
      window.liquidityImbalance = (window.liquidityImbalance || 0) - qty * 0.4;

      recentTrades.push({
        time: formatTime(new Date()),
        side: 'SELL',
        qty: qty,
        price: fillPrice,
        source: 'USER'
      });
    }

    fillPrice = parseFloat(fillPrice.toFixed(2));
    currentLivePrice = parseFloat(currentLivePrice.toFixed(2));
    slippage = Math.max(0, parseFloat(slippage.toFixed(2)));

    // Instantly replenish and redraw the book reflecting user's market sweep
    replenishOrderBook();
    renderOrderBook();

  } else {
    const limitVal = parseFloat(document.getElementById('limit-price').value);
    if (isNaN(limitVal) || limitVal <= 0) {
      showTradeNotification('Enter a valid limit/stop price.', 'error');
      return;
    }
    fillPrice = Math.round(limitVal / CONTRACT_SPECS.tickSize) * CONTRACT_SPECS.tickSize;
    fillPrice = parseFloat(fillPrice.toFixed(2));
  }

  const side = type === 'buy' ? 'LONG' : 'SHORT';
  const notional = fillPrice * CONTRACT_SPECS.multiplier * qty;
  const margin = notional * CONTRACT_SPECS.initialMarginPct;

  // Check for existing same-side position
  const existingIdx = positions.findIndex(p => p.stateId === currentTradingStateData.id && p.side === side);
  if (existingIdx >= 0) {
    const existing = positions[existingIdx];
    const totalQty = existing.qty + qty;
    const avgPrice = ((existing.entryPrice * existing.qty) + (fillPrice * qty)) / totalQty;
    existing.qty = totalQty;
    existing.entryPrice = parseFloat(avgPrice.toFixed(2));

    let msg = `Averaged ${side} ${currentTradingStateData.id}-SGA: +${qty.toLocaleString()} @ $${fillPrice.toFixed(2)} → ${totalQty.toLocaleString()} contracts @ $${existing.entryPrice.toFixed(2)} avg`;
    if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

    showTradeNotification(msg, type === 'buy' ? 'buy' : 'sell');
    window.calculateTradeFeeAndRecord('USER', currentTradingStateData.id, type.toUpperCase(), qty, fillPrice, false, 0);
  } else {
    // Check for opposite position
    const oppositeIdx = positions.findIndex(p => p.stateId === currentTradingStateData.id && p.side !== side);
    if (oppositeIdx >= 0) {
      const opposite = positions[oppositeIdx];
      if (qty >= opposite.qty) {
        const closedQty = opposite.qty;
        const priceDiff = opposite.side === 'LONG' ? (fillPrice - opposite.entryPrice) : (opposite.entryPrice - fillPrice);
        const realizedPnl = Math.round(priceDiff / CONTRACT_SPECS.tickSize) * CONTRACT_SPECS.tickValue * closedQty;
        positions.splice(oppositeIdx, 1);
        const remainingQty = qty - closedQty;

        let msg = `Closed ${closedQty.toLocaleString()} ${opposite.side} ${currentTradingStateData.id}-SGA @ $${fillPrice.toFixed(2)} | P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

        // Fee notification
        const closingNotional = fillPrice * CONTRACT_SPECS.multiplier * closedQty;
        let closingFedFee = 0;
        if (realizedPnl >= 1000) {
          const notionalFee = closingNotional * 0.0025; // 0.25% notional floor
          const profitCapFee = realizedPnl * 0.10; // 10% profit cap
          closingFedFee = Math.min(notionalFee, profitCapFee);
        }
        const standardClosingFee = closingNotional >= 25000 ? closedQty * 0.50 : 0;
        let actualExchangeFee = standardClosingFee;
        if (standardClosingFee > 0 && realizedPnl < 0) {
          actualExchangeFee = closedQty * 0.05;
        }
        const totalClosingFee = actualExchangeFee + closingFedFee;
        msg += ` | Fee: $${totalClosingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Exchange: $${actualExchangeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fed: $${closingFedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;

        window.calculateTradeFeeAndRecord('USER', currentTradingStateData.id, type.toUpperCase(), closedQty, fillPrice, true, realizedPnl);

        // Record to Trade History
        window.userTradeHistory.unshift({
          timestamp: new Date(),
          stateId: currentTradingStateData.id,
          side: opposite.side,
          qty: closedQty,
          entryPrice: opposite.entryPrice,
          exitPrice: fillPrice,
          notional: closingNotional,
          realizedPnl: realizedPnl,
          exchangeFee: actualExchangeFee,
          fedFee: closingFedFee,
          totalFee: totalClosingFee,
          returnOnMargin: realizedPnl / (closingNotional * 0.10)
        });
        renderTradeHistory();

        if (remainingQty > 0) {
          positions.push({ id: positionIdCounter++, stateId: currentTradingStateData.id, stateName: currentTradingStateData.id, side, qty: remainingQty, entryPrice: fillPrice, timestamp: Date.now() });
          msg += ` | Opened ${side} ${remainingQty.toLocaleString()} @ $${fillPrice.toFixed(2)}`;
          window.calculateTradeFeeAndRecord('USER', currentTradingStateData.id, type.toUpperCase(), remainingQty, fillPrice, false, 0);
        }
        showTradeNotification(msg, realizedPnl >= 0 ? 'buy' : 'sell');
      } else {
        const priceDiff = opposite.side === 'LONG' ? (fillPrice - opposite.entryPrice) : (opposite.entryPrice - fillPrice);
        const realizedPnl = Math.round(priceDiff / CONTRACT_SPECS.tickSize) * CONTRACT_SPECS.tickValue * qty;
        opposite.qty -= qty;

        let msg = `Reduced ${opposite.side} ${currentTradingStateData.id}-SGA by ${qty.toLocaleString()} @ $${fillPrice.toFixed(2)} | P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;

        // Fee notification
        const closingNotional = fillPrice * CONTRACT_SPECS.multiplier * qty;
        let closingFedFee = 0;
        if (realizedPnl >= 1000) {
          const notionalFee = closingNotional * 0.0025; // 0.25% notional floor
          const profitCapFee = realizedPnl * 0.10; // 10% profit cap
          closingFedFee = Math.min(notionalFee, profitCapFee);
        }
        const standardClosingFee = closingNotional >= 25000 ? qty * 0.50 : 0;
        let actualExchangeFee = standardClosingFee;
        if (standardClosingFee > 0 && realizedPnl < 0) {
          actualExchangeFee = qty * 0.05;
        }
        const totalClosingFee = actualExchangeFee + closingFedFee;
        msg += ` | Fee: $${totalClosingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Exchange: $${actualExchangeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fed: $${closingFedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;

        window.calculateTradeFeeAndRecord('USER', currentTradingStateData.id, type.toUpperCase(), qty, fillPrice, true, realizedPnl);

        // Record to Trade History
        window.userTradeHistory.unshift({
          timestamp: new Date(),
          stateId: currentTradingStateData.id,
          side: opposite.side,
          qty: qty,
          entryPrice: opposite.entryPrice,
          exitPrice: fillPrice,
          notional: closingNotional,
          realizedPnl: realizedPnl,
          exchangeFee: actualExchangeFee,
          fedFee: closingFedFee,
          totalFee: totalClosingFee,
          returnOnMargin: realizedPnl / (closingNotional * 0.10)
        });
        renderTradeHistory();

        showTradeNotification(msg, realizedPnl >= 0 ? 'buy' : 'sell');
      }
    } else {
      positions.push({ id: positionIdCounter++, stateId: currentTradingStateData.id, stateName: currentTradingStateData.id, side, qty, entryPrice: fillPrice, timestamp: Date.now() });

      const fee = notional >= 25000 ? qty * 0.50 : 0;
      const fedFee = 0; // Exit-only win tax
      const totalFee = fee + fedFee;
      let msg = `${orderType.toUpperCase()} FILL: ${side} ${qty.toLocaleString()} ${currentTradingStateData.id}-SGA @ $${fillPrice.toFixed(2)} | Margin: ${formatCurrency(margin)}`;
      if (orderType === 'market' && slippage > 0) msg += ` (Slippage: $${slippage.toFixed(2)})`;
      msg += ` | Fee: $${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Exchange: $${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fed: $${fedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;

      window.calculateTradeFeeAndRecord('USER', currentTradingStateData.id, type.toUpperCase(), qty, fillPrice, false, 0);

      showTradeNotification(msg, type === 'buy' ? 'buy' : 'sell');
    }
  }
  renderPositions();
};

window.adjustQty = (delta) => {
  const input = document.getElementById('order-qty');
  const cleanVal = parseInt(input.value.replace(/,/g, '')) || 1;
  const val = Math.max(1, Math.min(999999999, cleanVal + delta));
  input.value = val.toLocaleString();
  updateOrderSummary();
};

window.closePosition = (posId) => {
  const idx = positions.findIndex(p => p.id === posId);
  if (idx < 0) return;
  const pos = positions[idx];
  const markPrice = getMarkPrice(pos);
  const priceDiff = pos.side === 'LONG' ? (markPrice - pos.entryPrice) : (pos.entryPrice - markPrice);
  const pnlTicks = Math.round(priceDiff / CONTRACT_SPECS.tickSize);
  const pnl = pnlTicks * CONTRACT_SPECS.tickValue * pos.qty;
  positions.splice(idx, 1);

  const closingSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
  const closingNotional = markPrice * CONTRACT_SPECS.multiplier * pos.qty;
  let closingFedFee = 0;
  if (pnl >= 1000) {
    const notionalFee = closingNotional * 0.0025; // 0.25% notional floor
    const profitCapFee = pnl * 0.10; // 10% profit cap
    closingFedFee = Math.min(notionalFee, profitCapFee);
  }
  const standardClosingFee = closingNotional >= 25000 ? pos.qty * 0.50 : 0;

  let actualExchangeFee = standardClosingFee;
  if (standardClosingFee > 0 && pnl < 0) {
    actualExchangeFee = pos.qty * 0.05;
  }
  const totalClosingFee = actualExchangeFee + closingFedFee;

  let msg = `Closed ${pos.side} ${pos.qty.toLocaleString()} ${pos.stateName}-SGA @ $${markPrice.toFixed(2)} | Realized P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Total Fee: $${totalClosingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Exchange: $${actualExchangeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fed: $${closingFedFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;

  showTradeNotification(msg, pnl >= 0 ? 'buy' : 'sell');

  window.calculateTradeFeeAndRecord('USER', pos.stateId, closingSide, pos.qty, markPrice, true, pnl);

  // Record to Trade History
  window.userTradeHistory.unshift({
    timestamp: new Date(),
    stateId: pos.stateId,
    side: pos.side,
    qty: pos.qty,
    entryPrice: pos.entryPrice,
    exitPrice: markPrice,
    notional: closingNotional,
    realizedPnl: pnl,
    exchangeFee: actualExchangeFee,
    fedFee: closingFedFee,
    totalFee: totalClosingFee,
    returnOnMargin: pnl / (closingNotional * 0.10)
  });
  renderTradeHistory();

  renderPositions();
};

// ==========================================
// LEDGER LOGIC
// ==========================================
// ==========================================
// LEDGER LOGIC
// ==========================================

const CATEGORY_OPTIONS_HTML = TAXONOMY.map(cat => `<option value="${cat}">${cat}</option>`).join('');
const REGION_OPTIONS_HTML = [...statesData]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(state => `<option value="${state.id}">${state.name} (${state.id})</option>`)
  .join('');

function createAllocationItemHTML(index, isRemovable = true) {
  return `
    <div class="allocation-split-item" data-index="${index}">
      <div class="split-item-header">
        <span>Allocation Split #${index + 1}</span>
        ${isRemovable ? `
          <button type="button" class="remove-split-btn" title="Remove Split">
            ✕ Remove
          </button>
        ` : ''}
      </div>
      
      <div class="form-group">
        <label>AMOUNT ($)</label>
        <input type="text" class="alloc-amount" required placeholder="e.g. 5,000,000" inputmode="numeric">
      </div>
      
      <div class="form-group">
        <label>REGION</label>
        <select class="alloc-region" required>
          ${REGION_OPTIONS_HTML}
        </select>
      </div>
      
      <div class="form-group">
        <label>CATEGORY</label>
        <select class="alloc-category" required>
          ${CATEGORY_OPTIONS_HTML}
        </select>
      </div>
      
      <div class="form-group">
        <label>AGENCY</label>
        <input type="text" class="alloc-agency" required placeholder="e.g. Dept of Transportation">
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label>DESCRIPTION</label>
        <textarea class="alloc-description" rows="3" required placeholder="Write a mandatory 1-2 sentence description. And a certain number of characters is required."></textarea>
      </div>
    </div>
  `;
}

function initLedgerUI() {
  // Populate Filter Categories
  const filterCategory = document.getElementById('filter-category');
  TAXONOMY.forEach(cat => {
    filterCategory.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
  });

  // Populate Filter Regions
  const filterRegion = document.getElementById('filter-region');
  const sortedStates = [...statesData].sort((a, b) => a.name.localeCompare(b.name));
  sortedStates.forEach(state => {
    filterRegion.insertAdjacentHTML('beforeend', `<option value="${state.id}">${state.name} (${state.id})</option>`);
  });

  const container = document.getElementById('allocations-container');
  const totalAmountEl = document.getElementById('splits-total-amount');
  let splitIndexCounter = 0;

  // Helper to calculate total dynamic volume on-the-fly
  function updateRealTimeTotal() {
    let sum = 0;
    container.querySelectorAll('.alloc-amount').forEach(input => {
      const val = parseFloat(input.value.replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        sum += val;
      }
    });
    totalAmountEl.textContent = `$${sum.toLocaleString()}`;
  }

  // Appends a new split block
  function appendSplitRow(isRemovable = true) {
    container.insertAdjacentHTML('beforeend', createAllocationItemHTML(splitIndexCounter++, isRemovable));

    const newRow = container.lastElementChild;
    const amountInput = newRow.querySelector('.alloc-amount');

    // Amount changed listener for live total & real-time comma formatting
    amountInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = parseInt(cleanVal, 10).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);

      updateRealTimeTotal();
    });

    // Remove click listener
    if (isRemovable) {
      newRow.querySelector('.remove-split-btn').addEventListener('click', () => {
        newRow.remove();
        updateRealTimeTotal();
        reindexSplits();
      });
    }

    updateRealTimeTotal();
  }

  // Re-numbers splits when intermediate items are deleted
  function reindexSplits() {
    const rows = container.querySelectorAll('.allocation-split-item');
    rows.forEach((row, i) => {
      row.dataset.index = i;
      const headerSpan = row.querySelector('.split-item-header span');
      if (headerSpan) {
        headerSpan.textContent = `Allocation Split #${i + 1}`;
      }
    });
    splitIndexCounter = rows.length;
  }

  // Initial single split row (non-removable)
  appendSplitRow(false);

  // Add split click handler
  document.getElementById('add-split-btn').addEventListener('click', () => {
    appendSplitRow(true);
    container.scrollTop = container.scrollHeight;
  });

  // --- Media URL Management ---
  const mediaContainer = document.getElementById('media-urls-container');
  let mediaRowCounter = 0;

  function appendMediaUrlRow() {
    const rowEl = document.createElement('div');
    rowEl.className = 'media-url-row';
    rowEl.style.cssText = 'display:flex;gap:0.35rem;align-items:center;';
    rowEl.innerHTML = `
      <input type="url" class="media-url-input" placeholder="https://youtube.com/watch?v=... or image/PDF URL"
        style="flex:1;font-size:0.7rem;padding:0.35rem 0.5rem;background:rgba(0,0,0,0.25);border:1px solid var(--glass-border);border-radius:0.3rem;color:#fff;outline:none;min-width:0;">
      <span class="media-type-badge" style="font-size:0.55rem;color:var(--text-secondary);white-space:nowrap;min-width:44px;text-align:center;">URL</span>
      <button type="button" class="remove-media-btn" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;border-radius:0.3rem;padding:0.2rem 0.4rem;font-size:0.6rem;cursor:pointer;flex-shrink:0;">✕</button>
    `;
    const urlInput = rowEl.querySelector('.media-url-input');
    const badge = rowEl.querySelector('.media-type-badge');
    urlInput.addEventListener('input', () => {
      const t = detectMediaType(urlInput.value.trim());
      const labels = { video: '🎥 Video', image: '🖼 Image', pdf: '📄 PDF', link: '🔗 Link' };
      badge.textContent = labels[t] || 'URL';
      badge.style.color = t === 'video' ? '#f59e0b' : t === 'image' ? '#10b981' : t === 'pdf' ? '#38bdf8' : 'var(--text-secondary)';
    });
    rowEl.querySelector('.remove-media-btn').addEventListener('click', () => rowEl.remove());
    mediaContainer.appendChild(rowEl);
    urlInput.focus();
  }

  document.getElementById('add-media-btn').addEventListener('click', appendMediaUrlRow);

  // Form submission
  document.getElementById('ledger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording...';

    // Parse and validate all dynamic split rows
    const allocationElements = container.querySelectorAll('.allocation-split-item');
    const allocations = [];
    let totalAmount = 0;

    let isValid = true;
    let validationError = '';

    for (let i = 0; i < allocationElements.length; i++) {
      const row = allocationElements[i];
      const amountRaw = row.querySelector('.alloc-amount').value.replace(/,/g, '');
      const amount = parseFloat(amountRaw);
      const region = row.querySelector('.alloc-region').value;
      const category = row.querySelector('.alloc-category').value;
      const agency = row.querySelector('.alloc-agency').value;
      const description = row.querySelector('.alloc-description').value.trim();

      if (isNaN(amount) || amount <= 0) {
        isValid = false;
        validationError = `Allocation Split #${i + 1} amount is invalid. Please enter a valid number.`;
        row.querySelector('.alloc-amount').focus();
        break;
      }

      // Mandatory 1-2 sentence description validation:
      // Minimum 30 characters, contains at least one sentence terminator
      const hasPeriod = /[.!?]/.test(description);
      if (description.length === 0) {
        isValid = false;
        validationError = `Allocation Split #${i + 1} description is required. Please write a mandatory 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (description.length < 30) {
        isValid = false;
        validationError = `Split #${i + 1} description is too short (${description.length}/30 characters minimum). Please write a mandatory 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (description.length > 250) {
        isValid = false;
        validationError = `Split #${i + 1} description is too long (${description.length}/250 characters maximum). Please write a concise 1-2 sentence description.`;
        row.querySelector('.alloc-description').focus();
        break;
      } else if (!hasPeriod) {
        isValid = false;
        validationError = `Split #${i + 1} description must contain grammatically complete sentences (ending in a period, question mark, or exclamation mark).`;
        row.querySelector('.alloc-description').focus();
        break;
      }

      totalAmount += amount;
      allocations.push({
        amount,
        region,
        category,
        agency,
        description
      });
    }

    if (!isValid) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record to Ledger';
      showTradeNotification(validationError, 'error');
      return;
    }

    if (allocations.length === 0) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record to Ledger';
      return;
    }

    // Collect media items from URL rows
    const mediaItems = [];
    document.querySelectorAll('#media-urls-container .media-url-input').forEach(input => {
      const url = input.value.trim();
      if (url) mediaItems.push({ url, type: detectMediaType(url) });
    });

    // Collect audit report fields
    const auditFirm = document.getElementById('audit-firm').value.trim();
    const auditDate = document.getElementById('audit-date').value;
    const auditStatus = document.getElementById('audit-status').value;
    const auditReportUrl = document.getElementById('audit-report-url').value.trim();
    const auditNotes = document.getElementById('audit-notes').value.trim();
    const auditReport = (auditFirm || auditStatus || auditReportUrl)
      ? { firm: auditFirm, date: auditDate, status: auditStatus, reportUrl: auditReportUrl, notes: auditNotes }
      : null;

    // Aggregate values for the main table search capability
    let categorySummary = '';
    let regionSummary = '';
    let agencySummary = '';
    let descriptionSummary = '';

    if (allocations.length === 1) {
      categorySummary = allocations[0].category;
      regionSummary = allocations[0].region;
      agencySummary = allocations[0].agency;
      descriptionSummary = allocations[0].description;
    } else {
      const uniqueCats = [...new Set(allocations.map(a => a.category))];
      categorySummary = uniqueCats.length === 1 ? uniqueCats[0] : `Multiple (${uniqueCats.length})`;

      const uniqueRegs = [...new Set(allocations.map(a => a.region))];
      regionSummary = uniqueRegs.length === 1 ? uniqueRegs[0] : 'Multiple';

      const uniqueAgencies = [...new Set(allocations.map(a => a.agency))];
      agencySummary = uniqueAgencies.length === 1 ? uniqueAgencies[0] : `${uniqueAgencies.length} Agencies`;

      descriptionSummary = `Liquidated biweekly. Contains ${allocations.length} splits going to ${uniqueRegs.length} states. Click to view detailed breakdown.`;
    }

    await ledger.addRecord({
      amount: totalAmount,
      agency: agencySummary,
      category: categorySummary,
      region: regionSummary,
      description: descriptionSummary,
      allocations: allocations, // Embedded split allocations array
      mediaItems: mediaItems.length > 0 ? mediaItems : null,
      auditReport: auditReport
    });

    // Reset dynamic splits workspace
    container.innerHTML = '';
    splitIndexCounter = 0;
    appendSplitRow(false);
    updateRealTimeTotal();

    // Reset media rows
    mediaContainer.innerHTML = '';
    mediaRowCounter = 0;

    // Reset audit fields
    document.getElementById('audit-firm').value = '';
    document.getElementById('audit-date').value = '';
    document.getElementById('audit-status').value = '';
    document.getElementById('audit-report-url').value = '';
    document.getElementById('audit-notes').value = '';

    submitBtn.disabled = false;
    submitBtn.textContent = 'Record to Ledger';

    // Green flash UI confirmation feedback
    const originalBg = submitBtn.style.background;
    submitBtn.style.background = '#10b981';
    submitBtn.textContent = 'Recorded!';
    setTimeout(() => {
      submitBtn.style.background = originalBg;
      submitBtn.textContent = 'Record to Ledger';
    }, 2000);

    renderLedger();
  });

  // Filters setup
  const filters = ['filter-category', 'filter-region', 'filter-agency', 'filter-start', 'filter-end'];
  filters.forEach(id => {
    document.getElementById(id).addEventListener('input', renderLedger);
  });

  // Click-to-copy Hash Anchor
  document.getElementById('ledger-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.hash-cell');
    if (!cell) return;

    const hash = cell.dataset.hash;
    if (!hash) return;

    navigator.clipboard.writeText(hash).then(() => {
      const originalText = cell.textContent;
      cell.textContent = 'Copied!';
      cell.classList.add('copied');

      setTimeout(() => {
        cell.textContent = originalText;
        cell.classList.remove('copied');
      }, 1200);
    }).catch(err => {
      console.error('Failed to copy hash: ', err);
    });
  });

  // Click Description to Open Modal
  document.getElementById('ledger-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.desc-cell');
    if (!cell) return;

    const row = cell.closest('tr');
    if (!row) return;

    const hashCell = row.querySelector('.hash-cell');
    if (!hashCell) return;
    const hash = hashCell.dataset.hash;

    const record = ledger.getRecords({}).find(r => r.hash === hash);
    if (!record) return;

    openDetailModal(record);
  });

  // Close Modal Events
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('close-modal-btn');

  if (modal && closeBtn) {
    const closeModal = () => modal.classList.remove('active');

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // Verify
  const verifyBtn = document.getElementById('verify-ledger-btn');
  verifyBtn.addEventListener('click', async () => {
    verifyBtn.textContent = 'Verifying...';
    const isValid = await ledger.verifyIntegrity();
    if (isValid) {
      verifyBtn.style.color = '#10b981';
      verifyBtn.style.borderColor = '#10b981';
      verifyBtn.textContent = 'Verified: Cryptographically Sound';
    } else {
      verifyBtn.style.color = '#ef4444';
      verifyBtn.style.borderColor = '#ef4444';
      verifyBtn.textContent = 'Warning: Tampering Detected!';
    }
    setTimeout(() => {
      verifyBtn.style.color = '';
      verifyBtn.style.borderColor = '';
      verifyBtn.textContent = 'Verify Integrity';
    }, 4000);
  });

  // Reset Ledger
  document.getElementById('reset-ledger-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all entries? This will completely reset the cryptographically secured ledger.')) {
      await ledger.clearAll();
      renderLedger();
    }
  });

  // Initial render
  renderLedger();
}

function renderLedger() {
  const tbody = document.getElementById('ledger-body');

  const filters = {
    category: document.getElementById('filter-category').value,
    region: document.getElementById('filter-region').value,
    agency: document.getElementById('filter-agency').value,
    startDate: document.getElementById('filter-start').value,
    endDate: document.getElementById('filter-end').value,
  };

  const records = ledger.getRecords(filters);

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(record => {
    const date = new Date(record.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const shortHash = record.hash.substring(0, 10) + '...';

    return `
      <tr>
        <td style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap;">${date}</td>
        <td style="font-weight: 600; text-align: center;">${record.region}</td>
        <td><span style="background: rgba(255,255,255,0.08); padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; border: 1px solid var(--glass-border);">${record.category}</span></td>
        <td style="font-size: 0.85rem; font-weight: 500;">${record.agency}</td>
        <td class="desc-cell" title="Click to view details">
          <div class="desc-text-clamp" style="font-size: 0.85rem; color: var(--text-secondary); max-width: 280px; line-height: 1.4;">${record.description || ''}</div>
        </td>
        <td style="color: var(--accent-gold); font-weight: 600; font-family: 'Inter', monospace;">$${record.amount.toLocaleString()}</td>
        <td class="hash-cell" data-hash="${record.hash}" style="font-family: monospace; font-size: 0.8rem; color: var(--accent-blue); text-align: right;" title="Click to copy full hash">${shortHash}</td>
      </tr>
    `;
  }).join('');
}

function detectMediaType(url) {
  if (!url) return '';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return 'video';
  if (u.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) return 'image';
  if (u.match(/\.pdf(\?|$)/)) return 'pdf';
  if (url.length > 0) return 'link';
  return '';
}

function getYouTubeEmbedUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getVimeoEmbedUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function openDetailModal(record) {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-details-content');
  if (!modal || !content) return;

  const date = new Date(record.timestamp).toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  let splitsHTML = '';
  if (record.allocations && record.allocations.length > 1) {
    const cardsHTML = record.allocations.map(alloc => {
      return `
        <div class="modal-split-card">
          <div class="modal-split-card-header">
            <span class="modal-split-card-amount">$${alloc.amount.toLocaleString()}</span>
            <div class="modal-split-badges">
              <span class="modal-split-badge-reg">${alloc.region}</span>
              <span class="modal-split-badge-cat">${alloc.category}</span>
            </div>
          </div>
          <div class="modal-split-card-agency">${alloc.agency}</div>
          <div class="modal-split-card-desc">${alloc.description || 'No description provided.'}</div>
        </div>
      `;
    }).join('');

    splitsHTML = `
      <div class="modal-splits-section">
        <div class="modal-splits-title">Granular Allocation Splits (${record.allocations.length})</div>
        <div class="modal-splits-grid">${cardsHTML}</div>
      </div>
    `;
  }

  // --- Build Media Gallery HTML ---
  let mediaHTML = '';
  if (record.mediaItems && record.mediaItems.length > 0) {
    const itemsHTML = record.mediaItems.map(item => {
      if (item.type === 'video') {
        const embedUrl = getYouTubeEmbedUrl(item.url) || getVimeoEmbedUrl(item.url);
        if (embedUrl) {
          return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;border:1px solid var(--glass-border);background:#000;">
            <iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
          </div>`;
        }
        return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.5rem;color:#f59e0b;text-decoration:none;padding:0.6rem 0.75rem;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:0.4rem;font-size:0.8rem;">🎥 ${item.url} ↗</a>`;
      } else if (item.type === 'image') {
        return `<div style="border-radius:0.5rem;overflow:hidden;border:1px solid var(--glass-border);">
          <img src="${item.url}" alt="Attached image" style="width:100%;max-height:280px;object-fit:cover;display:block;" loading="lazy">
          <div style="padding:0.3rem 0.6rem;font-size:0.6rem;color:var(--text-secondary);background:rgba(0,0,0,0.3);">
            <a href="${item.url}" target="_blank" rel="noopener" style="color:#10b981;">🖼 View Full Image ↗</a>
          </div>
        </div>`;
      } else if (item.type === 'pdf') {
        return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.6rem;color:#38bdf8;text-decoration:none;padding:0.6rem 0.75rem;background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.2);border-radius:0.4rem;font-size:0.8rem;">📄 View PDF Document ↗<span style="font-size:0.6rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${item.url}</span></a>`;
      } else {
        return `<a href="${item.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary);text-decoration:none;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:0.4rem;font-size:0.75rem;">🔗 ${item.url} ↗</a>`;
      }
    }).join('');
    mediaHTML = `
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:0.6rem;color:var(--accent-blue);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.65rem;">📎 Media &amp; Documentation (${record.mediaItems.length})</div>
        <div style="display:flex;flex-direction:column;gap:0.65rem;">${itemsHTML}</div>
      </div>`;
  }

  // --- Build Audit Report HTML ---
  let auditHTML = '';
  if (record.auditReport) {
    const ar = record.auditReport;
    const statusColors = { Passed: '#10b981', Failed: '#ef4444', Qualified: '#f59e0b', Pending: '#38bdf8' };
    const statusIcons = { Passed: '✓ Passed', Failed: '✗ Failed', Qualified: '⚠ Qualified Opinion', Pending: '⏳ Pending Review' };
    const sc = statusColors[ar.status] || 'rgba(255,255,255,0.4)';
    auditHTML = `
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:0.6rem;color:#38bdf8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.65rem;">🔍 Audit Report</div>
        <div style="background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);border-radius:0.5rem;padding:0.85rem;display:flex;flex-direction:column;gap:0.55rem;">
          ${ar.status ? `<div><span style="background:${sc}22;color:${sc};border:1px solid ${sc}55;padding:0.2rem 0.7rem;border-radius:999px;font-size:0.7rem;font-weight:700;">${statusIcons[ar.status] || ar.status}</span></div>` : ''}
          ${ar.firm ? `<div style="font-size:0.78rem;"><span style="color:var(--text-secondary);margin-right:0.35rem;">Auditor:</span><strong>${ar.firm}</strong></div>` : ''}
          ${ar.date ? `<div style="font-size:0.78rem;"><span style="color:var(--text-secondary);margin-right:0.35rem;">Date:</span>${new Date(ar.date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
          ${ar.reportUrl ? `<a href="${ar.reportUrl}" target="_blank" rel="noopener" style="font-size:0.78rem;color:#38bdf8;display:flex;align-items:center;gap:0.35rem;text-decoration:none;">📄 View Full Audit Report ↗</a>` : ''}
          ${ar.notes ? `<div style="font-size:0.75rem;color:var(--text-secondary);border-top:1px dashed rgba(255,255,255,0.06);padding-top:0.5rem;margin-top:0.15rem;line-height:1.55;">${ar.notes}</div>` : ''}
        </div>
      </div>`;
  }

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div class="modal-field">
        <span class="modal-field-label">Date &amp; Time</span>
        <span class="modal-field-value">${date}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Region (State)</span>
        <span class="modal-field-value" style="font-weight: 600;">${record.region}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Category</span>
        <span class="modal-field-value"><span style="background: rgba(255,255,255,0.08); padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; border: 1px solid var(--glass-border);">${record.category}</span></span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Total Allocated Amount</span>
        <span class="modal-field-value" style="color: var(--accent-gold); font-weight: 700; font-size: 1.1rem;">$${record.amount.toLocaleString()}</span>
      </div>
      <div class="modal-field" style="grid-column: span 2;">
        <span class="modal-field-label">Authorized Agency</span>
        <span class="modal-field-value" style="font-weight: 500;">${record.agency}</span>
      </div>
    </div>
    
    <div class="modal-field" style="margin-top: 0.5rem; margin-bottom: 1rem;">
      <span class="modal-field-label">Transaction Summary</span>
      <div class="modal-desc-box">${record.description || 'No description provided.'}</div>
    </div>
    
    ${splitsHTML}
    ${mediaHTML}
    ${auditHTML}
    
    <div class="modal-field" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06);">
      <span class="modal-field-label">Cryptographic Hash Anchor</span>
      <span class="modal-field-value" style="font-family: monospace; font-size: 0.75rem; color: var(--accent-blue); word-break: break-all; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 0.4rem; border: 1px solid var(--glass-border);">${record.hash}</span>
    </div>
  `;

  modal.classList.add('active');
}

// ==========================================
// SGA LIVE NEWS TERMINAL ENGINE
// ==========================================

// ==========================================
// SGA LIVE NEWS TERMINAL ENGINE & SPA ROUTER
// ==========================================

function initNewsUI() {
  // Wire up filter controls on the dedicated news page
  const searchInput = document.getElementById('news-search-main');
  const stateFilter = document.getElementById('news-filter-state-main');
  const sentimentFilter = document.getElementById('news-filter-sentiment-main');
  const impactFilter = document.getElementById('news-filter-impact-main');

  if (stateFilter && stateFilter.options.length <= 1) {
    const sortedStates = [...statesData].sort((a, b) => a.name.localeCompare(b.name));
    sortedStates.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = `${s.name} (${s.id})`;
      stateFilter.appendChild(option);
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderNews);
  if (stateFilter) stateFilter.addEventListener('change', renderNews);
  if (sentimentFilter) sentimentFilter.addEventListener('change', renderNews);
  if (impactFilter) impactFilter.addEventListener('change', renderNews);

  // Update header news count
  const badgeEl = document.getElementById('header-news-count');
  if (badgeEl) {
    badgeEl.textContent = String(newsData.length);
  }

  // Start background news generator loop (generates a live flash alert every 45 seconds)
  if (window.liveNewsInterval) clearInterval(window.liveNewsInterval);
  window.liveNewsInterval = setInterval(generateLiveNews, 45000);
}

async function generateLiveNews() {
  if (!window.postedArticleUrls) {
    window.postedArticleUrls = new Set();
  }

  // 1. Try to fetch live corporate site selection news from Area Development RSS feed
  const rssArticles = await fredService.fetchRealEconomicNews(statesData);
  const newArticles = rssArticles.filter(art => art.matchedState && !window.postedArticleUrls.has(art.link));

  let newStory = null;
  let state = null;
  let path = null;

  if (newArticles.length > 0) {
    // A. We have a fresh corporate catalyst! Use the real-world article
    const article = newArticles[0];
    window.postedArticleUrls.add(article.link);
    state = article.matchedState;
    path = document.getElementById(state.id);

    const prevEOI = calculateEOI(state);

    // Dynamic catalyst pricing: determine positive impact score based on headline triggers
    let impactScore = 15 + Math.floor(Math.random() * 16); // Default +15 to +30
    const lTitle = article.title.toLowerCase();
    if (lTitle.includes("billion") || lTitle.includes("data center") || lTitle.includes("chips") || lTitle.includes("gigafactory") || lTitle.includes("headquarters") || lTitle.includes("expansion")) {
      impactScore = 50 + Math.floor(Math.random() * 36); // Mega-scale (+50 to +85)
    } else if (lTitle.includes("million") || lTitle.includes("grant") || lTitle.includes("funding") || lTitle.includes("subsidy")) {
      impactScore = 30 + Math.floor(Math.random() * 21); // Medium-scale (+30 to +50)
    }

    // Reactively update the state's in-memory variables to simulate capital inflow
    const capexRatio = 1 + (impactScore / 150);
    state.investment = Math.round(state.investment * capexRatio);
    state.business = Math.round(state.business * (1 + (impactScore / 300)));
    state.gdp = Math.round(state.gdp * (1 + (impactScore / 1000)));
    state.growth = parseFloat((state.growth + (impactScore / 100)).toFixed(2));

    const newEOI = calculateEOI(state);
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    newStory = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stateId: state.id,
      title: article.title,
      description: article.description,
      sentiment: "Bullish",
      impactScore,
      link: article.link
    };
  } else {
    // B. Fallback: Query live economic observations from the FRED API
    state = statesData[Math.floor(Math.random() * statesData.length)];
    path = document.getElementById(state.id);
    const prevEOI = calculateEOI(state);

    const updatedMetrics = await fredService.getLiveStateEOI(state);
    Object.assign(state, updatedMetrics);

    const newEOI = calculateEOI(state);
    totalNationalEOI = statesData.reduce((sum, s) => sum + calculateEOI(s), 0);

    newStory = fredService.generateLiveNewsFlash(state, updatedMetrics, prevEOI, newEOI);
  }

  // 2. Update local state map path colors in real-time based on new EOI bounds
  updateStateMapColor(state);

  // 3. Push the new story into newsData array
  newsData.unshift(newStory);
  if (newsData.length > 100) {
    newsData.pop();
  }

  const badgeEl = document.getElementById('header-news-count');
  if (badgeEl) {
    badgeEl.textContent = String(newsData.length);
  }

  showNewsFlashAlert(newStory);

  // 4. Render dynamic economic pricing and charts if this state is currently viewed
  if (currentTradingStateData && state.id === currentTradingStateData.id) {
    const shockMagnitude = (newStory.impactScore / 100) * CONTRACT_SPECS.tickSize * 25;
    window.priceMomentum = (window.priceMomentum || 0) + shockMagnitude;
    window.liquidityImbalance = (window.liquidityImbalance || 0) + (newStory.impactScore * 2.0);
    showTradeNotification(`⚠️ MARKET SHOCK: ${state.id}-SGA price impacted by live news flash! (${newStory.sentiment === "Bullish" ? "+" : ""}${newStory.impactScore} Impact)`, newStory.sentiment === 'Bullish' ? 'buy' : 'sell');

    // Refresh selections to update details panel, margin reqs, expected payouts
    selectState(state, path || document.getElementById(state.id));
  }

  // 5. Re-render the index table and news feed
  renderTable();

  const newsPage = document.getElementById('news-page');
  if (newsPage && !newsPage.classList.contains('hidden')) {
    renderNews();
  }
}

function showNewsFlashAlert(story) {
  const container = document.getElementById('news-flash-container');
  if (!container) return;

  const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');

  container.innerHTML = `
    <div class="news-flash-alert-header">
      <span style="font-weight: 700; font-size: 0.7rem; color: var(--accent-gold); letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
        <span style="display:inline-block; width: 4px; height: 4px; background: var(--accent-gold); border-radius: 50%; animation: pulse 1s infinite;"></span>
        LIVE SGA NEWS FLASH
      </span>
      <button class="news-flash-alert-close">&times;</button>
    </div>
    <div style="display: flex; gap: 0.4rem; align-items: center;">
      <span class="news-badge-reg">${story.stateId}</span>
      <span class="news-badge-sent ${story.sentiment.toLowerCase()}">${story.sentiment}</span>
      <span class="news-badge-impact" style="color: ${sentimentColor}; font-family: monospace;">Impact: ${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
    </div>
    <div style="font-weight: 700; font-size: 0.85rem; color: #fff; line-height: 1.3;">${story.title}</div>
    <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${story.description}</div>
  `;

  container.querySelector('.news-flash-alert-close').onclick = (e) => {
    e.stopPropagation();
    container.classList.remove('show');
  };

  container.onclick = (e) => {
    if (e.target.classList.contains('news-flash-alert-close')) return;
    container.classList.remove('show');
    window.location.hash = `#article-${story.id}`;
  };

  container.classList.add('show');

  if (window.newsFlashTimer) clearTimeout(window.newsFlashTimer);
  window.newsFlashTimer = setTimeout(() => {
    container.classList.remove('show');
  }, 8000);
}

function renderNews() {
  const listEl = document.getElementById('news-feed-main');
  if (!listEl) return;

  const searchInput = document.getElementById('news-search-main');
  const stateFilter = document.getElementById('news-filter-state-main');
  const sentimentFilter = document.getElementById('news-filter-sentiment-main');
  const impactFilter = document.getElementById('news-filter-impact-main');

  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
  const stateVal = stateFilter ? stateFilter.value : 'All';
  const sentimentVal = sentimentFilter ? sentimentFilter.value : 'All';
  const impactVal = impactFilter ? impactFilter.value : 'All';

  // 1. Update Macro Sentiment Monitor
  const bullishCount = newsData.filter(s => s.sentiment === 'Bullish').length;
  const bearishCount = newsData.filter(s => s.sentiment === 'Bearish').length;
  const neutralCount = newsData.filter(s => s.sentiment === 'Neutral').length;
  const totalNews = newsData.length || 1;

  const bullishPct = Math.round((bullishCount / totalNews) * 100);
  const neutralPct = Math.round((neutralCount / totalNews) * 100);
  const bearishPct = 100 - bullishPct - neutralPct; // ensure sums exactly to 100

  const pctBullishEl = document.getElementById('sentiment-bullish-pct');
  if (pctBullishEl) pctBullishEl.textContent = `${bullishPct}%`;

  const barBullishEl = document.getElementById('sentiment-bar-bullish');
  const barNeutralEl = document.getElementById('sentiment-bar-neutral');
  const barBearishEl = document.getElementById('sentiment-bar-bearish');
  if (barBullishEl) barBullishEl.style.width = `${bullishPct}%`;
  if (barNeutralEl) barNeutralEl.style.width = `${neutralPct}%`;
  if (barBearishEl) barBearishEl.style.width = `${Math.max(0, bearishPct)}%`;

  const countBullishEl = document.getElementById('sentiment-count-bullish');
  const countNeutralEl = document.getElementById('sentiment-count-neutral');
  const countBearishEl = document.getElementById('sentiment-count-bearish');
  if (countBullishEl) countBullishEl.textContent = String(bullishCount);
  if (countNeutralEl) countNeutralEl.textContent = String(neutralCount);
  if (countBearishEl) countBearishEl.textContent = String(bearishCount);

  // 2. Update News Last Tick Time
  const lastTickEl = document.getElementById('news-last-tick');
  if (lastTickEl && newsData.length > 0) {
    lastTickEl.innerHTML = `<strong style="color: var(--accent-blue)">${newsData[0].time}</strong>`;
  }

  // 3. Update High Impact Shocks Sidebar
  const highImpactStories = [...newsData]
    .filter(story => Math.abs(story.impactScore) >= 20)
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, 5);

  const shocksListEl = document.getElementById('hot-shocks-list');
  if (shocksListEl) {
    if (highImpactStories.length === 0) {
      shocksListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; padding: 1rem 0;">No high-impact shocks.</div>`;
    } else {
      shocksListEl.innerHTML = highImpactStories.map(story => {
        const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : '#ef4444';
        return `
          <div class="shock-item" data-state="${story.stateId}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 0.5rem 0.75rem; border-radius: 0.4rem; cursor: pointer; transition: background 0.2s;">
            <div style="display: flex; flex-direction: column; gap: 0.15rem; max-width: 75%;">
              <span style="font-size: 0.75rem; font-weight: bold; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${story.title}</span>
              <span style="font-size: 0.6rem; color: var(--text-secondary);">${story.stateId} &middot; ${story.time}</span>
            </div>
            <span style="font-family: monospace; font-size: 0.75rem; font-weight: bold; color: ${sentimentColor};">${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
          </div>
        `;
      }).join('');

      shocksListEl.querySelectorAll('.shock-item').forEach(item => {
        item.addEventListener('click', () => {
          const stateId = item.getAttribute('data-state');
          navigateToTrading(stateId);
        });
      });
    }
  }

  // 4. Update 50-State Sentiment Matrix
  const matrixEl = document.getElementById('state-news-matrix');
  if (matrixEl) {
    matrixEl.innerHTML = statesData.map(state => {
      const latestStory = newsData.find(story => story.stateId === state.id);
      let sentimentClass = 'neutral';
      let dotColor = '#94a3b8';
      if (latestStory) {
        sentimentClass = latestStory.sentiment.toLowerCase();
        dotColor = latestStory.sentiment === 'Bullish' ? '#10b981' : (latestStory.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');
      }

      return `
        <div class="matrix-pill" data-state="${state.id}" title="${state.name}: Latest sentiment is ${latestStory ? latestStory.sentiment : 'Neutral'}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.35rem 0.2rem; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 0.25rem; cursor: pointer; transition: all 0.2s;">
          <span style="font-weight: 700; color: #fff; margin-bottom: 2px;">${state.id}</span>
          <span style="display: inline-block; width: 6px; height: 6px; background: ${dotColor}; border-radius: 50%; box-shadow: 0 0 5px ${dotColor};"></span>
        </div>
      `;
    }).join('');

    matrixEl.querySelectorAll('.matrix-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const stateId = pill.getAttribute('data-state');
        const stateFilterEl = document.getElementById('news-filter-state-main');
        if (stateFilterEl) {
          stateFilterEl.value = stateId;
          renderNews();
        }
      });
      pill.addEventListener('mouseenter', () => {
        pill.style.background = 'rgba(255,255,255,0.08)';
        pill.style.borderColor = 'rgba(255,255,255,0.2)';
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.background = 'rgba(255,255,255,0.02)';
        pill.style.borderColor = 'var(--glass-border)';
      });
    });
  }

  // 5. Filter and Render News Feed
  const filtered = newsData.filter(story => {
    const stateObj = statesData.find(s => s.id === story.stateId);
    const stateName = stateObj ? stateObj.name : 'United States';
    const textMatch =
      story.title.toLowerCase().includes(searchVal) ||
      story.description.toLowerCase().includes(searchVal) ||
      story.stateId.toLowerCase().includes(searchVal) ||
      stateName.toLowerCase().includes(searchVal);

    if (!textMatch) return false;

    if (stateVal !== 'All' && story.stateId !== stateVal) return false;

    if (sentimentVal !== 'All' && story.sentiment !== sentimentVal) return false;

    const absImpact = Math.abs(story.impactScore);
    if (impactVal === 'High' && absImpact <= 50) return false;
    if (impactVal === 'Med' && (absImpact < 20 || absImpact > 50)) return false;
    if (impactVal === 'Low' && absImpact >= 20) return false;

    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 3rem;">No news matches the active intelligence filters.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(story => {
    const sentimentClass = story.sentiment.toLowerCase();
    const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');
    const stateObj = statesData.find(s => s.id === story.stateId);
    const stateName = stateObj ? stateObj.name : 'National Macro';

    return `
      <div class="news-card ${sentimentClass}" data-state="${story.stateId}" data-id="${story.id}">
        <div class="news-card-header">
          <div class="news-card-badges">
            <span class="news-badge-reg">${story.stateId}</span>
            <span class="news-badge-sent ${sentimentClass}">${story.sentiment}</span>
            <span class="news-badge-impact" style="color: ${sentimentColor}; font-family: monospace;">Impact: ${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
          </div>
          <span class="news-card-time">${story.time}</span>
        </div>
        <div class="news-card-title">${story.title}</div>
        <div class="news-card-description">${story.description}</div>
        <div class="news-card-footer">
          <span>Target Contract: ${story.stateId}-SGA (${stateName})</span>
          <span>&middot;</span>
          <span>Click to View Full Catalyst Article</span>
        </div>
      </div>
    `;
  }).join('');

  const cards = listEl.querySelectorAll('.news-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const storyId = card.getAttribute('data-id');
      window.location.hash = `#article-${storyId}`;
    });
  });
}

function navigateToTrading(stateId) {
  if (stateId === 'US') return;
  const state = statesData.find(s => s.id === stateId);
  const mapPath = document.getElementById(stateId);
  if (state && mapPath) {
    window.location.hash = '#table';
    setTimeout(() => {
      selectState(state, mapPath);
      const terminalEl = document.getElementById('table');
      if (terminalEl) {
        terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}

async function fetchFullPressRelease(url) {
  try {
    if (!url) return null;

    // Convert url to proxied url
    let proxiedUrl = url;
    if (url.startsWith('https://www.areadevelopment.com')) {
      proxiedUrl = url.replace('https://www.areadevelopment.com', '/api/areadevelopment');
    } else if (url.startsWith('http://www.areadevelopment.com')) {
      proxiedUrl = url.replace('http://www.areadevelopment.com', '/api/areadevelopment');
    } else if (url.startsWith('/')) {
      proxiedUrl = `/api/areadevelopment${url}`;
    }

    const response = await fetch(proxiedUrl);
    if (!response.ok) return null;

    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Extract the main content using Area Development's unique article selector
    const contentEl = doc.querySelector('section.areaArticleBody') ||
      doc.querySelector('[itemprop="articleBody"]') ||
      doc.querySelector('.story-content') ||
      doc.querySelector('.article-body');

    if (contentEl) {
      // Remove elements that are sidebars, advertisements, or related articles to keep layout clean
      const toRemove = contentEl.querySelectorAll('script, style, iframe, aside, .sidebar, .ads, .advertisement, .related-items');
      toRemove.forEach(el => el.remove());

      // Return the clean HTML content of the article body
      return contentEl.innerHTML.trim();
    }

    return null;
  } catch (error) {
    console.error('Error fetching full press release:', error);
    return null;
  }
}

// ==========================================
// DYNAMIC ARTICLE CONTENT GENERATOR
// ==========================================

function boldImportantMetrics(text) {
  if (!text) return "";
  return text
    .replace(/(\$[\d,.]+\s*(?:million|billion|M|B|trillion))/gi, '<strong>$1</strong>')
    .replace(/(\b\d{1,3}(?:,\d{3})*\s*(?:jobs|new jobs|positions|advanced positions|technical positions))/gi, '<strong>$1</strong>');
}

function generateArticleContent(story) {
  const state = statesData.find(s => s.id === story.stateId) || { name: "National Macro", growth: 1.5, employment: 95.0 };
  const sentiment = story.sentiment;
  const description = story.description;
  const price = parseFloat((calculateEOI(state) * CONTRACT_SPECS.pricingScale).toFixed(2));
  const stateName = state.name;

  let subtitle = "";
  if (sentiment === "Bullish") {
    subtitle = `Sovereign contract values for ${stateName} spike as private capital inflows and infrastructure adjustments push economic output indexes above historic benchmarks.`;
  } else if (sentiment === "Bearish") {
    subtitle = `Supply-side caps and localized logistics hurdles trigger downward pressure on ${stateName} sovereign growth benchmarks.`;
  } else {
    subtitle = `Balanced economic metrics and stable capital yields sustain range-bound volatility within ${stateName} sovereign growth pools.`;
  }

  // Summarize and bold key metrics
  const summary = boldImportantMetrics(description);

  // Generate dynamic Investment Analysis
  const targetVal = sentiment === "Bullish"
    ? (price * (1 + Math.abs(story.impactScore) / 300)).toFixed(2)
    : (sentiment === "Bearish"
      ? (price * (1 - Math.abs(story.impactScore) / 300)).toFixed(2)
      : price.toFixed(2));

  const projectedChange = sentiment === "Bullish"
    ? `+${((parseFloat(targetVal) - price) / price * 100).toFixed(1)}%`
    : (sentiment === "Bearish"
      ? `-${((price - parseFloat(targetVal)) / price * 100).toFixed(1)}%`
      : "0.0%");

  const recommendation = sentiment === "Bullish"
    ? "<span style='color: #10b981; font-weight: bold;'>LONG / BUY</span>"
    : (sentiment === "Bearish"
      ? "<span style='color: #ef4444; font-weight: bold;'>SHORT / SELL</span>"
      : "<span style='color: #94a3b8; font-weight: bold;'>HOLD / NEUTRAL</span>");

  const analysis = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Recommendation</span>
        <span style="font-size: 0.9rem; font-weight: 700;">${recommendation}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Projected Target Price</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-blue); font-family: monospace;">$${targetVal}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Estimated Price Move</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: ${sentiment === 'Bullish' ? '#10b981' : (sentiment === 'Bearish' ? '#ef4444' : '#94a3b8')}; font-family: monospace;">${projectedChange}</span>
      </div>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.65rem 0.75rem; border-radius: 0.4rem;">
        <span style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.05em; font-weight: 700;">Catalyst Weight</span>
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-gold); font-family: monospace;">${story.impactScore > 0 ? '+' : ''}${story.impactScore} Score</span>
      </div>
    </div>
    <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0; margin-bottom: 1rem;">
      <strong>Market Intelligence Brief:</strong> Based on the capital inflow catalyst for <strong>${stateName}</strong>, the regional EOI is projected to experience a ${sentiment === 'Bullish' ? 'positive shock' : (sentiment === 'Bearish' ? 'downward adjustment' : 'stable baseline transition')}. 
      ${sentiment === 'Bullish'
      ? `This expansion represents a structural injection into local ${stateName} business formation and capital asset indices. High-frequency algorithms indicate strong order book demand, suggesting that active long positions will see a significant appreciation ahead of contract settlement.`
      : (sentiment === 'Bearish'
        ? `This disruption is expected to temporarily compress municipal tax receipts and logistics output. High-frequency algorithms suggest near-term downward pressure, making short positions the optimal hedge against regional economic contraction.`
        : `The steady operational balance preserves standard index ranges. Spot price volatility is expected to remain low, offering a highly stable yield-generating vehicle through standard rebalancing distributions.`
      )
    }
    </p>
    <div style="font-size: 0.6rem; color: rgba(255, 255, 255, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.75rem; line-height: 1.4; font-style: italic;">
      <strong>DISCLAIMER:</strong> Sovereign Growth Assets (SGA) EOI projections and recommendation postures are generated by automated quantitative algorithms. This does not constitute licensed financial, investment, legal, or tax advice, nor a solicitation or endorsement to trade real securities.
    </div>
  `;

  return { subtitle, summary, analysis };
}

// ==========================================
// ARTICLE DETAIL SCREEN RENDERER
// ==========================================

function renderArticleDetail(storyId) {
  const container = document.getElementById('article-page');
  if (!container) return;

  const story = newsData.find(s => s.id === parseInt(storyId, 10));
  if (!story) {
    container.innerHTML = `
      <div class="glass-card" style="padding: 3rem; text-align: center;">
        <h3 style="color: var(--accent-gold); margin-bottom: 1.5rem;">Article Not Found</h3>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">The requested catalyst intelligence report could not be located in active memory pools.</p>
        <a href="#news" class="article-back-btn" style="margin-bottom: 0;">◀ Return to News Terminal</a>
      </div>
    `;
    return;
  }

  const state = statesData.find(s => s.id === story.stateId) || { name: "National Macro", growth: 1.5, employment: 95.0 };
  const eoi = calculateEOI(state);
  const price = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
  const sentimentColor = story.sentiment === 'Bullish' ? '#10b981' : (story.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8');

  // Generate Paragraphs
  const { subtitle, summary, analysis } = generateArticleContent(story);

  const hasPressRelease = story.isPrattMiller || !!story.link;
  const isPratt = story.isPrattMiller || (story.title && story.title.includes("Pratt Miller"));

  container.innerHTML = `
    <a href="#news" class="article-back-btn">◀ Return to News Terminal</a>
    
    <div class="article-container">
      <!-- Left Column: Bloomberg Article Card -->
      <div class="article-content-card">
        <div class="article-meta">
          <span>📁 SGA SOVEREIGN FUTURES</span>
          <span>&middot;</span>
          <span>✍️ GLOBAL INTELLIGENCE DESK</span>
          <span>&middot;</span>
          <span>🕒 PUBLISHED ${story.time}</span>
        </div>
        
        ${hasPressRelease ? `
        <div class="article-tabs">
          <button class="art-tab-btn active sga-tab" id="tab-our-btn">SGA Intelligence Report</button>
          <button class="art-tab-btn real-tab" id="tab-real-btn">Official Press Release</button>
        </div>

        <div id="art-sga-content">
          <h1 class="article-headline">${story.title}</h1>
          <div class="article-subtitle">${subtitle}</div>
          
          <div class="article-body">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 2rem; border-radius: 0.6rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="color: var(--accent-gold); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 10px;">
                <span style="display:inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%;"></span>
                Sovereign Intelligence Summary
              </h3>
              <p style="font-size: 1.2rem; line-height: 1.65; color: #fff; margin: 0;">${summary}</p>
            </div>
            
            <div style="border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(56, 189, 248, 0.02); padding: 1.5rem; border-radius: 0.6rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="color: var(--accent-blue); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                <span style="display:inline-block; width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%;"></span>
                Sovereign Investment Analysis
              </h3>
              ${analysis}
            </div>
          </div>
        </div>

        <div id="art-real-content" class="hidden">
          ${isPratt ? `
            <h1 class="article-headline" style="color: #fff; font-size: 2.2rem; line-height: 1.25; margin-bottom: 1.25rem;">Gov. Whitmer Announces Southeast Michigan Business Expansions</h1>
            <div class="article-subtitle" style="border-left-color: var(--accent-gold); color: var(--accent-gold); font-style: italic; line-height: 1.5; margin-bottom: 2rem; padding-left: 0.75rem; border-left: 3px solid var(--accent-gold);">Governor Gretchen Whitmer's office on Monday announced business expansion projects in southeast Michigan creating good-paying jobs, contributing to the growth of Michigan’s economy.</div>
            
            <div class="article-body">
              <p>Governor Gretchen Whitmer's office on Monday announced business expansion projects in southeast Michigan creating good-paying jobs, contributing to the growth of Michigan’s economy.</p>
              <p>They include Pratt Miller Engineering & Fabrication, LLC, a Michigan-based engineering and product development company, with winning roots in motorsports while also serving as global customer base, delivering ingenious solutions to the motor sports, defense, mobility, and innovation industries. Founded in 1989, the company was acquired by Oshkosh Corporation in 2021 with headquarters in New Hudson, and has been experiencing growing customer demand in its motorsports and defense division.</p>
              <p>Pratt Miller is announcing their plans to expand two of their existing facilities to continue the growth of its high technology business in New Hudson. The expansion plans will add an additional 24,000 square feet and create additional engineering and skilled manufacturing jobs over the next three years. The first facility expansion will add another professional sportscar race team and expanded support for existing Corvette GT3 race car customer support business. The second facility expansion will create a specialized and rare secure space to support innovative survivability and lethality solutions for government customers.</p>
              <div class="article-blockquote" style="border-left-color: var(--accent-gold); background: rgba(255,255,255,0.02); padding: 1.25rem; margin: 2rem 0; border-radius: 0.35rem; line-height: 1.6; color: #fff;">
                “Pratt Miller is proud to partner with the Michigan Economic Development Corporation as we continue investing in the future of our business in New Hudson, Michigan. This grant supports our ongoing growth through facility expansion and job creation, while strengthening our ability to deliver advanced innovation and technology across motorsports, mobility, and defense,” said Matt Carroll, Pratt Miller Chief Executive Officer. “For more than three decades, Pratt Miller has built its reputation on solving complex challenges with speed, ingenuity and technical excellence, and we’re excited to continue growing in our home state alongside partners who share our commitment to advancing industry and creating lasting impact.”
              </div>
              <p>The company’s expansion plans are anticipated to result in nearly $3 million in capital investment while creating 50 new jobs in the area. Wages for these new jobs will all be at or greater than the regional media wage plus benefits. Support for these two expansion projects has been provided by the MSF through an MBDP performance-based grant.</p>
              <p>“Pratt Miller’s expansion in New Hudson is a powerful indicator of Oakland County's thriving innovation ecosystem,” said Oakland County Executive David Coulter. “This project reinforces the strength of our local economy and highlights the successful partnership between visionary companies and our community. We are grateful for Pratt Miller’s continued commitment to the region.”</p>
              <p>“The expansion represents a significant commitment to Lyon Township and underscores Pratt Miller’s dedication to expanding its operations while remaining rooted in the community. As part of this investment, more than 50 new high-paying jobs are expected to be created over the next two years, further strengthening the local economy. We are honored that Pratt Miller has chosen to expand at their Lyon Township location,” said Amy Allen, Director of the Downtown Development Authority, Lyon Township. “Their continued growth reflects the strength of our community as a place where innovative businesses can thrive, and we look forward to welcoming new team members as the company continues to expand. Lyon Township values its long-standing partnership with Pratt Miller and looks forward to supporting their continued success for years to come.”</p>
              <p>In addition to MSF support, Lyon Township is offering retention support services, making important connections with the state and local organizations such as Michigan Works! and Advantage Oakland for employment recruitment opportunities and related support services.</p>
            </div>
          ` : `
            <h1 class="article-headline" style="color: #fff; font-size: 2.2rem; line-height: 1.25; margin-bottom: 1.25rem;">${story.title}</h1>
            <div id="rss-press-release-body"></div>
          `}
        </div>
        ` : `
        <h1 class="article-headline">${story.title}</h1>
        <div class="article-subtitle">${subtitle}</div>
        
        <div class="article-body">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 2rem; border-radius: 0.6rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="color: var(--accent-gold); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 10px;">
              <span style="display:inline-block; width: 8px; height: 8px; background: var(--accent-gold); border-radius: 50%;"></span>
              Sovereign Intelligence Summary
            </h3>
            <p style="font-size: 1.2rem; line-height: 1.65; color: #fff; margin: 0;">${summary}</p>
          </div>
          
          <div style="border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(56, 189, 248, 0.02); padding: 1.5rem; border-radius: 0.6rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="color: var(--accent-blue); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
              <span style="display:inline-block; width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%;"></span>
              Sovereign Investment Analysis
            </h3>
            ${analysis}
          </div>
        </div>
        `}
      </div>

      
      <!-- Right Column: Sidebar Spec and Actions -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Catalyst Stats Card -->
        <div class="article-sidebar-card">
          <h4>● Catalyst Analysis</h4>
          <div class="article-spec-row">
            <span class="article-spec-label">Sovereign Target</span>
            <span class="article-spec-value">${state.name} (${story.stateId})</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Sovereign EOI</span>
            <span class="article-spec-value" style="color: var(--accent-gold); font-weight: bold;">${eoi}</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Market Bias</span>
            <span class="article-spec-value" style="color: ${sentimentColor}; font-weight: 700; text-transform: uppercase;">${story.sentiment}</span>
          </div>
          <div class="article-spec-row" style="flex-direction: column; align-items: flex-start; gap: 0.35rem; margin-top: 0.25rem;">
            <div style="display: flex; justify-content: space-between; width: 100%; font-size: 0.8rem;">
              <span class="article-spec-label">Catalyst Impact Score</span>
              <span style="font-family: monospace; font-weight: bold; color: ${sentimentColor};">${story.impactScore > 0 ? '+' : ''}${story.impactScore}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; display: flex;">
              <div style="height: 100%; background: ${sentimentColor}; width: ${Math.min(100, Math.abs(story.impactScore))}%"></div>
            </div>
          </div>
        </div>
        
        <!-- Contract Specs Card -->
        <div class="article-sidebar-card">
          <h4>● Contract Reference</h4>
          <div class="article-spec-row">
            <span class="article-spec-label">Active Contract</span>
            <span class="article-spec-value" style="color: var(--accent-blue);">${story.stateId}-SGA</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Contract Type</span>
            <span class="article-spec-value">Sovereign Growth Futures</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Multiplier</span>
            <span class="article-spec-value">$1,000 / Contract</span>
          </div>
          <div class="article-spec-row">
            <span class="article-spec-label">Mark Price</span>
            <span class="article-spec-value" style="color: var(--accent-blue); font-weight: bold;">$${price}</span>
          </div>
        </div>
        
        <!-- Direct Quick Trade Card -->
        <div class="article-sidebar-card" style="border: 1px solid rgba(251, 191, 36, 0.15); background: rgba(251, 191, 36, 0.02);">
          <h4 style="color: var(--accent-gold); border-bottom-color: rgba(251, 191, 36, 0.15);">● Direct Executive Desk</h4>
          
          <div class="article-trade-input-group">
            <label for="article-qty-input">Qty</label>
            <input type="text" id="article-qty-input" value="1" inputmode="numeric" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 0.4rem; color: #fff; font-weight: 600; text-align: center;">
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <button id="article-buy-btn" class="trade-btn buy-btn" style="padding: 0.65rem 0; font-size: 0.8rem;">
              <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">LONG</span>
              BUY CONTRACTS
            </button>
            <button id="article-sell-btn" class="trade-btn sell-btn" style="padding: 0.65rem 0; font-size: 0.8rem;">
              <span style="font-size: 0.65rem; display: block; opacity: 0.8; margin-bottom: 2px;">SHORT</span>
              SELL CONTRACTS
            </button>
          </div>
          
          <a href="#table" id="article-open-terminal-lnk" style="text-align: center; font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; font-weight: 700; margin-top: 0.25rem; display: block; transition: color 0.2s; cursor: pointer;">
            Open Main Trading Terminal ↗
          </a>
        </div>
        
      </div>
    </div>
  `;

  // Bind tab click listeners if it is the Pratt Miller story
  // Bind tab click listeners if the article has a press release
  if (hasPressRelease) {
    const tabOurBtn = document.getElementById('tab-our-btn');
    const tabRealBtn = document.getElementById('tab-real-btn');
    const sgaContent = document.getElementById('art-sga-content');
    const realContent = document.getElementById('art-real-content');

    if (tabOurBtn && tabRealBtn && sgaContent && realContent) {
      tabOurBtn.onclick = () => {
        tabOurBtn.classList.add('active');
        tabRealBtn.classList.remove('active');
        sgaContent.classList.remove('hidden');
        realContent.classList.add('hidden');
      };

      tabRealBtn.onclick = () => {
        tabRealBtn.classList.add('active');
        tabOurBtn.classList.remove('active');
        realContent.classList.remove('hidden');
        sgaContent.classList.add('hidden');

        // Trigger live fetching if it's an RSS article and not loaded yet
        if (!story.isPrattMiller && story.link && !story.fullPressRelease) {
          const bodyEl = document.getElementById('rss-press-release-body');
          if (bodyEl) {
            bodyEl.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem; color: var(--text-secondary);">
                <div class="press-release-spinner"></div>
                <span style="font-size: 0.9rem; font-weight: 500; letter-spacing: 0.05em; color: var(--accent-gold);">RETRIEVING LIVE OFFICIAL PRESS RELEASE...</span>
                <span style="font-size: 0.75rem; opacity: 0.7; max-width: 320px; text-align: center;">Decrypting official state commerce records and corporate announcements via Area Development network feed...</span>
              </div>
            `;

            fetchFullPressRelease(story.link).then(content => {
              if (content) {
                story.fullPressRelease = content;
                // Double check we are still viewing the same story's tab
                const activeBodyEl = document.getElementById('rss-press-release-body');
                if (activeBodyEl) {
                  activeBodyEl.innerHTML = `
                    <div class="article-body" style="line-height: 1.6; color: #fff;">
                      ${content}
                    </div>
                  `;
                }
              } else {
                const activeBodyEl = document.getElementById('rss-press-release-body');
                if (activeBodyEl) {
                  activeBodyEl.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem; color: var(--text-secondary); text-align: center;">
                      <span style="font-size: 2rem; color: var(--accent-gold);">⚠️</span>
                      <span style="font-size: 0.9rem; font-weight: bold; color: #fff;">OFFICIAL DECREE ENCRYPTION UNRESOLVABLE</span>
                      <p style="font-size: 0.8rem; max-width: 400px; line-height: 1.5; margin: 0;">We were unable to extract the full press release text automatically from the secure portal. You may view the original publication directly via the official network source.</p>
                      <a href="${story.link}" target="_blank" class="trade-btn buy-btn" style="margin-top: 1rem; padding: 0.5rem 1.25rem; font-size: 0.75rem; text-decoration: none; border-radius: 0.25rem; font-weight: 600;">
                        VIEW SOURCE ANNOUNCEMENT ↗
                      </a>
                    </div>
                  `;
                }
              }
            });
          }
        }
      };

      // If we already have the press release cached (or if it's Pratt Miller), populate it immediately
      if (!story.isPrattMiller && story.link && story.fullPressRelease) {
        const bodyEl = document.getElementById('rss-press-release-body');
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div class="article-body" style="line-height: 1.6; color: #fff;">
              ${story.fullPressRelease}
            </div>
          `;
        }
      }
    }
  }

  // Bind click handlers for direct quick trade execution
  const buyBtn = document.getElementById('article-buy-btn');

  const sellBtn = document.getElementById('article-sell-btn');
  const openTerminalLnk = document.getElementById('article-open-terminal-lnk');

  const artQtyInput = document.getElementById('article-qty-input');
  if (artQtyInput) {
    artQtyInput.addEventListener('input', (e) => {
      const input = e.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const originalLength = input.value.length;

      const cleanVal = input.value.replace(/[^\d]/g, '');
      if (cleanVal === '') {
        input.value = '';
      } else {
        input.value = Math.min(999999999, parseInt(cleanVal, 10)).toLocaleString();
      }

      const newLength = input.value.length;
      const lengthDiff = newLength - originalLength;
      input.setSelectionRange(selectionStart + lengthDiff, selectionEnd + lengthDiff);
    });
  }

  const executeQuickTrade = (side) => {
    const qtyInput = document.getElementById('article-qty-input');
    const qty = qtyInput ? parseInt(qtyInput.value.replace(/,/g, ''), 10) || 1 : 1;

    // Set the main trading terminal's active state
    const mapPath = document.getElementById(story.stateId);
    if (state && mapPath) {
      selectState(state, mapPath);
    }

    // Sync quantity inputs
    const mainQtyInput = document.getElementById('order-qty');
    if (mainQtyInput) {
      mainQtyInput.value = qty;
      updateOrderSummary();
    }

    // Execute trade using the core transaction engine
    window.executeTrade(side);

    // Navigate back to the trading terminal dashboard and smooth scroll to chart
    window.location.hash = '#table';
    setTimeout(() => {
      const terminalEl = document.getElementById('table');
      if (terminalEl) {
        terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  if (buyBtn) buyBtn.onclick = () => executeQuickTrade('buy');
  if (sellBtn) sellBtn.onclick = () => executeQuickTrade('sell');

  if (openTerminalLnk) {
    openTerminalLnk.onclick = (e) => {
      e.preventDefault();
      const mapPath = document.getElementById(story.stateId);
      if (state && mapPath) {
        selectState(state, mapPath);
      }
      window.location.hash = '#table';
      setTimeout(() => {
        const terminalEl = document.getElementById('table');
        if (terminalEl) {
          terminalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    };
  }
}

function initCalculatorUI() {
  const container = document.getElementById('calc-variables-container');
  const presetSelect = document.getElementById('calc-state-preset');
  const resetBtn = document.getElementById('calc-reset-btn');

  if (!container) return;

  const variables = [
    { id: 'gdp', label: 'Gross Domestic Product (GDP)', min: 10, max: 4000, step: 10, defVal: 600, defWeight: 0.25, unit: 'B', format: (v) => `$${v.toLocaleString()}B`, normalize: (v) => v / 100 },
    { id: 'growth', label: 'GDP Growth Rate', min: -10, max: 20, step: 0.1, defVal: 2.0, defWeight: 0.10, unit: '%', format: (v) => `${v.toFixed(1)}%`, normalize: (v) => v },
    { id: 'tax', label: 'Tax Revenue', min: 1, max: 400, step: 1, defVal: 40, defWeight: 0.10, unit: 'B', format: (v) => `$${v}B`, normalize: (v) => v / 10 },
    { id: 'employment', label: 'Employment Rate', min: 80, max: 100, step: 0.1, defVal: 95.0, defWeight: 0.15, unit: '%', format: (v) => `${v.toFixed(1)}%`, normalize: (v) => v - 90 },
    { id: 'business', label: 'Business Formation Rate', min: 5, max: 1200, step: 5, defVal: 150, defWeight: 0.10, unit: 'k', format: (v) => `${v.toLocaleString()}k`, normalize: (v) => v / 50 },
    { id: 'investment', label: 'Investment Inflow', min: 1, max: 600, step: 1, defVal: 50, defWeight: 0.15, unit: 'B', format: (v) => `$${v}B`, normalize: (v) => v / 10 },
    { id: 'productivity', label: 'Productivity Rate', min: 10, max: 150, step: 1, defVal: 65, defWeight: 0.15, unit: '', format: (v) => `Score ${v}`, normalize: (v) => v / 10 }
  ];

  // Populate presets
  presetSelect.innerHTML = '<option value="">-- Load State Profile --</option>';
  statesData.sort((x, y) => x.name.localeCompare(y.name)).forEach(state => {
    presetSelect.innerHTML += `<option value="${state.id}">${state.name}</option>`;
  });

  // Render controls
  container.innerHTML = '';
  variables.forEach((v, index) => {
    const char = ['a', 'b', 'c', 'd', 'e', 'f', 'g'][index];
    const row = document.createElement('div');
    row.style.background = 'rgba(255,255,255,0.01)';
    row.style.border = '1px solid rgba(255,255,255,0.03)';
    row.style.borderRadius = '0.5rem';
    row.style.padding = '1rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.75rem';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">${v.label} <span style="font-family: monospace; font-size: 0.75rem; color: var(--accent-blue);">(${char})</span></span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Weight:</label>
          <input type="number" id="calc-weight-${v.id}" class="order-input" style="width: 70px; padding: 0.25rem 0.5rem; text-align: center; font-size: 0.75rem; border-radius: 0.25rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff;" step="0.01" min="0" max="1" value="${v.defWeight}">
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 105px; gap: 1rem; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
          <input type="range" id="calc-slider-${v.id}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.defVal}" style="flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; cursor: pointer; -webkit-appearance: none;">
        </div>
        <div style="display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
          <input type="number" id="calc-val-input-${v.id}" class="order-input" style="width: 75px; padding: 0.35rem 0.5rem; text-align: center; font-family: monospace; font-size: 0.8rem; color: var(--accent-gold); font-weight: 700; border-radius: 0.35rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); outline: none;" step="${v.step}" value="${v.defVal}">
          <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; min-width: 15px; text-align: left;">${v.unit}</span>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // Append Inflation Deflator card
  const inflationRow = document.createElement('div');
  inflationRow.style.background = 'rgba(239, 68, 68, 0.02)';
  inflationRow.style.border = '1px solid rgba(239, 68, 68, 0.1)';
  inflationRow.style.borderRadius = '0.5rem';
  inflationRow.style.padding = '1rem';
  inflationRow.style.display = 'flex';
  inflationRow.style.flexDirection = 'column';
  inflationRow.style.gap = '0.75rem';
  inflationRow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">
        Inflation Rate (CPI) <span style="font-family: monospace; font-size: 0.75rem; color: #ef4444;">(Deflator)</span>
      </span>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span id="calc-inflation-impact" style="font-size: 0.75rem; color: #ef4444; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(239, 68, 68, 0.2);">Penalty: 0.0%</span>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 105px; gap: 1rem; align-items: center;">
      <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
        <input type="range" id="calc-slider-inflation" min="0" max="15" step="0.1" value="2.0" style="flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; cursor: pointer; -webkit-appearance: none;">
      </div>
      <div style="display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
        <input type="number" id="calc-val-input-inflation" class="order-input" style="width: 75px; padding: 0.35rem 0.5rem; text-align: center; font-family: monospace; font-size: 0.8rem; color: #ef4444; font-weight: 700; border-radius: 0.35rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); outline: none;" step="0.1" value="2.0">
        <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; min-width: 15px; text-align: left;">%</span>
      </div>
    </div>
  `;
  container.appendChild(inflationRow);

  // Calculate EOI function
  const calculateSimulatedEOI = () => {
    let eoi = 0;
    let sumOfWeights = 0;
    const contributions = [];

    variables.forEach((v, index) => {
      const valInput = document.getElementById(`calc-val-input-${v.id}`);
      const weightInput = document.getElementById(`calc-weight-${v.id}`);

      const rawVal = parseFloat(valInput.value) || 0;
      const weight = parseFloat(weightInput.value) || 0;

      const normVal = v.normalize(rawVal);
      const contrib = normVal * weight;

      eoi += contrib;
      sumOfWeights += weight;
      contributions.push({ id: v.id, label: v.label, contrib, weight });
    });

    eoi = parseFloat(Math.max(0, eoi).toFixed(2));

    // Inflation Deflator
    const inflationInput = document.getElementById('calc-val-input-inflation');
    const inflationVal = inflationInput ? (parseFloat(inflationInput.value) || 0) : 2.0;
    const TARGET_INFLATION = 2.0;
    const SENSITIVITY = 0.05;
    const penaltyAmount = Math.max(0, inflationVal - TARGET_INFLATION);
    const inflationFactor = Math.max(0, 1 - (SENSITIVITY * penaltyAmount));
    const penaltyPct = ((1 - inflationFactor) * 100).toFixed(1);

    const inflationImpactEl = document.getElementById('calc-inflation-impact');
    if (inflationImpactEl) {
      if (parseFloat(penaltyPct) > 0) {
        inflationImpactEl.innerText = `Penalty: -${penaltyPct}% EOI`;
        inflationImpactEl.style.color = '#ef4444';
        inflationImpactEl.style.background = 'rgba(239, 68, 68, 0.1)';
        inflationImpactEl.style.borderColor = 'rgba(239, 68, 68, 0.2)';
      } else {
        inflationImpactEl.innerText = `Penalty: 0.0%`;
        inflationImpactEl.style.color = '#10b981';
        inflationImpactEl.style.background = 'rgba(16, 185, 129, 0.1)';
        inflationImpactEl.style.borderColor = 'rgba(16, 185, 129, 0.2)';
      }
    }

    eoi = eoi * inflationFactor;
    eoi = parseFloat(Math.max(0, eoi).toFixed(2));

    // Update Result Score
    const scoreEl = document.getElementById('calc-result-score');
    const ratingEl = document.getElementById('calc-result-rating');
    scoreEl.innerText = eoi.toFixed(2);

    // Update rating thresholds
    let rating = 'Weak';
    let ratingColor = '#ef4444';
    let ratingBg = 'rgba(239, 68, 68, 0.1)';
    let ratingBorder = 'rgba(239, 68, 68, 0.2)';

    if (eoi >= 20.0) {
      rating = 'Exceptional';
      ratingColor = '#06b6d4';
      ratingBg = 'rgba(6, 182, 212, 0.1)';
      ratingBorder = 'rgba(6, 182, 212, 0.2)';
    } else if (eoi >= 12.0) {
      rating = 'Strong';
      ratingColor = '#10b981';
      ratingBg = 'rgba(16, 185, 129, 0.1)';
      ratingBorder = 'rgba(16, 185, 129, 0.2)';
    } else if (eoi >= 5.0) {
      rating = 'Moderate';
      ratingColor = '#f59e0b';
      ratingBg = 'rgba(245, 158, 11, 0.1)';
      ratingBorder = 'rgba(245, 158, 11, 0.2)';
    }

    ratingEl.innerText = rating;
    ratingEl.style.color = ratingColor;
    ratingEl.style.background = ratingBg;
    ratingEl.style.borderColor = ratingBorder;

    // Update Valuation Indicators
    const contractPrice = (eoi * CONTRACT_SPECS.pricingScale).toFixed(2);
    const sovereignYield = (contractPrice * 0.2).toFixed(2);

    document.getElementById('calc-contract-price').innerText = `$${contractPrice}`;
    document.getElementById('calc-sovereign-yield').innerText = `$${sovereignYield}`;

    // Weights sum integrity validator
    const validatorEl = document.getElementById('calc-weight-validator');
    const sumValEl = document.getElementById('calc-weight-sum-value');
    const sumLabelEl = document.getElementById('calc-weight-sum-label');

    sumValEl.innerText = `${sumOfWeights.toFixed(2)} / 1.00`;

    // Check if sum is close to 1.00 (within float tolerance)
    const isSumValid = Math.abs(sumOfWeights - 1.0) < 0.005;

    if (isSumValid) {
      validatorEl.style.borderLeftColor = '#10b981';
      sumValEl.style.color = '#10b981';
      sumLabelEl.innerText = 'Weights Sum Integrity: Verified (100%)';
    } else {
      validatorEl.style.borderLeftColor = '#ef4444';
      sumValEl.style.color = '#ef4444';
      sumLabelEl.innerText = `Warning! Current weights sum to ${(sumOfWeights * 100).toFixed(0)}%. Must equal 100%.`;
    }

    // Dynamic Contribution Bar
    const contribBar = document.getElementById('calc-contribution-bar');
    contribBar.innerHTML = '';
    const colors = ['#fbbf24', '#60a5fa', '#3b82f6', '#1d4ed8', '#f8fafc', '#cbd5e1', '#94a3b8'];

    // Calculate total absolute contribution for relative scaling
    const absContribTotal = contributions.reduce((s, c) => s + Math.max(0, c.contrib), 0);

    if (absContribTotal > 0) {
      contributions.forEach((c, index) => {
        const pct = (Math.max(0, c.contrib) / absContribTotal) * 100;
        if (pct > 0) {
          const subBar = document.createElement('div');
          subBar.style.width = `${pct}%`;
          subBar.style.height = '100%';
          subBar.style.background = colors[index % colors.length];
          subBar.title = `${c.label}: ${(pct).toFixed(0)}% contribution`;
          contribBar.appendChild(subBar);
        }
      });
    }
  };

  // Wire up event listeners
  variables.forEach(v => {
    const slider = document.getElementById(`calc-slider-${v.id}`);
    const valInput = document.getElementById(`calc-val-input-${v.id}`);
    const weightInput = document.getElementById(`calc-weight-${v.id}`);

    slider.addEventListener('input', () => {
      valInput.value = slider.value;
      calculateSimulatedEOI();
    });

    valInput.addEventListener('input', () => {
      const val = parseFloat(valInput.value) || 0;

      // Dynamically auto-scale slider limits if input exceeds them
      if (val > parseFloat(slider.max)) {
        slider.max = val;
      }
      if (val < parseFloat(slider.min)) {
        slider.min = val;
      }

      slider.value = val;
      calculateSimulatedEOI();
    });

    weightInput.addEventListener('input', calculateSimulatedEOI);
  });

  // Wire up inflation listeners
  const infSlider = document.getElementById('calc-slider-inflation');
  const infInput = document.getElementById('calc-val-input-inflation');
  if (infSlider && infInput) {
    infSlider.addEventListener('input', () => {
      infInput.value = infSlider.value;
      calculateSimulatedEOI();
    });

    infInput.addEventListener('input', () => {
      const val = parseFloat(infInput.value) || 0;
      if (val > parseFloat(infSlider.max)) infSlider.max = val;
      if (val < parseFloat(infSlider.min)) infSlider.min = val;
      infSlider.value = val;
      calculateSimulatedEOI();
    });
  }

  // Preset Selection Loader
  presetSelect.addEventListener('change', (e) => {
    const stateId = e.target.value;
    if (!stateId) return;

    const state = statesData.find(s => s.id === stateId);
    if (!state) return;

    // Load actual state values
    const setVal = (id, val) => {
      const slider = document.getElementById(`calc-slider-${id}`);
      const valInput = document.getElementById(`calc-val-input-${id}`);

      // Auto-scale slider range to fit loaded state value if it exceeds defaults
      if (val > parseFloat(slider.max)) slider.max = val;
      if (val < parseFloat(slider.min)) slider.min = val;

      slider.value = val;
      valInput.value = val;
    };

    setVal('gdp', state.gdp);
    setVal('growth', state.growth);
    setVal('tax', state.tax);
    setVal('employment', state.employment);
    setVal('business', state.business);
    setVal('investment', state.investment);
    setVal('productivity', state.productivity);

    const infSliderEl = document.getElementById('calc-slider-inflation');
    const infInputEl = document.getElementById('calc-val-input-inflation');
    if (infSliderEl && infInputEl) {
      const val = state.inflation || 2.0;
      if (val > parseFloat(infSliderEl.max)) infSliderEl.max = val;
      if (val < parseFloat(infSliderEl.min)) infSliderEl.min = val;
      infSliderEl.value = val;
      infInputEl.value = val;
    }

    // Load actual state weights
    document.getElementById('calc-weight-gdp').value = 0.25;
    document.getElementById('calc-weight-growth').value = 0.10;
    document.getElementById('calc-weight-tax').value = 0.10;
    document.getElementById('calc-weight-employment').value = 0.15;
    document.getElementById('calc-weight-business').value = 0.10;
    document.getElementById('calc-weight-investment').value = 0.15;
    document.getElementById('calc-weight-productivity').value = 0.15;

    calculateSimulatedEOI();
  });

  // Reset Button
  resetBtn.addEventListener('click', () => {
    presetSelect.value = '';

    variables.forEach(v => {
      const slider = document.getElementById(`calc-slider-${v.id}`);
      const valInput = document.getElementById(`calc-val-input-${v.id}`);

      // Reset slider ranges to default limits
      slider.min = v.min;
      slider.max = v.max;

      slider.value = v.defVal;
      valInput.value = v.defVal;

      document.getElementById(`calc-weight-${v.id}`).value = v.defWeight;
    });

    const infSliderEl = document.getElementById('calc-slider-inflation');
    const infInputEl = document.getElementById('calc-val-input-inflation');
    if (infSliderEl && infInputEl) {
      infSliderEl.min = 0;
      infSliderEl.max = 15;
      infSliderEl.value = 2.0;
      infInputEl.value = 2.0;
    }

    calculateSimulatedEOI();
  });

  // Run initial calculation
  calculateSimulatedEOI();
}

// ==========================================
// SPA ROUTER IMPLEMENTATION
// ==========================================

function initRouter() {
  window.addEventListener('hashchange', handleRouting);
  window.addEventListener('load', handleRouting);
  handleRouting();
}

function handleRouting() {
  const hash = window.location.hash || '#map';
  const dashboardPage = document.getElementById('dashboard-page');
  const newsPage = document.getElementById('news-page');
  const articlePage = document.getElementById('article-page');
  const calculatorPage = document.getElementById('calculator-page');

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    }
  });

  if (hash.startsWith('#article-')) {
    if (dashboardPage) dashboardPage.classList.add('hidden');
    if (newsPage) newsPage.classList.add('hidden');
    if (calculatorPage) calculatorPage.classList.add('hidden');
    if (articlePage) {
      articlePage.classList.remove('hidden');
      const storyId = hash.replace('#article-', '');
      renderArticleDetail(storyId);
    }
  } else if (hash === '#news') {
    if (dashboardPage) dashboardPage.classList.add('hidden');
    if (articlePage) articlePage.classList.add('hidden');
    if (calculatorPage) calculatorPage.classList.add('hidden');
    if (newsPage) newsPage.classList.remove('hidden');
    renderNews();
  } else if (hash === '#calculator') {
    if (dashboardPage) dashboardPage.classList.add('hidden');
    if (articlePage) articlePage.classList.add('hidden');
    if (newsPage) newsPage.classList.add('hidden');
    if (calculatorPage) calculatorPage.classList.remove('hidden');
  } else {
    if (newsPage) newsPage.classList.add('hidden');
    if (articlePage) articlePage.classList.add('hidden');
    if (calculatorPage) calculatorPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.remove('hidden');

    if (hash === '#map' || hash === '#table' || hash === '#ledger') {
      const elementId = hash.substring(1);
      const element = document.getElementById(elementId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }
}

init();
