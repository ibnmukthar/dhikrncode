'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  installHooks,
  uninstallHooks,
  loadSettings,
  saveSettings,
  hooksInstalled,
} = require('../src/lib/settings.js');

function tmpFile() {
  const p = path.join(os.tmpdir(), `dhikrncode-settings-${Date.now()}-${Math.random()}.json`);
  return p;
}

test('install adds three hooks to empty settings', () => {
  const { settings, added } = installHooks({});
  assert.deepStrictEqual(added.sort(), ['Notification', 'Stop', 'UserPromptSubmit']);
  assert.ok(settings.hooks.UserPromptSubmit);
  assert.ok(settings.hooks.Notification);
  assert.ok(settings.hooks.Stop);

  const cmds = settings.hooks.Stop[0].hooks.map((h) => h.command);
  assert.ok(cmds.some((c) => c.startsWith('dhikrncode hook stop')));
});

test('install is idempotent', () => {
  const r1 = installHooks({});
  const r2 = installHooks(r1.settings);
  assert.deepStrictEqual(r2.added, []);
  assert.deepStrictEqual(r2.settings, r1.settings);
});

test('install preserves existing user hooks', () => {
  const existing = {
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: 'echo "user hook"' }],
        },
      ],
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'audit-bash.sh' }] },
      ],
    },
    otherKey: 'preserved',
  };
  const { settings } = installHooks(existing);
  assert.strictEqual(settings.otherKey, 'preserved');
  assert.deepStrictEqual(settings.hooks.PreToolUse, existing.hooks.PreToolUse);

  const stopCommands = settings.hooks.Stop[0].hooks.map((h) => h.command);
  assert.ok(stopCommands.includes('echo "user hook"'));
  assert.ok(stopCommands.some((c) => c.startsWith('dhikrncode hook stop')));
});

test('uninstall removes only our entries', () => {
  const existing = {
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: 'echo "user hook"' }],
        },
      ],
    },
  };
  const installed = installHooks(existing).settings;
  const { settings, removed } = uninstallHooks(installed);

  assert.strictEqual(removed.length, 3);
  // user hook still there
  const stopCommands = settings.hooks.Stop[0].hooks.map((h) => h.command);
  assert.ok(stopCommands.includes('echo "user hook"'));
  assert.ok(!stopCommands.some((c) => c.startsWith('dhikrncode')));
});

test('uninstall prunes empty hook arrays', () => {
  const installed = installHooks({}).settings;
  const { settings } = uninstallHooks(installed);
  assert.strictEqual(settings.hooks, undefined);
});

test('load/save round-trips through filesystem', () => {
  const p = tmpFile();
  try {
    const initial = installHooks({}).settings;
    saveSettings(initial, p);
    const loaded = loadSettings(p);
    assert.deepStrictEqual(loaded, initial);
  } finally {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

test('load throws helpful error on invalid JSON', () => {
  const p = tmpFile();
  try {
    fs.writeFileSync(p, '{not json');
    assert.throws(() => loadSettings(p), /Could not parse/);
  } finally {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

test('load returns empty for missing file', () => {
  const p = tmpFile();
  assert.deepStrictEqual(loadSettings(p), {});
});

test('hooksInstalled detects fresh install', () => {
  assert.strictEqual(hooksInstalled({}), false);
  assert.strictEqual(hooksInstalled({ hooks: {} }), false);

  const installed = installHooks({}).settings;
  assert.strictEqual(hooksInstalled(installed), true);

  const removed = uninstallHooks(installed).settings;
  assert.strictEqual(hooksInstalled(removed), false);
});

test('hooksInstalled with only user-owned hooks returns false', () => {
  const settings = {
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: 'echo "user hook"' }],
        },
      ],
    },
  };
  assert.strictEqual(hooksInstalled(settings), false);
});
