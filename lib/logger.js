const fs = require('fs');
const path = require('path');

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createLogger(cfg) {
  const logFile = path.isAbsolute(cfg.log.file) ? cfg.log.file : path.join(cfg._baseDir, cfg.log.file);
  ensureDirForFile(logFile);
  const progressFile = path.join(cfg._baseDir, 'logs', 'progress.json');

  function writeLog(obj) {
    const entry = {};
    if (cfg.log.include_timestamp) entry.timestamp = new Date().toISOString();
    Object.assign(entry, obj);
    try {
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
      // best effort to console if log fails
      console.error('Failed to write log:', e.message);
    }

    // snapshot for GUI on important events
    const snapEvents = [
      'batch_delete','archival_start','archival_complete',
      'validate_query','config_loaded','run_start','run_complete',
      'dry_run_start','dry_run_end','backup_complete','backup_failed','no_data','error','window_end_reached'
    ];
    if (snapEvents.includes(obj.event)) {
      try { fs.writeFileSync(progressFile, JSON.stringify(entry, null, 2)); } catch (e) {}
    }
  }

  return { writeLog, logFile, progressFile };
}

module.exports = { createLogger };

