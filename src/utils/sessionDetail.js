/**
 * Session Detail Utilities
 * 
 * Detailed session information and transcript analysis.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { CONFIG } = require("../config");

const PATHS = CONFIG.paths;

/**
 * Run an OpenClaw CLI command
 */
function runOpenClaw(cmd) {
  const openclawCmd = process.env.OPENCLAW_BIN || "openclaw";
  return execSync(`${openclawCmd} ${cmd}`, {
    encoding: "utf8",
    timeout: 30000,
  });
}

/**
 * Extract JSON from command output
 */
function extractJSON(output) {
  const match = output.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Read transcript from JSONL file
 */
function readTranscript(sessionId) {
  try {
    const transcriptPath = path.join(PATHS.memory, ".transcripts", `${sessionId}.jsonl`);
    if (!fs.existsSync(transcriptPath)) {
      return [];
    }

    const content = fs.readFileSync(transcriptPath, "utf8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

/**
 * Get detailed information about a specific session
 * @param {string} sessionKey - The session key
 * @returns {Object} Session detail information
 */
function getSessionDetail(sessionKey) {
  try {
    // Get basic session info
    const listOutput = runOpenClaw("sessions list --json 2>/dev/null");
    let sessionInfo = null;
    const jsonStr = extractJSON(listOutput);
    if (jsonStr) {
      const data = JSON.parse(jsonStr);
      sessionInfo = data.sessions?.find((s) => s.key === sessionKey);
    }

    if (!sessionInfo) {
      return { error: "Session not found" };
    }

    // Read transcript directly from JSONL file
    const transcript = readTranscript(sessionInfo.sessionId);
    let messages = [];
    let tools = {};
    let facts = [];
    let needsAttention = [];

    // Aggregate token usage from transcript
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;
    let detectedModel = sessionInfo.model || null;

    // Process transcript entries
    transcript.forEach((entry) => {
      if (entry.type !== "message" || !entry.message) return;

      const msg = entry.message;
      if (!msg.role) return;

      // Extract token usage from messages
      if (msg.usage) {
        totalInputTokens += msg.usage.input || msg.usage.inputTokens || 0;
        totalOutputTokens += msg.usage.output || msg.usage.outputTokens || 0;
        totalCacheRead += msg.usage.cacheRead || msg.usage.cacheReadTokens || 0;
        totalCacheWrite += msg.usage.cacheWrite || msg.usage.cacheWriteTokens || 0;
        if (msg.usage.cost?.total) totalCost += msg.usage.cost.total;
      }

      // Detect model from assistant messages
      if (msg.role === "assistant" && msg.model && !detectedModel) {
        detectedModel = msg.model;
      }

      let text = "";
      if (typeof msg.content === "string") {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textPart = msg.content.find((c) => c.type === "text");
        if (textPart) text = textPart.text || "";

        // Count tool calls
        msg.content
          .filter((c) => c.type === "toolCall" || c.type === "tool_use")
          .forEach((tc) => {
            const name = tc.name || tc.tool || "unknown";
            tools[name] = (tools[name] || 0) + 1;
          });
      }

      if (text && msg.role !== "toolResult") {
        messages.push({ role: msg.role, text, timestamp: entry.timestamp });
      }

      // Extract insights from user messages
      if (msg.role === "user" && text) {
        const lowerText = text.toLowerCase();

        // Look for questions
        if (text.includes("?")) {
          const questions = text.match(/[^.!?\n]*\?/g) || [];
          questions.slice(0, 2).forEach((q) => {
            if (q.length > 15 && q.length < 200) {
              needsAttention.push(`❓ ${q.trim()}`);
            }
          });
        }

        // Look for action items
        if (
          lowerText.includes("todo") ||
          lowerText.includes("remind") ||
          lowerText.includes("need to")
        ) {
          const match = text.match(/(?:todo|remind|need to)[^.!?\n]*/i);
          if (match) needsAttention.push(`📋 ${match[0].slice(0, 100)}`);
        }
      }

      // Extract facts from assistant messages
      if (msg.role === "assistant" && text) {
        const lowerText = text.toLowerCase();

        // Code-related facts
        if (lowerText.includes("```") && lowerText.includes("function")) {
          const codeMatch = text.match(/```[\s\S]*?```/);
          if (codeMatch) {
            const lines = codeMatch[0].split("\n").filter((l) => l.trim() && !l.startsWith("```"));
            if (lines.length > 0) {
              const funcMatch = lines[0].match(/(?:function|def|const)\s+(\w+)/);
              if (funcMatch) {
                facts.push(`💻 Function defined: ${funcMatch[1]}()`);
              }
            }
          }
        }

        // File operations
        if (lowerText.includes("created") && lowerText.includes("file")) {
          const fileMatch = text.match(/(?:created?|wrote?|saved?)\s+[`']?(\S+\.(?:js|py|md|json|yaml|yml|txt))[`']?/i);
          if (fileMatch) {
            facts.push(`📝 File: ${fileMatch[1]}`);
          }
        }

        // Configuration changes
        if (lowerText.includes("config") || lowerText.includes("setting")) {
          const configMatch = text.match(/(?:updated?|changed?|modified?)\s+(\w+)\s+(?:config|setting)/i);
          if (configMatch) {
            facts.push(`⚙️ Config: ${configMatch[1]}`);
          }
        }
      }
    });

    // Deduplicate and limit insights
    needsAttention = [...new Set(needsAttention)].slice(0, 5);
    facts = [...new Set(facts)].slice(0, 5);

    // Sort tools by usage
    const topTools = Object.entries(tools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Get recent messages (last 50 for preview)
    const recentMessages = messages.slice(-50);

    return {
      key: sessionKey,
      sessionId: sessionInfo.sessionId,
      label: sessionInfo.label,
      channel: sessionInfo.channel,
      model: detectedModel || sessionInfo.model || "unknown",
      active: sessionInfo.active || false,
      startTime: sessionInfo.startTime,
      minutesAgo: sessionInfo.minutesAgo,

      // Token usage (from transcript aggregation)
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        cacheRead: totalCacheRead,
        cacheWrite: totalCacheWrite,
        total: totalInputTokens + totalOutputTokens + totalCacheRead + totalCacheWrite,
        cost: totalCost,
      },

      // Tool usage
      tools: topTools,
      toolCount: Object.keys(tools).length,

      // Messages
      messageCount: messages.length,
      recentMessages,

      // Insights
      needsAttention: needsAttention.length > 0 ? needsAttention : null,
      facts: facts.length > 0 ? facts : null,

      // Full transcript available
      hasTranscript: transcript.length > 0,
      transcriptEntryCount: transcript.length,
    };
  } catch (e) {
    console.error("Failed to get session detail:", e.message);
    return { error: e.message };
  }
}

module.exports = {
  getSessionDetail,
  readTranscript,
};
