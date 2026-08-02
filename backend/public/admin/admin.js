const token = localStorage.getItem('admin_token');
if (!token) window.location.href = 'login.html';
const jsonHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

async function apiFetch(url, options = {}) {
  const headers = options.body instanceof FormData ? { Authorization: `Bearer ${token}`, ...(options.headers || {}) } : { ...jsonHeaders, ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) { localStorage.removeItem('admin_token'); window.location.href = 'login.html'; return null; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('admin_token'); window.location.href = 'login.html'; });
document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active'); document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
}));

const productsBody = document.getElementById('productsBody');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
let currentProduct = null;

async function loadProducts() {
  const rows = await apiFetch('/api/products/admin/all'); if (!rows) return;
  productsBody.innerHTML = rows.length ? rows.map((p) => {
    const cover = p.cover_media || p.media?.[0];
    const preview = cover ? (cover.media_type === 'video' ? `<video src="${escapeAttr(cover.media_url)}" muted></video>` : `<img src="${escapeAttr(cover.thumbnail_url || cover.media_url)}" alt="">`) : '<span>—</span>';
    return `<tr><td><div class="table-thumb">${preview}</div></td><td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.tag || '')}</small></td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.price || 'Enquire')}</td><td>${p.media?.length || 0}</td><td><span class="badge">${p.is_available ? 'Visible' : 'Hidden'}</span></td><td class="row-actions"><button data-edit="${p.id}">Edit</button><button data-delete="${p.id}" class="danger">Delete</button></td></tr>`;
  }).join('') : `<tr><td colspan="7" class="empty-state">No products yet — add your first one.</td></tr>`;
  productsBody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openProductModal(rows.find((r) => r.id == b.dataset.edit))));
  productsBody.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Delete this product and all its media?')) return; await apiFetch(`/api/products/${b.dataset.delete}`, { method: 'DELETE' }); loadProducts(); }));
}

function openProductModal(product) {
  currentProduct = product || null; productForm.reset();
  document.getElementById('productModalTitle').textContent = product ? 'Edit product' : 'Add product';
  document.getElementById('p_id').value = product?.id || '';
  document.getElementById('p_name').value = product?.name || '';
  document.getElementById('p_category').value = product?.category || 'ready-to-wear';
  document.getElementById('p_tag').value = product?.tag || '';
  document.getElementById('p_price').value = product?.price || '';
  document.getElementById('p_currency').value = product?.currency || 'GBP';
  document.getElementById('p_sort_order').value = product?.sort_order || 0;
  document.getElementById('p_style').value = product?.style || '';
  document.getElementById('p_gender').value = product?.gender || '';
  document.getElementById('p_fabric').value = product?.fabric || '';
  document.getElementById('p_colour').value = product?.colour || '';
  document.getElementById('p_sizes').value = product?.sizes || '';
  document.getElementById('p_production_time').value = product?.production_time || '';
  document.getElementById('p_description').value = product?.description || '';
  document.getElementById('p_available').checked = product ? !!product.is_available : true;
  document.getElementById('p_featured').checked = product ? !!product.is_featured : false;
  document.getElementById('p_made_to_order').checked = product ? !!product.made_to_order : true;
  document.getElementById('mediaSection').classList.toggle('hidden', !product);
  renderMedia(product?.media || []); productModal.classList.remove('hidden');
}

function renderMedia(media) {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = media.length ? media.map((m) => `<article class="media-card">${m.media_type === 'video' ? `<video src="${escapeAttr(m.media_url)}" controls preload="metadata"></video>` : `<img src="${escapeAttr(m.thumbnail_url || m.media_url)}" alt="${escapeAttr(m.alt_text || '')}">`}<div class="media-card-actions"><button type="button" data-cover="${m.id}" ${m.is_cover ? 'disabled' : ''}>${m.is_cover ? 'Cover' : 'Make cover'}</button><button type="button" data-media-delete="${m.id}" class="danger">Delete</button></div></article>`).join('') : '<p class="helper">No media uploaded yet.</p>';
  grid.querySelectorAll('[data-cover]').forEach((b) => b.addEventListener('click', async () => { await apiFetch(`/api/media/${b.dataset.cover}`, { method: 'PATCH', body: JSON.stringify({ is_cover: 1 }) }); await refreshCurrentProduct(); }));
  grid.querySelectorAll('[data-media-delete]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Delete this media file?')) return; await apiFetch(`/api/media/${b.dataset.mediaDelete}`, { method: 'DELETE' }); await refreshCurrentProduct(); }));
}

