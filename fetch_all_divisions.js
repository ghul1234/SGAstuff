import fs from 'fs';
import fetch from 'node-fetch';

const API_BASE = 'https://openadmindata.org/api/v1';

async function fetchCountryData(countryCode) {
  const url = `${API_BASE}/countries/${countryCode}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  ✗ Failed to fetch ${countryCode}: HTTP ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.log(`  ✗ Failed to fetch ${countryCode}: ${error.message}`);
    return null;
  }
}

function extractFirstLevelDivisions(countryData, countryCode) {
  if (!countryData || !countryData.data) {
    return [];
  }
  
  // Get the first key in the data object (first-level divisions)
  const firstLevelKey = Object.keys(countryData.data)[0];
  const divisions = countryData.data[firstLevelKey] || [];
  
  return divisions.map(div => ({
    id: div.id,
    name_local: div.name_local,
    name_en: div.name_en,
    level: firstLevelKey,
    country: countryCode
  }));
}

async function main() {
  console.log('Fetching all countries list...');
  
  const countriesResponse = await fetch(`${API_BASE}/countries.json`);
  const countriesData = await countriesResponse.json();
  
  const allCountries = countriesData.countries;
  console.log(`Total countries available: ${allCountries.length}`);
  
  const allDivisions = [];
  const errors = [];
  
  // Process all countries
  for (const country of allCountries) {
    console.log(`Processing ${country.name_en} (${country.code})...`);
    
    const data = await fetchCountryData(country.code);
    
    if (data) {
      const divisions = extractFirstLevelDivisions(data, country.code);
      const firstLevelKey = Object.keys(data.data)[0];
      
      allDivisions.push({
        country: country.name_en,
        country_code: country.code,
        division_count: divisions.length,
        division_level: firstLevelKey,
        divisions: divisions
      });
      
      console.log(`  ✓ Found ${divisions.length} first-level divisions (${firstLevelKey})`);
    } else {
      errors.push({
        name: country.name_en,
        code: country.code
      });
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  const totalDivisions = allDivisions.reduce((sum, c) => sum + c.division_count, 0);
  console.log(`Total first-level administrative divisions: ${totalDivisions}`);
  console.log(`Countries successfully processed: ${allDivisions.length}`);
  console.log(`Countries failed: ${errors.length}`);
  
  // Save results to JSON file
  const results = {
    total_divisions: totalDivisions,
    countries_processed: allDivisions.length,
    countries_failed: errors.length,
    failed_countries: errors,
    data: allDivisions
  };
  
  fs.writeFileSync('all_admin_divisions.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to: all_admin_divisions.json');
  
  // Create a simple list format for merging
  const simpleList = [];
  allDivisions.forEach(country => {
    country.divisions.forEach(div => {
      simpleList.push({
        name: div.name_en,
        country: country.country,
        country_code: country.country_code,
        level: div.level
      });
    });
  });
  
  fs.writeFileSync('all_divisions_simple.json', JSON.stringify(simpleList, null, 2));
  console.log('Simple list saved to: all_divisions_simple.json');
}

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});