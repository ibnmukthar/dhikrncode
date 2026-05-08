'use strict';

const http = require('http');
const config = require('../lib/config-store.js');

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

async function setEnabled(enabled) {
  const next = config.update({
    integrations: { claudeCode: { enabled } },
  });
  await pushToDaemon(next);
  console.log(`dhikrncode is now ${enabled ? 'on' : 'off'}.`);
  if (enabled) {
    console.log(
      "  Hooks fire normally when you use Claude Code in a terminal."
    );
  } else {
    console.log(
      "  Hooks remain installed but the daemon will silently drop their events."
    );
    console.log(
      "  Re-enable with `dhikrncode on`, or remove entirely with `dhikrncode uninstall`."
    );
  }
}

module.exports = {
  on: { run: () => setEnabled(true) },
  off: { run: () => setEnabled(false) },
};
