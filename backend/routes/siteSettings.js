const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { config } = require('../config/env');

const router = express.Router();
fs.mkdirSync(config.uploadDirectory, { recursive: true });

const defaults = {
  hero_enabled: '1',
  hero_type: 'video',
  hero_video_url: '/assets/hero.mp4',
  hero_image_url: '',
  hero_kicker: 'African heritage · modern elegance',
  hero_title: 'Clothing that carries your story.',
  hero_highlight: 'your story.',
  hero_copy: 'Bespoke Igbo attire and contemporary African couture, designed with precision for clients in the United Kingdom and Nigeria.',
  hero_primary_text: 'Explore collections',
  hero_primary_link: '#collections',
  hero_secondary_text: 'Book a private consultation',

  craft_enabled: '1',
  craft_video_url: '/assets/atelier.mp4',
  craft_kicker: 'Crafted, not produced',
  craft_title: 'Every line begins by hand.',
  craft_copy: 'Measurements, fabric, cut, structure and finish are considered as one process. The result is clothing that does not merely fit the body—it belongs to it.',
  craft_step_1_number: '01',
  craft_step_1_text: 'Personal consultation',
  craft_step_2_number: '02',
  craft_step_2_text: 'Measured and cut',
  craft_step_3_number: '03',
  craft_step_3_text: 'Finished by hand',

  about_kicker: 'The house',
  about_title: 'Tradition is not a costume. It is a language.',
  about_copy: 'Inspiredmunachimso’s Couture creates pieces that honour identity while feeling entirely current. Every garment is shaped around the person, the occasion and the story it needs to tell.',
  about_link_text: 'Discover the heritage collection',
  about_link_url: '#igbo-heritage',

  services_kicker: 'The service',
  services_title: 'A considered journey, from idea to final fitting.',
  service_1_number: '01',
  service_1_title: 'Personal consultation',
  service_1_copy: 'Share your occasion, inspiration, preferred fabric and timing with the atelier.',
  service_2_number: '02',
  service_2_title: 'Measurements and design',
  service_2_copy: 'Measurements, proportions and design details are confirmed before cutting begins.',
  service_3_number: '03',
  service_3_title: 'Cut and construction',
  service_3_copy: 'The garment is cut, assembled and refined with attention to structure and movement.',
  service_4_number: '04',
  service_4_title: 'Fitting and finish',
  service_4_copy: 'Final adjustments, hand finishing and quality checks complete the piece.',

  announcement_enabled: '0',
  announcement_text: 'Private consultations available in the UK and Nigeria.',
  business_name: 'Inspiredmunachimso’s Couture',
  business_tagline: 'African heritage, tailored for today.',
  business_email: '',
  uk_phone_display: '+44 7523 864253',
  uk_phone_tel: '+447523864253',
  uk_whatsapp: '447523864253',
  ng_phone_display: '+234 703 550 8352',
  ng_phone_tel: '+2347035508352',
  ng_whatsapp: '2347035508352',
  uk_location: 'United Kingdom',
  ng_location: 'Nigeria',
  opening_hours: 'By appointment',
  instagram_url: '',
  facebook_url: '',
  tiktok_url: '',
  youtube_url: '',
  footer_text: 'UK · Nigeria · Worldwide enquiries',

};

const upsert = db.prepare(`
  INSERT INTO admin_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
async function ensureDefaults() {
  const insert = db.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) await insert.run(key, value);
}
async function readSettings() {
  await ensureDefaults();
  const rows = await db.prepare("SELECT key, value FROM admin_settings WHERE key LIKE 'hero_%' OR key LIKE 'craft_%' OR key LIKE 'about_%' OR key LIKE 'services_%' OR key LIKE 'service_%' OR key LIKE 'business_%' OR key LIKE 'announcement_%' OR key LIKE 'uk_%' OR key LIKE 'ng_%' OR key LIKE 'opening_%' OR key LIKE 'instagram_%' OR key LIKE 'facebook_%' OR key LIKE 'tiktok_%' OR key LIKE 'youtube_%' OR key LIKE 'footer_%'").all();
  return { ...defaults, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);
function createStorage(prefix) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDirectory),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype.startsWith('video/') ? '.mp4' : '.jpg');
      cb(null, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });
}
function createUpload(prefix, videoOnly = false) {
  return multer({
    storage: createStorage(prefix),
    limits: { files: 1, fileSize: config.maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!allowedMime.has(file.mimetype)) return cb(new Error('Upload a JPG, PNG, WebP, MP4, WebM or MOV file.'));
      if (videoOnly && !file.mimetype.startsWith('video/')) return cb(new Error('Choose an MP4, WebM or MOV video.'));
      cb(null, true);
    },
  });
}
const heroUpload = createUpload('hero');
const craftUpload = createUpload('craft', true);

const cloudinaryEnabled = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function storeFile(file, req, folder) {
  const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  if (cloudinaryEnabled) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `${process.env.CLOUDINARY_FOLDER || 'inspired-munachimso-couture'}/${folder}`,
      resource_type: mediaType,
      transformation: mediaType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
    });
    fs.unlink(file.path, () => {});
    return { mediaType, url: result.secure_url };
  }
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return { mediaType, url: `${baseUrl}/uploads/${file.filename}` };
}

router.get('/public', async (_req, res) => res.json(await readSettings()));
router.get('/admin', adminAuth, async (_req, res) => res.json(await readSettings()));

router.put('/admin', adminAuth, async (req, res) => {
  const allowed = Object.keys(defaults);
  for (const key of allowed) {
    if (req.body[key] !== undefined) await upsert.run(key, String(req.body[key]));
  }
  res.json(await readSettings());
});

router.post('/admin/media', adminAuth, heroUpload.single('hero_media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a hero image or video.' });
  const stored = await storeFile(req.file, req, 'hero');
  const key = stored.mediaType === 'video' ? 'hero_video_url' : 'hero_image_url';
  await upsert.run(key, stored.url);
  await upsert.run('hero_type', stored.mediaType);
  await upsert.run('hero_enabled', '1');
  res.status(201).json(await readSettings());
});

router.post('/admin/craft-media', adminAuth, craftUpload.single('craft_media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a craft-section video.' });
  const stored = await storeFile(req.file, req, 'craft');
  await upsert.run('craft_video_url', stored.url);
  await upsert.run('craft_enabled', '1');
  res.status(201).json(await readSettings());
});

router.delete('/admin/craft-media', adminAuth, async (_req, res) => {
  await upsert.run('craft_video_url', '');
  await upsert.run('craft_enabled', '0');
  res.json(await readSettings());
});

module.exports = router;
