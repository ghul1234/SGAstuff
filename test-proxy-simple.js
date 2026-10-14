// Simple test to verify proxy is working
import fetch from 'node-fetch';

const testUrl = 'https://business.utah.gov/usbci-technical-assistance-partner-sbc-consulting-expands-post-program-financial-support-for-utah-small-businesses/';

console.log('Testing proxy connection...');
console.log('URL:', testUrl);

try {
  const response = await fetch('http://localhost:3001/proxy?url=' + encodeURIComponent(testUrl));
  if (response.ok) {
    const html = await response.text();
    console.log('✅ Proxy working!');
    console.log('Response length:', html.length);
    console.log('First 500 characters:', html.substring(0, 500));
  } else {
    console.log('❌ Proxy returned error:', response.status, response.statusText);
  }
} catch (error) {
  console.error('❌ Proxy connection failed:', error.message);
}