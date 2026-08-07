# Phase 3 setup

This version adds:
- Customer inspiration image/PDF uploads during pre-order
- Visual order tracking timeline
- Appointment requests and admin appointment management
- Testimonial management and homepage publishing
- Email-ready order and appointment confirmations

## Email during development
No email account is required. Notifications are recorded in `notification_log` and printed in the backend terminal.

Later add to `backend/.env`:

```
RESEND_API_KEY=
EMAIL_FROM=Inspiredmunachimso’s Couture <orders@yourdomain.com>
BUSINESS_EMAIL=
MAX_CUSTOMER_UPLOAD_MB=12
```

## Run

Backend:
```
cd backend
npm install
Copy-Item .env.example .env -Force
npm run seed
npm start
```

Frontend:
```
cd frontend
npm install
Copy-Item .env.example .env -Force
npm run dev
```

Admin: http://localhost:4000/admin
