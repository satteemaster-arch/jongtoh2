const db = require('../database/db');

function getAll() {
  const rests = db.prepare('SELECT * FROM restaurants ORDER BY id').all();
  return rests.map(_attachZones);
}

function getById(id) {
  const rest = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  return rest ? _attachZones(rest) : null;
}

function create({ name, type, img, description, zones = [] }) {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO restaurants (name, type, img, description) VALUES (?, ?, ?, ?)'
  ).run(name, type || '', img || '🍴', description || '');

  const insertZone  = db.prepare('INSERT INTO zones (restaurant_id, name, capacity) VALUES (?, ?, ?)');
  const insertTable = db.prepare('INSERT INTO tables (restaurant_id, zone_name, label, seats, side) VALUES (?, ?, ?, ?, ?)');
  const insertAll = db.transaction(() => {
    zones.forEach((z, i) => {
      const zoneName = typeof z === 'string' ? z : z.name;
      const capacity = typeof z === 'string' ? 20 : (z.capacity || 20);
      insertZone.run(lastInsertRowid, zoneName, capacity);

      // auto สร้างโต๊ะ: ~4 ที่นั่ง/โต๊ะ สูงสุด 6 โต๊ะ
      const rowLetter  = String.fromCharCode(65 + i);
      const tableCount = Math.min(Math.max(2, Math.floor(capacity / 4)), 6);
      for (let j = 1; j <= tableCount; j++) {
        insertTable.run(lastInsertRowid, zoneName, `${rowLetter}${j}`, 4, 'center');
      }
    });
  });
  insertAll();

  return getById(lastInsertRowid);
}

function remove(id) {
  const info = db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  return info.changes > 0;
}

function _attachZones(rest) {
  const zones = db.prepare('SELECT name, capacity FROM zones WHERE restaurant_id = ?').all(rest.id);
  return { ...rest, zones };
}

module.exports = { getAll, getById, create, remove };
