require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// เริ่มต้น DB (สร้าง schema + seed ข้อมูลตัวอย่าง)
require('./database/db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/bookings',    require('./routes/bookings'));
app.use('/api/settings',    require('./routes/settings'));
app.use('/api/tables',      require('./routes/tables'));

// Error handler — ไม่ส่ง stack trace ให้ client
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET ไม่ถูกตั้งค่าใน .env');
  process.exit(1);
}

app.listen(PORT, () =>
  console.log(`jongtoh server running → http://localhost:${PORT}`)
);
