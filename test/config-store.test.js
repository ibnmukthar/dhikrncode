'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Sandbox HOME so we don't touch the real user config.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'dhikrncode-cfg-'));
process.env.XDG_CONFIG_HOME = path.join(sandbox, 'xdg');
process.env.HOME = sandbox;
const config = require('../src/lib/config-store.js');

test('load returns defaults when no file exists', () => {
  const cfg = config.load();
  assert.strictEqual(cfg.mode, 'dhikr');
  assert.strictEqual(cfg.notifications.enabled, false);
  assert.strictEqual(cfg.notifications.repeat, 1);
  assert.strictEqual(cfg.daemon.port, 31415);
});

test('partial patch deep-merges and preserves other keys', () => {
  config.update({ mode: 'quran' });
  let cfg = config.load();
  assert.strictEqual(cfg.mode, 'quran');
  assert.strictEqual(cfg.daemon.port, 31415);

  config.update({ notifications: { enabled: true, repeat: 3 } });
  cfg = config.load();
  assert.strictEqual(cfg.notifications.enabled, true);
  assert.strictEqual(cfg.notifications.repeat, 3);
  // unchanged fields stay
  assert.strictEqual(cfg.notifications.repeatIntervalSeconds, 30);
  assert.strictEqual(cfg.mode, 'quran');
});

test('events sub-object can be partially patched', () => {
  config.update({ notifications: { events: { done: false } } });
  const cfg = config.load();
  assert.strictEqual(cfg.notifications.events.done, false);
  assert.strictEqual(cfg.notifications.events.approval, true);
});

test('integrations defaults: claude-code on, desktop off, manual on', () => {
  // load() merges defaults over stored, but we've patched fields above; the
  // integrations block was untouched, so should still be at defaults.
  const cfg = config.load();
  assert.strictEqual(cfg.integrations.claudeCode.enabled, true);
  assert.strictEqual(cfg.integrations.claudeDesktop.enabled, false);
  assert.strictEqual(cfg.integrations.manual.enabled, true);
});

test('integrations can be patched independently', () => {
  config.update({ integrations: { claudeCode: { enabled: false } } });
  let cfg = config.load();
  assert.strictEqual(cfg.integrations.claudeCode.enabled, false);
  assert.strictEqual(cfg.integrations.manual.enabled, true);
  // restore for other tests in this file (run order is per-file)
  config.update({ integrations: { claudeCode: { enabled: true } } });
});
