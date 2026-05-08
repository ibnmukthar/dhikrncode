'use strict';

const { spawn } = require('child_process');

let openLib = null;
function getOpen() {
  if (openLib) return openLib;
  try {
    openLib = require('open');
  } catch {
    openLib = null;
  }
  return openLib;
}

async function openUrl(url) {
  if (process.env.DHIKRNCODE_NOOPEN) {
    console.log(`dhikrncode: NOOPEN set — visit ${url} manually`);
    return { ok: true, mode: 'noopen' };
  }

  const open = getOpen();
  if (open) {
    try {
      await open(url);
      console.log(`dhikrncode: opened ${url} in default browser`);
      return { ok: true, mode: 'default' };
    } catch (err) {
      console.error(`dhikrncode: 'open' package failed: ${err.message}`);
    }
  }

  try {
    const cmd =
      process.platform === 'darwin'
        ? '/usr/bin/open'
        : process.platform === 'win32'
          ? 'cmd'
          : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    console.log(`dhikrncode: opened ${url} via ${cmd}`);
    return { ok: true, mode: 'shell' };
  } catch (err) {
    console.error(`dhikrncode: could not open browser; visit ${url} (${err.message})`);
    return { ok: false, mode: 'none', url };
  }
}

module.exports = { openUrl };
