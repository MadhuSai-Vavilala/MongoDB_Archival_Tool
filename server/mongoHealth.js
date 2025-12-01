// server/mongoHealth.js
const { MongoClient } = require("mongodb");

async function createHealthMonitor(uri, dbName) {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();

  async function getReplicaStatus() {
    try {
      const adminDb = client.db("admin");
      const rsStatus = await adminDb.command({ replSetGetStatus: 1 });

      const members = rsStatus.members.map(m => {
        let lag = 0;
        if (m.stateStr === "SECONDARY" && m.optimeDate) {
          const primary = rsStatus.members.find(x => x.stateStr === "PRIMARY");
          if (primary && primary.optimeDate) {
            lag = (primary.optimeDate.getTime() - m.optimeDate.getTime()) / 1000;
          }
        }
        return {
          name: m.name,
          state: m.stateStr,
          health: m.health,
          replicationLagSec: lag
        };
      });

      return { set: rsStatus.set, members };
    } catch (err) {
      console.error("Error fetching replica status:", err.message);
      return { set: null, members: [] };
    }
  }


function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) { // 1 GB or more
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  } else { // default to MB
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

async function getOplogWindow() {
  try {
    const oplogColl = client.db("local").collection("oplog.rs");

    const first = await oplogColl.find().sort({ $natural: 1 }).limit(1).toArray();
    const last  = await oplogColl.find().sort({ $natural: -1 }).limit(1).toArray();
    if (!first.length || !last.length) return null;

    const firstTS = first[0].ts instanceof Date ? first[0].ts.getTime() : first[0].ts.getHighBits() * 1000;
    const lastTS  = last[0].ts instanceof Date ? last[0].ts.getTime() : last[0].ts.getHighBits() * 1000;
    const windowSec = (lastTS - firstTS) / 1000;

    const stats = await oplogColl.stats();
    const configuredStr = formatSize(stats.maxSize || 0);
    const usedStr = formatSize(stats.size || 0);
    const windowHours = (windowSec / 3600).toFixed(2); // duration in hours

    return {
      configured: configuredStr,
      used: usedStr,
      windowHours
    };
  } catch (err) {
    console.error("Error fetching oplog window:", err.message);
    return null;
  }
}



  async function getWiredTigerTickets() {
    try {
      const adminDb = client.db("admin");
      const status = await adminDb.command({ serverStatus: 1 });
      const wt = status.wiredTiger.concurrentTransactions;
      return {
        read: { available: wt.read.available, out: wt.read.out },
        write: { available: wt.write.available, out: wt.write.out }
      };
    } catch (err) {
      console.error("Error fetching WiredTiger tickets:", err.message);
      return null;
    }
  }

  return { getReplicaStatus, getOplogWindow, getWiredTigerTickets };
}

module.exports = { createHealthMonitor };

