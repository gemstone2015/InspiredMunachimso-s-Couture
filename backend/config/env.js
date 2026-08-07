const path = require("path");

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function csvFromEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const rootDir = path.resolve(__dirname, "..");
const port = numberFromEnv("PORT", 4000);
const nodeEnv = process.env.NODE_ENV || "development";

const localOrigins = [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  rootDir,
  uploadDirectory: process.env.UPLOAD_DIR || path.join(rootDir, "uploads"),
  adminDirectory: path.join(rootDir, "public", "admin"),
  allowedOrigins: [...new Set([...localOrigins, ...csvFromEnv("ALLOWED_ORIGINS")])],
  maxUploadMb: numberFromEnv("MAX_UPLOAD_MB", 80),
  publicSiteUrl: process.env.PUBLIC_SITE_URL || "http://localhost:5173",
  mediaStorage: process.env.CLOUDINARY_CLOUD_NAME ? "cloudinary" : "local",
};

function validateEnvironment() {
  const warnings = [];

  if (!process.env.DATABASE_URL) {
    warnings.push("DATABASE_URL is missing. Add your Neon PostgreSQL connection string.");
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
    warnings.push("JWT_SECRET is missing or too short. Use at least 24 characters before deployment.");
  }

  if (!process.env.ADMIN_PASSWORD) {
    warnings.push("ADMIN_PASSWORD is missing. Admin seeding and password reset will fail.");
  }

  if (config.isProduction && !process.env.ALLOWED_ORIGINS) {
    warnings.push("ALLOWED_ORIGINS is empty in production.");
  }

  return warnings;
}

module.exports = { config, validateEnvironment };
