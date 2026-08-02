// seed.js
// Usage:
//   npm run seed          -> saves admin password and inserts starter products
//   npm run reset-admin   -> only resets the admin password

require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const adminOnly = process.argv.includes("--admin-only");

function seedAdminPassword() {
  const plain = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!plain) {
    console.error("ADMIN_PASSWORD is missing from backend/.env");
    console.error("Open backend/.env and add: ADMIN_PASSWORD=YourStrongPassword");
    process.exit(1);
  }

  if (plain.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(plain, 12);

  db.prepare(`
    INSERT INTO admin_settings (key, value)
    VALUES ('admin_password_hash', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(hash);

  console.log("Admin password saved successfully.");
}

function seedProducts() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;

  if (count > 0) {
    console.log(`Products already contain ${count} row(s); starter products were not added.`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO products
      (name, category, tag, price, description, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const samples = [
    ["Ankara Wrap Dress", "ready-to-wear", "Women · Ready-to-wear", "Enquire", "", "", 1],
    ["Senator Set", "ready-to-wear", "Men · Ready-to-wear", "Enquire", "", "", 2],
    ["Agbada Ensemble", "ready-to-wear", "Men · Ready-to-wear", "Enquire", "", "", 3],
    ["Gobi Cap", "cap", "Classic fold", "", "", "", 1],
    ["Kufi Cap", "cap", "Everyday", "", "", "", 2],
    ["Aso-Oke Fila", "cap", "Ceremonial", "", "", "", 3],
  ];

  db.exec("BEGIN");
  try {
    for (const row of samples) insert.run(...row);
    db.exec("COMMIT");
    console.log(`Inserted ${samples.length} starter products.`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedAdminPassword();
if (!adminOnly) seedProducts();

console.log(adminOnly ? "Admin reset complete." : "Seed complete.");
