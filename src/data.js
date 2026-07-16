export const SHARES_PER_STATE = 100_000_000_000; // 100 billion shares per state

export const statesData = [
  { id: "AL", name: "Alabama", gdp: 250, growth: 2.1, tax: 12, employment: 94.5, business: 45, investment: 8, productivity: 55, inflation: 3.2, ipoPriceTarget: 3.21, ipoMarketCap: "321.24B", ipoUnderwriter: "Houlihan Lokey", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "AK", name: "Alaska", gdp: 55, growth: -0.5, tax: 3, employment: 93.2, business: 12, investment: 4, productivity: 62, inflation: 2.8, ipoPriceTarget: 0.70, ipoMarketCap: "69.97B", ipoUnderwriter: "Wainwright & Co", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "AZ", name: "Arizona", gdp: 420, growth: 3.4, tax: 22, employment: 95.1, business: 88, investment: 25, productivity: 58, inflation: 4.1, ipoPriceTarget: 5.52, ipoMarketCap: "552.17B", ipoUnderwriter: "Stifel", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "AR", name: "Arkansas", gdp: 145, growth: 1.8, tax: 9, employment: 94.8, business: 32, investment: 6, productivity: 52, inflation: 2.9, ipoPriceTarget: 1.89, ipoMarketCap: "188.72B", ipoUnderwriter: "FBR & Co.", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "CA", name: "California", gdp: 3600, growth: 2.8, tax: 280, employment: 95.5, business: 950, investment: 450, productivity: 85, inflation: 4.8, ipoPriceTarget: 41.03, ipoMarketCap: "4.103T", ipoUnderwriter: "Goldman Sachs", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "CO", name: "Colorado", gdp: 480, growth: 3.1, tax: 35, employment: 96.2, business: 110, investment: 42, productivity: 72, inflation: 3.5, ipoPriceTarget: 5.53, ipoMarketCap: "553.32B", ipoUnderwriter: "Piper Sandler", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "CT", name: "Connecticut", gdp: 320, growth: 1.2, tax: 32, employment: 95.8, business: 65, investment: 18, productivity: 78, inflation: 3.1, ipoPriceTarget: 3.66, ipoMarketCap: "365.72B", ipoUnderwriter: "Canaccord Genuity", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "DE", name: "Delaware", gdp: 85, growth: 1.5, tax: 15, employment: 94.5, business: 120, investment: 12, productivity: 68, inflation: 2.7, ipoPriceTarget: 1.03, ipoMarketCap: "103.25B", ipoUnderwriter: "Cantor Fitzgerald", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "FL", name: "Florida", gdp: 1400, growth: 4.2, tax: 95, employment: 96.5, business: 550, investment: 180, productivity: 62, inflation: 4.5, ipoPriceTarget: 17.06, ipoMarketCap: "1.706T", ipoUnderwriter: "Bank of America", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "GA", name: "Georgia", gdp: 750, growth: 3.0, tax: 45, employment: 95.2, business: 180, investment: 65, productivity: 60, inflation: 3.6, ipoPriceTarget: 8.83, ipoMarketCap: "882.53B", ipoUnderwriter: "Deutsche Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "HI", name: "Hawaii", gdp: 95, growth: 0.8, tax: 12, employment: 95.0, business: 22, investment: 10, productivity: 58, inflation: 5.2, ipoPriceTarget: 1.16, ipoMarketCap: "115.63B", ipoUnderwriter: "Roth Capital Partners", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "ID", name: "Idaho", gdp: 110, growth: 4.5, tax: 8, employment: 97.0, business: 35, investment: 15, productivity: 54, inflation: 3.8, ipoPriceTarget: 1.28, ipoMarketCap: "128.13B", ipoUnderwriter: "Pacific Premier Bancorp", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "IL", name: "Illinois", gdp: 1000, growth: 1.5, tax: 85, employment: 94.2, business: 220, investment: 95, productivity: 75, inflation: 3.4, ipoPriceTarget: 11.37, ipoMarketCap: "1.137T", ipoUnderwriter: "Citigroup", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "IN", name: "Indiana", gdp: 450, growth: 2.2, tax: 28, employment: 95.5, business: 85, investment: 32, productivity: 62, inflation: 2.6, ipoPriceTarget: 5.27, ipoMarketCap: "527.38B", ipoUnderwriter: "Baird", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "IA", name: "Iowa", gdp: 230, growth: 1.9, tax: 15, employment: 96.8, business: 42, investment: 12, productivity: 60, inflation: 2.3, ipoPriceTarget: 2.57, ipoMarketCap: "257.02B", ipoUnderwriter: "D.A. Davidson", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "KS", name: "Kansas", gdp: 210, growth: 1.7, tax: 14, employment: 96.5, business: 38, investment: 10, productivity: 59, inflation: 2.5, ipoPriceTarget: 2.35, ipoMarketCap: "234.67B", ipoUnderwriter: "Janney Montgomery", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "KY", name: "Kentucky", gdp: 260, growth: 2.0, tax: 18, employment: 95.2, business: 45, investment: 14, productivity: 56, inflation: 2.8, ipoPriceTarget: 2.93, ipoMarketCap: "293.02B", ipoUnderwriter: "Moelis & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "LA", name: "Louisiana", gdp: 280, growth: 0.5, tax: 22, employment: 93.8, business: 52, investment: 18, productivity: 58, inflation: 3.0, ipoPriceTarget: 3.28, ipoMarketCap: "327.78B", ipoUnderwriter: "Daiwa Capital Markets", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "ME", name: "Maine", gdp: 85, growth: 1.8, tax: 7, employment: 96.2, business: 18, investment: 5, productivity: 54, inflation: 3.3, ipoPriceTarget: 0.99, ipoMarketCap: "98.61B", ipoUnderwriter: "Maxim Group", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MD", name: "Maryland", gdp: 480, growth: 1.6, tax: 42, employment: 95.8, business: 95, investment: 35, productivity: 74, inflation: 3.2, ipoPriceTarget: 5.43, ipoMarketCap: "542.77B", ipoUnderwriter: "Truist Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MA", name: "Massachusetts", gdp: 700, growth: 2.2, tax: 75, employment: 96.0, business: 180, investment: 120, productivity: 82, inflation: 3.7, ipoPriceTarget: 7.81, ipoMarketCap: "780.67B", ipoUnderwriter: "Jefferies", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MI", name: "Michigan", gdp: 620, growth: 1.8, tax: 48, employment: 94.5, business: 140, investment: 55, productivity: 64, inflation: 2.9, ipoPriceTarget: 7.19, ipoMarketCap: "719.39B", ipoUnderwriter: "Evercore", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MN", name: "Minnesota", gdp: 450, growth: 2.0, tax: 38, employment: 97.2, business: 92, investment: 38, productivity: 70, inflation: 2.4, ipoPriceTarget: 5.01, ipoMarketCap: "500.85B", ipoUnderwriter: "Oppenheimer", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MS", name: "Mississippi", gdp: 130, growth: 0.8, tax: 8, employment: 93.5, business: 22, investment: 4, productivity: 48, inflation: 3.1, ipoPriceTarget: 1.57, ipoMarketCap: "157.49B", ipoUnderwriter: "Hilliard Lyons", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MO", name: "Missouri", gdp: 390, growth: 1.9, tax: 28, employment: 95.8, business: 82, investment: 25, productivity: 60, inflation: 2.7, ipoPriceTarget: 4.51, ipoMarketCap: "451.20B", ipoUnderwriter: "Cowen & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "MT", name: "Montana", gdp: 65, growth: 2.5, tax: 4, employment: 96.5, business: 15, investment: 6, productivity: 52, inflation: 3.0, ipoPriceTarget: 0.76, ipoMarketCap: "76.00B", ipoUnderwriter: "Benchmark Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NE", name: "Nebraska", gdp: 160, growth: 2.1, tax: 10, employment: 97.8, business: 28, investment: 10, productivity: 60, inflation: 2.2, ipoPriceTarget: 1.85, ipoMarketCap: "185.41B", ipoUnderwriter: "Stephens Inc.", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NV", name: "Nevada", gdp: 220, growth: 3.5, tax: 18, employment: 94.2, business: 65, investment: 45, productivity: 58, inflation: 4.3, ipoPriceTarget: 2.61, ipoMarketCap: "260.73B", ipoUnderwriter: "B. Riley Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NH", name: "New Hampshire", gdp: 110, growth: 2.0, tax: 2, employment: 97.5, business: 25, investment: 12, productivity: 68, inflation: 2.5, ipoPriceTarget: 1.21, ipoMarketCap: "121.19B", ipoUnderwriter: "Northeast Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NJ", name: "New Jersey", gdp: 750, growth: 1.7, tax: 85, employment: 95.5, business: 210, investment: 85, productivity: 78, inflation: 3.4, ipoPriceTarget: 8.47, ipoMarketCap: "846.59B", ipoUnderwriter: "Credit Suisse", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NM", name: "New Mexico", gdp: 125, growth: 1.4, tax: 12, employment: 93.8, business: 28, investment: 15, productivity: 54, inflation: 3.2, ipoPriceTarget: 1.41, ipoMarketCap: "140.54B", ipoUnderwriter: "Sandler O'Neill", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NY", name: "New York", gdp: 2000, growth: 1.9, tax: 210, employment: 95.2, business: 650, investment: 350, productivity: 82, inflation: 4.2, ipoPriceTarget: 22.97, ipoMarketCap: "2.297T", ipoUnderwriter: "Morgan Stanley", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "NC", name: "North Carolina", gdp: 720, growth: 3.2, tax: 45, employment: 95.8, business: 160, investment: 75, productivity: 62, inflation: 3.0, ipoPriceTarget: 8.39, ipoMarketCap: "839.12B", ipoUnderwriter: "RBC Capital Markets", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "ND", name: "North Dakota", gdp: 70, growth: 1.5, tax: 5, employment: 98.0, business: 12, investment: 8, productivity: 68, inflation: 1.9, ipoPriceTarget: 0.75, ipoMarketCap: "75.40B", ipoUnderwriter: "Northland Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "OH", name: "Ohio", gdp: 830, growth: 1.8, tax: 55, employment: 95.5, business: 170, investment: 65, productivity: 64, inflation: 2.8, ipoPriceTarget: 9.28, ipoMarketCap: "927.74B", ipoUnderwriter: "Barclays", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "OK", name: "Oklahoma", gdp: 210, growth: 1.6, tax: 12, employment: 96.2, business: 45, investment: 15, productivity: 56, inflation: 2.6, ipoPriceTarget: 2.66, ipoMarketCap: "265.78B", ipoUnderwriter: "Imperial Capital", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "OR", name: "Oregon", gdp: 300, growth: 2.5, tax: 25, employment: 95.2, business: 85, investment: 35, productivity: 66, inflation: 3.9, ipoPriceTarget: 3.31, ipoMarketCap: "331.03B", ipoUnderwriter: "William Blair", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "PA", name: "Pennsylvania", gdp: 950, growth: 1.6, tax: 75, employment: 95.0, business: 210, investment: 85, productivity: 68, inflation: 3.0, ipoPriceTarget: 10.24, ipoMarketCap: "1.024T", ipoUnderwriter: "Wells Fargo", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "RI", name: "Rhode Island", gdp: 75, growth: 1.4, tax: 8, employment: 95.8, business: 15, investment: 5, productivity: 62, inflation: 3.3, ipoPriceTarget: 0.82, ipoMarketCap: "82.49B", ipoUnderwriter: "National Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "SC", name: "South Carolina", gdp: 280, growth: 3.1, tax: 18, employment: 95.5, business: 75, investment: 35, productivity: 54, inflation: 3.4, ipoPriceTarget: 3.50, ipoMarketCap: "349.96B", ipoUnderwriter: "Needham & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "SD", name: "South Dakota", gdp: 65, growth: 2.3, tax: 4, employment: 98.2, business: 15, investment: 6, productivity: 60, inflation: 2.0, ipoPriceTarget: 0.75, ipoMarketCap: "75.18B", ipoUnderwriter: "Feltl and Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "TN", name: "Tennessee", gdp: 480, growth: 3.5, tax: 22, employment: 96.2, business: 110, investment: 55, productivity: 58, inflation: 3.2, ipoPriceTarget: 5.50, ipoMarketCap: "549.71B", ipoUnderwriter: "Raymond James", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "TX", name: "Texas", gdp: 2500, growth: 4.5, tax: 180, employment: 96.0, business: 850, investment: 320, productivity: 72, inflation: 3.8, ipoPriceTarget: 27.09, ipoMarketCap: "2.709T", ipoUnderwriter: "JPMorgan Chase", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "UT", name: "Utah", gdp: 250, growth: 4.8, tax: 15, employment: 97.5, business: 95, investment: 45, productivity: 68, inflation: 3.5, ipoPriceTarget: 3.01, ipoMarketCap: "300.90B", ipoUnderwriter: "BTIG", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "VT", name: "Vermont", gdp: 40, growth: 1.2, tax: 4, employment: 97.8, business: 10, investment: 3, productivity: 56, inflation: 2.8, ipoPriceTarget: 0.46, ipoMarketCap: "45.71B", ipoUnderwriter: "Ladenburg Thalmann", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "VA", name: "Virginia", gdp: 650, growth: 2.1, tax: 55, employment: 96.8, business: 140, investment: 65, productivity: 76, inflation: 2.9, ipoPriceTarget: 7.64, ipoMarketCap: "764.48B", ipoUnderwriter: "Lazard", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "WA", name: "Washington", gdp: 750, growth: 3.5, tax: 65, employment: 95.8, business: 220, investment: 150, productivity: 84, inflation: 4.0, ipoPriceTarget: 8.55, ipoMarketCap: "854.68B", ipoUnderwriter: "UBS", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "WV", name: "West Virginia", gdp: 95, growth: 0.5, tax: 8, employment: 94.2, business: 18, investment: 5, productivity: 52, inflation: 2.5, ipoPriceTarget: 1.08, ipoMarketCap: "107.66B", ipoUnderwriter: "Griffin Financial", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "WI", name: "Wisconsin", gdp: 400, growth: 1.8, tax: 32, employment: 96.5, business: 85, investment: 28, productivity: 64, inflation: 2.4, ipoPriceTarget: 4.51, ipoMarketCap: "451.29B", ipoUnderwriter: "Wedbush Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 },
  { id: "WY", name: "Wyoming", gdp: 50, growth: 0.8, tax: 3, employment: 97.0, business: 12, investment: 6, productivity: 58, inflation: 2.3, ipoPriceTarget: 0.53, ipoMarketCap: "52.95B", ipoUnderwriter: "Chardan Capital", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0 }
];

