/**
 * System Vitals Utilities
 * 
 * Platform-specific system information gathering.
 */

const { execSync } = require("child_process");
const os = require("os");

let cachedVitals = null;
let lastVitalsUpdate = 0;
const VITALS_CACHE_TTL = 30000; // 30 seconds

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getSystemVitals() {
  const now = Date.now();
  
  // Return cached if fresh
  if (cachedVitals && now - lastVitalsUpdate < VITALS_CACHE_TTL) {
    return cachedVitals;
  }

  const isLinux = process.platform === "linux";
  const isMacOS = process.platform === "darwin";

  const vitals = {
    hostname: os.hostname(),
    uptime: "—",
    cpu: { loadAvg: [0, 0, 0], cores: os.cpus().length, usage: 0 },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      pressure: "normal",
    },
    disk: { used: 0, free: 0, total: 0, percent: 0 },
    temperature: null,
  };

  // Calculate memory pressure
  if (vitals.memory.percent > 90) vitals.memory.pressure = "critical";
  else if (vitals.memory.percent > 75) vitals.memory.pressure = "warning";

  // Add formatted versions
  vitals.memory.usedFormatted = formatBytes(vitals.memory.used);
  vitals.memory.totalFormatted = formatBytes(vitals.memory.total);
  vitals.memory.freeFormatted = formatBytes(vitals.memory.free);
  vitals.disk.usedFormatted = "-";
  vitals.disk.totalFormatted = "-";
  vitals.disk.freeFormatted = "-";

  // Try to get uptime
  try {
    const uptimeRaw = execSync("uptime", { encoding: "utf8" });
    const match = uptimeRaw.match(/up\s+([^,]+)/);
    if (match) vitals.uptime = match[1].trim();
    
    const loadMatch = uptimeRaw.match(/load averages?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (loadMatch) {
      vitals.cpu.loadAvg = [
        parseFloat(loadMatch[1]),
        parseFloat(loadMatch[2]),
        parseFloat(loadMatch[3]),
      ];
    }
  } catch (e) {
    // Ignore
  }

  // Try to get disk usage
  try {
    const dfRaw = execSync("df -k ~ | tail -1", { encoding: "utf8" });
    const dfParts = dfRaw.trim().split(/\s+/);
    if (dfParts.length >= 4) {
      vitals.disk.total = parseInt(dfParts[1], 10) * 1024;
      vitals.disk.used = parseInt(dfParts[2], 10) * 1024;
      vitals.disk.free = parseInt(dfParts[3], 10) * 1024;
      vitals.disk.percent = Math.round((parseInt(dfParts[2], 10) / parseInt(dfParts[1], 10)) * 100);
      vitals.disk.usedFormatted = formatBytes(vitals.disk.used);
      vitals.disk.totalFormatted = formatBytes(vitals.disk.total);
      vitals.disk.freeFormatted = formatBytes(vitals.disk.free);
    }
  } catch (e) {
    // Ignore
  }

  cachedVitals = vitals;
  lastVitalsUpdate = now;
  return vitals;
}

module.exports = { getSystemVitals, formatBytes };
