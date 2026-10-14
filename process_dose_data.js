import fs from 'fs';

// Simple CSV parser for DOSE data
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }
  
  return data;
}

// Read and process the DOSE CSV data
try {
  const csvData = fs.readFileSync('DOSE_V2.14.csv', 'utf8');
  const data = parseCSV(csvData);
  
  // Extract 2019 data and unique regions
  const regions = new Map();
  
  data.forEach(row => {
    if (row.year === '2019') {
      const key = `${row.country}-${row.region}`;
      if (!regions.has(key)) {
        const gdp_usd = parseFloat(row.grp_pc_usd) * parseFloat(row.pop);
        const gdpMillions = Math.round(gdp_usd / 1e6);
        
        regions.set(key, {
          country: row.country,
          region: row.region,
          gdpMillions: gdpMillions,
          gdp_usd: gdp_usd,
          population: parseFloat(row.pop)
        });
      }
    }
  });
  
  const regionArray = Array.from(regions.values());
  console.log(`Extracted ${regionArray.length} unique regions for 2019`);
  
  // Group by country and count regions
  const countryCounts = {};
  regionArray.forEach(r => {
    countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
  });
  
  console.log('\nRegions by country (top 20):');
  Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([country, count]) => {
      console.log(`${country}: ${count}`);
    });
  
  // Convert to format similar to existing HTML
  const htmlFormat = regionArray.map(r => {
    return `["${r.region}",${r.gdpMillions},"${r.country}"]`;
  }).join(',\n');
  
  fs.writeFileSync('dose_regions.txt', htmlFormat);
  console.log(`\nData written to dose_regions.txt`);
  console.log(`Total regions: ${regionArray.length}`);
  
} catch (error) {
  console.error('Error processing data:', error.message);
  console.log('Make sure DOSE_V2.14.csv is in the current directory');
}