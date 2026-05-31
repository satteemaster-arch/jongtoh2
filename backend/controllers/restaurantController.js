const restaurantService = require('../services/restaurantService');

function list(req, res) {
  res.json(restaurantService.getAll());
}

function create(req, res) {
  const { name, type, img, description, zones } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อร้าน' });
  const rest = restaurantService.create({ name, type, img, description, zones });
  res.status(201).json(rest);
}

function remove(req, res) {
  const removed = restaurantService.remove(Number(req.params.id));
  if (!removed) return res.status(404).json({ error: 'ไม่พบร้านอาหาร' });
  res.json({ message: 'ลบร้านแล้ว' });
}

module.exports = { list, create, remove };
