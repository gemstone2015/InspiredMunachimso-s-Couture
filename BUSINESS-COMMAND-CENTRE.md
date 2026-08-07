# Business Command Centre

The admin dashboard now opens on a live Command Centre showing:

- open orders and orders currently in production
- deposits awaiting payment
- unread customer messages
- upcoming and today's appointments
- visible products and published testimonials
- six-month order, appointment and enquiry activity
- paid and outstanding totals by currency
- order-stage distribution
- catalogue category mix
- upcoming appointments, recent orders and recent enquiries

The figures are calculated directly from the Neon PostgreSQL database through:

`GET /api/admin/dashboard/overview`

This endpoint is protected by the existing admin JWT.

## Hero video

The previous temporary hero video has been removed. The website now uses a luxury gradient background by default.

Later:

1. Put the final video at `frontend/public/assets/hero.mp4`.
2. Add this to `frontend/.env`:

```env
VITE_HERO_VIDEO_URL=/assets/hero.mp4
```

3. Restart the frontend.
