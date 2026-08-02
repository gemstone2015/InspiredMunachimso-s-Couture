import React, { useEffect, useRef, useState } from "react";
import "./index.css";
import { api } from "./api";

const CONTACTS = {
  uk: { label: "United Kingdom", display: "07523 864253", tel: "+447523864253", whatsapp: "447523864253" },
  ng: { label: "Nigeria", display: "+234 739 702 3326", tel: "+2347397023326", whatsapp: "2347397023326" },
};
const waLink = (number, msg) => `https://wa.me/${number}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;

function ProductMedia({ product, className = "product-media" }) {
  const media = product.cover_media || product.media?.[0];
  if (!media && !product.image_url) return <div className={`${className} media-placeholder`}>New look coming soon</div>;
  if (media?.media_type === "video") {
    return <video className={className} src={media.media_url} poster={media.thumbnail_url || undefined} muted loop playsInline preload="metadata" onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />;
  }
  return <img className={className} src={media?.thumbnail_url || media?.media_url || product.image_url} alt={media?.alt_text || product.name} loading="lazy" />;
}

function ProductDetails({ product, open, onClose, onContact }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { setActiveIndex(0); }, [product?.id]);
  useEffect(() => {
    const close = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  if (!open || !product) return null;
  const media = product.media?.length ? product.media : product.image_url ? [{ media_type: "image", media_url: product.image_url, alt_text: product.name }] : [];
  const active = media[activeIndex] || null;
  const facts = [
    ["Style", product.style], ["Fabric", product.fabric], ["Colour", product.colour],
    ["For", product.gender], ["Sizes", product.sizes], ["Production", product.production_time],
  ].filter(([, value]) => value);
  return <div className="product-modal" onClick={onClose} role="presentation">
    <article className="product-detail-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={product.name}>
      <button className="contact-close" onClick={onClose} aria-label="Close product">×</button>
      <div className="product-detail-media">
        {active ? active.media_type === "video" ? <video src={active.media_url} controls playsInline preload="metadata" /> : <img src={active.media_url} alt={active.alt_text || product.name} /> : <div className="product-detail-placeholder">New look coming soon</div>}
        {media.length > 1 && <div className="product-thumbs">{media.map((item, index) => <button type="button" key={item.id || index} className={index === activeIndex ? "active" : ""} onClick={() => setActiveIndex(index)}>{item.media_type === "video" ? <video src={item.media_url} muted preload="metadata" /> : <img src={item.thumbnail_url || item.media_url} alt="" />}</button>)}</div>}
      </div>
      <div className="product-detail-copy">
        <div className="kicker">{product.category === "igbo-attire" ? "Igbo Attire" : product.category}</div>
        <h2 className="disp">{product.name}</h2>
        {product.tag && <p className="product-tag">{product.tag}</p>}
        <p className="product-price">{product.price || "Enquire for price"}</p>
        {product.description && <p className="product-description">{product.description}</p>}
        {facts.length > 0 && <dl className="product-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        {product.made_to_order ? <p className="made-note">Made to order and finished to your measurements.</p> : null}
        <button type="button" className="gold-btn" onClick={() => onContact(product)}>Enquire about this look</button>
      </div>
    </article>
  </div>;
}

function ContactChooser({ open, onClose, message }) {
  useEffect(() => {
    const close = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  if (!open) return null;
  return <div className="contact-modal" onClick={onClose} role="presentation"><div className="contact-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Choose contact location"><button className="contact-close" onClick={onClose} aria-label="Close">×</button><div className="kicker">Choose your location</div><h3 className="disp">Chat with our atelier</h3>{Object.entries(CONTACTS).map(([key, c]) => <div className="contact-option" key={key}><div><strong>{c.label}</strong><span>{c.display}</span></div><a className="gold-btn" href={waLink(c.whatsapp, message)} target="_blank" rel="noreferrer">WhatsApp</a></div>)}</div></div>;
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.9s cubic-bezier(.2,.7,.2,1) ${delay}s, transform 0.9s cubic-bezier(.2,.7,.2,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function StitchDivider() {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <svg width="100%" height="18" viewBox="0 0 1180 18" preserveAspectRatio="none" style={{ maxWidth: 1180, opacity: 0.7 }}>
        <line x1="0" y1="9" x2="1180" y2="9" stroke="var(--gold)" strokeWidth="1" strokeDasharray="10 9" />
      </svg>
    </div>
  );
}

function Monogram({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="47" stroke="var(--gold)" strokeWidth="1" />
      <circle cx="50" cy="50" r="41" stroke="var(--gold)" strokeWidth="0.5" opacity="0.5" />
      <text x="50" y="60" textAnchor="middle" fontFamily="Italiana, serif" fontSize="34" fill="var(--gold-light)">IM</text>
    </svg>
  );
}

const WhatsAppIcon = ({ size = 24, color = "#F5F1E8" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.4 0-.5C10 9 9.5 7.8 9.3 7.3c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z" fill={color} />
    <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.2-.4-4.5-1.2l-.3-.2-3.1.8.8-3-.2-.3C3.7 14.9 3.2 13.5 3.2 12c0-4.8 3.9-8.7 8.8-8.7s8.8 3.9 8.8 8.7-3.9 8.7-8.8 8.7z" fill={color} />
  </svg>
);

const FALLBACK_LOOKS = [
  { id: "f1", name: "Ankara Wrap Dress", tag: "Women · Ready-to-wear", price: "₦25,000" },
  { id: "f2", name: "Senator Set", tag: "Men · Ready-to-wear", price: "₦35,000" },
  { id: "f3", name: "Agbada Ensemble", tag: "Men · Ready-to-wear", price: "₦55,000" },
];
const FALLBACK_CAPS = [
  { id: "c1", name: "Gobi Cap", tag: "Classic fold" },
  { id: "c2", name: "Kufi Cap", tag: "Everyday" },
  { id: "c3", name: "Aso-Oke Fila", tag: "Ceremonial" },
  { id: "c4", name: "Custom Fabric", tag: "Made to order" },
];

const FALLBACK_IGBO_ATTIRES = [
  { id: "ig1", name: "Isi Agu Outfit", tag: "Igbo Men’s Traditional Wear", price: "Enquire for price" },
  { id: "ig2", name: "George Wrapper & Blouse", tag: "Igbo Women’s Traditional Wear", price: "Enquire for price" },
  { id: "ig3", name: "Igbo Bridal Look", tag: "Traditional Bridal Wear", price: "Enquire for price" },
  { id: "ig4", name: "Traditional Couple Set", tag: "Igbo Wedding Couple Set", price: "Enquire for price" },
  { id: "ig5", name: "Chieftaincy Ensemble", tag: "Custom Ceremonial Wear", price: "Enquire for price" },
  { id: "ig6", name: "Children’s Igbo Attire", tag: "Children’s Traditional Wear", price: "Enquire for price" },
  { id: "ig7", name: "Family Matching Set", tag: "Family Traditional Outfits", price: "Enquire for price" },
  { id: "ig8", name: "Custom Igbo Ceremonial Wear", tag: "Made to Measure", price: "Enquire for price" },
];

const STEPS = [
  { n: "01", title: "Bring it in", body: "Drop off the garment, or send measurements and photos over WhatsApp." },
  { n: "02", title: "Fitting", body: "We pin the changes with you in the room — hems, waist, sleeves, sit." },
  { n: "03", title: "Amendment", body: "Our tailors rework the piece by hand to the agreed fit and finish." },
  { n: "04", title: "Ready", body: "Final press, quality check, and it's ready for pickup or delivery." },
];

function PreorderForm() {
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", style_inspiration: "", fabric: "", event_date: "", notes: "" });
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState({ state: "idle", message: "", reference: "" });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: "loading", message: "" });
    try {
      const result = await api.submitPreorder(form);
      if (files.length) await api.uploadOrderFiles(result.order_reference, form.phone, files);
      setStatus({ state: "success", message: "Received — keep your order reference safe for tracking.", reference: result.order_reference });
      setForm({ customer_name: "", phone: "", email: "", style_inspiration: "", fabric: "", event_date: "", notes: "" });
      setFiles([]);
      if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <form onSubmit={submit}>
      <label>Full name
        <input required value={form.customer_name} onChange={update("customer_name")} placeholder="Your name" />
      </label>
      <label>Phone / WhatsApp number
        <input required value={form.phone} onChange={update("phone")} placeholder="Your phone number" />
      </label>
      <label>Email address
        <input required type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" />
      </label>
      <label>Style inspiration
        <input value={form.style_inspiration} onChange={update("style_inspiration")} placeholder="e.g. Agbada, wedding guest" />
      </label>
      <label>Preferred fabric
        <input value={form.fabric} onChange={update("fabric")} placeholder="e.g. Ankara, Aso-Oke" />
      </label>
      <label>Event date
        <input type="date" value={form.event_date} onChange={update("event_date")} />
      </label>
      <label>Notes
        <textarea rows="3" value={form.notes} onChange={update("notes")} placeholder="Anything else we should know" />
      </label>
      <label>Inspiration images or measurement sheet
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => setFiles([...e.target.files].slice(0,6))} />
        <small>Up to 6 JPG, PNG, WebP or PDF files.</small>
      </label>
      <button type="submit" className="gold-btn" disabled={status.state === "loading"}>
        {status.state === "loading" ? "Sending…" : "Submit pre-order"}
      </button>
      {status.message && <p className={`form-status ${status.state}`}>{status.message}</p>}
      {status.reference && <p className="order-reference-note">Order reference: <strong>{status.reference}</strong></p>}
    </form>
  );
}

function TrackOrderForm() {
  const [form, setForm] = useState({ order_reference: "", phone: "" });
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const update = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const track = async (e) => {
    e.preventDefault(); setStatus({ state: "loading", message: "" });
    try { const result = await api.trackOrder(form); setOrder(result); setStatus({ state: "success", message: "Order found." }); }
    catch (error) { setOrder(null); setStatus({ state: "error", message: error.message }); }
  };
  const pay = async (provider) => {
    try { setStatus({ state: "loading", message: "Preparing secure payment…" }); const result = await api.initialisePayment({ ...form, provider }); window.location.href = result.authorization_url; }
    catch (error) { setStatus({ state: "error", message: error.message }); }
  };
  const statusLabels = { new: "New enquiry", confirmed: "Confirmed", deposit_pending: "Deposit pending", deposit_paid: "Deposit paid", measurements_received: "Measurements received", in_production: "In production", fitting: "Fitting stage", ready: "Ready", dispatched: "Dispatched", delivered: "Delivered", cancelled: "Cancelled" };
  return <div className="track-order-card">
    <form onSubmit={track}>
      <label>Order reference<input required value={form.order_reference} onChange={update("order_reference")} placeholder="IMC-2026-ABC123" /></label>
      <label>Phone number<input required value={form.phone} onChange={update("phone")} placeholder="Use the number on your order" /></label>
      <button type="submit" className="gold-btn" disabled={status.state === "loading"}>{status.state === "loading" ? "Checking…" : "Track order"}</button>
    </form>
    {status.message && <p className={`form-status ${status.state}`}>{status.message}</p>}
    {order && <div className="tracking-result">
      <div className="order-timeline">{(order.timeline || []).map((item, index) => <div key={`${item.status}-${index}`} className={`timeline-step ${index === (order.timeline?.length || 1)-1 ? "current" : ""}`}><i /><div><strong>{statusLabels[item.status] || item.status}</strong><small>{item.note || "Order updated"}</small><time>{new Date(`${item.created_at}Z`).toLocaleDateString()}</time></div></div>)}</div>
      <div><span>Reference</span><strong>{order.order_reference}</strong></div>
      <div><span>Current stage</span><strong>{statusLabels[order.status] || order.status}</strong></div>
      <div><span>Payment</span><strong>{order.payment_status}</strong></div>
      {order.event_date && <div><span>Event date</span><strong>{order.event_date}</strong></div>}
      {order.quoted_amount > 0 && order.payment_status !== "paid" && <div className="payment-panel"><p>Deposit due: <strong>{order.currency} {(order.quoted_amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></p><div>{order.currency === "NGN" ? <button type="button" className="gold-btn" onClick={() => pay("paystack")}>Pay securely with Paystack</button> : <button type="button" className="gold-btn" onClick={() => pay("stripe")}>Pay securely with Stripe</button>}</div></div>}
    </div>}
  </div>;
}

function AppointmentForm() {
  const [form,setForm]=useState({customer_name:"",phone:"",email:"",appointment_type:"consultation",preferred_date:"",preferred_time:"",location:"UK",notes:""});
  const [status,setStatus]=useState({state:"idle",message:""});
  const update=(key)=>(e)=>setForm((f)=>({...f,[key]:e.target.value}));
  const submit=async(e)=>{e.preventDefault();setStatus({state:"loading",message:""});try{const r=await api.submitAppointment(form);setStatus({state:"success",message:`Request received. Reference: ${r.appointment_reference}`});setForm({customer_name:"",phone:"",email:"",appointment_type:"consultation",preferred_date:"",preferred_time:"",location:"UK",notes:""});}catch(err){setStatus({state:"error",message:err.message})}};
  return <form onSubmit={submit}><label>Full name<input required value={form.customer_name} onChange={update("customer_name")}/></label><label>Phone<input required value={form.phone} onChange={update("phone")}/></label><label>Email<input type="email" value={form.email} onChange={update("email")}/></label><label>Appointment type<select value={form.appointment_type} onChange={update("appointment_type")}><option value="consultation">Consultation</option><option value="measurement">Measurement appointment</option><option value="fitting">Fitting</option><option value="alteration_dropoff">Alteration drop-off</option><option value="collection">Collection</option><option value="video_consultation">Video consultation</option></select></label><label>Preferred date<input type="date" value={form.preferred_date} onChange={update("preferred_date")}/></label><label>Preferred time<input type="time" value={form.preferred_time} onChange={update("preferred_time")}/></label><label>Location<select value={form.location} onChange={update("location")}><option>UK</option><option>Nigeria</option><option>Online</option></select></label><label>Notes<textarea rows="3" value={form.notes} onChange={update("notes")}/></label><button className="gold-btn" disabled={status.state==="loading"}>{status.state==="loading"?"Sending…":"Request appointment"}</button>{status.message&&<p className={`form-status ${status.state}`}>{status.message}</p>}</form>;
}

function ContactForm() {
  const [form, setForm] = useState({ customer_name: "", phone: "", message: "", type: "contact" });
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: "loading", message: "" });
    try {
      const result = await api.submitMessage(form);
      setStatus({ state: "success", message: "Sent — we'll get back to you shortly." });
      setForm({ customer_name: "", phone: "", message: "", type: "contact" });
      if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <form onSubmit={submit}>
      <label>Full name
        <input required value={form.customer_name} onChange={update("customer_name")} placeholder="Your name" />
      </label>
      <label>Phone / WhatsApp number
        <input required value={form.phone} onChange={update("phone")} placeholder="080..." />
      </label>
      <label>Message
        <textarea required rows="3" value={form.message} onChange={update("message")} placeholder="Tell us what you need" />
      </label>
      <button type="submit" className="gold-btn" disabled={status.state === "loading"}>
        {status.state === "loading" ? "Sending…" : "Send message"}
      </button>
      {status.message && <p className={`form-status ${status.state}`}>{status.message}</p>}
    </form>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [looks, setLooks] = useState(FALLBACK_LOOKS);
  const [caps, setCaps] = useState(FALLBACK_CAPS);
  const [igboAttires, setIgboAttires] = useState(FALLBACK_IGBO_ATTIRES);
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [liveTestimonials, setLiveTestimonials] = useState([]);
  const [contactMessage, setContactMessage] = useState("Hello Inspired Munachimso Couture, I would like to make an enquiry.");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    api.getProducts("ready-to-wear").then((rows) => rows.length && setLooks(rows)).catch(() => {});
    api.getProducts("cap").then((rows) => rows.length && setCaps(rows)).catch(() => {});
    api.getProducts("igbo-attire").then((rows) => rows.length && setIgboAttires(rows)).catch(() => {});
    api.getTestimonials().then((rows) => rows.length && setLiveTestimonials(rows)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const sessionId = params.get("session_id");
    const reference = params.get("reference");
    if (provider === "stripe" && sessionId) api.verifyStripe(sessionId).catch(() => {});
    if (provider === "paystack" && reference) api.verifyPaystack(reference).catch(() => {});
  }, []);

  const navLinks = [
    { href: "#collections", label: "Collections" },
    { href: "#igbo-heritage", label: "Igbo Heritage" },
    { href: "#atelier", label: "Atelier" },
    { href: "#services", label: "Services" },
    { href: "#appointments", label: "Appointments" },
    { href: "#track-order", label: "Track Order" },
    { href: "#contact", label: "Contact" },
  ];

  const openProduct = async (product) => {
    try { setSelectedProduct(await api.getProduct(product.slug || product.id)); }
    catch { setSelectedProduct(product); }
  };

  const enquireProduct = (product) => {
    setContactMessage(`Hello Inspired Munachimso Couture, I would like to enquire about ${product?.name || "one of your designs"}.`);
    setSelectedProduct(null);
    setContactOpen(true);
  };

  const collectionCards = [
    { eyebrow: "01", title: "Igbo Heritage", copy: "Isi Agu, George, bridal and ceremonial pieces shaped by culture and occasion.", href: "#igbo-heritage", className: "collection-heritage" },
    { eyebrow: "02", title: "Contemporary Edit", copy: "Modern silhouettes in Ankara, brocade and lace, made to command a room.", href: "#ready-to-wear", className: "collection-modern" },
    { eyebrow: "03", title: "Traditional Caps", copy: "Hand-finished caps for weddings, titles, celebrations and Sunday best.", href: "#caps", className: "collection-caps" },
  ];

  const fallbackTestimonials = [
    { quote: "The finishing was beautiful and the fit felt completely personal. I received compliments throughout the event.", name: "Ada", location: "Birmingham" },
    { quote: "Our family outfits arrived exactly as discussed. Every detail looked considered and the children were comfortable.", name: "Chika", location: "London" },
    { quote: "From the first conversation to final delivery, the process felt professional, warm and dependable.", name: "Ngozi", location: "Leicester" },
  ];

  const testimonials = liveTestimonials.length ? liveTestimonials.map((t)=>({quote:t.quote,name:t.customer_name,location:t.location})) : fallbackTestimonials;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="nav-inner">
          <a href="#top" className="brand-lockup" aria-label="Inspired Munachimso Couture home">
            <Monogram size={42} />
            <span><strong>Inspired Munachimso</strong><em>Couture</em></span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <button type="button" className="nav-cta desktop-only" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }}>Book a consultation</button>
          <button type="button" className="menu-toggle mobile-only" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Toggle menu">
            <span /> <span />
          </button>
        </div>
        {menuOpen && <div className="mobile-menu">
          {navLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
          <button type="button" onClick={() => { setMenuOpen(false); setContactOpen(true); }}>Book a consultation</button>
        </div>}
      </header>

      <main id="main">
        <section id="top" className="luxury-hero">
          <video autoPlay muted loop playsInline className="hero-film"><source src="/assets/hero.mp4" type="video/mp4" /></video>
          <div className="hero-overlay" />
          <div className="hero-grain" />
          <div className="hero-content">
            <p className="hero-kicker">African heritage · modern elegance</p>
            <h1>Clothing that carries <span>your story.</span></h1>
            <p className="hero-copy">Bespoke Igbo attire and contemporary African couture, designed with precision for clients in the United Kingdom and Nigeria.</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#collections">Explore collections</a>
              <button className="text-link" type="button" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }}>Book a private consultation <span>↗</span></button>
            </div>
          </div>
          <div className="hero-meta"><span>UK</span><i /> <span>Nigeria</span><i /> <span>Worldwide enquiries</span></div>
          <a className="scroll-cue" href="#intro" aria-label="Scroll to introduction"><span>Scroll</span><b /></a>
        </section>

        <section id="intro" className="editorial-intro section-pad">
          <Reveal>
            <p className="section-kicker">The house</p>
            <div className="intro-grid">
              <h2>Tradition is not a costume. It is a language.</h2>
              <div><p>Inspired Munachimso Couture creates pieces that honour identity while feeling entirely current. Every garment is shaped around the person, the occasion and the story it needs to tell.</p><a href="#igbo-heritage" className="inline-arrow">Discover the heritage collection <span>→</span></a></div>
            </div>
          </Reveal>
        </section>

        <section id="collections" className="collections-section section-pad">
          <div className="section-heading">
            <Reveal><p className="section-kicker">Signature worlds</p><h2>Collections with presence.</h2></Reveal>
            <p>Explore the house through three distinct expressions of craft.</p>
          </div>
          <div className="collection-panels">
            {collectionCards.map((item, index) => <Reveal key={item.title} delay={index * 0.08}><a href={item.href} className={`collection-panel ${item.className}`}><span>{item.eyebrow}</span><div><h3>{item.title}</h3><p>{item.copy}</p><b>Explore collection ↗</b></div></a></Reveal>)}
          </div>
        </section>

        <section id="igbo-heritage" className="heritage-section section-pad">
          <div className="heritage-story">
            <Reveal><p className="section-kicker">Igbo heritage collection</p><h2>Made for moments that become memory.</h2></Reveal>
            <Reveal delay={0.1}><p>From Isi Agu and George to bridal looks, chieftaincy attire and matching family sets, each piece is designed to respect tradition without losing the wearer inside it.</p><div className="heritage-notes"><span>Weddings</span><span>Traditional marriage</span><span>Chieftaincy</span><span>Family celebrations</span></div></Reveal>
          </div>
          <div className="luxury-product-grid">
            {igboAttires.slice(0, 6).map((product, index) => <Reveal key={product.id} delay={(index % 3) * 0.08}><article className={`luxury-product-card ${index === 0 ? "feature-card" : ""}`} onClick={() => openProduct(product)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openProduct(product)}>
              <div className="luxury-media"><ProductMedia product={product} className="luxury-product-media"/><span className="quick-view">View look</span></div>
              <div className="luxury-product-copy"><div><p>{product.style || product.tag || "Igbo Attire"}</p><h3>{product.name}</h3></div><span>{product.price || "Enquire"}</span></div>
            </article></Reveal>)}
          </div>
        </section>

        <section className="craft-banner">
          <div className="craft-media"><video controls muted loop playsInline><source src="/assets/atelier.mp4" type="video/mp4" /></video></div>
          <div className="craft-copy"><Reveal><p className="section-kicker">Crafted, not produced</p><h2>Every line begins by hand.</h2><p>Measurements, fabric, cut, structure and finish are considered as one process. The result is clothing that does not merely fit the body—it belongs to it.</p><div className="craft-stats"><div><strong>01</strong><span>Personal consultation</span></div><div><strong>02</strong><span>Measured and cut</span></div><div><strong>03</strong><span>Finished by hand</span></div></div></Reveal></div>
        </section>

        <section id="ready-to-wear" className="ready-section section-pad">
          <div className="section-heading compact"><Reveal><p className="section-kicker">Contemporary edit</p><h2>Ready for the room.</h2></Reveal><p>A rotating selection of modern African pieces, available as shown or refined to your measurements.</p></div>
          <div className="horizontal-products">
            {looks.slice(0, 6).map((product, index) => <article key={product.id} className="horizontal-card" onClick={() => openProduct(product)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openProduct(product)}><span className="look-number">{String(index + 1).padStart(2, "0")}</span><ProductMedia product={product} className="horizontal-media"/><div><p>{product.tag || "Ready-to-wear"}</p><h3>{product.name}</h3><b>{product.price || "Enquire"}</b></div></article>)}
          </div>
        </section>

        <section id="caps" className="caps-luxury section-pad">
          <div className="caps-copy"><Reveal><p className="section-kicker">Traditional caps</p><h2>The final mark of occasion.</h2><p>Hand-finished caps in your fabric or ours, shaped for weddings, traditional ceremonies, titles and distinguished everyday wear.</p><button type="button" className="primary-btn" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }}>Commission a cap</button></Reveal></div>
          <div className="caps-showcase">{caps.slice(0, 4).map((cap) => <article key={cap.id} onClick={() => openProduct(cap)} role="button" tabIndex={0}><ProductMedia product={cap} className="caps-showcase-media"/><div><h3>{cap.name}</h3><p>{cap.tag}</p></div></article>)}</div>
        </section>

        <section id="services" className="services-section section-pad">
          <Reveal><p className="section-kicker">The service</p><h2>A considered journey, from idea to final fitting.</h2></Reveal>
          <div className="service-steps">{STEPS.map((step) => <div key={step.n}><span>{step.n}</span><h3>{step.title}</h3><p>{step.body}</p></div>)}</div>
        </section>

        <section className="testimonial-section section-pad">
          <div className="section-heading compact"><Reveal><p className="section-kicker">Client notes</p><h2>Worn, remembered, recommended.</h2></Reveal></div>
          <div className="testimonial-grid">{testimonials.map((item, index) => <Reveal key={item.name} delay={index * .08}><blockquote><span>“</span><p>{item.quote}</p><footer><strong>{item.name}</strong><em>{item.location}</em></footer></blockquote></Reveal>)}</div>
        </section>

        <section id="atelier" className="atelier-editorial section-pad">
          <div><Reveal><p className="section-kicker">Inside the atelier</p><h2>Where fabric becomes form.</h2><p>Follow the work from first cut to final press. This space will grow as new fittings, details and finished looks are added through the admin dashboard.</p></Reveal></div>
          <div className="atelier-tiles"><div className="atelier-tile tile-one"><span>Cutting</span></div><div className="atelier-tile tile-two"><span>Finishing</span></div><div className="atelier-tile tile-three"><span>Fitting</span></div></div>
        </section>

        <section id="preorder" className="consultation-section section-pad">
          <div className="consultation-copy"><Reveal><p className="section-kicker">Begin your piece</p><h2>Tell us what the occasion deserves.</h2><p>Share your inspiration, preferred fabric and event date. We will confirm availability, next steps and deposit details.</p><div className="contact-numbers"><a href={`tel:${CONTACTS.uk.tel}`}><span>United Kingdom</span>{CONTACTS.uk.display}</a><a href={`tel:${CONTACTS.ng.tel}`}><span>Nigeria</span>{CONTACTS.ng.display}</a></div></Reveal></div>
          <div className="luxury-form"><PreorderForm /></div>
        </section>

        <section id="appointments" className="appointment-section section-pad"><div><Reveal><p className="section-kicker">Private appointments</p><h2>Request a consultation, fitting or measurement session.</h2><p>Choose your preferred date and time. The atelier will contact you to confirm the appointment.</p></Reveal></div><div className="luxury-form"><AppointmentForm /></div></section>

        <section id="track-order" className="track-order-section section-pad">
          <div><Reveal><p className="section-kicker">Order journey</p><h2>Track your order and pay your deposit.</h2><p>Enter the order reference you received after submitting your request, together with the same phone number used on the order.</p></Reveal></div>
          <TrackOrderForm />
        </section>

        <section id="contact" className="contact-section section-pad">
          <div><Reveal><p className="section-kicker">Private enquiries</p><h2>Let us make something unmistakably yours.</h2><p>For alterations, commissions, collaborations or general questions, send a message directly to the atelier.</p></Reveal></div>
          <div className="luxury-form muted-form"><ContactForm /></div>
        </section>
      </main>

      <footer className="luxury-footer">
        <div className="footer-top"><div className="footer-brand"><Monogram size={54}/><h2>Inspired Munachimso <em>Couture</em></h2><p>African heritage, tailored for today.</p></div><div><h3>Explore</h3>{navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div><h3>Contact</h3><a href={`tel:${CONTACTS.uk.tel}`}>UK · {CONTACTS.uk.display}</a><a href={`tel:${CONTACTS.ng.tel}`}>Nigeria · {CONTACTS.ng.display}</a><button type="button" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }}>Choose WhatsApp</button><a href="#">Instagram · Add handle</a></div><div><h3>Appointments</h3><p>Consultations are arranged directly with the atelier.</p><button className="footer-cta" type="button" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }}>Reserve a fitting ↗</button></div></div>
        <div className="footer-bottom"><span>© 2026 Inspired Munachimso Couture</span><span>UK · Nigeria · Worldwide enquiries</span></div>
      </footer>

      <button type="button" onClick={() => { setContactMessage("Hello Inspired Munachimso Couture, I would like to make an enquiry."); setContactOpen(true); }} className="wa-fab" aria-label="Choose a WhatsApp number"><WhatsAppIcon /></button>
      <ProductDetails product={selectedProduct} open={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} onContact={enquireProduct} />
      <ContactChooser open={contactOpen} onClose={() => setContactOpen(false)} message={contactMessage} />
    </div>
  );
}
