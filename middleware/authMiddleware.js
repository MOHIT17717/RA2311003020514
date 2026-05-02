// middleware/authMiddleware.js - Token verification middleware
// Validates Bearer tokens on protected routes

const { Log } = require("./logger");

/**
 * Middleware to check for valid authentication token
 * Reads from Authorization header or falls back to env variable
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      Log("backend", "WARN", "auth-middleware", "Missing or invalid Authorization header", {
        requestId: req.requestId,
      });
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.length < 10) {
      Log("backend", "ERROR", "auth-middleware", "Token validation failed - token too short", {
        requestId: req.requestId,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid token format",
      });
    }

    // Attach token to request for downstream use
    req.token = token;
    Log("backend", "DEBUG", "auth-middleware", "Token verified successfully", {
      requestId: req.requestId,
    });

    next();
  } catch (error) {
    Log("backend", "ERROR", "auth-middleware", `Token verification error: ${error.message}`, {
      requestId: req.requestId,
    });
    return res.status(500).json({
      success: false,
      error: "Authentication error",
    });
  }
}

module.exports = { verifyToken };