async function refreshCurrentProduct() {
  if (!currentProduct?.id) return;
  currentProduct = await apiFetch(`/api/products/${currentProduct.id}`); renderMedia(currentProduct.media || []); loadProducts();
}

async function uploadSelectedMedia(productId) {
  const input = document.getElementById('p_media_files');
  if (!input.files.length) return;
  const status = document.getElementById('uploadStatus'); status.textContent = `Uploading ${input.files.length} file(s)…`;
  const formData = new FormData(); [...input.files].forEach((file) => formData.append('media', file));
  try { await apiFetch(`/api/media/products/${productId}`, { method: 'POST', body: formData }); input.value = ''; status.textContent = 'Upload complete.'; }
  catch (err) { status.textContent = err.message; throw err; }
}

document.getElementById('newProductBtn').addEventListener('click', () => openProductModal(null));
['cancelProductBtn','closeProductBtn'].forEach((id) => document.getElementById(id).addEventListener('click', () => productModal.classList.add('hidden')));
productModal.addEventListener('click', (e) => { if (e.target === productModal) productModal.classList.add('hidden'); });

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('p_id').value;
  const payload = { name: val('p_name'), category: val('p_category'), tag: val('p_tag'), price: val('p_price'), currency: val('p_currency'), sort_order: Number(val('p_sort_order')) || 0, description: val('p_description'), style: val('p_style'), gender: val('p_gender'), fabric: val('p_fabric'), colour: val('p_colour'), sizes: val('p_sizes'), production_time: val('p_production_time'), made_to_order: checked('p_made_to_order') ? 1 : 0, is_available: checked('p_available') ? 1 : 0, is_featured: checked('p_featured') ? 1 : 0 };
  const saved = id ? await apiFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) });
  await uploadSelectedMedia(saved.id);
  currentProduct = await apiFetch(`/api/products/${saved.id}`);
  document.getElementById('mediaSection').classList.remove('hidden'); renderMedia(currentProduct.media || []); loadProducts();
  if (!id) document.getElementById('productModalTitle').textContent = 'Edit product';
});

