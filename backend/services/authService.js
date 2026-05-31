const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

function register(username, password) {
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    throw new Error('มีชื่อผู้ใช้นี้แล้ว');
  }
  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, 'user');

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(lastInsertRowid);
  return { user, token: _sign(user) };
}

function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // ข้อความ error เดียวกันเพื่อป้องกันการ enumerate username
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  const { id, role } = user;
  return { user: { id, username: user.username, role }, token: _sign({ id, username: user.username, role }) };
}

function _sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { register, login };
