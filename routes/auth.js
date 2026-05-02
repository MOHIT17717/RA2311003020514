// routes/auth.js - Registration & Authentication routes
// Handles interaction with the test server for OAuth-like flow

const express = require("express");
const axios = require("axios");
const { Log } = require("../middleware/logger");

const router = express.Router();
const TEST_SERVER = process.env.TEST_SERVER_URL || "http://20.244.56.144/test";

/**
 * POST /api/auth/register
 * Register with the test server to get clientID and clientSecret
 */
router.post("/register", async (req, res) => {
  try {
    const { companyName, ownerName, rollNo, ownerEmail, accessCode } = req.body;

    // Validate required fields
    if (!companyName || !ownerName || !rollNo || !ownerEmail || !accessCode) {
      Log("backend", "WARN", "auth-service", "Registration failed - missing required fields");
      return res.status(400).json({
        success: false,
        error: "All fields are required: companyName, ownerName, rollNo, ownerEmail, accessCode",
      });
    }

    Log("backend", "INFO", "auth-service", `Registration attempt for ${ownerName} (${rollNo})`);

    const payload = {
      companyName,
      ownerName,
      rollNo,
      ownerEmail,
      accessCode,
    };

    const response = await axios.post(`${TEST_SERVER}/register`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    Log("backend", "INFO", "auth-service", "Registration successful", {
      clientID: response.data.clientID,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: response.data,
    });
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    Log("backend", "ERROR", "auth-service", `Registration failed: ${errMsg}`, {
      statusCode: error.response?.status,
    });

    res.status(error.response?.status || 500).json({
      success: false,
      error: errMsg,
    });
  }
});

/**
 * POST /api/auth/token
 * Authenticate using clientID + clientSecret to get Bearer token
 */
router.post("/token", async (req, res) => {
  try {
    const { companyName, clientID, clientSecret, ownerName, ownerEmail, rollNo } = req.body;

    if (!companyName || !clientID || !clientSecret) {
      Log("backend", "WARN", "auth-service", "Token request failed - missing credentials");
      return res.status(400).json({
        success: false,
        error: "companyName, clientID, and clientSecret are required",
      });
    }

    Log("backend", "INFO", "auth-service", `Token request for company: ${companyName}`);

    const payload = {
      companyName,
      clientID,
      clientSecret,
      ownerName: ownerName || process.env.OWNER_NAME,
      ownerEmail: ownerEmail || process.env.OWNER_EMAIL,
      rollNo: rollNo || process.env.ROLL_NO,
    };

    const response = await axios.post(`${TEST_SERVER}/auth`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    const tokenData = response.data;

    Log("backend", "INFO", "auth-service", "Token obtained successfully", {
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
    });

    res.json({
      success: true,
      message: "Authentication successful",
      data: {
        token_type: tokenData.token_type,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
      },
    });
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    Log("backend", "ERROR", "auth-service", `Authentication failed: ${errMsg}`);

    res.status(error.response?.status || 500).json({
      success: false,
      error: errMsg,
    });
  }
});

/**
 * GET /api/auth/status
 * Check current auth status
 */
router.get("/status", (req, res) => {
  const hasToken = !!process.env.ACCESS_TOKEN;

  Log("backend", "INFO", "auth-service", `Auth status check - token present: ${hasToken}`);

  res.json({
    success: true,
    authenticated: hasToken,
    server: TEST_SERVER,
  });
});

module.exports = router;
