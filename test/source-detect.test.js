'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { detectSource } = require('../src/lib/source-detect.js');

test('detects Apple Terminal as cli', () => {
  const r = detectSource({
    __CFBundleIdentifier: 'com.apple.Terminal',
    TERM_PROGRAM: 'Apple_Terminal',
  });
  assert.strictEqual(r.source, 'claude-code-cli');
  assert.match(r.reason, /terminal bundle id/);
});

test('detects iTerm2 as cli', () => {
  const r = detectSource({ __CFBundleIdentifier: 'com.googlecode.iterm2' });
  assert.strictEqual(r.source, 'claude-code-cli');
});

test('detects VS Code integrated terminal as cli', () => {
  const r = detectSource({
    __CFBundleIdentifier: 'com.microsoft.VSCode',
    TERM_PROGRAM: 'vscode',
  });
  assert.strictEqual(r.source, 'claude-code-cli');
});

test('detects an Anthropic / Claude desktop bundle as desktop', () => {
  // We don't know the exact bundle id Claude Desktop uses; pattern-match on
  // anthropic|claude. Validate both shapes to be safe.
  for (const id of ['com.anthropic.claudefordesktop', 'ai.claude.desktop']) {
    const r = detectSource({ __CFBundleIdentifier: id });
    assert.strictEqual(r.source, 'claude-code-desktop', `for ${id}`);
    assert.match(r.reason, /Anthropic desktop bundle id/);
  }
});

test('Claude Code CLI bundle does NOT match the desktop pattern', () => {
  // Hypothetical: if Claude Code itself ever sets a bundle id with "claude"
  // it would have "claude-code" in it, which the regex excludes.
  const r = detectSource({ __CFBundleIdentifier: 'com.anthropic.claude-code' });
  // "claude(?!-?code)" excludes "claude-code", so this should NOT match desktop.
  // It also doesn't match the terminal list. The "anthropic" pattern catches it.
  // That's a known overlap — we'd rather over-classify Anthropic-ish bundles
  // as desktop than miss the real Claude Desktop. A user can always toggle.
  assert.strictEqual(r.source, 'claude-code-desktop');
});

test('TERM_PROGRAM only → cli', () => {
  const r = detectSource({ TERM_PROGRAM: 'WarpTerminal' });
  assert.strictEqual(r.source, 'claude-code-cli');
  assert.match(r.reason, /TERM_PROGRAM=WarpTerminal/);
});

test('no signals → defaults to cli (preserves old behavior)', () => {
  const r = detectSource({});
  assert.strictEqual(r.source, 'claude-code-cli');
  assert.match(r.reason, /no signal/);
});

test('DHIKRNCODE_FORCE_SOURCE override wins', () => {
  const r = detectSource({
    DHIKRNCODE_FORCE_SOURCE: 'claude-code-desktop',
    __CFBundleIdentifier: 'com.apple.Terminal',
  });
  assert.strictEqual(r.source, 'claude-code-desktop');
  assert.match(r.reason, /FORCE_SOURCE/);
});

test('hints object always returned', () => {
  const r = detectSource({
    __CFBundleIdentifier: 'com.apple.Terminal',
    TERM_PROGRAM: 'Apple_Terminal',
  });
  assert.deepStrictEqual(r.hints, {
    bundleId: 'com.apple.Terminal',
    termProgram: 'Apple_Terminal',
  });
});
