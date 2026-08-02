const rateLimit = require("express-rate-limit");

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
};

const publicLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: 250,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const formLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many submissions. Please try again later." },
});

const loginLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, error: "Too many login attempts. Please wait 15 minutes." },
});

module.exports = { publicLimiter, formLimiter, loginLimiter };
