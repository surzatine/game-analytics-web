# Nexus Telemetry – React dashboard
```bash
cp .env.example .env     # set VITE_DASHBOARD_KEY = backend DASHBOARD_API_KEY
npm install && npm run dev   # http://localhost:3000  (proxies /api -> http://localhost:5000)
```
Pages are config-driven in `src/pages.js` (one entry per backend analytics endpoint); add a chart/table by editing that page's builder.
Tailwind loads from the CDN (as in the original design); for production, switch to the Tailwind PostCSS build.
