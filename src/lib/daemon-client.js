'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const config = require('./config-store.js');

const LOG_DIR = path.join(os.homedir(), '.cache', 'dhikrncode');
const LOG_PATH = path.join(LOG_DIR, 'daemon.log');

function postJson(host, port, urlPath, body, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host,
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('daemon request timed out')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(host, port, urlPath, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: urlPath, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function isDaemonUp({ host, port }) {
  try {
    const res = await getJson(host, port, '/health');
    return res.status === 200;
  } catch {
    return false;
  }
}

function spawnDaemon() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(LOG_PATH, 'a');
  const node = process.execPath;
  const cliEntry = path.join(__dirname, '..', '..', 'bin', 'dhikrncode.js');
  const child = spawn(node, [cliEntry, 'daemon'], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, DHIKRNCODE_DAEMON: '1' },
  });
  child.unref();
}

async function ensureDaemon(cfg = config.load(), { waitMs = 1500 } = {}) {
  const target = cfg.daemon;
  if (await isDaemonUp(target)) return;
  spawnDaemon();
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    if (await isDaemonUp(target)) return;
  }
  throw new Error(`daemon did not start within ${waitMs} ms (see ${LOG_PATH})`);
}

async function send(eventType, payload = {}) {
  const cfg = config.load();
  await ensureDaemon(cfg);
  // Always include source hints so the daemon can refocus the user's
  // terminal app when the dhikr tab closes. Caller-supplied hints win
  // (the hook command sets these explicitly via detectSource()).
  const { detectSource } = require('./source-detect.js');
  const detected = detectSource();
  return postJson(cfg.daemon.host, cfg.daemon.port, '/event', {
    type: eventType,
    sourceHints: detected.hints,
    ...payload,
  });
}

module.exports = { isDaemonUp, ensureDaemon, send, postJson, getJson, LOG_PATH };
