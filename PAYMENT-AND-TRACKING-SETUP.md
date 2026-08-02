# Payment and order tracking setup

## What is included

- Automatic order references such as `IMC-2026-A1B2C3`
- Customer tracking using order reference plus phone number
- Admin order stages and payment status
- Admin deposit amount in GBP or NGN
- Stripe Checkout for GBP payments
- Paystack Checkout for NGN payments
- Server-side payment verification

## Local setup

Backend `.env`:

```env
PUBLIC_SITE_URL=http://localhost:5173
STRIPE_SECRET_KEY=
PAYSTACK_SECRET_KEY=
```

Use test secret keys first. Never put secret keys in the frontend `.env` or commit them to GitHub.

After adding or changing backend variables, restart the backend.

## Order workflow

1. Customer submits the pre-order form and receives an order reference.
2. Admin opens **Orders & Payments**.
3. Admin chooses the order stage, currency and deposit amount, then clicks **Save**.
4. Customer opens **Track Order**, enters the reference and phone number.
5. The payment button appears when a deposit is set.
6. GBP uses Stripe and NGN uses Paystack.
7. The backend verifies the payment before marking it paid.

## Production requirement

Before taking real payments, configure provider webhooks in addition to the included return-page verification. Webhooks ensure payment status is updated even if a customer closes the browser before returning to the site.
