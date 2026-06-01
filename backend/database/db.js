const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');

const db = new DatabaseSync(path.join(__dirname, '../jongtoh.db'));

// ─── WAL mode + Foreign Keys ───────────────────────────────────
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Migration: safe for existing DB ─────────────────────────
try { db.exec('ALTER TABLE zones ADD COLUMN capacity INTEGER NOT NULL DEFAULT 20'); } catch {}
try { db.exec('ALTER TABLE bookings ADD COLUMN table_id INTEGER REFERENCES tables(id)'); } catch {}
try { db.exec("ALTER TABLE tables ADD COLUMN side TEXT NOT NULL DEFAULT 'center'"); } catch {}

// อัปเดต side ของโต๊ะที่มีอยู่แล้วตาม zone_name
try {
  db.exec(`UPDATE tables SET side = 'window' WHERE zone_name IN ('ริมหน้าต่าง','เคาน์เตอร์บาร์','ระเบียงชั้นบน')`);
  db.exec(`UPDATE tables SET side = 'right'  WHERE zone_name IN ('โซนสวน')`);
  db.exec(`UPDATE tables SET side = 'left'   WHERE zone_name IN ('ห้องส่วนตัว')`);
  db.exec(`UPDATE tables SET side = 'center' WHERE zone_name IN ('โซนปรับอากาศ','โซนกลุ่มใหญ่')`);
} catch {}

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
    capacity      INTEGER NOT NULL DEFAULT 20,
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

  CREATE TABLE IF NOT EXISTS tables (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    zone_name     TEXT    NOT NULL,
    label         TEXT    NOT NULL,
    seats         INTEGER NOT NULL DEFAULT 4,
    side          TEXT    NOT NULL DEFAULT 'center',
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
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
  const insertZone = db.prepare('INSERT INTO zones (restaurant_id, name, capacity) VALUES (?, ?, ?)');

  const seedData = [
    { name: 'ครัวคุณยาย',   type: 'อาหารไทย',       img: '🍲', desc: 'อาหารไทยรสชาติต้นตำรับ บรรยากาศอบอุ่น',
      zones: [{ name: 'โซนปรับอากาศ', capacity: 20 }, { name: 'โซนสวน', capacity: 12 }, { name: 'ริมหน้าต่าง', capacity: 8 }] },
    { name: 'Sakura Sushi', type: 'อาหารญี่ปุ่น',    img: '🍣', desc: 'ซูชิและซาชิมิสดใหม่ทุกวัน',
      zones: [{ name: 'เคาน์เตอร์บาร์', capacity: 6 }, { name: 'โซนปรับอากาศ', capacity: 16 }, { name: 'ห้องส่วนตัว', capacity: 10 }] },
    { name: 'Pasta House',  type: 'อาหารอิตาเลียน',  img: '🍝', desc: 'พาสต้าและพิซซ่าโฮมเมด',
      zones: [{ name: 'โซนปรับอากาศ', capacity: 24 }, { name: 'ระเบียงชั้นบน', capacity: 10 }] },
    { name: 'ชาบูเฮ้าส์',   type: 'ชาบู/หม้อไฟ',    img: '🍲', desc: 'บุฟเฟต์ชาบูพรีเมียม วัตถุดิบคัดสรร',
      zones: [{ name: 'โซนปรับอากาศ', capacity: 30 }, { name: 'โซนกลุ่มใหญ่', capacity: 20 }] },
  ];

  const seedAll = db.transaction(() => {
    for (const r of seedData) {
      const { lastInsertRowid } = insertRest.run(r.name, r.type, r.img, r.desc);
      for (const z of r.zones) insertZone.run(lastInsertRowid, z.name, z.capacity);
    }
  });
  seedAll();
}

// ─── Seed Tables ──────────────────────────────────────────────
const tableCount = db.prepare('SELECT COUNT(*) as c FROM tables').get();
if (tableCount.c === 0) {
  const insertTable = db.prepare('INSERT INTO tables (restaurant_id, zone_name, label, seats, side) VALUES (?, ?, ?, ?, ?)');
  const seedTables = db.transaction(() => {
    const rests = db.prepare('SELECT id, name FROM restaurants').all();
    const layout = {
      'ครัวคุณยาย': [
        { zone: 'ริมหน้าต่าง',  tables: ['A1','A2'],                seats: 4, side: 'window' },
        { zone: 'โซนสวน',       tables: ['B1','B2','B3'],           seats: 4, side: 'right'  },
        { zone: 'โซนปรับอากาศ', tables: ['C1','C2','C3','C4','C5'], seats: 4, side: 'center' },
      ],
      'Sakura Sushi': [
        { zone: 'เคาน์เตอร์บาร์', tables: ['A1','A2','A3'],         seats: 2, side: 'window' },
        { zone: 'ห้องส่วนตัว',    tables: ['B1','B2'],              seats: 5, side: 'left'   },
        { zone: 'โซนปรับอากาศ',   tables: ['C1','C2','C3','C4'],    seats: 4, side: 'center' },
      ],
      'Pasta House': [
        { zone: 'ระเบียงชั้นบน',  tables: ['A1','A2'],              seats: 5, side: 'window' },
        { zone: 'โซนปรับอากาศ',   tables: ['B1','B2','B3','B4','B5','B6'], seats: 4, side: 'center' },
      ],
      'ชาบูเฮ้าส์': [
        { zone: 'โซนปรับอากาศ',   tables: ['A1','A2','A3'],         seats: 5, side: 'left'   },
        { zone: 'โซนกลุ่มใหญ่',   tables: ['B1','B2'],              seats: 10, side: 'center' },
        { zone: 'โซนปรับอากาศ',   tables: ['A4','A5','A6'],         seats: 5, side: 'right'  },
      ],
    };
    for (const rest of rests) {
      const zones = layout[rest.name];
      if (!zones) continue;
      for (const z of zones) {
        for (const label of z.tables) {
          insertTable.run(rest.id, z.zone, label, z.seats, z.side);
        }
      }
    }
  });
  seedTables();
}

// ─── Seed Settings ────────────────────────────────────────────
const si = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
si.run('siteName',  'jongtoh');
si.run('maxGuests', '20');
si.run('timeSlots', JSON.stringify(['11:00','12:00','13:00','17:00','18:00','19:00','20:00']));

module.exports = db;
