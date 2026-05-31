const authService = require('../services/authService');

function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const result = authService.register(username.trim(), password);
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: err.message });
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
    res.status(401).json({ error: err.message });
  }
}

module.exports = { register, login };
