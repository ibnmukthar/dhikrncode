'use strict';

const readline = require('readline');
const config = require('../lib/config-store.js');
const {
  loadSettings,
  saveSettings,
  installHooks,
  hooksInstalled,
  SETTINGS_PATH,
} = require('../lib/settings.js');

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    const hint = fallback ? ` [${fallback}]` : '';
    rl.question(`${question}${hint}: `, (answer) => {
      resolve(answer.trim() === '' ? (fallback || '') : answer.trim());
    });
  });
}

function asYes(answer, fallback = false) {
  if (!answer) return fallback;
  return /^(y|yes|true|1|on)$/i.test(answer);
}

async function run() {
  const pkg = require('../../package.json');

  console.log();
  console.log(`Welcome to dhikrncode v${pkg.version}`);
  console.log('────────────────────────────────────────────────');
  console.log('A small companion that opens dhikr or Qur\'an in');
  console.log('your browser while your AI coding agent is working.');
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const setupHooks = asYes(
    await ask(rl, 'Set up Claude Code hooks now?', 'Y'),
    true
  );

  const modeAns = (await ask(rl, "Mode — (1) dhikr   (2) qur'an", '1')).toLowerCase();
  const mode = modeAns === '2' || /quran|qur'an/.test(modeAns) ? 'quran' : 'dhikr';

  const notifs = asYes(
    await ask(rl, 'OS notifications when the agent is ready?', 'n'),
    false
  );

  rl.close();

  // Persist preferences and mark setup complete.
  config.update({
    mode,
    notifications: { enabled: notifs },
    meta: {
      setupCompletedAt: new Date().toISOString(),
      // Wizard is the user opting *in*, so clear any stale uninstall marker.
      uninstalledAt: null,
    },
  });

  if (setupHooks) {
    const settings = loadSettings();
    if (!hooksInstalled(settings)) {
      const { settings: next } = installHooks(settings);
      saveSettings(next);
    }
  }

  console.log();
  console.log(`✓ Mode:           ${mode}`);
  console.log(`✓ Notifications:  ${notifs ? 'on' : 'off'}`);
  if (setupHooks) {
    console.log(`✓ Hooks:          installed at ${SETTINGS_PATH}`);
  } else {
    console.log("  Hooks not installed — run 'dhikrncode init' when you're ready.");
  }
  console.log();
  console.log('You can close this terminal now.');
  console.log('dhikrncode runs only when Claude Code triggers it (then auto-shuts');
  console.log('down after 30 min of idle). The window pops up on its own.');
  console.log();
  console.log('Anytime:');
  console.log('  dhikrncode off / on    quick toggle (keeps hooks installed)');
  console.log('  dhikrncode             open the interactive shell');
  console.log('  dhikrncode uninstall   remove hooks completely');
  console.log();
}

module.exports = { run };
