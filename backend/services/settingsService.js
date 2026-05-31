const db = require('../database/db');

function getAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    siteName:  s.siteName  || 'jongtoh',
    maxGuests: Number(s.maxGuests) || 20,
    timeSlots: JSON.parse(s.timeSlots || '[]'),
  };
}

function update({ siteName, maxGuests, timeSlots }) {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateAll = db.transaction(() => {
    if (siteName  !== undefined) upsert.run('siteName',  siteName);
    if (maxGuests !== undefined) upsert.run('maxGuests', String(maxGuests));
    if (timeSlots !== undefined) upsert.run('timeSlots', JSON.stringify(timeSlots));
  });
  updateAll();
  return getAll();
}

module.exports = { getAll, update };
