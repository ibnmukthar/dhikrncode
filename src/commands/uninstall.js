'use strict';

const {
  loadSettings,
  saveSettings,
  uninstallHooks,
  SETTINGS_PATH,
} = require('../lib/settings.js');
const config = require('../lib/config-store.js');

async function killDaemonQuietly() {
  // Try graceful HTTP shutdown, then PID-based fallback. Errors are fine —
  // the daemon may not be running.
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const cfg = config.load();
  await new Promise((resolve) => {
    const req = http.request(
      { host: cfg.daemon.host, port: cfg.daemon.port, path: '/shutdown', method: 'POST' },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.setTimeout(500, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve());
    req.end();
  });

  const pidFile = path.join(os.homedir(), '.cache', 'dhikrncode', 'daemon.pid');
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
  }
}

async function run() {
  const before = loadSettings();
  const { settings, removed } = uninstallHooks(before);
  saveSettings(settings);

  await killDaemonQuietly();

  // Mark uninstalled so REPL doesn't silently re-install on next launch.
  config.update({ meta: { uninstalledAt: new Date().toISOString() } });

  if (removed.length === 0) {
    console.log('No dhikrncode hooks were installed — nothing to remove.');
  } else {
    console.log(
      `Removed ${removed.length} hook entr${removed.length === 1 ? 'y' : 'ies'} from ${SETTINGS_PATH}`
    );
  }
  console.log('Stopped the running daemon (if any).');
  console.log('');
  console.log('To remove the package entirely:  npm uninstall -g dhikrncode');
  console.log("To turn it back on:              run 'dhikrncode' and type 'init'");
}

module.exports = { run };
