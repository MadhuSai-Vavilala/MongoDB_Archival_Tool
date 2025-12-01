// server/guiLogger.js
const fs = require("fs");
const path = require("path");

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createGuiLogger(baseDir) {
  const guiLogFile = path.join(baseDir, "logs", "guiStats.log");
  ensureDirForFile(guiLogFile);

  function writeGuiLog(obj) {
    const entry = { timestamp: new Date().toISOString(), ...obj };
    try {
      fs.appendFileSync(guiLogFile, JSON.stringify(entry) + "\n");
    } catch (e) {
      console.error("GUI log write failed:", e.message);
    }
  }

  return { writeGuiLog, guiLogFile };
}

module.exports = { createGuiLogger };

