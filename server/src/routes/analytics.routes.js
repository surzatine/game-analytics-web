const router = require('express').Router();
const a = require('../controllers/analytics.controller');

// All endpoints accept ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N
router.get('/collections', a.collections);
router.get('/overview', a.overview);
router.get('/players', a.players);
router.get('/sessions', a.sessions);
router.get('/buttons', a.buttons);
router.get('/gameplay', a.gameplay);
router.get('/deaths', a.deaths);
router.get('/respawns', a.respawns);
router.get('/levels', a.levels);
router.get('/inventory', a.inventory);
router.get('/purchases', a.purchases);
router.get('/currency', a.currency);
router.get('/iap', a.iap);
router.get('/ads', a.ads);
router.get('/retention', a.retention);          // ?days=1,3,7,30
router.get('/performance', a.performance);
router.get('/experiments', a.experiments);
router.get('/experiments/:id/results', a.experimentResults);

module.exports = router;
