// Simple proxy server to bypass CORS restrictions
// Run with: node proxy-server.js

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    console.log(`Proxying request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.error(`Proxy failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).send(`Proxy failed: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'text/html');
    
    const text = await response.text();
    res.send(text);
    
    console.log(`Successfully proxied ${url} (${text.length} bytes)`);
  } catch (error) {
    console.error(`Proxy error for ${url}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/proxy?url=<encoded-url>`);
});
