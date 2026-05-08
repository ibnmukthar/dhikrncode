'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../lib/config-store.js');

const PID_FILE = path.join(os.homedir(), '.cache', 'dhikrncode', 'daemon.pid');

function tryHttpShutdown(host, port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host, port, path: '/shutdown', method: 'POST' },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.setTimeout(800, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(false));
    req.end();
  });
}

function killByPid() {
  if (!fs.existsSync(PID_FILE)) return null;
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
  if (!pid) return null;
  try {
    process.kill(pid, 'SIGTERM');
    return pid;
  } catch (err) {
    if (err.code === 'ESRCH') return -1; // process gone
    throw err;
  }
}

async function run() {
  const cfg = config.load();

  // 1. graceful HTTP shutdown
  if (await tryHttpShutdown(cfg.daemon.host, cfg.daemon.port)) {
    console.log('dhikrncode: daemon shutting down (graceful).');
    return;
  }

  // 2. fallback: PID file → SIGTERM
  const pid = killByPid();
  if (pid && pid > 0) {
    console.log(`dhikrncode: sent SIGTERM to pid ${pid}.`);
    return;
  }

  console.log('dhikrncode: no daemon was running.');
}

module.exports = { run };
