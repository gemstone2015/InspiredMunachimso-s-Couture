const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "store.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT,
    category TEXT NOT NULL,
    tag TEXT,
    price TEXT,
    currency TEXT NOT NULL DEFAULT 'GBP',
    description TEXT,
    image_url TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    is_featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    public_id TEXT,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order, id);

  CREATE TABLE IF NOT EXISTS preorders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    order_reference TEXT,
    style_inspiration TEXT,
    fabric TEXT,
    event_date TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    quoted_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'GBP',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_provider TEXT,
    payment_reference TEXT,
    payment_url TEXT,
    paid_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'contact',
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Safe migrations for databases created by the earlier version.
const columns = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
const addColumn = (name, sql) => {
  if (!columns.includes(name)) db.exec(`ALTER TABLE products ADD COLUMN ${sql}`);
};
addColumn("slug", "slug TEXT");
addColumn("currency", "currency TEXT NOT NULL DEFAULT 'GBP'");
addColumn("is_featured", "is_featured INTEGER NOT NULL DEFAULT 0");
addColumn("updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
addColumn("made_to_order", "made_to_order INTEGER NOT NULL DEFAULT 1");
addColumn("production_time", "production_time TEXT");
addColumn("sizes", "sizes TEXT");
addColumn("gender", "gender TEXT");
addColumn("colour", "colour TEXT");
addColumn("fabric", "fabric TEXT");
addColumn("style", "style TEXT");

db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug) WHERE slug IS NOT NULL AND slug <> ''");
db.prepare("UPDATE products SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''").run();


// Safe migrations for pre-orders created by earlier versions.
const preorderColumns = db.prepare("PRAGMA table_info(preorders)").all().map((c) => c.name);
const addPreorderColumn = (name, sql) => {
  if (!preorderColumns.includes(name)) db.exec(`ALTER TABLE preorders ADD COLUMN ${sql}`);
};
addPreorderColumn("email", "email TEXT");
addPreorderColumn("order_reference", "order_reference TEXT");
addPreorderColumn("quoted_amount", "quoted_amount INTEGER NOT NULL DEFAULT 0");
addPreorderColumn("currency", "currency TEXT NOT NULL DEFAULT 'GBP'");
addPreorderColumn("payment_status", "payment_status TEXT NOT NULL DEFAULT 'unpaid'");
addPreorderColumn("payment_provider", "payment_provider TEXT");
addPreorderColumn("payment_reference", "payment_reference TEXT");
addPreorderColumn("payment_url", "payment_url TEXT");
addPreorderColumn("paid_at", "paid_at TEXT");
addPreorderColumn("updated_at", "updated_at TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_reference ON preorders(order_reference) WHERE order_reference IS NOT NULL AND order_reference <> ''");
db.prepare("UPDATE preorders SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''").run();
db.prepare("UPDATE preorders SET order_reference = 'IMC-LEGACY-' || printf('%06d', id) WHERE order_reference IS NULL OR order_reference = ''").run();

module.exports = db;

// Phase 3: order history, customer uploads, appointments, testimonials and email log.
db.exec(`
  CREATE TABLE IF NOT EXISTS preorder_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preorder_id INTEGER NOT NULL,
    original_name TEXT,
    media_type TEXT NOT NULL CHECK(media_type IN ('image','document')),
    media_url TEXT NOT NULL,
    public_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(preorder_id) REFERENCES preorders(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_preorder_files_order ON preorder_files(preorder_id, id);

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preorder_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(preorder_id) REFERENCES preorders(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(preorder_id, id);

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_reference TEXT UNIQUE,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    appointment_type TEXT NOT NULL,
    preferred_date TEXT,
    preferred_time TEXT,
    location TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    location TEXT,
    quote TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    image_url TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    recipient TEXT,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    provider TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Give legacy orders an initial timeline entry without duplicating records.
db.prepare(`
  INSERT INTO order_status_history (preorder_id, status, note, created_at)
  SELECT p.id, p.status, 'Order imported into tracking timeline', p.created_at
  FROM preorders p
  WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.preorder_id = p.id)
`).run();
