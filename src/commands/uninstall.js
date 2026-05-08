'use strict';

const {
  loadSettings,
  saveSettings,
  uninstallHooks,
  SETTINGS_PATH,
} = require('../lib/settings.js');

async function run() {
  const before = loadSettings();
  const { settings, removed } = uninstallHooks(before);
  saveSettings(settings);

  if (removed.length === 0) {
    console.log('No dhikrncode hooks found in settings — nothing to remove.');
    return;
  }
  console.log(`Removed ${removed.length} hook entr${removed.length === 1 ? 'y' : 'ies'}:`);
  for (const r of removed) console.log(`  - ${r}`);
  console.log(`Updated ${SETTINGS_PATH}`);
}

module.exports = { run };
