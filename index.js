#!/usr/bin/env node
const { loadConfig } = require('./lib/configLoader');
const { createLogger } = require('./lib/logger');
const { runDryValidation } = require('./lib/validator');
const { runDeletion } = require('./lib/mongoRunner');
const { sendTelegram } = require('./lib/notifier');
const { showHelp } = require('./lib/help');
const { version } = require('./package.json'); // dynamically read version
const { startMessage, endMessage, maintenanceWindowMessage } = require('./lib/telegramTemplates');
const { showLogo } = require('./lib/logoDisplay');
const fs = require('fs');
const path = require('path');
const { spawn } = require("child_process");


async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
      showHelp(version);
      process.exit(0);
    }

    if (args.includes('--version')) {
      console.log(`MongoDB Archival Tool version: ${version}`);
      process.exit(0);
    }

    // Parse --config argument
    let cfgFile = null;
    const cfgIndex = args.indexOf('--config');
    if (cfgIndex >= 0 && args.length > cfgIndex + 1) {
      cfgFile = args[cfgIndex + 1];
    }

    const dryRun = args.includes('--dryRun') || args.includes('-n');

    // Call Logo Printing Function
    showLogo();

    // Load config
    const cfg = loadConfig(cfgFile); // pass file path if provided
    const logger = createLogger(cfg);

    const configFile = path.join(cfg._baseDir, 'logs', 'current_config.json');
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
    logger.writeLog({event: 'cfg', message: `Current config saved to ${configFile}`});


    logger.writeLog({ event: 'run_start', message: 'INITIATING THE TOOL' });

    const res = await runDryValidation(cfg, logger);
    if (!res.ok) process.exit(1);

    if (dryRun) process.exit(0);

    logger.writeLog({ event: 'run_start', message: 'Starting archival run' });

    // Telegram start message
    if (cfg.notification?.telegram?.enabled) {
      await sendTelegram(cfg, startMessage(cfg));
    }

    // Strrt the GUI Process

    let guiProcess = null;

    if (cfg.gui && cfg.gui.enabled) {
      guiProcess = spawn("node", ["server/gui.js"], { stdio: "inherit" });
      console.log("GUI started on port", cfg.gui.port || 9090);
      logger.writeLog({ event: 'GUI_Update', message: 'Starting GUI Process' })
    }

    // Archivel and Backup Calling
    const result = await runDeletion(cfg, logger);
console.log(result)
    logger.writeLog({ event: 'run_complete', total_deleted: result.total, batches: result.batches });

    // Telegram end message
    if (cfg.notification?.telegram?.enabled) {
      await sendTelegram(cfg, endMessage(cfg, result));
    }

    // Kill the GUI Process
    if (guiProcess) {
       guiProcess.kill();
       console.log("GUI process terminated.");
    }

    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

