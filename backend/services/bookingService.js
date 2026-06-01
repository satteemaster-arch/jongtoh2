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

function create({ restaurant_id, table_id, user_id, zone, date, time_slot, guests, booker_name, phone }) {
  const settings = _getSettings();

  const doBooking = db.transaction(() => {
    if (table_id) {
      // ── Table-based booking (airline seat style) ──────────────
      const tableRow = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
      if (!tableRow) throw new Error('ไม่พบโต๊ะนี้');
      if (guests > tableRow.seats) throw new Error(`โต๊ะนี้รับได้สูงสุด ${tableRow.seats} คน`);

      const taken = db.prepare(
        'SELECT id FROM bookings WHERE table_id = ? AND date = ? AND time_slot = ?'
      ).get(table_id, date, time_slot);
      if (taken) throw new Error('โต๊ะนี้ถูกจองแล้ว กรุณาเลือกโต๊ะอื่น');

      const { lastInsertRowid } = db.prepare(`
        INSERT INTO bookings (restaurant_id, table_id, user_id, zone, date, time_slot, guests, booker_name, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(restaurant_id, table_id, user_id, tableRow.zone_name, date, time_slot, guests, booker_name, phone);

      return db.prepare(`
        SELECT b.*, r.name AS restaurant_name
        FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
        WHERE b.id = ?
      `).get(lastInsertRowid);
    } else {
      // ── Zone-based booking (fallback สำหรับร้านที่ไม่มีโต๊ะ) ─
      if (guests > settings.maxGuests) throw new Error(`จองได้สูงสุด ${settings.maxGuests} คนต่อครั้ง`);

      const zoneRow = db.prepare(
        'SELECT capacity FROM zones WHERE restaurant_id = ? AND name = ?'
      ).get(restaurant_id, zone);
      const capacity = zoneRow ? zoneRow.capacity : 20;

      const { booked } = db.prepare(`
        SELECT COALESCE(SUM(guests), 0) AS booked
        FROM bookings
        WHERE restaurant_id = ? AND date = ? AND time_slot = ? AND zone = ?
      `).get(restaurant_id, date, time_slot, zone);

      if (booked + guests > capacity) {
        throw new Error(`โซนนี้เต็มแล้ว (ความจุ ${capacity} คน / จองไปแล้ว ${booked} คน)`);
      }

      const { lastInsertRowid } = db.prepare(`
        INSERT INTO bookings (restaurant_id, user_id, zone, date, time_slot, guests, booker_name, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(restaurant_id, user_id, zone, date, time_slot, guests, booker_name, phone);

      return db.prepare(`
        SELECT b.*, r.name AS restaurant_name
        FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
        WHERE b.id = ?
      `).get(lastInsertRowid);
    }
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
