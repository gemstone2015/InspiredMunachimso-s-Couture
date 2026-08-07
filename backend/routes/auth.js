const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

async function getAdminHash() {
  return db.prepare("SELECT value FROM admin_settings WHERE key = 'admin_password_hash'").get();
}

router.get('/setup-status', async (_req, res) => {
  res.json({ configured: Boolean(await getAdminHash()) });
});

router.post('/login', async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) return res.status(400).json({ error:'Password is required.' });
  const row = await getAdminHash();
  if (!row) return res.status(503).json({ error:'Admin login is not configured. Run `npm run seed` from the backend folder.' });
  const valid = bcrypt.compareSync(password, row.value);
  if (!valid) return res.status(401).json({ error:'Incorrect password.' });
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (jwtSecret.length < 16) return res.status(500).json({ error:'JWT_SECRET is missing or too short in backend/.env.' });
  const token = jwt.sign({ role:'admin' }, jwtSecret, { expiresIn:'12h' });
  res.json({ token, expiresIn:'12h' });
});

module.exports = router;
