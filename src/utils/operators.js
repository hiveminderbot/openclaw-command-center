/**
 * Operators Utilities
 */

const fs = require("fs");
const path = require("path");
const { getOpenClawDir } = require("../config");

const DATA_DIR = path.join(getOpenClawDir(), "command-center", "data");
const OPERATORS_FILE = path.join(DATA_DIR, "operators.json");

function loadOperators() {
  try {
    if (fs.existsSync(OPERATORS_FILE)) {
      return JSON.parse(fs.readFileSync(OPERATORS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load operators:", e.message);
  }
  return { version: 1, operators: [], roles: {} };
}

function saveOperators(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(OPERATORS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error("Failed to save operators:", e.message);
    return false;
  }
}

module.exports = { loadOperators, saveOperators };
