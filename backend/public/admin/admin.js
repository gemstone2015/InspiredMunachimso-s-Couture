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

function openAdminTab(tabName) {
  const button = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (button) button.click();
}
document.querySelectorAll('[data-open-tab]').forEach((button) => button.addEventListener('click', () => openAdminTab(button.dataset.openTab)));

const STATUS_LABELS = {
  new: 'New enquiries', confirmed: 'Confirmed', deposit_pending: 'Deposit pending', deposit_paid: 'Deposit paid',
  measurements_received: 'Measurements received', in_production: 'In production', fitting: 'Fitting stage', ready: 'Ready',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled'
};
const CATEGORY_LABELS = {
  'ready-to-wear': 'Ready-to-wear', 'igbo-attire': 'Igbo attire', womenswear: 'Women’s wear', menswear: 'Men’s wear',
  bridal: 'Bridal', children: 'Children', cap: 'Traditional caps', accessory: 'Accessories', alteration: 'Alterations'
};
function formatMoneyMinor(amount, currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format((Number(amount) || 0) / 100);
}
function metricCard(label, value, note, tone = '') {
  return `<article class="metric-card ${tone}"><p>${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><span>${escapeHtml(note || '')}</span></article>`;
}
function renderProgressList(targetId, rows, labelKey, maxValue) {
  const target = document.getElementById(targetId);
  if (!rows?.length) { target.innerHTML = '<p class="empty-state">No data yet.</p>'; return; }
  const max = maxValue || Math.max(...rows.map((row) => Number(row.count) || 0), 1);
  target.innerHTML = rows.map((row) => {
    const raw = row[labelKey];
    const label = labelKey === 'status' ? (STATUS_LABELS[raw] || raw) : (CATEGORY_LABELS[raw] || raw);
    const width = Math.max(5, Math.round(((Number(row.count) || 0) / max) * 100));
    return `<div class="progress-row"><div><span>${escapeHtml(label)}</span><strong>${Number(row.count) || 0}</strong></div><i><b style="width:${width}%"></b></i></div>`;
  }).join('');
}
async function loadDashboard() {
  const data = await apiFetch('/api/admin/dashboard/overview');
  if (!data) return;
  const m = data.metrics;
  document.getElementById('dashboardMetrics').innerHTML = [
    metricCard('Open orders', m.openOrders, `${m.inProduction} currently in production`, 'gold'),
    metricCard('Pending deposits', m.pendingDeposits, 'Orders awaiting payment'),
    metricCard('Unread messages', m.unreadMessages, 'Customer enquiries needing attention'),
    metricCard('Upcoming appointments', m.upcomingAppointments, `${m.appointmentsToday} scheduled today`),
    metricCard('Visible products', m.visibleProducts, `${m.publishedTestimonials} published testimonials`),
    metricCard('Orders today', m.ordersToday, 'New requests received today')
  ].join('');

  const monthlyMax = Math.max(...data.monthly.flatMap((row) => [Number(row.orders)||0, Number(row.appointments)||0, Number(row.enquiries)||0]), 1);
  document.getElementById('activityChart').innerHTML = data.monthly.map((row) => `<div class="chart-month"><div class="chart-bars"><i class="bar orders" style="height:${Math.max(5,(row.orders/monthlyMax)*100)}%" title="${row.orders} orders"></i><i class="bar appointments" style="height:${Math.max(5,(row.appointments/monthlyMax)*100)}%" title="${row.appointments} appointments"></i><i class="bar enquiries" style="height:${Math.max(5,(row.enquiries/monthlyMax)*100)}%" title="${row.enquiries} enquiries"></i></div><span>${escapeHtml(row.label)}</span></div>`).join('') + '<div class="chart-legend"><span><i class="orders"></i>Orders</span><span><i class="appointments"></i>Appointments</span><span><i class="enquiries"></i>Enquiries</span></div>';

  document.getElementById('paymentSummary').innerHTML = data.currencyTotals.length ? data.currencyTotals.map((row) => `<div class="payment-total"><span>${escapeHtml(row.currency)}</span><div><small>Paid</small><strong>${formatMoneyMinor(row.paid,row.currency)}</strong></div><div><small>Outstanding</small><strong>${formatMoneyMinor(row.outstanding,row.currency)}</strong></div></div>`).join('') : '<p class="empty-state">No payment amounts have been recorded yet.</p>';
  renderProgressList('orderStageSummary', data.orderStages, 'status');
  renderProgressList('categorySummary', data.categories, 'category');

  document.getElementById('upcomingAppointments').innerHTML = data.nextAppointments.length ? data.nextAppointments.map((a) => `<div class="compact-item"><div><strong>${escapeHtml(a.customer_name)}</strong><span>${escapeHtml((a.appointment_type||'').replaceAll('_',' '))} · ${escapeHtml(a.location||'')}</span></div><time>${escapeHtml(a.preferred_date||'TBC')} ${escapeHtml(a.preferred_time||'')}</time></div>`).join('') : '<p class="empty-state">No upcoming appointments.</p>';
  document.getElementById('recentOrders').innerHTML = data.recentOrders.length ? data.recentOrders.map((o) => `<div class="compact-item"><div><strong>${escapeHtml(o.customer_name)}</strong><span>${escapeHtml(o.order_reference)} · ${escapeHtml(STATUS_LABELS[o.status]||o.status)}</span></div><div class="compact-status"><b>${escapeHtml(o.payment_status)}</b><time>${formatDate(o.created_at)}</time></div></div>`).join('') : '<p class="empty-state">No orders yet.</p>';
  document.getElementById('recentMessages').innerHTML = data.recentMessages.length ? data.recentMessages.map((msg) => `<div class="compact-item"><div><strong>${escapeHtml(msg.customer_name)}</strong><span>${escapeHtml(msg.type)} enquiry</span></div><div class="compact-status"><b class="${msg.status==='unread'?'attention':''}">${escapeHtml(msg.status)}</b><time>${formatDate(msg.created_at)}</time></div></div>`).join('') : '<p class="empty-state">No messages yet.</p>';
  document.getElementById('dashboardUpdated').textContent = `Updated ${new Date(data.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
}
document.getElementById('refreshDashboardBtn').addEventListener('click', loadDashboard);

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
loadDashboard(); loadProducts(); loadPreorders(); loadMessages(); loadCustomers();


const appointmentsBody=document.getElementById('appointmentsBody');
const APPOINTMENT_STATUSES=['requested','confirmed','rescheduled','completed','cancelled'];
async function loadAppointments(){const rows=await apiFetch('/api/appointments');if(!rows)return;appointmentsBody.innerHTML=rows.length?rows.map(a=>`<tr><td><strong>${escapeHtml(a.appointment_reference)}</strong><br><small>${formatDate(a.created_at)}</small></td><td>${escapeHtml(a.customer_name)}<br><small>${escapeHtml(a.phone)}</small><br><small>${escapeHtml(a.email||'')}</small></td><td>${escapeHtml(a.appointment_type.replaceAll('_',' '))}<br><small>${escapeHtml(a.location||'')}</small></td><td><input data-appt-date value="${escapeAttr(a.preferred_date||'')}" type="date"><input data-appt-time value="${escapeAttr(a.preferred_time||'')}" type="time"></td><td><select data-appt-status>${APPOINTMENT_STATUSES.map(x=>`<option value="${x}" ${x===a.status?'selected':''}>${x}</option>`).join('')}</select></td><td><button data-save-appt="${a.id}">Save</button><button data-delete-appt="${a.id}" class="danger">Delete</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">No appointments yet.</td></tr>';appointmentsBody.querySelectorAll('[data-save-appt]').forEach(b=>b.onclick=async()=>{const tr=b.closest('tr');await apiFetch(`/api/appointments/${b.dataset.saveAppt}`,{method:'PATCH',body:JSON.stringify({status:tr.querySelector('[data-appt-status]').value,preferred_date:tr.querySelector('[data-appt-date]').value,preferred_time:tr.querySelector('[data-appt-time]').value})});b.textContent='Saved'});appointmentsBody.querySelectorAll('[data-delete-appt]').forEach(b=>b.onclick=async()=>{if(confirm('Delete appointment?')){await apiFetch(`/api/appointments/${b.dataset.deleteAppt}`,{method:'DELETE'});loadAppointments()}})}

const testimonialsBody=document.getElementById('testimonialsBody');
async function loadTestimonials(){const rows=await apiFetch('/api/testimonials/admin/all');if(!rows)return;testimonialsBody.innerHTML=rows.length?rows.map(t=>`<tr><td><strong>${escapeHtml(t.customer_name)}</strong><br><small>${escapeHtml(t.location||'')}</small></td><td style="max-width:380px">${escapeHtml(t.quote)}</td><td>${'★'.repeat(t.rating)}</td><td>${t.is_published?'Yes':'No'}</td><td><button data-toggle-testimonial="${t.id}" data-published="${t.is_published}">${t.is_published?'Unpublish':'Publish'}</button><button data-delete-testimonial="${t.id}" class="danger">Delete</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty-state">No testimonials yet.</td></tr>';testimonialsBody.querySelectorAll('[data-toggle-testimonial]').forEach(b=>b.onclick=async()=>{const row=rows.find(x=>x.id==b.dataset.toggleTestimonial);await apiFetch(`/api/testimonials/${row.id}`,{method:'PUT',body:JSON.stringify({...row,is_published:row.is_published?0:1})});loadTestimonials()});testimonialsBody.querySelectorAll('[data-delete-testimonial]').forEach(b=>b.onclick=async()=>{if(confirm('Delete review?')){await apiFetch(`/api/testimonials/${b.dataset.deleteTestimonial}`,{method:'DELETE'});loadTestimonials()}})}
const testimonialWrap=document.getElementById('testimonialFormWrap');document.getElementById('addTestimonialBtn').onclick=()=>testimonialWrap.classList.toggle('hidden');document.getElementById('saveTestimonialBtn').onclick=async()=>{await apiFetch('/api/testimonials',{method:'POST',body:JSON.stringify({customer_name:val('t_name'),location:val('t_location'),quote:val('t_quote'),rating:Number(val('t_rating'))||5,is_published:checked('t_published')?1:0})});testimonialWrap.classList.add('hidden');loadTestimonials()};

loadAppointments();loadTestimonials();

// Website settings / Hero Manager
let currentHeroSettings = null;
const HERO_FIELD_IDS = [
  'hero_enabled','hero_type','hero_kicker','hero_title','hero_highlight','hero_copy',
  'hero_primary_text','hero_primary_link','hero_secondary_text'
];

function renderHeroPreview(settings) {
  const preview = document.getElementById('heroPreview');
  if (!preview) return;
  const enabled = settings.hero_enabled === '1';
  if (!enabled) {
    preview.innerHTML = '<span>Hero media disabled — luxury background will be shown.</span>';
    return;
  }
  if (settings.hero_type === 'video' && settings.hero_video_url) {
    preview.innerHTML = `<video src="${escapeAttr(settings.hero_video_url)}" controls muted loop playsinline preload="metadata"></video>`;
    return;
  }
  if (settings.hero_type === 'image' && settings.hero_image_url) {
    preview.innerHTML = `<img src="${escapeAttr(settings.hero_image_url)}" alt="Current hero media">`;
    return;
  }
  preview.innerHTML = '<span>No hero media uploaded yet.</span>';
}

async function loadHeroSettings() {
  const settings = await apiFetch('/api/site-settings/admin');
  if (!settings) return;
  currentHeroSettings = settings;
  HERO_FIELD_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = settings[id] ?? '';
  });
  renderHeroPreview(settings);
}

const heroSettingsForm = document.getElementById('heroSettingsForm');
if (heroSettingsForm) {
  heroSettingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('heroSaveStatus');
    status.textContent = 'Saving…';
    try {
      const payload = Object.fromEntries(HERO_FIELD_IDS.map((id) => [id, document.getElementById(id).value]));
      currentHeroSettings = await apiFetch('/api/site-settings/admin', { method: 'PUT', body: JSON.stringify(payload) });
      renderHeroPreview(currentHeroSettings);
      status.textContent = 'Saved. Refresh the public website to see the update.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

const uploadHeroBtn = document.getElementById('uploadHeroBtn');
if (uploadHeroBtn) {
  uploadHeroBtn.addEventListener('click', async () => {
    const input = document.getElementById('hero_media_file');
    const status = document.getElementById('heroUploadStatus');
    if (!input.files?.length) {
      status.textContent = 'Choose an image or video first.';
      return;
    }
    const file = input.files[0];
    const form = new FormData();
    form.append('hero_media', file);
    uploadHeroBtn.disabled = true;
    status.textContent = `Uploading ${file.name}…`;
    try {
      currentHeroSettings = await apiFetch('/api/site-settings/admin/media', { method: 'POST', body: form });
      input.value = '';
      HERO_FIELD_IDS.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.value = currentHeroSettings[id] ?? '';
      });
      renderHeroPreview(currentHeroSettings);
      status.textContent = 'Uploaded and published successfully.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      uploadHeroBtn.disabled = false;
    }
  });
}

loadHeroSettings();


const customersBody = document.getElementById('customersBody');
async function loadCustomers(){
  if(!customersBody) return;
  const rows=await apiFetch('/api/customers/admin/all'); if(!rows)return;
  customersBody.innerHTML=rows.length?rows.map(c=>`<tr><td>${formatDate(c.created_at)}</td><td><strong>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}</strong><br><small>${escapeHtml(c.country||'')}</small></td><td>${escapeHtml(c.email)}<br><small>${escapeHtml(c.phone)}</small></td><td>${c.orders}</td><td>${c.appointments}</td><td>${c.last_login_at?formatDate(c.last_login_at):'Never'}</td><td><button data-customer-status="${c.id}" data-active="${c.is_active}">${c.is_active?'Active':'Disabled'}</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-state">No registered customers yet.</td></tr>';
  customersBody.querySelectorAll('[data-customer-status]').forEach(b=>b.onclick=async()=>{await apiFetch(`/api/customers/admin/${b.dataset.customerStatus}/status`,{method:'PATCH',body:JSON.stringify({is_active:b.dataset.active==='1'?0:1})});loadCustomers();});
}

// Craft section manager (the second homepage video, separate from the hero).
const CRAFT_FIELD_IDS = [
  'craft_enabled','craft_kicker','craft_title','craft_copy',
  'craft_step_1_number','craft_step_1_text','craft_step_2_number','craft_step_2_text',
  'craft_step_3_number','craft_step_3_text'
];
let currentCraftSettings = null;

function renderCraftPreview(settings) {
  const preview = document.getElementById('craftPreview');
  if (!preview) return;
  if (settings.craft_enabled !== '1') {
    preview.innerHTML = '<span>Craft video hidden. The text and layout will remain visible.</span>';
    return;
  }
  if (settings.craft_video_url) {
    preview.innerHTML = `<video src="${escapeAttr(settings.craft_video_url)}" controls muted loop playsinline preload="metadata"></video>`;
    return;
  }
  preview.innerHTML = '<span>No craft video uploaded yet.</span>';
}

async function loadCraftSettings() {
  const settings = currentHeroSettings || await apiFetch('/api/site-settings/admin');
  if (!settings) return;
  currentCraftSettings = settings;
  CRAFT_FIELD_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = settings[id] ?? '';
  });
  renderCraftPreview(settings);
}

