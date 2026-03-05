/**
 * Cron Jobs Utilities
 */

const fs = require("fs");
const path = require("path");
const { getOpenClawDir } = require("../config");

function cronToHuman(expr) {
  if (!expr || expr === "—") return null;
  
  const parts = expr.split(" ");
  if (parts.length < 5) return null;

  // Every minute
  if (parts[0] === "*" && parts[1] === "*" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
    return "Every minute";
  }

  // Every X minutes
  if (parts[0].startsWith("*/")) {
    return `Every ${parts[0].slice(2)} minutes`;
  }

  // Hourly
  if (parts[1] === "*" && parts[0] !== "*") {
    return `Hourly at :${parts[0].padStart(2, "0")}`;
  }

  // Daily
  if (parts[0] !== "*" && parts[1] !== "*" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
    const hour = parseInt(parts[1], 10);
    const ampm = hour >= 12 ? "pm" : "am";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const min = parts[0].padStart(2, "0");
    return `Daily at ${h12}:${min}${ampm}`;
  }

  return expr;
}

function getCronJobs() {
  try {
    const cronPath = path.join(getOpenClawDir(), "cron", "jobs.json");
    if (fs.existsSync(cronPath)) {
      const data = JSON.parse(fs.readFileSync(cronPath, "utf8"));
      return (data.jobs || []).map((j) => {
        let scheduleStr = "—";
        let scheduleHuman = null;
        
        if (j.schedule) {
          if (j.schedule.kind === "cron" && j.schedule.expr) {
            scheduleStr = j.schedule.expr;
            scheduleHuman = cronToHuman(j.schedule.expr);
          } else if (j.schedule.kind === "once") {
            scheduleStr = "once";
            scheduleHuman = "One-time";
          }
        }

        let nextRunStr = "—";
        if (j.state?.nextRunAtMs) {
          const next = new Date(j.state.nextRunAtMs);
          const now = new Date();
          const diffMins = Math.round((next - now) / 60000);
          if (diffMins < 0) nextRunStr = "overdue";
          else if (diffMins < 60) nextRunStr = `${diffMins}m`;
          else if (diffMins < 1440) nextRunStr = `${Math.round(diffMins / 60)}h`;
          else nextRunStr = `${Math.round(diffMins / 1440)}d`;
        }

        return {
          id: j.id,
          name: j.name || j.id.slice(0, 8),
          schedule: scheduleStr,
          scheduleHuman: scheduleHuman,
          nextRun: nextRunStr,
          enabled: j.enabled !== false,
          lastStatus: j.state?.lastStatus,
        };
      });
    }
  } catch (e) {
    console.error("Failed to get cron:", e.message);
  }
  return [];
}

module.exports = { getCronJobs, cronToHuman };
