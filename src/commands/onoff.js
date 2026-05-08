'use strict';

const http = require('http');
const config = require('../lib/config-store.js');
const {
  loadSettings,
  saveSettings,
  installHooks,
  hooksInstalled,
} = require('../lib/settings.js');

async function pushToDaemon(next) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify(next));
    const req = http.request(
      {
        host: next.daemon.host,
        port: next.daemon.port,
        path: '/api/config',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.setTimeout(500, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve());
    req.write(data);
    req.end();
  });
}

async function turnOn() {
  // Self-heal: if hooks aren't installed, install them; if user previously
  // uninstalled, clear the marker. Then enable the integration. This means
  // `dhikrncode on` is a complete "make it work" — never just a no-op for
  // a soft toggle the user doesn't realize is gated behind missing hooks.
  let installed = 0;
  const settings = loadSettings();
  if (!hooksInstalled(settings)) {
    const { settings: next, added } = installHooks(settings);
    saveSettings(next);
    installed = added.length;
  }

  const next = config.update({
    integrations: { claudeCode: { enabled: true } },
    meta: { uninstalledAt: null },
  });
  await pushToDaemon(next);

  console.log('dhikrncode is now on.');
  if (installed > 0) {
    console.log(`  ✓ Installed ${installed} Claude Code hook${installed === 1 ? '' : 's'}.`);
  }
  console.log('  Hooks fire normally when you use Claude Code in a terminal.');
}

async function turnOff() {
  const next = config.update({
    integrations: { claudeCode: { enabled: false } },
  });
  await pushToDaemon(next);

  console.log('dhikrncode is now off.');
  console.log(
    '  Hooks remain installed but the daemon will silently drop their events.'
  );
  console.log(
    '  Re-enable with `dhikrncode on`, or remove entirely with `dhikrncode uninstall`.'
  );
}

module.exports = {
  on: { run: turnOn },
  off: { run: turnOff },
};
