import fs from 'fs';

// Read the existing HTML file
const htmlContent = fs.readFileSync('sga_50_states_full_view.html', 'utf8');

// Extract the existing states array
const statesMatch = htmlContent.match(/const states = \[([\s\S]*?)\];/);
if (!statesMatch) {
  console.error('Could not find states array in HTML');
  process.exit(1);
}

const existingStatesStr = statesMatch[1];
console.log(`Found existing states array with ${existingStatesStr.split('],[').length} entries`);

// Parse existing states
const existingStates = new Set();
existingStatesStr.replace(/\[\s*"([^"]+)",\s*(\d+),\s*"([^"]+)"\s*\]/g, (match, name, gdp, country) => {
  existingStates.add(`${name}-${country}`);
  return match;
});

// Read DOSE regions
const doseContent = fs.readFileSync('dose_regions.txt', 'utf8');
const doseLines = doseContent.trim().split('\n');

console.log(`DOSE regions: ${doseLines.length}`);

// Find new regions from DOSE that aren't in existing HTML
const newRegions = [];
doseLines.forEach(line => {
  const match = line.match(/\[\s*"([^"]+)",\s*(\d+),\s*"([^"]+)"\s*\]/);
  if (match) {
    const [, name, gdp, country] = match;
    const key = `${name}-${country}`;
    if (!existingStates.has(key)) {
      newRegions.push(line);
    }
  }
});

console.log(`New regions to add: ${newRegions.length}`);

// Combine existing states with new regions
const combinedStates = existingStatesStr.trim() + ',\n' + newRegions.join(',\n');

// Replace the states array in the HTML
const newHtmlContent = htmlContent.replace(
  /const states = \[[\s\S]*?\];/,
  `const states = [\n${combinedStates}\n];`
);

// Update the title and other references
const updatedHtml = newHtmlContent
  .replace(/SGA — 470 States\/Provinces Worldwide/, `SGA — ${470 + newRegions.length} States/Provinces Worldwide`)
  .replace(/50 U\.S\. states \+ 50 international provinces\/states\/regions/, `50 U.S. states + ${420 + newRegions.length} international provinces/states/regions`)
  .replace(/470 entities/g, `${470 + newRegions.length} entities`)
  .replace(/split evenly across all 470/g, `split evenly across all ${470 + newRegions.length}`);

// Write the updated HTML
fs.writeFileSync('sga_50_states_full_view_updated.html', updatedHtml);
console.log(`Updated HTML written to sga_50_states_full_view_updated.html`);
console.log(`Total regions: ${470 + newRegions.length}`);