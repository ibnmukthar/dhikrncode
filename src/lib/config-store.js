'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, 'dhikrncode')
  : path.join(os.homedir(), '.config', 'dhikrncode');

const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  mode: 'dhikr', // 'dhikr' | 'quran'
  quran: {
    surah: 1, // Al-Fatiha (bundled by default; add more surahs in data/quran/)
    showTranslation: true,
    showTransliteration: false,
  },
  dhikr: {
    autoAdvanceSeconds: 0, // 0 = manual via Next button
    counter: true,
  },
  pacing: {
    dhikrCloseSeconds: 5,
    quranCloseSeconds: 30,
    dhikrExtendSeconds: 15,
    quranExtendSeconds: 30,
  },
  notifications: {
    // OS notifications. Off by default — the browser banner is the primary
    // signal. Turn on for an audible/system reminder when the agent is ready.
    enabled: false,
    events: {
      done: true,
      approval: true,
    },
    repeat: 1, // total notifications per ready transition (1 = no repeat)
    repeatIntervalSeconds: 30,
  },
  integrations: {
    // Which event sources can drive the daemon. Lets you keep the hooks
    // installed but temporarily silence Claude Code (e.g., during a focused
    // refactor) by flipping one switch.
    claudeCode: { enabled: true, autoOpenWindow: true },
    claudeDesktop: { enabled: false }, // placeholder; needs MCP integration
    manual: { enabled: true },
  },
  daemon: {
    port: 31415,
    host: '127.0.0.1',
  },
  meta: {
    // ISO timestamp set by `dhikrncode uninstall` and cleared by `init`.
    // While set, `dhikrncode` (REPL) will NOT silently re-install hooks.
    uninstalledAt: null,
    // ISO timestamp set when the first-run wizard finishes. While null,
    // running `dhikrncode` triggers the wizard.
    setupCompletedAt: null,
  },
};

function deepMerge(base, override) {
  if (override === undefined || override === null) return base;
  if (typeof base !== 'object' || Array.isArray(base)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    if (
      typeof base[k] === 'object' &&
      base[k] !== null &&
      !Array.isArray(base[k]) &&
      typeof override[k] === 'object' &&
      override[k] !== null &&
      !Array.isArray(override[k])
    ) {
      out[k] = deepMerge(base[k], override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}

function load() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return deepMerge(DEFAULTS, stored);
  } catch {
    return { ...DEFAULTS };
  }
}

function save(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function update(patch) {
  const next = deepMerge(load(), patch);
  save(next);
  return next;
}

module.exports = { CONFIG_DIR, CONFIG_PATH, DEFAULTS, load, save, update };
