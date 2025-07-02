const jwt = require("jsonwebtoken");

const verifyAdmin = (req, res, next) => {
  const token = req.headers["x-admin-token"]; // Match the header used in frontend

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.admin) {
      // Check if the token has admin privileges
      return res.status(403).json({ message: "Admin access required" });
    }
    req.admin = decoded; // Optional: attach decoded token data to request
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyAdmin;
