const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { config } = require("./config/env");
const corsOptions = require("./config/cors");
const requestContext = require("./middleware/requestContext");
const errorHandler = require("./middleware/errorHandler");
const { apiNotFound, generalNotFound } = require("./middleware/notFound");
const { publicLimiter, formLimiter, loginLimiter } = require("./middleware/rateLimits");

const productsRouter = require("./routes/products");
const mediaRouter = require("./routes/media");
const preordersRouter = require("./routes/preorders");
const messagesRouter = require("./routes/messages");
const authRouter = require("./routes/auth");
const paymentsRouter = require("./routes/payments");
const appointmentsRouter = require("./routes/appointments");
const testimonialsRouter = require("./routes/testimonials");
const orderUploadsRouter = require("./routes/orderUploads");

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
  app.use("/uploads", express.static(config.uploadDirectory, { maxAge: "7d", etag: true }));

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "Inspired Munachimso Couture backend is running.",
      version: "1.4.0",
      health: `/api/health`,
      admin: `/admin`,
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      status: "ok",
      version: "1.4.0",
      mediaStorage: config.mediaStorage,
      nodeVersion: process.version,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.use("/api/products", productsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/appointments", formLimiter, appointmentsRouter);
  app.use("/api/testimonials", testimonialsRouter);
  app.use("/api/order-files", orderUploadsRouter);
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
