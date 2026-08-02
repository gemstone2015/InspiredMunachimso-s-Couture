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
  getProducts: (category) => request(`/api/products${category ? `?category=${category}` : ""}`),
  getProduct: (idOrSlug) => request(`/api/products/${idOrSlug}`),
  submitPreorder: (payload) => request("/api/preorders", { method: "POST", body: JSON.stringify(payload) }),
  submitMessage: (payload) => request("/api/messages", { method: "POST", body: JSON.stringify(payload) }),
  trackOrder: (payload) => request("/api/preorders/track", { method: "POST", body: JSON.stringify(payload) }),
  initialisePayment: (payload) => request("/api/payments/initialize", { method: "POST", body: JSON.stringify(payload) }),
  verifyStripe: (sessionId) => request(`/api/payments/stripe/verify?session_id=${encodeURIComponent(sessionId)}`),
  verifyPaystack: (reference) => request(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`),
  uploadOrderFiles: (reference, phone, files) => { const form = new FormData(); form.append("phone", phone); [...files].forEach((file) => form.append("files", file)); return request(`/api/order-files/${encodeURIComponent(reference)}`, { method: "POST", body: form }); },
  submitAppointment: (payload) => request("/api/appointments", { method: "POST", body: JSON.stringify(payload) }),
  getTestimonials: () => request("/api/testimonials"),
};
