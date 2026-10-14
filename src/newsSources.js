// State Economic Development News Sources Configuration
// Maps state IDs to their official news/press release pages

export const STATE_NEWS_SOURCES = {
  AL: {
    name: "Alabama Department of Commerce",
    url: "https://www.madeinalabama.com/news/",
    feedUrl: "https://www.madeinalabama.com/feed/",
    selector: ".entry-title a"
  },
  BUSINESS_WIRE: {
    name: "Business Wire",
    url: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    feedUrl: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    selector: "item",
    isGlobal: true
  },
  BUSINESS_WIRE_JOBS: {
    name: "Business Wire Jobs",
    url: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    feedUrl: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    selector: "item",
    isGlobal: true,
    filterJobs: true
  },
  BUSINESS_WIRE_US: {
    name: "Business Wire United States",
    url: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    feedUrl: "https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJeEFtRWA==",
    selector: "item",
    isGlobal: true,
    filterJobs: true,
    region: "United States"
  },
  BUSINESS_WIRE_90_DAYS: {
    name: "Business Wire (90 Days)",
    url: "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==",
    feedUrl: "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==",
    selector: "item",
    isGlobal: true,
    dateRange: 90
  },
  AK: {
    name: "Alaska Department of Commerce",
    url: "https://www.commerce.alaska.gov/web/",
    feedUrl: null,
    selector: ".news-title a"
  },
  AZ: {
    name: "Arizona Commerce Authority",
    url: "https://www.azcommerce.com/news/",
    feedUrl: null,
    selector: ".news-item-title a"
  },
  AR: {
    name: "Arkansas Economic Development Commission",
    url: "https://www.arkansasedc.com/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  CA: {
    name: "California Governor's Office of Business and Economic Development",
    url: "https://business.ca.gov/newsroom/",
    feedUrl: null,
    selector: "h3 a"
  },
  CO: {
    name: "Colorado Office of Economic Development",
    url: "https://oedit.colorado.gov/news",
    feedUrl: null,
    selector: ".views-field-title a"
  },
  CT: {
    name: "Connecticut Department of Economic and Community Development",
    url: "https://portal.ct.gov/DECD",
    feedUrl: null,
    selector: ".news-title a"
  },
  DE: {
    name: "Delaware Prosperity Partnership",
    url: "https://choosedelaware.com/news/",
    feedUrl: null,
    selector: ".entry-title a"
  },
  FL: {
    name: "Florida Department of Economic Opportunity",
    url: "https://www.flchamber.com/member-news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  GA: {
    name: "Georgia Department of Economic Development",
    url: "https://gov.georgia.gov/press-releases",
    feedUrl: null,
    selector: "h2 a"
  },
  HI: {
    name: "Hawaii Department of Business, Economic Development & Tourism",
    url: "https://dbedt.hawaii.gov/news/",
    feedUrl: null,
    selector: ".entry-title a"
  },
  ID: {
    name: "Idaho Commerce",
    url: "https://commerce.idaho.gov/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  IL: {
    name: "Illinois Department of Commerce and Economic Opportunity",
    url: "https://dceo.illinois.gov/media/pressreleases.html",
    feedUrl: null,
    selector: ".press-release-title a"
  },
  IN: {
    name: "Indiana Economic Development Corporation",
    url: "https://www.iedc.in.gov/events/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  IA: {
    name: "Iowa Economic Development Authority",
    url: "https://www.iowaeda.com/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  KS: {
    name: "Kansas Department of Commerce",
    url: "https://www.kansascommerce.gov/news/",
    feedUrl: "https://www.kansascommerce.gov/feed",
    selector: ".news-title a"
  },
  KY: {
    name: "Kentucky Cabinet for Economic Development",
    url: "https://ced.ky.gov/Newsroom/News_Releases",
    feedUrl: null,
    selector: ".news-title a"
  },
  LA: {
    name: "Louisiana Economic Development",
    url: "https://www.opportunitylouisiana.gov/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  ME: {
    name: "Maine Department of Economic and Community Development",
    url: "https://www.maine.gov/decd/about/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  MD: {
    name: "Maryland Department of Commerce",
    url: "https://business.maryland.gov/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  MA: {
    name: "Massachusetts Executive Office of Economic Development",
    url: "https://www.mass.gov/orgs/executive-office-of-economic-development/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  MI: {
    name: "Michigan Economic Development Corporation",
    url: "https://www.michiganbusiness.org/press-releases/",
    feedUrl: null,
    selector: ".news-title a"
  },
  MN: {
    name: "Minnesota Department of Employment and Economic Development",
    url: "https://mn.gov/deed/newscenter/",
    feedUrl: null,
    selector: ".news-title a"
  },
  MS: {
    name: "Mississippi Development Authority",
    url: "https://mississippi.org/news/",
    feedUrl: "https://mississippi.org/feed/",
    selector: ".news-title a"
  },
  MO: {
    name: "Missouri Department of Economic Development",
    url: "https://ded.mo.gov/press-room",
    feedUrl: null,
    selector: ".press-release-title a"
  },
  MT: {
    name: "Montana Department of Commerce",
    url: "https://commerce.mt.gov/News",
    feedUrl: null,
    selector: ".news-title a"
  },
  NE: {
    name: "Nebraska Department of Economic Development",
    url: "https://opportunity.nebraska.gov/news/",
    feedUrl: "https://opportunity.nebraska.gov/news/feed",
    selector: ".news-title a"
  },
  NV: {
    name: "Nevada Governor's Office of Economic Development",
    url: "https://goed.nv.gov/newsroom/",
    feedUrl: null,
    selector: ".news-title a"
  },
  NH: {
    name: "New Hampshire Department of Business and Economic Affairs",
    url: null,
    feedUrl: null,
    selector: ".news-title a"
  },
  NJ: {
    name: "New Jersey Economic Development Authority",
    url: "https://www.njeda.gov/press-room/",
    feedUrl: null,
    selector: ".news-title a"
  },
  NM: {
    name: "New Mexico Economic Development Department",
    url: "https://edd.newmexico.gov/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  NY: {
    name: "New York State Department of Economic Development",
    url: "https://esd.ny.gov/esd-media-center/press-releases",
    feedUrl: null,
    selector: ".press-release-title a"
  },
  NC: {
    name: "North Carolina Department of Commerce",
    url: "https://www.commerce.nc.gov/news/press-releases",
    feedUrl: null,
    selector: "h2 a"
  },
  ND: {
    name: "North Dakota Department of Commerce",
    url: "https://commerce.nd.gov/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  OH: {
    name: "Ohio Department of Development",
    url: "https://www.jobsohio.com/newsroom/news-press",
    feedUrl: null,
    selector: ".news-title a"
  },
  OK: {
    name: "Oklahoma Department of Commerce",
    url: "https://okcommerce.gov/news/",
    feedUrl: "https://okcommerce.gov/news/feed",
    selector: ".news-title a"
  },
  OR: {
    name: "Business Oregon",
    url: null,
    feedUrl: null,
    selector: ".news-title a"
  },
  PA: {
    name: "Pennsylvania Department of Community and Economic Development",
    url: "https://dced.pa.gov/newsroom/",
    feedUrl: null,
    selector: ".news-title a"
  },
  RI: {
    name: "Rhode Island Commerce",
    url: "https://commerceri.com/articles/",
    feedUrl: null,
    selector: ".news-title a"
  },
  SC: {
    name: "South Carolina Department of Commerce",
    url: "https://www.sccommerce.com/news",
    feedUrl: null,
    selector: ".news-title a"
  },
  SD: {
    name: "South Dakota Governor's Office of Economic Development",
    url: "https://sdgoed.com/news/",
    feedUrl: "https://sdgoed.com/feed",
    selector: ".news-title a"
  },
  TN: {
    name: "Tennessee Department of Economic and Community Development",
    url: "https://tnecd.com/newsroom/",
    feedUrl: "https://tnecd.com/newsroom/feed",
    selector: ".news-title a"
  },
  TX: {
    name: "Texas Governor's Office",
    url: "https://gov.texas.gov/news",
    feedUrl: null,
    selector: "h3 a"
  },
  UT: {
    name: "Utah Governor's Office of Economic Opportunity",
    url: "https://business.utah.gov/news/",
    feedUrl: "https://business.utah.gov/feed",
    selector: ".news-title a"
  },
  VT: {
    name: "Vermont Department of Economic Development",
    url: "https://accd.vermont.gov/economic-development",
    feedUrl: null,
    selector: ".news-title a"
  },
  VA: {
    name: "Virginia Economic Development Partnership",
    url: "https://www.vedp.org/press-releases",
    feedUrl: null,
    selector: "h3 a"
  },
  WA: {
    name: "Washington State Department of Commerce",
    url: "https://www.commerce.wa.gov/news/",
    feedUrl: null,
    selector: ".news-title a"
  },
  WV: {
    name: "West Virginia Department of Economic Development",
    url: "https://westvirginia.gov/news/",
    feedUrl: "https://westvirginia.gov/news/feed",
    selector: ".news-title a"
  },
  WI: {
    name: "Wisconsin Economic Development Corporation",
    url: "https://wedc.org/news/",
    feedUrl: "https://wedc.org/feed/",
    selector: ".news-title a"
  },
  WY: {
    name: "Wyoming Business Council",
    url: "https://wyomingbusiness.org/news/",
    feedUrl: "https://wyomingbusiness.org/feed",
    selector: ".news-title a"
  }
};
