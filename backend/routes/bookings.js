const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const verifyToken  = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/my',  verifyToken, bookingController.myBookings);
router.get('/all', verifyToken, requireAdmin, bookingController.allBookings);
router.post('/',   verifyToken, bookingController.create);
router.delete('/:id', verifyToken, bookingController.cancel);

module.exports = router;
