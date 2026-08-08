# Inspiredmunachimso’s Couture — Final Deployment Beginner Guide

This package is the Classic Neon PostgreSQL version with:

- header spacing corrected so the brand does not touch Collections;
- UK display number: +44 7523 864253;
- Nigerian number: +234 703 550 8352;
- Neon PostgreSQL database support;
- Cloudinary media support;
- Vercel frontend configuration;
- Render backend configuration.

## Important
Never upload `backend/.env` to GitHub.

Your private `.env` should contain your real Neon, Cloudinary, JWT and admin credentials.

## Local setup

Backend:

```powershell
cd backend
npm install
npm run seed
npm run verify
npm start
```

Frontend, in a second PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

## Updating the existing GitHub project

Copy the contents of this project into your existing Git project, but keep your existing `.git` folder and private `backend/.env`.

Then run:

```powershell
git status
git check-ignore -v backend/.env
git add .
git status
git commit -m "Fix header spacing and update business contact numbers"
git push origin main
```

## Live Render contact variables

In Render > inspiredmunachimso-api > Environment set:

```text
WHATSAPP_UK_NUMBER = 447523864253
WHATSAPP_NG_NUMBER = 2347035508352
```

Save changes. Render will restart/redeploy.

## Vercel

If Vercel is connected to the same GitHub `main` branch, pushing this commit normally creates a new frontend deployment automatically.

If not:
Vercel > Project > Deployments > latest deployment > Redeploy.

## Final checks

- Brand text has clear space before Collections.
- Logo is visible.
- Homepage loads on desktop and mobile.
- UK WhatsApp opens +44 7523 864253.
- Nigeria WhatsApp opens +234 703 550 8352.
- Products and collections load.
- Customer login works.
- Admin works through the Render `/admin` URL.
