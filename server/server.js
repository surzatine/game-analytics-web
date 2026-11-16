require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./src/docs/openapi');

const connectDB = require('./src/config/db');
const { gameKey, dashboardKey } = require('./src/middleware/auth');
const { notFound, errorHandler } = require('./src/middleware/error');

const app = express();

// Swagger UI needs inline scripts/styles, so mount it before helmet's strict CSP
if (process.env.ENABLE_DOCS !== 'false') {
  app.get('/api-docs.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: 'Game Analytics API Docs',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  }));
}

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(',') }));
app.use(compression());
app.use(express.json({ limit: '2mb' })); // batches from Unity offline queue
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600 }));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// Unity -> backend
app.use('/api/ingest', gameKey, require('./src/routes/ingest.routes'));
// A/B assignment is called by the game too
app.use('/api/experiments', gameKey, require('./src/routes/experiment.routes'));
// React dashboard -> backend
app.use('/api/analytics', dashboardKey, require('./src/routes/analytics.routes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`API running on :${PORT}`)));
