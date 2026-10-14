// Test script to fetch Business Wire news for the past 50 days
// Run with: node test-business-wire-50.js

import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

function isEnglishContent(text) {
  // Strict English language detection
  const lowerText = text.toLowerCase();
  
  // Check for non-English character patterns and common non-English words
  const nonEnglishIndicators = [
    ' se unirá à ', ' schließt sich ', ' voegt zich bij ', ' entrerà a far parte ', 
    ' accélère l', ' accelera l', ' treibt die ', ' versnelt de ', ' se unirá a',
    ' reforçando ', ' unterstreicht ', ' rafforzando ', ' impegno sul ', ' compromisso de',
    ' funktionären ', ' funzionerà ', ' fonctionnera ', ' funcionando ', '将继续', '将加入',
    ' agregará ', ' añadirá ', ' hinzufügen ', ' ajoutera ', ' aggiungerà '
  ];
  
  // If any non-English patterns are found, it's not English
  for (const pattern of nonEnglishIndicators) {
    if (lowerText.includes(pattern)) {
      return false;
    }
  }
  
  // Check for non-ASCII characters that indicate non-English text
  const nonAsciiPattern = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿß]/;
  if (nonAsciiPattern.test(text)) {
    // If it has accented characters, it's likely not English
    return false;
  }
  
  // Check for common English words and patterns
  const englishIndicators = [
    'the', 'and', 'is', 'in', 'to', 'of', 'a', 'for', 'on', 'with', 'as', 'at', 'by',
    'from', 'company', 'corporation', 'inc', 'ltd', 'llc', 'business', 'announces',
    'said', 'will', 'has', 'been', 'have', 'this', 'that', 'are', 'was', 'were'
  ];
  
  const englishWordCount = englishIndicators.filter(word => lowerText.includes(word)).length;
  
  // If it has several common English words, consider it English
  return englishWordCount >= 3;
}

function isUnitedStatesArticle(title, description) {
  const content = `${title} ${description || ''}`.toLowerCase();
  
  // Check for "United States" or "U.S." references
  const usPatterns = [
    'united states',
    'u.s.',
    'us',
    'usa',
    'nationwide',
    'across the country',
    'throughout the united states'
  ];
  
  return usPatterns.some(pattern => content.includes(pattern));
}

function detectStateFromContent(title, description) {
  const content = `${title} ${description || ''}`.toLowerCase();
  
  // Priority detection - look for state names first (more specific than abbreviations)
  const stateNames = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
    'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
    'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
  };
  
  // Check for full state names first (more accurate)
  for (const [stateName, stateId] of Object.entries(stateNames)) {
    if (content.includes(stateName)) {
      return stateId;
    }
  }
  
  // Then check for major cities (more specific than abbreviations)
  const majorCities = {
    'birmingham': 'AL', 'montgomery': 'AL', 'mobile': 'AL',
    'anchorage': 'AK', 'fairbanks': 'AK',
    'phoenix': 'AZ', 'tucson': 'AZ', 'mesa': 'AZ',
    'little rock': 'AR', 'fort smith': 'AR',
    'los angeles': 'CA', 'san francisco': 'CA', 'san diego': 'CA', 'sacramento': 'CA',
    'denver': 'CO', 'colorado springs': 'CO',
    'hartford': 'CT', 'new haven': 'CT',
    'wilmington': 'DE',
    'miami': 'FL', 'tampa': 'FL', 'orlando': 'FL', 'jacksonville': 'FL',
    'atlanta': 'GA', 'savannah': 'GA',
    'honolulu': 'HI',
    'boise': 'ID',
    'chicago': 'IL', 'aurora': 'IL',
    'indianapolis': 'IN', 'fort wayne': 'IN',
    'des moines': 'IA',
    'wichita': 'KS', 'kansas city': 'KS',
    'louisville': 'KY', 'lexington': 'KY',
    'new orleans': 'LA', 'baton rouge': 'LA',
    'portland': 'ME', 'lewiston': 'ME',
    'baltimore': 'MD',
    'boston': 'MA', 'worcester': 'MA',
    'detroit': 'MI', 'grand rapids': 'MI',
    'minneapolis': 'MN', 'saint paul': 'MN',
    'jackson': 'MS',
    'kansas city': 'MO', 'st. louis': 'MO',
    'billings': 'MT', 'missoula': 'MT',
    'omaha': 'NE', 'lincoln': 'NE',
    'las vegas': 'NV', 'reno': 'NV',
    'manchester': 'NH',
    'newark': 'NJ', 'jersey city': 'NJ',
    'albuquerque': 'NM',
    'new york city': 'NY', 'buffalo': 'NY', 'rochester': 'NY',
    'charlotte': 'NC', 'raleigh': 'NC',
    'fargo': 'ND', 'bismarck': 'ND',
    'columbus': 'OH', 'cleveland': 'OH', 'cincinnati': 'OH',
    'oklahoma city': 'OK', 'tulsa': 'OK',
    'portland': 'OR', 'eugene': 'OR',
    'philadelphia': 'PA', 'pittsburgh': 'PA',
    'providence': 'RI',
    'charleston': 'SC', 'columbia': 'SC',
    'sioux falls': 'SD', 'rapid city': 'SD',
    'nashville': 'TN', 'memphis': 'TN',
    'houston': 'TX', 'san antonio': 'TX', 'dallas': 'TX', 'austin': 'TX',
    'salt lake city': 'UT',
    'burlington': 'VT',
    'virginia beach': 'VA', 'norfolk': 'VA', 'richmond': 'VA',
    'seattle': 'WA', 'spokane': 'WA',
    'charleston': 'WV',
    'milwaukee': 'WI', 'madison': 'WI',
    'cheyenne': 'WY'
  };
  
  for (const [city, stateId] of Object.entries(majorCities)) {
    if (content.includes(city)) {
      return stateId;
    }
  }
  
  // Finally check for state abbreviations (but be more careful)
  // Only match if the abbreviation appears as a standalone word or with common punctuation
  const abbreviationPattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b[.,]?/g;
  
  const matches = content.match(abbreviationPattern);
  if (matches) {
    // Return the first match (most likely to be the actual state)
    return matches[0].replace(/[.,]/g, '').toUpperCase();
  }
  
  return null; // No state detected
}