const craftSettingsForm = document.getElementById('craftSettingsForm');
if (craftSettingsForm) {
  craftSettingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('craftSaveStatus');
    status.textContent = 'Saving…';
    try {
      const payload = Object.fromEntries(CRAFT_FIELD_IDS.map((id) => [id, document.getElementById(id).value]));
      currentCraftSettings = await apiFetch('/api/site-settings/admin', { method: 'PUT', body: JSON.stringify(payload) });
      renderCraftPreview(currentCraftSettings);
      status.textContent = 'Saved. Refresh the public website to see the update.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

const uploadCraftBtn = document.getElementById('uploadCraftBtn');
if (uploadCraftBtn) {
  uploadCraftBtn.addEventListener('click', async () => {
    const input = document.getElementById('craft_media_file');
    const status = document.getElementById('craftUploadStatus');
    if (!input.files?.length) {
      status.textContent = 'Choose a video first.';
      return;
    }
    const file = input.files[0];
    const form = new FormData();
    form.append('craft_media', file);
    uploadCraftBtn.disabled = true;
    status.textContent = `Uploading ${file.name}…`;
    try {
      currentCraftSettings = await apiFetch('/api/site-settings/admin/craft-media', { method: 'POST', body: form });
      input.value = '';
      const enabled = document.getElementById('craft_enabled');
      if (enabled) enabled.value = currentCraftSettings.craft_enabled ?? '1';
      renderCraftPreview(currentCraftSettings);
      status.textContent = 'Craft video uploaded and published successfully.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      uploadCraftBtn.disabled = false;
    }
  });
}

const removeCraftBtn = document.getElementById('removeCraftBtn');
if (removeCraftBtn) {
  removeCraftBtn.addEventListener('click', async () => {
    const status = document.getElementById('craftUploadStatus');
    if (!window.confirm('Remove the current craft video? The text section will remain on the homepage.')) return;
    removeCraftBtn.disabled = true;
    status.textContent = 'Removing video…';
    try {
      currentCraftSettings = await apiFetch('/api/site-settings/admin/craft-media', { method: 'DELETE' });
      const enabled = document.getElementById('craft_enabled');
      if (enabled) enabled.value = '0';
      renderCraftPreview(currentCraftSettings);
      status.textContent = 'Craft video removed. You can upload another one later.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      removeCraftBtn.disabled = false;
    }
  });
}

loadCraftSettings();


// About and services homepage content manager.
const CONTENT_FIELD_IDS = [
  'about_kicker','about_title','about_copy','about_link_text','about_link_url',
  'services_kicker','services_title',
  'service_1_number','service_1_title','service_1_copy',
  'service_2_number','service_2_title','service_2_copy',
  'service_3_number','service_3_title','service_3_copy',
  'service_4_number','service_4_title','service_4_copy'
];
async function loadContentSettings(){
  const settings = await apiFetch('/api/site-settings/admin');
  if(!settings) return;
  CONTENT_FIELD_IDS.forEach((id)=>{ const el=document.getElementById(id); if(el) el.value=settings[id]??''; });
}
const contentSettingsForm=document.getElementById('contentSettingsForm');
if(contentSettingsForm){
  contentSettingsForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=document.getElementById('contentSaveStatus');
    status.textContent='Saving…';
    try{
      const payload=Object.fromEntries(CONTENT_FIELD_IDS.map((id)=>[id,document.getElementById(id).value]));
      await apiFetch('/api/site-settings/admin',{method:'PUT',body:JSON.stringify(payload)});
      status.textContent='Saved. Refresh the public website to see the update.';
    }catch(error){status.textContent=error.message;}
  });
}
loadContentSettings();


