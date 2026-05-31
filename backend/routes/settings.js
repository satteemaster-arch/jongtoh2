const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const verifyToken  = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/',  settingsController.get);
router.put('/',  verifyToken, requireAdmin, settingsController.update);

module.exports = router;
