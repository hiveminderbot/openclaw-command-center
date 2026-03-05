/**
 * Privacy Settings Utilities
 */

const fs = require("fs");
const path = require("path");
const { getOpenClawDir } = require("../config");

const DATA_DIR = path.join(getOpenClawDir(), "command-center", "data");
const PRIVACY_FILE = path.join(DATA_DIR, "privacy-settings.json");

function loadPrivacySettings() {
  try {
    if (fs.existsSync(PRIVACY_FILE)) {
      return JSON.parse(fs.readFileSync(PRIVACY_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load privacy settings:", e.message);
  }
  return {
    version: 1,
    hiddenTopics: [],
    hiddenSessions: [],
    hiddenCrons: [],
    hideHostname: false,
    updatedAt: null,
  };
}

function savePrivacySettings(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(PRIVACY_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error("Failed to save privacy settings:", e.message);
    return false;
  }
}

module.exports = { loadPrivacySettings, savePrivacySettings };
