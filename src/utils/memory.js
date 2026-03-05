/**
 * Memory Statistics Utilities
 */

const fs = require("fs");
const path = require("path");
const { CONFIG } = require("../config");
const { formatBytes } = require("./vitals");

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getMemoryStats() {
  const memoryDir = CONFIG.paths.memory;
  const memoryFile = path.join(CONFIG.paths.workspace, "MEMORY.md");

  const stats = {
    totalFiles: 0,
    totalSize: 0,
    totalSizeFormatted: "0 B",
    memoryMdSize: 0,
    memoryMdSizeFormatted: "0 B",
    memoryMdLines: 0,
    recentFiles: [],
    oldestFile: null,
    newestFile: null,
  };

  try {
    // MEMORY.md stats
    if (fs.existsSync(memoryFile)) {
      const memStat = fs.statSync(memoryFile);
      stats.memoryMdSize = memStat.size;
      stats.memoryMdSizeFormatted = formatBytes(memStat.size);
      const content = fs.readFileSync(memoryFile, "utf8");
      stats.memoryMdLines = content.split("\n").length;
      stats.totalSize += memStat.size;
      stats.totalFiles++;
    }

    // Memory directory stats
    if (fs.existsSync(memoryDir)) {
      const files = [];
      
      function collectFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            collectFiles(entryPath);
          } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json"))) {
            const stat = fs.statSync(entryPath);
            files.push({
              name: path.relative(memoryDir, entryPath),
              size: stat.size,
              sizeFormatted: formatBytes(stat.size),
              modified: stat.mtime,
            });
          }
        }
      }

      collectFiles(memoryDir);
      files.sort((a, b) => b.modified - a.modified);

      stats.totalFiles += files.length;
      files.forEach((f) => (stats.totalSize += f.size));
      stats.recentFiles = files.slice(0, 5).map((f) => ({
        name: f.name,
        sizeFormatted: f.sizeFormatted,
        age: formatTimeAgo(f.modified),
      }));

      if (files.length > 0) {
        stats.newestFile = files[0].name;
        stats.oldestFile = files[files.length - 1].name;
      }
    }

    stats.totalSizeFormatted = formatBytes(stats.totalSize);
  } catch (e) {
    console.error("Failed to get memory stats:", e.message);
  }

  return stats;
}

module.exports = { getMemoryStats, formatTimeAgo };
