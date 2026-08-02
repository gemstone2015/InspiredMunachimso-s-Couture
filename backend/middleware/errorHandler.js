const { config } = require("../config/env");

function errorHandler(err, req, res, _next) {
  console.error(`[${req.requestId || "no-request-id"}]`, err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: `A file is too large. Maximum is ${config.maxUploadMb}MB.`,
      requestId: req.requestId,
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({
      success: false,
      error: "Too many files were selected.",
      requestId: req.requestId,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      error: "An unexpected upload field was submitted.",
      requestId: req.requestId,
    });
  }

  const status = Number(err.status) || 500;
  const publicMessage = status >= 500 && config.isProduction
    ? "Something went wrong on our end."
    : err.message || "Something went wrong on our end.";

  return res.status(status).json({
    success: false,
    error: publicMessage,
    requestId: req.requestId,
  });
}

module.exports = errorHandler;
