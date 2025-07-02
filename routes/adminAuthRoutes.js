// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
    expiresIn: "3h",
  });
  res.json({ token });
});

router.get("/verify", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: "Token is valid" });
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
