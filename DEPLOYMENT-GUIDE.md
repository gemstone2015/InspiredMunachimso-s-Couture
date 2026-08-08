# Deployment Guide — Neon PostgreSQL edition

## Architecture

- Frontend: Vercel
- Backend/admin: Render
- Database: Neon PostgreSQL
- Images/videos: Cloudinary

No SQLite persistent disk is required in this edition.

## Backend on Render

Create a Web Service from the GitHub repository:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check: /api/ready
```

Add these private Render environment variables:

```env
NODE_ENV=production
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_long_random_secret
ADMIN_PASSWORD=your_private_admin_password
ALLOWED_ORIGINS=https://your-frontend.vercel.app
PUBLIC_SITE_URL=https://your-frontend.vercel.app
PUBLIC_API_URL=https://your-backend.onrender.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=inspiredmunachimso-couture
WHATSAPP_UK_NUMBER=447523864253
WHATSAPP_NG_NUMBER=2347035508352
```

After the first deploy, open the Render Shell and run:

```bash
npm run seed
```

Then test:

```text
https://your-backend.onrender.com/api/ready
https://your-backend.onrender.com/api/health
https://your-backend.onrender.com/admin
```

## Frontend on Vercel

Import the same GitHub repository and choose:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Add:

```env
VITE_API_URL=https://your-backend.onrender.com
```

Redeploy, then update Render `ALLOWED_ORIGINS` and `PUBLIC_SITE_URL` with the exact Vercel URL.

## Secrets

Never commit any of these to GitHub:

- `DATABASE_URL`
- `CLOUDINARY_API_SECRET`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- Stripe/Paystack secret keys
