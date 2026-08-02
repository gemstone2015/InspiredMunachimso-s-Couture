const express = require("express");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// POST /api/messages — public, contact form or "book an alteration" form
router.post("/", (req, res) => {
  const { customer_name, phone, message, type } = req.body;

  if (!customer_name || !phone || !message) {
    return res.status(400).json({ error: "Name, phone number, and message are required." });
  }

  const result = db
    .prepare(`INSERT INTO messages (type, customer_name, phone, message) VALUES (?, ?, ?, ?)`)
    .run(type === "alteration" ? "alteration" : "contact", customer_name, phone, message);

  const created = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);

  const waNumber = process.env.WHATSAPP_UK_NUMBER || process.env.WHATSAPP_NG_NUMBER || process.env.WHATSAPP_NUMBER || "";
  const waText = encodeURIComponent(`${message} — from ${customer_name} (${phone})`);
  const whatsappLink = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null;

  res.status(201).json({ ...created, whatsappLink });
});

// GET /api/messages — admin only
router.get("/", adminAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  res.json(rows);
});

// PATCH /api/messages/:id — admin only, mark read/replied
router.patch("/:id", adminAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ["unread", "read", "replied"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
  }
  const result = db.prepare("UPDATE messages SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found." });
  res.json(db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id));
});

// DELETE /api/messages/:id — admin only
router.delete("/:id", adminAuth, (req, res) => {
  const result = db.prepare("DELETE FROM messages WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found." });
  res.json({ deleted: true });
});

module.exports = router;
