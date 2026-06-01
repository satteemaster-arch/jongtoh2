const router = require('express').Router();
const { availability } = require('../controllers/tableController');
router.get('/:restaurantId/availability', availability);
module.exports = router;
