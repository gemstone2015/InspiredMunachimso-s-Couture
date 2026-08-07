const db = require('../db');

async function sendEmail({ eventType, to, subject, html, text }) {
  if (!to) return { sent:false, reason:'No recipient' };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Inspiredmunachimso’s Couture <onboarding@resend.dev>';
  if (!apiKey) {
    await db.prepare(`INSERT INTO notification_log (event_type, recipient, subject, status, provider) VALUES (?, ?, ?, 'queued', 'not-configured')`).run(eventType,to,subject);
    console.log(`[email-ready] ${eventType} -> ${to}: ${subject}`);
    return { sent:false, queued:true };
  }
  try {
    const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html,text})});
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result.message || 'Email provider rejected request');
    await db.prepare(`INSERT INTO notification_log (event_type, recipient, subject, status, provider) VALUES (?, ?, ?, 'sent', 'resend')`).run(eventType,to,subject);
    return { sent:true, id:result.id };
  } catch(error) {
    await db.prepare(`INSERT INTO notification_log (event_type, recipient, subject, status, provider, error_message) VALUES (?, ?, ?, 'failed', 'resend', ?)`).run(eventType,to,subject,error.message);
    console.error('Email send failed:',error.message);
    return { sent:false,error:error.message };
  }
}
function orderConfirmation(order){const site=process.env.PUBLIC_SITE_URL||'http://localhost:5173';return sendEmail({eventType:'order_created',to:order.email,subject:`We received your couture request — ${order.order_reference}`,text:`Thank you ${order.customer_name}. Your order reference is ${order.order_reference}. Track your order at ${site}/#track-order.`,html:`<h2>Thank you, ${order.customer_name}</h2><p>We received your couture request.</p><p><strong>Order reference:</strong> ${order.order_reference}</p><p>Keep this reference and use your phone number to track the order.</p><p><a href="${site}/#track-order">Track your order</a></p>`});}
function orderStatusChanged(order){return sendEmail({eventType:'order_status_changed',to:order.email,subject:`Order update — ${order.order_reference}`,text:`Your order ${order.order_reference} is now: ${order.status.replaceAll('_',' ')}.`,html:`<h2>Your order has moved forward</h2><p><strong>${order.order_reference}</strong></p><p>Current stage: <strong>${order.status.replaceAll('_',' ')}</strong></p>`});}
function appointmentConfirmation(appointment){return sendEmail({eventType:'appointment_requested',to:appointment.email,subject:`Appointment request received — ${appointment.appointment_reference}`,text:`We received your ${appointment.appointment_type} request for ${appointment.preferred_date||'your preferred date'}. Reference: ${appointment.appointment_reference}.`,html:`<h2>Appointment request received</h2><p>Reference: <strong>${appointment.appointment_reference}</strong></p><p>Type: ${appointment.appointment_type}</p><p>Preferred date: ${appointment.preferred_date||'To be agreed'}</p><p>We will contact you to confirm.</p>`});}
module.exports={sendEmail,orderConfirmation,orderStatusChanged,appointmentConfirmation};
