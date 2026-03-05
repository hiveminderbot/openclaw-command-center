/**
 * Routing Statistics Utilities
 * 
 * LLM routing stats and analytics.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { CONFIG } = require("../config");

const PATHS = CONFIG.paths;

/**
 * Get routing statistics for the specified time window
 * @param {number} hours - Time window in hours (default: 24)
 * @returns {Object} Routing statistics
 */
function getRoutingStats(hours = 24) {
  try {
    const skillDir = path.join(PATHS.skills, "llm_routing");
    const output = execSync(
      `cd "${skillDir}" && python -m llm_routing stats --hours ${hours} --json 2>/dev/null`,
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    return JSON.parse(output);
  } catch (e) {
    // Fallback: read JSONL directly
    try {
      const logFile = path.join(PATHS.state, "routing-log.jsonl");
      if (!fs.existsSync(logFile)) {
        return { total_requests: 0, by_model: {}, by_task_type: {} };
      }

      const cutoff = Date.now() - hours * 3600 * 1000;
      const lines = fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);

      const stats = {
        total_requests: 0,
        by_model: {},
        by_task_type: {},
        escalations: 0,
        avg_latency_ms: 0,
        success_rate: 0,
      };

      let latencies = [];
      let successes = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const ts = new Date(entry.timestamp).getTime();
          if (ts < cutoff) continue;

          stats.total_requests++;

          // By model
          const model = entry.selected_model || "unknown";
          stats.by_model[model] = (stats.by_model[model] || 0) + 1;

          // By task type
          const tt = entry.task_type || "unknown";
          stats.by_task_type[tt] = (stats.by_task_type[tt] || 0) + 1;

          if (entry.escalation_reason) stats.escalations++;
          if (entry.latency_ms) latencies.push(entry.latency_ms);
          if (entry.success === true) successes++;
        } catch {}
      }

      if (latencies.length > 0) {
        stats.avg_latency_ms = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      }
      if (stats.total_requests > 0) {
        stats.success_rate = Math.round((successes / stats.total_requests) * 100);
      }

      return stats;
    } catch (e2) {
      console.error("Failed to read routing stats:", e2.message);
      return { error: e2.message };
    }
  }
}

module.exports = {
  getRoutingStats,
};
