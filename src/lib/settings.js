'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const HOOK_COMMAND_PREFIX = 'dhikrncode hook ';

const HOOK_EVENTS = [
  { event: 'UserPromptSubmit', arg: 'user-prompt-submit' },
  { event: 'Notification', arg: 'notification' },
  { event: 'Stop', arg: 'stop' },
];

function loadSettings(filePath = SETTINGS_PATH) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Could not parse ${filePath}: ${err.message}. ` +
        `Please fix or remove the file and re-run.`
    );
  }
}

function saveSettings(settings, filePath = SETTINGS_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function isOurEntry(entry) {
  return (
    entry &&
    entry.type === 'command' &&
    typeof entry.command === 'string' &&
    entry.command.startsWith(HOOK_COMMAND_PREFIX)
  );
}

function installHooks(settings, { binary = 'dhikrncode' } = {}) {
  const next = { ...settings };
  next.hooks = { ...(next.hooks || {}) };
  const added = [];

  for (const { event, arg } of HOOK_EVENTS) {
    const command = `${binary} hook ${arg}`;
    const groups = Array.isArray(next.hooks[event]) ? [...next.hooks[event]] : [];

    let group = groups.find((g) => (g.matcher ?? '') === '');
    if (!group) {
      group = { matcher: '', hooks: [] };
      groups.push(group);
    } else {
      group = { ...group, hooks: [...(group.hooks || [])] };
      const idx = groups.findIndex((g) => (g.matcher ?? '') === '');
      groups[idx] = group;
    }

    const already = group.hooks.some(
      (h) => isOurEntry(h) && h.command === command
    );
    if (!already) {
      group.hooks.push({ type: 'command', command });
      added.push(event);
    }
    next.hooks[event] = groups;
  }

  return { settings: next, added };
}

function uninstallHooks(settings) {
  const next = { ...settings };
  if (!next.hooks) return { settings: next, removed: [] };
  next.hooks = { ...next.hooks };
  const removed = [];

  for (const { event } of HOOK_EVENTS) {
    const groups = next.hooks[event];
    if (!Array.isArray(groups)) continue;

    const cleanedGroups = [];
    for (const g of groups) {
      const hooks = (g.hooks || []).filter((h) => {
        if (isOurEntry(h)) {
          removed.push(`${event}: ${h.command}`);
          return false;
        }
        return true;
      });
      if (hooks.length > 0) cleanedGroups.push({ ...g, hooks });
    }

    if (cleanedGroups.length === 0) delete next.hooks[event];
    else next.hooks[event] = cleanedGroups;
  }

  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return { settings: next, removed };
}

module.exports = {
  SETTINGS_PATH,
  HOOK_EVENTS,
  HOOK_COMMAND_PREFIX,
  loadSettings,
  saveSettings,
  installHooks,
  uninstallHooks,
};