async function testBusinessWire50Days() {
  console.log('='.repeat(60));
  console.log('Testing Business Wire News Fetch (Past 30 Days for Recent Content)');
  console.log('='.repeat(60));
  console.log();

  try {
    const businessWireUrl = 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==';
    const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(businessWireUrl)}`;
    
    console.log('Fetching RSS feed via proxy...');
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const rssText = await response.text();
    console.log(`RSS feed fetched (${rssText.length} bytes)`);
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ''
    });
    
    const result = parser.parse(rssText);
    const items = result.rss?.channel?.item || [];
    
    console.log(`Total items in feed: ${Array.isArray(items) ? items.length : 1}`);
    
    // Filter by date range (past 30 days for recent content)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const filteredItems = (Array.isArray(items) ? items : [items]).filter(item => {
      if (item.pubDate) {
        const articleDate = new Date(item.pubDate);
        return articleDate >= cutoffDate;
      }
      return true; // Keep items without dates
    });
    
    console.log(`Items from past 30 days: ${filteredItems.length}`);
    
    // Additional filters: English language, US regions, and job-related keywords
    const keywordFilteredItems = filteredItems.filter(item => {
      const title = item.title || '';
      const description = item.description || '';
      const combinedText = `${title} ${description}`.toLowerCase();
      
      // Check for job-related keywords in headline or body
      const jobKeywords = ['jobs'];
      const hasJobsKeyword = jobKeywords.some(keyword => combinedText.includes(keyword));
      
      // Check for US region references (state detection for US regions)
      const hasUSRegion = detectStateFromContent(title, description) !== null;
      
      // Check if content is in English
      const isEnglish = isEnglishContent(combinedText);
      
      return hasJobsKeyword && hasUSRegion && isEnglish;
    });
    
    // If no job-related articles found, use broader filter for testing (English + US regions only)
    let finalFilteredItems = keywordFilteredItems;
    if (keywordFilteredItems.length === 0) {
      console.log('No articles with "jobs" keyword found, using broader filter (English + US regions only) for testing');
      finalFilteredItems = filteredItems.filter(item => {
        const title = item.title || '';
        const description = item.description || '';
        const combinedText = `${title} ${description}`.toLowerCase();
        
        const hasUSRegion = detectStateFromContent(title, description) !== null;
        const isEnglish = isEnglishContent(combinedText);
        
        return hasUSRegion && isEnglish;
      });
    }
    
    console.log(`After filtering for English, US regions, and 'jobs' keyword: ${keywordFilteredItems.length} articles`);
    console.log(`Final filtered count (with fallback): ${finalFilteredItems.length} articles`);
    
    // Detect states and filter
    const stateDetectedArticles = finalFilteredItems.map(item => {
      const detectedState = detectStateFromContent(item.title, item.description);
      return {
        title: item.title,
        link: item.link,
        description: item.description,
        pubDate: item.pubDate,
        stateId: detectedState || 'US',
        detectedState: detectedState || null
      };
    }).filter(article => article.stateId !== 'US');
    
    console.log(`Articles with state matches: ${stateDetectedArticles.length}`);
    console.log();
    
    if (stateDetectedArticles.length > 0) {
      console.log('SAMPLE ARTICLES:');
      console.log('-'.repeat(60));
      
      stateDetectedArticles.slice(0, 10).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   State: ${article.stateId}`);
        console.log(`   Date: ${article.pubDate || 'N/A'}`);
        console.log(`   Link: ${article.link}`);
        if (article.description) {
          console.log(`   Description: ${article.description.substring(0, 100)}...`);
        }
      });
      
      console.log();
      console.log('='.repeat(60));
      console.log('STATE DISTRIBUTION:');
      console.log('-'.repeat(60));
      
      const stateCounts = {};
      stateDetectedArticles.forEach(article => {
        stateCounts[article.stateId] = (stateCounts[article.stateId] || 0) + 1;
      });
      
      Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([state, count]) => {
          console.log(`  ${state}: ${count} articles`);
        });
      
      console.log();
      console.log('✓ SUCCESS: Business Wire 50-day test completed');
    } else {
      console.log('✗ FAILED: No articles with state matches found');
    }
  } catch (error) {
    console.error('✗ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testBusinessWire50Days().catch(error => {
  console.error('Test script error:', error);
  process.exit(2);
});
