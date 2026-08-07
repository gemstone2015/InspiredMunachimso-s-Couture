const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const slugify = (v) => String(v || 'collection').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || `collection-${Date.now()}`;

async function hydrate(row) {
  if (!row) return null;
  const products = await db.prepare(`
    SELECT p.*
    FROM products p
    JOIN collection_products cp ON cp.product_id = p.id
    WHERE cp.collection_id = ?
    ORDER BY cp.sort_order, p.sort_order, p.id
  `).all(row.id);
  return { ...row, products };
}

router.get('/public', async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM collections WHERE status='published' ORDER BY is_featured DESC,sort_order,id DESC").all();
  res.json(await Promise.all(rows.map(hydrate)));
});

router.get('/public/:slug', async (req, res) => {
  const row = await db.prepare("SELECT * FROM collections WHERE slug=? AND status='published'").get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Collection not found.' });
  res.json(await hydrate(row));
});

router.get('/campaign/active', async (_req, res) => {
  const row = await db.prepare(`
    SELECT c.*, co.slug AS collection_slug
    FROM campaigns c
    LEFT JOIN collections co ON co.id = c.collection_id
    WHERE c.status='published'
      AND (c.start_at IS NULL OR c.start_at='' OR NULLIF(c.start_at,'')::timestamptz <= CURRENT_TIMESTAMP)
      AND (c.end_at IS NULL OR c.end_at='' OR NULLIF(c.end_at,'')::timestamptz >= CURRENT_TIMESTAMP)
    ORDER BY c.id DESC
    LIMIT 1
  `).get();
  res.json(row || null);
});

router.get('/admin', adminAuth, async (_req, res) => {
  const rows = await db.prepare('SELECT * FROM collections ORDER BY sort_order,id DESC').all();
  res.json(await Promise.all(rows.map(hydrate)));
});

router.post('/admin', adminAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Collection name is required.' });
  let slug = slugify(req.body.slug || name);
  let n = 2;
  while (await db.prepare('SELECT id FROM collections WHERE slug=?').get(slug)) slug = `${slugify(name)}-${n++}`;
  const out = await db.prepare(`
    INSERT INTO collections(name,slug,subtitle,description,cover_url,cover_media_type,status,is_featured,sort_order,seo_title,seo_description)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    name,
    slug,
    req.body.subtitle || '',
    req.body.description || '',
    req.body.cover_url || '',
    req.body.cover_media_type || 'image',
    req.body.status || 'draft',
    req.body.is_featured ? 1 : 0,
    Number(req.body.sort_order) || 0,
    req.body.seo_title || '',
    req.body.seo_description || ''
  );
  const row = await db.prepare('SELECT * FROM collections WHERE id=?').get(out.lastInsertRowid);
  res.status(201).json(await hydrate(row));
});

router.patch('/admin/:id', adminAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM collections WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Collection not found.' });
  await db.prepare(`
    UPDATE collections
    SET name=?,subtitle=?,description=?,cover_url=?,cover_media_type=?,status=?,is_featured=?,sort_order=?,seo_title=?,seo_description=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    req.body.name ?? row.name,
    req.body.subtitle ?? row.subtitle,
    req.body.description ?? row.description,
    req.body.cover_url ?? row.cover_url,
    req.body.cover_media_type ?? row.cover_media_type,
    req.body.status ?? row.status,
    req.body.is_featured === undefined ? row.is_featured : (req.body.is_featured ? 1 : 0),
    Number(req.body.sort_order ?? row.sort_order) || 0,
    req.body.seo_title ?? row.seo_title,
    req.body.seo_description ?? row.seo_description,
    row.id
  );
  res.json(await hydrate(await db.prepare('SELECT * FROM collections WHERE id=?').get(row.id)));
});

router.delete('/admin/:id', adminAuth, async (req, res) => {
  await db.prepare('DELETE FROM collections WHERE id=?').run(req.params.id);
  res.json({ deleted: true });
});

router.put('/admin/:id/products', adminAuth, async (req, res) => {
  const ids = Array.isArray(req.body.product_ids) ? req.body.product_ids.map(Number).filter(Boolean) : [];
  await db.transaction(async (tx) => {
    await tx.prepare('DELETE FROM collection_products WHERE collection_id=?').run(req.params.id);
    const ins = tx.prepare('INSERT OR IGNORE INTO collection_products(collection_id,product_id,sort_order) VALUES(?,?,?)');
    for (let i = 0; i < ids.length; i += 1) await ins.run(req.params.id, ids[i], i);
  });
  res.json(await hydrate(await db.prepare('SELECT * FROM collections WHERE id=?').get(req.params.id)));
});

router.get('/campaigns/admin', adminAuth, async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM campaigns ORDER BY id DESC').all());
});

router.post('/campaigns/admin', adminAuth, async (req, res) => {
  const out = await db.prepare(`
    INSERT INTO campaigns(name,message,collection_id,banner_url,button_text,button_link,start_at,end_at,status)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(
    req.body.name || 'Campaign',
    req.body.message || '',
    req.body.collection_id || null,
    req.body.banner_url || '',
    req.body.button_text || 'Explore',
    req.body.button_link || '',
    req.body.start_at || '',
    req.body.end_at || '',
    req.body.status || 'draft'
  );
  res.status(201).json(await db.prepare('SELECT * FROM campaigns WHERE id=?').get(out.lastInsertRowid));
});

router.patch('/campaigns/admin/:id', adminAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Campaign not found.' });
  await db.prepare(`
    UPDATE campaigns
    SET name=?,message=?,collection_id=?,banner_url=?,button_text=?,button_link=?,start_at=?,end_at=?,status=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    req.body.name ?? row.name,
    req.body.message ?? row.message,
    req.body.collection_id ?? row.collection_id,
    req.body.banner_url ?? row.banner_url,
    req.body.button_text ?? row.button_text,
    req.body.button_link ?? row.button_link,
    req.body.start_at ?? row.start_at,
    req.body.end_at ?? row.end_at,
    req.body.status ?? row.status,
    row.id
  );
  res.json(await db.prepare('SELECT * FROM campaigns WHERE id=?').get(row.id));
});

router.delete('/campaigns/admin/:id', adminAuth, async (req, res) => {
  await db.prepare('DELETE FROM campaigns WHERE id=?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
