require('dotenv').config();
const bcrypt=require('bcryptjs');
const db=require('./db');
const adminOnly=process.argv.includes('--admin-only');
async function seedAdminPassword(){const plain=String(process.env.ADMIN_PASSWORD||'').trim();if(!plain){throw new Error('ADMIN_PASSWORD is missing from backend/.env');}if(plain.length<8)throw new Error('ADMIN_PASSWORD must be at least 8 characters.');const hash=bcrypt.hashSync(plain,12);await db.prepare(`INSERT INTO admin_settings (key,value) VALUES ('admin_password_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(hash);console.log('Admin password saved successfully.');}

async function updateDefaultContactNumbers(){
  const changes=[
    ['uk_phone_display','07523 864253','+44 7523 864253'],
    ['uk_phone_tel','+447523864253','+447523864253'],
    ['uk_whatsapp','447523864253','447523864253'],
    ['ng_phone_display','+234 739 702 3326','+234 703 550 8352'],
    ['ng_phone_tel','+2347397023326','+2347035508352'],
    ['ng_whatsapp','2347397023326','2347035508352'],
  ];
  for(const [key,oldValue,newValue] of changes){
    const row=await db.prepare('SELECT value FROM admin_settings WHERE key=?').get(key);
    if(!row){
      await db.prepare('INSERT INTO admin_settings (key,value) VALUES (?,?)').run(key,newValue);
    }else if(String(row.value||'')===oldValue){
      await db.prepare('UPDATE admin_settings SET value=? WHERE key=?').run(newValue,key);
    }
  }
  console.log('Business contact defaults checked.');
}

async function seedProducts(){const count=Number((await db.prepare('SELECT COUNT(*) AS count FROM products').get()).count||0);if(count>0){console.log(`Products already contain ${count} row(s); starter products were not added.`);return;}const samples=[['Ankara Wrap Dress','ready-to-wear','Women · Ready-to-wear','Enquire','','',1],['Senator Set','ready-to-wear','Men · Ready-to-wear','Enquire','','',2],['Agbada Ensemble','ready-to-wear','Men · Ready-to-wear','Enquire','','',3],['Gobi Cap','cap','Classic fold','','','',1],['Kufi Cap','cap','Everyday','','','',2],['Aso-Oke Fila','cap','Ceremonial','','','',3]];await db.transaction(async tx=>{const insert=tx.prepare('INSERT INTO products (name,category,tag,price,description,image_url,sort_order) VALUES (?,?,?,?,?,?,?)');for(const row of samples)await insert.run(...row)});console.log(`Inserted ${samples.length} starter products.`);}
(async()=>{try{await db.ready;await seedAdminPassword();await updateDefaultContactNumbers();if(!adminOnly)await seedProducts();console.log(adminOnly?'Admin reset complete.':'Seed complete.');await db.close();}catch(error){console.error(error.message);process.exit(1);}})();
