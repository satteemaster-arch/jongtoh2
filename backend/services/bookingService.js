const db = require('../database/db');

function getMyBookings(userId) {
  return db.prepare(`
    SELECT b.*, r.name AS restaurant_name, r.img
    FROM bookings b
    JOIN restaurants r ON r.id = b.restaurant_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(userId);
}

function getAllBookings() {
  return db.prepare(`
    SELECT b.*, r.name AS restaurant_name, u.username
    FROM bookings b
    JOIN restaurants r ON r.id = b.restaurant_id
    JOIN users      u ON u.id = b.user_id
    ORDER BY b.created_at DESC
  `).all();
}

function create({ restaurant_id, user_id, zone, date, time_slot, guests, booker_name, phone }) {
  const settings = _getSettings();
  if (guests > settings.maxGuests) {
    throw new Error(`จองได้สูงสุด ${settings.maxGuests} คนต่อครั้ง`);
  }

  // Transaction: ตรวจสอบและจองในครั้งเดียว (ACID)
  const doBooking = db.transaction(() => {
    const taken = db.prepare(`
      SELECT id FROM bookings
      WHERE restaurant_id = ? AND date = ? AND time_slot = ? AND zone = ?
    `).get(restaurant_id, date, time_slot, zone);

    if (taken) throw new Error('ช่วงเวลา/โซนนี้ถูกจองแล้ว กรุณาเลือกใหม่');

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO bookings (restaurant_id, user_id, zone, date, time_slot, guests, booker_name, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(restaurant_id, user_id, zone, date, time_slot, guests, booker_name, phone);

    return db.prepare(`
      SELECT b.*, r.name AS restaurant_name
      FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.id = ?
    `).get(lastInsertRowid);
  });

  return doBooking();
}

function cancel(bookingId, userId, isAdmin) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw new Error('ไม่พบการจองนี้');
  if (!isAdmin && booking.user_id !== userId) throw new Error('ไม่มีสิทธิ์ยกเลิกการจองนี้');

  db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
}

function _getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { maxGuests: Number(s.maxGuests) || 20 };
}

module.exports = { getMyBookings, getAllBookings, create, cancel };
