/**
 * Action Execution Utilities
 */

const { execSync } = require("child_process");
const { getOpenClawDir } = require("../config");

function runOpenClaw(args) {
  const profile = process.env.OPENCLAW_PROFILE || "";
  const profileFlag = profile ? ` --profile ${profile}` : "";
  try {
    return execSync(`openclaw${profileFlag} ${args}`, {
      encoding: "utf8",
      timeout: 3000,
      env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
    });
  } catch (e) {
    return null;
  }
}

function executeAction(action) {
  const results = { success: false, action, output: "", error: null };

  try {
    switch (action) {
      case "gateway-status":
        results.output = runOpenClaw("gateway status 2>&1") || "Unknown";
        results.success = true;
        break;

      case "gateway-restart":
        results.output = "To restart gateway, run: openclaw gateway restart";
        results.success = true;
        results.note = "Dashboard cannot restart gateway for safety";
        break;

      case "sessions-list":
        results.output = runOpenClaw("sessions list 2>&1") || "No sessions";
        results.success = true;
        break;

      case "cron-list":
        results.output = runOpenClaw("cron list 2>&1") || "No cron jobs";
        results.success = true;
        break;

      case "health-check": {
        const gateway = runOpenClaw("gateway status 2>&1");
        const sessions = runOpenClaw("sessions list --json 2>&1");
        let sessionCount = 0;
        try {
          const data = JSON.parse(sessions);
          sessionCount = data.sessions?.length || 0;
        } catch (e) {}

        results.output = [
          `Gateway: ${gateway?.includes("running") ? "✅ Running" : "❌ Not running"}`,
          `Sessions: ${sessionCount}`,
          `Dashboard: ✅ Running`,
        ].join("\n");
        results.success = true;
        break;
      }

      case "clear-stale-sessions": {
        const staleOutput = runOpenClaw("sessions list --json 2>&1");
        let staleCount = 0;
        try {
          const jsonStr = staleOutput?.slice(staleOutput.search(/[[{]/));
          if (jsonStr) {
            const data = JSON.parse(jsonStr);
            staleCount = (data.sessions || []).filter((s) => s.ageMs > 24 * 60 * 60 * 1000).length;
          }
        } catch (e) {}
        results.output = `Found ${staleCount} stale sessions (>24h old).\nTo clean: openclaw sessions prune`;
        results.success = true;
        break;
      }

      default:
        results.error = `Unknown action: ${action}`;
    }
  } catch (e) {
    results.error = e.message;
  }

  return results;
}

module.exports = { executeAction, runOpenClaw };
