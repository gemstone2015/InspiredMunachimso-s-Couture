# Inspired Munachimso Couture

Version 1.4 engineering-cleanup release for Node.js 24.

## Project structure

- `frontend/` — React and Vite public website.
- `backend/app.js` — Express application composition.
- `backend/server.js` — process startup and graceful shutdown only.
- `backend/config/` — environment and CORS configuration.
- `backend/middleware/` — rate limits, request IDs, 404 and error handling.
- `backend/routes/` — API route modules.
- `backend/services/` — email-ready notification services.
- `backend/public/admin/` — admin dashboard.
- `backend/data/` — local SQLite data; never commit this folder.
- `backend/uploads/` — local development uploads; never commit this folder.

## First setup

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env -Force
npm run seed
npm run verify
npm start
```

### Frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env -Force
npm run dev
```

Public website: `http://localhost:5173` or the port shown by Vite.

Admin dashboard: `http://localhost:4000/admin`

Backend health: `http://localhost:4000/api/health`

## Daily development

Backend terminal:

```powershell
cd backend
npm start
```

Frontend terminal:

```powershell
cd frontend
npm run dev
```

## Safety

Never commit `.env`, `backend/data`, or `backend/uploads`. Use Cloudinary before production deployment so media survives redeployment.
