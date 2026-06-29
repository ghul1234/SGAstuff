import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/fred': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fred/, ''),
      },
      '/api/areadevelopment': {
        target: 'https://www.areadevelopment.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/areadevelopment/, ''),
      }
    }
  }
});
