const M = require('../models');

/* ---- Component schemas are generated from the Mongoose models, so docs never drift ---- */
const TYPE_MAP = { String: 'string', Number: 'number', Date: 'string', Boolean: 'boolean', Mixed: 'object' };
function toSchema(model) {
  const properties = {}, required = [];
  for (const [name, p] of Object.entries(model.schema.paths)) {
    if (['_id', '__v', 'createdAt', 'updatedAt'].includes(name)) continue;
    const t = TYPE_MAP[p.instance] || 'string';
    properties[name] = { type: t, ...(p.instance === 'Date' && { format: 'date-time' }) };
    if (p.isRequired) required.push(name);
  }
  return { type: 'object', properties, ...(required.length && { required }) };
}
const schemas = {
  User: toSchema(M.User), AppSession: toSchema(M.AppSession), GameSession: toSchema(M.GameSession),
  Event: toSchema(M.Event), InventoryEvent: toSchema(M.InventoryEvent), ItemPurchase: toSchema(M.ItemPurchase),
  CurrencyTransaction: toSchema(M.CurrencyTransaction), IapTransaction: toSchema(M.IapTransaction),
  AdEvent: toSchema(M.AdEvent), LevelEvent: toSchema(M.LevelEvent), ProgressionEvent: toSchema(M.ProgressionEvent),
  PerformanceEvent: toSchema(M.PerformanceEvent), Experiment: toSchema(M.Experiment),
  ExperimentAssignment: toSchema(M.ExperimentAssignment),
  IngestResult: { type: 'object', properties: {
    success: { type: 'boolean' }, received: { type: 'integer' }, inserted: { type: 'integer' },
    updated: { type: 'integer' }, duplicates: { type: 'integer' }, failed: { type: 'integer' } } },
  Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' } } },
  AnalyticsResponse: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', additionalProperties: true } } },
};

/* ---- Ingestion: type -> model schema ---- */
const INGEST = {
  users: 'User', 'app-sessions': 'AppSession', 'game-sessions': 'GameSession', events: 'Event',
  inventory: 'InventoryEvent', purchases: 'ItemPurchase', currency: 'CurrencyTransaction', iap: 'IapTransaction',
  ads: 'AdEvent', levels: 'LevelEvent', progression: 'ProgressionEvent', performance: 'PerformanceEvent',
};
const gameSec = [{ GameApiKey: [] }];
const dashSec = [{ DashboardBearer: [] }];
const errs = { 400: { $ref: '#/components/responses/BadRequest' }, 401: { $ref: '#/components/responses/Unauthorized' } };

