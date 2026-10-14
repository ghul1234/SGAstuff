// Node.js test script for the enhanced fetchFullPressRelease function
// This tests the function with a Utah news URL using DOMParser from jsdom

const { JSDOM } = await import('jsdom');
const fetch = (await import('node-fetch')).default;

const fetchFullPressRelease = async (url) => {
  try {
    if (!url) return null;

    // CORS proxies to bypass browser restrictions
    const CORS_PROXIES = [
      'http://localhost:3001/proxy?url=',
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
      'https://api.codetabs.com/v1/proxy?quest='
    ];

    let htmlText = null;
    let fetchError = null;

    // First, try direct fetch for areadevelopment.com (has local proxy)
    if (url.includes('areadevelopment.com')) {
      try {
        let proxiedUrl = url;
        if (url.startsWith('https://www.areadevelopment.com')) {
          proxiedUrl = url.replace('https://www.areadevelopment.com', '/api/areadevelopment');
        } else if (url.startsWith('http://www.areadevelopment.com')) {
          proxiedUrl = url.replace('http://www.areadevelopment.com', '/api/areadevelopment');
        } else if (url.startsWith('/')) {
          proxiedUrl = `/api/areadevelopment${url}`;
        }

        const response = await fetch(proxiedUrl);
        if (response.ok) {
          htmlText = await response.text();
        }
      } catch (error) {
        console.warn('Direct areadevelopment fetch failed:', error.message);
        fetchError = error;
      }
    }

    // If direct fetch failed or not areadevelopment.com, try CORS proxies
    if (!htmlText) {
      for (const proxy of CORS_PROXIES) {
        try {
          const response = await fetch(proxy + encodeURIComponent(url), {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
          });
          
          if (response.ok) {
            htmlText = await response.text();
            console.log(`Successfully fetched via proxy: ${proxy}`);
            break;
          }
        } catch (error) {
          console.warn(`Proxy ${proxy} failed:`, error.message);
          fetchError = error;
          continue;
        }
      }
    }

    if (!htmlText) {
      console.error('All fetch attempts failed for:', url);
      return null;
    }

    const dom = new JSDOM(htmlText);
    const doc = dom.window.document;

    // Try multiple content selectors for different website structures
    const contentEl = doc.querySelector('section.areaArticleBody') ||
      doc.querySelector('[itemprop="articleBody"]') ||
      doc.querySelector('.story-content') ||
      doc.querySelector('.article-body') ||
      doc.querySelector('.entry-content') ||
      doc.querySelector('.post-content') ||
      doc.querySelector('.field--name-body') ||
      doc.querySelector('.field--name-field-body') ||
      doc.querySelector('.news-content') ||
      doc.querySelector('.press-release-content') ||
      doc.querySelector('.content-body') ||
      doc.querySelector('.post-body') ||
      doc.querySelector('.node-content') ||
      doc.querySelector('.article-content') ||
      doc.querySelector('.main-content') ||
      doc.querySelector('article') ||
      doc.querySelector('.content') ||
      doc.querySelector('main') ||
      doc.querySelector('.post') ||
      doc.querySelector('.entry');

    if (contentEl) {
      // Remove elements that are sidebars, advertisements, or related articles to keep layout clean
      const toRemove = contentEl.querySelectorAll('script, style, iframe, aside, .sidebar, .ads, .advertisement, .related-items, .navigation, .comments, .share-buttons, .social-share, .author-box, .tags, .categories');
      toRemove.forEach(el => el.remove());

      // Return the clean HTML content of the article body
      const content = contentEl.innerHTML.trim();
      return content.length > 100 ? content : null; // Only return if we got substantial content
    }

    console.error('No content element found for:', url);
    return null;
  } catch (error) {
    console.error('Error fetching full press release:', error);
    return null;
  }
};

// Test with a Utah news URL
const testUrl = 'https://business.utah.gov/usbci-technical-assistance-partner-sbc-consulting-expands-post-program-financial-support-for-utah-small-businesses/';

console.log('Testing enhanced fetchFullPressRelease function...');
console.log('URL:', testUrl);

fetchFullPressRelease(testUrl).then(content => {
  if (content) {
    console.log('✅ SUCCESS: Content extracted!');
    console.log('Content length:', content.length);
    console.log('First 500 characters:', content.substring(0, 500));
  } else {
    console.log('❌ FAILED: Could not extract content');
  }
}).catch(error => {
  console.error('❌ ERROR:', error);
});