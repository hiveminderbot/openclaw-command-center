/**
 * Subagent Utilities
 */

const { runOpenClaw, extractJSON } = require("./sessions");

function getSubagentStatus() {
  const subagents = [];
  
  try {
    const output = runOpenClaw("sessions list --json 2>/dev/null");
    const jsonStr = extractJSON(output);
    if (jsonStr) {
      const data = JSON.parse(jsonStr);
      const subagentSessions = (data.sessions || []).filter(
        (s) => s.key && s.key.includes(":subagent:")
      );

      for (const s of subagentSessions) {
        const ageMs = s.ageMs || Infinity;
        const isActive = ageMs < 5 * 60 * 1000;
        const isRecent = ageMs < 30 * 60 * 1000;

        const match = s.key.match(/:subagent:([a-f0-9-]+)$/);
        const subagentId = match ? match[1] : s.sessionId;
        const shortId = subagentId.slice(0, 8);

        subagents.push({
          id: subagentId,
          shortId,
          sessionId: s.sessionId,
          label: shortId,
          task: s.displayName || "Sub-agent task",
          model: s.model?.replace("anthropic/", "") || "unknown",
          status: isActive ? "active" : isRecent ? "idle" : "stale",
          ageMs,
          ageFormatted:
            ageMs < 60000
              ? "Just now"
              : ageMs < 3600000
              ? `${Math.round(ageMs / 60000)}m ago`
              : `${Math.round(ageMs / 3600000)}h ago`,
          messageCount: 0,
          tokens: s.totalTokens || 0,
        });
      }
    }
  } catch (e) {
    console.error("Failed to get subagent status:", e.message);
  }

  return subagents.sort((a, b) => a.ageMs - b.ageMs);
}

module.exports = { getSubagentStatus };
