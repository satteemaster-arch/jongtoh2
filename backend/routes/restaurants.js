const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const verifyToken  = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/',      restaurantController.list);
router.post('/',     verifyToken, requireAdmin, restaurantController.create);
router.delete('/:id', verifyToken, requireAdmin, restaurantController.remove);

module.exports = router;
