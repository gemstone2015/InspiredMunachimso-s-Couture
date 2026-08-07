require('dotenv').config();
(async () => {
  try {
    const db = require('../db');
    await db.ready;
    const row = await db.prepare('SELECT 1 AS ok').get();
    if (Number(row?.ok) !== 1) throw new Error('Database readiness check failed');
    console.log('Neon PostgreSQL database OK');
    await db.close();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
