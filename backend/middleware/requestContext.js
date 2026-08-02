const { randomUUID } = require("crypto");

function requestContext(req, res, next) {
  const requestId = req.get("X-Request-Id") || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

module.exports = requestContext;
