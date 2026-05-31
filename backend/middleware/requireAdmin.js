function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'สิทธิ์ไม่เพียงพอ' });
  }
  next();
}

module.exports = requireAdmin;
