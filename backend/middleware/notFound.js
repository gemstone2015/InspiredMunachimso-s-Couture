function apiNotFound(req, res) {
  res.status(404).json({
    success: false,
    error: "API route not found.",
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId,
  });
}

function generalNotFound(req, res) {
  res.status(404).json({
    success: false,
    error: "Route not found.",
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId,
  });
}

module.exports = { apiNotFound, generalNotFound };
