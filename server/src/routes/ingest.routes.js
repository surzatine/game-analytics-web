const router = require('express').Router();
const { ingest, types } = require('../controllers/ingest.controller');

router.get('/', types);
// POST /api/ingest/events   body: one object, an array, or { events: [...] }
router.post('/:type', ingest);

module.exports = router;
