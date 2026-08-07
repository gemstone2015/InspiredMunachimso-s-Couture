const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: isForm ? (options.headers || {}) : { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export const api = {
  getSiteSettings: () => request("/api/site-settings/public"),
  getProducts: (category) => request(`/api/products${category ? `?category=${category}` : ""}`),
  getProduct: (idOrSlug) => request(`/api/products/${idOrSlug}`),
  submitPreorder: (payload, token = "") => request("/api/preorders", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(payload) }),
  submitMessage: (payload) => request("/api/messages", { method: "POST", body: JSON.stringify(payload) }),
  trackOrder: (payload) => request("/api/preorders/track", { method: "POST", body: JSON.stringify(payload) }),
  initialisePayment: (payload) => request("/api/payments/initialize", { method: "POST", body: JSON.stringify(payload) }),
  verifyStripe: (sessionId) => request(`/api/payments/stripe/verify?session_id=${encodeURIComponent(sessionId)}`),
  verifyPaystack: (reference) => request(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`),
  uploadOrderFiles: (reference, phone, files) => { const form = new FormData(); form.append("phone", phone); [...files].forEach((file) => form.append("files", file)); return request(`/api/order-files/${encodeURIComponent(reference)}`, { method: "POST", body: form }); },
  submitAppointment: (payload) => request("/api/appointments", { method: "POST", body: JSON.stringify(payload) }),
  getTestimonials: () => request("/api/testimonials"),
  getGalleries: () => request("/api/galleries/public"),
  getCollections: () => request("/api/collections/public"),
  getActiveCampaign: () => request("/api/collections/campaign/active"),
  customerRegister: (payload) => request("/api/customers/register", { method: "POST", body: JSON.stringify(payload) }),
  customerLogin: (payload) => request("/api/customers/login", { method: "POST", body: JSON.stringify(payload) }),
  customerMe: (token) => request("/api/customers/me", { headers: { Authorization: `Bearer ${token}` } }),
  customerDashboard: (token) => request("/api/customers/dashboard", { headers: { Authorization: `Bearer ${token}` } }),
  customerForgotPassword: (email) => request("/api/customers/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  customerResetPassword: (payload) => request("/api/customers/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  updateCustomerProfile: (token, payload) => request("/api/customers/me", { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  wishlistEnquiry: (token, productId, payload) => request(`/api/customers/wishlist/${productId}/enquiry`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  customerMeasurements: (token) => request("/api/customers/measurements", { headers: { Authorization: `Bearer ${token}` } }),
  saveMeasurement: (token, payload) => request("/api/customers/measurements", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  deleteMeasurement: (token, id) => request(`/api/customers/measurements/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  customerWishlist: (token) => request("/api/customers/wishlist", { headers: { Authorization: `Bearer ${token}` } }),
  addWishlist: (token, productId) => request(`/api/customers/wishlist/${productId}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  removeWishlist: (token, productId) => request(`/api/customers/wishlist/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
};
