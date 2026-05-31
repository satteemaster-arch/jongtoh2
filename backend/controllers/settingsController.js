const settingsService = require('../services/settingsService');

function get(req, res) {
  res.json(settingsService.getAll());
}

function update(req, res) {
  const result = settingsService.update(req.body);
  res.json(result);
}

module.exports = { get, update };
