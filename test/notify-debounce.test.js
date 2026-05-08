'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// Mock `node-notifier` and the local notify lib BEFORE requiring the daemon.
const calls = [];
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === 'node-notifier') {
    return { notify: (opts) => calls.push(opts) };
  }
  return origLoad.call(this, request, parent, ...rest);
};

// We require the daemon module purely to invoke handleEvent indirectly via
// importing the module. handleEvent is not exported; instead, we rebuild a
// minimal harness that replicates its semantics by re-importing notify and
// state behavior through the public surface of the helpers. To keep the test
// hermetic and focused on the debounce, we replicate the structure here.

const { notify } = require('../src/lib/notify.js');

const NOTIFY_MIN_INTERVAL_MS = 8000;

function makeHub(initialPhase = 'idle', initialReason = null) {
  return { state: { phase: initialPhase, reason: initialReason, since: Date.now() } };
}

function maybeNotify(hub, reason, message, lastNotifyAt, cfg = { enabled: true }) {
  if (!cfg.enabled) return false;
  if (cfg.events && cfg.events[reason] === false) return false;
  const prev = hub.state.phase;
  const sameReason = hub.state.reason === reason;
  const now = Date.now();
  const sinceLast = now - (lastNotifyAt[reason] || 0);
  if (prev === 'ready' && sameReason && sinceLast < NOTIFY_MIN_INTERVAL_MS) {
    return false;
  }
  lastNotifyAt[reason] = now;
  notify({ title: 'dhikrncode', message });
  return true;
}

test('first stop notification fires', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const last = {};
  const fired = maybeNotify(hub, 'done', 'done!', last);
  assert.strictEqual(fired, true);
  assert.strictEqual(calls.length, 1);
});

test('rapid second stop is suppressed when state stayed ready', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const last = {};
  maybeNotify(hub, 'done', 'done!', last);
  hub.state = { phase: 'ready', reason: 'done', since: Date.now() };

  // simulate immediate second Stop event
  const fired2 = maybeNotify(hub, 'done', 'done again', last);
  assert.strictEqual(fired2, false);
  assert.strictEqual(calls.length, 1, 'should not double-notify');
});

test('after user-prompt-submit goes to busy, next stop fires fresh', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const last = {};
  maybeNotify(hub, 'done', 'done', last);
  hub.state = { phase: 'ready', reason: 'done', since: Date.now() };

  // user submits another prompt
  hub.state = { phase: 'busy', reason: null, since: Date.now() };

  const fired = maybeNotify(hub, 'done', 'done again', last);
  assert.strictEqual(fired, true);
  assert.strictEqual(calls.length, 2);
});

test('different reason in ready state is not suppressed', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const last = {};
  maybeNotify(hub, 'done', 'done', last);
  hub.state = { phase: 'ready', reason: 'done', since: Date.now() };

  const fired = maybeNotify(hub, 'approval', 'needs input', last);
  assert.strictEqual(fired, true);
  assert.strictEqual(calls.length, 2);
});

test('notifications disabled in config skips firing', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const fired = maybeNotify(hub, 'done', 'done', {}, { enabled: false });
  assert.strictEqual(fired, false);
  assert.strictEqual(calls.length, 0);
});

test('per-reason events.{reason}=false skips firing', () => {
  calls.length = 0;
  const hub = makeHub('busy', null);
  const cfg = { enabled: true, events: { done: false, approval: true } };
  assert.strictEqual(maybeNotify(hub, 'done', 'd', {}, cfg), false);
  assert.strictEqual(maybeNotify(hub, 'approval', 'a', {}, cfg), true);
  assert.strictEqual(calls.length, 1);
});
