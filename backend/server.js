require("dotenv").config();

const createApp = require("./app");
const { config, validateEnvironment } = require("./config/env");

const app = createApp();
const warnings = validateEnvironment();

for (const warning of warnings) {
  console.warn(`Configuration warning: ${warning}`);
}

const server = app.listen(config.port, () => {
  console.log("");
  console.log("Inspired Munachimso Couture API is running");
  console.log(`Backend: http://localhost:${config.port}`);
  console.log(`Admin:   http://localhost:${config.port}/admin`);
  console.log(`Health:  http://localhost:${config.port}/api/health`);
  console.log(`Node:    ${process.version}`);
  console.log(`Mode:    ${config.nodeEnv}`);
  console.log("");
});

function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));