const paths = {};
for (const [type, schema] of Object.entries(INGEST)) {
  const ref = { $ref: `#/components/schemas/${schema}` };
  paths[`/api/ingest/${type}`] = { post: {
    tags: ['Ingestion'], summary: `Ingest ${type}`, security: gameSec,
    description: 'Send one object, an array, or `{ "events": [...] }` (max 500). ' +
      (['users', 'app-sessions', 'game-sessions'].includes(type) ? 'Documents are **upserted** by their id.' : 'Duplicate ids are skipped.'),
    requestBody: { required: true, content: { 'application/json': { schema: { oneOf: [ref, { type: 'array', maxItems: 500, items: ref }] } } } },
    responses: { 201: { description: 'Processed', content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestResult' } } } }, ...errs, 413: { description: 'Batch too large' } },
  } };
}

/* ---- Analytics ---- */
const dateParams = [
  { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date (default: 30 days ago)' },
  { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date (default: now)' },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 200 }, description: 'Max rows for ranked lists' },
];
const ANALYTICS = {
  collections: 'Document count per collection',
  overview: 'Users, sessions, win rate, deaths, rage quits, IAP and ad revenue',
  players: 'New users/day, DAU, country and platform split, top events',
  sessions: 'Sessions/day, duration, status, network, device, OS, app version, loading time',
  buttons: 'Button click counts and screen views/time-on-screen',
  gameplay: 'Outcomes, modes, difficulty, maps, characters, end reasons, rage quit rate',
  deaths: 'Death totals by level/map/difficulty/day and event-level causes',
  respawns: 'Respawn totals by level/map/difficulty/day and event-level breakdown',
  levels: 'Start/complete/fail/restart, completion rate, attempts, hardest checkpoints',
  inventory: 'Top items, views/favourites/equips, category and rarity breakdown',
  purchases: 'Item purchase success rate, top items, spend by currency, decision time',
  currency: 'Earn/spend flow by currency and source, daily series, average balances',
  iap: 'Real-money revenue, products, ARPU, ARPPU, conversion rate',
  ads: 'Fill rate, CTR, eCPM, revenue by network/type/placement, close types',
  retention: 'Cohort retention (default days 1,3,7,14,30)',
  performance: 'FPS, memory, crashes, errors and latency by device/graphics setting',
};
for (const [name, summary] of Object.entries(ANALYTICS)) {
  paths[`/api/analytics/${name}`] = { get: {
    tags: ['Analytics'], summary, security: dashSec,
    parameters: name === 'retention'
      ? [...dateParams, { name: 'days', in: 'query', schema: { type: 'string', example: '1,3,7,30' }, description: 'Comma-separated retention days' }]
      : dateParams,
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AnalyticsResponse' } } } }, 401: errs[401] },
  } };
}
paths['/api/analytics/experiments'] = { get: { tags: ['A/B Testing'], summary: 'List experiments (dashboard)', security: dashSec,
  responses: { 200: { description: 'OK' }, 401: errs[401] } } };
paths['/api/analytics/experiments/{id}/results'] = { get: { tags: ['A/B Testing'], summary: 'Per-variant results', security: dashSec,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'OK' }, 404: { description: 'Experiment not found' }, 401: errs[401] } } };

/* ---- Experiments (game side) ---- */
paths['/api/experiments'] = {
  get: { tags: ['A/B Testing'], summary: 'List experiments', security: gameSec, responses: { 200: { description: 'OK' }, 401: errs[401] } },
  post: { tags: ['A/B Testing'], summary: 'Create or update an experiment', security: gameSec,
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Experiment' },
      example: { experiment_id: 'exp_shop_layout', experiment_name: 'Shop layout', status: 'Active',
        variants: [{ variant_id: 'A', name: 'Control', weight: 50 }, { variant_id: 'B', name: 'New', weight: 50 }] } } } },
    responses: { 201: { description: 'Saved' }, 400: errs[400], 401: errs[401] } },
};
paths['/api/experiments/{id}/assign'] = { post: { tags: ['A/B Testing'], summary: 'Assign a player to a variant (sticky)', security: gameSec,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['user_id'], properties: { user_id: { type: 'string' } } } } } },
  responses: { 200: { description: 'Existing assignment' }, 201: { description: 'New assignment' }, 404: { description: 'Experiment not found' }, 409: { description: 'Experiment not active' }, 401: errs[401] } } };

paths['/health'] = { get: { tags: ['System'], summary: 'Health check', responses: { 200: { description: 'OK' } } } };

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Unity Game Analytics API', version: '1.0.0', description: 'Ingestion, analytics and A/B testing for the Unity game analytics dashboard.' },
  servers: [{ url: '/' }],
  tags: [{ name: 'Ingestion' }, { name: 'Analytics' }, { name: 'A/B Testing' }, { name: 'System' }],
  components: {
    securitySchemes: {
      GameApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Unity game key (GAME_API_KEY)' },
      DashboardBearer: { type: 'http', scheme: 'bearer', description: 'Dashboard key (DASHBOARD_API_KEY)' },
    },
    responses: {
      BadRequest: { description: 'Invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Unauthorized: { description: 'Missing or invalid key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
    schemas,
  },
  paths,
};
