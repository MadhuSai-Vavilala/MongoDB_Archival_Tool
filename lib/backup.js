// lib/backup.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ObjectId } = require("mongodb");

// ----------------- Helper: Normalize _id ----------------- //
function normalizeId(id) {
  // Already in {$oid: "..."} format
  if (typeof id === "object" && id.$oid) return id;

  // Raw ObjectId hex string (24 char, hex only)
  if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
    return { $oid: id };
  }

  // Any other type stays as-is
  return id;
}

// ----------------- Helper: Fix query ----------------- //
function fixQueryForMongoDump(query) {
  if (!query || typeof query !== "object") return query;

  const fixed = { ...query };

  if (fixed._id !== undefined) {
    if (Array.isArray(fixed._id)) {
      fixed._id = fixed._id.map(id => normalizeId(id));
    } else if (fixed._id.$in) {
      fixed._id.$in = fixed._id.$in.map(id => normalizeId(id));
    } else {
      fixed._id = normalizeId(fixed._id);
    }
  }

  return fixed;
}

// ----------------- Helper: Build mongodump command ----------------- //
function buildMongoDumpCommand(cfg, outputDir, query = null) {
  let cmd = `mongodump --uri="${cfg.mongodb.uri}" -d "${cfg.mongodb.db}" -c "${cfg.mongodb.collection}" --out="${outputDir}"`;

  if (query) {
    const fixedQuery = fixQueryForMongoDump(query);
    cmd += ` --query='${JSON.stringify(fixedQuery)}'`;
  }

  if (cfg.backup.gzip === true) {
    cmd += " --gzip";
  }

  return cmd;
}

// =================== FULL BACKUP =================== //
async function takeFullBackup(cfg, logger) {
  logger.writeLog({ timestamp: new Date().toISOString(), event: "full_backup_start" });

  try {
    const dir = path.isAbsolute(cfg.backup.dest_dir)
      ? cfg.backup.dest_dir
      : path.join(cfg._baseDir, cfg.backup.dest_dir || "backups");

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const outputDir = `${dir}/archive_fullQuery_backup_${Date.now()}`;

    const cmd = buildMongoDumpCommand(cfg, outputDir, cfg.backup.query);

    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "mongodump_command",
      command: cmd
    });

    execSync(cmd, { stdio: "ignore" });

    logger.writeLog({ timestamp: new Date().toISOString(), event: "full_backup_complete", output: outputDir });
  } catch (e) {
    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "full_backup_failed",
      error: e.message
    });
  }
}

// =================== BATCH BACKUP =================== //
async function takeBatchBackup(cfg, docs, batchNumber, logger) {
  logger.writeLog({
    timestamp: new Date().toISOString(),
    event: "batch_backup_start",
    batch_number: batchNumber
  });

  try {
    const dir = path.isAbsolute(cfg.backup.dest_dir)
      ? cfg.backup.dest_dir
      : path.join(cfg._baseDir, cfg.backup.dest_dir || "backups");

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const outputDir = `${dir}/archive_batch_${batchNumber}_${Date.now()}`;

    // Build query using _id list with flexible handling
    const ids = docs.map(d => normalizeId(d._id));
    const query = { _id: { $in: ids } };

    const cmd = buildMongoDumpCommand(cfg, outputDir, query);

    // Log exact command
    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "mongodump_batch_command",
      batch_number: batchNumber,
      command: cmd
    });

    execSync(cmd, { stdio: "ignore" });

    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "batch_backup_complete",
      batch_number: batchNumber,
      output: outputDir
    });
  } catch (e) {
    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "batch_backup_failed",
      batch_number: batchNumber,
      error: e.message
    });
  }
}

module.exports = { takeFullBackup, takeBatchBackup };

