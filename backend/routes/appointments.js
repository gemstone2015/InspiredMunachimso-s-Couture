const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { appointmentConfirmation } = require('../services/notifications');
const router = express.Router();
const TYPES=['consultation','measurement','fitting','alteration_dropoff','collection','video_consultation'];
const STATUSES=['requested','confirmed','rescheduled','completed','cancelled'];
function ref(){return `APT-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}
router.post('/', async(req,res)=>{const {customer_name,phone,email,appointment_type,preferred_date,preferred_time,location,notes}=req.body;if(!customer_name||!phone||!appointment_type)return res.status(400).json({error:'Name, phone and appointment type are required.'});if(!TYPES.includes(appointment_type))return res.status(400).json({error:'Invalid appointment type.'});let appointment_reference=ref();while(db.prepare('SELECT id FROM appointments WHERE appointment_reference=?').get(appointment_reference))appointment_reference=ref();const r=db.prepare(`INSERT INTO appointments (appointment_reference,customer_name,phone,email,appointment_type,preferred_date,preferred_time,location,notes) VALUES (?,?,?,?,?,?,?,?,?)`).run(appointment_reference,customer_name,phone,email||'',appointment_type,preferred_date||'',preferred_time||'',location||'',notes||'');const row=db.prepare('SELECT * FROM appointments WHERE id=?').get(r.lastInsertRowid);appointmentConfirmation(row).catch(()=>{});res.status(201).json(row)});
router.get('/',adminAuth,(_q,res)=>res.json(db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all()));
router.patch('/:id',adminAuth,(req,res)=>{const cur=db.prepare('SELECT * FROM appointments WHERE id=?').get(req.params.id);if(!cur)return res.status(404).json({error:'Appointment not found.'});const status=req.body.status??cur.status;if(!STATUSES.includes(status))return res.status(400).json({error:'Invalid status.'});db.prepare(`UPDATE appointments SET status=?, preferred_date=?, preferred_time=?, admin_note=?, updated_at=datetime('now') WHERE id=?`).run(status,req.body.preferred_date??cur.preferred_date,req.body.preferred_time??cur.preferred_time,req.body.admin_note??cur.admin_note,cur.id);res.json(db.prepare('SELECT * FROM appointments WHERE id=?').get(cur.id))});
router.delete('/:id',adminAuth,(req,res)=>{db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);res.json({deleted:true})});
module.exports=router;
