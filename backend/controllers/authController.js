const authService = require('../services/authService');
const logger      = require('../utils/logger');

function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const result = authService.register(username.trim(), password);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Registration error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const result = authService.login(username.trim(), password);
    res.json(result);
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { register, login };
