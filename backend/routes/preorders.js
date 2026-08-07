const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { orderConfirmation, orderStatusChanged } = require('../services/notifications');

const router = express.Router();
const STATUSES = ['new','confirmed','deposit_pending','deposit_paid','measurements_received','in_production','fitting','ready','dispatched','delivered','cancelled'];
const PAYMENT_STATUSES = ['unpaid','pending','paid','failed','refunded'];
const makeReference = () => `IMC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const normalisePhone = (value='') => String(value).replace(/\D/g,'').slice(-10);

async function publicOrder(row) {
  return {
    order_reference: row.order_reference,
    customer_name: row.customer_name,
    style_inspiration: row.style_inspiration,
    fabric: row.fabric,
    event_date: row.event_date,
    status: row.status,
    quoted_amount: row.quoted_amount,
    currency: row.currency,
    payment_status: row.payment_status,
    payment_provider: row.payment_provider,
    created_at: row.created_at,
    updated_at: row.updated_at,
    timeline: await db.prepare('SELECT status, note, created_at FROM order_status_history WHERE preorder_id = ? ORDER BY id').all(row.id),
  };
}

router.post('/', async (req,res) => {
  const { customer_name,phone,email,style_inspiration,fabric,event_date,notes,measurement_profile_id,product_id } = req.body;
  let customerId = null;
  const bearer = String(req.headers.authorization || '');
  if (bearer.startsWith('Bearer ')) {
    try { const decoded = jwt.verify(bearer.slice(7),process.env.JWT_SECRET); if (decoded.role === 'customer') customerId = decoded.customerId; } catch {}
  }
  if (measurement_profile_id) {
    const allowed = customerId && await db.prepare('SELECT id FROM customer_measurements WHERE id=? AND customer_id=?').get(measurement_profile_id,customerId);
    if (!allowed) return res.status(400).json({ error:'Selected measurement profile is not available.' });
  }
  if (!customer_name || !phone || !email) return res.status(400).json({ error:'Name, email and phone number are required.' });
  let orderReference = makeReference();
  while (await db.prepare('SELECT id FROM preorders WHERE order_reference = ?').get(orderReference)) orderReference = makeReference();
  const result = await db.prepare(`
    INSERT INTO preorders (customer_id, product_id, measurement_profile_id, customer_name, phone, email, order_reference, style_inspiration, fabric, event_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId,product_id||null,measurement_profile_id||null,customer_name,phone,email,orderReference,style_inspiration||'',fabric||'',event_date||'',notes||'');
  const created = await db.prepare('SELECT * FROM preorders WHERE id = ?').get(result.lastInsertRowid);
  await db.prepare(`INSERT INTO order_status_history (preorder_id, status, note) VALUES (?, 'new', 'Order request received')`).run(created.id);
  orderConfirmation(created).catch(()=>{});
  const waNumber = process.env.WHATSAPP_UK_NUMBER || process.env.WHATSAPP_NG_NUMBER || '';
  const waText = encodeURIComponent(`New order ${orderReference} from ${customer_name} (${phone}). Style: ${style_inspiration || '-'}.`);
  res.status(201).json({ ...(await publicOrder(created)), whatsappLink: waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null });
});

router.post('/track', async (req,res) => {
  const reference = String(req.body.order_reference || '').trim().toUpperCase();
  const row = await db.prepare('SELECT * FROM preorders WHERE order_reference = ?').get(reference);
  if (!row || normalisePhone(row.phone) !== normalisePhone(req.body.phone)) return res.status(404).json({ error:'Order reference and phone number do not match.' });
  res.json(await publicOrder(row));
});

router.get('/',adminAuth,async(_req,res) => {
  const rows = await db.prepare('SELECT * FROM preorders ORDER BY created_at DESC').all();
  const hydrated = await Promise.all(rows.map(async row => ({
    ...row,
    files: await db.prepare('SELECT * FROM preorder_files WHERE preorder_id = ? ORDER BY id').all(row.id),
    timeline: await db.prepare('SELECT * FROM order_status_history WHERE preorder_id = ? ORDER BY id').all(row.id),
  })));
  res.json(hydrated);
});

router.patch('/:id',adminAuth,async(req,res) => {
  const current = await db.prepare('SELECT * FROM preorders WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error:'Order not found.' });
  const status = req.body.status ?? current.status;
  const paymentStatus = req.body.payment_status ?? current.payment_status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error:`status must be one of: ${STATUSES.join(', ')}` });
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return res.status(400).json({ error:`payment_status must be one of: ${PAYMENT_STATUSES.join(', ')}` });
  let quotedAmount = current.quoted_amount;
  if (req.body.quoted_amount !== undefined) {
    const major = Number(req.body.quoted_amount);
    if (!Number.isFinite(major) || major < 0) return res.status(400).json({ error:'Payment amount must be a valid positive number.' });
    quotedAmount = Math.round(major * 100);
  }
  const currency = String(req.body.currency || current.currency || 'GBP').toUpperCase();
  if (!['GBP','NGN'].includes(currency)) return res.status(400).json({ error:'Currency must be GBP or NGN.' });
  await db.prepare(`UPDATE preorders SET status=?, quoted_amount=?, currency=?, payment_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,quotedAmount,currency,paymentStatus,req.params.id);
  if (status !== current.status) await db.prepare('INSERT INTO order_status_history (preorder_id, status, note) VALUES (?, ?, ?)').run(current.id,status,String(req.body.status_note||'Status updated by atelier'));
  const updated = await db.prepare('SELECT * FROM preorders WHERE id = ?').get(req.params.id);
  if (status !== current.status) orderStatusChanged(updated).catch(()=>{});
  res.json(updated);
});

router.delete('/:id',adminAuth,async(req,res) => {
  const result = await db.prepare('DELETE FROM preorders WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Order not found.' });
  res.json({ deleted:true });
});

module.exports = router;
