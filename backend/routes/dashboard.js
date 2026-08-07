const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);
const number = (row,key='value') => Number(row?.[key] || 0);

router.get('/overview', async (_req,res) => {
  const today = (await db.prepare("SELECT to_char(CURRENT_DATE,'YYYY-MM-DD') AS value").get()).value;
  const q = async (sql,...params) => db.prepare(sql).get(...params);
  const a = async (sql,...params) => db.prepare(sql).all(...params);
  const metrics = {
    ordersToday: number(await q("SELECT COUNT(*) AS value FROM preorders WHERE created_at::date = CURRENT_DATE")),
    openOrders: number(await q("SELECT COUNT(*) AS value FROM preorders WHERE status NOT IN ('delivered','cancelled')")),
    inProduction: number(await q("SELECT COUNT(*) AS value FROM preorders WHERE status IN ('measurements_received','in_production','fitting','ready')")),
    pendingDeposits: number(await q("SELECT COUNT(*) AS value FROM preorders WHERE quoted_amount > 0 AND payment_status IN ('unpaid','pending') AND status <> 'cancelled'")),
    paidRevenueMinor: number(await q("SELECT COALESCE(SUM(quoted_amount),0) AS value FROM preorders WHERE payment_status='paid'")),
    unreadMessages: number(await q("SELECT COUNT(*) AS value FROM messages WHERE status='unread'")),
    appointmentsToday: number(await q("SELECT COUNT(*) AS value FROM appointments WHERE preferred_date=? AND status NOT IN ('cancelled','completed')",today)),
    upcomingAppointments: number(await q("SELECT COUNT(*) AS value FROM appointments WHERE preferred_date>=? AND status IN ('requested','confirmed','rescheduled')",today)),
    visibleProducts: number(await q("SELECT COUNT(*) AS value FROM products WHERE is_available=1")),
    publishedTestimonials: number(await q("SELECT COUNT(*) AS value FROM testimonials WHERE is_published=1")),
  };
  const currencyTotals = await a(`SELECT currency,COALESCE(SUM(CASE WHEN payment_status='paid' THEN quoted_amount ELSE 0 END),0) AS paid,COALESCE(SUM(CASE WHEN quoted_amount>0 AND payment_status IN ('unpaid','pending') THEN quoted_amount ELSE 0 END),0) AS outstanding FROM preorders GROUP BY currency ORDER BY currency`);
  const monthly = await a(`
    WITH months AS (
      SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') AS month_start
    )
    SELECT to_char(m.month_start,'YYYY-MM') AS month_key,
           to_char(m.month_start,'Mon') AS label,
           (SELECT COUNT(*) FROM preorders p WHERE date_trunc('month',p.created_at)=m.month_start) AS orders,
           (SELECT COUNT(*) FROM appointments x WHERE date_trunc('month',x.created_at)=m.month_start) AS appointments,
           (SELECT COUNT(*) FROM messages y WHERE date_trunc('month',y.created_at)=m.month_start) AS enquiries,
           (SELECT COALESCE(SUM(p2.quoted_amount),0) FROM preorders p2 WHERE p2.paid_at IS NOT NULL AND date_trunc('month',p2.paid_at)=m.month_start AND p2.payment_status='paid') AS revenue_minor
    FROM months m ORDER BY m.month_start
  `);
  const orderStages = await a(`SELECT status,COUNT(*) AS count FROM preorders WHERE status<>'cancelled' GROUP BY status ORDER BY count DESC,status`);
  const categories = await a(`SELECT category,COUNT(*) AS count FROM products WHERE is_available=1 GROUP BY category ORDER BY count DESC,category LIMIT 6`);
  const nextAppointments = await a(`SELECT appointment_reference,customer_name,appointment_type,preferred_date,preferred_time,location,status FROM appointments WHERE preferred_date>=? AND status IN ('requested','confirmed','rescheduled') ORDER BY preferred_date,preferred_time LIMIT 6`,today);
  const recentOrders = await a(`SELECT order_reference,customer_name,status,payment_status,currency,quoted_amount,created_at FROM preorders ORDER BY created_at DESC LIMIT 6`);
  const recentMessages = await a(`SELECT customer_name,type,status,created_at FROM messages ORDER BY created_at DESC LIMIT 5`);
  res.json({generatedAt:new Date().toISOString(),metrics,currencyTotals,monthly,orderStages,categories,nextAppointments,recentOrders,recentMessages});
});
module.exports=router;
