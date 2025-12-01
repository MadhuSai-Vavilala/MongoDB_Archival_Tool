// server/gui.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const os = require("os");

const { createGuiLogger } = require("./guiLogger");
const { createHealthMonitor } = require("./mongoHealth");

const BASE = path.join(__dirname, "..");
const CONFIG_FILE = path.join(BASE, "logs", "current_config.json");

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("ERROR: current_config.json not found in logs/");
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));
const app = express();
app.use(express.json());
// Serve static files (images, CSS, JS) from the current folder
app.use(express.static(path.join(__dirname)));

const guiLogger = createGuiLogger(BASE);
let healthMonitor = null;

(async () => {
  healthMonitor = await createHealthMonitor(cfg.mongodb.uri, cfg.mongodb.db);
  console.log("MongoDB health monitor started");
})();

function loadProgress() {
  const progressFile = path.join(BASE, "logs", "progress.json");
  if (!fs.existsSync(progressFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(progressFile));
  } catch (e) {
    console.error("Failed to read progress.json:", e.message);
    return {};
  }
}

// ---------------- DASHBOARD ----------------
app.get("/", async (req, res) => {
  const progress = loadProgress();

  let replicaStatus = { members: [] }, oplogWindow = {}, wtTickets = {};

  if (healthMonitor) {
    try {
      replicaStatus = await healthMonitor.getReplicaStatus();
      oplogWindow = await healthMonitor.getOplogWindow();
      wtTickets = await healthMonitor.getWiredTigerTickets();

    //  console.log("DEBUG oplogWindow:", oplogWindow);
    //  console.log("DEBUG WiredTiger Tickets:", wtTickets);
    } catch (e) {
      console.error("Error fetching Mongo health:", e.message);
      guiLogger.writeGuiLog({ event: "error", message: e.message });
    }
  }

  const totalDocs = progress.total_documents || 0;
  const completedDocs = progress.deleted || 0;
  const remainingDocs = totalDocs - completedDocs;
  const percentCompletedDocs = totalDocs ? ((completedDocs / totalDocs) * 100).toFixed(1) : 0;
  const percentCompletedBatches = progress.total_batches ? ((progress.completed_batches / progress.total_batches) * 100).toFixed(1) : 0;
  const avgBatchTime = progress.avg_time_per_batch_sec || 0;
  const sleepMs = cfg.archival.pause_ms || 5000;
  const guiRefreshMs = cfg.gui.refresh_interval_ms || 4000;

  // Calculate Oplog window in hours
//  const oplogHours = oplogWindow?.windowSec ? (oplogWindow.windowSec / 3600).toFixed(2) : 0;

  res.send(`
<html>
<head>
  <title>MongoDB Archival Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial,sans-serif; background:#f4f4f4; margin:0; padding:0; }
    header { background:#FF9800; color:#fff; padding:15px; display:flex; align-items:center; }
    header img { height:50px; margin-right:15px; }
    h1 { margin:0; font-size:22px; }
    section { display:flex; max-width:1200px; margin:auto; padding:20px; gap:20px; }
    .card { background:#fff; padding:15px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.2); flex:1; min-width:300px; }
    .section-title { font-size:18px; margin-bottom:10px; color:#333; border-bottom:1px solid #ddd; padding-bottom:5px; }
    table { border-collapse: collapse; width:100%; margin-bottom:15px; }
    th, td { border:1px solid #ccc; padding:6px; text-align:left; font-size:14px; }
    th { background:#FF9800; color:#fff; }
    .partition { background:#f0f8ff; font-style:italic; font-size:13px; }
    .progress-bar { background:#ddd; border-radius:5px; overflow:hidden; height:20px; width:100%; margin-bottom:10px; }
    .progress-fill { height:100%; width:${percentCompletedDocs}%; transition: width 0.5s; background:#FF9800; }
    canvas { max-width:200px; margin:auto; display:block; }
  </style>
</head>
<body>
<header>
   <img src="tool-log.png" alt="Tool Logo" style="height:35px;" />
   <h1>IceBox – MongoDB Data Lifecycle Cleaner (${os.hostname()})</h1>
</header>

<section>
  <div class="card">
   <!-- Info / Description under Pie Chart -->
<div style="margin-top:10px; padding:12px; background:#fff8e1; border-left:4px solid #FFA500; border-radius:4px; font-size:14px; color:#333;">
  <strong>Welcome to the MongoDB Archival Tool Dashboard!</strong><br>
  Monitor the archival process in real-time and view the health status of your MongoDB cluster.<br>
  Detailed logs and historical progress are available in the <code>archival log file </code> for deeper insights.
</div>

    <div style="height:15px;"></div>
    <div class="section-title">\nArchival Progress</div>
    <table>
      <tr><th>Total Docs to Remove</th><th>Completed</th><th>Pending</th><th>Avg Time per Batch (sec)</th></tr>
      <tr>
        <td>${totalDocs}</td>
        <td>${completedDocs}</td>
        <td>${remainingDocs}</td>
        <td>${avgBatchTime}</td>
      </tr>
    </table>

    <canvas id="docsPie"></canvas>

      <div>Batches Progress</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${percentCompletedBatches}%;"></div></div>
    <table>
      <tr><th>Total Batches</th><th>Completed</th><th>Remaining</th></tr>
      <tr>
        <td>${progress.total_batches || 0}</td>
        <td>${progress.completed_batches || 0}</td>
        <td>${progress.remaining_batches || 0}</td>
      </tr>
    </table>

  </div>

  <div class="card">
    <div class="section-title">Current Configuration</div>
    <table>
      <tr><th>Key</th><th>Value</th></tr>
      <tr><td>Environment</td><td>${cfg.mongodb.env || '-'}</td></tr>
      <tr><td>Namespace / Partitions</td><td class="partition">${cfg.mongodb.namespace.join(", ")}</td></tr>
      <tr><td>Batch Size</td><td>${cfg.archival.batch_size}</td></tr>
      <tr><td>Pause MS</td><td>${sleepMs}</td></tr>
      <tr><td>GUI Refresh MS</td><td>${guiRefreshMs}</td></tr>
      <tr><td>Backup Directory</td><td>${cfg.backup.dest_dir}</td></tr>
      <tr><td>Maintenance Window Enabled</td><td>${cfg.maintenance_window.enabled}</td></tr>
      <tr><td>Telegram Notification Enabled</td><td>${cfg.notification.telegram.enabled}</td></tr>
    </table>

    <div class="section-title">Replica Set Members</div>
    <table>
      <tr><th>Name</th><th>State</th><th>Health</th><th>Replication Lag (sec)</th></tr>
      ${replicaStatus.members.map(m => `<tr>
        <td>${m.name}</td>
        <td>${m.state}</td>
        <td>${m.health}</td>
        <td>${m.replicationLagSec || 0}</td>
      </tr>`).join("")}
    </table>

    <div class="section-title">Oplog Window (Primary)</div>
    <table>
      <tr><th>Configured Size</th><th>Used Size</th><th>Oplog Hours</th></tr>
      <tr>
        <td>${oplogWindow?.configured}</td>
        <td>${oplogWindow?.used}</td>
        <td>${oplogWindow?.windowHours}</td>
      </tr>
    </table>

    <div class="section-title">WiredTiger Tickets (Primary)</div>
    <table>
      <tr><th>Read Available</th><th>Read Out</th><th>Write Available</th><th>Write Out</th></tr>
      <tr>
        <td>${wtTickets?.read?.available || 0}</td>
        <td>${wtTickets?.read?.out || 0}</td>
        <td>${wtTickets?.write?.available || 0}</td>
        <td>${wtTickets?.write?.out || 0}</td>
      </tr>
    </table>
  </div>
</section>

<script>
const ctx = document.getElementById('docsPie').getContext('2d');
new Chart(ctx, {
  type:'pie',
  data: {
    labels:['Completed','Pending'],
    datasets:[{
      data:[${completedDocs}, ${remainingDocs}],
      backgroundColor:['#4CAF50','#FF5722']
    }]
  },
  options:{
    responsive:true,
    plugins:{
      legend:{ position:'bottom' },
      tooltip:{
        callbacks:{
          label: function(context){
            const val = context.parsed;
            const total = ${totalDocs};
            const perc = ((val/total)*100).toFixed(1);
            return context.label + ': ' + val + ' (' + perc + '%)';
          }
        }
      }
    }
  }
});

setTimeout(()=>location.reload(), ${guiRefreshMs});
</script>
</body>
</html>
  `);
});

// ---------------- START SERVER ----------------
const PORT = cfg.gui.port || 9090;
app.listen(PORT, () => console.log(`GUI server running on port ${PORT}`));

