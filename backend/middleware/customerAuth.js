const jwt = require("jsonwebtoken");

module.exports = function customerAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "customer") throw new Error("Invalid customer token");
    req.customer = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
};
