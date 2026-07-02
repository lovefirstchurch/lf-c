import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, run `node server.js` alongside `vite` and API calls proxy through.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
