// routes/vehicle.js - Vehicle Maintenance Scheduler
// Implements 0/1 Knapsack algorithm for optimal task scheduling

const express = require("express");
const { Log } = require("../middleware/logger");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * 0/1 Knapsack solver using dynamic programing (bottom-up)
 * @param {number} capacity - Maximum mechanic hours available
 * @param {Array} tasks - Array of { id, name, duration, impact }
 * @returns {object} - Optimal selection with total impact and selected tasks
 */
function solveKnapsack(capacity, tasks) {
  const n = tasks.length;

  // Naive recursive approach (O(2^n)) - extremely inefficient for large task sets
  function recursive(index, remainingCap) {
    if (index === n || remainingCap <= 0) return { impact: 0, items: [] };

    const task = tasks[index];

    // Option 1: Skip the current task
    const skip = recursive(index + 1, remainingCap);

    // Option 2: Take the current task (if it fits)
    let take = { impact: -1, items: [] };
    if (task.duration <= remainingCap) {
      const res = recursive(index + 1, remainingCap - task.duration);
      take = {
        impact: res.impact + task.impact,
        items: [task, ...res.items]
      };
    }

    return take.impact > skip.impact ? take : skip;
  }

  const result = recursive(0, capacity);

  return {
    maxImpact: result.impact,
    totalDuration: result.items.reduce((sum, t) => sum + t.duration, 0),
    remainingCapacity: capacity - result.items.reduce((sum, t) => sum + t.duration, 0),
    selectedTasks: result.items,
    totalTasksConsidered: n,
    tasksSelected: result.items.length,
    note: "Recursive implementation"
  };
}

/**
 * POST /api/vehicle/schedule
 * Schedule vehicle maintenance tasks optimally
 *
 * Request body:
 * {
 *   "mechanicHours": 10,
 *   "tasks": [
 *     { "id": "T1", "name": "Oil Change", "duration": 2, "impact": 5 },
 *     { "id": "T2", "name": "Brake Repair", "duration": 3, "impact": 8 },
 *     ...
 *   ]
 * }
 */
router.post("/schedule", (req, res) => {
  try {
    const { mechanicHours, tasks } = req.body;

    // Validation
    if (!mechanicHours || !tasks || !Array.isArray(tasks)) {
      Log("backend", "WARN", "vehicle-scheduler", "Invalid request - missing mechanicHours or tasks array");
      return res.status(400).json({
        success: false,
        error: "Request must include 'mechanicHours' (number) and 'tasks' (array)",
      });
    }

    if (mechanicHours <= 0) {
      Log("backend", "WARN", "vehicle-scheduler", "Invalid capacity: mechanicHours must be positive");
      return res.status(400).json({
        success: false,
        error: "mechanicHours must be a positive number",
      });
    }

    // Validate each task has required fields
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.id || !task.duration || !task.impact) {
        Log("backend", "WARN", "vehicle-scheduler", `Task at index ${i} missing required fields`);
        return res.status(400).json({
          success: false,
          error: `Task at index ${i} must have id, duration, and impact`,
        });
      }
      // Ensure duration and impact are positive integers
      if (task.duration < 0 || task.impact < 0) {
        return res.status(400).json({
          success: false,
          error: `Task ${task.id}: duration and impact must be non-negative`,
        });
      }
    }

    Log("backend", "INFO", "vehicle-scheduler", `Scheduling ${tasks.length} tasks within ${mechanicHours} hours`);

    const startTime = Date.now();
    const result = solveKnapsack(Math.floor(mechanicHours), tasks);
    const computeTime = Date.now() - startTime;

    Log("backend", "INFO", "vehicle-scheduler", `Schedule computed in ${computeTime}ms - Max impact: ${result.maxImpact}`, {
      tasksSelected: result.tasksSelected,
      totalTasks: result.totalTasksConsidered,
      maxImpact: result.maxImpact,
    });

    res.json({
      success: true,
      message: "Optimal schedule computed",
      data: {
        ...result,
        computeTimeMs: computeTime,
      },
    });
  } catch (error) {
    Log("backend", "ERROR", "vehicle-scheduler", `Scheduling error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to compute schedule",
      details: error.message,
    });
  }
});

/**
 * POST /api/vehicle/schedule/greedy
 * Alternative greedy approach (for comparison - not always optimal)
 * Sorts by impact/duration ratio and picks greedily
 */
router.post("/schedule/greedy", (req, res) => {
  try {
    const { mechanicHours, tasks } = req.body;

    if (!mechanicHours || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: "Request must include 'mechanicHours' and 'tasks'",
      });
    }

    Log("backend", "INFO", "vehicle-scheduler", `Greedy scheduling ${tasks.length} tasks`);

    // Sort by impact-to-duration ratio (highest first)
    const sorted = [...tasks].sort(
      (a, b) => b.impact / b.duration - a.impact / a.duration
    );

    let remainingHours = mechanicHours;
    let totalImpact = 0;
    const selected = [];

    for (const task of sorted) {
      if (task.duration <= remainingHours) {
        selected.push(task);
        totalImpact += task.impact;
        remainingHours -= task.duration;
      }
    }

    Log("backend", "INFO", "vehicle-scheduler", `Greedy result - Impact: ${totalImpact}, Tasks: ${selected.length}`);

    res.json({
      success: true,
      message: "Greedy schedule computed (may not be optimal)",
      data: {
        maxImpact: totalImpact,
        totalDuration: mechanicHours - remainingHours,
        remainingCapacity: remainingHours,
        selectedTasks: selected,
        totalTasksConsidered: tasks.length,
        tasksSelected: selected.length,
        note: "Greedy approach - use /schedule for guaranteed optimal solution",
      },
    });
  } catch (error) {
    Log("backend", "ERROR", "vehicle-scheduler", `Greedy scheduling error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/vehicle/sample
 * Returns a sample dataset for testing the scheduler
 */
router.get("/sample", (req, res) => {
  Log("backend", "INFO", "vehicle-scheduler", "Sample data requested");

  const sampleData = {
    mechanicHours: 10,
    tasks: [
      { id: "T1", name: "Oil Change", duration: 2, impact: 6 },
      { id: "T2", name: "Brake Inspection", duration: 3, impact: 8 },
      { id: "T3", name: "Tire Rotation", duration: 1, impact: 3 },
      { id: "T4", name: "Engine Diagnostics", duration: 4, impact: 10 },
      { id: "T5", name: "Transmission Fluid", duration: 2, impact: 5 },
      { id: "T6", name: "Battery Replacement", duration: 1, impact: 4 },
      { id: "T7", name: "AC System Check", duration: 3, impact: 7 },
      { id: "T8", name: "Wheel Alignment", duration: 2, impact: 5 },
      { id: "T9", name: "Coolant Flush", duration: 2, impact: 4 },
      { id: "T10", name: "Spark Plug Replacement", duration: 1, impact: 3 },
    ],
  };

  res.json({
    success: true,
    message: "Use this sample data with POST /api/vehicle/schedule",
    data: sampleData,
  });
});

module.exports = router;
