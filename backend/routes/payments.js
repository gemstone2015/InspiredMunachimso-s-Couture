const express = require('express');
const db = require('../db');

const router = express.Router();

function normalisePhone(value = '') {
  return String(value).replace(/\D/g, '').slice(-10);
}

function getOrder(reference, phone) {
  const order = db.prepare('SELECT * FROM preorders WHERE order_reference = ?').get(String(reference || '').trim().toUpperCase());
  if (!order || normalisePhone(order.phone) !== normalisePhone(phone)) return null;
  return order;
}

function publicUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

router.post('/initialize', async (req, res, next) => {
  try {
    const { order_reference, phone, provider } = req.body;
    const order = getOrder(order_reference, phone);
    if (!order) return res.status(404).json({ error: 'Order reference and phone number do not match.' });
    if (!order.quoted_amount || Number(order.quoted_amount) < 1) return res.status(400).json({ error: 'A payment amount has not yet been added to this order.' });
    if (order.payment_status === 'paid') return res.status(400).json({ error: 'This order has already been paid.' });
    if (!order.email) return res.status(400).json({ error: 'This order does not have a customer email address.' });

    const selected = provider || (order.currency === 'NGN' ? 'paystack' : 'stripe');

    if (selected === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe has not been configured yet.' });
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: order.email,
        client_reference_id: order.order_reference,
        metadata: { order_reference: order.order_reference, preorder_id: String(order.id) },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: String(order.currency || 'GBP').toLowerCase(),
            unit_amount: Number(order.quoted_amount),
            product_data: { name: `Deposit for ${order.order_reference}`, description: order.style_inspiration || 'Inspired Munachimso Couture order deposit' },
          },
        }],
        success_url: `${publicUrl()}/?payment=success&provider=stripe&session_id={CHECKOUT_SESSION_ID}#track-order`,
        cancel_url: `${publicUrl()}/?payment=cancelled#track-order`,
      });
      db.prepare(`UPDATE preorders SET payment_provider='stripe', payment_reference=?, payment_url=?, payment_status='pending', updated_at=datetime('now') WHERE id=?`).run(session.id, session.url, order.id);
      return res.json({ provider: 'stripe', authorization_url: session.url, reference: session.id });
    }

    if (selected === 'paystack') {
      if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Paystack has not been configured yet.' });
      const reference = `${order.order_reference}-${Date.now()}`;
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: order.email,
          amount: Number(order.quoted_amount),
          currency: order.currency || 'NGN',
          reference,
          callback_url: `${publicUrl()}/?payment=success&provider=paystack#track-order`,
          metadata: { order_reference: order.order_reference, preorder_id: order.id },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.status) throw new Error(payload.message || 'Could not initialise Paystack payment.');
      db.prepare(`UPDATE preorders SET payment_provider='paystack', payment_reference=?, payment_url=?, payment_status='pending', updated_at=datetime('now') WHERE id=?`).run(reference, payload.data.authorization_url, order.id);
      return res.json({ provider: 'paystack', authorization_url: payload.data.authorization_url, reference });
    }

    return res.status(400).json({ error: 'Unsupported payment provider.' });
  } catch (error) { next(error); }
});

router.get('/stripe/verify', async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe has not been configured yet.' });
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    const reference = session.client_reference_id || session.metadata?.order_reference;
    const order = db.prepare('SELECT * FROM preorders WHERE order_reference = ?').get(reference);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (session.payment_status === 'paid') {
      db.prepare(`UPDATE preorders SET payment_status='paid', payment_reference=?, paid_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(session.id, order.id);
    }
    res.json({ success: session.payment_status === 'paid', payment_status: session.payment_status, order_reference: reference });
  } catch (error) { next(error); }
});

router.get('/paystack/verify', async (req, res, next) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Paystack has not been configured yet.' });
    const reference = req.query.reference;
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const payload = await response.json();
    if (!response.ok || !payload.status) throw new Error(payload.message || 'Could not verify Paystack payment.');
    const orderRef = payload.data.metadata?.order_reference;
    const order = db.prepare('SELECT * FROM preorders WHERE order_reference = ?').get(orderRef);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const amountMatches = Number(payload.data.amount) === Number(order.quoted_amount);
    if (payload.data.status === 'success' && amountMatches) {
      db.prepare(`UPDATE preorders SET payment_status='paid', payment_reference=?, paid_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(reference, order.id);
    }
    res.json({ success: payload.data.status === 'success' && amountMatches, payment_status: payload.data.status, amount_matches: amountMatches, order_reference: orderRef });
  } catch (error) { next(error); }
});

module.exports = router;
