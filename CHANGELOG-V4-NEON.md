# Version 4.0 — Neon PostgreSQL

- Replaced the local SQLite business database with Neon-compatible PostgreSQL.
- Added `DATABASE_URL` configuration.
- Refactored database access to asynchronous PostgreSQL queries.
- Preserved products, customers, orders, appointments, media, gallery, collections, campaigns and CMS features.
- Removed the Render persistent-disk requirement for business data.
- Kept Cloudinary as the recommended production media store.
- Added Neon setup/deployment documentation.
- Preserved the corrected brand spelling: Inspiredmunachimso’s Couture.
