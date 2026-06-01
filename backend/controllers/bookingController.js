const bookingService = require('../services/bookingService');

function myBookings(req, res) {
  res.json(bookingService.getMyBookings(req.user.id));
}

function allBookings(req, res) {
  res.json(bookingService.getAllBookings());
}

function create(req, res) {
  const { restaurant_id, table_id, zone, date, time_slot, guests, booker_name, phone } = req.body;
  if (!restaurant_id || !date || !time_slot || !guests || !booker_name || !phone) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  if (!table_id && !zone) {
    return res.status(400).json({ error: 'กรุณาเลือกโต๊ะหรือโซน' });
  }
  try {
    const booking = bookingService.create({
      restaurant_id: Number(restaurant_id),
      table_id: table_id ? Number(table_id) : null,
      user_id: req.user.id,
      zone, date, time_slot,
      guests: Number(guests),
      booker_name, phone,
    });
    res.status(201).json(booking);
  } catch (err) {
    const status = err.message.includes('เต็มแล้ว') || err.message.includes('ถูกจองแล้ว') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
}

function cancel(req, res) {
  try {
    bookingService.cancel(
      Number(req.params.id),
      req.user.id,
      req.user.role === 'admin'
    );
    res.json({ message: 'ยกเลิกการจองแล้ว' });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
}

module.exports = { myBookings, allBookings, create, cancel };
