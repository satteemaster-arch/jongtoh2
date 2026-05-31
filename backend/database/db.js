const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');

const db = new DatabaseSync(path.join(__dirname, '../jongtoh.db'));

// ─── WAL mode + Foreign Keys ───────────────────────────────────
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Polyfill: db.transaction() ให้เหมือน better-sqlite3 ─────
// ใช้ BEGIN/COMMIT/ROLLBACK แทน เพราะ node:sqlite ไม่มี built-in
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

// ─── Schema ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT,
    img         TEXT DEFAULT '🍴',
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    zone          TEXT    NOT NULL,
    date          TEXT    NOT NULL,
    time_slot     TEXT    NOT NULL,
    guests        INTEGER NOT NULL,
    booker_name   TEXT    NOT NULL,
    phone         TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (user_id)       REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── Seed Users ───────────────────────────────────────────────
const userExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!userExists) {
  const insert = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
  insert.run('admin', bcrypt.hashSync('admin', 10), 'admin');
  insert.run('user',  bcrypt.hashSync('user',  10), 'user');
}

// ─── Seed Restaurants ─────────────────────────────────────────
const restCount = db.prepare('SELECT COUNT(*) as c FROM restaurants').get();
if (restCount.c === 0) {
  const insertRest = db.prepare('INSERT INTO restaurants (name, type, img, description) VALUES (?, ?, ?, ?)');
  const insertZone = db.prepare('INSERT INTO zones (restaurant_id, name) VALUES (?, ?)');

  const seedData = [
    { name: 'ครัวคุณยาย',   type: 'อาหารไทย',       img: '🍲', desc: 'อาหารไทยรสชาติต้นตำรับ บรรยากาศอบอุ่น', zones: ['โซนปรับอากาศ','โซนสวน','ริมหน้าต่าง'] },
    { name: 'Sakura Sushi', type: 'อาหารญี่ปุ่น',    img: '🍣', desc: 'ซูชิและซาชิมิสดใหม่ทุกวัน',             zones: ['เคาน์เตอร์บาร์','โซนปรับอากาศ','ห้องส่วนตัว'] },
    { name: 'Pasta House',  type: 'อาหารอิตาเลียน',  img: '🍝', desc: 'พาสต้าและพิซซ่าโฮมเมด',                 zones: ['โซนปรับอากาศ','ระเบียงชั้นบน'] },
    { name: 'ชาบูเฮ้าส์',   type: 'ชาบู/หม้อไฟ',    img: '🍲', desc: 'บุฟเฟต์ชาบูพรีเมียม วัตถุดิบคัดสรร',   zones: ['โซนปรับอากาศ','โซนกลุ่มใหญ่'] },
  ];

  const seedAll = db.transaction(() => {
    for (const r of seedData) {
      const { lastInsertRowid } = insertRest.run(r.name, r.type, r.img, r.desc);
      for (const z of r.zones) insertZone.run(lastInsertRowid, z);
    }
  });
  seedAll();
}

// ─── Seed Settings ────────────────────────────────────────────
const si = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
si.run('siteName',  'jongtoh');
si.run('maxGuests', '20');
si.run('timeSlots', JSON.stringify(['11:00','12:00','13:00','17:00','18:00','19:00','20:00']));

module.exports = db;
