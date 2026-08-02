# Changelog

## 1.4.0 — Engineering cleanup

- Split Express application composition from process startup.
- Centralised environment and CORS configuration.
- Added environment safety warnings.
- Added request IDs to API responses and error logs.
- Standardised API and general 404 responses.
- Standardised upload and server error responses.
- Centralised rate-limit policies.
- Added graceful shutdown handling.
- Added `npm run check:syntax` and `npm run verify`.
- Added root Git ignore rules for secrets, databases, uploads and build output.
- Removed an unused temporary notification file.
- Preserved all existing products, media, orders, tracking, payments, appointments, testimonials and admin routes.
