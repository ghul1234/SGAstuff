// Content Extractor Service
// Automatically extracts main content from web pages similar to RSS.app
// Uses browser's DOMParser for article detection

class ContentExtractor {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  async extractArticlesFromPage(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const document = doc;
    
    console.log(`Content extractor: Parsing ${baseUrl}`);
    
    const articles = [];
    
    // Try to find article links using multiple heuristics
    const potentialArticleLinks = this.findPotentialArticleLinks(document, baseUrl);
    console.log(`Content extractor: Found ${potentialArticleLinks.length} potential article links`);
    
    for (const link of potentialArticleLinks) {
      const title = link.textContent.trim();
      const href = link.getAttribute('href');
      
      console.log(`Content extractor: Checking link - title: "${title}", href: "${href}"`);
      
      // Filter out non-HTTP links
      if (href && (href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('#'))) {
        console.log(`Content extractor: Skipping non-HTTP link - ${href}`);
        continue;
      }
      
      if (title && href && this.isLikelyArticle(title, href)) {
        console.log(`Content extractor: Article accepted - ${title}`);
        // Extract description from nearby content
        const description = this.extractDescription(link);
        
        articles.push({
          title,
          link: this.resolveUrl(href, baseUrl),
          description: description || `Article from ${new URL(baseUrl).hostname}`,
          source: 'extracted'
        });
      }
      
      if (articles.length >= 5) break; // Limit to 5 articles
    }
    
    console.log(`Content extractor: Returning ${articles.length} articles`);
    return articles;
  }

  findPotentialArticleLinks(document, baseUrl) {
    const links = [];
    
    // Look for links in common article containers
    const selectors = [
      'article a',
      '.post a',
      '.entry a',
      '.news-item a',
      '.article a',
      'h2 a',
      'h3 a',
      'h4 a',
      '.title a',
      '.headline a',
      'a[href*="/news-press/"]',
      'a[href*="/news/"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        links.push(element);
      }
    }
    
    // Also look for links with article-like patterns
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (this.isLikelyArticleUrl(href)) {
        links.push(link);
      }
    }
    
    return links;
  }

  isLikelyArticle(title, href) {
    // Check if URL looks like an article first (more reliable than title)
    if (this.isLikelyArticleUrl(href)) {
      // If URL is good, accept even with short/empty title
      return true;
    }
    
    // Check if title looks like an article (not navigation)
    if (title.length < 15) return false;
    
    // Exclude common navigation terms
    const navTerms = ['home', 'about', 'contact', 'login', 'register', 'search', 'menu', 'subscribe', 'follow', 'share'];
    const lowerTitle = title.toLowerCase();
    if (navTerms.some(term => lowerTitle.includes(term))) return false;
    
    return true;
  }

  isLikelyArticleUrl(href) {
    if (!href) return false;
    
    // URLs with dates are likely articles
    if (href.match(/\d{4}/)) return true;
    
    // URLs with common article patterns
    const articlePatterns = [
      /\/article\//,
      /\/news\//,
      /\/post\//,
      /\/blog\//,
      /\/press\//,
      /\/news-press\//,
      /\/story\//,
      /-\d{4}/,
      /-\d{2}-\d{2}/
    ];
    
    return articlePatterns.some(pattern => pattern.test(href));
  }

  extractDescription(link) {
    // Try to find description from nearby elements
    const parent = link.closest('article, .post, .entry, .news-item, .item, .card');
    if (parent) {
      const descElements = parent.querySelectorAll('p, .excerpt, .summary, .description, .teaser');
      for (const element of descElements) {
        const text = element.textContent.trim();
        if (text.length > 50 && text.length < 500) {
          return text.substring(0, 200);
        }
      }
    }
    
    // Try next sibling
    const nextSibling = link.parentElement?.nextElementSibling;
    if (nextSibling) {
      const text = nextSibling.textContent.trim();
      if (text.length > 50 && text.length < 500) {
        return text.substring(0, 200);
      }
    }
    
    return '';
  }

  resolveUrl(href, baseUrl) {
    try {
      const base = new URL(baseUrl);
      return new URL(href, base).href;
    } catch (error) {
      return href;
    }
  }

  async generateRSSFeed(articles, siteUrl, siteName) {
    const items = articles.map(article => `
      <item>
        <title>${this.escapeXml(article.title)}</title>
        <link>${article.link}</link>
        <description>${this.escapeXml(article.description || '')}</description>
        <pubDate>${new Date().toUTCString()}</pubDate>
      </item>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}</link>
    <description>Generated RSS feed for ${siteName}</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`;
  }

  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const contentExtractor = new ContentExtractor();
