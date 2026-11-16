import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Dev: /api/* is proxied to the Express backend, so no CORS setup is needed
export default defineConfig({ plugins: [react()], server: { port: 3000, proxy: { '/api': 'http://localhost:5000' } } });
