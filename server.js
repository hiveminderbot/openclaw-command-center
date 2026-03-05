#!/usr/bin/env node
/**
 * OpenClaw Command Center - Server Entry Point
 * 
 * This is the main entry point that starts the HTTP server.
 * All business logic has been modularized into the src/ directory.
 */

const { createServer } = require("./src/app");

// CLI argument parsing
const args = process.argv.slice(2);
let cliProfile = null;
let cliPort = null;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--profile":
    case "-p":
      cliProfile = args[++i];
      break;
    case "--port":
      cliPort = parseInt(args[++i], 10);
      break;
    case "--help":
    case "-h":
      console.log(`
OpenClaw Command Center

Usage: node server.js [options]

Options:
  --profile, -p <name>  OpenClaw profile (uses ~/.openclaw-<name>)
  --port <port>         Server port (default: 3333)
  --help, -h            Show this help

Environment:
  OPENCLAW_PROFILE      Same as --profile
  PORT                  Same as --port

Examples:
  node server.js --profile production
  node server.js -p dev --port 3334
`);
      process.exit(0);
  }
}

// Set profile in environment so CONFIG and all CLI calls pick it up
if (cliProfile) {
  process.env.OPENCLAW_PROFILE = cliProfile;
}
if (cliPort) {
  process.env.PORT = cliPort.toString();
}

// Load config AFTER env vars are set (order matters for workspace detection)
const { CONFIG } = require("./src/config");

const PORT = cliPort || CONFIG.server.port;

// Create and start the server
const server = createServer();

server.listen(PORT, () => {
  const profile = process.env.OPENCLAW_PROFILE;
  console.log(`🦞 OpenClaw Command Center running at http://localhost:${PORT}`);
  if (profile) {
    console.log(`   Profile: ${profile} (~/.openclaw-${profile})`);
  }
  console.log(`   Press Ctrl+C to stop`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n[Server] SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n[Server] SIGINT received, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
