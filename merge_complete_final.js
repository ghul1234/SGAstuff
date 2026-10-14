import fs from 'fs';

// Load all administrative divisions
const allDivisions = JSON.parse(fs.readFileSync('all_divisions_simple.json', 'utf8'));
console.log(`Loaded ${allDivisions.length} administrative divisions`);

// Load DOSE GDP data (it's in HTML array format, not JSON)
const doseText = fs.readFileSync('dose_regions.txt', 'utf8');
const doseData = doseText.split('\n').map(line => {
  const match = line.match(/\[\s*"([^"]+)",\s*(\d+),\s*"([^"]+)"\s*\]/);
  if (match) {
    return { name: match[1], gdp: parseInt(match[2]), country: match[3] };
  }
  return null;
}).filter(Boolean);

console.log(`Loaded ${doseData.length} regions with GDP data from DOSE`);

// Create a map of DOSE data for quick lookup
const doseMap = new Map();
doseData.forEach(d => {
  doseMap.set(`${d.name}-${d.country}`, d.gdp);
});

// Create country GDP averages for estimation (using median to avoid skew)
const countryGdps = {};
doseData.forEach(d => {
  if (!countryGdps[d.country]) {
    countryGdps[d.country] = [];
  }
  countryGdps[d.country].push(d.gdp);
});

const countryGdpMedians = {};
Object.keys(countryGdps).forEach(country => {
  const sorted = countryGdps[country].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  countryGdpMedians[country] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
});

// Global median for countries without any data
const allCountryMedians = Object.values(countryGdpMedians);
allCountryMedians.sort((a, b) => a - b);
const globalGdpMedian = allCountryMedians[Math.floor(allCountryMedians.length / 2)];
console.log(`Global median GDP per region: $${Math.round(globalGdpMedian)}M`);

// Merge and estimate GDP
const mergedData = [];
let realGdpCount = 0;
let estimatedGdpCount = 0;

allDivisions.forEach(division => {
  const key = `${division.name}-${division.country}`;
  const existingGdp = doseMap.get(key);
  
  if (existingGdp) {
    mergedData.push({
      name: division.name,
      gdp: existingGdp,
      country: division.country,
      source: 'DOSE'
    });
    realGdpCount++;
  } else {
    // Estimate GDP using median
    let estimatedGdp;
    
    if (countryGdpMedians[division.country]) {
      // Use country median if available
      estimatedGdp = Math.round(countryGdpMedians[division.country]);
    } else {
      // Use global median as fallback
      estimatedGdp = Math.round(globalGdpMedian);
    }
    
    // Add some variation to avoid all estimates being identical (0.5 to 1.5 range)
    const variation = 0.5 + (Math.random() * 1.0); 
    estimatedGdp = Math.round(estimatedGdp * variation);
    
    // Ensure minimum GDP of 1000M to avoid extremely small values
    estimatedGdp = Math.max(estimatedGdp, 1000);
    
    mergedData.push({
      name: division.name,
      gdp: estimatedGdp,
      country: division.country,
      source: 'estimated'
    });
    estimatedGdpCount++;
  }
});

console.log(`Real GDP data: ${realGdpCount} regions`);
console.log(`Estimated GDP: ${estimatedGdpCount} regions`);
console.log(`Total: ${mergedData.length} regions`);
console.log(`Countries with real GDP data: ${Object.keys(countryGdpMedians).length}`);

// Convert to HTML format
const htmlFormat = mergedData.map(d => {
  return `["${d.name}",${d.gdp},"${d.country}"]`;
}).join(',\n');

fs.writeFileSync('complete_regions.txt', htmlFormat);
console.log('Complete regions data written to complete_regions.txt');

// Create statistics
const stats = {
  total_regions: mergedData.length,
  real_gdp: realGdpCount,
  estimated_gdp: estimatedGdpCount,
  countries: [...new Set(mergedData.map(d => d.country))].length,
  countries_with_real_data: Object.keys(countryGdpMedians).length,
  global_median_gdp: Math.round(globalGdpMedian),
  top_10_regions: mergedData.sort((a, b) => b.gdp - a.gdp).slice(0, 10)
};

fs.writeFileSync('merge_stats.json', JSON.stringify(stats, null, 2));
console.log('Statistics written to merge_stats.json');