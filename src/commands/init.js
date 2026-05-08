'use strict';

const {
  loadSettings,
  saveSettings,
  installHooks,
  SETTINGS_PATH,
} = require('../lib/settings.js');
const config = require('../lib/config-store.js');

async function run() {
  const before = loadSettings();
  const { settings, added } = installHooks(before);
  saveSettings(settings);

  // Clear any previous "you uninstalled" marker so the REPL stops nagging.
  // Also mark setup as complete so we don't re-prompt the wizard.
  config.update({
    meta: {
      uninstalledAt: null,
      setupCompletedAt: new Date().toISOString(),
    },
  });

  console.log(`dhikrncode: wrote ${SETTINGS_PATH}`);
  if (added.length === 0) {
    console.log('Hooks were already installed — nothing to add.');
  } else {
    console.log(`Added hooks for: ${added.join(', ')}`);
  }
  console.log(
    `\nNext: open Claude Code in any project, send any prompt, and a dhikr / Qur'an window will pop up.\n` +
      `Configure with:  dhikrncode  (then type 'help')\n` +
      `Remove with:     dhikrncode uninstall`
  );
}

module.exports = { run };
