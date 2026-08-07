require('express-async-errors');
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { config } = require("./config/env");
const corsOptions = require("./config/cors");
const requestContext = require("./middleware/requestContext");
const errorHandler = require("./middleware/errorHandler");
const { apiNotFound, generalNotFound } = require("./middleware/notFound");
const { publicLimiter, formLimiter, loginLimiter } = require("./middleware/rateLimits");
const { publicCache, noStore } = require("./middleware/cacheControl");
const db = require("./db");

const productsRouter = require("./routes/products");
const mediaRouter = require("./routes/media");
const mediaLibraryRouter = require("./routes/mediaLibrary");
const galleriesRouter = require("./routes/galleries");
const collectionsRouter = require("./routes/collections");
const preordersRouter = require("./routes/preorders");
const messagesRouter = require("./routes/messages");
const authRouter = require("./routes/auth");
const paymentsRouter = require("./routes/payments");
const appointmentsRouter = require("./routes/appointments");
const testimonialsRouter = require("./routes/testimonials");
const orderUploadsRouter = require("./routes/orderUploads");
const dashboardRouter = require("./routes/dashboard");
const siteSettingsRouter = require("./routes/siteSettings");
const customersRouter = require("./routes/customers");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestContext);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: config.isProduction ? undefined : false,
    })
  );
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use("/api", publicLimiter);
  app.use("/api/admin", noStore);
  app.use("/api/customers", noStore);
  app.use("/uploads", express.static(config.uploadDirectory, {
    maxAge: config.isProduction ? "30d" : "1h",
    immutable: config.isProduction,
    etag: true,
    lastModified: true,
  }));

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "Inspiredmunachimso’s Couture backend is running.",
      version: "4.0.0-neon",
      health: `/api/health`,
      admin: `/admin`,
    });
  });

  app.get("/api/ready", noStore, async (_req, res) => {
    try {
      const databaseReady = Number((await db.prepare("SELECT 1 AS ok").get()).ok) === 1;
      if (!databaseReady) throw new Error("Database check failed");
      res.json({ success: true, status: "ready", version: "4.0.0-neon" });
    } catch (error) {
      res.status(503).json({ success: false, status: "not-ready", error: error.message });
    }
  });

  app.get("/api/health", noStore, async (_req, res) => {
    const databaseRow = await db.prepare("SELECT 1 AS ok").get();
    res.json({
      success: true,
      status: "ok",
      version: "4.0.0-neon",
      mediaStorage: config.mediaStorage,
      nodeVersion: process.version,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      database: Number(databaseRow?.ok) === 1 ? "connected" : "unknown",
      integrations: {
        cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
        email: Boolean(process.env.RESEND_API_KEY),
      },
      time: new Date().toISOString(),
    });
  });

  app.use("/api/site-settings", publicCache(120), siteSettingsRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/admin/dashboard", dashboardRouter);
  app.use("/api/products", publicCache(60), productsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/appointments", formLimiter, appointmentsRouter);
  app.use("/api/testimonials", publicCache(120), testimonialsRouter);
  app.use("/api/order-files", orderUploadsRouter);
  app.use("/api/media-library", mediaLibraryRouter);
  app.use("/api/galleries", publicCache(120), galleriesRouter);
  app.use("/api/collections", publicCache(120), collectionsRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/preorders", formLimiter, preordersRouter);
  app.use("/api/messages", formLimiter, messagesRouter);
  app.use("/api/admin/login", loginLimiter);
  app.use("/api/admin", authRouter);

  app.get("/admin", (_req, res) => res.redirect("/admin/login.html"));
  app.use(
    "/admin",
    express.static(config.adminDirectory, {
      maxAge: config.isProduction ? "1h" : 0,
      etag: true,
    })
  );

  app.use("/api", apiNotFound);
  app.use(generalNotFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
