const express = require("express");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const ALLOWED_CATEGORIES = ["ready-to-wear", "cap", "bridal", "menswear", "womenswear", "children", "alteration", "accessory", "igbo-attire"];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function uniqueSlug(name, currentId = null) {
  const base = slugify(name) || `product-${Date.now()}`;
  let slug = base;
  let i = 2;
  while (db.prepare("SELECT id FROM products WHERE slug = ? AND (? IS NULL OR id <> ?)").get(slug, currentId, currentId)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function attachMedia(products) {
  const list = Array.isArray(products) ? products : [products];
  if (!list.length) return Array.isArray(products) ? [] : null;
  const ids = list.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const media = db.prepare(`SELECT * FROM product_media WHERE product_id IN (${placeholders}) ORDER BY is_cover DESC, sort_order ASC, id ASC`).all(...ids);
  const grouped = media.reduce((acc, item) => {
    (acc[item.product_id] ||= []).push(item);
    return acc;
  }, {});
  const result = list.map((p) => {
    const productMedia = grouped[p.id] || [];
    const cover = productMedia.find((m) => m.is_cover) || productMedia[0];
    return { ...p, media: productMedia, cover_media: cover || null, image_url: cover?.thumbnail_url || cover?.media_url || p.image_url || "" };
  });
  return Array.isArray(products) ? result : result[0];
}

// Admin route MUST come before /:id.
router.get("/admin/all", adminAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY category ASC, sort_order ASC, id ASC").all();
  res.json(attachMedia(rows));
});

router.get("/", (req, res) => {
  const { category, search, featured, page = "1", limit = "24" } = req.query;
  const conditions = ["is_available = 1"];
  const values = [];
  if (category) { conditions.push("category = ?"); values.push(category); }
  if (featured === "1") conditions.push("is_featured = 1");
  if (search) { conditions.push("(name LIKE ? OR description LIKE ? OR tag LIKE ?)"); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const rows = db.prepare(`SELECT * FROM products WHERE ${conditions.join(" AND ")} ORDER BY is_featured DESC, sort_order ASC, id DESC LIMIT ? OFFSET ?`).all(...values, safeLimit, (safePage - 1) * safeLimit);
  res.json(attachMedia(rows));
});

router.get("/:idOrSlug", (req, res) => {
  const key = req.params.idOrSlug;
  const row = /^\d+$/.test(key)
    ? db.prepare("SELECT * FROM products WHERE id = ?").get(key)
    : db.prepare("SELECT * FROM products WHERE slug = ?").get(key);
  if (!row) return res.status(404).json({ error: "Product not found." });
  res.json(attachMedia(row));
});

router.post("/", adminAuth, (req, res) => {
  const { name, category, tag, price, currency, description, image_url, sort_order, is_available, is_featured,
    style, fabric, colour, gender, sizes, production_time, made_to_order } = req.body;
  if (!name || !category) return res.status(400).json({ error: "name and category are required." });
  if (!ALLOWED_CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category." });
  const slug = uniqueSlug(name);
  const result = db.prepare(`
    INSERT INTO products (name, slug, category, tag, price, currency, description, image_url, sort_order, is_available, is_featured, style, fabric, colour, gender, sizes, production_time, made_to_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), slug, category, tag || "", price || "", currency || "GBP", description || "", image_url || "", Number(sort_order) || 0, is_available === 0 ? 0 : 1, is_featured ? 1 : 0,
    style || "", fabric || "", colour || "", gender || "", sizes || "", production_time || "", made_to_order === 0 ? 0 : 1);
  res.status(201).json(attachMedia(db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid)));
});

router.put("/:id", adminAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  const merged = { ...existing, ...req.body };
  if (!merged.name || !ALLOWED_CATEGORIES.includes(merged.category)) return res.status(400).json({ error: "A valid name and category are required." });
  const slug = merged.name !== existing.name ? uniqueSlug(merged.name, existing.id) : (merged.slug || uniqueSlug(merged.name, existing.id));
  db.prepare(`UPDATE products SET name=?, slug=?, category=?, tag=?, price=?, currency=?, description=?, image_url=?, sort_order=?, is_available=?, is_featured=?, style=?, fabric=?, colour=?, gender=?, sizes=?, production_time=?, made_to_order=?, updated_at=datetime('now') WHERE id=?`).run(
    merged.name.trim(), slug, merged.category, merged.tag || "", merged.price || "", merged.currency || "GBP", merged.description || "", merged.image_url || "", Number(merged.sort_order) || 0, merged.is_available ? 1 : 0, merged.is_featured ? 1 : 0,
    merged.style || "", merged.fabric || "", merged.colour || "", merged.gender || "", merged.sizes || "", merged.production_time || "", merged.made_to_order ? 1 : 0, req.params.id
  );
  res.json(attachMedia(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", adminAuth, (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  res.json({ deleted: true });
});

module.exports = router;
