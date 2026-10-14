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
console.log(`Found existing states array`);

// Read the complete regions data
const completeRegions = fs.readFileSync('complete_regions.txt', 'utf8').trim();
console.log(`Loaded complete regions data`);

// Replace the states array in the HTML
const newHtmlContent = htmlContent.replace(
  /const states = \[[\s\S]*?\];/,
  `const states = [\n${completeRegions}\n];`
);

// Update the title and other references
const totalRegions = 2796;
const updatedHtml = newHtmlContent
  .replace(/SGA — \d+ States\/Provinces Worldwide/, `SGA — ${totalRegions} States/Provinces Worldwide`)
  .replace(/50 U\.S\. states \+ \d+ international provinces\/states\/regions/, `50 U.S. states + ${totalRegions - 50} international provinces/states/regions from 179 countries`)
  .replace(/\d+ entities/g, `${totalRegions} entities`)
  .replace(/split evenly across all \d+/g, `split evenly across all ${totalRegions}`)
  .replace(/all \d+ rows/g, `all ${totalRegions} entities`)
  .replace(/all \d+,\s*\% mode/g, `all ${totalRegions}, % mode`);

// Write the updated HTML
fs.writeFileSync('sga_50_states_full_view.html', updatedHtml);
console.log(`Updated HTML written with ${totalRegions} regions`);
console.log(`Real GDP data: 308 regions`);
console.log(`Estimated GDP: 2488 regions`);
console.log(`Countries covered: 179`);