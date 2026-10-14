/**
 * SGA Network - FRED Economic Data Service
 * Integrates your EOI formula with live macroeconomic statistics from the St. Louis Fed.
 */

const FRED_API_KEY = "d17f41ebca54367055d4a4f0f0c57b30";
const PROXY_BASE_URL = "/api/fred/fred/series/observations";

export class FREDService {
  /**
   * Helper method to fetch the latest observations from the Vite proxy endpoint
   * @param {string} seriesId FRED series identification code
   * @param {number} limit Number of recent observations to return
   */
  async fetchObservations(seriesId, limit = 2) {
    try {
      const url = `${PROXY_BASE_URL}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.observations || data.observations.length === 0) {
        throw new Error("Empty observations returned from FRED");
      }
      return data.observations.map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value)
      }));
    } catch (error) {
      console.warn(`FRED Ingest Failed for ${seriesId}:`, error.message);
      return null;
    }
  }

  /**
   * Evaluates and updates the state's macroeconomic data from live FRED series
   * @param {object} state Standard state object from statesData (data.js)
   */
  async getLiveStateEOI(state) {
    const stateCode = state.id;

    // Census Region CPI Index Series mapping on FRED
    const REGION_CPI_SERIES = {
      // Northeast
      ME: "CUUR0100SA0", NH: "CUUR0100SA0", VT: "CUUR0100SA0", MA: "CUUR0100SA0", RI: "CUUR0100SA0", CT: "CUUR0100SA0", NY: "CUUR0100SA0", NJ: "CUUR0100SA0", PA: "CUUR0100SA0",
      // Midwest
      OH: "CUUR0200SA0", IN: "CUUR0200SA0", IL: "CUUR0200SA0", MI: "CUUR0200SA0", WI: "CUUR0200SA0", MN: "CUUR0200SA0", IA: "CUUR0200SA0", MO: "CUUR0200SA0", ND: "CUUR0200SA0", SD: "CUUR0200SA0", NE: "CUUR0200SA0", KS: "CUUR0200SA0",
      // South
      DE: "CUUR0300SA0", MD: "CUUR0300SA0", VA: "CUUR0300SA0", WV: "CUUR0300SA0", NC: "CUUR0300SA0", SC: "CUUR0300SA0", GA: "CUUR0300SA0", FL: "CUUR0300SA0", KY: "CUUR0300SA0", TN: "CUUR0300SA0", AL: "CUUR0300SA0", MS: "CUUR0300SA0", AR: "CUUR0300SA0", LA: "CUUR0300SA0", OK: "CUUR0300SA0", TX: "CUUR0300SA0",
      // West
      MT: "CUUR0400SA0", ID: "CUUR0400SA0", WY: "CUUR0400SA0", CO: "CUUR0400SA0", NM: "CUUR0400SA0", AZ: "CUUR0400SA0", UT: "CUUR0400SA0", NV: "CUUR0400SA0", WA: "CUUR0400SA0", OR: "CUUR0400SA0", CA: "CUUR0400SA0", AK: "CUUR0400SA0", HI: "CUUR0400SA0"
    };
    
    // 1. Fetch live indicator series from FRED
    // GDP: Real GDP by State (Quarterly, Millions of Chained Dollars)
    const gdpData = await this.fetchObservations(`${stateCode}RQGSP`, 2);
    // Unemployment Rate: Monthly Percentage
    const urData = await this.fetchObservations(`${stateCode}UR`, 1);
    // Business Applications: Quarterly Counts (Not Seasonally Adjusted)
    const bizData = await this.fetchObservations(`BUSAPPWNSA${stateCode}`, 1);
    // Regional CPI Index Series: fetch 13 monthly values to compute YoY percent change
    const cpiSeries = REGION_CPI_SERIES[stateCode] || "CUUR0300SA0";
    const cpiData = await this.fetchObservations(cpiSeries, 13);
 
    // 2. Perform scaling and map data variables to local statesData ranges
    // a. Real GDP: FRED gives Millions (e.g. 3,100,000 for California). statesData is in Billions (e.g. 3600).
    // So: Millions / 1000 = Billions.
    let gdp = state.gdp;
    let growth = state.growth;
    if (gdpData && gdpData.length > 0) {
      gdp = Math.round(gdpData[0].value / 1000);
      
      // Calculate growth as percentage change if we have 2 quarters
      if (gdpData.length >= 2) {
        const currentQ = gdpData[0].value;
        const previousQ = gdpData[1].value;
        growth = parseFloat((((currentQ - previousQ) / previousQ) * 100).toFixed(2));
      }
    }
 
    // b. Employment Rate: In statesData, employment is the employment rate (e.g. 95.5%).
    // Unemployment rate is UR (e.g. 4.5%). Employment Rate = 100 - UR.
    let employment = state.employment;
    if (urData && urData.length > 0) {
      employment = parseFloat((100 - urData[0].value).toFixed(1));
    }
 
    // c. Business Applications: FRED quarterly applications (e.g. 130,000 for California). 
    // statesData is scaled (e.g. 950 for California). We scale to fit their data ranges:
    let business = state.business;
    if (bizData && bizData.length > 0) {
      const rawBiz = bizData[0].value;
      // Normalizing factor to align with statesData range (125 gives ~960 for California, fitting perfectly)
      business = Math.round(rawBiz / 125);
    }
 
    // d. Scale tax and productivity dynamically to align with GDP growth changes
    const gdpRatio = gdp / state.gdp;
    const tax = Math.round(state.tax * gdpRatio);
    const investment = Math.round(state.investment * (gdpRatio + (growth / 100)));
    const productivity = Math.round(state.productivity * (1 + (growth / 200)));

    // e. Calculate YoY Inflation from regional CPI observations
    let inflation = state.inflation;
    if (cpiData && cpiData.length >= 13) {
      const currentCPI = cpiData[0].value;
      const prevYearCPI = cpiData[12].value;
      if (prevYearCPI > 0) {
        inflation = parseFloat((((currentCPI - prevYearCPI) / prevYearCPI) * 100).toFixed(2));
      }
    }
 
    // Create the updated state parameters profile
    const updatedMetrics = {
      gdp,
      growth,
      tax,
      employment,
      business,
      investment,
      productivity,
      inflation
    };
 
    return updatedMetrics;
  }
 
  /**
   * Compares the previous index state to the live state and generates a news story
   * @param {object} state The state baseline info
   * @param {object} updatedMetrics The new metrics loaded from FRED
   * @param {number} prevEOI The previous EOI index calculation
   * @param {number} newEOI The newly calculated EOI index calculation
   */
  generateLiveNewsFlash(state, updatedMetrics, prevEOI, newEOI) {
    const delta = parseFloat((newEOI - prevEOI).toFixed(2));
    const isBullish = delta >= 0;
    
    // Choose the dominant driver
    let primaryDriver = "sustained structural stability";
    
    if (Math.abs(updatedMetrics.inflation - state.inflation) > 0.05) {
      const dir = updatedMetrics.inflation > state.inflation ? "increase" : "moderation";
      primaryDriver = `a recent ${dir} in regional consumer prices with YoY inflation settling at ${updatedMetrics.inflation}%`;
    } else if (Math.abs(updatedMetrics.growth - state.growth) > 0.1) {
      primaryDriver = `a shift in quarterly economic growth now at ${updatedMetrics.growth}%`;
    } else if (Math.abs(updatedMetrics.employment - state.employment) > 0.2) {
      const rate = (100 - updatedMetrics.employment).toFixed(1);
      primaryDriver = `an adjustment in the local unemployment rate now hovering at ${rate}%`;
    } else if (Math.abs(updatedMetrics.business - state.business) > 5) {
      primaryDriver = `a noticeable fluctuation in new business formation indices`;
    }
 
    const title = isBullish
      ? `${state.name} Sovereign EOI Climbs on Strong Indicators`
      : `${state.name} Sovereign EOI Adjusts in Latest Federal Release`;
 
    const description = isBullish
      ? `Official federal macroeconomic data registers an expansion in ${state.name}. Led by ${primaryDriver}, the updated Sovereign EOI calculations increase by +${delta} points to an index level of ${newEOI}.`
      : `Latest macroeconomic indicators reported via official federal channels show adjustments in ${state.name}. Driven by ${primaryDriver}, the Sovereign Growth EOI settles at ${newEOI} (representing a change of ${delta} points).`;
 
    return {
      id: Date.now(), // Using timestamp as ID - will be handled flexibly in article renderer
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stateId: state.id,
      title,
      description,
      sentiment: isBullish ? "Bullish" : "Bearish",
      impactScore: Math.round(delta * 100) // Convert EOI scale to market shock score
    };
  }

  /**
   * Fetches and parses the live Area Development RSS news feed into a JSON array,
   * dynamically matching articles to U.S. states based on keywords.
   * @param {Array} statesList The baseline states list to match against
   */
  async fetchRealEconomicNews(statesList) {
    try {
      const response = await fetch('/api/areadevelopment/rss/newsitems.xml');
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const items = xmlDoc.querySelectorAll("item");
      
      return Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const description = item.querySelector("description")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        const pubDate = item.querySelector("pubDate")?.textContent || "";
        
        // Strip out HTML tags from description (like images, paragraphs)
        const cleanDescription = description.replace(/<[^>]*>/g, '').trim();
        
        // Match the article to a state
        let matchedState = null;
        for (const state of statesList) {
          const regexName = new RegExp(`\\b${state.name}\\b`, 'i');
          const regexId = new RegExp(`\\b${state.id}\\b`);
          if (regexName.test(title) || regexName.test(cleanDescription) || regexId.test(title)) {
            matchedState = state;
            break;
          }
        }
        
        return {
          title,
          description: cleanDescription,
          link,
          pubDate,
          matchedState
        };
      });
    } catch (error) {
      console.warn("Area Development RSS Ingest Failed:", error.message);
      return [];
    }
  }
}
