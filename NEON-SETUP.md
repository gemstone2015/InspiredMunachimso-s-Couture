# Neon PostgreSQL setup — beginner steps

This version no longer uses SQLite. All business data is stored in Neon PostgreSQL.

## 1. Local backend `.env`

Copy `backend/.env.example` to `backend/.env` and set:

```env
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_long_random_secret
ADMIN_PASSWORD=your_private_admin_password
```

Also add your existing Cloudinary values. Never commit `backend/.env` to GitHub.

## 2. Install and initialise

```powershell
cd backend
npm install
npm run seed
npm run verify
npm start
```

The first connection automatically creates the PostgreSQL tables and indexes. `npm run seed` saves the admin password and inserts sample products only when the product table is empty.

## 3. Render environment variables

Add `DATABASE_URL` directly in Render → Environment. Do not put the Neon connection string in GitHub or Vercel.

Because business data is in Neon and media is in Cloudinary, this version does not require a Render persistent disk.

## 4. Safety

The Neon connection string contains a database password. If it is ever committed publicly, rotate/reset the Neon database password immediately and update `DATABASE_URL` everywhere it is used.
