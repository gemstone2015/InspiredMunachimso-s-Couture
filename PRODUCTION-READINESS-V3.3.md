# Production Readiness v3.3

This release freezes feature development and adds launch-focused safeguards.

## Added
- Database indexes for catalogue, dashboard, customer, appointment and campaign queries.
- Public API cache headers for products, galleries, collections, testimonials and site settings.
- No-store headers for customer and admin API responses.
- Stronger static media caching in production.
- Expanded health endpoint with database, memory and integration status.
- Database and local-upload backup/restore commands.
- SEO title, description, Open Graph metadata, favicon, robots.txt and sitemap placeholders.

## Commands
- `npm run verify`
- `npm run backup`
- `npm run restore -- ./backups/<timestamp>`

## Before launch
Replace `https://example.com` in `frontend/public/robots.txt` and `frontend/public/sitemap.xml` with the real domain. Add `frontend/public/assets/social-share.jpg`.
