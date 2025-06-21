require("./instrument");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

dotenv.config();

const app = express();

// Apply CORS globally
app.use(cors());

// Custom middleware for PayU webhook - must come BEFORE bodyParser
app.get("/api/events/webhook/payu", (req, res, next) => {
  let rawBody = [];
  // req.setEncoding("utf8"); // REMOVE THIS LINE

  req.on("data", (chunk) => {
    rawBody.push(chunk);
  });

  req.on("end", () => {
    try {
      console.log("Original Url:- ", req.originalUrl);
      console.log(req.url);
      console.log(req.query);
      console.log(req.body);
      console.log(req.params);
      const bodyString = Buffer.concat(rawBody);
      // const bodyString = Buffer.concat(rawBody).toString("utf8");
      const params = new URLSearchParams(bodyString);
      req.body = {};
      for (const [key, value] of params) {
        req.body[key] = value;
      }
      next();
    } catch (err) {
      console.error("Error parsing webhook payload:", err);
      return res.status(400).json({ error: "Invalid payload format" });
    }
  });

  req.on("error", (err) => {
    console.error("Error capturing raw body:", err);
    res.status(500).json({ error: "Failed to process raw body" });
  });
});

// Apply body parsing for all other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
connectDB();

// Routes
const authRoutes = require("./routes/adminAuthRoutes");
const eventRoutes = require("./routes/eventRoutes");
const contactRoutes = require("./routes/contactRoutes");

app.use("/api/admin", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/contact", contactRoutes);

// Default Route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

//Run the cron job to schedule events report
const { scheduleEventsReport } = require("./corn/eventCorn");
scheduleEventsReport();

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app };
