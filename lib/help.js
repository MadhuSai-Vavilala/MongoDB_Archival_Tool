// lib/help.js
function showHelp() {
  console.log(`
MongoDB Archival Tool v1.0.0

Usage:
  node index.js --config <config_file>     Run archival with specific config
  node index.js --dryRun | -n             Validate config & preview deletion stats (no deletion)
  node index.js --help | -h                Show this help

Options:
  --config <file>    Path to JSON config file
  --dryRun, -n       Perform a dry run without deleting
  --help, -h         Show this help message
`);
}

module.exports = { showHelp };