const preordersBody = document.getElementById('preordersBody');
const PREORDER_STATUSES = ['new','confirmed','deposit_pending','deposit_paid','measurements_received','in_production','fitting','ready','dispatched','delivered','cancelled'];
const PAYMENT_STATUSES = ['unpaid','pending','paid','failed','refunded'];
async function saveOrderRow(row) {
  const id = row.dataset.orderId;
  const payload = {
    status: row.querySelector('[data-order-status]').value,
    quoted_amount: row.querySelector('[data-order-amount]').value || 0,
    currency: row.querySelector('[data-order-currency]').value,
    payment_status: row.querySelector('[data-payment-status]').value,
  };
  await apiFetch(`/api/preorders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
async function loadPreorders() {
  const rows = await apiFetch('/api/preorders'); if (!rows) return;
  preordersBody.innerHTML = rows.length ? rows.map((o) => `<tr data-order-id="${o.id}">
    <td>${formatDate(o.created_at)}<br><strong>${escapeHtml(o.order_reference || 'Legacy order')}</strong></td>
    <td><strong>${escapeHtml(o.customer_name)}</strong><br><small>${escapeHtml(o.phone)}</small><br><small>${escapeHtml(o.email || 'No email')}</small></td>
    <td>${escapeHtml(o.style_inspiration || '—')}<br><small>${escapeHtml(o.fabric || '')}</small>${o.files?.length?`<div class="order-files">${o.files.map(f=>`<a href="${escapeAttr(f.media_url)}" target="_blank">${escapeHtml(f.original_name||'Attachment')}</a>`).join('')}</div>`:''}</td>
    <td><select class="status-select" data-order-status>${PREORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></td>
    <td><div class="money-edit"><select data-order-currency><option value="GBP" ${o.currency==='GBP'?'selected':''}>GBP</option><option value="NGN" ${o.currency==='NGN'?'selected':''}>NGN</option></select><input data-order-amount type="number" min="0" step="0.01" value="${o.quoted_amount ? (o.quoted_amount/100).toFixed(2) : ''}" placeholder="0.00"><button type="button" data-save-order>Save</button></div></td>
    <td><select data-payment-status>${PAYMENT_STATUSES.map((s)=>`<option value="${s}" ${s===o.payment_status?'selected':''}>${s}</option>`).join('')}</select>${o.paid_at?`<br><small>Paid ${formatDate(o.paid_at)}</small>`:''}</td>
    <td><button data-delete-preorder="${o.id}" class="danger">Delete</button></td>
  </tr>`).join('') : `<tr><td colspan="7" class="empty-state">No orders yet.</td></tr>`;
  preordersBody.querySelectorAll('[data-save-order]').forEach((b) => b.addEventListener('click', async () => { b.disabled=true; try{await saveOrderRow(b.closest('tr')); b.textContent='Saved'; setTimeout(()=>b.textContent='Save',1000);} finally{b.disabled=false;} }));
  preordersBody.querySelectorAll('[data-order-status],[data-payment-status]').forEach((el) => el.addEventListener('change', () => saveOrderRow(el.closest('tr'))));
  preordersBody.querySelectorAll('[data-delete-preorder]').forEach((b) => b.addEventListener('click', async()=>{if(confirm('Delete this order?')){await apiFetch(`/api/preorders/${b.dataset.deletePreorder}`,{method:'DELETE'});loadPreorders();}}));
}

const messagesBody = document.getElementById('messagesBody');
const MESSAGE_STATUSES = ['unread','read','replied'];
async function loadMessages() { const rows = await apiFetch('/api/messages'); if (!rows) return; messagesBody.innerHTML = rows.length ? rows.map((m) => `<tr><td>${formatDate(m.created_at)}</td><td>${escapeHtml(m.type)}</td><td>${escapeHtml(m.customer_name)}</td><td>${escapeHtml(m.phone)}</td><td style="max-width:280px">${escapeHtml(m.message)}</td><td><select data-msg-status-id="${m.id}">${MESSAGE_STATUSES.map((s)=>`<option value="${s}" ${s===m.status?'selected':''}>${s}</option>`).join('')}</select></td><td><button data-delete-msg="${m.id}" class="danger">Delete</button></td></tr>`).join('') : `<tr><td colspan="7" class="empty-state">No messages yet.</td></tr>`; messagesBody.querySelectorAll('[data-msg-status-id]').forEach((s)=>s.addEventListener('change',()=>apiFetch(`/api/messages/${s.dataset.msgStatusId}`,{method:'PATCH',body:JSON.stringify({status:s.value})}))); messagesBody.querySelectorAll('[data-delete-msg]').forEach((b)=>b.addEventListener('click',async()=>{if(confirm('Delete this message?')){await apiFetch(`/api/messages/${b.dataset.deleteMsg}`,{method:'DELETE'});loadMessages();}})); }

const val = (id) => document.getElementById(id).value.trim(); const checked = (id) => document.getElementById(id).checked;
function escapeHtml(v){return String(v ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(v){return escapeHtml(v);}
function formatDate(iso){try{return new Date(iso+'Z').toLocaleString();}catch{return iso;}}
loadProducts(); loadPreorders(); loadMessages();


const appointmentsBody=document.getElementById('appointmentsBody');
const APPOINTMENT_STATUSES=['requested','confirmed','rescheduled','completed','cancelled'];
async function loadAppointments(){const rows=await apiFetch('/api/appointments');if(!rows)return;appointmentsBody.innerHTML=rows.length?rows.map(a=>`<tr><td><strong>${escapeHtml(a.appointment_reference)}</strong><br><small>${formatDate(a.created_at)}</small></td><td>${escapeHtml(a.customer_name)}<br><small>${escapeHtml(a.phone)}</small><br><small>${escapeHtml(a.email||'')}</small></td><td>${escapeHtml(a.appointment_type.replaceAll('_',' '))}<br><small>${escapeHtml(a.location||'')}</small></td><td><input data-appt-date value="${escapeAttr(a.preferred_date||'')}" type="date"><input data-appt-time value="${escapeAttr(a.preferred_time||'')}" type="time"></td><td><select data-appt-status>${APPOINTMENT_STATUSES.map(x=>`<option value="${x}" ${x===a.status?'selected':''}>${x}</option>`).join('')}</select></td><td><button data-save-appt="${a.id}">Save</button><button data-delete-appt="${a.id}" class="danger">Delete</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">No appointments yet.</td></tr>';appointmentsBody.querySelectorAll('[data-save-appt]').forEach(b=>b.onclick=async()=>{const tr=b.closest('tr');await apiFetch(`/api/appointments/${b.dataset.saveAppt}`,{method:'PATCH',body:JSON.stringify({status:tr.querySelector('[data-appt-status]').value,preferred_date:tr.querySelector('[data-appt-date]').value,preferred_time:tr.querySelector('[data-appt-time]').value})});b.textContent='Saved'});appointmentsBody.querySelectorAll('[data-delete-appt]').forEach(b=>b.onclick=async()=>{if(confirm('Delete appointment?')){await apiFetch(`/api/appointments/${b.dataset.deleteAppt}`,{method:'DELETE'});loadAppointments()}})}

const testimonialsBody=document.getElementById('testimonialsBody');
async function loadTestimonials(){const rows=await apiFetch('/api/testimonials/admin/all');if(!rows)return;testimonialsBody.innerHTML=rows.length?rows.map(t=>`<tr><td><strong>${escapeHtml(t.customer_name)}</strong><br><small>${escapeHtml(t.location||'')}</small></td><td style="max-width:380px">${escapeHtml(t.quote)}</td><td>${'★'.repeat(t.rating)}</td><td>${t.is_published?'Yes':'No'}</td><td><button data-toggle-testimonial="${t.id}" data-published="${t.is_published}">${t.is_published?'Unpublish':'Publish'}</button><button data-delete-testimonial="${t.id}" class="danger">Delete</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty-state">No testimonials yet.</td></tr>';testimonialsBody.querySelectorAll('[data-toggle-testimonial]').forEach(b=>b.onclick=async()=>{const row=rows.find(x=>x.id==b.dataset.toggleTestimonial);await apiFetch(`/api/testimonials/${row.id}`,{method:'PUT',body:JSON.stringify({...row,is_published:row.is_published?0:1})});loadTestimonials()});testimonialsBody.querySelectorAll('[data-delete-testimonial]').forEach(b=>b.onclick=async()=>{if(confirm('Delete review?')){await apiFetch(`/api/testimonials/${b.dataset.deleteTestimonial}`,{method:'DELETE'});loadTestimonials()}})}
const testimonialWrap=document.getElementById('testimonialFormWrap');document.getElementById('addTestimonialBtn').onclick=()=>testimonialWrap.classList.toggle('hidden');document.getElementById('saveTestimonialBtn').onclick=async()=>{await apiFetch('/api/testimonials',{method:'POST',body:JSON.stringify({customer_name:val('t_name'),location:val('t_location'),quote:val('t_quote'),rating:Number(val('t_rating'))||5,is_published:checked('t_published')?1:0})});testimonialWrap.classList.add('hidden');loadTestimonials()};

loadAppointments();loadTestimonials();
