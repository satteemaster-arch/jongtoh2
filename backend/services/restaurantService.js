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

  const insertZone = db.prepare('INSERT INTO zones (restaurant_id, name) VALUES (?, ?)');
  const insertAll = db.transaction(() => {
    for (const z of zones) insertZone.run(lastInsertRowid, z);
  });
  insertAll();

  return getById(lastInsertRowid);
}

function remove(id) {
  const info = db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  return info.changes > 0;
}

function _attachZones(rest) {
  const zones = db.prepare('SELECT name FROM zones WHERE restaurant_id = ?').all(rest.id);
  return { ...rest, zones: zones.map((z) => z.name) };
}

module.exports = { getAll, getById, create, remove };
