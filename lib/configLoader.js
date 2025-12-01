// lib/configLoader.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function fail(msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ❌ CONFIG ERROR: ${msg}`);
  process.exit(0);
}

function loadConfig(cfgPath) {
  const repoRoot = process.cwd();
  const defaultPath = path.join(repoRoot, 'config', 'config.yaml');

  const finalPath = cfgPath ? path.resolve(cfgPath) : defaultPath;

  if (!fs.existsSync(finalPath)) fail(`Config file not found: ${finalPath}`);

//  console.log(`📄 Loading config from: ${finalPath}`);

  const raw = fs.readFileSync(finalPath, 'utf8');
  const cfg = yaml.load(raw);

  // ---------------------------
  // REQUIRED ROOT PARAMETERS
  // ---------------------------
  if (!cfg.paths?.base_dir) fail(`paths.base_dir is mandatory`);
  cfg._baseDir = cfg.paths.base_dir || repoRoot;

  // ---------------------------
  // MongoDB Mandatory Fields
  // ---------------------------
  if (!cfg.mongodb) fail(`mongodb block is missing`);

  if (!cfg.mongodb.uri) fail(`mongodb.uri is mandatory`);

  if (!cfg.mongodb.namespace)
    fail(`mongodb.namespace is mandatory (use "db.collection" or ["db","collection"])`);

  // Normalize namespace
  if (Array.isArray(cfg.mongodb.namespace)) {
    if (cfg.mongodb.namespace.length !== 2)
      fail(`mongodb.namespace array must be [db, collection]`);
    cfg.mongodb.db = cfg.mongodb.namespace[0];
    cfg.mongodb.collection = cfg.mongodb.namespace[1];
  } else if (typeof cfg.mongodb.namespace === 'string') {
    const parts = cfg.mongodb.namespace.split('.');
    if (parts.length < 2)
      fail(`mongodb.namespace string must be "db.collection"`);
    cfg.mongodb.db = parts.shift();
    cfg.mongodb.collection = parts.join('.');
  } else {
    fail('mongodb.namespace must be an array or string');
  }

  // mongodb.filter: mandatory & must be JSON string
  if (!cfg.mongodb.filter)
    fail(`mongodb.filter is mandatory (JSON string)`);

  if (typeof cfg.mongodb.filter === 'string') {
    try {
      cfg.mongodb.filter = JSON.parse(cfg.mongodb.filter);
    } catch (e) {
      fail(`mongodb.filter must be a valid JSON string`);
    }
  }

  // ---------------------------
  // Archival Defaults
  // ---------------------------
  cfg.archival = cfg.archival || {};
  cfg.archival.batch_size = cfg.archival.batch_size || 1000;
  cfg.archival.pause_ms = cfg.archival.pause_ms || 5000;

  // ---------------------------
  // Backup Mandatory Checks
  // ---------------------------
  cfg.backup = cfg.backup || {};
  cfg.backup.enabled = cfg.backup.enabled ?? false;
  cfg.backup.type = cfg.backup.type || "fullQuery";

  if (cfg.backup.enabled) {
    if (!cfg.backup.dest_dir)
      fail(`backup.dest_dir is mandatory when backup.enabled = true`);

    cfg.backup.file_prefix = cfg.backup.file_prefix || "archive-backup";

//    console.log(`📦 Backup enabled → Type: ${cfg.backup.type}, Output Dir: ${cfg.backup.dest_dir}`);
  }

  // ---------------------------
  // Maintenance Window Validation
  // ---------------------------
  if (cfg.maintenance_window?.enabled) {
    if (!cfg.maintenance_window.end)
      fail(`maintenance_window.end is mandatory when maintenance_window.enabled = true`);

//    console.log(`⏳ Maintenance window enabled → Ends at: ${cfg.maintenance_window.end}`);
  }

  // ---------------------------
  // Logging Defaults
  // ---------------------------
  cfg.log = cfg.log || {};
  cfg.log.file = cfg.log.file || path.join('logs', 'archive.log');
  cfg.log.include_timestamp =
    (typeof cfg.log.include_timestamp === 'boolean')
      ? cfg.log.include_timestamp
      : true;

  // ---------------------------
  // Telegram Notifications Validation
  // ---------------------------
  cfg.notification = cfg.notification || {};
  cfg.notification.telegram = cfg.notification.telegram || { enabled: false };

  if (cfg.notification.telegram.enabled) {
    if (!cfg.notification.telegram.bot_token)
      fail(`notification.telegram.bot_token is mandatory when telegram.enabled = true`);

    if (!cfg.notification.telegram.chat_id)
      fail(`notification.telegram.chat_id is mandatory when telegram.enabled = true`);

//    console.log(`📨 Telegram notifications enabled`);
  }

  console.log(`✅ Config validated successfully`);
  return cfg;
}

module.exports = { loadConfig };

