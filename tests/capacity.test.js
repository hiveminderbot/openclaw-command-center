/**
 * Capacity Utility Tests
 * Tests for src/utils/capacity.js
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("capacity module", () => {
  let openclawDir;
  let originalEnv;
  let configBackup = null;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    
    // Get the actual OpenClaw directory
    const HOME = os.homedir();
    openclawDir = path.join(HOME, ".openclaw");
    
    // Backup existing config if present
    const configPath = path.join(openclawDir, "openclaw.json");
    if (fs.existsSync(configPath)) {
      configBackup = fs.readFileSync(configPath, "utf8");
    }
    
    // Ensure directory exists
    if (!fs.existsSync(openclawDir)) {
      fs.mkdirSync(openclawDir, { recursive: true });
    }
    
    // Clear require cache for the modules we're testing
    for (const key of Object.keys(require.cache)) {
      if (key.includes("capacity.js") || key.includes("config.js")) {
        delete require.cache[key];
      }
    }
  });

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    
    // Restore or remove config file
    const configPath = path.join(openclawDir, "openclaw.json");
    if (configBackup !== null) {
      fs.writeFileSync(configPath, configBackup);
    } else if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    
    // Clear require cache again
    for (const key of Object.keys(require.cache)) {
      if (key.includes("capacity.js") || key.includes("config.js")) {
        delete require.cache[key];
      }
    }
  });

  describe("getCapacity()", () => {
    it("returns default capacity values when no config exists", () => {
      // Ensure no config file exists
      const configPath = path.join(openclawDir, "openclaw.json");
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      assert.ok(result.main, "should have main capacity");
      assert.ok(result.subagent, "should have subagent capacity");
      assert.strictEqual(result.main.active, 0, "main active should be 0");
      assert.strictEqual(result.main.max, 12, "main max should default to 12");
      assert.strictEqual(result.subagent.active, 0, "subagent active should be 0");
      assert.strictEqual(result.subagent.max, 24, "subagent max should default to 24");
    });

    it("reads max capacity from openclaw.json config", () => {
      // Create config file with custom capacity settings
      const config = {
        agents: {
          defaults: {
            maxConcurrent: 8,
            subagents: {
              maxConcurrent: 16
            }
          }
        }
      };
      
      const configPath = path.join(openclawDir, "openclaw.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      assert.strictEqual(result.main.max, 8, "main max should be 8 from config");
      assert.strictEqual(result.subagent.max, 16, "subagent max should be 16 from config");
    });

    it("handles malformed config gracefully (fallback to defaults)", () => {
      // Create invalid JSON file
      const configPath = path.join(openclawDir, "openclaw.json");
      fs.writeFileSync(configPath, "{ invalid json");
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      // Should fall back to defaults
      assert.strictEqual(result.main.max, 12, "main max should fallback to 12");
      assert.strictEqual(result.subagent.max, 24, "subagent max should fallback to 24");
    });

    it("handles missing config file gracefully", () => {
      // Ensure no config file exists
      const configPath = path.join(openclawDir, "openclaw.json");
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      // Should use defaults
      assert.strictEqual(result.main.max, 12, "main max should default to 12");
      assert.strictEqual(result.subagent.max, 24, "subagent max should default to 24");
    });

    it("handles partial config (only main maxConcurrent)", () => {
      const config = {
        agents: {
          defaults: {
            maxConcurrent: 10
            // No subagents config
          }
        }
      };
      
      const configPath = path.join(openclawDir, "openclaw.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      assert.strictEqual(result.main.max, 10, "main max should be 10 from config");
      assert.strictEqual(result.subagent.max, 24, "subagent max should fallback to 24");
    });

    it("handles partial config (only subagents maxConcurrent)", () => {
      const config = {
        agents: {
          defaults: {
            // No main maxConcurrent
            subagents: {
              maxConcurrent: 32
            }
          }
        }
      };
      
      const configPath = path.join(openclawDir, "openclaw.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      assert.strictEqual(result.main.max, 12, "main max should fallback to 12");
      assert.strictEqual(result.subagent.max, 32, "subagent max should be 32 from config");
    });

    it("returns object with correct structure", () => {
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      // Check structure
      assert.ok(typeof result === "object", "result should be an object");
      assert.ok(result.main, "result should have main property");
      assert.ok(result.subagent, "result should have subagent property");
      
      // Check main structure
      assert.ok(typeof result.main.active === "number", "main.active should be a number");
      assert.ok(typeof result.main.max === "number", "main.max should be a number");
      
      // Check subagent structure
      assert.ok(typeof result.subagent.active === "number", "subagent.active should be a number");
      assert.ok(typeof result.subagent.max === "number", "subagent.max should be a number");
    });

    it("always returns active count as 0 (not yet tracking)", () => {
      const { getCapacity } = require("../src/utils/capacity");
      const result = getCapacity();
      
      // Currently the implementation always returns 0 for active
      // This test documents current behavior
      assert.strictEqual(result.main.active, 0);
      assert.strictEqual(result.subagent.active, 0);
    });
  });
});
