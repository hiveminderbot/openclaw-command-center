/**
 * Express App Factory for OpenClaw Command Center
 * 
 * Creates and configures an Express application instance
 * without starting the HTTP server (for testing/modularity).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");
const { promisify } = require("util");

// Promisified exec for async operations
const execAsync = promisify(exec);

// Load configuration
const { CONFIG, getOpenClawDir } = require("./config");

// Import services
const { handleJobsRequest, isJobsRoute } = require("./services/jobs");

// Import routes
const createRoutes = require("./routes");

// Import middleware
const { errorHandler } = require("./middleware/errorHandler");

// ============================================================================
// SERVER STATE
// ============================================================================

const PORT = CONFIG.server.port;
const DASHBOARD_DIR = path.join(__dirname, "..", "public");

// SSE clients for real-time updates
const sseClients = new Set();

// Unified state cache
let cachedState = null;
let lastStateUpdate = 0;
const STATE_CACHE_TTL = 30000; // 30 seconds

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Create and configure the Express-like HTTP server
 * @returns {http.Server} Configured HTTP server
 */
function createServer() {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");

    const urlParts = req.url.split("?");
    const pathname = urlParts[0];
    const query = new URLSearchParams(urlParts[1] || "");

    // Route handling
    const routes = createRoutes({ CONFIG, getOpenClawDir, sseClients, getCachedState });
    
    // Check if route exists
    if (routes[pathname] && routes[pathname][req.method]) {
      return routes[pathname][req.method](req, res, query);
    }

    // Jobs API routes
    if (isJobsRoute(pathname)) {
      return handleJobsRequest(req, res, pathname, query, req.method);
    }

    // Static files
    serveStatic(req, res, pathname);
  });

  return server;
}

/**
 * Get cached state (with lazy refresh)
 */
function getCachedState() {
  const now = Date.now();
  if (cachedState && now - lastStateUpdate < STATE_CACHE_TTL) {
    return cachedState;
  }
  // Trigger refresh (simplified for now)
  return cachedState || {};
}

/**
 * Serve static files from public directory
 */
function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(DASHBOARD_DIR, filePath);

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
    res.end(content);
  });
}

module.exports = { createServer, getCachedState };
