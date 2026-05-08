'use strict';

const {
  loadSettings,
  saveSettings,
  installHooks,
  SETTINGS_PATH,
} = require('../lib/settings.js');

async function run() {
  const before = loadSettings();
  const { settings, added } = installHooks(before);
  saveSettings(settings);

  console.log(`dhikrncode: wrote ${SETTINGS_PATH}`);
  if (added.length === 0) {
    console.log('Hooks were already installed — nothing to add.');
  } else {
    console.log(`Added hooks for: ${added.join(', ')}`);
  }
  console.log(
    `\nTry it: open Claude Code in a project, send any prompt, and a dhikr/Qur'an window should pop up.\n` +
      `Configure with:  dhikrncode config\n` +
      `Remove with:     dhikrncode uninstall`
  );
}

module.exports = { run };