// Business details and social links manager.
const BUSINESS_FIELD_IDS = [
  'announcement_enabled','announcement_text','business_name','business_tagline','business_email',
  'uk_phone_display','uk_phone_tel','uk_whatsapp','ng_phone_display','ng_phone_tel','ng_whatsapp',
  'uk_location','ng_location','opening_hours','instagram_url','facebook_url','tiktok_url','youtube_url','footer_text'
];
async function loadBusinessSettings(){
  const settings=await apiFetch('/api/site-settings/admin');
  if(!settings) return;
  BUSINESS_FIELD_IDS.forEach((id)=>{const el=document.getElementById(id);if(el)el.value=settings[id]??'';});
}
const businessSettingsForm=document.getElementById('businessSettingsForm');
if(businessSettingsForm){
  businessSettingsForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=document.getElementById('businessSaveStatus');
    status.textContent='Saving…';
    try{
      const payload=Object.fromEntries(BUSINESS_FIELD_IDS.map((id)=>[id,document.getElementById(id).value]));
      await apiFetch('/api/site-settings/admin',{method:'PUT',body:JSON.stringify(payload)});
      status.textContent='Saved. Refresh the public website to see the update.';
    }catch(error){status.textContent=error.message;}
  });
}
loadBusinessSettings();


// Production readiness v3.0: Media Library.
let mediaLibraryRows=[];
function mediaPreviewMarkup(item){
  if(item.media_type==='image') return `<img src="${escapeAttr(item.thumbnail_url||item.media_url)}" alt="${escapeAttr(item.display_name||'Media')}">`;
  if(item.media_type==='video') return `<video src="${escapeAttr(item.media_url)}" muted preload="metadata"></video><span class="media-type-badge">Video</span>`;
  return `<div class="document-preview">PDF</div>`;
}
function formatBytes(bytes){const n=Number(bytes)||0;if(!n)return 'Size unavailable';if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;}
async function loadMediaLibrary(){
  const search=document.getElementById('mediaSearch')?.value||'';const type=document.getElementById('mediaTypeFilter')?.value||'';const category=document.getElementById('mediaCategoryFilter')?.value||'';
  const data=await apiFetch(`/api/media-library?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&category=${encodeURIComponent(category)}`);if(!data)return;
  mediaLibraryRows=data.items;
  const summary=document.getElementById('mediaSummary');if(summary)summary.innerHTML=[metricCard('All media',data.summary.total,'Active library items','gold'),metricCard('Images',data.summary.images,'Photographs and graphics'),metricCard('Videos',data.summary.videos,'Hero, craft and product clips'),metricCard('Documents',data.summary.documents,'PDFs and measurement files')].join('');
  const grid=document.getElementById('mediaLibraryGrid');if(!grid)return;
  grid.innerHTML=data.items.length?data.items.map(item=>`<article class="library-card"><div class="library-preview">${mediaPreviewMarkup(item)}</div><div class="library-body"><div class="library-title-row"><strong>${escapeHtml(item.display_name||item.original_name||'Untitled media')}</strong><span>${escapeHtml(item.media_type)}</span></div><p>${escapeHtml(item.category||'general')} · ${formatBytes(item.file_size)}</p>${item.usage?.length?`<div class="usage-note">Used in: ${item.usage.map(u=>escapeHtml(u.label)).join(', ')}</div>`:'<div class="usage-note unused">Not currently assigned</div>'}<div class="library-actions"><button data-preview-media="${escapeAttr(item.media_url)}">Preview</button><button data-rename-media="${item.source_type}:${item.source_id}">Rename</button><button class="danger" data-trash-media="${item.source_type}:${item.source_id}">Remove</button></div></div></article>`).join(''):'<p class="empty-state">No media matches these filters.</p>';
  grid.querySelectorAll('[data-preview-media]').forEach(b=>b.onclick=()=>window.open(b.dataset.previewMedia,'_blank'));
  grid.querySelectorAll('[data-rename-media]').forEach(b=>b.onclick=async()=>{const [sourceType,sourceId]=b.dataset.renameMedia.split(':');const item=mediaLibraryRows.find(r=>r.source_type===sourceType&&String(r.source_id)===sourceId);const name=prompt('Media name',item?.display_name||'');if(name===null)return;try{await apiFetch(`/api/media-library/${sourceType}/${sourceId}`,{method:'PATCH',body:JSON.stringify({display_name:name,category:item?.category||'general',tags:item?.tags||''})});loadMediaLibrary();}catch(e){alert(e.message);}});
  grid.querySelectorAll('[data-trash-media]').forEach(b=>b.onclick=async()=>{const [sourceType,sourceId]=b.dataset.trashMedia.split(':');const item=mediaLibraryRows.find(r=>r.source_type===sourceType&&String(r.source_id)===sourceId);const usage=item?.usage?.length?`\n\nCurrently used in: ${item.usage.map(u=>u.label).join(', ')}.`:'';if(!confirm(`Move this media to the Recycle Bin?${usage}\n\nIt can be restored later.`))return;await apiFetch(`/api/media-library/${sourceType}/${sourceId}`,{method:'DELETE'});loadMediaLibrary();});
}
async function loadMediaTrash(){const rows=await apiFetch('/api/media-library/trash');const panel=document.getElementById('mediaTrashGrid');if(!panel)return;panel.innerHTML=rows.length?rows.map(item=>`<article class="library-card deleted"><div class="library-preview">${mediaPreviewMarkup(item)}</div><div class="library-body"><strong>${escapeHtml(item.display_name||item.original_name||'Deleted media')}</strong><p>Deleted ${formatDate(item.deleted_at)}</p><div class="library-actions"><button data-restore-media="${item.id}">Restore</button><button class="danger" data-permanent-media="${item.id}">Delete forever</button></div></div></article>`).join(''):'<p class="empty-state">Recycle Bin is empty.</p>';panel.querySelectorAll('[data-restore-media]').forEach(b=>b.onclick=async()=>{await apiFetch(`/api/media-library/trash/${b.dataset.restoreMedia}/restore`,{method:'POST'});loadMediaTrash();});panel.querySelectorAll('[data-permanent-media]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this file? This cannot be undone.'))return;await apiFetch(`/api/media-library/trash/${b.dataset.permanentMedia}/permanent`,{method:'DELETE'});loadMediaTrash();});}
const mediaUploadToggle=document.getElementById('mediaUploadToggle');if(mediaUploadToggle)mediaUploadToggle.onclick=()=>document.getElementById('mediaUploadPanel').classList.toggle('hidden');
const libraryUploadBtn=document.getElementById('libraryUploadBtn');if(libraryUploadBtn)libraryUploadBtn.onclick=async()=>{const input=document.getElementById('libraryUploadFiles');const status=document.getElementById('libraryUploadStatus');if(!input.files?.length){status.textContent='Choose one or more files.';return;}const form=new FormData();[...input.files].forEach(f=>form.append('media',f));form.append('category',document.getElementById('libraryUploadCategory').value);form.append('tags',document.getElementById('libraryUploadTags').value);libraryUploadBtn.disabled=true;status.textContent='Uploading…';try{await apiFetch('/api/media-library/upload',{method:'POST',body:form});input.value='';status.textContent='Upload complete.';loadMediaLibrary();}catch(e){status.textContent=e.message;}finally{libraryUploadBtn.disabled=false;}};
['mediaSearch','mediaTypeFilter','mediaCategoryFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==='mediaSearch'?'input':'change',()=>{clearTimeout(el._t);el._t=setTimeout(loadMediaLibrary,250);});});
const refreshMediaBtn=document.getElementById('refreshMediaBtn');if(refreshMediaBtn)refreshMediaBtn.onclick=loadMediaLibrary;
const showTrashBtn=document.getElementById('showTrashBtn');if(showTrashBtn)showTrashBtn.onclick=()=>{document.getElementById('mediaLibraryGrid').classList.add('hidden');document.getElementById('mediaTrashPanel').classList.remove('hidden');loadMediaTrash();};
const hideTrashBtn=document.getElementById('hideTrashBtn');if(hideTrashBtn)hideTrashBtn.onclick=()=>{document.getElementById('mediaTrashPanel').classList.add('hidden');document.getElementById('mediaLibraryGrid').classList.remove('hidden');loadMediaLibrary();};
loadMediaLibrary();


// Gallery Manager v3.1.
let galleryAlbums = [];
let galleryMedia = [];
function galleryMediaCard(item, selected=false){return `<label class="gallery-media-choice ${selected?'selected':''}"><input type="checkbox" value="${escapeAttr(item.source_type)}:${escapeAttr(item.source_id)}" ${selected?'checked':''}><div>${mediaPreviewMarkup(item)}</div><span>${escapeHtml(item.display_name||item.original_name||'Media')}</span></label>`;}
async function loadGalleryAlbums(){
  const target=document.getElementById('galleryAlbums'); if(!target)return;
  galleryAlbums=await apiFetch('/api/galleries/admin')||[];
  target.innerHTML=galleryAlbums.length?galleryAlbums.map(album=>`<article class="gallery-admin-card"><div class="gallery-admin-cover">${album.cover_url?`<img src="${escapeAttr(album.cover_url)}" alt="">`:'<span>No cover yet</span>'}</div><div class="gallery-admin-copy"><div><span class="badge">${album.is_published?'Published':'Hidden'}</span>${album.is_featured?'<span class="badge">Featured</span>':''}</div><h3>${escapeHtml(album.title)}</h3><p>${escapeHtml(album.description||'')}</p><small>${album.items.length} media item${album.items.length===1?'':'s'}</small><div class="row-actions"><button data-gallery-edit="${album.id}">Edit</button><button data-gallery-media="${album.id}">Add media</button><button data-gallery-delete="${album.id}" class="danger">Delete album</button></div></div><div class="gallery-item-strip">${album.items.map(item=>`<div class="gallery-item-chip">${item.media_type==='video'?`<video src="${escapeAttr(item.media_url)}" muted></video>`:`<img src="${escapeAttr(item.thumbnail_url||item.media_url)}" alt="">`}<button data-gallery-item-remove="${item.id}" data-album-id="${album.id}" title="Remove from album">×</button></div>`).join('')}</div></article>`).join(''):'<p class="empty-state">No gallery albums yet.</p>';
  target.querySelectorAll('[data-gallery-edit]').forEach(btn=>btn.onclick=()=>openGalleryForm(galleryAlbums.find(a=>String(a.id)===btn.dataset.galleryEdit)));
  target.querySelectorAll('[data-gallery-media]').forEach(btn=>btn.onclick=()=>openGalleryMediaPicker(Number(btn.dataset.galleryMedia)));
  target.querySelectorAll('[data-gallery-delete]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Delete this gallery album? Media files will remain in the Media Library.'))return;await apiFetch(`/api/galleries/admin/${btn.dataset.galleryDelete}`,{method:'DELETE'});loadGalleryAlbums();});
  target.querySelectorAll('[data-gallery-item-remove]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Remove this media from the gallery album? The original file will remain in the Media Library.'))return;await apiFetch(`/api/galleries/admin/${btn.dataset.albumId}/items/${btn.dataset.galleryItemRemove}`,{method:'DELETE'});loadGalleryAlbums();});
}
function openGalleryForm(album=null){document.getElementById('galleryFormWrap').hidden=false;document.getElementById('gallery_id').value=album?.id||'';document.getElementById('gallery_title').value=album?.title||'';document.getElementById('gallery_description').value=album?.description||'';document.getElementById('gallery_sort_order').value=album?.sort_order||0;document.getElementById('gallery_is_published').value=String(album?.is_published??1);document.getElementById('gallery_is_featured').value=String(album?.is_featured??0);document.getElementById('gallery_title').focus();}
function closeGalleryForm(){document.getElementById('galleryFormWrap').hidden=true;document.getElementById('galleryForm').reset();document.getElementById('gallery_id').value='';}
document.getElementById('newGalleryBtn')?.addEventListener('click',()=>openGalleryForm());document.getElementById('cancelGalleryBtn')?.addEventListener('click',closeGalleryForm);
document.getElementById('galleryForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const id=document.getElementById('gallery_id').value;const payload={title:document.getElementById('gallery_title').value,description:document.getElementById('gallery_description').value,sort_order:Number(document.getElementById('gallery_sort_order').value)||0,is_published:document.getElementById('gallery_is_published').value==='1',is_featured:document.getElementById('gallery_is_featured').value==='1'};const status=document.getElementById('galleryFormStatus');status.textContent='Saving…';try{await apiFetch(id?`/api/galleries/admin/${id}`:'/api/galleries/admin',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});status.textContent='Saved.';closeGalleryForm();loadGalleryAlbums();}catch(err){status.textContent=err.message;}});
async function openGalleryMediaPicker(albumId){
  if(!galleryMedia.length){const data=await apiFetch('/api/media-library');galleryMedia=(data?.items||[]).filter(x=>x.media_type==='image'||x.media_type==='video');}
  const album=galleryAlbums.find(a=>a.id===albumId);const existing=new Set((album?.items||[]).map(i=>`${i.source_type}:${i.source_id}`));
  const overlay=document.createElement('div');overlay.className='admin-modal-overlay';overlay.innerHTML=`<section class="admin-modal gallery-picker"><button class="modal-close" type="button">×</button><h2>Add media to ${escapeHtml(album?.title||'gallery')}</h2><p class="helper">Select reusable files from the Media Library. The original files are not duplicated.</p><div class="gallery-media-picker-grid">${galleryMedia.map(item=>galleryMediaCard(item,existing.has(`${item.source_type}:${item.source_id}`))).join('')}</div><div class="settings-actions"><button class="primary-btn add-selected-gallery-media" type="button">Add selected media</button><span class="helper gallery-picker-status"></span></div></section>`;document.body.appendChild(overlay);overlay.querySelector('.modal-close').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};overlay.querySelector('.add-selected-gallery-media').onclick=async()=>{const selected=[...overlay.querySelectorAll('input[type=checkbox]:checked')].map(input=>{const [source_type,source_id]=input.value.split(':');const item=galleryMedia.find(x=>x.source_type===source_type&&String(x.source_id)===source_id);return item&&{media_type:item.media_type,media_url:item.media_url,thumbnail_url:item.thumbnail_url,source_type:item.source_type,source_id:item.source_id,display_name:item.display_name};}).filter(Boolean).filter(x=>!existing.has(`${x.source_type}:${x.source_id}`));const status=overlay.querySelector('.gallery-picker-status');if(!selected.length){status.textContent='Choose at least one new item.';return;}status.textContent='Adding…';try{await apiFetch(`/api/galleries/admin/${albumId}/items`,{method:'POST',body:JSON.stringify({items:selected})});overlay.remove();loadGalleryAlbums();}catch(err){status.textContent=err.message;}};
}
document.querySelector('[data-tab="galleries"]')?.addEventListener('click',loadGalleryAlbums);


