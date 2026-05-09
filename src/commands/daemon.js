'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../lib/config-store.js');
const { openUrl } = require('../lib/window.js');
const { notify } = require('../lib/notify.js');
const { refocusByBundleId } = require('../lib/refocus.js');

const os = require('os');
const UI_DIR = path.join(__dirname, '..', 'ui');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RUNTIME_DIR = path.join(os.homedir(), '.cache', 'dhikrncode');
const PID_FILE = path.join(RUNTIME_DIR, 'daemon.pid');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const IDLE_SHUTDOWN_MS = 30 * 60 * 1000; // 30 min
const LOADING_COOLDOWN_MS = 30 * 1000; // when no tab has connected yet, wait this long before opening another (covers slow page load)
const DISCONNECT_GRACE_MS = 8 * 1000; // treat the tab as still alive for this long after a WS drop

function loadAdhkar() {
  const p = path.join(DATA_DIR, 'adhkar.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(j) ? j : j.items || [];
}

function loadSurah(num) {
  const padded = String(num).padStart(3, '0');
  const dir = fs.readdirSync(path.join(DATA_DIR, 'quran'));
  const match = dir.find((f) => f.startsWith(padded + '-') && f.endsWith('.json'));
  if (!match) return null;
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quran', match), 'utf8'));
}

function listSurahs() {
  const dir = fs.readdirSync(path.join(DATA_DIR, 'quran'));
  return dir
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quran', f), 'utf8'));
      return { number: j.number, name: j.name, englishName: j.englishName, ayahs: j.ayahs.length };
    })
    .sort((a, b) => a.number - b.number);
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
  });
  res.end(data);
}

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-cache',
  });
  res.end(data);
}

class Hub {
  constructor() {
    this.clients = new Set();
    this.state = { phase: 'idle', reason: null, since: Date.now() };
    this.lastDisconnectAt = 0;
    this.hasEverConnected = false;
  }
  add(ws) {
    this.clients.add(ws);
    this.hasEverConnected = true;
    this.sendTo(ws, { type: 'state', state: this.state });
    const onClose = () => {
      this.clients.delete(ws);
      this.lastDisconnectAt = Date.now();
    };
    ws.on('close', onClose);
    ws.on('error', onClose);
  }
  sendTo(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.clients.delete(ws);
    }
  }
  broadcast(msg) {
    for (const c of this.clients) this.sendTo(c, msg);
  }
  setState(next) {
    this.state = { ...next, since: Date.now() };
    this.broadcast({ type: 'state', state: this.state });
  }
}

