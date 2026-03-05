/**
 * LLM Usage Utilities
 */

const fs = require("fs");
const path = require("path");
const { CONFIG } = require("../config");

function getLlmUsage() {
  // Return a placeholder structure
  // Full implementation would read from state files
  return {
    timestamp: new Date().toISOString(),
    source: "file",
    claude: {
      session: { usedPct: 0, remainingPct: 100, resetsIn: "?" },
      weekly: { usedPct: 0, remainingPct: 100, resets: "?" },
      sonnet: { usedPct: 0, remainingPct: 100, resets: "?" },
      lastSynced: null,
    },
    codex: { sessionsToday: 0, tasksToday: 0, usage5hPct: 0, usageDayPct: 0 },
    routing: { total: 0, claudeTasks: 0, codexTasks: 0, claudePct: 0, codexPct: 0, codexFloor: 20 },
  };
}

module.exports = { getLlmUsage };
