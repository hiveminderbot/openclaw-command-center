/**
 * Sessions Utilities
 */

const { execSync } = require("child_process");
const { getOpenClawDir } = require("../config");
const fs = require("fs");
const path = require("path");

// Cache for sessions
let sessionsCache = { sessions: [], timestamp: 0, refreshing: false };
const SESSIONS_CACHE_TTL = 10000; // 10 seconds

function extractJSON(output) {
  if (!output) return null;
  const jsonStart = output.search(/[[{]/);
  if (jsonStart === -1) return null;
  return output.slice(jsonStart);
}

function runOpenClaw(args) {
  const profile = process.env.OPENCLAW_PROFILE || "";
  const profileFlag = profile ? ` --profile ${profile}` : "";
  try {
    return execSync(`openclaw${profileFlag} ${args}`, {
      encoding: "utf8",
      timeout: 3000,
      env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return null;
  }
}

function parseSessionLabel(key) {
  if (key.includes("slack")) {
    const parts = key.split(":");
    const channelIdx = parts.indexOf("channel");
    if (channelIdx >= 0 && parts[channelIdx + 1]) {
      return `#${parts[channelIdx + 1]}`;
    }
    return "Slack";
  }
  if (key.includes("telegram")) return "📱 Telegram";
  if (key === "agent:main:main") return "🏠 Main Session";
  return key.length > 40 ? key.slice(0, 37) + "..." : key;
}

function mapSession(s) {
  const minutesAgo = s.ageMs ? s.ageMs / 60000 : Infinity;
  
  let channel = "other";
  if (s.key.includes("slack")) channel = "slack";
  else if (s.key.includes("telegram")) channel = "telegram";
  else if (s.key.includes("discord")) channel = "discord";

  let sessionType = "channel";
  if (s.key.includes(":subagent:")) sessionType = "subagent";
  else if (s.key.includes(":cron:")) sessionType = "cron";
  else if (s.key === "agent:main:main") sessionType = "main";

  return {
    sessionKey: s.key,
    sessionId: s.sessionId,
    label: s.groupChannel || s.displayName || parseSessionLabel(s.key),
    groupChannel: s.groupChannel || null,
    displayName: s.displayName || null,
    kind: s.kind,
    channel: channel,
    sessionType: sessionType,
    active: minutesAgo < 15,
    recentlyActive: minutesAgo < 60,
    minutesAgo: Math.round(minutesAgo),
    tokens: s.totalTokens || 0,
    model: s.model,
    originator: null, // Simplified
    topic: null,
    metrics: {
      burnRate: Math.round((s.totalTokens || 0) / Math.max(1, Math.round(minutesAgo))),
      toolCalls: 0,
      minutesActive: Math.max(1, Math.min(Math.round(minutesAgo), 24 * 60)),
    },
  };
}

function getSessions(options = {}) {
  const limit = options.limit !== undefined ? options.limit : 20;

  try {
    const output = runOpenClaw("sessions list --json 2>/dev/null");
    const jsonStr = extractJSON(output);
    if (jsonStr) {
      const data = JSON.parse(jsonStr);
      let sessions = data.sessions || [];
      if (limit != null) {
        sessions = sessions.slice(0, limit);
      }
      return sessions.map((s) => mapSession(s));
    }
  } catch (e) {
    console.error("Failed to get sessions:", e.message);
  }
  return [];
}

module.exports = { getSessions, runOpenClaw, extractJSON };
