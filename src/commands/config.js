'use strict';

const readline = require('readline');
const config = require('../lib/config-store.js');

function parseFlags(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) continue;
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    rl.question(`${question}${fallback !== undefined ? ` [${fallback}]` : ''}: `, (a) => {
      resolve(a.trim() === '' ? fallback : a.trim());
    });
  });
}

function asBool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).toLowerCase();
  if (['y', 'yes', 'true', '1', 'on'].includes(s)) return true;
  if (['n', 'no', 'false', '0', 'off'].includes(s)) return false;
  return fallback;
}

async function interactive(current) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\ndhikrncode config — press enter to keep current value\n');

  const mode = (await ask(rl, 'Mode (dhikr | quran)', current.mode)).toLowerCase();
  const patch = { mode: mode === 'quran' ? 'quran' : 'dhikr' };

  if (patch.mode === 'quran') {
    const surahStr = await ask(rl, 'Default surah number', String(current.quran.surah));
    const surah = parseInt(surahStr, 10);
    if (!Number.isNaN(surah)) patch.quran = { ...current.quran, surah };

    const trans = asBool(
      await ask(rl, 'Show translation? (y/n)', current.quran.showTranslation ? 'y' : 'n'),
      current.quran.showTranslation
    );
    patch.quran = { ...patch.quran, showTranslation: trans };
  }

  const notifEnabled = asBool(
    await ask(
      rl,
      'OS notifications when agent is ready? (y/n)',
      current.notifications.enabled ? 'y' : 'n'
    ),
    current.notifications.enabled
  );
  patch.notifications = { ...current.notifications, enabled: notifEnabled };

  if (notifEnabled) {
    const repeatStr = await ask(
      rl,
      'How many times to remind?',
      String(current.notifications.repeat)
    );
    const repeat = Math.max(1, parseInt(repeatStr, 10) || 1);
    patch.notifications.repeat = repeat;

    if (repeat > 1) {
      const intStr = await ask(
        rl,
        'Seconds between reminders',
        String(current.notifications.repeatIntervalSeconds)
      );
      const interval = Math.max(5, parseInt(intStr, 10) || 30);
      patch.notifications.repeatIntervalSeconds = interval;
    }
  }

  rl.close();
  return patch;
}

function patchFromFlags(flags, current) {
  const patch = {};
  if (flags.mode) patch.mode = flags.mode === 'quran' ? 'quran' : 'dhikr';
  if (flags.surah) {
    const s = parseInt(flags.surah, 10);
    if (!Number.isNaN(s)) patch.quran = { ...current.quran, surah: s };
  }
  if (flags.translation !== undefined) {
    patch.quran = {
      ...current.quran,
      ...(patch.quran || {}),
      showTranslation: asBool(flags.translation, true),
    };
  }
  if (flags.notifications !== undefined) {
    patch.notifications = {
      ...current.notifications,
      enabled: asBool(flags.notifications, false),
    };
  }
  if (flags.repeat !== undefined) {
    const r = Math.max(1, parseInt(flags.repeat, 10) || 1);
    patch.notifications = { ...(patch.notifications || current.notifications), repeat: r };
  }
  if (flags['repeat-interval'] !== undefined) {
    const v = Math.max(5, parseInt(flags['repeat-interval'], 10) || 30);
    patch.notifications = {
      ...(patch.notifications || current.notifications),
      repeatIntervalSeconds: v,
    };
  }
  return patch;
}

async function pushToDaemon(next) {
  // Best-effort: if a daemon is running, push the new config so the open
  // window updates without needing a manual reload. Failure is fine.
  const http = require('http');
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

async function run(argv) {
  const flags = parseFlags(argv);
  const current = config.load();

  const patch =
    Object.keys(flags).length > 0 ? patchFromFlags(flags, current) : await interactive(current);

  const next = config.update(patch);
  await pushToDaemon(next);

  console.log(`\nSaved to ${config.CONFIG_PATH}`);
  console.log(`Mode: ${next.mode}`);
  if (next.mode === 'quran') {
    console.log(`Surah: ${next.quran.surah}`);
    console.log(`Translation: ${next.quran.showTranslation ? 'on' : 'off'}`);
  }
  console.log(
    `Notifications: ${next.notifications.enabled ? 'on' : 'off'}` +
      (next.notifications.enabled ? ` (×${next.notifications.repeat})` : '')
  );
}

module.exports = { run };
