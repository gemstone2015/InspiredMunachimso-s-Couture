const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

router.post('/', async (req,res) => {
  const { customer_name, phone, message, type } = req.body;
  if (!customer_name || !phone || !message) return res.status(400).json({ error:'Name, phone number, and message are required.' });
  const result = await db.prepare(`INSERT INTO messages (type, customer_name, phone, message) VALUES (?, ?, ?, ?)`).run(type === 'alteration' ? 'alteration' : 'contact', customer_name, phone, message);
  const created = await db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  const waNumber = process.env.WHATSAPP_UK_NUMBER || process.env.WHATSAPP_NG_NUMBER || process.env.WHATSAPP_NUMBER || '';
  const waText = encodeURIComponent(`${message} — from ${customer_name} (${phone})`);
  res.status(201).json({ ...created, whatsappLink: waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null });
});
router.get('/', adminAuth, async (_req,res) => res.json(await db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()));
router.patch('/:id', adminAuth, async (req,res) => {
  const allowed = ['unread','read','replied'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error:`status must be one of: ${allowed.join(', ')}` });
  const result = await db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(req.body.status,req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Message not found.' });
  res.json(await db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id));
});
router.delete('/:id', adminAuth, async (req,res) => {
  const result = await db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Message not found.' });
  res.json({ deleted:true });
});
module.exports = router;
