/**
 * OpenClaw Command Center - Main Entry Point (src/index.js)
 * 
 * This is the new modular entry point for the dashboard server.
 * The legacy lib/server.js is preserved for backward compatibility.
 */

const { createServer } = require("./app");
const { CONFIG } = require("./config");

const PORT = CONFIG.server.port;

// Create and start server
const server = createServer();

server.listen(PORT, () => {
  const profile = process.env.OPENCLAW_PROFILE;
  console.log(`🦞 OpenClaw Command Center running at http://localhost:${PORT}`);
  if (profile) {
    console.log(`   Profile: ${profile} (~/.openclaw-${profile})`);
  }
  console.log(`   Press Ctrl+C to stop`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n[Server] SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n[Server] SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});
