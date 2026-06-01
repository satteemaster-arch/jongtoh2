const tableService = require('../services/tableService');

function availability(req, res) {
  const { restaurantId } = req.params;
  const { date, time_slot } = req.query;
  if (!date || !time_slot) return res.status(400).json({ error: 'กรุณาระบุวันและเวลา' });
  res.json(tableService.getAvailability(Number(restaurantId), date, time_slot));
}

module.exports = { availability };
