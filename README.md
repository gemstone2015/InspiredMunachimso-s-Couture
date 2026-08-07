# Inspiredmunachimso’s Couture

Production-oriented luxury fashion platform with customer accounts, admin CMS, products, media library, galleries, collections, order tracking, appointments and payment-ready workflows.

## Production architecture

- React/Vite frontend
- Node/Express backend
- Neon PostgreSQL database
- Cloudinary media storage

## Local setup

Backend:

```powershell
cd backend
npm install
Copy-Item .env.example .env -Force
# Add DATABASE_URL and private credentials to .env
npm run seed
npm run verify
npm start
```

Frontend:

```powershell
cd frontend
npm install
Copy-Item .env.example .env -Force
npm run dev
```

See `NEON-SETUP.md` and `DEPLOYMENT-GUIDE.md`.