// Collections & Campaigns v3.2
let collectionRows=[], allProductsForCollections=[], campaignRows=[];
async function loadCollectionsAdmin(){
  collectionRows=await apiFetch('/api/collections/admin')||[];
  if(!allProductsForCollections.length){const p=await apiFetch('/api/products/admin/all');allProductsForCollections=p?.products||p||[];}
  const productSelect=document.getElementById('collection_products'); if(productSelect) productSelect.innerHTML=allProductsForCollections.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const list=document.getElementById('collectionsList'); if(list) list.innerHTML=collectionRows.length?collectionRows.map(c=>`<article class="gallery-admin-card"><div class="gallery-admin-cover">${c.cover_url?`<img src="${escapeAttr(c.cover_url)}">`:'<span>No cover</span>'}</div><div class="gallery-admin-copy"><div><span class="badge">${escapeHtml(c.status)}</span>${c.is_featured?'<span class="badge">Featured</span>':''}</div><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.description||'')}</p><small>${c.products.length} products</small><div class="row-actions"><button data-collection-edit="${c.id}">Edit</button><button class="danger" data-collection-delete="${c.id}">Delete</button></div></div></article>`).join(''):'<p class="empty-state">No collections yet.</p>';
  list?.querySelectorAll('[data-collection-edit]').forEach(b=>b.onclick=()=>openCollectionForm(collectionRows.find(c=>String(c.id)===b.dataset.collectionEdit)));
  list?.querySelectorAll('[data-collection-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this collection? Products will not be deleted.'))return;await apiFetch(`/api/collections/admin/${b.dataset.collectionDelete}`,{method:'DELETE'});loadCollectionsAdmin();});
  await loadCampaignsAdmin();
}
function openCollectionForm(c=null){document.getElementById('collectionFormWrap').hidden=false;document.getElementById('collection_id').value=c?.id||'';document.getElementById('collection_name').value=c?.name||'';document.getElementById('collection_subtitle').value=c?.subtitle||'';document.getElementById('collection_description').value=c?.description||'';document.getElementById('collection_cover_url').value=c?.cover_url||'';document.getElementById('collection_status').value=c?.status||'draft';document.getElementById('collection_featured').value=String(c?.is_featured||0);document.getElementById('collection_sort').value=c?.sort_order||0;const ids=new Set((c?.products||[]).map(p=>String(p.id)));[...document.getElementById('collection_products').options].forEach(o=>o.selected=ids.has(o.value));}
function closeCollectionForm(){document.getElementById('collectionFormWrap').hidden=true;document.getElementById('collectionForm').reset();document.getElementById('collection_id').value='';}
document.getElementById('newCollectionBtn')?.addEventListener('click',()=>openCollectionForm());document.getElementById('cancelCollectionBtn')?.addEventListener('click',closeCollectionForm);
document.getElementById('collectionForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=document.getElementById('collection_id').value;const payload={name:document.getElementById('collection_name').value,subtitle:document.getElementById('collection_subtitle').value,description:document.getElementById('collection_description').value,cover_url:document.getElementById('collection_cover_url').value,status:document.getElementById('collection_status').value,is_featured:document.getElementById('collection_featured').value==='1',sort_order:Number(document.getElementById('collection_sort').value)||0};const saved=await apiFetch(id?`/api/collections/admin/${id}`:'/api/collections/admin',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});const product_ids=[...document.getElementById('collection_products').selectedOptions].map(o=>Number(o.value));await apiFetch(`/api/collections/admin/${saved.id}/products`,{method:'PUT',body:JSON.stringify({product_ids})});closeCollectionForm();loadCollectionsAdmin();});
async function loadCampaignsAdmin(){campaignRows=await apiFetch('/api/collections/campaigns/admin')||[];const cs=document.getElementById('campaign_collection');if(cs)cs.innerHTML='<option value="">No collection</option>'+collectionRows.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');const list=document.getElementById('campaignsList');if(list)list.innerHTML=campaignRows.length?campaignRows.map(c=>`<article class="gallery-admin-card"><div class="gallery-admin-copy"><span class="badge">${escapeHtml(c.status)}</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.message||'')}</p><small>${escapeHtml(c.start_at||'Any time')} → ${escapeHtml(c.end_at||'No end')}</small><div class="row-actions"><button data-campaign-edit="${c.id}">Edit</button><button class="danger" data-campaign-delete="${c.id}">Delete</button></div></div></article>`).join(''):'<p class="empty-state">No campaigns yet.</p>';list?.querySelectorAll('[data-campaign-edit]').forEach(b=>b.onclick=()=>openCampaignForm(campaignRows.find(c=>String(c.id)===b.dataset.campaignEdit)));list?.querySelectorAll('[data-campaign-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete campaign?'))return;await apiFetch(`/api/collections/campaigns/admin/${b.dataset.campaignDelete}`,{method:'DELETE'});loadCampaignsAdmin();});}
function openCampaignForm(c=null){document.getElementById('campaignFormWrap').hidden=false;['id','name','message','button_text','button_link','start','end','status'].forEach(()=>{});document.getElementById('campaign_id').value=c?.id||'';document.getElementById('campaign_name').value=c?.name||'';document.getElementById('campaign_message').value=c?.message||'';document.getElementById('campaign_collection').value=c?.collection_id||'';document.getElementById('campaign_button_text').value=c?.button_text||'Explore';document.getElementById('campaign_button_link').value=c?.button_link||'';document.getElementById('campaign_start').value=(c?.start_at||'').slice(0,16);document.getElementById('campaign_end').value=(c?.end_at||'').slice(0,16);document.getElementById('campaign_status').value=c?.status||'draft';}
function closeCampaignForm(){document.getElementById('campaignFormWrap').hidden=true;document.getElementById('campaignForm').reset();document.getElementById('campaign_id').value='';}
document.getElementById('newCampaignBtn')?.addEventListener('click',()=>openCampaignForm());document.getElementById('cancelCampaignBtn')?.addEventListener('click',closeCampaignForm);
document.getElementById('campaignForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=document.getElementById('campaign_id').value;const payload={name:document.getElementById('campaign_name').value,message:document.getElementById('campaign_message').value,collection_id:document.getElementById('campaign_collection').value||null,button_text:document.getElementById('campaign_button_text').value,button_link:document.getElementById('campaign_button_link').value,start_at:document.getElementById('campaign_start').value,end_at:document.getElementById('campaign_end').value,status:document.getElementById('campaign_status').value};await apiFetch(id?`/api/collections/campaigns/admin/${id}`:'/api/collections/campaigns/admin',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});closeCampaignForm();loadCampaignsAdmin();});
document.querySelector('[data-tab="collections"]')?.addEventListener('click',loadCollectionsAdmin);
