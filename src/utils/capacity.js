/**
 * Capacity Utilities
 */

const fs = require("fs");
const path = require("path");
const { getOpenClawDir } = require("../config");

function getCapacity() {
  const result = {
    main: { active: 0, max: 12 },
    subagent: { active: 0, max: 24 },
  };

  const openclawDir = getOpenClawDir();

  // Read max capacity from config
  try {
    const configPath = path.join(openclawDir, "openclaw.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config?.agents?.defaults?.maxConcurrent) {
        result.main.max = config.agents.defaults.maxConcurrent;
      }
      if (config?.agents?.defaults?.subagents?.maxConcurrent) {
        result.subagent.max = config.agents.defaults.subagents.maxConcurrent;
      }
    }
  } catch (e) {
    // Fall back to defaults
  }

  return result;
}

module.exports = { getCapacity };
