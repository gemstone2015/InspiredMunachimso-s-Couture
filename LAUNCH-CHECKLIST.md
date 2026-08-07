# Launch Checklist

## Content

- [ ] Real products, prices or quote wording added
- [ ] Real photos and videos uploaded
- [ ] Hero and craft media approved
- [ ] Business email, locations, social links and opening hours correct
- [ ] Policies reviewed and published
- [ ] Test testimonials removed or clearly marked

## Security

- [ ] Strong unique admin password
- [ ] JWT secret generated and stored only as a hosting secret
- [ ] Production origins contain only real HTTPS URLs
- [ ] No `.env`, database, uploads or backups committed to Git
- [ ] Test customer accounts and reset tokens removed

## Operations

- [ ] Database seeded once in production
- [ ] Persistent disk attached and writable
- [ ] `npm run backup` tested
- [ ] Restore tested on a non-production copy
- [ ] Admin can upload, replace, recycle, restore and permanently delete media

## Quality

- [ ] `npm run verify` passes in backend
- [ ] `npm run build` passes in frontend
- [ ] `npm run smoke -- <backend-url>` passes
- [ ] Mobile, tablet and desktop tested
- [ ] Chrome, Edge and Safari tested where available
- [ ] Forms show clear success and error messages

## Launch services

- [ ] Domain connected
- [ ] HTTPS active
- [ ] Cloudinary configured or local disk storage explicitly accepted
- [ ] Email configured or customer-facing email claims disabled
- [ ] Stripe/Paystack left disabled until verified business keys are ready
- [ ] Analytics configured after consent/privacy review