export const calculateEOI = (state) => {
  // Economic Output Index (EOI) = [Weighted Sum] × Inflation Adjustment Factor
  // Weights (a-g) based on the user-specified weight structure
  const weights = { a: 0.25, b: 0.10, c: 0.10, d: 0.15, e: 0.10, f: 0.15, g: 0.15 };
  
  const rawEOI = (
    weights.a * (state.gdp / 100) + // Normalized GDP
    weights.b * state.growth +
    weights.c * (state.tax / 10) + // Normalized Tax
    weights.d * (state.employment - 90) + // Focused on the variance
    weights.e * (state.business / 50) +
    weights.f * (state.investment / 10) +
    weights.g * (state.productivity / 10)
  );
  
  // Inflation Deflator: penalizes states running above the Fed's 2.0% target
  // h = 0.05 sensitivity weight (each 1% above target = 5% EOI haircut)
  const TARGET_INFLATION = 2.0;
  const SENSITIVITY = 0.05;
  const inflationPenalty = Math.max(0, (state.inflation || 0) - TARGET_INFLATION);
  const inflationFactor = Math.max(0, 1 - (SENSITIVITY * inflationPenalty));
  
  const adjustedEOI = rawEOI * inflationFactor;
  
  return parseFloat(adjustedEOI.toFixed(2));
};

export const getPayoutSplit = (value) => {
  return {
    market: value * 0.8,
    state: value * 0.2,
    social: value * 0.1,
    discretionary: value * 0.1
  };
};
