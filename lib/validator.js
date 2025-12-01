// lib/validator.js
const { MongoClient } = require('mongodb');
const { checkDiskSpace, humanSeconds } = require('./util');
const fs = require('fs');
const path = require('path');
const { execSync } = require("child_process");
const { sendTelegram } = require('./notifier');

// Color helpers
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function printWarning(msg) {
  console.log(`${YELLOW}⚠️ WARNING:${RESET} ${msg}`);
}

function printError(msg) {
  console.log(`${RED}❌ ERROR:${RESET} ${msg}`);
}

function printSummary(warnings, errors) {
  console.log("\n================ DRY RUN SUMMARY ================");

  if (warnings.length === 0 && errors.length === 0) {
    console.log(`${GREEN}No warnings or errors. Configuration looks good.${RESET}`);
    console.log("==================================================");
    return;
  }

  if (warnings.length) {
    console.log(`${YELLOW}Warnings:${RESET}`);
    warnings.forEach(w => console.log(` - ${w}`));
  }

  if (errors.length) {
    console.log(`${RED}Errors:${RESET}`);
    errors.forEach(e => console.log(` - ${e}`));
  }

  console.log("==================================================");
}

async function runDryValidation(cfg, logger) {
  const warnings = [];
  const errors = [];

  logger.writeLog({ event: 'dry_run_start' });

  // Masked config
  const safeCfg = JSON.parse(JSON.stringify(cfg));
  if (safeCfg.mongodb?.uri) {
    safeCfg.mongodb.uri = safeCfg.mongodb.uri.replace(/\/\/.*@/, '//<redacted>@');
  }
  logger.writeLog({ event: 'config_loaded', config: safeCfg });

  // --------------------------------------------------
  // BASIC CONFIG VALIDATION
  // --------------------------------------------------
  const missing = [];
  if (!cfg.mongodb?.uri) missing.push("mongodb.uri");
  if (!cfg.mongodb?.db || !cfg.mongodb?.collection) missing.push("mongodb.namespace");
  if (!cfg.mongodb?.filter) missing.push("mongodb.filter");
  if (!cfg.archival?.batch_size) missing.push("archival.batch_size");

  if (missing.length) {
    errors.push(`Missing mandatory config: ${missing.join(", ")}`);
    logger.writeLog({ event: "config_missing", missing, status: "failed" });
    printError(`Missing config values: ${missing.join(", ")}`);
    printSummary([], errors);
    return { ok: false, errors };
  }

  logger.writeLog({ event: "validate_config", status: "ok" });

  // --------------------------------------------------
  // BACKUP VALIDATION
  // --------------------------------------------------
  if (cfg.backup?.enabled) {
    const backupDir = cfg.backup.dest_dir;

    if (!fs.existsSync(backupDir)) {
      errors.push(`Backup directory does not exist: ${backupDir}`);
      logger.writeLog({ event: "backup_dir_missing", status: "failed", dir: backupDir });
      printError(`Backup directory missing: ${backupDir}`);
      printSummary([], errors);
      return { ok: false, errors };
    }

    try {
      fs.accessSync(backupDir, fs.constants.W_OK);
    } catch {
      errors.push(`Backup directory not writable: ${backupDir}`);
      logger.writeLog({ event: "backup_dir_not_writable", status: "failed", dir: backupDir });
      printError(`Backup directory is not writable: ${backupDir}`);
      printSummary([], errors);
      return { ok: false, errors };
    }

    logger.writeLog({ event: "backup_dir_ok", status: "ok", dir: backupDir });

    const disk = checkDiskSpace(backupDir);
    if (!disk) {
      errors.push("Unable to check disk space");
      logger.writeLog({ event: "disk_check", status: "failed" });
      printError("Unable to check disk space for backup directory");
      printSummary([], errors);
      return { ok: false, errors };
    }

    const gbFree = (disk.availableBytes / 1e9).toFixed(2);
    const pctFree = disk.pctFree.toFixed(2);

    if (disk.pctFree < 10) {
      warnings.push(`Low disk space: ${gbFree} GB free (${pctFree}%)`);
      logger.writeLog({ event: "disk_low_warning", status: "warning", free_gb: gbFree, pct_free: pctFree });
      printWarning(`Low disk space: ${gbFree} GB free (${pctFree}%)`);
    }
  }

  // --------------------------------------------------
  // CHECK MONGODUMP EXISTS
  // --------------------------------------------------
  try {
    execSync("which mongodump");
    logger.writeLog({ event: "mongodump_check", status: "ok" });
  } catch {
    errors.push("mongodump command not found in PATH");
    logger.writeLog({ event: "mongodump_missing", status: "failed" });
    printError("mongodump not found in PATH");
    printSummary(warnings, errors);
    return { ok: false, errors };
  }

  // --------------------------------------------------
  // MAINTENANCE WINDOW CHECK
  // --------------------------------------------------
  if (cfg.maintenance_window?.enabled && cfg.maintenance_window.end) {
    const end = new Date(cfg.maintenance_window.end);
    const now = new Date();

    if (now > end) {
      errors.push("Maintenance window already ended");
      logger.writeLog({ event: "maintenance_window_expired", status: "failed" });
      printError("Maintenance window already ended.");
      printSummary(warnings, errors);
      return { ok: false, errors };
    }

    logger.writeLog({ event: "maintenance_window_ok", status: "ok" });
  }

  // --------------------------------------------------
  // TELEGRAM VALIDATION
  // --------------------------------------------------
  if (cfg.notification?.telegram?.enabled) {
    const tg = cfg.notification.telegram;

    if (!tg.bot_token) {
      errors.push("telegram.bot_token missing");
      printError("Telegram bot token missing");
    }
    if (!tg.chat_id) {
      errors.push("telegram.chat_id missing");
      printError("Telegram chat_id missing");
    }

    if (errors.length) {
      printSummary(warnings, errors);
      return { ok: false, errors };
    }

    try {
      await sendTelegram(cfg, "DRY RUN: Telegram test message OK");
      logger.writeLog({ event: "telegram_test_ok", status: "ok" });
    } catch (e) {
      warnings.push("Telegram test failed (will continue)");
      printWarning("Telegram test failed - ensure credentials are correct");
    }
  }

  // --------------------------------------------------
  // MONGO VALIDATION
  // --------------------------------------------------
  let client;
  try {
    client = new MongoClient(cfg.mongodb.uri);
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    logger.writeLog({ event: "validate_connection", status: "ok" });
  } catch (err) {
    errors.push("MongoDB connection failed");
    printError("MongoDB connection failed: " + err.message);
    printSummary(warnings, errors);
    return { ok: false, errors };
  }

  const db = client.db(cfg.mongodb.db);
  const coll = db.collection(cfg.mongodb.collection);
  const totalDocs = await coll.countDocuments(cfg.mongodb.filter || {});

  const batchSize = cfg.archival.batch_size;
  const expectedBatches = Math.ceil(totalDocs / batchSize);

  logger.writeLog({
    event: "validate_query",
    matching_docs: totalDocs,
    batch_size: batchSize,
    expected_batches: expectedBatches,
    status: "ok"
  });

  if (totalDocs === 0) {
    warnings.push("Query returned 0 documents");
    printWarning("Query returned no documents");
  }

  await client.close();

  // --------------------------------------------------
  // FINAL SUMMARY PRINT
  // --------------------------------------------------
  printSummary(warnings, errors);

  return { ok: errors.length === 0, warnings, errors };
}

module.exports = { runDryValidation };

