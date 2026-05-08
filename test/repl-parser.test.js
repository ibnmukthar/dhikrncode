'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseLine } = require('../src/commands/repl.js');

test('parseLine splits on whitespace, lowercases command', () => {
  assert.deepStrictEqual(parseLine('mode quran'), { cmd: 'mode', args: ['quran'] });
  assert.deepStrictEqual(parseLine('  Mode   Quran  '), {
    cmd: 'mode',
    args: ['Quran'],
  });
});

test('empty / whitespace lines parse to empty cmd', () => {
  assert.deepStrictEqual(parseLine(''), { cmd: '', args: [] });
  assert.deepStrictEqual(parseLine('   '), { cmd: '', args: [] });
});

test('multi-arg commands keep extra args', () => {
  assert.deepStrictEqual(parseLine('repeat-interval 60'), {
    cmd: 'repeat-interval',
    args: ['60'],
  });
  assert.deepStrictEqual(parseLine('foo a b c'), {
    cmd: 'foo',
    args: ['a', 'b', 'c'],
  });
});

test('case-insensitive on cmd, preserves arg case', () => {
  const r = parseLine('Notifications ON');
  assert.strictEqual(r.cmd, 'notifications');
  assert.strictEqual(r.args[0], 'ON');
});
