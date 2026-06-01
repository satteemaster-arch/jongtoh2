const db = require('../database/db');

function getAvailability(restaurantId, date, timeSlot) {
  const tables = db.prepare(
    'SELECT * FROM tables WHERE restaurant_id = ? ORDER BY zone_name, label'
  ).all(restaurantId);

  return tables.map((t) => {
    const booking = db.prepare(
      'SELECT id FROM bookings WHERE table_id = ? AND date = ? AND time_slot = ?'
    ).get(t.id, date, timeSlot);
    return { ...t, is_booked: !!booking };
  });
}

module.exports = { getAvailability };
