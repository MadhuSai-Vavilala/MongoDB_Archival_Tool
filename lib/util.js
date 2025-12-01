const { execSync } = require('child_process');

function parseDf(dfOut, target) {
  // parse POSIX df -P output
  const lines = dfOut.trim().split('\n');
  if (lines.length < 2) return null;
  // use the last matching mount line
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(/\s+/);
    const mounted = cols[cols.length - 1];
    if (target.startsWith(mounted) || mounted === '/') {
      const size = parseInt(cols[1], 10) * 1024;
      const available = parseInt(cols[3], 10) * 1024;
      return { size, available };
    }
  }
  return null;
}

function checkDiskSpace(checkPath) {
  try {
    const df = execSync(`df -P ${checkPath}`, { encoding: 'utf8' });
    const info = parseDf(df, checkPath);
    if (!info) return null;
    const pctFree = (info.available / info.size) * 100;
    return { availableBytes: info.available, totalBytes: info.size, pctFree };
  } catch (e) {
    return null;
  }
}

function humanSeconds(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600); sec %= 3600;
  const m = Math.floor(sec / 60); sec %= 60;
  const s = sec;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function isoNowFileSafe() {
  return new Date().toISOString().replace(/[:.]/g,'-');
}

module.exports = { checkDiskSpace, humanSeconds, isoNowFileSafe };

