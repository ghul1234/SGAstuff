export const SHARES_PER_STATE = 50_000_000_000; // 50 billion shares total

export const statesData = [
  { id: "AL", name: "Alabama", gdp: 250, growth: 2.1, tax: 12, employment: 94.5, business: 45, investment: 8, productivity: 55, inflation: 3.2, ipoPriceTarget: 3.21, ipoMarketCap: "321.24B", ipoUnderwriter: "Houlihan Lokey", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 83.2 },
  { id: "AK", name: "Alaska", gdp: 55, growth: -0.5, tax: 3, employment: 93.2, business: 12, investment: 4, productivity: 62, inflation: 2.8, ipoPriceTarget: 0.70, ipoMarketCap: "69.97B", ipoUnderwriter: "Wainwright & Co", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 70.7 },
  { id: "AZ", name: "Arizona", gdp: 420, growth: 3.4, tax: 22, employment: 95.1, business: 88, investment: 25, productivity: 58, inflation: 4.1, ipoPriceTarget: 5.52, ipoMarketCap: "552.17B", ipoUnderwriter: "Stifel", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 94.8 },
  { id: "AR", name: "Arkansas", gdp: 145, growth: 1.8, tax: 9, employment: 94.8, business: 32, investment: 6, productivity: 52, inflation: 2.9, ipoPriceTarget: 1.89, ipoMarketCap: "188.72B", ipoUnderwriter: "FBR & Co.", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 76.6 },
  { id: "CA", name: "California", gdp: 3600, growth: 2.8, tax: 280, employment: 95.5, business: 950, investment: 450, productivity: 85, inflation: 4.8, ipoPriceTarget: 41.03, ipoMarketCap: "4.103T", ipoUnderwriter: "Goldman Sachs", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 272.0 },
  { id: "CO", name: "Colorado", gdp: 480, growth: 3.1, tax: 35, employment: 96.2, business: 110, investment: 42, productivity: 72, inflation: 3.5, ipoPriceTarget: 5.53, ipoMarketCap: "553.32B", ipoUnderwriter: "Piper Sandler", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 94.8 },
  { id: "CT", name: "Connecticut", gdp: 320, growth: 1.2, tax: 32, employment: 95.8, business: 65, investment: 18, productivity: 78, inflation: 3.1, ipoPriceTarget: 3.66, ipoMarketCap: "365.72B", ipoUnderwriter: "Canaccord Genuity", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 85.5 },
  { id: "DE", name: "Delaware", gdp: 85, growth: 1.5, tax: 15, employment: 94.5, business: 120, investment: 12, productivity: 68, inflation: 2.7, ipoPriceTarget: 1.03, ipoMarketCap: "103.25B", ipoUnderwriter: "Cantor Fitzgerald", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 72.4 },
  { id: "FL", name: "Florida", gdp: 1400, growth: 4.2, tax: 95, employment: 96.5, business: 550, investment: 180, productivity: 62, inflation: 4.5, ipoPriceTarget: 17.06, ipoMarketCap: "1.706T", ipoUnderwriter: "Bank of America", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 152.3 },
  { id: "GA", name: "Georgia", gdp: 750, growth: 3.0, tax: 45, employment: 95.2, business: 180, investment: 65, productivity: 60, inflation: 3.6, ipoPriceTarget: 8.83, ipoMarketCap: "882.53B", ipoUnderwriter: "Deutsche Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 111.2 },
  { id: "HI", name: "Hawaii", gdp: 95, growth: 0.8, tax: 12, employment: 95.0, business: 22, investment: 10, productivity: 58, inflation: 5.2, ipoPriceTarget: 1.16, ipoMarketCap: "115.63B", ipoUnderwriter: "Roth Capital Partners", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 73.0 },
  { id: "ID", name: "Idaho", gdp: 110, growth: 4.5, tax: 8, employment: 97.0, business: 35, investment: 15, productivity: 54, inflation: 3.8, ipoPriceTarget: 1.28, ipoMarketCap: "128.13B", ipoUnderwriter: "Pacific Premier Bancorp", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 73.6 },
  { id: "IL", name: "Illinois", gdp: 1000, growth: 1.5, tax: 85, employment: 94.2, business: 220, investment: 95, productivity: 75, inflation: 3.4, ipoPriceTarget: 11.37, ipoMarketCap: "1.137T", ipoUnderwriter: "Citigroup", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 124.0 },
  { id: "IN", name: "Indiana", gdp: 450, growth: 2.2, tax: 28, employment: 95.5, business: 85, investment: 32, productivity: 62, inflation: 2.6, ipoPriceTarget: 5.27, ipoMarketCap: "527.38B", ipoUnderwriter: "Baird", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 93.5 },
  { id: "IA", name: "Iowa", gdp: 230, growth: 1.9, tax: 15, employment: 96.8, business: 42, investment: 12, productivity: 60, inflation: 2.3, ipoPriceTarget: 2.57, ipoMarketCap: "257.02B", ipoUnderwriter: "D.A. Davidson", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 80.0 },
  { id: "KS", name: "Kansas", gdp: 210, growth: 1.7, tax: 14, employment: 96.5, business: 38, investment: 10, productivity: 59, inflation: 2.5, ipoPriceTarget: 2.35, ipoMarketCap: "234.67B", ipoUnderwriter: "Janney Montgomery", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 78.9 },
  { id: "KY", name: "Kentucky", gdp: 260, growth: 2.0, tax: 18, employment: 95.2, business: 45, investment: 14, productivity: 56, inflation: 2.8, ipoPriceTarget: 2.93, ipoMarketCap: "293.02B", ipoUnderwriter: "Moelis & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 81.8 },
  { id: "LA", name: "Louisiana", gdp: 280, growth: 0.5, tax: 22, employment: 93.8, business: 52, investment: 18, productivity: 58, inflation: 3.0, ipoPriceTarget: 3.28, ipoMarketCap: "327.78B", ipoUnderwriter: "Daiwa Capital Markets", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 83.6 },
  { id: "ME", name: "Maine", gdp: 85, growth: 1.8, tax: 7, employment: 96.2, business: 18, investment: 5, productivity: 54, inflation: 3.3, ipoPriceTarget: 0.99, ipoMarketCap: "98.61B", ipoUnderwriter: "Maxim Group", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 72.1 },
  { id: "MD", name: "Maryland", gdp: 480, growth: 1.6, tax: 42, employment: 95.8, business: 95, investment: 35, productivity: 74, inflation: 3.2, ipoPriceTarget: 5.43, ipoMarketCap: "542.77B", ipoUnderwriter: "Truist Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 94.3 },
  { id: "MA", name: "Massachusetts", gdp: 700, growth: 2.2, tax: 75, employment: 96.0, business: 180, investment: 120, productivity: 82, inflation: 3.7, ipoPriceTarget: 7.81, ipoMarketCap: "780.67B", ipoUnderwriter: "Jefferies", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 106.2 },
  { id: "MI", name: "Michigan", gdp: 620, growth: 1.8, tax: 48, employment: 94.5, business: 140, investment: 55, productivity: 64, inflation: 2.9, ipoPriceTarget: 7.19, ipoMarketCap: "719.39B", ipoUnderwriter: "Evercore", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 103.1 },
  { id: "MN", name: "Minnesota", gdp: 450, growth: 2.0, tax: 38, employment: 97.2, business: 92, investment: 38, productivity: 70, inflation: 2.4, ipoPriceTarget: 5.01, ipoMarketCap: "500.85B", ipoUnderwriter: "Oppenheimer", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 92.2 },
  { id: "MS", name: "Mississippi", gdp: 130, growth: 0.8, tax: 8, employment: 93.5, business: 22, investment: 4, productivity: 48, inflation: 3.1, ipoPriceTarget: 1.57, ipoMarketCap: "157.49B", ipoUnderwriter: "Hilliard Lyons", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 75.1 },
  { id: "MO", name: "Missouri", gdp: 390, growth: 1.9, tax: 28, employment: 95.8, business: 82, investment: 25, productivity: 60, inflation: 2.7, ipoPriceTarget: 4.51, ipoMarketCap: "451.20B", ipoUnderwriter: "Cowen & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 89.7 },
  { id: "MT", name: "Montana", gdp: 65, growth: 2.5, tax: 4, employment: 96.5, business: 15, investment: 6, productivity: 52, inflation: 3.0, ipoPriceTarget: 0.76, ipoMarketCap: "76.00B", ipoUnderwriter: "Benchmark Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 71.0 },
  { id: "NE", name: "Nebraska", gdp: 160, growth: 2.1, tax: 10, employment: 97.8, business: 28, investment: 10, productivity: 60, inflation: 2.2, ipoPriceTarget: 1.85, ipoMarketCap: "185.41B", ipoUnderwriter: "Stephens Inc.", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 76.5 },
  { id: "NV", name: "Nevada", gdp: 220, growth: 3.5, tax: 18, employment: 94.2, business: 65, investment: 45, productivity: 58, inflation: 4.3, ipoPriceTarget: 2.61, ipoMarketCap: "260.73B", ipoUnderwriter: "B. Riley Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 80.2 },
  { id: "NH", name: "New Hampshire", gdp: 110, growth: 2.0, tax: 2, employment: 97.5, business: 25, investment: 12, productivity: 68, inflation: 2.5, ipoPriceTarget: 1.21, ipoMarketCap: "121.19B", ipoUnderwriter: "Northeast Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 73.2 },
  { id: "NJ", name: "New Jersey", gdp: 750, growth: 1.7, tax: 85, employment: 95.5, business: 210, investment: 85, productivity: 78, inflation: 3.4, ipoPriceTarget: 8.47, ipoMarketCap: "846.59B", ipoUnderwriter: "Credit Suisse", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 109.5 },
  { id: "NM", name: "New Mexico", gdp: 125, growth: 1.4, tax: 12, employment: 93.8, business: 28, investment: 15, productivity: 54, inflation: 3.2, ipoPriceTarget: 1.41, ipoMarketCap: "140.54B", ipoUnderwriter: "Sandler O'Neill", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 74.2 },
  { id: "NY", name: "New York", gdp: 2000, growth: 1.9, tax: 210, employment: 95.2, business: 650, investment: 350, productivity: 82, inflation: 4.2, ipoPriceTarget: 22.97, ipoMarketCap: "2.297T", ipoUnderwriter: "Morgan Stanley", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 181.8 },
  { id: "NC", name: "North Carolina", gdp: 720, growth: 3.2, tax: 45, employment: 95.8, business: 160, investment: 75, productivity: 62, inflation: 3.0, ipoPriceTarget: 8.39, ipoMarketCap: "839.12B", ipoUnderwriter: "RBC Capital Markets", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 109.1 },
  { id: "ND", name: "North Dakota", gdp: 70, growth: 1.5, tax: 5, employment: 98.0, business: 12, investment: 8, productivity: 68, inflation: 1.9, ipoPriceTarget: 0.75, ipoMarketCap: "75.40B", ipoUnderwriter: "Northland Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 71.0 },
  { id: "OH", name: "Ohio", gdp: 830, growth: 1.8, tax: 55, employment: 95.5, business: 170, investment: 65, productivity: 64, inflation: 2.8, ipoPriceTarget: 9.28, ipoMarketCap: "927.74B", ipoUnderwriter: "Barclays", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 113.5 },
  { id: "OK", name: "Oklahoma", gdp: 210, growth: 1.6, tax: 12, employment: 96.2, business: 45, investment: 15, productivity: 56, inflation: 2.6, ipoPriceTarget: 2.66, ipoMarketCap: "265.78B", ipoUnderwriter: "Imperial Capital", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 80.5 },
  { id: "OR", name: "Oregon", gdp: 300, growth: 2.5, tax: 25, employment: 95.2, business: 85, investment: 35, productivity: 66, inflation: 3.9, ipoPriceTarget: 3.31, ipoMarketCap: "331.03B", ipoUnderwriter: "William Blair", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 83.7 },
  { id: "PA", name: "Pennsylvania", gdp: 950, growth: 1.6, tax: 75, employment: 95.0, business: 210, investment: 85, productivity: 68, inflation: 3.0, ipoPriceTarget: 10.24, ipoMarketCap: "1.024T", ipoUnderwriter: "Wells Fargo", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 118.3 },
  { id: "RI", name: "Rhode Island", gdp: 75, growth: 1.4, tax: 8, employment: 95.8, business: 15, investment: 5, productivity: 62, inflation: 3.3, ipoPriceTarget: 0.82, ipoMarketCap: "82.49B", ipoUnderwriter: "National Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 71.3 },
  { id: "SC", name: "South Carolina", gdp: 280, growth: 3.1, tax: 18, employment: 95.5, business: 75, investment: 35, productivity: 54, inflation: 3.4, ipoPriceTarget: 3.50, ipoMarketCap: "349.96B", ipoUnderwriter: "Needham & Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 84.7 },
  { id: "SD", name: "South Dakota", gdp: 65, growth: 2.3, tax: 4, employment: 98.2, business: 15, investment: 6, productivity: 60, inflation: 2.0, ipoPriceTarget: 0.75, ipoMarketCap: "75.18B", ipoUnderwriter: "Feltl and Company", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 71.0 },
  { id: "TN", name: "Tennessee", gdp: 480, growth: 3.5, tax: 22, employment: 96.2, business: 110, investment: 55, productivity: 58, inflation: 3.2, ipoPriceTarget: 5.50, ipoMarketCap: "549.71B", ipoUnderwriter: "Raymond James", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 94.6 },
  { id: "TX", name: "Texas", gdp: 2500, growth: 4.5, tax: 180, employment: 96.0, business: 850, investment: 320, productivity: 72, inflation: 3.8, ipoPriceTarget: 27.09, ipoMarketCap: "2.709T", ipoUnderwriter: "JPMorgan Chase", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 202.4 },
  { id: "UT", name: "Utah", gdp: 250, growth: 4.8, tax: 15, employment: 97.5, business: 95, investment: 45, productivity: 68, inflation: 3.5, ipoPriceTarget: 3.01, ipoMarketCap: "300.90B", ipoUnderwriter: "BTIG", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 82.2 },
  { id: "VT", name: "Vermont", gdp: 40, growth: 1.2, tax: 4, employment: 97.8, business: 10, investment: 3, productivity: 56, inflation: 2.8, ipoPriceTarget: 0.46, ipoMarketCap: "45.71B", ipoUnderwriter: "Ladenburg Thalmann", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 69.5 },
  { id: "VA", name: "Virginia", gdp: 650, growth: 2.1, tax: 55, employment: 96.8, business: 140, investment: 65, productivity: 76, inflation: 2.9, ipoPriceTarget: 7.64, ipoMarketCap: "764.48B", ipoUnderwriter: "Lazard", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 105.4 },
  { id: "WA", name: "Washington", gdp: 750, growth: 3.5, tax: 65, employment: 95.8, business: 220, investment: 150, productivity: 84, inflation: 4.0, ipoPriceTarget: 8.55, ipoMarketCap: "854.68B", ipoUnderwriter: "UBS", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 109.9 },
  { id: "WV", name: "West Virginia", gdp: 95, growth: 0.5, tax: 8, employment: 94.2, business: 18, investment: 5, productivity: 52, inflation: 2.5, ipoPriceTarget: 1.08, ipoMarketCap: "107.66B", ipoUnderwriter: "Griffin Financial", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 72.6 },
  { id: "WI", name: "Wisconsin", gdp: 400, growth: 1.8, tax: 32, employment: 96.5, business: 85, investment: 28, productivity: 64, inflation: 2.4, ipoPriceTarget: 4.51, ipoMarketCap: "451.29B", ipoUnderwriter: "Wedbush Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 89.7 },
  { id: "WY", name: "Wyoming", gdp: 50, growth: 0.8, tax: 3, employment: 97.0, business: 12, investment: 6, productivity: 58, inflation: 2.3, ipoPriceTarget: 0.53, ipoMarketCap: "52.95B", ipoUnderwriter: "Chardan Capital", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 69.8 }
];

export const calculateEOI = (state) => {
  // Return the hardcoded EOI value from the state data
  return state.eoi;
};

export const getPayoutSplit = (value) => {
  return {
    federal: value * 0.20,
    state: value * 0.20,
    market: value * 0.60
  };
};

// Comprehensive social program allocation percentages (must sum to 1.0)
export const SOCIAL_PROGRAM_ALLOCATIONS = {
  // Education & Youth Programs (18%)
  'K-12 Education Funding': 0.08,
  'Higher Education Grants': 0.04,
  'Early Childhood Development': 0.03,
  'Vocational Training': 0.02,
  'After-School Programs': 0.01,
  
  // Healthcare & Public Health (20%)
  'Medicaid Expansion': 0.06,
  'Community Health Centers': 0.04,
  'Mental Health Services': 0.03,
  'Substance Abuse Treatment': 0.02,
  'Preventive Care Programs': 0.02,
  'Healthcare Workforce Development': 0.02,
  'Medical Research Grants': 0.01,
  
  // Housing & Urban Development (12%)
  'Affordable Housing Construction': 0.05,
  'Homelessness Prevention': 0.03,
  'Housing Vouchers': 0.02,
  'Urban Renewal Projects': 0.01,
  'Rural Housing Assistance': 0.01,
  
  // Social Services & Welfare (15%)
  'SNAP/Food Assistance': 0.05,
  'TANF/Welfare Programs': 0.03,
  'Child Care Subsidies': 0.03,
  'Disability Services': 0.02,
  'Senior Services': 0.02,
  
  // Infrastructure & Transportation (10%)
  'Road & Bridge Maintenance': 0.04,
  'Public Transit Systems': 0.03,
  'Water & Sewer Infrastructure': 0.02,
  'Broadband Expansion': 0.01,
  
  // Public Safety (8%)
  'Law Enforcement Support': 0.03,
  'Fire & Emergency Services': 0.02,
  'Community Policing': 0.02,
  'Disaster Preparedness': 0.01,
  
  // Economic Development (7%)
  'Small Business Grants': 0.03,
  'Job Training Programs': 0.02,
  'Workforce Development': 0.01,
  'Economic Opportunity Zones': 0.01,
  
  // Environmental Programs (6%)
  'Clean Energy Initiatives': 0.02,
  'Environmental Protection': 0.02,
  'Climate Resilience': 0.01,
  'Conservation Programs': 0.01,
  
  // Veterans Affairs (4%)
  'Veterans Healthcare': 0.02,
  'Veterans Housing': 0.01,
  'Veterans Employment': 0.01,
  
  // Agriculture & Rural Development (3%)
  'Farm Subsidies': 0.01,
  'Rural Development Grants': 0.01,
  'Agricultural Research': 0.01,
  
  // Arts, Culture & Scientific Research (3%)
  'Arts & Humanities Grants': 0.01,
  'Scientific Research Funding': 0.01,
  'Library & Museum Support': 0.01,
  
  // Disaster Relief & Emergency Services (4%)
  'Emergency Relief Fund': 0.02,
  'FEMA Disaster Assistance': 0.01,
  'Emergency Management': 0.01
};

// Map social programs to ledger categories (using original 7 categories)
export const SOCIAL_PROGRAM_CATEGORIES = {
  'K-12 Education Funding': 'Education',
  'Higher Education Grants': 'Education',
  'Early Childhood Development': 'Social Services',
  'Vocational Training': 'Education',
  'After-School Programs': 'Social Services',
  'Medicaid Expansion': 'Healthcare',
  'Community Health Centers': 'Healthcare',
  'Mental Health Services': 'Healthcare',
  'Substance Abuse Treatment': 'Healthcare',
  'Preventive Care Programs': 'Healthcare',
  'Healthcare Workforce Development': 'Healthcare',
  'Medical Research Grants': 'Technology',
  'Affordable Housing Construction': 'Infrastructure',
  'Homelessness Prevention': 'Social Services',
  'Housing Vouchers': 'Social Services',
  'Urban Renewal Projects': 'Infrastructure',
  'Rural Housing Assistance': 'Infrastructure',
  'SNAP/Food Assistance': 'Economic Relief',
  'TANF/Welfare Programs': 'Economic Relief',
  'Child Care Subsidies': 'Social Services',
  'Disability Services': 'Social Services',
  'Senior Services': 'Social Services',
  'Road & Bridge Maintenance': 'Infrastructure',
  'Public Transit Systems': 'Infrastructure',
  'Water & Sewer Infrastructure': 'Infrastructure',
  'Broadband Expansion': 'Technology',
  'Law Enforcement Support': 'Social Services',
  'Fire & Emergency Services': 'Social Services',
  'Community Policing': 'Social Services',
  'Disaster Preparedness': 'Social Services',
  'Small Business Grants': 'Economic Relief',
  'Job Training Programs': 'Education',
  'Workforce Development': 'Education',
  'Economic Opportunity Zones': 'Economic Relief',
  'Clean Energy Initiatives': 'Environmental',
  'Environmental Protection': 'Environmental',
  'Climate Resilience': 'Environmental',
  'Conservation Programs': 'Environmental',
  'Veterans Healthcare': 'Healthcare',
  'Veterans Housing': 'Social Services',
  'Veterans Employment': 'Economic Relief',
  'Farm Subsidies': 'Economic Relief',
  'Rural Development Grants': 'Economic Relief',
  'Agricultural Research': 'Technology',
  'Arts & Humanities Grants': 'Social Services',
  'Scientific Research Funding': 'Technology',
  'Library & Museum Support': 'Social Services',
  'Emergency Relief Fund': 'Economic Relief',
  'FEMA Disaster Assistance': 'Economic Relief',
  'Emergency Management': 'Social Services'
};

// Generate social program allocations for a given drawdown amount
export const generateSocialProgramAllocations = (totalAmount) => {
  const allocations = [];
  for (const [program, percentage] of Object.entries(SOCIAL_PROGRAM_ALLOCATIONS)) {
    const amount = totalAmount * percentage;
    allocations.push({
      program,
      amount,
      percentage,
      category: SOCIAL_PROGRAM_CATEGORIES[program]
    });
  }
  return allocations.sort((a, b) => b.amount - a.amount); // Sort by amount descending
};

export const chinaSubdivisionsData = [
  { id: "CN.GS", name: "Gansu", gdp: 150, growth: 3.5, tax: 8, employment: 94.0, business: 25, investment: 15, productivity: 52, inflation: 2.5, ipoPriceTarget: 1.85, ipoMarketCap: "185.00B", ipoUnderwriter: "China International Capital", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 78.5 },
  { id: "CN.QH", name: "Qinghai", gdp: 45, growth: 4.0, tax: 3, employment: 93.5, business: 8, investment: 12, productivity: 48, inflation: 2.8, ipoPriceTarget: 0.55, ipoMarketCap: "55.00B", ipoUnderwriter: "China Galaxy Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 68.0 },
  { id: "CN.GX", name: "Guangxi", gdp: 320, growth: 4.2, tax: 18, employment: 95.0, business: 65, investment: 35, productivity: 56, inflation: 3.0, ipoPriceTarget: 3.95, ipoMarketCap: "395.00B", ipoUnderwriter: "Guotai Junan", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 92.5 },
  { id: "CN.GZ", name: "Guizhou", gdp: 280, growth: 5.5, tax: 15, employment: 94.5, business: 55, investment: 40, productivity: 54, inflation: 2.9, ipoPriceTarget: 3.45, ipoMarketCap: "345.00B", ipoUnderwriter: "Huatai Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 88.5 },
  { id: "CN.CQ", name: "Chongqing", gdp: 380, growth: 5.0, tax: 22, employment: 95.5, business: 85, investment: 50, productivity: 60, inflation: 3.2, ipoPriceTarget: 4.75, ipoMarketCap: "475.00B", ipoUnderwriter: "CITIC Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 98.5 },
  { id: "CN.BJ", name: "Beijing", gdp: 550, growth: 4.5, tax: 45, employment: 96.0, business: 150, investment: 85, productivity: 85, inflation: 3.5, ipoPriceTarget: 6.85, ipoMarketCap: "685.00B", ipoUnderwriter: "CICC", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 115.0 },
  { id: "CN.FJ", name: "Fujian", gdp: 520, growth: 4.8, tax: 25, employment: 95.8, business: 95, investment: 55, productivity: 68, inflation: 3.1, ipoPriceTarget: 6.45, ipoMarketCap: "645.00B", ipoUnderwriter: "Xiamen International Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 108.5 },
  { id: "CN.AH", name: "Anhui", gdp: 580, growth: 4.5, tax: 22, employment: 95.5, business: 88, investment: 48, productivity: 62, inflation: 3.0, ipoPriceTarget: 7.15, ipoMarketCap: "715.00B", ipoUnderwriter: "Anhui Guoyuan", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 112.5 },
  { id: "CN.GD", name: "Guangdong", gdp: 1600, growth: 5.0, tax: 85, employment: 96.5, business: 350, investment: 180, productivity: 78, inflation: 3.8, ipoPriceTarget: 19.85, ipoMarketCap: "1.985T", ipoUnderwriter: "Guangdong Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 185.0 },
  { id: "CN.XZ", name: "Xizang", gdp: 35, growth: 6.5, tax: 2, employment: 92.0, business: 5, investment: 18, productivity: 45, inflation: 3.5, ipoPriceTarget: 0.42, ipoMarketCap: "42.00B", ipoUnderwriter: "Tibet Development", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 65.0 },
  { id: "CN.XJ", name: "Xinjiang", gdp: 220, growth: 4.0, tax: 12, employment: 94.0, business: 45, investment: 30, productivity: 50, inflation: 3.2, ipoPriceTarget: 2.75, ipoMarketCap: "275.00B", ipoUnderwriter: "Xinjiang Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 82.5 },
  { id: "CN.HA", name: "Hainan", gdp: 95, growth: 5.8, tax: 8, employment: 94.5, business: 28, investment: 25, productivity: 55, inflation: 4.0, ipoPriceTarget: 1.18, ipoMarketCap: "118.00B", ipoUnderwriter: "Hainan Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 74.5 },
  { id: "CN.NX", name: "Ningxia", gdp: 55, growth: 4.5, tax: 4, employment: 94.5, business: 12, investment: 15, productivity: 52, inflation: 2.7, ipoPriceTarget: 0.68, ipoMarketCap: "68.00B", ipoUnderwriter: "Ningxia Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 70.0 },
  { id: "CN.SA", name: "Shaanxi", gdp: 380, growth: 4.8, tax: 20, employment: 95.0, business: 75, investment: 45, productivity: 58, inflation: 3.1, ipoPriceTarget: 4.75, ipoMarketCap: "475.00B", ipoUnderwriter: "Western Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 98.5 },
  { id: "CN.SX", name: "Shanxi", gdp: 320, growth: 3.8, tax: 18, employment: 94.8, business: 65, investment: 35, productivity: 54, inflation: 3.0, ipoPriceTarget: 3.95, ipoMarketCap: "395.00B", ipoUnderwriter: "Shanxi Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 92.5 },
  { id: "CN.HU", name: "Hubei", gdp: 650, growth: 5.2, tax: 28, employment: 95.8, business: 120, investment: 65, productivity: 65, inflation: 3.3, ipoPriceTarget: 8.05, ipoMarketCap: "805.00B", ipoUnderwriter: "Hubei Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 118.5 },
  { id: "CN.HN", name: "Hunan", gdp: 580, growth: 5.0, tax: 25, employment: 95.5, business: 110, investment: 58, productivity: 62, inflation: 3.2, ipoPriceTarget: 7.15, ipoMarketCap: "715.00B", ipoUnderwriter: "Hunan Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 112.5 },
  { id: "CN.SC", name: "Sichuan", gdp: 720, growth: 5.5, tax: 32, employment: 95.2, business: 135, investment: 75, productivity: 60, inflation: 3.4, ipoPriceTarget: 8.95, ipoMarketCap: "895.00B", ipoUnderwriter: "Sichuan Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 125.5 },
  { id: "CN.YN", name: "Yunnan", gdp: 320, growth: 5.2, tax: 15, employment: 94.5, business: 58, investment: 42, productivity: 52, inflation: 3.1, ipoPriceTarget: 3.95, ipoMarketCap: "395.00B", ipoUnderwriter: "Yunnan Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 92.5 },
  { id: "CN.HB", name: "Hebei", gdp: 520, growth: 4.2, tax: 24, employment: 95.0, business: 95, investment: 48, productivity: 58, inflation: 3.0, ipoPriceTarget: 6.45, ipoMarketCap: "645.00B", ipoUnderwriter: "Hebei Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 108.5 },
  { id: "CN.HE", name: "Henan", gdp: 680, growth: 4.5, tax: 30, employment: 95.5, business: 125, investment: 55, productivity: 56, inflation: 3.1, ipoPriceTarget: 8.45, ipoMarketCap: "845.00B", ipoUnderwriter: "Henan Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 122.5 },
  { id: "CN.LN", name: "Liaoning", gdp: 350, growth: 3.5, tax: 22, employment: 94.2, business: 75, investment: 38, productivity: 62, inflation: 3.0, ipoPriceTarget: 4.35, ipoMarketCap: "435.00B", ipoUnderwriter: "Liaoning Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 95.5 },
  { id: "CN.SD", name: "Shandong", gdp: 1100, growth: 5.0, tax: 55, employment: 96.0, business: 220, investment: 95, productivity: 68, inflation: 3.3, ipoPriceTarget: 13.65, ipoMarketCap: "1.365T", ipoUnderwriter: "Shandong Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 155.5 },
  { id: "CN.TJ", name: "Tianjin", gdp: 280, growth: 4.2, tax: 18, employment: 95.2, business: 65, investment: 42, productivity: 72, inflation: 3.4, ipoPriceTarget: 3.45, ipoMarketCap: "345.00B", ipoUnderwriter: "Tianjin Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 88.5 },
  { id: "CN.JX", name: "Jiangxi", gdp: 380, growth: 5.5, tax: 18, employment: 95.0, business: 72, investment: 48, productivity: 58, inflation: 3.2, ipoPriceTarget: 4.75, ipoMarketCap: "475.00B", ipoUnderwriter: "Jiangxi Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 98.5 },
  { id: "CN.JS", name: "Jiangsu", gdp: 1400, growth: 5.2, tax: 65, employment: 96.5, business: 280, investment: 150, productivity: 75, inflation: 3.5, ipoPriceTarget: 17.35, ipoMarketCap: "1.735T", ipoUnderwriter: "Huatai Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 175.2 },
  { id: "CN.SH", name: "Shanghai", gdp: 550, growth: 4.8, tax: 48, employment: 96.8, business: 180, investment: 120, productivity: 92, inflation: 3.6, ipoPriceTarget: 6.85, ipoMarketCap: "685.00B", ipoUnderwriter: "Shanghai Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 115.0 },
  { id: "CN.ZJ", name: "Zhejiang", gdp: 950, growth: 5.8, tax: 52, employment: 96.8, business: 220, investment: 135, productivity: 78, inflation: 3.7, ipoPriceTarget: 11.75, ipoMarketCap: "1.175T", ipoUnderwriter: "Zhejiang Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 148.5 },
  { id: "CN.JL", name: "Jilin", gdp: 180, growth: 3.2, tax: 12, employment: 94.0, business: 38, investment: 22, productivity: 58, inflation: 2.9, ipoPriceTarget: 2.25, ipoMarketCap: "225.00B", ipoUnderwriter: "Jilin Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 82.5 },
  { id: "CN.NM", name: "Inner Mongolia", gdp: 280, growth: 4.0, tax: 15, employment: 94.5, business: 55, investment: 35, productivity: 54, inflation: 3.0, ipoPriceTarget: 3.45, ipoMarketCap: "345.00B", ipoUnderwriter: "Inner Mongolia Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 88.5 },
  { id: "CN.HL", name: "Heilongjiang", gdp: 200, growth: 2.8, tax: 14, employment: 93.8, business: 42, investment: 18, productivity: 56, inflation: 2.8, ipoPriceTarget: 2.45, ipoMarketCap: "245.00B", ipoUnderwriter: "Heilongjiang Securities", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 85.0 }
];

export const afghanistanSubdivisionsData = [
  { id: "AFKAB", name: "Kabul", gdp: 8, growth: 3.5, tax: 1.5, employment: 88.0, business: 12, investment: 3, productivity: 42, inflation: 5.0, ipoPriceTarget: 0.10, ipoMarketCap: "10.00B", ipoUnderwriter: "Kabul Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 38.5 },
  { id: "AFHER", name: "Herat", gdp: 3.5, growth: 3.0, tax: 0.8, employment: 86.5, business: 8, investment: 2, productivity: 40, inflation: 5.2, ipoPriceTarget: 0.04, ipoMarketCap: "4.35B", ipoUnderwriter: "Herat Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 35.5 },
  { id: "AFNAN", name: "Nangarhar", gdp: 2.8, growth: 2.8, tax: 0.6, employment: 85.0, business: 6, investment: 1.5, productivity: 38, inflation: 5.5, ipoPriceTarget: 0.03, ipoMarketCap: "3.48B", ipoUnderwriter: "Nangarhar Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 34.5 },
  { id: "AFBAL", name: "Balkh", gdp: 2.5, growth: 2.5, tax: 0.5, employment: 84.5, business: 5, investment: 1.2, productivity: 37, inflation: 5.8, ipoPriceTarget: 0.03, ipoMarketCap: "3.10B", ipoUnderwriter: "Balkh Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 34.0 },
  { id: "AFKAN", name: "Kandahar", gdp: 2.2, growth: 2.2, tax: 0.5, employment: 84.0, business: 5, investment: 1, productivity: 36, inflation: 6.0, ipoPriceTarget: 0.03, ipoMarketCap: "2.73B", ipoUnderwriter: "Kandahar Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 33.5 },
  { id: "AFKNR", name: "Kunar", gdp: 0.8, growth: 2.0, tax: 0.2, employment: 82.0, business: 2, investment: 0.5, productivity: 35, inflation: 5.5, ipoPriceTarget: 0.01, ipoMarketCap: "0.99B", ipoUnderwriter: "Kunar Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.5 },
  { id: "AFLAG", name: "Laghman", gdp: 0.6, growth: 1.8, tax: 0.15, employment: 81.5, business: 1.5, investment: 0.4, productivity: 34, inflation: 5.8, ipoPriceTarget: 0.01, ipoMarketCap: "0.74B", ipoUnderwriter: "Laghman Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.0 },
  { id: "AFLOG", name: "Logar", gdp: 0.7, growth: 2.2, tax: 0.18, employment: 82.5, business: 2, investment: 0.5, productivity: 35, inflation: 5.3, ipoPriceTarget: 0.01, ipoMarketCap: "0.86B", ipoUnderwriter: "Logar Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.2 },
  { id: "AFPKA", name: "Paktya", gdp: 0.9, growth: 2.5, tax: 0.22, employment: 83.0, business: 2.5, investment: 0.6, productivity: 36, inflation: 5.0, ipoPriceTarget: 0.01, ipoMarketCap: "1.11B", ipoUnderwriter: "Paktya Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.8 },
  { id: "AFPIA", name: "Paktika", gdp: 0.5, growth: 1.5, tax: 0.12, employment: 80.5, business: 1.2, investment: 0.3, productivity: 33, inflation: 6.2, ipoPriceTarget: 0.01, ipoMarketCap: "0.62B", ipoUnderwriter: "Paktika Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.5 },
  { id: "AFKHO", name: "Khost", gdp: 0.6, growth: 2.0, tax: 0.15, employment: 81.0, business: 1.5, investment: 0.4, productivity: 34, inflation: 5.7, ipoPriceTarget: 0.01, ipoMarketCap: "0.74B", ipoUnderwriter: "Khost Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.0 },
  { id: "AFNUR", name: "Nuristan", gdp: 0.3, growth: 1.2, tax: 0.08, employment: 79.0, business: 0.8, investment: 0.2, productivity: 32, inflation: 6.5, ipoPriceTarget: 0.00, ipoMarketCap: "0.37B", ipoUnderwriter: "Nuristan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.5 },
  { id: "AFKAP", name: "Kapisa", gdp: 0.4, growth: 1.8, tax: 0.1, employment: 80.5, business: 1, investment: 0.25, productivity: 33, inflation: 5.9, ipoPriceTarget: 0.00, ipoMarketCap: "0.49B", ipoUnderwriter: "Kapisa Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.2 },
  { id: "AFPAR", name: "Parwan", gdp: 0.5, growth: 2.0, tax: 0.12, employment: 81.5, business: 1.2, investment: 0.3, productivity: 34, inflation: 5.4, ipoPriceTarget: 0.01, ipoMarketCap: "0.62B", ipoUnderwriter: "Parwan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.8 },
  { id: "AFWAR", name: "Wardak", gdp: 0.45, growth: 1.9, tax: 0.11, employment: 81.0, business: 1.1, investment: 0.28, productivity: 33, inflation: 5.6, ipoPriceTarget: 0.01, ipoMarketCap: "0.56B", ipoUnderwriter: "Wardak Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.5 },
  { id: "AFBAM", name: "Bamyan", gdp: 0.35, growth: 1.5, tax: 0.09, employment: 80.0, business: 0.9, investment: 0.22, productivity: 32, inflation: 6.0, ipoPriceTarget: 0.00, ipoMarketCap: "0.43B", ipoUnderwriter: "Bamyan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.0 },
  { id: "AFGHA", name: "Ghazni", gdp: 1.2, growth: 2.3, tax: 0.3, employment: 83.5, business: 3, investment: 0.8, productivity: 37, inflation: 5.4, ipoPriceTarget: 0.01, ipoMarketCap: "1.48B", ipoUnderwriter: "Ghazni Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 33.5 },
  { id: "AFZAB", name: "Zabul", gdp: 0.4, growth: 1.6, tax: 0.1, employment: 80.5, business: 1, investment: 0.25, productivity: 33, inflation: 6.1, ipoPriceTarget: 0.00, ipoMarketCap: "0.49B", ipoUnderwriter: "Zabul Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.2 },
  { id: "AFURU", name: "Uruzgan", gdp: 0.35, growth: 1.4, tax: 0.09, employment: 79.5, business: 0.85, investment: 0.2, productivity: 32, inflation: 6.3, ipoPriceTarget: 0.00, ipoMarketCap: "0.43B", ipoUnderwriter: "Uruzgan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.8 },
  { id: "AFDAY", name: "Daykundi", gdp: 0.3, growth: 1.3, tax: 0.08, employment: 79.0, business: 0.8, investment: 0.18, productivity: 31, inflation: 6.4, ipoPriceTarget: 0.00, ipoMarketCap: "0.37B", ipoUnderwriter: "Daykundi Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.5 },
  { id: "AFFRA", name: "Farah", gdp: 0.5, growth: 1.7, tax: 0.12, employment: 81.0, business: 1.2, investment: 0.3, productivity: 33, inflation: 5.9, ipoPriceTarget: 0.01, ipoMarketCap: "0.62B", ipoUnderwriter: "Farah Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.5 },
  { id: "AFNIM", name: "Nimroz", gdp: 0.25, growth: 1.1, tax: 0.06, employment: 78.5, business: 0.6, investment: 0.15, productivity: 30, inflation: 6.6, ipoPriceTarget: 0.00, ipoMarketCap: "0.31B", ipoUnderwriter: "Nimroz Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.2 },
  { id: "AFHEL", name: "Hilmand", gdp: 1.5, growth: 2.0, tax: 0.35, employment: 82.0, business: 4, investment: 1, productivity: 35, inflation: 6.0, ipoPriceTarget: 0.02, ipoMarketCap: "1.85B", ipoUnderwriter: "Hilmand Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 33.8 },
  { id: "AFBDG", name: "Badghis", gdp: 0.35, growth: 1.3, tax: 0.09, employment: 79.5, business: 0.85, investment: 0.2, productivity: 31, inflation: 6.4, ipoPriceTarget: 0.00, ipoMarketCap: "0.43B", ipoUnderwriter: "Badghis Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.8 },
  { id: "AFFYB", name: "Faryab", gdp: 0.6, growth: 1.8, tax: 0.15, employment: 81.0, business: 1.2, investment: 0.3, productivity: 33, inflation: 5.9, ipoPriceTarget: 0.01, ipoMarketCap: "0.74B", ipoUnderwriter: "Faryab Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.5 },
  { id: "AFSAM", name: "Samangan", gdp: 0.4, growth: 1.6, tax: 0.1, employment: 80.5, business: 1, investment: 0.25, productivity: 32, inflation: 5.8, ipoPriceTarget: 0.00, ipoMarketCap: "0.49B", ipoUnderwriter: "Samangan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.2 },
  { id: "AFSAR", name: "Sari Pul", gdp: 0.38, growth: 1.5, tax: 0.09, employment: 80.0, business: 0.9, investment: 0.22, productivity: 31, inflation: 6.0, ipoPriceTarget: 0.00, ipoMarketCap: "0.47B", ipoUnderwriter: "Sari Pul Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.0 },
  { id: "AFBGL", name: "Baghlan", gdp: 0.9, growth: 2.2, tax: 0.22, employment: 82.5, business: 2.2, investment: 0.55, productivity: 35, inflation: 5.3, ipoPriceTarget: 0.01, ipoMarketCap: "1.11B", ipoUnderwriter: "Baghlan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.5 },
  { id: "AFTAK", name: "Takhar", gdp: 0.7, growth: 2.0, tax: 0.18, employment: 82.0, business: 1.8, investment: 0.45, productivity: 34, inflation: 5.5, ipoPriceTarget: 0.01, ipoMarketCap: "0.86B", ipoUnderwriter: "Takhar Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 32.2 },
  { id: "AFBDS", name: "Badakhshan", gdp: 0.5, growth: 1.7, tax: 0.12, employment: 81.0, business: 1.2, investment: 0.3, productivity: 33, inflation: 5.9, ipoPriceTarget: 0.01, ipoMarketCap: "0.62B", ipoUnderwriter: "Badakhshan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.5 },
  { id: "AFGHO", name: "Ghor", gdp: 0.32, growth: 1.4, tax: 0.08, employment: 79.8, business: 0.75, investment: 0.18, productivity: 31, inflation: 6.2, ipoPriceTarget: 0.00, ipoMarketCap: "0.40B", ipoUnderwriter: "Ghor Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 30.6 },
  { id: "AFJOW", name: "Jawzjan", gdp: 0.42, growth: 1.6, tax: 0.1, employment: 80.2, business: 0.95, investment: 0.22, productivity: 32, inflation: 5.9, ipoPriceTarget: 0.01, ipoMarketCap: "0.52B", ipoUnderwriter: "Jawzjan Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.0 },
  { id: "AFKDZ", name: "Kunduz", gdp: 0.55, growth: 1.8, tax: 0.12, employment: 81.5, business: 1.1, investment: 0.28, productivity: 33, inflation: 5.6, ipoPriceTarget: 0.01, ipoMarketCap: "0.68B", ipoUnderwriter: "Kunduz Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 31.8 },
  { id: "AFPAN", name: "Panjshayr", gdp: 0.15, growth: 1.0, tax: 0.04, employment: 78.5, business: 0.4, investment: 0.1, productivity: 30, inflation: 6.8, ipoPriceTarget: 0.00, ipoMarketCap: "0.19B", ipoUnderwriter: "Panjshayr Bank", ipoStatus: "pending", ipoCurrentPrice: 0.001, ipoProgress: 0, eoi: 29.5 }
];
