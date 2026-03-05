/**
 * Routes Index
 * 
 * Aggregates all API routes for the dashboard.
 */

const { getSystemVitals } = require("../utils/vitals");
const { getSessions } = require("../utils/sessions");
const { getTokenStats } = require("../utils/tokens");
const { getCapacity } = require("../utils/capacity");
const { getCronJobs } = require("../utils/cron");
const { getMemoryStats } = require("../utils/memory");
const { getLlmUsage } = require("../utils/llm");
const { getCerebroTopics, updateTopicStatus } = require("../utils/cerebro");
const { getSubagentStatus } = require("../utils/subagents");
const { loadOperators, saveOperators } = require("../utils/operators");
const { loadPrivacySettings, savePrivacySettings } = require("../utils/privacy");
const { executeAction } = require("../utils/actions");
const { getSessionDetail } = require("../utils/sessionDetail");
const { getCostBreakdown } = require("../utils/cost");
const { getRoutingStats } = require("../utils/routing");

/**
 * Create all API routes
 * @param {Object} deps - Dependencies (CONFIG, getOpenClawDir, sseClients, getCachedState)
 * @returns {Object} Route handlers organized by path and method
 */
function createRoutes(deps) {
  const { CONFIG, getOpenClawDir, sseClients, getCachedState } = deps;

  // Helper to send JSON response
  const json = (res, data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data, null, 2));
  };

  // Helper to parse request body
  const parseBody = (req) => new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });

  return {
    // Health check
    "/api/health": {
      GET: (req, res) => {
        json(res, {
          status: "ok",
          port: CONFIG.server.port,
          timestamp: new Date().toISOString(),
        });
      },
    },

    // Main status endpoint
    "/api/status": {
      GET: (req, res) => {
        const sessions = getSessions({ limit: 20 });
        const tokenStats = getTokenStats(sessions);
        const capacity = getCapacity();

        json(res, {
          sessions,
          cron: getCronJobs(),
          system: {
            hostname: require("os").hostname(),
            gateway: "Running", // Simplified
            model: "claude-opus-4-5",
            uptime: "—",
          },
          activity: [], // Simplified
          tokenStats,
          capacity,
          timestamp: new Date().toISOString(),
        });
      },
    },

    // Unified state endpoint
    "/api/state": {
      GET: (req, res) => {
        const state = getCachedState();
        json(res, state);
      },
    },

    // Vitals endpoint
    "/api/vitals": {
      GET: (req, res) => {
        json(res, { vitals: getSystemVitals() });
      },
    },

    // Sessions endpoint
    "/api/sessions": {
      GET: (req, res, query) => {
        const page = parseInt(query.get("page")) || 1;
        const pageSize = parseInt(query.get("pageSize")) || 20;
        const statusFilter = query.get("status");

        const allSessions = getSessions({ limit: null });

        const statusCounts = {
          all: allSessions.length,
          live: allSessions.filter((s) => s.active).length,
          recent: allSessions.filter((s) => !s.active && s.recentlyActive).length,
          idle: allSessions.filter((s) => !s.active && !s.recentlyActive).length,
        };

        let filtered = allSessions;
        if (statusFilter === "live") filtered = allSessions.filter((s) => s.active);
        else if (statusFilter === "recent") filtered = allSessions.filter((s) => !s.active && s.recentlyActive);
        else if (statusFilter === "idle") filtered = allSessions.filter((s) => !s.active && !s.recentlyActive);

        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize);
        const offset = (page - 1) * pageSize;
        const displaySessions = filtered.slice(offset, offset + pageSize);

        json(res, {
          sessions: displaySessions,
          pagination: { page, pageSize, total, totalPages, hasPrev: page > 1, hasNext: page < totalPages },
          statusCounts,
          tokenStats: getTokenStats(allSessions),
          capacity: getCapacity(),
        });
      },
    },

    // Single session detail
    "/api/session": {
      GET: (req, res, query) => {
        const sessionKey = query.get("key");
        if (!sessionKey) {
          return json(res, { error: "Missing session key" }, 400);
        }
        json(res, getSessionDetail(sessionKey));
      },
    },

    // Cron jobs
    "/api/cron": {
      GET: (req, res) => {
        json(res, { cron: getCronJobs() });
      },
    },

    // Capacity
    "/api/capacity": {
      GET: (req, res) => {
        json(res, getCapacity());
      },
    },

    // Memory stats
    "/api/memory": {
      GET: (req, res) => {
        json(res, { memory: getMemoryStats() });
      },
    },

    // LLM usage
    "/api/llm-usage": {
      GET: (req, res) => {
        json(res, getLlmUsage());
      },
    },

    "/api/llm-quota": {
      GET: (req, res) => {
        json(res, getLlmUsage());
      },
    },

    // Cost breakdown
    "/api/cost-breakdown": {
      GET: (req, res) => {
        json(res, getCostBreakdown());
      },
    },

    // Subagents
    "/api/subagents": {
      GET: (req, res) => {
        json(res, { subagents: getSubagentStatus() });
      },
    },

    // Cerebro topics
    "/api/cerebro": {
      GET: (req, res, query) => {
        const offset = parseInt(query.get("offset") || "0", 10);
        const limit = parseInt(query.get("limit") || "20", 10);
        const status = query.get("status") || "all";
        json(res, getCerebroTopics({ offset, limit, status }));
      },
    },

    // Operators
    "/api/operators": {
      GET: (req, res) => {
        const data = loadOperators();
        const sessions = getSessions({ limit: null });
        const operatorsWithStats = data.operators.map((op) => {
          const userSessions = sessions.filter(
            (s) => s.originator?.userId === op.id || s.originator?.userId === op.metadata?.slackId
          );
          return {
            ...op,
            stats: {
              activeSessions: userSessions.filter((s) => s.active).length,
              totalSessions: userSessions.length,
              lastSeen: userSessions.length > 0
                ? new Date(Date.now() - Math.min(...userSessions.map((s) => s.minutesAgo)) * 60000).toISOString()
                : op.lastSeen,
            },
          };
        });
        json(res, { operators: operatorsWithStats, roles: data.roles, timestamp: Date.now() });
      },
      POST: async (req, res) => {
        try {
          const body = await parseBody(req);
          const data = loadOperators();
          const existingIdx = data.operators.findIndex((op) => op.id === body.id);
          if (existingIdx >= 0) {
            data.operators[existingIdx] = { ...data.operators[existingIdx], ...body };
          } else {
            data.operators.push({ ...body, createdAt: new Date().toISOString() });
          }
          if (saveOperators(data)) {
            json(res, { success: true, operator: body });
          } else {
            json(res, { error: "Failed to save" }, 500);
          }
        } catch (e) {
          json(res, { error: "Invalid JSON" }, 400);
        }
      },
    },

    // Privacy settings
    "/api/privacy": {
      GET: (req, res) => {
        json(res, loadPrivacySettings());
      },
      POST: async (req, res) => {
        try {
          const body = await parseBody(req);
          const current = loadPrivacySettings();
          const merged = {
            version: current.version || 1,
            hiddenTopics: body.hiddenTopics ?? current.hiddenTopics ?? [],
            hiddenSessions: body.hiddenSessions ?? current.hiddenSessions ?? [],
            hiddenCrons: body.hiddenCrons ?? current.hiddenCrons ?? [],
            hideHostname: body.hideHostname ?? current.hideHostname ?? false,
          };
          if (savePrivacySettings(merged)) {
            json(res, { success: true, settings: merged });
          } else {
            json(res, { error: "Failed to save" }, 500);
          }
        } catch (e) {
          json(res, { error: "Invalid JSON" }, 400);
        }
      },
    },

    // Actions
    "/api/action": {
      GET: (req, res, query) => {
        const action = query.get("action");
        if (!action) {
          return json(res, { error: "Missing action parameter" }, 400);
        }
        json(res, executeAction(action));
      },
    },

    // Routing stats
    "/api/routing-stats": {
      GET: (req, res, query) => {
        const hours = parseInt(query.get("hours") || "24", 10);
        json(res, getRoutingStats(hours));
      },
    },

    // Whoami
    "/api/whoami": {
      GET: (req, res) => {
        json(res, {
          authMode: CONFIG.auth.mode,
          user: req.authUser || null,
        });
      },
    },

    // About
    "/api/about": {
      GET: (req, res) => {
        json(res, {
          name: "OpenClaw Command Center",
          version: "1.2.0",
          description: "A Starcraft-inspired dashboard for AI agent orchestration",
          license: "MIT",
          repository: "https://github.com/jontsai/openclaw-command-center",
          builtWith: ["OpenClaw", "Node.js", "Vanilla JS"],
          inspirations: ["Starcraft", "Inside Out", "iStatMenus", "DaisyDisk", "Gmail"],
        });
      },
    },

    // SSE events endpoint
    "/api/events": {
      GET: (req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });

        sseClients.add(res);
        
        // Send initial connection message
        const sendSSE = (event, data) => {
          try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            // Client disconnected
          }
        };

        sendSSE("connected", { message: "Connected to Command Center", timestamp: Date.now() });
        sendSSE("update", getCachedState() || { sessions: [], loading: true });

        // Handle disconnect
        req.on("close", () => {
          sseClients.delete(res);
        });
      },
    },
  };
}

module.exports = createRoutes;
