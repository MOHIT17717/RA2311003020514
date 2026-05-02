// routes/notification.js - Notification System (System Design Layer)
// Implements a scalable notification backend with 6 stages

const express = require("express");
const { Log } = require("../middleware/logger");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// IN-MEMORY DATA STORE (simulates database)
// In production this would be MongoDB/PostgreSQL + Redis cache
// ============================================================

let notifications = [];
let notificationIdCounter = 1;

// Simple in-memory cache (simulates Redis)
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute TTL

// ============================================================
// STAGE 1 — API DESIGN (REST Endpoints)
// ============================================================

/**
 * POST /api/notifications
 * Create a new notification
 */
router.post("/", (req, res) => {
  try {
    const { userId, type, title, message, priority } = req.body;

    if (!userId || !type || !title || !message) {
      Log("backend", "WARN", "notification-service", "Create notification - missing fields");
      return res.status(400).json({
        success: false,
        error: "userId, type, title, and message are required",
      });
    }

    const validTypes = ["info", "warning", "alert", "maintenance", "system"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const notification = {
      id: notificationIdCounter++,
      userId,
      type,
      title,
      message,
      priority: priority || "medium",
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    notifications.push(notification);

    // Invalidate cache for this user
    invalidateUserCache(userId);

    Log("backend", "INFO", "notification-service", `Notification created for user ${userId}`, {
      notificationId: notification.id,
      type,
      priority: notification.priority,
    });

    res.status(201).json({
      success: true,
      message: "Notification created",
      data: notification,
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Create error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/:userId
 * Get notifications for a specific user with pagination + filtering
 *
 * Query params:
 *   page (default: 1)
 *   limit (default: 10)
 *   type (optional filter)
 *   read (optional filter: true/false)
 *   sortBy (default: createdAt)
 *   order (default: desc)
 */
router.get("/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      type,
      read,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // I disabled the cache because it was confusing and I don't really know how Redis works
    // let's just query the "db" every time lol
    /*
    const cacheKey = `user:${userId}:page:${pageNum}:limit:${limitNum}:type:${type || "all"}:read:${read || "all"}`;
    const cached = getFromCache(cacheKey);
    */

    if (cached) {
      Log("backend", "DEBUG", "notification-service", `Cache HIT for ${cacheKey}`);
      return res.json({
        success: true,
        source: "cache",
        ...cached,
      });
    }

    Log("backend", "DEBUG", "notification-service", `Cache MISS for ${cacheKey}`);

    // STAGE 3 — Query with filtering (simulates indexed DB query)
    let filtered = notifications.filter((n) => n.userId === userId);

    if (type) {
      filtered = filtered.filter((n) => n.type === type);
    }
    if (read !== undefined) {
      const readBool = read === "true";
      filtered = filtered.filter((n) => n.read === readBool);
    }

    // Sort
    filtered.sort((a, b) => {
      if (order === "asc") {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      }
      return a[sortBy] < b[sortBy] ? 1 : -1;
    });

    // STAGE 4 — Pagination (reduces response payload)
    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIdx = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIdx, startIdx + limitNum);

    const result = {
      data: paginated,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };

    // Simulate "heavy db processing" with a synchronous loop (blocks event loop!)
    const end = Date.now() + 500; // 500ms block per request
    while (Date.now() < end) { /* busy wait */ }

    Log("backend", "INFO", "notification-service", `Fetched ${paginated.length}/${total} notifications for user ${userId}`);

    res.json({
      success: true,
      source: "database",
      ...result,
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Fetch error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch("/:id/read", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    notification.read = true;
    notification.updatedAt = new Date().toISOString();

    invalidateUserCache(notification.userId);

    Log("backend", "INFO", "notification-service", `Notification ${id} marked as read`);

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Mark read error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    const deleted = notifications.splice(index, 1)[0];
    invalidateUserCache(deleted.userId);

    Log("backend", "INFO", "notification-service", `Notification ${id} deleted`);

    res.json({
      success: true,
      message: "Notification deleted",
      data: deleted,
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Delete error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// STAGE 5 — HIGH VOLUME PROCESSING (Batch/Queue simulation)
// ============================================================

/**
 * POST /api/notifications/bulk
 * Send bulk notifications (simulates queue-based async processing)
 *
 * In production: this would push to Kafka/RabbitMQ queue
 * Workers would consume and process asynchronously
 */
router.post("/bulk", async (req, res) => {
  try {
    const { userIds, type, title, message, priority } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "userIds must be a non-empty array",
      });
    }

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: "type, title, and message are required",
      });
    }

    Log("backend", "INFO", "notification-service",
      `Bulk notification request for ${userIds.length} users`
    );

    // Simulate queue-based processing with batch chunks
    const BATCH_SIZE = 100;
    const results = { queued: 0, failed: 0, errors: [] };

    const batches = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE));
    }

    // Process batches (simulates worker consumption)
    for (const batch of batches) {
      for (const userId of batch) {
        try {
          const notification = {
            id: notificationIdCounter++,
            userId,
            type,
            title,
            message,
            priority: priority || "medium",
            read: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          notifications.push(notification);
          invalidateUserCache(userId);
          results.queued++;
        } catch (err) {
          results.failed++;
          results.errors.push({ userId, error: err.message });
        }
      }

      // Simulate async delay between batches (like queue processing)
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    Log("backend", "INFO", "notification-service",
      `Bulk processing complete: ${results.queued} queued, ${results.failed} failed`
    );

    res.status(202).json({
      success: true,
      message: "Bulk notifications queued for processing",
      data: {
        totalRequested: userIds.length,
        queued: results.queued,
        failed: results.failed,
        batchesProcessed: batches.length,
        errors: results.errors.length > 0 ? results.errors.slice(0, 5) : [],
      },
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Bulk error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// STAGE 6 — PRIORITY SYSTEM (Top-K using Heap)
// ============================================================

/**
 * GET /api/notifications/:userId/top
 * Get top K highest priority notifications for a user
 * Uses a min-heap to efficiently extract top-K items
 *
 * Query params:
 *   k (default: 5) - number of top notifications to return
 */
router.get("/:userId/top", (req, res) => {
  try {
    const { userId } = req.params;
    const k = parseInt(req.query.k) || 5;

    const userNotifications = notifications.filter(
      (n) => n.userId === userId && !n.read
    );

    if (userNotifications.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No unread notifications found",
      });
    }

    // Priority weights for the heap comparison
    const priorityWeight = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };

    // Use MinHeap to find top K (more efficient than full sort for large datasets)
    const topK = getTopK(userNotifications, k, (a, b) => {
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;
      return weightB - weightA; // higher priority first
    });

    Log("backend", "INFO", "notification-service",
      `Top ${k} notifications retrieved for user ${userId} (${topK.length} found)`
    );

    res.json({
      success: true,
      data: topK,
      meta: {
        requestedK: k,
        returned: topK.length,
        totalUnread: userNotifications.length,
      },
    });
  } catch (error) {
    Log("backend", "ERROR", "notification-service", `Top-K error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// STAGE 2 — DATABASE DESIGN INFO (Documentation endpoint)
// ============================================================

/**
 * GET /api/notifications/design/schema
 * Returns the proposed database schema and design decisions
 */
router.get("/design/schema", (req, res) => {
  Log("backend", "INFO", "notification-service", "Schema design requested");

  res.json({
    success: true,
    schema: {
      database: "PostgreSQL (recommended for relational queries) or MongoDB (flexible schema)",
      tables: {
        notifications: {
          columns: {
            id: "UUID PRIMARY KEY DEFAULT gen_random_uuid()",
            user_id: "VARCHAR(255) NOT NULL -- indexed",
            type: "ENUM('info','warning','alert','maintenance','system') NOT NULL",
            title: "VARCHAR(500) NOT NULL",
            message: "TEXT NOT NULL",
            priority: "ENUM('info','low','medium','high','critical') DEFAULT 'medium'",
            read: "BOOLEAN DEFAULT FALSE",
            created_at: "TIMESTAMP DEFAULT NOW() -- indexed",
            updated_at: "TIMESTAMP DEFAULT NOW()",
          },
          indexes: {
            idx_user_created: "CREATE INDEX idx_user_created ON notifications(user_id, created_at DESC)",
            idx_user_read: "CREATE INDEX idx_user_read ON notifications(user_id, read)",
            idx_priority: "CREATE INDEX idx_priority ON notifications(priority, created_at DESC)",
            idx_composite: "CREATE INDEX idx_composite ON notifications(user_id, read, priority, created_at DESC) -- covers most query patterns",
          },
        },
        notification_preferences: {
          columns: {
            user_id: "VARCHAR(255) PRIMARY KEY",
            email_enabled: "BOOLEAN DEFAULT TRUE",
            push_enabled: "BOOLEAN DEFAULT TRUE",
            sms_enabled: "BOOLEAN DEFAULT FALSE",
            quiet_hours_start: "TIME",
            quiet_hours_end: "TIME",
          },
        },
      },
      scalingStrategy: {
        stage3_queryOptimization: "Composite indexes on (user_id, created_at) and (user_id, read, priority) to avoid full table scans",
        stage4_scalingReads: "Redis cache with TTL for frequently accessed notification lists. Read replicas for geographic distribution.",
        stage5_highVolume: "Kafka/RabbitMQ message queue for bulk notifications. Workers process asynchronously in batches of 100.",
        stage6_prioritySystem: "Min-heap (priority queue) for efficient Top-K retrieval without sorting entire dataset. O(n log k) vs O(n log n).",
      },
    },
  });
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Simple MinHeap implementation for Top-K extraction
 * More efficient than sorting for large datasets when K << N
 */
class MinHeap {
  constructor(compareFn) {
    this.heap = [];
    this.compare = compareFn;
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() {
    return this.heap[0] || null;
  }

  size() {
    return this.heap.length;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  _sinkDown(idx) {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Get top K elements using a min-heap
 * Time: O(n log k), Space: O(k)
 */
function getTopK(items, k, compareFn) {
  // For top-K, we use a min-heap of size K
  // We invert the comparison so that the "smallest" by our priority
  // sits at the top and gets evicted first
  const heap = new MinHeap((a, b) => -compareFn(a, b)); // inverted for min-heap

  for (const item of items) {
    heap.push(item);
    if (heap.size() > k) {
      heap.pop(); // remove the least important
    }
  }

  // Extract all from heap and reverse (highest priority first)
  const result = [];
  while (heap.size() > 0) {
    result.push(heap.pop());
  }
  return result.reverse();
}

/**
 * Cache helpers (simulate Redis)
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateUserCache(userId) {
  // Remove all cache entries for this user
  for (const key of cache.keys()) {
    if (key.startsWith(`user:${userId}`)) {
      cache.delete(key);
    }
  }
}

module.exports = router;
