'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const config = require('../lib/config-store.js');
const { loadSettings, hooksInstalled } = require('../lib/settings.js');
const { isDaemonUp } = require('../lib/daemon-client.js');

const REQUIRED_DEPS = ['ws', 'open', 'node-notifier'];
const DAEMON_LOG = path.join(os.homedir(), '.cache', 'dhikrncode', 'daemon.log');

function check(label, ok, detail, hint) {
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok && hint) console.log(`     → ${hint}`);
  return ok;
}

function findBinary() {
  const r = spawnSync('which', ['dhikrncode'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function checkRequire(pkgName, fromDir) {
  // Try to resolve from the directory the binary lives in
  try {
    require.resolve(pkgName, { paths: [fromDir] });
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log('dhikrncode doctor — checking your setup\n');

  const pkg = require('../../package.json');
  console.log(`  · version: ${pkg.version}`);
  console.log(`  · node: ${process.version}`);
  console.log(`  · platform: ${process.platform}\n`);

  // 1. Binary on PATH
  const bin = findBinary();
  check(
    'dhikrncode is on PATH',
    !!bin,
    bin || 'not found',
    'reinstall: npm install -g dhikrncode  (or: cd <repo> && npm install -g .)'
  );

  // 2. Dependencies resolvable from package directory
  // The binary path is a symlink to bin/dhikrncode.js inside the install root.
  // Resolve up two levels to get the package root.
  let pkgRoot = path.resolve(__dirname, '..', '..');
  if (bin) {
    try {
      const realBin = fs.realpathSync(bin);
      pkgRoot = path.resolve(path.dirname(realBin), '..');
    } catch {}
  }
  for (const dep of REQUIRED_DEPS) {
    const ok = checkRequire(dep, pkgRoot);
    check(
      `dependency '${dep}' resolvable`,
      ok,
      ok ? '' : `not found from ${pkgRoot}`,
      `cd ${pkgRoot} && npm install`
    );
  }

  // 3. Config file
  const cfg = config.load();
  check(
    'config file exists',
    fs.existsSync(config.CONFIG_PATH),
    config.CONFIG_PATH
  );
  console.log(`     mode=${cfg.mode}  notifications=${cfg.notifications.enabled ? 'on' : 'off'}`);
  const integOn = [
    cfg.integrations.claudeCode.enabled && 'claude-code',
    cfg.integrations.claudeDesktop.enabled && 'claude-desktop',
    cfg.integrations.manual.enabled && 'manual',
  ]
    .filter(Boolean)
    .join(',') || 'NONE (everything off)';
  console.log(`     integrations: ${integOn}`);
  if (cfg.meta.uninstalledAt) {
    console.log(`     ⚠ marked uninstalled at ${cfg.meta.uninstalledAt}`);
  }

  // 4. Hooks installed
  const settings = loadSettings();
  const installed = hooksInstalled(settings);
  check(
    'Claude Code hooks installed',
    installed,
    installed ? '~/.claude/settings.json' : 'no dhikrncode hooks found',
    'run `dhikrncode init` to install'
  );

  // 5. Daemon health
  const up = await isDaemonUp(cfg.daemon);
  check(
    'daemon reachable',
    up,
    up ? `${cfg.daemon.host}:${cfg.daemon.port}` : 'down',
    up ? null : 'daemon will auto-spawn on next hook event; or run `dhikrncode start`'
  );

  // 6. Recent daemon errors
  console.log();
  if (fs.existsSync(DAEMON_LOG)) {
    const log = fs.readFileSync(DAEMON_LOG, 'utf8').split('\n');
    const errors = log.filter((l) => /error|Cannot find|EADDRINUSE/i.test(l)).slice(-5);
    if (errors.length > 0) {
      console.log('Recent errors in daemon.log:');
      for (const line of errors) console.log(`  ${line}`);
      console.log(`  (full log: ${DAEMON_LOG})`);
    } else {
      console.log(`Daemon log clean (${DAEMON_LOG})`);
    }
  } else {
    console.log(`No daemon log yet (${DAEMON_LOG})`);
  }
}

module.exports = { run };
