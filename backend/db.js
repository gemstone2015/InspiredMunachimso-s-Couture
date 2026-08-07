const { Pool, types } = require('pg');

// PostgreSQL BIGINT values are counts/IDs in this app and comfortably fit JS Number.
types.setTypeParser(20, (value) => Number(value));

const connectionString = String(process.env.DATABASE_URL || '').trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Add your Neon PostgreSQL connection string to backend/.env.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function placeholders(sql) {
  let index = 0;
  let out = '';
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '?') {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function normaliseSql(input) {
  let sql = String(input);
  sql = sql.replace(/datetime\('now'\s*,\s*'\+30 minutes'\)/gi, "(CURRENT_TIMESTAMP + INTERVAL '30 minutes')");
  sql = sql.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  sql = placeholders(sql);
  if (/^\s*INSERT\s+/i.test(sql) && /INSERT\s+OR\s+IGNORE/i.test(String(input)) && !/ON\s+CONFLICT/i.test(sql)) {
    sql += ' ON CONFLICT DO NOTHING';
  }
  return sql;
}

function statement(sql, client = pool) {
  return {
    async all(...params) {
      await ready;
      const result = await client.query(normaliseSql(sql), params);
      return result.rows;
    },
    async get(...params) {
      await ready;
      const result = await client.query(normaliseSql(sql), params);
      return result.rows[0];
    },
    async run(...params) {
      await ready;
      let query = normaliseSql(sql).trim();
      if (/^INSERT\s+/i.test(query) && !/\bRETURNING\b/i.test(query)) query += ' RETURNING *';
      const result = await client.query(query, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows?.[0]?.id,
        row: result.rows?.[0],
      };
    },
  };
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
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
  made_to_order INTEGER NOT NULL DEFAULT 1,
  production_time TEXT,
  sizes TEXT,
  gender TEXT,
  colour TEXT,
  fabric TEXT,
  style TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug) WHERE slug IS NOT NULL AND slug <> '';

CREATE TABLE IF NOT EXISTS product_media (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  public_id TEXT,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order, id);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  country TEXT,
  address TEXT,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'whatsapp',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers(lower(email));

CREATE TABLE IF NOT EXISTS preorders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  measurement_profile_id BIGINT,
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
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_reference ON preorders(order_reference) WHERE order_reference IS NOT NULL AND order_reference <> '';

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'contact',
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preorder_files (
  id BIGSERIAL PRIMARY KEY,
  preorder_id BIGINT NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
  original_name TEXT,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','document')),
  media_url TEXT NOT NULL,
  public_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_preorder_files_order ON preorder_files(preorder_id, id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGSERIAL PRIMARY KEY,
  preorder_id BIGINT NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(preorder_id, id);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonials (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  location TEXT,
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_measurements (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL DEFAULT 'My measurements',
  chest TEXT, waist TEXT, hip TEXT, shoulder TEXT, neck TEXT, sleeve TEXT,
  height TEXT, weight TEXT, trouser_length TEXT, shoe_size TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE preorders DROP CONSTRAINT IF EXISTS preorders_measurement_profile_id_fkey;
ALTER TABLE preorders ADD CONSTRAINT preorders_measurement_profile_id_fkey FOREIGN KEY (measurement_profile_id) REFERENCES customer_measurements(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS customer_wishlist (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS customer_password_resets (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_password_reset_customer ON customer_password_resets(customer_id, created_at);

CREATE TABLE IF NOT EXISTS media_assets (
  id BIGSERIAL PRIMARY KEY,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','video','document')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  public_id TEXT,
  original_name TEXT,
  display_name TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category, created_at);

CREATE TABLE IF NOT EXISTS media_trash (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  public_id TEXT,
  original_name TEXT,
  display_name TEXT,
  category TEXT,
  tags TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  source_payload TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_trash_deleted ON media_trash(deleted_at DESC);

CREATE TABLE IF NOT EXISTS gallery_albums (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gallery_items (
  id BIGSERIAL PRIMARY KEY,
  album_id BIGINT NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  source_type TEXT,
  source_id TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gallery_items_album ON gallery_items(album_id, sort_order, id);

CREATE TABLE IF NOT EXISTS collections (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  description TEXT,
  cover_url TEXT,
  cover_media_type TEXT NOT NULL DEFAULT 'image',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS collection_products (
  collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(collection_id, product_id)
);
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT,
  collection_id BIGINT REFERENCES collections(id) ON DELETE SET NULL,
  banner_url TEXT,
  button_text TEXT,
  button_link TEXT,
  start_at TEXT,
  end_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category_available_order ON products(category, is_available, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_products_featured_available ON products(is_featured, is_available, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_preorders_status_created ON preorders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preorders_payment_status ON preorders(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preorders_customer_email ON preorders(customer_id, email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status_created ON messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, preferred_date, preferred_time);
CREATE INDEX IF NOT EXISTS idx_testimonials_published_order ON testimonials(is_published, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_public_order ON gallery_albums(is_published, is_featured, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_collections_public_order ON collections(status, is_featured, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_dates ON campaigns(status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer_created ON customer_wishlist(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_customer_updated ON customer_measurements(customer_id, updated_at DESC);
`;

const defaults = {
  hero_enabled: '1',
  hero_type: 'video',
  hero_video_url: '/assets/hero.mp4',
  hero_image_url: '',
  hero_kicker: 'African heritage · modern elegance',
  hero_title: 'Clothing that carries your story.',
  hero_highlight: 'your story.',
  hero_copy: 'Bespoke Igbo attire and contemporary African couture, designed with precision for clients in the United Kingdom and Nigeria.',
  hero_primary_text: 'Explore collections',
  hero_primary_link: '#collections',
  hero_secondary_text: 'Book a private consultation',
};

async function initialise() {
  await pool.query(schemaSql);
  await pool.query(`
    INSERT INTO order_status_history (preorder_id, status, note, created_at)
    SELECT p.id, p.status, 'Order imported into tracking timeline', p.created_at
    FROM preorders p
    WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.preorder_id = p.id)
  `);
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query('INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }
}

const ready = initialise();
ready.catch((error) => console.error('PostgreSQL initialisation failed:', error.message));

async function exec(sql) {
  await ready;
  return pool.query(normaliseSql(sql));
}

async function transaction(fn) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = { prepare: (sql) => statement(sql, client) };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  ready,
  prepare: (sql) => statement(sql),
  exec,
  transaction,
  async close() { await pool.end(); },
};
