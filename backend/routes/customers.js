const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const customerAuth = require('../middleware/customerAuth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const cleanEmail = (value) => String(value || '').trim().toLowerCase();
const publicCustomer = (row) => row && ({
  id: row.id,
  first_name: row.first_name,
  last_name: row.last_name,
  email: row.email,
  phone: row.phone,
  country: row.country || '',
  address: row.address || '',
  address_line_2: row.address_line_2 || '',
  city: row.city || '',
  postcode: row.postcode || '',
  preferred_contact: row.preferred_contact || 'whatsapp',
  created_at: row.created_at,
  last_login_at: row.last_login_at,
});
const signCustomer = (row) => jwt.sign({ role:'customer',customerId:row.id,email:row.email },process.env.JWT_SECRET,{ expiresIn:'7d' });
const makeOrderReference = () => `IMC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

router.post('/register', async (req,res) => {
  const firstName=String(req.body?.first_name||'').trim();
  const lastName=String(req.body?.last_name||'').trim();
  const email=cleanEmail(req.body?.email);
  const phone=String(req.body?.phone||'').trim();
  const password=String(req.body?.password||'');
  if(!firstName||!lastName||!email||!phone||!password)return res.status(400).json({error:'Please complete all required fields.'});
  if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Please enter a valid email address.'});
  if(password.length<8)return res.status(400).json({error:'Password must contain at least 8 characters.'});
  if(await db.prepare('SELECT id FROM customers WHERE lower(email)=lower(?)').get(email))return res.status(409).json({error:'An account already exists with this email.'});
  const result=await db.prepare('INSERT INTO customers (first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?)').run(firstName,lastName,email,phone,bcrypt.hashSync(password,12));
  const customer=await db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({token:signCustomer(customer),customer:publicCustomer(customer)});
});

router.post('/login', async (req,res) => {
  const email=cleanEmail(req.body?.email);const password=String(req.body?.password||'');
  const customer=await db.prepare('SELECT * FROM customers WHERE lower(email)=lower(?)').get(email);
  if(!customer||!bcrypt.compareSync(password,customer.password_hash))return res.status(401).json({error:'Incorrect email or password.'});
  if(!customer.is_active)return res.status(403).json({error:'This customer account is disabled.'});
  await db.prepare('UPDATE customers SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(customer.id);
  const updated=await db.prepare('SELECT * FROM customers WHERE id=?').get(customer.id);
  res.json({token:signCustomer(updated),customer:publicCustomer(updated)});
});

router.post('/forgot-password', async (req,res) => {
  const email=cleanEmail(req.body?.email);
  const customer=await db.prepare('SELECT * FROM customers WHERE lower(email)=lower(?) AND is_active=1').get(email);
  const generic={message:'If that email is registered, password reset instructions have been prepared.'};
  if(!customer)return res.json(generic);
  const rawToken=crypto.randomBytes(24).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.prepare('DELETE FROM customer_password_resets WHERE customer_id=? OR expires_at < CURRENT_TIMESTAMP').run(customer.id);
  await db.prepare("INSERT INTO customer_password_resets (customer_id,token_hash,expires_at) VALUES (?,?,CURRENT_TIMESTAMP + INTERVAL '30 minutes')").run(customer.id,tokenHash);
  console.log(`[customer-password-reset] ${customer.email}: ${rawToken}`);
  res.json({...generic,...(process.env.NODE_ENV!=='production'?{development_reset_token:rawToken}:{})});
});

router.post('/reset-password', async (req,res) => {
  const token=String(req.body?.token||'').trim();const password=String(req.body?.password||'');
  if(!token||password.length<8)return res.status(400).json({error:'A valid reset token and an 8-character password are required.'});
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const row=await db.prepare('SELECT * FROM customer_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP').get(tokenHash);
  if(!row)return res.status(400).json({error:'This reset token is invalid or has expired.'});
  await db.prepare('UPDATE customers SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(password,12),row.customer_id);
  await db.prepare('UPDATE customer_password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(row.id);
  res.json({success:true,message:'Password changed successfully. You can now log in.'});
});

router.get('/me',customerAuth,async(req,res)=>{const customer=await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.customerId);if(!customer||!customer.is_active)return res.status(404).json({error:'Customer account not found.'});res.json(publicCustomer(customer));});
router.patch('/me',customerAuth,async(req,res)=>{const current=await db.prepare('SELECT * FROM customers WHERE id=?').get(req.customer.customerId);if(!current)return res.status(404).json({error:'Customer account not found.'});const values=[String(req.body.first_name??current.first_name).trim(),String(req.body.last_name??current.last_name).trim(),String(req.body.phone??current.phone).trim(),String(req.body.country??current.country??'').trim(),String(req.body.address??current.address??'').trim(),String(req.body.address_line_2??current.address_line_2??'').trim(),String(req.body.city??current.city??'').trim(),String(req.body.postcode??current.postcode??'').trim(),['whatsapp','phone','email'].includes(req.body.preferred_contact)?req.body.preferred_contact:(current.preferred_contact||'whatsapp'),current.id];await db.prepare('UPDATE customers SET first_name=?,last_name=?,phone=?,country=?,address=?,address_line_2=?,city=?,postcode=?,preferred_contact=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(...values);res.json(publicCustomer(await db.prepare('SELECT * FROM customers WHERE id=?').get(current.id)));});
router.get('/dashboard',customerAuth,async(req,res)=>{const c=await db.prepare('SELECT * FROM customers WHERE id=?').get(req.customer.customerId);const orders=await db.prepare('SELECT id,order_reference,style_inspiration,status,currency,quoted_amount,payment_status,event_date,created_at FROM preorders WHERE customer_id=? OR lower(email)=lower(?) ORDER BY id DESC LIMIT 20').all(c.id,c.email);const appointments=await db.prepare('SELECT id,appointment_reference,appointment_type,preferred_date,preferred_time,status,location,created_at FROM appointments WHERE lower(email)=lower(?) ORDER BY id DESC LIMIT 20').all(c.email);const wishlistCount=(await db.prepare('SELECT COUNT(*) count FROM customer_wishlist WHERE customer_id=?').get(c.id)).count;const measurementsCount=(await db.prepare('SELECT COUNT(*) count FROM customer_measurements WHERE customer_id=?').get(c.id)).count;res.json({customer:publicCustomer(c),metrics:{orders:orders.length,activeOrders:orders.filter(x=>!['delivered','cancelled'].includes(x.status)).length,appointments:appointments.length,wishlist:wishlistCount,measurements:measurementsCount},orders,appointments});});
router.get('/measurements',customerAuth,async(req,res)=>res.json(await db.prepare('SELECT * FROM customer_measurements WHERE customer_id=? ORDER BY id DESC').all(req.customer.customerId)));
router.post('/measurements',customerAuth,async(req,res)=>{const b=req.body||{};const result=await db.prepare('INSERT INTO customer_measurements (customer_id,profile_name,chest,waist,hip,shoulder,neck,sleeve,height,weight,trouser_length,shoe_size,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(req.customer.customerId,String(b.profile_name||'My measurements').trim(),b.chest||'',b.waist||'',b.hip||'',b.shoulder||'',b.neck||'',b.sleeve||'',b.height||'',b.weight||'',b.trouser_length||'',b.shoe_size||'',b.notes||'');res.status(201).json(await db.prepare('SELECT * FROM customer_measurements WHERE id=?').get(result.lastInsertRowid));});
router.delete('/measurements/:id',customerAuth,async(req,res)=>{await db.prepare('DELETE FROM customer_measurements WHERE id=? AND customer_id=?').run(req.params.id,req.customer.customerId);res.json({success:true});});
router.get('/wishlist',customerAuth,async(req,res)=>res.json(await db.prepare('SELECT p.*,w.created_at wishlist_created_at FROM customer_wishlist w JOIN products p ON p.id=w.product_id WHERE w.customer_id=? ORDER BY w.id DESC').all(req.customer.customerId)));
router.post('/wishlist/:productId',customerAuth,async(req,res)=>{const product=await db.prepare('SELECT id FROM products WHERE id=?').get(req.params.productId);if(!product)return res.status(404).json({error:'Product not found.'});await db.prepare('INSERT OR IGNORE INTO customer_wishlist (customer_id,product_id) VALUES (?,?)').run(req.customer.customerId,product.id);res.status(201).json({success:true});});
router.delete('/wishlist/:productId',customerAuth,async(req,res)=>{await db.prepare('DELETE FROM customer_wishlist WHERE customer_id=? AND product_id=?').run(req.customer.customerId,req.params.productId);res.json({success:true});});
router.post('/wishlist/:productId/enquiry',customerAuth,async(req,res)=>{const customer=await db.prepare('SELECT * FROM customers WHERE id=?').get(req.customer.customerId);const product=await db.prepare('SELECT * FROM products WHERE id=?').get(req.params.productId);if(!product)return res.status(404).json({error:'Product not found.'});const measurementId=req.body?.measurement_profile_id?Number(req.body.measurement_profile_id):null;if(measurementId&&!await db.prepare('SELECT id FROM customer_measurements WHERE id=? AND customer_id=?').get(measurementId,customer.id))return res.status(400).json({error:'Selected measurement profile was not found.'});let reference=makeOrderReference();while(await db.prepare('SELECT id FROM preorders WHERE order_reference=?').get(reference))reference=makeOrderReference();const result=await db.prepare('INSERT INTO preorders (customer_id,product_id,measurement_profile_id,customer_name,phone,email,order_reference,style_inspiration,fabric,event_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(customer.id,product.id,measurementId,`${customer.first_name} ${customer.last_name}`,customer.phone,customer.email,reference,product.name,product.fabric||'',String(req.body?.event_date||''),String(req.body?.notes||'Wishlist quotation request'));await db.prepare("INSERT INTO order_status_history (preorder_id,status,note) VALUES (?,'new','Quote requested from customer wishlist')").run(result.lastInsertRowid);res.status(201).json({success:true,order_reference:reference});});
router.get('/admin/all',adminAuth,async(_req,res)=>{const rows=await db.prepare(`SELECT c.id,c.first_name,c.last_name,c.email,c.phone,c.country,c.is_active,c.created_at,c.last_login_at,(SELECT COUNT(*) FROM preorders p WHERE p.customer_id=c.id OR lower(p.email)=lower(c.email)) orders,(SELECT COUNT(*) FROM appointments a WHERE lower(a.email)=lower(c.email)) appointments FROM customers c ORDER BY c.id DESC`).all();res.json(rows);});
router.patch('/admin/:id/status',adminAuth,async(req,res)=>{await db.prepare('UPDATE customers SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.is_active?1:0,req.params.id);res.json({success:true});});
module.exports=router;
