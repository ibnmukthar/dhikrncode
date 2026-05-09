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
  // PreToolUse fires on every tool execution including the one immediately
  // after the user approves a permission prompt. We use it to flip the
  // window state from "ready (approval)" back to "busy" when the agent
  // resumes work, so users can keep doing dhikr while the session continues.
  { event: 'PreToolUse', arg: 'pre-tool-use' },
  // PostToolUse fires the moment a tool finishes — including AskUserQuestion
  // and similar interactive tools. It's our signal that the user just
  // answered something in the terminal and the agent is back to processing
  // (which may not call another tool for a while), so we use it to keep the
  // dhikr window in front during the "Updating..." kind of pause.
  { event: 'PostToolUse', arg: 'post-tool-use' },
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

function hooksInstalled(settings) {
  if (!settings || !settings.hooks) return false;
  for (const event of Object.values(settings.hooks)) {
    if (!Array.isArray(event)) continue;
    for (const group of event) {
      for (const h of group.hooks || []) {
        if (isOurEntry(h)) return true;
      }
    }
  }
  return false;
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
  hooksInstalled,
};
