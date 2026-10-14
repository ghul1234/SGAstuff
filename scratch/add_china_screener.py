import re
import os

main_js_path = r"d:\SGAs\sga-website\src\main.js"

with open(main_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# ----------------------------------------------------
# 1. Update Exchange Options in HTML Dropdowns & Targets
# ----------------------------------------------------
sse_option_select = '          <option value="SSE">🇨🇳 SSE - Shanghai Stock Exchange</option>\n          <option value="SZSE">🇨🇳 SZSE - Shenzhen Stock Exchange</option>\n'
sse_option_gov = '                                <option value="SSE">SSE - Shanghai (China)</option>\n                                <option value="SZSE">SZSE - Shenzhen (China)</option>\n'
sse_option_gainers = '                    <option value="SSE">🇨🇳 SSE (Shanghai)</option>\n                    <option value="SZSE">🇨🇳 SZSE (Shenzhen)</option>\n'

if '<option value="SSE">' not in code:
    # Header select
    code = code.replace(
        '<option value="TSE_JP">TSE - Japan</option>',
        '<option value="TSE_JP">TSE - Japan</option>\n' + sse_option_select
    )
    # Gov select
    code = code.replace(
        '<option value="TSE_JP">TSE (Japan)</option>',
        '<option value="TSE_JP">TSE (Japan)</option>\n' + sse_option_gov
    )
    # Gainers filter
    code = code.replace(
        '<option value="TSE_JP">🇯🇵 TSE (Japan)</option>',
        '<option value="TSE_JP">🇯🇵 TSE (Japan)</option>\n' + sse_option_gainers
    )

# Update ex list arrays in banExchange / updateGovModalUI
old_ex_list = "'NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP'"
new_ex_list = "'NASDAQ','NYSE','LSE','XETRA','TSE','HKEX','TADAWUL','NSE','ASX','SIX','BM','TSE_JP','SSE','SZSE'"
code = code.replace(old_ex_list, new_ex_list)

# ----------------------------------------------------
# 2. Add SSE & SZSE to exchangeData
# ----------------------------------------------------
sse_szse_data = """,
    SSE: { 
        name: 'SSE Shanghai', country: 'China', currency: 'CNY', flag: '🇨🇳', 
        stocks: [
            { symbol: '600519', name: 'Kweichow Moutai (贵州茅台)', price: 1720.50, change: 18.20, changePercent: 1.07, sector: 'Consumer Staples', marketCap: '¥2.16T', volume: '3.82M', peRatio: 29.4, '52wHigh': 1850.00, '52wLow': 1580.00 },
            { symbol: '601398', name: 'Industrial & Commercial Bank (工商银行)', price: 5.84, change: 0.05, changePercent: 0.86, sector: 'Financials', marketCap: '¥2.08T', volume: '88.4M', peRatio: 5.8, '52wHigh': 6.12, '52wLow': 4.72 },
            { symbol: '601857', name: 'PetroChina (中国石油)', price: 8.42, change: -0.12, changePercent: -1.41, sector: 'Energy', marketCap: '¥1.54T', volume: '45.1M', peRatio: 9.2, '52wHigh': 10.15, '52wLow': 7.10 },
            { symbol: '601988', name: 'Bank of China (中国银行)', price: 4.52, change: 0.03, changePercent: 0.67, sector: 'Financials', marketCap: '¥1.33T', volume: '62.0M', peRatio: 5.4, '52wHigh': 4.88, '52wLow': 3.95 },
            { symbol: '601288', name: 'Agricultural Bank of China (农业银行)', price: 4.28, change: 0.04, changePercent: 0.94, sector: 'Financials', marketCap: '¥1.50T', volume: '75.3M', peRatio: 5.6, '52wHigh': 4.55, '52wLow': 3.60 },
            { symbol: '601628', name: 'China Life Insurance (中国人寿)', price: 32.10, change: 0.85, changePercent: 2.72, sector: 'Financials', marketCap: '¥907B', volume: '18.4M', peRatio: 18.2, '52wHigh': 36.50, '52wLow': 26.10 },
            { symbol: '600036', name: 'China Merchants Bank (招商银行)', price: 34.80, change: 0.60, changePercent: 1.75, sector: 'Financials', marketCap: '¥877B', volume: '28.9M', peRatio: 6.1, '52wHigh': 38.20, '52wLow': 29.50 },
            { symbol: '600028', name: 'Sinopec Corp (中国石化)', price: 6.35, change: -0.05, changePercent: -0.78, sector: 'Energy', marketCap: '¥772B', volume: '38.5M', peRatio: 11.4, '52wHigh': 7.10, '52wLow': 5.40 },
            { symbol: '601088', name: 'China Shenhua Energy (中国神华)', price: 41.20, change: 0.95, changePercent: 2.36, sector: 'Energy', marketCap: '¥818B', volume: '14.2M', peRatio: 13.5, '52wHigh': 44.80, '52wLow': 31.20 },
            { symbol: '600900', name: 'China Yangtze Power (长江电力)', price: 29.80, change: 0.35, changePercent: 1.19, sector: 'Utilities', marketCap: '¥729B', volume: '22.1M', peRatio: 22.8, '52wHigh': 31.50, '52wLow': 22.80 },
            { symbol: '601318', name: 'Ping An Insurance SSE (中国平安)', price: 45.60, change: 1.20, changePercent: 2.70, sector: 'Financials', marketCap: '¥831B', volume: '35.4M', peRatio: 9.8, '52wHigh': 52.00, '52wLow': 37.80 },
            { symbol: '600030', name: 'CITIC Securities (中信证券)', price: 19.85, change: 0.45, changePercent: 2.32, sector: 'Financials', marketCap: '¥294B', volume: '41.2M', peRatio: 14.8, '52wHigh': 24.20, '52wLow': 17.50 },
            { symbol: '601899', name: 'Zijin Mining Group (紫金矿业)', price: 17.45, change: 0.65, changePercent: 3.87, sector: 'Materials', marketCap: '¥460B', volume: '58.9M', peRatio: 18.5, '52wHigh': 19.80, '52wLow': 11.20 },
            { symbol: '600276', name: 'Jiangsu Hengrui Pharma (恒瑞医药)', price: 42.15, change: -0.35, changePercent: -0.82, sector: 'Healthcare', marketCap: '¥268B', volume: '12.4M', peRatio: 48.2, '52wHigh': 49.80, '52wLow': 36.20 },
            { symbol: '600104', name: 'SAIC Motor Corp (上汽集团)', price: 14.85, change: 0.15, changePercent: 1.02, sector: 'Consumer Discretionary', marketCap: '¥171B', volume: '15.8M', peRatio: 12.1, '52wHigh': 17.20, '52wLow': 13.10 },
            { symbol: '601668', name: 'China State Construction (中国建筑)', price: 5.68, change: 0.08, changePercent: 1.43, sector: 'Industrials', marketCap: '¥236B', volume: '52.1M', peRatio: 4.3, '52wHigh': 6.25, '52wLow': 4.80 },
            { symbol: '600000', name: 'Shanghai Pudong Dev Bank (浦发银行)', price: 8.12, change: 0.10, changePercent: 1.25, sector: 'Financials', marketCap: '¥238B', volume: '19.4M', peRatio: 6.8, '52wHigh': 9.10, '52wLow': 6.40 },
            { symbol: '600887', name: 'Inner Mongolia Yili (伊利股份)', price: 26.40, change: -0.15, changePercent: -0.57, sector: 'Consumer Staples', marketCap: '¥168B', volume: '16.2M', peRatio: 16.2, '52wHigh': 30.50, '52wLow': 24.10 },
            { symbol: '601728', name: 'China Telecom (中国电信)', price: 6.15, change: 0.07, changePercent: 1.15, sector: 'Communication', marketCap: '¥562B', volume: '28.4M', peRatio: 17.5, '52wHigh': 6.80, '52wLow': 4.90 },
            { symbol: '600941', name: 'China Mobile SSE (中国移动)', price: 104.50, change: 1.80, changePercent: 1.75, sector: 'Communication', marketCap: '¥2.23T', volume: '9.8M', peRatio: 16.4, '52wHigh': 110.00, '52wLow': 88.00 },
            { symbol: '601138', name: 'Foxconn Industrial Internet (工业富联)', price: 24.50, change: 1.10, changePercent: 4.70, sector: 'Technology', marketCap: '¥486B', volume: '68.5M', peRatio: 21.8, '52wHigh': 28.90, '52wLow': 13.50 },
            { symbol: '601818', name: 'China Everbright Bank (光大银行)', price: 3.25, change: 0.02, changePercent: 0.62, sector: 'Financials', marketCap: '¥192B', volume: '24.1M', peRatio: 4.8, '52wHigh': 3.60, '52wLow': 2.85 },
            { symbol: '601601', name: 'China Pacific Insurance (中国太保)', price: 27.80, change: 0.55, changePercent: 2.02, sector: 'Financials', marketCap: '¥267B', volume: '11.8M', peRatio: 9.4, '52wHigh': 32.40, '52wLow': 22.10 },
            { symbol: '600438', name: 'Tongwei Co Ltd (通威股份)', price: 20.40, change: -0.60, changePercent: -2.86, sector: 'Technology', marketCap: '¥91.8B', volume: '21.5M', peRatio: 15.2, '52wHigh': 33.20, '52wLow': 18.50 },
            { symbol: '601012', name: 'LONGi Green Energy SSE (隆基绿能)', price: 16.85, change: -0.45, changePercent: -2.60, sector: 'Technology', marketCap: '¥127B', volume: '48.2M', peRatio: 19.8, '52wHigh': 29.80, '52wLow': 14.10 },
            { symbol: '601919', name: 'COSCO SHIPPING Holdings (中远海控)', price: 13.60, change: 0.42, changePercent: 3.19, sector: 'Industrials', marketCap: '¥217B', volume: '42.8M', peRatio: 8.5, '52wHigh': 15.80, '52wLow': 9.20 },
            { symbol: '600050', name: 'China Unicom (中国联通)', price: 4.88, change: 0.06, changePercent: 1.24, sector: 'Communication', marketCap: '¥155B', volume: '33.1M', peRatio: 18.1, '52wHigh': 5.60, '52wLow': 4.10 },
            { symbol: '601800', name: 'China Communications Constr (中国交建)', price: 8.95, change: 0.18, changePercent: 2.05, sector: 'Industrials', marketCap: '¥144B', volume: '19.8M', peRatio: 6.2, '52wHigh': 11.20, '52wLow': 7.60 },
            { symbol: '601390', name: 'China Railway Group (中国中铁)', price: 6.42, change: 0.09, changePercent: 1.42, sector: 'Industrials', marketCap: '¥158B', volume: '22.5M', peRatio: 4.9, '52wHigh': 7.80, '52wLow': 5.50 },
            { symbol: '601186', name: 'China Railway Construction (中国铁建)', price: 8.15, change: 0.12, changePercent: 1.49, sector: 'Industrials', marketCap: '¥110B', volume: '17.4M', peRatio: 4.2, '52wHigh': 10.10, '52wLow': 7.00 },
            { symbol: '600016', name: 'China Minsheng Banking (民生银行)', price: 3.82, change: 0.03, changePercent: 0.79, sector: 'Financials', marketCap: '¥167B', volume: '26.8M', peRatio: 4.5, '52wHigh': 4.20, '52wLow': 3.40 },
            { symbol: '600309', name: 'Wanhua Chemical (万华化学)', price: 78.50, change: 1.60, changePercent: 2.08, sector: 'Materials', marketCap: '¥246B', volume: '8.4M', peRatio: 14.6, '52wHigh': 92.00, '52wLow': 68.50 },
            { symbol: '601658', name: 'Postal Savings Bank (邮储银行)', price: 4.95, change: 0.07, changePercent: 1.43, sector: 'Financials', marketCap: '¥491B', volume: '31.2M', peRatio: 5.5, '52wHigh': 5.40, '52wLow': 4.20 },
            { symbol: '600585', name: 'Anhui Conch Cement (海螺水泥)', price: 23.40, change: 0.30, changePercent: 1.30, sector: 'Materials', marketCap: '¥124B', volume: '9.6M', peRatio: 11.2, '52wHigh': 27.50, '52wLow': 20.10 },
            { symbol: '600048', name: 'Poly Developments (保利发展)', price: 9.15, change: -0.22, changePercent: -2.35, sector: 'Real Estate', marketCap: '¥109B', volume: '36.4M', peRatio: 9.1, '52wHigh': 13.80, '52wLow': 8.20 },
            { symbol: '601766', name: 'CRRC Corporation (中国中车)', price: 7.25, change: 0.14, changePercent: 1.97, sector: 'Industrials', marketCap: '¥208B', volume: '25.6M', peRatio: 16.8, '52wHigh': 8.10, '52wLow': 5.10 },
            { symbol: '600690', name: 'Haier Smart Home (海尔智家)', price: 28.60, change: 0.45, changePercent: 1.60, sector: 'Consumer Discretionary', marketCap: '¥269B', volume: '14.2M', peRatio: 15.8, '52wHigh': 31.20, '52wLow': 20.80 },
            { symbol: '600346', name: 'Hengli Petrochemical (恒力石化)', price: 14.12, change: 0.18, changePercent: 1.29, sector: 'Energy', marketCap: '¥99.4B', volume: '7.8M', peRatio: 13.8, '52wHigh': 16.90, '52wLow': 12.00 },
            { symbol: '601939', name: 'China Construction Bank SSE (建设银行)', price: 7.42, change: 0.08, changePercent: 1.09, sector: 'Financials', marketCap: '¥1.85T', volume: '41.5M', peRatio: 5.6, '52wHigh': 7.90, '52wLow': 6.10 },
            { symbol: '600809', name: 'Shanxi Xinghuacun Fen Wine (山西汾酒)', price: 215.00, change: 3.50, changePercent: 1.65, sector: 'Consumer Staples', marketCap: '¥262B', volume: '2.8M', peRatio: 24.1, '52wHigh': 265.00, '52wLow': 185.00 },
            { symbol: '601211', name: 'Guotai Junan Securities (国泰君安)', price: 14.20, change: 0.25, changePercent: 1.79, sector: 'Financials', marketCap: '¥126B', volume: '15.4M', peRatio: 12.8, '52wHigh': 16.80, '52wLow': 13.10 },
            { symbol: '601688', name: 'Huatai Securities (华泰证券)', price: 13.85, change: 0.30, changePercent: 2.21, sector: 'Financials', marketCap: '¥125B', volume: '18.9M', peRatio: 10.9, '52wHigh': 16.50, '52wLow': 12.40 },
            { symbol: '600703', name: 'Sanan Optoelectronics (三安光电)', price: 12.10, change: -0.15, changePercent: -1.22, sector: 'Technology', marketCap: '¥60.3B', volume: '24.1M', peRatio: 65.4, '52wHigh': 16.20, '52wLow': 10.80 },
            { symbol: '600584', name: 'JCET Group (长电科技)', price: 28.90, change: 0.75, changePercent: 2.66, sector: 'Technology', marketCap: '¥51.7B', volume: '19.6M', peRatio: 34.2, '52wHigh': 34.50, '52wLow': 22.40 },
            { symbol: '688981', name: 'SMIC STAR (中芯国际)', price: 46.80, change: 1.85, changePercent: 4.12, sector: 'Technology', marketCap: '¥371B', volume: '32.4M', peRatio: 82.5, '52wHigh': 58.00, '52wLow': 38.20 },
            { symbol: '688012', name: 'AMEC STAR (中微公司)', price: 142.00, change: 4.20, changePercent: 3.05, sector: 'Technology', marketCap: '¥87.8B', volume: '4.1M', peRatio: 52.8, '52wHigh': 175.00, '52wLow': 112.00 },
            { symbol: '688008', name: 'Montage Technology STAR (澜起科技)', price: 58.40, change: 2.10, changePercent: 3.73, sector: 'Technology', marketCap: '¥66.7B', volume: '8.9M', peRatio: 61.2, '52wHigh': 69.80, '52wLow': 42.10 },
            { symbol: '688036', name: 'Appotronics STAR (光峰科技)', price: 18.20, change: 0.35, changePercent: 1.96, sector: 'Technology', marketCap: '¥8.3B', volume: '3.2M', peRatio: 42.1, '52wHigh': 26.40, '52wLow': 15.10 },
            { symbol: '688111', name: 'Kingsoft Office STAR (金山办公)', price: 268.00, change: -5.40, changePercent: -1.98, sector: 'Technology', marketCap: '¥123B', volume: '1.9M', peRatio: 92.4, '52wHigh': 340.00, '52wLow': 220.00 },
            { symbol: '688396', name: 'CR Micro STAR (华润微)', price: 38.50, change: 0.90, changePercent: 2.39, sector: 'Technology', marketCap: '¥50.9B', volume: '5.4M', peRatio: 36.8, '52wHigh': 52.10, '52wLow': 33.00 },
            { symbol: '688599', name: 'Trina Solar STAR (天合光能)', price: 18.90, change: -0.40, changePercent: -2.07, sector: 'Technology', marketCap: '¥41.2B', volume: '18.7M', peRatio: 12.4, '52wHigh': 31.50, '52wLow': 16.80 },
            { symbol: '688009', name: 'CRSC STAR (中国通号)', price: 5.42, change: 0.08, changePercent: 1.50, sector: 'Industrials', marketCap: '¥57.4B', volume: '12.1M', peRatio: 15.1, '52wHigh': 6.20, '52wLow': 4.50 },
            { symbol: '603259', name: 'WuXi AppTec (药明康德)', price: 42.80, change: -0.95, changePercent: -2.17, sector: 'Healthcare', marketCap: '¥126B', volume: '22.8M', peRatio: 13.5, '52wHigh': 78.50, '52wLow': 37.20 },
            { symbol: '600196', name: 'Fosun Pharma (复星医药)', price: 23.50, change: 0.20, changePercent: 0.86, sector: 'Healthcare', marketCap: '¥62.8B', volume: '8.4M', peRatio: 24.8, '52wHigh': 29.80, '52wLow': 21.40 },
            { symbol: '600406', name: 'NARI Tech (国电南瑞)', price: 24.10, change: 0.35, changePercent: 1.47, sector: 'Industrials', marketCap: '¥193B', volume: '11.5M', peRatio: 26.2, '52wHigh': 27.20, '52wLow': 20.80 },
            { symbol: '601166', name: 'Industrial Bank (兴业银行)', price: 16.20, change: 0.22, changePercent: 1.38, sector: 'Financials', marketCap: '¥336B', volume: '29.4M', peRatio: 4.4, '52wHigh': 17.80, '52wLow': 14.10 },
            { symbol: '601229', name: 'Bank of Shanghai (上海银行)', price: 7.45, change: 0.08, changePercent: 1.09, sector: 'Financials', marketCap: '¥105B', volume: '14.8M', peRatio: 4.6, '52wHigh': 8.10, '52wLow': 6.20 },
            { symbol: '600919', name: 'Bank of Jiangsu (江苏银行)', price: 7.85, change: 0.12, changePercent: 1.55, sector: 'Financials', marketCap: '¥144B', volume: '34.2M', peRatio: 4.8, '52wHigh': 8.30, '52wLow': 6.50 },
            { symbol: '601998', name: 'China CITIC Bank (中信银行)', price: 6.82, change: 0.09, changePercent: 1.34, sector: 'Financials', marketCap: '¥333B', volume: '18.2M', peRatio: 5.1, '52wHigh': 7.40, '52wLow': 5.20 },
            { symbol: '600019', name: 'Baoshan Iron & Steel (宝钢股份)', price: 6.55, change: 0.11, changePercent: 1.71, sector: 'Materials', marketCap: '¥143B', volume: '21.0M', peRatio: 12.1, '52wHigh': 7.20, '52wLow': 5.60 },
            { symbol: '601985', name: 'China National Nuclear Power (中国核电)', price: 9.85, change: 0.22, changePercent: 2.28, sector: 'Utilities', marketCap: '¥186B', volume: '38.4M', peRatio: 17.4, '52wHigh': 10.80, '52wLow': 7.20 },
            { symbol: '600011', name: 'Huaneng Power Intl (华能国际)', price: 8.60, change: 0.15, changePercent: 1.78, sector: 'Utilities', marketCap: '¥135B', volume: '24.1M', peRatio: 14.2, '52wHigh': 9.80, '52wLow': 7.10 },
            { symbol: '600029', name: 'China Southern Airlines (南方航空)', price: 5.82, change: 0.05, changePercent: 0.87, sector: 'Industrials', marketCap: '¥105B', volume: '18.4M', peRatio: 28.4, '52wHigh': 6.90, '52wLow': 5.20 },
            { symbol: '601111', name: 'Air China (中国国航)', price: 7.15, change: 0.08, changePercent: 1.13, sector: 'Industrials', marketCap: '¥115B', volume: '16.9M', peRatio: 31.2, '52wHigh': 8.50, '52wLow': 6.40 },
            { symbol: '600115', name: 'China Eastern Airlines (中国东航)', price: 3.85, change: 0.03, changePercent: 0.79, sector: 'Industrials', marketCap: '¥85.8B', volume: '21.4M', peRatio: 35.1, '52wHigh': 4.60, '52wLow': 3.50 },
            { symbol: '600015', name: 'Hua Xia Bank (华夏银行)', price: 6.25, change: 0.06, changePercent: 0.97, sector: 'Financials', marketCap: '¥99.4B', volume: '12.8M', peRatio: 4.1, '52wHigh': 6.80, '52wLow': 5.20 },
            { symbol: '601995', name: 'CICC (中金公司)', price: 31.40, change: 0.65, changePercent: 2.11, sector: 'Financials', marketCap: '¥151B', volume: '11.2M', peRatio: 21.8, '52wHigh': 39.50, '52wLow': 28.00 },
            { symbol: '600150', name: 'China CSSC Holdings (中国船舶)', price: 36.50, change: 1.40, changePercent: 3.99, sector: 'Industrials', marketCap: '¥163B', volume: '29.8M', peRatio: 42.1, '52wHigh': 42.00, '52wLow': 26.80 },
            { symbol: '600066', name: 'Yutong Bus (宇通客车)', price: 23.80, change: 0.60, changePercent: 2.59, sector: 'Consumer Discretionary', marketCap: '¥52.7B', volume: '8.4M', peRatio: 17.5, '52wHigh': 26.50, '52wLow': 13.20 },
            { symbol: '600188', name: 'Yankuang Energy (兖矿能源)', price: 16.40, change: 0.35, changePercent: 2.18, sector: 'Energy', marketCap: '¥122B', volume: '15.6M', peRatio: 7.2, '52wHigh': 21.80, '52wLow': 14.50 },
            { symbol: '600025', name: 'Huaneng Lancang River (华能水电)', price: 10.25, change: 0.18, changePercent: 1.79, sector: 'Utilities', marketCap: '¥184B', volume: '14.1M', peRatio: 22.4, '52wHigh': 11.20, '52wLow': 8.10 },
            { symbol: '600905', name: 'Three Gorges Energy (三峡能源)', price: 4.52, change: 0.05, changePercent: 1.12, sector: 'Utilities', marketCap: '¥129B', volume: '31.5M', peRatio: 17.8, '52wHigh': 5.20, '52wLow': 4.10 },
            { symbol: '601618', name: 'Metallurgical Corp (中国中冶)', price: 3.12, change: 0.04, changePercent: 1.30, sector: 'Industrials', marketCap: '¥64.6B', volume: '22.4M', peRatio: 7.5, '52wHigh': 3.70, '52wLow': 2.85 },
            { symbol: '600111', name: 'China Northern Rare Earth (北方稀土)', price: 18.20, change: 0.55, changePercent: 3.12, sector: 'Materials', marketCap: '¥65.8B', volume: '34.2M', peRatio: 28.5, '52wHigh': 24.80, '52wLow': 15.20 },
            { symbol: '600383', name: 'Gemdale Corporation (金地集团)', price: 3.85, change: -0.12, changePercent: -3.02, sector: 'Real Estate', marketCap: '¥17.4B', volume: '28.1M', peRatio: 12.8, '52wHigh': 6.80, '52wLow': 3.10 }
        ]
    },
    SZSE: {
        name: 'SZSE Shenzhen', country: 'China', currency: 'CNY', flag: '🇨🇳',
        stocks: [
            { symbol: '002594', name: 'BYD Company (比亚迪)', price: 254.20, change: 6.80, changePercent: 2.75, sector: 'Consumer Discretionary', marketCap: '¥740B', volume: '14.8M', peRatio: 22.4, '52wHigh': 282.00, '52wLow': 168.00 },
            { symbol: '000858', name: 'Wuliangye Yibin (五粮液)', price: 132.50, change: 1.90, changePercent: 1.45, sector: 'Consumer Staples', marketCap: '¥514B', volume: '9.2M', peRatio: 16.5, '52wHigh': 168.00, '52wLow': 120.00 },
            { symbol: '000333', name: 'Midea Group (美的集团)', price: 63.80, change: 0.90, changePercent: 1.43, sector: 'Consumer Discretionary', marketCap: '¥446B', volume: '18.4M', peRatio: 13.1, '52wHigh': 70.50, '52wLow': 48.20 },
            { symbol: '300750', name: 'CATL ChiNext (宁德时代)', price: 182.40, change: 5.20, changePercent: 2.93, sector: 'Industrials', marketCap: '¥802B', volume: '22.1M', peRatio: 17.8, '52wHigh': 210.00, '52wLow': 140.00 },
            { symbol: '002475', name: 'Luxshare Precision (立讯精密)', price: 38.60, change: 1.25, changePercent: 3.35, sector: 'Technology', marketCap: '¥277B', volume: '34.8M', peRatio: 25.1, '52wHigh': 42.00, '52wLow': 26.50 },
            { symbol: '000001', name: 'Ping An Bank (平安银行)', price: 10.45, change: 0.15, changePercent: 1.46, sector: 'Financials', marketCap: '¥203B', volume: '42.1M', peRatio: 4.5, '52wHigh': 12.20, '52wLow': 8.90 },
            { symbol: '000651', name: 'Gree Electric (格力电器)', price: 41.20, change: 0.40, changePercent: 0.98, sector: 'Consumer Discretionary', marketCap: '¥232B', volume: '16.5M', peRatio: 8.2, '52wHigh': 44.80, '52wLow': 31.50 },
            { symbol: '002714', name: 'Muyuan Foods (牧原股份)', price: 43.50, change: -0.60, changePercent: -1.36, sector: 'Consumer Staples', marketCap: '¥237B', volume: '12.8M', peRatio: 18.4, '52wHigh': 52.00, '52wLow': 34.20 },
            { symbol: '300015', name: 'Aier Eye Hospital ChiNext (爱尔眼科)', price: 12.40, change: -0.18, changePercent: -1.43, sector: 'Healthcare', marketCap: '¥115B', volume: '28.4M', peRatio: 32.5, '52wHigh': 18.50, '52wLow': 11.20 },
            { symbol: '000725', name: 'BOE Technology (京东方A)', price: 4.12, change: 0.05, changePercent: 1.23, sector: 'Technology', marketCap: '¥155B', volume: '88.5M', peRatio: 42.1, '52wHigh': 4.60, '52wLow': 3.65 },
            { symbol: '300059', name: 'East Money Info ChiNext (东方财富)', price: 11.85, change: 0.35, changePercent: 3.04, sector: 'Financials', marketCap: '¥188B', volume: '95.2M', peRatio: 22.8, '52wHigh': 16.20, '52wLow': 10.10 },
            { symbol: '002415', name: 'Hikvision (海康威视)', price: 29.40, change: 0.30, changePercent: 1.03, sector: 'Technology', marketCap: '¥274B', volume: '14.2M', peRatio: 19.4, '52wHigh': 37.80, '52wLow': 26.80 },
            { symbol: '000568', name: 'Luzhou Laojiao (泸州老窖)', price: 145.00, change: 2.10, changePercent: 1.47, sector: 'Consumer Staples', marketCap: '¥213B', volume: '5.8M', peRatio: 15.8, '52wHigh': 195.00, '52wLow': 130.00 },
            { symbol: '300760', name: 'Mindray Bio-Medical ChiNext (迈瑞医疗)', price: 242.00, change: 3.80, changePercent: 1.60, sector: 'Healthcare', marketCap: '¥293B', volume: '4.2M', peRatio: 25.4, '52wHigh': 310.00, '52wLow': 225.00 },
            { symbol: '002352', name: 'SF Holding (顺丰控股)', price: 36.80, change: 0.45, changePercent: 1.24, sector: 'Industrials', marketCap: '¥177B', volume: '11.8M', peRatio: 21.2, '52wHigh': 45.20, '52wLow': 32.10 },
            { symbol: '000100', name: 'TCL Technology (TCL科技)', price: 4.45, change: 0.08, changePercent: 1.83, sector: 'Technology', marketCap: '¥83.6B', volume: '54.1M', peRatio: 31.5, '52wHigh': 5.20, '52wLow': 3.90 },
            { symbol: '002460', name: 'Ganfeng Lithium (赣锋锂业)', price: 28.50, change: -0.80, changePercent: -2.73, sector: 'Materials', marketCap: '¥57.5B', volume: '22.8M', peRatio: 24.1, '52wHigh': 46.80, '52wLow': 24.50 },
            { symbol: '002466', name: 'Tianqi Lithium (天齐锂业)', price: 32.40, change: -0.95, changePercent: -2.85, sector: 'Materials', marketCap: '¥53.2B', volume: '26.4M', peRatio: 21.8, '52wHigh': 56.00, '52wLow': 29.80 },
            { symbol: '300124', name: 'Inovance Tech ChiNext (汇川技术)', price: 58.20, change: 1.40, changePercent: 2.46, sector: 'Industrials', marketCap: '¥156B', volume: '9.8M', peRatio: 32.4, '52wHigh': 68.50, '52wLow': 48.00 },
            { symbol: '002230', name: 'iFLYTEK (科大讯飞)', price: 42.50, change: 1.80, changePercent: 4.42, sector: 'Technology', marketCap: '¥98.4B', volume: '38.5M', peRatio: 85.2, '52wHigh': 56.00, '52wLow': 36.20 },
            { symbol: '000792', name: 'Qinghai Salt Lake (盐湖股份)', price: 16.20, change: 0.25, changePercent: 1.57, sector: 'Materials', marketCap: '¥88.0B', volume: '19.4M', peRatio: 11.8, '52wHigh': 19.50, '52wLow': 13.80 },
            { symbol: '300274', name: 'Sungrow Power ChiNext (阳光电源)', price: 72.50, change: 2.40, changePercent: 3.42, sector: 'Industrials', marketCap: '¥107B', volume: '28.1M', peRatio: 11.2, '52wHigh': 98.00, '52wLow': 58.20 },
            { symbol: '002142', name: 'Bank of Ningbo (宁波银行)', price: 21.80, change: 0.35, changePercent: 1.63, sector: 'Financials', marketCap: '¥144B', volume: '18.9M', peRatio: 5.6, '52wHigh': 26.50, '52wLow': 19.20 },
            { symbol: '000776', name: 'GF Securities (广发证券)', price: 13.10, change: 0.22, changePercent: 1.71, sector: 'Financials', marketCap: '¥99.8B', volume: '16.4M', peRatio: 12.4, '52wHigh': 15.80, '52wLow': 11.80 },
            { symbol: '000166', name: 'Shenwan Hongyuan (申万宏源)', price: 4.52, change: 0.06, changePercent: 1.35, sector: 'Financials', marketCap: '¥113B', volume: '21.0M', peRatio: 18.2, '52wHigh': 5.20, '52wLow': 3.95 },
            { symbol: '002027', name: 'Focus Media (分众传媒)', price: 6.18, change: 0.08, changePercent: 1.31, sector: 'Communication', marketCap: '¥89.3B', volume: '32.1M', peRatio: 18.4, '52wHigh': 7.20, '52wLow': 5.50 },
            { symbol: '300122', name: 'Zhifei Bio ChiNext (智飞生物)', price: 28.90, change: -0.65, changePercent: -2.20, sector: 'Healthcare', marketCap: '¥69.2B', volume: '15.4M', peRatio: 8.4, '52wHigh': 58.00, '52wLow': 25.80 },
            { symbol: '002601', name: 'LB Group (龙佰集团)', price: 17.80, change: 0.28, changePercent: 1.60, sector: 'Materials', marketCap: '¥42.5B', volume: '10.2M', peRatio: 13.2, '52wHigh': 21.40, '52wLow': 15.20 },
            { symbol: '002001', name: 'Zhejiang NHU (新和成)', price: 19.50, change: 0.30, changePercent: 1.56, sector: 'Healthcare', marketCap: '¥60.3B', volume: '8.1M', peRatio: 18.2, '52wHigh': 22.80, '52wLow': 15.80 },
            { symbol: '300408', name: 'Three-Circle ChiNext (三环集团)', price: 29.40, change: 0.60, changePercent: 2.08, sector: 'Technology', marketCap: '¥55.8B', volume: '7.8M', peRatio: 28.9, '52wHigh': 33.50, '52wLow': 24.20 },
            { symbol: '002371', name: 'Naura Tech (北方华创)', price: 312.00, change: 9.50, changePercent: 3.14, sector: 'Technology', marketCap: '¥165B', volume: '4.8M', peRatio: 42.8, '52wHigh': 345.00, '52wLow': 220.00 },
            { symbol: '000938', name: 'Unisplendour (紫光股份)', price: 22.80, change: 0.75, changePercent: 3.40, sector: 'Technology', marketCap: '¥65.2B', volume: '38.2M', peRatio: 30.1, '52wHigh': 26.80, '52wLow': 18.20 },
            { symbol: '300498', name: 'Wens Foodstuff ChiNext (温氏股份)', price: 19.20, change: 0.15, changePercent: 0.79, sector: 'Consumer Staples', marketCap: '¥127B', volume: '14.5M', peRatio: 22.1, '52wHigh': 22.50, '52wLow': 16.80 },
            { symbol: '002241', name: 'Goertek (歌尔股份)', price: 21.40, change: 0.85, changePercent: 4.14, sector: 'Technology', marketCap: '¥73.1B', volume: '48.9M', peRatio: 68.2, '52wHigh': 25.80, '52wLow': 14.50 },
            { symbol: '002050', name: 'Sanfeng Intelligent (三丰智能)', price: 4.25, change: 0.12, changePercent: 2.91, sector: 'Industrials', marketCap: '¥5.9B', volume: '11.2M', peRatio: 38.5, '52wHigh': 5.40, '52wLow': 3.20 },
            { symbol: '300014', name: 'EVE Energy ChiNext (亿纬锂能)', price: 36.50, change: 1.10, changePercent: 3.11, sector: 'Industrials', marketCap: '¥74.7B', volume: '21.4M', peRatio: 18.5, '52wHigh': 52.00, '52wLow': 31.00 },
            { symbol: '002812', name: 'Energy New Material (恩捷股份)', price: 26.80, change: -0.75, changePercent: -2.72, sector: 'Materials', marketCap: '¥26.2B', volume: '14.1M', peRatio: 15.4, '52wHigh': 58.00, '52wLow': 24.10 },
            { symbol: '000002', name: 'China Vanke (万科A)', price: 6.85, change: -0.25, changePercent: -3.52, sector: 'Real Estate', marketCap: '¥81.7B', volume: '62.4M', peRatio: 6.8, '52wHigh': 11.50, '52wLow': 6.20 },
            { symbol: '000963', name: 'Huadong Medicine (华东医药)', price: 29.80, change: 0.40, changePercent: 1.36, sector: 'Healthcare', marketCap: '¥52.3B', volume: '6.4M', peRatio: 17.8, '52wHigh': 38.50, '52wLow': 27.20 },
            { symbol: '300347', name: 'Tigermed ChiNext (泰格医药)', price: 48.50, change: -1.10, changePercent: -2.22, sector: 'Healthcare', marketCap: '¥42.3B', volume: '7.8M', peRatio: 21.4, '52wHigh': 72.00, '52wLow': 42.00 },
            { symbol: '002129', name: 'TCL Zhonghuan (TCL中环)', price: 9.85, change: -0.30, changePercent: -2.96, sector: 'Industrials', marketCap: '¥39.8B', volume: '32.1M', peRatio: 12.8, '52wHigh': 18.50, '52wLow': 9.20 },
            { symbol: '000983', name: 'Shanxi Coking Coal (山西焦煤)', price: 8.45, change: 0.18, changePercent: 2.18, sector: 'Energy', marketCap: '¥48.0B', volume: '18.4M', peRatio: 7.2, '52wHigh': 11.20, '52wLow': 7.60 },
            { symbol: '002493', name: 'Rongsheng Petrochem (荣盛石化)', price: 9.12, change: 0.10, changePercent: 1.11, sector: 'Energy', marketCap: '¥92.3B', volume: '11.5M', peRatio: 78.4, '52wHigh': 12.50, '52wLow': 8.50 },
            { symbol: '300413', name: 'Mango Media ChiNext (芒果超媒)', price: 22.40, change: 0.50, changePercent: 2.28, sector: 'Communication', marketCap: '¥41.9B', volume: '14.2M', peRatio: 23.5, '52wHigh': 31.00, '52wLow': 19.80 },
            { symbol: '000538', name: 'Yunnan Baiyao (云南白药)', price: 54.20, change: 0.60, changePercent: 1.12, sector: 'Healthcare', marketCap: '¥96.8B', volume: '4.8M', peRatio: 23.4, '52wHigh': 59.80, '52wLow': 48.00 },
            { symbol: '002236', name: 'Dahua Tech (大华股份)', price: 15.60, change: 0.25, changePercent: 1.63, sector: 'Technology', marketCap: '¥51.4B', volume: '16.8M', peRatio: 14.2, '52wHigh': 21.00, '52wLow': 14.10 },
            { symbol: '300033', name: 'RoyalFlush ChiNext (同花顺)', price: 118.00, change: 4.50, changePercent: 3.96, sector: 'Financials', marketCap: '¥63.4B', volume: '8.4M', peRatio: 45.2, '52wHigh': 165.00, '52wLow': 98.00 },
            { symbol: '002304', name: 'Yanghe Brewery (洋河股份)', price: 82.50, change: 0.90, changePercent: 1.10, sector: 'Consumer Staples', marketCap: '¥124B', volume: '4.2M', peRatio: 12.4, '52wHigh': 125.00, '52wLow': 76.00 },
            { symbol: '000425', name: 'XCMG Machinery (徐工机械)', price: 6.82, change: 0.14, changePercent: 2.10, sector: 'Industrials', marketCap: '¥80.6B', volume: '28.4M', peRatio: 14.8, '52wHigh': 7.60, '52wLow': 5.20 },
            { symbol: '000157', name: 'Zoomlion Heavy (中联重科)', price: 7.15, change: 0.12, changePercent: 1.71, sector: 'Industrials', marketCap: '¥62.0B', volume: '19.5M', peRatio: 17.2, '52wHigh': 8.40, '52wLow': 5.80 },
            { symbol: '000338', name: 'Weichai Power (潍柴动力)', price: 14.80, change: 0.35, changePercent: 2.42, sector: 'Industrials', marketCap: '¥129B', volume: '24.8M', peRatio: 13.8, '52wHigh': 17.50, '52wLow': 12.10 },
            { symbol: '300142', name: 'Walvax Biotech ChiNext (沃森生物)', price: 13.20, change: -0.30, changePercent: -2.22, sector: 'Healthcare', marketCap: '¥21.2B', volume: '16.4M', peRatio: 48.0, '52wHigh': 24.00, '52wLow': 12.50 },
            { symbol: '002078', name: 'FTD Semiconductor (FTD微)', price: 15.40, change: 0.45, changePercent: 3.01, sector: 'Technology', marketCap: '¥14.2B', volume: '8.9M', peRatio: 42.1, '52wHigh': 19.80, '52wLow': 12.10 },
            { symbol: '002405', name: 'NavInfo (四维图新)', price: 7.85, change: 0.22, changePercent: 2.88, sector: 'Technology', marketCap: '¥18.6B', volume: '26.4M', peRatio: 52.0, '52wHigh': 11.20, '52wLow': 6.90 },
            { symbol: '000625', name: 'Changan Automobile (长安汽车)', price: 12.85, change: 0.30, changePercent: 2.39, sector: 'Consumer Discretionary', marketCap: '¥127B', volume: '48.2M', peRatio: 11.8, '52wHigh': 18.20, '52wLow': 11.40 },
            { symbol: '000550', name: 'Jiangling Motors (江铃汽车)', price: 21.40, change: 0.50, changePercent: 2.39, sector: 'Consumer Discretionary', marketCap: '¥18.5B', volume: '4.8M', peRatio: 12.1, '52wHigh': 26.80, '52wLow': 16.40 },
            { symbol: '300661', name: 'Sangfor Tech ChiNext (深信服)', price: 54.20, change: 1.80, changePercent: 3.44, sector: 'Technology', marketCap: '¥22.7B', volume: '5.4M', peRatio: 68.4, '52wHigh': 85.00, '52wLow': 46.00 },
            { symbol: '002179', name: 'AVICopter (中直股份)', price: 38.50, change: 0.90, changePercent: 2.39, sector: 'Industrials', marketCap: '¥31.4B', volume: '6.2M', peRatio: 54.2, '52wHigh': 46.00, '52wLow': 32.00 },
            { symbol: '000768', name: 'AVIC Aircraft (中航西飞)', price: 24.80, change: 0.60, changePercent: 2.48, sector: 'Industrials', marketCap: '¥68.9B', volume: '14.2M', peRatio: 72.0, '52wHigh': 29.50, '52wLow': 20.40 },
            { symbol: '002049', name: 'Unigroup Guoxin (紫光国微)', price: 56.40, change: 1.90, changePercent: 3.49, sector: 'Technology', marketCap: '¥47.9B', volume: '18.4M', peRatio: 28.5, '52wHigh': 78.00, '52wLow': 48.00 },
            { symbol: '300308', name: 'Innolight ChiNext (中际旭创)', price: 135.00, change: 6.20, changePercent: 4.81, sector: 'Technology', marketCap: '¥151B', volume: '24.8M', peRatio: 38.4, '52wHigh': 168.00, '52wLow': 82.00 },
            { symbol: '002555', name: '37 Interactive ChiNext (三七互娱)', price: 14.20, change: 0.30, changePercent: 2.16, sector: 'Communication', marketCap: '¥31.5B', volume: '22.1M', peRatio: 11.5, '52wHigh': 22.00, '52wLow': 13.00 },
            { symbol: '002602', name: 'Century Huatong (世纪华通)', price: 3.85, change: 0.08, changePercent: 2.12, sector: 'Communication', marketCap: '¥28.7B', volume: '34.2M', peRatio: 45.0, '52wHigh': 5.80, '52wLow': 3.40 },
            { symbol: '000688', name: 'Guocheng Mining (国城矿业)', price: 12.40, change: 0.25, changePercent: 2.06, sector: 'Materials', marketCap: '¥13.8B', volume: '4.8M', peRatio: 88.0, '52wHigh': 15.80, '52wLow': 9.80 },
            { symbol: '300724', name: 'Jiejia Weichuang ChiNext (捷佳伟创)', price: 52.80, change: 1.40, changePercent: 2.72, sector: 'Technology', marketCap: '¥18.4B', volume: '6.2M', peRatio: 11.8, '52wHigh': 78.00, '52wLow': 46.00 },
            { symbol: '002202', name: 'Goldwind (金风科技)', price: 7.85, change: 0.14, changePercent: 1.82, sector: 'Industrials', marketCap: '¥33.2B', volume: '18.4M', peRatio: 22.4, '52wHigh': 9.50, '52wLow': 6.80 },
            { symbol: '002410', name: 'Glodon (广联达)', price: 11.20, change: -0.25, changePercent: -2.18, sector: 'Technology', marketCap: '¥18.6B', volume: '12.4M', peRatio: 78.0, '52wHigh': 22.00, '52wLow': 10.20 },
            { symbol: '300450', name: 'Lead Intelligent ChiNext (先导智能)', price: 18.50, change: 0.45, changePercent: 2.49, sector: 'Industrials', marketCap: '¥29.0B', volume: '14.8M', peRatio: 16.4, '52wHigh': 31.00, '52wLow': 16.50 },
            { symbol: '002625', name: 'Yidao Tech (光启技术)', price: 16.40, change: 0.60, changePercent: 3.80, sector: 'Industrials', marketCap: '¥35.3B', volume: '28.1M', peRatio: 64.2, '52wHigh': 21.50, '52wLow': 12.80 },
            { symbol: '000876', name: 'New Hope Liuhe (新希望)', price: 9.15, change: 0.10, changePercent: 1.10, sector: 'Consumer Staples', marketCap: '¥41.6B', volume: '14.2M', peRatio: 34.0, '52wHigh': 11.80, '52wLow': 8.10 },
            { symbol: '300433', name: 'Blue Sail Medical ChiNext (蓝帆医疗)', price: 5.25, change: 0.08, changePercent: 1.55, sector: 'Healthcare', marketCap: '¥5.28B', volume: '4.8M', peRatio: 28.0, '52wHigh': 7.20, '52wLow': 4.60 },
            { symbol: '002024', name: 'Suning.com (ST苏宁)', price: 1.42, change: 0.02, changePercent: 1.43, sector: 'Consumer Discretionary', marketCap: '¥13.2B', volume: '24.1M', peRatio: 15.0, '52wHigh': 2.10, '52wLow': 1.15 },
            { symbol: '002311', name: 'Haid Group (海大集团)', price: 44.50, change: 0.70, changePercent: 1.60, sector: 'Consumer Staples', marketCap: '¥74.0B', volume: '5.2M', peRatio: 22.8, '52wHigh': 52.00, '52wLow': 38.50 },
            { symbol: '300601', name: 'Kangtai Bio ChiNext (康泰生物)', price: 18.40, change: -0.35, changePercent: -1.87, sector: 'Healthcare', marketCap: '¥20.5B', volume: '8.4M', peRatio: 24.2, '52wHigh': 29.00, '52wLow': 16.80 },
            { symbol: '000786', name: 'North China Pharma (华北制药)', price: 4.82, change: 0.05, changePercent: 1.05, sector: 'Healthcare', marketCap: '¥8.27B', volume: '6.1M', peRatio: 38.2, '52wHigh': 6.10, '52wLow': 4.20 }
        ]
    }"""

if 'SSE:' not in code:
    code = code.replace(
        "TSE_JP: { name:'TSE Tokyo', country:'Japan', currency:'JPY', flag:'🇯🇵', stocks:[{symbol:'7203.T',name:'Toyota',price:3280,change:45,changePercent:1.39},{symbol:'6758.T',name:'Sony',price:12850,change:210,changePercent:1.66},{symbol:'9984.T',name:'SoftBank',price:9420,change:-150,changePercent:-1.57},{symbol:'8306.T',name:'MUFG',price:1610,change:25,changePercent:1.58},{symbol:'6861.T',name:'Keyence',price:68500,change:800,changePercent:1.18}] }",
        "TSE_JP: { name:'TSE Tokyo', country:'Japan', currency:'JPY', flag:'🇯🇵', stocks:[{symbol:'7203.T',name:'Toyota',price:3280,change:45,changePercent:1.39},{symbol:'6758.T',name:'Sony',price:12850,change:210,changePercent:1.66},{symbol:'9984.T',name:'SoftBank',price:9420,change:-150,changePercent:-1.57},{symbol:'8306.T',name:'MUFG',price:1610,change:25,changePercent:1.58},{symbol:'6861.T',name:'Keyence',price:68500,change:800,changePercent:1.18}] }" + sse_szse_data
    )

# ----------------------------------------------------
# 3. Add SSE & SZSE Bonds to exchangeBondsData
# ----------------------------------------------------
sse_szse_bonds = """,
    SSE: [
        makeBond('MOUTAI-2032','corp','Kweichow Moutai','Moutai Corporate 2.850% 2032','2.850%',2.85,'06/18/2032',101.5,1015,2.65,{moodys:'Aa3',sp:'A+',fitch:'AA-'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (Moutai)','Flagship Moutai state debt'),
        makeBond('CN-SOV-10Y','sovereign','Ministry of Finance China','China Treasury Bond 10Y 2.250% 2034','2.250%',2.25,'05/20/2034',99.8,998,2.27,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Sovereign Tax-Exempt','China','CNY','badge-sovereign','China Sovereign','National Treasury Benchmark'),
        makeBond('SHANGHAI-MUNI','muni','Shanghai Municipal Govt','Shanghai Infra GO Bond 2.60% 2035','2.600%',2.60,'09/15/2035',100.4,1004,2.56,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Municipal','China','CNY','badge-muni','Shanghai Muni','Pudong infrastructure bond'),
        makeBond('ICBC-CORP-2033','corp','ICBC Bank','ICBC Senior Note 3.10% 2033','3.100%',3.10,'04/10/2033',102.1,1021,2.88,{moodys:'A1',sp:'A',fitch:'A'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (ICBC)','State-owned bank senior note')
    ],
    SZSE: [
        makeBond('BYD-GREEN-2031','corp','BYD Company','BYD Green Bond 2.950% 2031','2.950%',2.95,'11/12/2031',100.8,1008,2.82,{moodys:'A3',sp:'A-',fitch:'A-'},'CN Green ESG','China','CNY','badge-aapl','BYD Green ESG','EV battery expansion financing'),
        makeBond('CN-SOV-30Y','sovereign','Ministry of Finance China','China Ultra-Long Sovereign 30Y 2.570% 2054','2.570%',2.57,'06/15/2054',98.9,989,2.62,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Sovereign','China','CNY','badge-sovereign','China Sov 30Y','Long term sovereign benchmark'),
        makeBond('SHENZHEN-MUNI','muni','Shenzhen Municipal Govt','Shenzhen Special Econ Zone GO 2.45% 2034','2.450%',2.45,'08/01/2034',100.1,1001,2.44,{moodys:'A1',sp:'A+',fitch:'A+'},'CN Municipal','China','CNY','badge-muni','Shenzhen Muni','Tech hub infrastructure bond'),
        makeBond('CATL-CORP-2032','corp','Contemporary Amperex','CATL 3.20% Green Bond 2032','3.200%',3.20,'07/25/2032',101.8,1018,2.96,{moodys:'Baa1',sp:'BBB+',fitch:'A-'},'CN Corporate Taxable','China','CNY','badge-corp','Corporate (CATL)','Clean energy supply debt')
    ]"""

if 'SSE: [' not in code:
    code = code.replace(
        "        makeBond('TOYOTA-CORP','corp','Toyota Motor','Toyota 1.050% Sr 2033','1.050%',1.05,'09/20/2033',99.2,992,1.14,{moodys:'A1',sp:'A+',fitch:'A+'},'JP Corporate','Japan','JPY','badge-corp','Corporate (Toyota)','Automotive giant debt')\n    ]",
        "        makeBond('TOYOTA-CORP','corp','Toyota Motor','Toyota 1.050% Sr 2033','1.050%',1.05,'09/20/2033',99.2,992,1.14,{moodys:'A1',sp:'A+',fitch:'A+'},'JP Corporate','Japan','JPY','badge-corp','Corporate (Toyota)','Automotive giant debt')\n    ]" + sse_szse_bonds
    )

# ----------------------------------------------------
# 4. Insert Tab Bar & Screener View HTML into #markets-page
# ----------------------------------------------------
old_markets_page_top = '<div id="markets-page" class="hidden" style="margin-top: 1rem;">'
new_markets_page_top = """<div id="markets-page" class="hidden" style="margin-top: 1rem;">

    <!-- Markets Page Tab Bar -->
    <div class="markets-tab-bar" style="margin-bottom: 1.5rem;">
        <button class="markets-tab-btn active" id="tab-btn-trading" onclick="window.switchMarketsTab('trading')">
            📈 Live Trading & Assets
        </button>
        <button class="markets-tab-btn" id="tab-btn-screener" onclick="window.switchMarketsTab('screener')">
            🇨🇳 China Stock Market Screener
        </button>
    </div>

    <!-- MARKETS TRADING VIEW -->
    <div id="markets-trading-view">"""

if 'id="markets-trading-view"' not in code:
    code = code.replace(old_markets_page_top, new_markets_page_top)

    # Wrap the end of trading view and add screener view right before closing div of #markets-page
    screener_html_view = """
    </div> <!-- /#markets-trading-view -->

    <!-- MARKETS SCREENER VIEW -->
    <div id="markets-screener-view" class="hidden">
        <!-- Breadth Banner -->
        <div class="screener-breadth-banner">
            <div class="breadth-card">
                <div class="breadth-card-title">MARKET BREADTH (CHINA)</div>
                <div class="breadth-card-value neutral" id="screener-breadth-pct">0% Gainers</div>
                <div class="breadth-card-sub" id="screener-breadth-counts">0 Up · 0 Down</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">TOTAL LISTED STOCKS</div>
                <div class="breadth-card-value" id="screener-total-count" style="color: #60a5fa;">150</div>
                <div class="breadth-card-sub">SSE (Shanghai) + SZSE (Shenzhen)</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">COMBINED MARKET CAP</div>
                <div class="breadth-card-value" style="color: #fbbf24;">¥38.5 Trillion</div>
                <div class="breadth-card-sub">A-Shares Capitalization</div>
            </div>
            <div class="breadth-card">
                <div class="breadth-card-title">TOP SECTOR PERFORMER</div>
                <div class="breadth-card-value gain" id="screener-top-sector">Consumer Staples</div>
                <div class="breadth-card-sub" id="screener-top-sector-gain">+2.45% Average</div>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="screener-filter-bar">
            <div class="screener-filter-group">
                <input type="text" id="screener-search-input" placeholder="🔍 Search stock symbol, name, or ticker..." oninput="window.renderScreener()">
            </div>
            
            <div class="screener-filter-group">
                <select id="screener-exchange-select" class="gov-select" style="min-width: 160px;" onchange="window.changeScreenerExchange(this.value)">
                    <option value="ALL">🇨🇳 All China (SSE + SZSE)</option>
                    <option value="SSE">🇨🇳 SSE - Shanghai Stock Exchange</option>
                    <option value="SZSE">🇨🇳 SZSE - Shenzhen Stock Exchange</option>
                </select>
            </div>

            <div class="screener-filter-group">
                <select id="screener-sector-select" class="gov-select" style="min-width: 160px;" onchange="window.renderScreener()">
                    <option value="ALL">All Sectors</option>
                    <option value="Technology">Technology & Chips</option>
                    <option value="Financials">Financials & Banking</option>
                    <option value="Consumer Staples">Consumer Staples & Spirits</option>
                    <option value="Consumer Discretionary">Consumer Auto & Appliances</option>
                    <option value="Industrials">Industrials & Defense</option>
                    <option value="Healthcare">Healthcare & Biotech</option>
                    <option value="Energy">Energy & Oil</option>
                    <option value="Materials">Materials & Mining</option>
                    <option value="Utilities">Utilities & Power</option>
                    <option value="Communication">Communication Services</option>
                    <option value="Real Estate">Real Estate & Construction</option>
                </select>
            </div>

            <div class="screener-quick-filters">
                <button class="screener-pill active" id="pill-filter-all" onclick="window.setScreenerQuickFilter('ALL')">All Stocks</button>
                <button class="screener-pill" id="pill-filter-gainers" onclick="window.setScreenerQuickFilter('GAINERS')">🚀 Top Gainers</button>
                <button class="screener-pill" id="pill-filter-losers" onclick="window.setScreenerQuickFilter('LOSERS')">🔻 Top Decliners</button>
                <button class="screener-pill" id="pill-filter-active" onclick="window.setScreenerQuickFilter('ACTIVE')">🔥 Most Active</button>
                <button class="screener-pill" id="pill-filter-lowpe" onclick="window.setScreenerQuickFilter('LOWPE')">💎 Value (P/E &lt; 10)</button>
            </div>
        </div>

        <!-- Screener Table Card -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 0.85rem; overflow: hidden; backdrop-filter: blur(12px);">
            <!-- Meta Row -->
            <div class="screener-meta-row">
                <div>
                    Showing <span class="screener-stock-count" id="screener-meta-count">0</span> stocks matching criteria
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Sort by:</span>
                    <select id="screener-sort-select" class="gov-select" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" onchange="window.sortScreenerBy(this.value)">
                        <option value="marketCap">Market Cap (Highest)</option>
                        <option value="changePercent">Price Change (%)</option>
                        <option value="volume">Trading Volume</option>
                        <option value="peRatio">P/E Ratio</option>
                        <option value="symbol">Ticker Code</option>
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div class="screener-table-wrapper">
                <table class="screener-table">
                    <thead>
                        <tr>
                            <th onclick="window.sortScreenerBy('symbol')">Symbol / Company <span class="sort-icon" id="sort-icon-symbol">↕</span></th>
                            <th onclick="window.sortScreenerBy('sector')">Sector <span class="sort-icon" id="sort-icon-sector">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('price')">Price (CNY) <span class="sort-icon" id="sort-icon-price">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('changePercent')">Change (%) <span class="sort-icon" id="sort-icon-changePercent">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('marketCap')">Market Cap <span class="sort-icon" id="sort-icon-marketCap">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('volume')">Volume <span class="sort-icon" id="sort-icon-volume">↕</span></th>
                            <th class="num-col" onclick="window.sortScreenerBy('peRatio')">P/E Ratio <span class="sort-icon" id="sort-icon-peRatio">↕</span></th>
                            <th class="num-col">52W Range</th>
                            <th style="text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="screener-tbody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div class="screener-pagination">
                <div id="screener-page-info">Page 1 of 1</div>
                <div class="screener-page-btns">
                    <button class="screener-page-btn" id="screener-prev-btn" onclick="window.changeScreenerPage(-1)">← Previous</button>
                    <button class="screener-page-btn" id="screener-next-btn" onclick="window.changeScreenerPage(1)">Next →</button>
                </div>
            </div>
        </div>
    </div>"""

    # We insert screener_html_view before the end of #markets-page
    # Let's find the closing tag of #markets-page. It's usually `</div>` after the bonds-section.
    code = code.replace(
        '            </div>\n        </div>\n    </main>\n    </div>',
        '            </div>\n        </div>\n    </main>' + screener_html_view + '\n    </div>'
    )

# ----------------------------------------------------
# 5. Add JavaScript Functions for Screener Logic
# ----------------------------------------------------
screener_js_code = """

// ==================================================
// CHINA STOCK MARKET SCREENER LOGIC
// ==================================================
let screenerState = {
    activeExchange: 'ALL',
    searchQuery: '',
    sectorFilter: 'ALL',
    quickFilter: 'ALL',
    sortColumn: 'marketCap',
    sortDir: 'desc',
    currentPage: 1,
    pageSize: 20
};

function switchMarketsTab(tabName) {
    const tradingView = document.getElementById('markets-trading-view');
    const screenerView = document.getElementById('markets-screener-view');
    const btnTrading = document.getElementById('tab-btn-trading');
    const btnScreener = document.getElementById('tab-btn-screener');

    if (!tradingView || !screenerView) return;

    if (tabName === 'screener') {
        tradingView.classList.add('hidden');
        screenerView.classList.remove('hidden');
        if (btnTrading) btnTrading.classList.remove('active');
        if (btnScreener) btnScreener.classList.add('active');
        renderScreener();
    } else {
        screenerView.classList.add('hidden');
        tradingView.classList.remove('hidden');
        if (btnScreener) btnScreener.classList.remove('active');
        if (btnTrading) btnTrading.classList.add('active');
    }
}

function getChinaScreenerStocks() {
    let list = [];
    if (screenerState.activeExchange === 'ALL' || screenerState.activeExchange === 'SSE') {
        if (exchangeData.SSE && exchangeData.SSE.stocks) {
            list = list.concat(exchangeData.SSE.stocks.map(s => ({ ...s, exchange: 'SSE', exFlag: '🇨🇳', currencySymbol: '¥' })));
        }
    }
    if (screenerState.activeExchange === 'ALL' || screenerState.activeExchange === 'SZSE') {
        if (exchangeData.SZSE && exchangeData.SZSE.stocks) {
            list = list.concat(exchangeData.SZSE.stocks.map(s => ({ ...s, exchange: 'SZSE', exFlag: '🇨🇳', currencySymbol: '¥' })));
        }
    }
    return list;
}

function parseMarketCapValue(mc) {
    if (!mc) return 0;
    let str = String(mc).toUpperCase().replace('¥', '').replace('$', '').trim();
    if (str.endsWith('T')) return parseFloat(str) * 1e12;
    if (str.endsWith('B')) return parseFloat(str) * 1e9;
    if (str.endsWith('M')) return parseFloat(str) * 1e6;
    return parseFloat(str) || 0;
}

function parseVolumeValue(vol) {
    if (!vol) return 0;
    let str = String(vol).toUpperCase().trim();
    if (str.endsWith('M')) return parseFloat(str) * 1e6;
    if (str.endsWith('B')) return parseFloat(str) * 1e9;
    if (str.endsWith('K')) return parseFloat(str) * 1e3;
    return parseFloat(str) || 0;
}

function renderScreener() {
    const searchInput = document.getElementById('screener-search-input');
    const sectorSelect = document.getElementById('screener-sector-select');
    
    if (searchInput) screenerState.searchQuery = searchInput.value.toLowerCase().trim();
    if (sectorSelect) screenerState.sectorFilter = sectorSelect.value;

    let stocks = getChinaScreenerStocks();

    // 1. Text Search Filter
    if (screenerState.searchQuery) {
        stocks = stocks.filter(s => 
            s.symbol.toLowerCase().includes(screenerState.searchQuery) ||
            s.name.toLowerCase().includes(screenerState.searchQuery) ||
            s.sector.toLowerCase().includes(screenerState.searchQuery)
        );
    }

    // 2. Sector Filter
    if (screenerState.sectorFilter !== 'ALL') {
        stocks = stocks.filter(s => s.sector && s.sector.toLowerCase().includes(screenerState.sectorFilter.toLowerCase()));
    }

    // 3. Quick Filter Pills
    if (screenerState.quickFilter === 'GAINERS') {
        stocks = stocks.filter(s => s.changePercent > 0);
    } else if (screenerState.quickFilter === 'LOSERS') {
        stocks = stocks.filter(s => s.changePercent < 0);
    } else if (screenerState.quickFilter === 'ACTIVE') {
        stocks = stocks.sort((a, b) => parseVolumeValue(b.volume) - parseVolumeValue(a.volume));
    } else if (screenerState.quickFilter === 'LOWPE') {
        stocks = stocks.filter(s => s.peRatio && s.peRatio > 0 && s.peRatio < 12);
    }

    // Update Market Breadth Banner Metrics
    updateMarketBreadthBanner(getChinaScreenerStocks());

    // 4. Sorting
    stocks.sort((a, b) => {
        let valA = a[screenerState.sortColumn];
        let valB = b[screenerState.sortColumn];

        if (screenerState.sortColumn === 'marketCap') {
            valA = parseMarketCapValue(valA);
            valB = parseMarketCapValue(valB);
        } else if (screenerState.sortColumn === 'volume') {
            valA = parseVolumeValue(valA);
            valB = parseVolumeValue(valB);
        }

        if (typeof valA === 'string') {
            return screenerState.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return screenerState.sortDir === 'asc' ? valA - valB : valB - valA;
    });

    // Meta Count
    const metaCount = document.getElementById('screener-meta-count');
    if (metaCount) metaCount.textContent = stocks.length;

    // 5. Pagination
    const totalPages = Math.ceil(stocks.length / screenerState.pageSize) || 1;
    if (screenerState.currentPage > totalPages) screenerState.currentPage = totalPages;
    if (screenerState.currentPage < 1) screenerState.currentPage = 1;

    const pageInfo = document.getElementById('screener-page-info');
    if (pageInfo) pageInfo.textContent = `Page ${screenerState.currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('screener-prev-btn');
    const nextBtn = document.getElementById('screener-next-btn');
    if (prevBtn) prevBtn.disabled = screenerState.currentPage === 1;
    if (nextBtn) nextBtn.disabled = screenerState.currentPage === totalPages;

    const startIndex = (screenerState.currentPage - 1) * screenerState.pageSize;
    const paginatedStocks = stocks.slice(startIndex, startIndex + screenerState.pageSize);

    // Render Table Rows
    const tbody = document.getElementById('screener-tbody');
    if (!tbody) return;

    if (paginatedStocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">No Chinese stocks found matching your filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginatedStocks.map(s => {
        const isGain = s.changePercent >= 0;
        const changeClass = isGain ? 'screener-gain' : 'screener-loss';
        const changeSign = isGain ? '+' : '';
        const sectorClass = getSectorBadgeClass(s.sector);

        return `<tr>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <span class="screener-ticker">${s.symbol}</span>
                        <span class="screener-ex-tag">${s.exchange}</span>
                    </div>
                    <span class="screener-name">${s.name}</span>
                </div>
            </td>
            <td><span class="screener-sector-badge ${sectorClass}">${s.sector || 'General'}</span></td>
            <td class="num-col font-mono" style="font-weight: 600; color: #fff;">¥${s.price.toFixed(2)}</td>
            <td class="num-col font-mono ${changeClass}" style="font-weight: 700;">
                ${changeSign}${s.changePercent.toFixed(2)}%
                <div style="font-size: 0.68rem; opacity: 0.8;">${changeSign}¥${Math.abs(s.change || 0).toFixed(2)}</div>
            </td>
            <td class="num-col font-mono" style="color: #cbd5e1;">${s.marketCap || 'N/A'}</td>
            <td class="num-col font-mono" style="color: #94a3b8;">${s.volume || 'N/A'}</td>
            <td class="num-col font-mono" style="color: #cbd5e1;">${s.peRatio ? s.peRatio.toFixed(1) : 'N/A'}</td>
            <td class="num-col font-mono" style="font-size: 0.7rem; color: #94a3b8;">
                ¥${s['52wLow'] ? s['52wLow'].toFixed(2) : '-'} - ¥${s['52wHigh'] ? s['52wHigh'].toFixed(2) : '-'}
            </td>
            <td style="text-align: center;">
                <button onclick="window.inspectScreenerStock('${s.symbol}', '${s.exchange}')" class="screener-inspect-btn">
                    📊 Trade
                </button>
            </td>
        </tr>`;
    }).join('');
}

function getSectorBadgeClass(sector) {
    if (!sector) return 'sector-general';
    const s = sector.toLowerCase();
    if (s.includes('tech') || s.includes('chip') || s.includes('semiconductor')) return 'sector-tech';
    if (s.includes('finan') || s.includes('bank')) return 'sector-financials';
    if (s.includes('staples') || s.includes('spirit') || s.includes('food')) return 'sector-consumer-staples';
    if (s.includes('discretion') || s.includes('auto') || s.includes('appliance')) return 'sector-consumer-discretionary';
    if (s.includes('health') || s.includes('pharma') || s.includes('bio')) return 'sector-healthcare';
    if (s.includes('industr') || s.includes('defense') || s.includes('rail')) return 'sector-industrials';
    if (s.includes('ener') || s.includes('oil') || s.includes('coal')) return 'sector-energy';
    if (s.includes('mater') || s.includes('mining') || s.includes('lithium')) return 'sector-materials';
    if (s.includes('util') || s.includes('power')) return 'sector-utilities';
    if (s.includes('communic')) return 'sector-communication';
    return 'sector-general';
}

function updateMarketBreadthBanner(allStocks) {
    let total = allStocks.length;
    let up = allStocks.filter(s => s.changePercent > 0).length;
    let down = allStocks.filter(s => s.changePercent < 0).length;
    let pct = total > 0 ? Math.round((up / total) * 100) : 0;

    const bPct = document.getElementById('screener-breadth-pct');
    const bCounts = document.getElementById('screener-breadth-counts');
    if (bPct) {
        bPct.textContent = `${pct}% Gainers`;
        bPct.className = `breadth-card-value ${pct >= 50 ? 'gain' : 'loss'}`;
    }
    if (bCounts) {
        bCounts.textContent = `${up} Up · ${down} Down`;
    }
}

function sortScreenerBy(column) {
    if (screenerState.sortColumn === column) {
        screenerState.sortDir = screenerState.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        screenerState.sortColumn = column;
        screenerState.sortDir = 'desc';
    }
    renderScreener();
}

function setScreenerQuickFilter(filter) {
    screenerState.quickFilter = filter;
    screenerState.currentPage = 1;
    
    ['all', 'gainers', 'losers', 'active', 'lowpe'].forEach(f => {
        const btn = document.getElementById(`pill-filter-${f}`);
        if (btn) {
            if (f.toUpperCase() === filter) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    renderScreener();
}

function changeScreenerExchange(ex) {
    screenerState.activeExchange = ex;
    screenerState.currentPage = 1;
    renderScreener();
}

function changeScreenerPage(delta) {
    screenerState.currentPage += delta;
    renderScreener();
}

function inspectScreenerStock(symbol, exchange) {
    if (window.changeExchange) {
        window.changeExchange(exchange);
    }
    if (window.switchMarketsTab) {
        window.switchMarketsTab('trading');
    }
    const exData = exchangeData[exchange];
    if (exData && exData.stocks) {
        const found = exData.stocks.find(s => s.symbol === symbol);
        if (found && window.selectStock) {
            window.selectStock(found);
        }
    }
}

// Window Exports
window.switchMarketsTab = switchMarketsTab;
window.renderScreener = renderScreener;
window.sortScreenerBy = sortScreenerBy;
window.setScreenerQuickFilter = setScreenerQuickFilter;
window.changeScreenerExchange = changeScreenerExchange;
window.changeScreenerPage = changeScreenerPage;
window.inspectScreenerStock = inspectScreenerStock;

"""

if 'function switchMarketsTab' not in code:
    code = code + "\n" + screener_js_code

with open(main_js_path, "w", encoding="utf-8") as f:
    f.write(code)

print("main.js updated with Chinese Stock Market & Screener data successfully!")
