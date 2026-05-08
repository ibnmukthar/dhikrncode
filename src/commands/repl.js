'use strict';

const readline = require('readline');
const http = require('http');
const config = require('../lib/config-store.js');
const { isDaemonUp } = require('../lib/daemon-client.js');

const PROMPT = '› '; // ›

function parseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return { cmd: '', args: [] };
  const parts = trimmed.split(/\s+/);
  return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
}

function asBool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).toLowerCase();
  if (['y', 'yes', 'true', '1', 'on'].includes(s)) return true;
  if (['n', 'no', 'false', '0', 'off'].includes(s)) return false;
  return fallback;
}

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
        resolve(true);
      }
    );
    req.setTimeout(500, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

async function applyPatch(patch) {
  const next = config.update(patch);
  await pushToDaemon(next);
  return next;
}

function listEnabledIntegrations(cfg) {
  const out = [];
  if (cfg.integrations.claudeCode.enabled) out.push('claude-code');
  if (cfg.integrations.claudeDesktop.enabled) out.push('claude-desktop');
  if (cfg.integrations.manual.enabled) out.push('manual');
  return out.length ? out.join(', ') : 'none';
}

async function statusLine(cfg) {
  const up = await isDaemonUp(cfg.daemon);
  return [
    `mode: ${cfg.mode}`,
    `daemon: ${up ? 'up' : 'down'}`,
    `notifications: ${cfg.notifications.enabled ? `on (×${cfg.notifications.repeat})` : 'off'}`,
    `integrations: ${listEnabledIntegrations(cfg)}`,
  ].join(' · ');
}

const HELP = `Commands:
  mode <dhikr|quran>          switch mode
  surah <n>                   set default surah (qur'an mode)
  translation <on|off>        toggle translation
  notifications <on|off>      OS notifications when agent ready
  repeat <n>                  reminders per ready event
  repeat-interval <seconds>   gap between reminders
  claude-code <on|off>        toggle that integration
  claude-desktop <on|off>     (placeholder; not wired yet)
  manual <on|off>             toggle manual mode
  start | stop                open / signal-ready window
  kill | restart              daemon control
  init | uninstall            install/remove Claude Code hooks
  status | s                  print current state
  config                      pretty-print full config
  help | ?                    this help
  exit | quit | q             leave (Ctrl+D works too)`;

async function dispatch(cmd, args, ctx) {
  const { rl } = ctx;
  let cfg = config.load();

  const setterOnOff = (path, label) => async (v) => {
    const onoff = asBool(v, true);
    const parts = path.split('.');
    const patch = {};
    let cur = patch;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = onoff;
    await applyPatch(patch);
    return `${label}: ${onoff ? 'on' : 'off'}`;
  };

  switch (cmd) {
    case '':
      return null;

    case 'help':
    case '?':
      return HELP;

    case 'exit':
    case 'quit':
    case 'q':
      rl.close();
      return null;

    case 'status':
    case 's':
      return statusLine(cfg);

    case 'config': {
      return JSON.stringify(cfg, null, 2);
    }

    case 'mode': {
      const m = (args[0] || '').toLowerCase();
      if (m !== 'dhikr' && m !== 'quran') return "usage: mode <dhikr|quran>";
      await applyPatch({ mode: m });
      return `mode: ${m}`;
    }

    case 'surah': {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n) || n < 1 || n > 114) return 'usage: surah <1-114>';
      await applyPatch({ quran: { ...cfg.quran, surah: n } });
      return `surah: ${n}`;
    }

    case 'translation':
      return await setterOnOff('quran.showTranslation', 'translation')(args[0]);

    case 'notifications':
    case 'notify':
      return await setterOnOff('notifications.enabled', 'notifications')(args[0]);

    case 'repeat': {
      const n = Math.max(1, parseInt(args[0], 10) || 0);
      if (!n) return 'usage: repeat <n> (>=1)';
      await applyPatch({ notifications: { ...cfg.notifications, repeat: n } });
      return `repeat: ${n}`;
    }

    case 'repeat-interval': {
      const n = Math.max(5, parseInt(args[0], 10) || 0);
      if (!n) return 'usage: repeat-interval <seconds> (>=5)';
      await applyPatch({
        notifications: { ...cfg.notifications, repeatIntervalSeconds: n },
      });
      return `repeat-interval: ${n}s`;
    }

    case 'claude-code':
      return await setterOnOff('integrations.claudeCode.enabled', 'claude-code')(args[0]);

    case 'claude-desktop':
      return await setterOnOff(
        'integrations.claudeDesktop.enabled',
        'claude-desktop'
      )(args[0]);

    case 'manual':
      return await setterOnOff('integrations.manual.enabled', 'manual')(args[0]);

    case 'start':
      await require('./start.js').run();
      return null;

    case 'stop':
      await require('./stop.js').run();
      return null;

    case 'kill':
      await require('./kill.js').run();
      return null;

    case 'restart':
      await require('./kill.js').run();
      await new Promise((r) => setTimeout(r, 200));
      await require('./start.js').run();
      return null;

    case 'init':
      await require('./init.js').run();
      return null;

    case 'uninstall':
      await require('./uninstall.js').run();
      return null;

    default:
      return `unknown command: ${cmd}  (type 'help')`;
  }
}

async function run() {
  const pkg = require('../../package.json');
  const cfg = config.load();
  console.log(`dhikrncode v${pkg.version} — type 'help' for commands, 'exit' to quit`);
  console.log(await statusLine(cfg));
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    terminal: true,
  });

  const ctx = { rl };
  rl.prompt();

  rl.on('line', async (line) => {
    const { cmd, args } = parseLine(line);
    try {
      const out = await dispatch(cmd, args, ctx);
      if (out) console.log(out);
    } catch (err) {
      console.error(`error: ${err.message}`);
    }
    if (rl.closed) return;
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\ngoodbye');
    process.exit(0);
  });
}

module.exports = { run, parseLine, dispatch };
