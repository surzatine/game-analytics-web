const router = require('express').Router();
const c = require('../controllers/experiment.controller');

router.get('/', c.list);
router.post('/', c.create);              // create/update an experiment
router.post('/:id/assign', c.assign);    // Unity asks which variant a player gets

module.exports = router;
