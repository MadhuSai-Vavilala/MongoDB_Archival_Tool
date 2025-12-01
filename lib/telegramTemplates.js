// lib/telegramTemplates.js

function startMessage(cfg) {
  const host = cfg.mongodb.env || cfg.gui?.host || "unknown-host";
  const db = cfg.mongodb.db;
  const coll = cfg.mongodb.collection;
  const timestamp = new Date().toLocaleString();
  return `📢 MongoDB Archival Tool STARTED
Host: ${host}
DB: ${db}
Collection: ${coll}
Timestamp: ${timestamp}`;
}

function endMessage(cfg, result) {
  const host = cfg.mongodb.env || cfg.gui?.host || "unknown-host";
  const db = cfg.mongodb.db;
  const coll = cfg.mongodb.collection;
  const deleted = result?.total || 0;
  const batches = result?.batches || 0;
  const timestamp = new Date().toLocaleString();
  return `✅ MongoDB Archival Tool COMPLETED
Host: ${host}
DB: ${db}
Collection: ${coll}
Deleted documents: ${deleted}
Batches processed: ${batches}
Timestamp: ${timestamp}`;
}

function maintenanceWindowMessage(cfg, result) {
  const host = cfg.mongodb.env || cfg.gui?.host || "unknown-host";
  const end = cfg.maintenance_window?.end ? new Date(cfg.maintenance_window.end).toLocaleString() : "unknown";
  const timestamp = new Date().toLocaleString();
  return `⚠️ MongoDB Archival Tool MAINTENANCE WINDOW HIT
Host: ${host}
Maintenance end time: ${end}
Docs Count in Batch: ${cfg.archival.batch_size}
Total Batches: ${result.total_batches}
Batches processed: ${result.completed_batches}
Pending Batches: ${result.remaining_batches}
Pending Documents: ${result.remaining}
Timestamp: ${timestamp}
Archival skipped to respect maintenance window.`;
}

module.exports = { startMessage, endMessage, maintenanceWindowMessage };

