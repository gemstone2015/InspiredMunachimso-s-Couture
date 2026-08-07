const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

router.get('/', async (_req,res) => res.json(await db.prepare(`SELECT * FROM testimonials WHERE is_published=1 ORDER BY sort_order,id DESC`).all()));
router.get('/admin/all', adminAuth, async (_req,res) => res.json(await db.prepare(`SELECT * FROM testimonials ORDER BY sort_order,id DESC`).all()));
router.post('/', adminAuth, async (req,res) => {
  const { customer_name,location,quote,rating,image_url,is_published,sort_order } = req.body;
  if (!customer_name || !quote) return res.status(400).json({ error:'Customer name and review are required.' });
  const r = await db.prepare(`INSERT INTO testimonials (customer_name,location,quote,rating,image_url,is_published,sort_order) VALUES (?,?,?,?,?,?,?)`).run(customer_name,location||'',quote,Math.min(5,Math.max(1,Number(rating)||5)),image_url||'',is_published?1:0,Number(sort_order)||0);
  res.status(201).json(await db.prepare('SELECT * FROM testimonials WHERE id=?').get(r.lastInsertRowid));
});
router.put('/:id', adminAuth, async (req,res) => {
  const c = await db.prepare('SELECT * FROM testimonials WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error:'Review not found.' });
  await db.prepare(`UPDATE testimonials SET customer_name=?,location=?,quote=?,rating=?,image_url=?,is_published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.body.customer_name??c.customer_name,req.body.location??c.location,req.body.quote??c.quote,Number(req.body.rating??c.rating),req.body.image_url??c.image_url,req.body.is_published===undefined?c.is_published:(req.body.is_published?1:0),Number(req.body.sort_order??c.sort_order),c.id);
  res.json(await db.prepare('SELECT * FROM testimonials WHERE id=?').get(c.id));
});
router.delete('/:id', adminAuth, async (req,res) => {
  await db.prepare('DELETE FROM testimonials WHERE id=?').run(req.params.id);
  res.json({ deleted:true });
});
module.exports = router;
