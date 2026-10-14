// News Fetcher Service
// Fetches news from state economic development websites using CORS proxy

import { STATE_NEWS_SOURCES } from './newsSources.js';
import { contentExtractor } from './contentExtractor.js';

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

// CORS proxy to bypass browser restrictions
const CORS_PROXIES = [
  'http://localhost:3001/proxy?url=',  // Local proxy server
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

class NewsFetcher {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes for better freshness
  }

  async fetchWithProxy(url) {
    // Add timeout to prevent hanging
    const timeout = 8000; // 8 seconds timeout per proxy
    
    for (const proxy of CORS_PROXIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(proxy + encodeURIComponent(url), {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        console.warn(`Proxy ${proxy} failed:`, error.message);
        continue;
      }
    }
    throw new Error('All CORS proxies failed');
  }

  parseHTML(html, selector) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = doc.querySelectorAll(selector);
    
    const articles = [];
    elements.forEach((element, index) => {
      const title = element.textContent?.trim();
      const link = element.href;
      if (title && link) {
        // Generate contextual description based on title content
        const lowerTitle = title.toLowerCase();
        let contextualDescription = "";
        
        if (lowerTitle.includes("expansion") || lowerTitle.includes("growth") || lowerTitle.includes("investment")) {
          contextualDescription = "Economic growth initiative driving business development and capital investment in the region.";
        } else if (lowerTitle.includes("jobs") || lowerTitle.includes("employment") || lowerTitle.includes("hiring")) {
          contextualDescription = "Workforce development and employment opportunity creation supporting regional economic stability.";
        } else if (lowerTitle.includes("funding") || lowerTitle.includes("grant") || lowerTitle.includes("investment") || lowerTitle.includes("million") || lowerTitle.includes("billion")) {
          contextualDescription = "Capital allocation and financial investment strengthening economic infrastructure and development.";
        } else if (lowerTitle.includes("appointment") || lowerTitle.includes("announces")) {
          contextualDescription = "Government leadership and administrative developments shaping economic policy direction.";
        } else {
          contextualDescription = "Economic development activity indicating evolving market conditions and regional business dynamics.";
        }
        
        articles.push({
          title,
          link,
          description: contextualDescription,
          source: 'external'
        });
      }
    });
    
    return articles.slice(0, 5); // Limit to 5 articles per state
  }

  async fetchStateNews(stateId) {
    const source = STATE_NEWS_SOURCES[stateId];
    if (!source) {
      console.warn(`No news source configured for state ${stateId}`);
      return [];
    }

    // Handle Business Wire global feed
    if (source.isGlobal) {
      return this.fetchBusinessWireNews(source.dateRange || null);
    }

    // Skip if no URL or feedUrl is configured
    if (!source.url && !source.feedUrl) {
      console.warn(`No URL or feedUrl configured for state ${stateId}`);
      return [];
    }

    // Check cache
    if (this.cache.has(stateId)) {
      const cached = this.cache.get(stateId);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`Using cached news for ${stateId}`);
        return cached.data;
      }
    }

    try {
      console.log(`Fetching news for ${source.name}...`);
      
      // Try RSS feed first if available (more reliable than HTML scraping)
      if (source.feedUrl) {
        try {
          const rssText = await this.fetchWithProxy(source.feedUrl);
          if (rssText) {
            const articles = this.parseRSS(rssText);
            if (articles.length > 0) {
              const enrichedArticles = articles.map(article => ({
                ...article,
                stateId,
                sentiment: this.analyzeSentiment(article.title),
                impactScore: this.calculateImpactScore(article.title)
              }));
              this.cache.set(stateId, { data: enrichedArticles, timestamp: Date.now() });
              return enrichedArticles;
            }
          }
        } catch (error) {
          console.warn(`RSS feed failed for ${stateId}:`, error.message);
        }
      }

      // Fallback to HTML parsing (may fail due to anti-bot protections)
      try {
        const html = await this.fetchWithProxy(source.url);
        if (!html) {
          console.warn(`HTML fetch returned empty for ${stateId}`);
          return [];
        }
        let articles;
        
        // Use custom parser for Virginia, Texas, North Carolina, Georgia, Tennessee, Florida, Ohio, Michigan, and California
        if (stateId === 'CA') {
          articles = this.parseCaliforniaHTML(html);
        } else if (stateId === 'GA') {
          articles = this.parseGeorgiaHTML(html);
        } else if (stateId === 'TN') {
          articles = this.parseTennesseeHTML(html);
        } else if (stateId === 'FL') {
          articles = this.parseFloridaHTML(html);
        } else if (stateId === 'OH') {
          articles = this.parseOhioHTML(html);
        } else if (stateId === 'MI') {
          articles = this.parseMichiganHTML(html);
        } else if (stateId === 'VA' || stateId === 'TX' || stateId === 'NC') {
          const baseUrl = stateId === 'NC' ? 'https://www.commerce.nc.gov' : 
                        stateId === 'VA' ? 'https://www.vedp.org' : 
                        stateId === 'TX' ? 'https://gov.texas.gov' : '';
          articles = this.parseVirginiaHTML(html, baseUrl);
        } else {
          articles = this.parseHTML(html, source.selector);
        }
        
        if (articles.length > 0) {
          const enrichedArticles = articles.map(article => ({
            ...article,
            stateId,
            sentiment: this.analyzeSentiment(article.title),
            impactScore: this.calculateImpactScore(article.title)
          }));
          this.cache.set(stateId, { data: enrichedArticles, timestamp: Date.now() });
          return enrichedArticles;
        }
      } catch (error) {
        console.warn(`HTML parsing failed for ${stateId}:`, error.message);
      }

      // Final fallback: Use RSS-Bridge CssSelectorBridge for problematic states
      if (['FL', 'OH'].includes(stateId)) {
        try {
          console.log(`Trying RSS-Bridge for ${stateId}...`);
          const rssBridgeUrl = this.buildRSSBridgeUrl(stateId, source.url);
          // Try local proxy first, then fallback to direct fetch
          let rssText;
          try {
            rssText = await this.fetchWithProxy(rssBridgeUrl);
          } catch (proxyError) {
            console.log(`Local proxy failed, trying direct fetch for RSS-Bridge...`);
            rssText = await fetch(rssBridgeUrl).then(res => res.text());
          }
          const articles = this.parseRSS(rssText);
          
          if (articles.length > 0) {
            const enrichedArticles = articles.map(article => ({
              ...article,
              stateId,
              sentiment: this.analyzeSentiment(article.title),
              impactScore: this.calculateImpactScore(article.title)
            }));
            this.cache.set(stateId, { data: enrichedArticles, timestamp: Date.now() });
            return enrichedArticles;
          }
        } catch (error) {
          console.warn(`RSS-Bridge failed for ${stateId}:`, error.message);
        }
      }

      // Return empty array if both RSS and HTML fail
      return [];
      
    } catch (error) {
      console.error(`Failed to fetch news for ${stateId}:`, error);
      return [];
    }
  }

  buildRSSBridgeUrl(stateId, url) {
    const baseUrl = 'https://rss-bridge.org/bridge01/';
    
    // Add CSS selectors based on state
    let urlSelector = '';
    if (stateId === 'FL') {
      urlSelector = 'h3 a';
    } else if (stateId === 'OH') {
      urlSelector = 'h3 a';
    }

    return `${baseUrl}?action=display&bridge=CssSelectorBridge&home_page=${url}&url_selector=${urlSelector}&limit=5`;
  }

  parseRSS(rssText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rssText, 'text/xml');
    const items = doc.querySelectorAll('item');
    
    const articles = [];
    items.forEach((item) => {
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const description = item.querySelector('description')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title && link) {
        articles.push({
          title,
          link,
          description,
          pubDate,
          source: 'rss'
        });
      }
    });
    
    return articles.slice(0, 5);
  }

  parseVirginiaHTML(html, baseUrl = '') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('h3 a, h2 a');
    
    const articles = [];
    links.forEach((link) => {
      const title = link.textContent.trim();
      const href = link.getAttribute('href'); // Use getAttribute to get the raw href
      
      if (title && href) {
        // Convert relative URLs to absolute URLs
        let absoluteUrl = href;
        if (href.startsWith('/')) {
          absoluteUrl = baseUrl + href;
        } else if (!href.startsWith('http')) {
          absoluteUrl = baseUrl + '/' + href;
        }
        
        articles.push({
          title,
          link: absoluteUrl,
          description: `Economic development announcement from state economic development agency regarding ${title.toLowerCase().includes('expansion') || title.toLowerCase().includes('investment') ? 'business growth and capital investment initiatives' : title.toLowerCase().includes('jobs') || title.toLowerCase().includes('employment') ? 'workforce development and employment opportunities' : 'regional economic activities and business climate developments'}.`,
          source: 'html'
        });
      }
    });
    
    return articles.slice(0, 5);
  }

  parseGeorgiaHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = [];
    
    // Try multiple selectors to find press release links
    const selectors = [
      'h2 a',
      'h3 a',
      '.views-field-title a',
      '.field--name-title a',
      '.node-title a',
      'a[href*="/press-release"]',
      'a[href*="/press-releases"]'
    ];
    
    for (const selector of selectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Georgia parser: Trying selector "${selector}" - found ${links.length} links`);
      
      if (links.length > 0) {
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (title && href && title.length > 20) {
            // Convert relative URLs to absolute URLs
            let absoluteUrl = href;
            if (href.startsWith('/')) {
              absoluteUrl = 'https://gov.georgia.gov' + href;
            } else if (!href.startsWith('http')) {
              absoluteUrl = 'https://gov.georgia.gov/' + href;
            }
            
            articles.push({
              title,
              link: absoluteUrl,
              description: `Official announcement from Georgia Department of Economic Development regarding ${title.toLowerCase().includes('appointment') ? 'leadership and administrative developments' : title.toLowerCase().includes('expansion') || title.toLowerCase().includes('investment') ? 'economic growth and business development initiatives' : 'regional economic activities and policy developments'}.`,
              source: 'html'
            });
          }
        });
        
        if (articles.length > 0) {
          console.log(`Georgia parser: Found ${articles.length} articles with selector "${selector}"`);
          break;
        }
      }
    }
    
    return articles.slice(0, 5);
  }

  parseTennesseeHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = [];
    
    // Try multiple selectors to find news links
    const selectors = [
      'h2 a',
      'h3 a',
      '.news-title a',
      '.views-field-title a',
      '.field--name-title a',
      '.node-title a',
      'a[href*="/news"]',
      '.article-title a',
      '.post-title a'
    ];
    
    for (const selector of selectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Tennessee parser: Trying selector "${selector}" - found ${links.length} links`);
      
      if (links.length > 0) {
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (title && href && title.length > 20) {
            // Try multiple methods to find description
            let description = '';
            
            // Method 1: Look for parent container and extract text
            const parent = link.closest('article, .news-item, .node, .post, .views-row, .item, .card, .entry');
            if (parent) {
              // Try specific description elements
              const descEl = parent.querySelector('.description, .summary, .field--name-body, .field--name-field-summary, .excerpt, .teaser, .news-summary, .content, .body, .text');
              if (descEl) {
                description = descEl.textContent.trim().substring(0, 200);
              } else {
                // Method 2: Get all paragraphs in parent
                const paragraphs = parent.querySelectorAll('p');
                if (paragraphs.length > 0) {
                  // Skip first paragraph if it's just the title
                  for (let p of paragraphs) {
                    const text = p.textContent.trim();
                    if (text.length > 50 && !text.includes(title)) {
                      description = text.substring(0, 200);
                      break;
                    }
                  }
                }
              }
            }
            
            // Method 3: Look for text content in the same container as the link
            if (!description) {
              const container = link.parentElement;
              if (container) {
                const textContent = container.textContent.replace(title, '').trim();
                if (textContent.length > 50) {
                  description = textContent.substring(0, 200);
                }
              }
            }
            
            // Method 4: Look for next sibling elements
            if (!description) {
              let nextEl = link.parentElement?.nextElementSibling;
              let attempts = 0;
              while (nextEl && attempts < 3) {
                const text = nextEl.textContent.trim();
                if (text.length > 50) {
                  description = text.substring(0, 200);
                  break;
                }
                nextEl = nextEl.nextElementSibling;
                attempts++;
              }
            }
            
            // Convert relative URLs to absolute URLs
            let absoluteUrl = href;
            if (href.startsWith('/')) {
              absoluteUrl = 'https://tnecd.com' + href;
            } else if (!href.startsWith('http')) {
              absoluteUrl = 'https://tnecd.com/' + href;
            }
            
            articles.push({
              title,
              link: absoluteUrl,
              description: description || `Economic development update from Tennessee Department of Economic and Community Development regarding ${title.toLowerCase().includes('jobs') || title.toLowerCase().includes('employment') ? 'workforce development and employment opportunities' : title.toLowerCase().includes('expansion') || title.toLowerCase().includes('investment') ? 'business growth and capital investment initiatives' : 'regional economic activities and business climate developments'}.`,
              source: 'html'
            });
          }
        });
        
        if (articles.length > 0) {
          console.log(`Tennessee parser: Found ${articles.length} articles with selector "${selector}"`);
          break;
        }
      }
    }
    
    return articles.slice(0, 5);
  }

  parseFloridaHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = [];
    
    // Try multiple selectors to find press release links
    const selectors = [
      'h2 a',
      'h3 a',
      '.news-title a',
      '.views-field-title a',
      '.field--name-title a',
      '.node-title a',
      'a[href*="/press"]',
      'a[href*="/news"]',
      '.article-title a',
      '.post-title a',
      '.press-release-title a'
    ];
    
    for (const selector of selectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Florida parser: Trying selector "${selector}" - found ${links.length} links`);
      
      if (links.length > 0) {
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (title && href && title.length > 20) {
            // Try multiple methods to find description
            let description = '';
            
            const parent = link.closest('article, .news-item, .node, .post, .views-row, .item, .card, .entry, .press-release');
            if (parent) {
              const descEl = parent.querySelector('.description, .summary, .field--name-body, .field--name-field-summary, .excerpt, .teaser, .news-summary, .content, .body, .text, p');
              if (descEl) {
                description = descEl.textContent.trim().substring(0, 200);
              }
            }
            
            // Convert relative URLs to absolute URLs
            let absoluteUrl = href;
            if (href.startsWith('/')) {
              absoluteUrl = 'https://www.flchamber.com' + href;
            } else if (!href.startsWith('http')) {
              absoluteUrl = 'https://www.flchamber.com/' + href;
            }
            
            articles.push({
              title,
              link: absoluteUrl,
              description: description || `Economic development announcement from Florida Department of Economic Opportunity regarding ${title.toLowerCase().includes('business') || title.toLowerCase().includes('jobs') ? 'business growth and employment opportunities' : title.toLowerCase().includes('investment') || title.toLowerCase().includes('funding') ? 'capital investment and economic development initiatives' : 'regional economic activities and business climate developments'}.`,
              source: 'html'
            });
          }
        });
        
        if (articles.length > 0) {
          console.log(`Florida parser: Found ${articles.length} articles with selector "${selector}"`);
          break;
        }
      }
    }
    
    return articles.slice(0, 5);
  }

  parseOhioHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = [];
    
    // Try multiple selectors to find news links
    const selectors = [
      'h2 a',
      'h3 a',
      'h4 a',
      '.news-title a',
      '.views-field-title a',
      '.field--name-title a',
      '.node-title a',
      'a[href*="/news"]',
      'a[href*="/press"]',
      '.article-title a',
      '.post-title a',
      '.press-release-title a',
      '.title a',
      '.card-title a',
      '.event-title a'
    ];
    
    for (const selector of selectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Ohio parser: Trying selector "${selector}" - found ${links.length} links`);
      
      if (links.length > 0) {
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute('href');
          
          console.log(`Ohio parser: Found link - title: "${title}", href: "${href}", title length: ${title.length}`);
          
          // Look for actual news article URLs (not navigation)
          // Filter out navigation items and target actual news articles
          if (title && href && title.length > 10 && 
              !title.includes('Newsroom') &&
              !title.includes('News Press') &&
              !title.includes('Ohio Blog') &&
              !title.includes('Ohio Success') &&
              !title.includes('Reports & Publications') &&
              !title.includes('Media Resources') &&
              !title.includes('Transparency') &&
              !title.includes('Ohio Data') &&
              !title.includes('English') &&
              (href.includes('/news-press/') || href.match(/\/[\w-]+$/) || href.length > 30)) {
            
            // Try multiple methods to find description
            let description = '';
            
            const parent = link.closest('article, .news-item, .node, .post, .views-row, .item, .card, .entry, .press-release, .event');
            if (parent) {
              const descEl = parent.querySelector('.description, .summary, .field--name-body, .field--name-field-summary, .excerpt, .teaser, .news-summary, .content, .body, .text, p');
              if (descEl) {
                description = descEl.textContent.trim().substring(0, 200);
              }
            }
            
            // Convert relative URLs to absolute URLs
            let absoluteUrl = href;
            if (href.startsWith('/')) {
              absoluteUrl = 'https://www.jobsohio.com' + href;
            } else if (!href.startsWith('http')) {
              absoluteUrl = 'https://www.jobsohio.com/' + href;
            }
            
            articles.push({
              title,
              link: absoluteUrl,
              description: description || `Economic development update from Ohio Department of Development regarding ${title.toLowerCase().includes('jobs') || title.toLowerCase().includes('employment') ? 'workforce development and employment opportunities' : title.toLowerCase().includes('expansion') || title.toLowerCase().includes('investment') ? 'business growth and capital investment initiatives' : 'regional economic activities and business climate developments'}.`,
              source: 'html'
            });
          }
        });
        
        if (articles.length > 0) {
          console.log(`Ohio parser: Found ${articles.length} articles with selector "${selector}"`);
          break;
        }
      }
    }
    
    return articles.slice(0, 5);
  }

  parseMichiganHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = [];
    
    // Try multiple selectors to find press release links
    const selectors = [
      'h2 a',
      'h3 a',
      '.news-title a',
      '.views-field-title a',
      '.field--name-title a',
      '.node-title a',
      'a[href*="/press"]',
      'a[href*="/news"]',
      '.article-title a',
      '.post-title a',
      '.press-release-title a'
    ];
    
    for (const selector of selectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Michigan parser: Trying selector "${selector}" - found ${links.length} links`);
      
      if (links.length > 0) {
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (title && href && title.length > 10) {
            // Try multiple methods to find description
            let description = '';
            
            const parent = link.closest('article, .news-item, .node, .post, .views-row, .item, .card, .entry, .press-release');
            if (parent) {
              const descEl = parent.querySelector('.description, .summary, .field--name-body, .field--name-field-summary, .excerpt, .teaser, .news-summary, .content, .body, .text, p');
              if (descEl) {
                description = descEl.textContent.trim().substring(0, 200);
              }
            }
            
            // Convert relative URLs to absolute URLs
            let absoluteUrl = href;
            if (href.startsWith('/')) {
              absoluteUrl = 'https://www.michiganbusiness.org' + href;
            } else if (!href.startsWith('http')) {
              absoluteUrl = 'https://www.michiganbusiness.org/' + href;
            }
            
            articles.push({
              title,
              link: absoluteUrl,
              description: description || `Press release from Michigan Economic Development Corporation`,
              source: 'html'
            });
          }
        });
        
        if (articles.length > 0) {
          console.log(`Michigan parser: Found ${articles.length} articles with selector "${selector}"`);
          break;
        }
      }
    }
    
    return articles.slice(0, 5);
  }

  parseCaliforniaHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('li a');
    
    const articles = [];
    links.forEach((link) => {
      const title = link.textContent.trim();
      const href = link.href;
      
      // Filter out navigation links (industries, programs, resources, etc.) and only keep news articles
      // News articles have longer titles and don't include "industries", "programs", "resources", or "about" in the URL
      if (title && href && href.includes('business.ca.gov') && 
          !href.includes('/industries/') && 
          !href.includes('/programs/') &&
          !href.includes('/resources/') &&
          !href.includes('/about/') &&
          title.length > 30) { // News articles typically have longer titles
        articles.push({
          title,
          link: href,
          description: `Press release from California Governor's Office of Business and Economic Development`,
          source: 'html'
        });
      }
    });
    
    return articles.slice(0, 5);
  }

  async fetchAllStatesNews() {
    const stateIds = Object.keys(STATE_NEWS_SOURCES);
    const allNews = [];
    
    // Fetch in smaller batches to avoid overwhelming the proxies
    const batchSize = 3; // Reduced from 5 to 3 for better performance
    for (let i = 0; i < stateIds.length; i += batchSize) {
      const batch = stateIds.slice(i, i + batchSize);
      const batchPromises = batch.map(stateId => 
        this.fetchStateNews(stateId).then(articles => ({
          stateId,
          articles
        }))
      );
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(({ stateId, articles }) => {
        articles.forEach(article => {
          // Generate contextual description if missing
          const description = article.description || (() => {
            const lowerTitle = article.title.toLowerCase();
            if (lowerTitle.includes("expansion") || lowerTitle.includes("growth") || lowerTitle.includes("investment")) {
              return "Economic growth initiative driving business development and capital investment in the region.";
            } else if (lowerTitle.includes("jobs") || lowerTitle.includes("employment") || lowerTitle.includes("hiring")) {
              return "Workforce development and employment opportunity creation supporting regional economic stability.";
            } else if (lowerTitle.includes("funding") || lowerTitle.includes("grant") || lowerTitle.includes("investment") || lowerTitle.includes("million") || lowerTitle.includes("billion")) {
              return "Capital allocation and financial investment strengthening economic infrastructure and development.";
            } else if (lowerTitle.includes("appointment") || lowerTitle.includes("announces")) {
              return "Government leadership and administrative developments shaping economic policy direction.";
            } else {
              return "Economic development activity indicating evolving market conditions and regional business dynamics.";
            }
          })();
          
          allNews.push({
            id: Date.now(), // Using timestamp as ID - will be handled flexibly in article renderer
            stateId,
            title: article.title,
            description: description,
            link: article.link,
            sentiment: this.analyzeSentiment(article.title),
            impactScore: this.calculateImpactScore(article.title),
            time: new Date().toLocaleTimeString(),
            source: 'external'
          });
        });
      });
      
      // Smaller delay between batches for faster loading
      if (i + batchSize < stateIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return allNews;
  }

  async fetchBusinessWireNews(days = null, filterJobs = false) {
    try {
      let sourceKey = 'BUSINESS_WIRE';
      if (filterJobs) {
        sourceKey = 'BUSINESS_WIRE_US'; // Use US-specific feed for jobs filtering
      }
      
      const source = STATE_NEWS_SOURCES[sourceKey];
      console.log(`Fetching Business Wire news${days ? ` for past ${days} days` : ''}${filterJobs ? ' with job filter' : ''}${source.region ? ` from ${source.region}` : ''}...`);
      
      // Try RSS feed first
      if (source.feedUrl) {
        try {
          const rssText = await this.fetchWithProxy(source.feedUrl);
          if (rssText) {
            const articles = this.parseRSS(rssText);
            
            // Filter by date range if specified
            let filteredArticles = articles;
            if (days) {
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - days);
              
              console.log(`Business Wire: Cutoff date: ${cutoffDate.toISOString()}`);
              console.log(`Business Wire: Total articles before date filter: ${articles.length}`);
              
              filteredArticles = articles.filter(article => {
                if (article.pubDate) {
                  const articleDate = new Date(article.pubDate);
                  const isRecent = articleDate >= cutoffDate;
                  if (!isRecent) {
                    console.log(`Business Wire: Skipped article from ${articleDate.toISOString()}: ${article.title?.substring(0, 50)}...`);
                  }
                  return isRecent;
                }
                return true; // Keep articles without dates if filtering
              });
              
              console.log(`Business Wire: Filtered to ${filteredArticles.length} articles from past ${days} days`);
            }
            
            // Filter for English-only content (articles with /en/ in URL)
            const englishOnlyArticles = filteredArticles.filter(article => {
              const isEnglish = article.link && article.link.includes('/en/');
              if (!isEnglish) {
                console.log(`Business Wire: Skipped non-English article: ${article.title?.substring(0, 50)}...`);
              }
              return isEnglish;
            });
            
            console.log(`Business Wire: Filtered to ${englishOnlyArticles.length} English-only articles`);
            filteredArticles = englishOnlyArticles;
            
            // Additional filters: English language, US regions, and job-related keywords (only if filterJobs is true)
            let keywordFilteredArticles = filteredArticles;
            if (filterJobs || source.filterJobs) {
              keywordFilteredArticles = filteredArticles.filter(article => {
                const title = (article.title || '').toLowerCase();
                const description = (article.description || '').toLowerCase();
                const combinedText = `${title} ${description}`;
                
                // Check for job-related keywords in headline or body
                const jobKeywords = ['jobs'];
                const hasJobsKeyword = jobKeywords.some(keyword => combinedText.includes(keyword));
                
                // Check for US region references (state detection for US regions)
                const hasUSRegion = detectStateFromContent(article.title, article.description) !== null;
                
                // Check if content is in English (basic check for common English words/patterns)
                const isEnglish = this.isEnglishContent(combinedText);
                
                return hasJobsKeyword && hasUSRegion && isEnglish;
              });
              
              // If no job-related articles found, use broader filter for testing (English + US regions only)
              if (keywordFilteredArticles.length === 0) {
                console.log('No articles with "jobs" keyword found, using broader filter (English + US regions only) for testing');
                console.log(`Business Wire: Articles available for fallback: ${filteredArticles.length}`);
                keywordFilteredArticles = filteredArticles.filter(article => {
                  const title = (article.title || '').toLowerCase();
                  const description = (article.description || '').toLowerCase();
                  const combinedText = `${title} ${description}`;
                  
                  const hasUSRegion = detectStateFromContent(article.title, article.description) !== null;
                  const isEnglish = this.isEnglishContent(combinedText);
                  
                  if (!hasUSRegion) {
                    console.log(`Business Wire: Skipped (no US region): ${article.title?.substring(0, 50)}...`);
                  }
                  if (!isEnglish) {
                    console.log(`Business Wire: Skipped (not English): ${article.title?.substring(0, 50)}...`);
                  }
                  
                  return hasUSRegion && isEnglish;
                });
              }
            }
            
            if (filterJobs || source.filterJobs) {
              console.log(`Business Wire: Final filtered count (with fallback if needed): ${keywordFilteredArticles.length} articles`);
            }
            
            const stateDetectedArticles = keywordFilteredArticles.map(article => {
              const detectedState = detectStateFromContent(article.title, article.description);
              return {
                ...article,
                stateId: detectedState || 'US', // Default to US if no state detected
                detectedState: detectedState || null
              };
            });
            
            console.log(`Business Wire: Found ${stateDetectedArticles.length} articles with state matches`);
            return stateDetectedArticles.slice(0, 20); // Increased limit for date range queries
          }
        } catch (error) {
          console.warn('Business Wire RSS failed:', error.message);
        }
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch Business Wire news:', error);
      return [];
    }
  }

  isEnglishContent(text) {
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

  isUnitedStatesArticle(title, description) {
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

  analyzeSentiment(title) {
    const bullishKeywords = [
      'expansion', 'growth', 'investment', 'create', 'jobs', 'award', 
      'grant', 'fund', 'announce', 'launch', 'new', 'increase', 'record',
      'success', 'partnership', 'development', 'innovation', 'breakthrough'
    ];
    
    const bearishKeywords = [
      'closure', 'layoff', 'cut', 'loss', 'decline', 'recession', 
      'crisis', 'bankruptcy', 'shutdown', 'reduce', 'struggle', 'challenge'
    ];
    
    const lowerTitle = title.toLowerCase();
    const bullishCount = bullishKeywords.filter(keyword => lowerTitle.includes(keyword)).length;
    const bearishCount = bearishKeywords.filter(keyword => lowerTitle.includes(keyword)).length;
    
    if (bullishCount > bearishCount) return 'Bullish';
    if (bearishCount > bullishCount) return 'Bearish';
    return 'Neutral';
  }

  calculateImpactScore(title) {
    const highImpactKeywords = [
      'billion', 'million', 'thousand', 'jobs', 'investment', 
      'expansion', 'major', 'significant', 'record', 'award'
    ];
    
    const lowerTitle = title.toLowerCase();
    const impactCount = highImpactKeywords.filter(keyword => lowerTitle.includes(keyword)).length;
    
    // Base score 30, add 10 for each impact keyword, max 90
    return Math.min(30 + (impactCount * 10), 90);
  }

  clearCache() {
    this.cache.clear();
  }
}

export const newsFetcher = new NewsFetcher();