async function run() {
  const cfg = config.load();
  const hub = new Hub();
  let lastActivity = Date.now();

  const server = http.createServer(async (req, res) => {
    lastActivity = Date.now();
    const url = new URL(req.url, `http://${cfg.daemon.host}:${cfg.daemon.port}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return serveStatic(res, path.join(UI_DIR, 'index.html'));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/ui/')) {
      const safe = path.normalize(url.pathname.slice('/ui/'.length)).replace(/^[/\\]+/, '');
      return serveStatic(res, path.join(UI_DIR, safe));
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return sendJson(res, 200, config.load());
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let patch;
        try {
          patch = JSON.parse(body || '{}');
        } catch {
          return sendJson(res, 400, { error: 'invalid json' });
        }
        const next = config.update(patch);
        hub.broadcast({ type: 'config', config: next });
        sendJson(res, 200, next);
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/content') {
      const c = config.load();
      if (c.mode === 'quran') {
        const surahs = listSurahs();
        const surah = loadSurah(c.quran.surah) || loadSurah(1);
        return sendJson(res, 200, { mode: 'quran', surahs, surah });
      }
      return sendJson(res, 200, { mode: 'dhikr', adhkar: loadAdhkar() });
    }

    if (req.method === 'GET' && url.pathname === '/api/surahs') {
      return sendJson(res, 200, listSurahs());
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/surah/')) {
      const num = parseInt(url.pathname.slice('/api/surah/'.length), 10);
      const surah = loadSurah(num);
      if (!surah) return sendJson(res, 404, { error: 'surah not bundled' });
      return sendJson(res, 200, surah);
    }

    if (req.method === 'POST' && url.pathname === '/event') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return sendJson(res, 400, { error: 'invalid json' });
        }
        handleEvent(payload, hub);
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/done') {
      hub.setState({ phase: 'idle', reason: null });
      // Refocus the user's terminal so they can keep working without
      // manually clicking back. Best-effort, macOS-only for now.
      if (lastTerminalBundleId) {
        const ok = refocusByBundleId(lastTerminalBundleId);
        console.log(
          `[${new Date().toISOString()}] /done — refocus ${ok ? 'sent' : 'skipped'} (bundle=${lastTerminalBundleId})`
        );
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/shutdown') {
      sendJson(res, 200, { ok: true });
      console.log(`[${new Date().toISOString()}] /shutdown received — exiting`);
      setTimeout(() => process.exit(0), 50);
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  // WebSocket
  const WebSocket = require('ws');
  const wss = new WebSocket.WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => hub.add(ws));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(cfg.daemon.port, cfg.daemon.host, resolve);
  });

  console.log(
    `dhikrncode daemon listening on http://${cfg.daemon.host}:${cfg.daemon.port}`
  );
  console.log(
    `  mode=${cfg.mode}  notifications=${cfg.notifications.enabled ? 'on' : 'off'}` +
      `  integrations=${[
        cfg.integrations.claudeCode.enabled && 'claude-code',
        cfg.integrations.claudeDesktop.enabled && 'claude-desktop',
        cfg.integrations.manual.enabled && 'manual',
      ]
        .filter(Boolean)
        .join(',') || 'none'}`
  );

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  const cleanup = () => {
    try {
      if (fs.readFileSync(PID_FILE, 'utf8') === String(process.pid)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {}
  };
  process.on('exit', cleanup);

  // Idle shutdown
  setInterval(() => {
    if (
      hub.state.phase === 'idle' &&
      hub.clients.size === 0 &&
      Date.now() - lastActivity > IDLE_SHUTDOWN_MS
    ) {
      console.log('dhikrncode daemon idle, shutting down');
      process.exit(0);
    }
  }, 60_000).unref();

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

let openInFlight = false;
let lastOpenAt = 0;
// Most recent terminal/IDE bundle id seen on incoming events. Used to refocus
// the user's coding terminal when the dhikr tab closes.
let lastTerminalBundleId = null;

async function maybeOpenWindow(hub, { force = false } = {}) {
  if (openInFlight) {
    console.log(`[${new Date().toISOString()}] open skipped: in flight`);
    return;
  }

  if (!force) {
    // 1. There's a live tab right now → don't open another.
    if (hub.clients.size > 0) {
      console.log(
        `[${new Date().toISOString()}] open skipped: tab connected (${hub.clients.size} clients)`
      );
      return;
    }

    // 2. A tab JUST disconnected — could be a tab-freeze / WS blip that's
    //    about to reconnect. Wait it out.
    const sinceDisconnect = hub.lastDisconnectAt ? Date.now() - hub.lastDisconnectAt : Infinity;
    if (sinceDisconnect < DISCONNECT_GRACE_MS) {
      console.log(
        `[${new Date().toISOString()}] open skipped: WS just dropped (${Math.round(sinceDisconnect / 1000)}s ago)`
      );
      return;
    }

    // 3. A tab was connected at some point and is now closed past the grace
    //    period — user genuinely closed it. Allow re-opening on this prompt.
    //    (Falls through to the open call below.)
    if (!hub.hasEverConnected) {
      // 4. No tab has connected yet. We may have already called openUrl()
      //    and the page is still loading. Apply a short cooldown so we
      //    don't stack opens for back-to-back queued prompts.
      const sinceOpen = lastOpenAt ? Date.now() - lastOpenAt : Infinity;
      if (sinceOpen < LOADING_COOLDOWN_MS) {
        console.log(
          `[${new Date().toISOString()}] open skipped: page still loading (${Math.round(sinceOpen / 1000)}s of ${LOADING_COOLDOWN_MS / 1000}s)`
        );
        return;
      }
    }
  }

  openInFlight = true;
  try {
    const cfg = config.load();
    const url = `http://${cfg.daemon.host}:${cfg.daemon.port}/`;
    await openUrl(url);
    lastOpenAt = Date.now();
    // We've spawned a new tab; "hasEverConnected" now refers to the previous
    // tab.  Reset so the loading cooldown applies until this new tab connects.
    hub.hasEverConnected = false;
  } finally {
    setTimeout(() => {
      openInFlight = false;
    }, 2000);
  }
}

const lastNotifyAt = { approval: 0, done: 0 };
const NOTIFY_MIN_INTERVAL_MS = 8000; // don't refire the same reason within 8s
const pendingRepeats = []; // setTimeout ids for scheduled re-notifications

function cancelPendingRepeats() {
  while (pendingRepeats.length) clearTimeout(pendingRepeats.pop());
}

function maybeNotify(hub, reason, message) {
  const cfg = config.load();
  const nCfg = cfg.notifications || {};
  if (!nCfg.enabled) {
    console.log(`[${new Date().toISOString()}] notify disabled (reason=${reason})`);
    return false;
  }
  if (nCfg.events && nCfg.events[reason] === false) {
    console.log(`[${new Date().toISOString()}] notify off for reason=${reason}`);
    return false;
  }

  const prev = hub.state.phase;
  const sameReason = hub.state.reason === reason;
  const now = Date.now();
  const sinceLast = now - (lastNotifyAt[reason] || 0);

  if (prev === 'ready' && sameReason && sinceLast < NOTIFY_MIN_INTERVAL_MS) {
    console.log(
      `[${new Date().toISOString()}] notify suppressed (reason=${reason}, ${sinceLast}ms since last)`
    );
    return false;
  }
  lastNotifyAt[reason] = now;
  notify({ title: 'dhikrncode', message });

  const repeat = Math.max(1, parseInt(nCfg.repeat, 10) || 1);
  const intervalMs = Math.max(5, parseInt(nCfg.repeatIntervalSeconds, 10) || 30) * 1000;
  for (let i = 1; i < repeat; i++) {
    const id = setTimeout(() => {
      // only re-notify if state is still the same ready/reason
      if (hub.state.phase === 'ready' && hub.state.reason === reason) {
        notify({ title: 'dhikrncode', message });
      }
    }, i * intervalMs);
    pendingRepeats.push(id);
  }
  return true;
}

function isSourceEnabled(payload) {
  const cfg = config.load();
  const integ = cfg.integrations || {};
  const src = payload.source || 'manual';

  // Claude Code CLI — also accepts the old 'claude-code' value for backward compat
  if (src === 'claude-code-cli' || src === 'claude-code') {
    return integ.claudeCode ? integ.claudeCode.enabled !== false : true;
  }
  // Claude Code running inside Claude Desktop
  if (src === 'claude-code-desktop' || src === 'claude-desktop') {
    return integ.claudeDesktop && integ.claudeDesktop.enabled === true;
  }
  if (src === 'manual') return integ.manual ? integ.manual.enabled !== false : true;
  return true; // unknown source → allow (forward compat)
}

function handleEvent(payload, hub) {
  const { type } = payload;
  const src = payload.source || 'manual';
  const reason = payload.sourceReason ? ` — ${payload.sourceReason}` : '';

  // Track the user's terminal app so we can refocus it on tab close.
  if (payload.sourceHints && payload.sourceHints.bundleId) {
    lastTerminalBundleId = payload.sourceHints.bundleId;
  }

  if (!isSourceEnabled(payload)) {
    console.log(
      `[${new Date().toISOString()}] event: ${type} skipped (source='${src}' disabled${reason})`
    );
    return;
  }
  console.log(
    `[${new Date().toISOString()}] event: ${type} (phase=${hub.state.phase}, source='${src}'${reason})`
  );
  switch (type) {
    case 'user-prompt-submit': {
      cancelPendingRepeats();
      hub.setState({ phase: 'busy', reason: null });
      maybeOpenWindow(hub);
      break;
    }
    case 'start': {
      // Manual `dhikrncode start` always opens (or refocuses) — bypasses cooldown.
      cancelPendingRepeats();
      hub.setState({ phase: 'busy', reason: null });
      maybeOpenWindow(hub, { force: true });
      break;
    }
    case 'notification': {
      maybeNotify(hub, 'approval', 'Your coding agent needs your input.');
      hub.setState({ phase: 'ready', reason: 'approval' });
      break;
    }
    case 'stop': {
      maybeNotify(hub, 'done', 'Your coding agent is done. Alhamdulillah.');
      hub.setState({ phase: 'ready', reason: 'done' });
      break;
    }
    case 'pre-tool-use':
    case 'post-tool-use': {
      // Tool activity = agent is working. Two responsibilities:
      //  1. If state isn't busy, flip to busy (covers ready→busy after a
      //     permission/question round-trip and idle→busy after auto-close).
      //  2. Always check maybeOpenWindow — even when state was already busy.
      //     Why: the user may have manually closed the tab while busy, and
      //     PostToolUse fires for AskUserQuestion-style tools right when
      //     they answer in the terminal, before any new tool starts. The
      //     inner cooldown / WS-connection checks in maybeOpenWindow keep
      //     this from spamming new tabs.
      if (hub.state.phase !== 'busy') {
        cancelPendingRepeats();
        hub.setState({ phase: 'busy', reason: null });
      }
      maybeOpenWindow(hub);
      break;
    }
    default:
      console.log(`[${new Date().toISOString()}] ignored unknown event type: ${type}`);
      break;
  }
}

module.exports = { run };
