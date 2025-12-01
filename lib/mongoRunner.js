const { MongoClient } = require("mongodb");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { takeFullBackup, takeBatchBackup } = require("./backup");
const { sendTelegram } = require('./notifier');
const { startMessage, endMessage, maintenanceWindowMessage } = require('./telegramTemplates');

// ====================== Mainatnce Window Checking ===============

async function checkMaintenanceWindow(cfg, logger, result) {
  if (!cfg.maintenance_window?.enabled) return true; // not enabled, continue
  if (!cfg.maintenance_window.end) return true;      // no end time, continue

  const end = new Date(cfg.maintenance_window.end);
  const now = new Date();

  if (now > end) {
    const msg = maintenanceWindowMessage(cfg, result); // use your pre-defined template

    logger?.writeLog?.({ event: 'window_already_ended', message: msg });

    if (cfg.notification?.telegram?.enabled) {
      try {
        await sendTelegram(cfg, msg);
      } catch (e) {
        logger?.writeLog?.({ event: 'telegram_failed', error: e.message });
      }
    }

    console.log(msg);
    process.exit(0); // stop the entire process
  }

  return true; // still valid
}



// =================== RUN DELETION WITH BACKUP =================== //
async function runDeletion(cfg, logger) {
  const client = new MongoClient(cfg.mongodb.uri, { useUnifiedTopology: true });

  const logFile = path.join(cfg.paths.base_dir, cfg.log.file);
  const progressFile = path.join(cfg.paths.base_dir, "logs/progress.json");

  try {
    await client.connect();
    const db = client.db(cfg.mongodb.namespace[0]);
    const collection = db.collection(cfg.mongodb.namespace[1]);

    const totalDocuments = await collection.countDocuments(cfg.mongodb.filter || {});
    const totalBatches = Math.ceil(totalDocuments / cfg.archival.batch_size);

    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "archival_init",
      total_documents: totalDocuments,
      batch_size: cfg.archival.batch_size,
      expected_batches: totalBatches
    });

    if (totalDocuments === 0) {
      logger.writeLog({ timestamp: new Date().toISOString(), event: "no_data_to_archive" });
      return { total: 0 };
    }

    // 🔹 Optional full backup BEFORE deletion
    if (cfg.backup?.enabled && cfg.backup.type === "fullQuery") {
      logger.writeLog({ timestamp: new Date().toISOString(), event: "pre_deletion_full_backup_start" });
      await takeFullBackup(cfg, logger);
    }
	  
    // =================== START ARCHIVAL LOOP =================== //
    let batchNumber = 0;
    let completedBatches = 0;
    let totalDeleted = 0;
    const startTime = Date.now();

    while (true) {
      batchNumber++;
      const batchStart = Date.now();

      // Fetch a batch of documents for archival
      const docs = await collection
        .find(cfg.mongodb.filter || {})
        .limit(cfg.archival.batch_size)
        .toArray();

      if (!docs || docs.length <= 0) break;

      // 🔹 Optional batch backup per batch
      if (cfg.backup?.enabled && cfg.backup.type === "batch") {
        await takeBatchBackup(cfg, docs, batchNumber, logger);
      }

      // Delete documents
      const ids = docs.map(d => d._id);
      const result = await collection.deleteMany({ _id: { $in: ids } });
      totalDeleted += result.deletedCount;
      completedBatches++;

      // Timing calculations
      const batchEnd = Date.now();
      const batchTime = (batchEnd - batchStart) / 1000;
      const elapsedTime = (batchEnd - startTime) / 1000;
      const avgTimePerBatch = elapsedTime / completedBatches;

      const logEntry = {
        timestamp: new Date().toISOString(),
        event: "batch_deleted",
        batch_number: batchNumber,
        deleted: totalDeleted,
        remaining: totalDocuments - totalDeleted,
        total_documents: totalDocuments,
        total_batches: totalBatches,
        completed_batches: completedBatches,
        remaining_batches: totalBatches - completedBatches,
        batch_time_sec: batchTime.toFixed(2),
        avg_time_per_batch_sec: avgTimePerBatch.toFixed(2)
      };

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
      fs.writeFileSync(progressFile, JSON.stringify(logEntry, null, 2));

      // Pause between batches
      await new Promise(r => setTimeout(r, cfg.archival.pause_ms));

      // Stop immediately if maintenance window ended
      if (cfg.maintenance_window?.enabled && cfg.maintenance_window.end) {
        await checkMaintenanceWindow(cfg, logger, logEntry);
      }
    }

    logger.writeLog({
      timestamp: new Date().toISOString(),
      event: "archival_complete",
      total_deleted: totalDeleted,
      total_batches: completedBatches
    });

    return { total: totalDeleted, batches: completedBatches };
  } catch (err) {
    logger.writeLog({ timestamp: new Date().toISOString(), event: "runDeletion_error", error: err.message });
    throw err;
  } finally {
    await client.close();
  }
}

module.exports = { runDeletion };
