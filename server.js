// server.js - Main entry point for the backend
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Core middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Custom logging middleware
const { loggingMiddleware } = require("./middleware/logger");
app.use(loggingMiddleware);

// Import routes
const authRoutes = require("./routes/auth");
const vehicleRoutes = require("./routes/vehicle");
const notificationRoutes = require("./routes/notification");

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Backend Assessment Server",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      vehicle: "/api/vehicle",
      notifications: "/api/notifications",
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server started on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/`);
  console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth`);
  console.log(`🚗 Vehicle routes: http://localhost:${PORT}/api/vehicle`);
  console.log(`🔔 Notification routes: http://localhost:${PORT}/api/notifications\n`);
});

module.exports = app;
