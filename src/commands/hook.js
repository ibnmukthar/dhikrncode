'use strict';

const { send } = require('../lib/daemon-client.js');
const { detectSource } = require('../lib/source-detect.js');

const VALID = new Set(['user-prompt-submit', 'notification', 'stop']);

function readStdin(timeoutMs = 200) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function run(argv) {
  const event = argv[0];
  if (!VALID.has(event)) {
    console.error(`dhikrncode hook: unknown event "${event}"`);
    process.exit(2);
  }

  const raw = await readStdin();
  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      // ignore — Claude Code passes JSON, but if a future version doesn't,
      // we still want the hook itself to succeed.
    }
  }

  const detected = detectSource();
  try {
    await send(event, {
      source: detected.source,
      sourceReason: detected.reason,
      sourceHints: detected.hints,
      raw: payload,
    });
  } catch (err) {
    // Hooks must NEVER block the agent. Log to stderr and exit 0.
    console.error(`dhikrncode hook: ${err.message}`);
  }
  process.exit(0);
}

module.exports = { run };
