// middleware/logger.js - Centralized Logging Middleware
// Intercepts all requests and generates structured log entries

const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, "app.log");

/**
 * Log levels with numeric priority
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

/**
 * Creates a structured log entry and writes it to file + console
 * @param {string} source - Where the log originates from (e.g., "backend", "auth", "vehicle")
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, FATAL)
 * @param {string} service - Which service/module generated the log
 * @param {string} message - Human readable log message
 * @param {object} meta - Additional metadata to attach
 */
function Log(source, level, service, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logId = uuidv4().slice(0, 8);

  const logEntry = {
    id: logId,
    timestamp,
    source,
    level: level.toUpperCase(),
    service,
    message,
    meta,
  };

  const logString = JSON.stringify(logEntry);

  // Write to file
  fs.appendFileSync(logFilePath, logString + "\n");

  // Console output with color coding
  const colors = {
    DEBUG: "\x1b[36m",  // cyan
    INFO: "\x1b[32m",   // green
    WARN: "\x1b[33m",   // yellow
    ERROR: "\x1b[31m",  // red
    FATAL: "\x1b[35m",  // magenta
  };
  const reset = "\x1b[0m";
  const color = colors[level.toUpperCase()] || reset;

  console.log(
    `${color}[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}${reset}`
  );

  return logEntry;
}

/**
 * Express middleware that logs every incoming request and outgoing response
 */
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  // Attach request ID for tracing
  req.requestId = requestId;

  // Log incoming request
  Log("backend", "INFO", "http-middleware", `Incoming ${req.method} ${req.originalUrl}`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Capture response finish event
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? "ERROR" : "INFO";

    Log("backend", level, "http-middleware", `Response ${res.statusCode} for ${req.method} ${req.originalUrl} (${duration}ms)`, {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get("content-length"),
    });
  });

  next();
}

module.exports = { Log, loggingMiddleware, LOG_LEVELS };
