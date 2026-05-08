'use strict';

const COMMANDS = {
  init: () => require('./commands/init.js').run,
  uninstall: () => require('./commands/uninstall.js').run,
  hook: () => require('./commands/hook.js').run,
  daemon: () => require('./commands/daemon.js').run,
  config: () => require('./commands/config.js').run,
  start: () => require('./commands/start.js').run,
  stop: () => require('./commands/stop.js').run,
  kill: () => require('./commands/kill.js').run,
  restart: () => async () => {
    await require('./commands/kill.js').run();
    await require('./commands/start.js').run();
  },
  repl: () => require('./commands/repl.js').run,
  shell: () => require('./commands/repl.js').run,
  help: () => printHelp,
  '--help': () => printHelp,
  '-h': () => printHelp,
  version: () => printVersion,
  '--version': () => printVersion,
  '-v': () => printVersion,
};

function printHelp() {
  console.log(`dhikrncode — dhikr / Qur'an companion for AI coding sessions

Quick start:
  dhikrncode               Run with no args — sets up Claude Code hooks
                           on first run, then drops into the interactive shell
  dhikrncode uninstall     Remove hooks, stop the daemon, stop nagging

Other commands:
  dhikrncode init          Manually install Claude Code hooks
  dhikrncode config        Configure (or use the shell)
  dhikrncode start         Open the window now (manual)
  dhikrncode stop          Signal "ready" now
  dhikrncode kill          Stop the running daemon
  dhikrncode restart       Stop daemon and re-open window
  dhikrncode daemon        Run daemon in foreground (debug)
  dhikrncode hook <event>  Internal: invoked by Claude Code
  dhikrncode help          This help
  dhikrncode version       Show version

Docs: https://github.com/ibnmukthar/dhikrncode
`);
}

function printVersion() {
  const pkg = require('../package.json');
  console.log(pkg.version);
}

async function autoSetupIfNeeded() {
  const {
    loadSettings,
    saveSettings,
    installHooks,
    hooksInstalled,
  } = require('./lib/settings.js');
  const config = require('./lib/config-store.js');

  const settings = loadSettings();
  const cfg = config.load();
  const previouslyUninstalled = cfg.meta && cfg.meta.uninstalledAt;

  if (hooksInstalled(settings)) return; // nothing to do

  if (previouslyUninstalled) {
    console.log('dhikrncode: hooks are not installed (you previously uninstalled).');
    console.log("Type 'init' to re-enable Claude Code integration, or 'exit' to leave.\n");
    return;
  }

  // First-time setup: install hooks silently for new users.
  const { settings: next, added } = installHooks(settings);
  saveSettings(next);
  if (added.length > 0) {
    console.log('✓ Set up Claude Code hooks (~/.claude/settings.json)');
    console.log('  Run `uninstall` inside the shell to remove them.\n');
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  // No args + interactive shell → drop into REPL.  Non-TTY (pipes, scripts)
  // keeps the help-and-exit behavior so we don't break existing tooling.
  let factory;
  if (!cmd && process.stdin.isTTY && process.stdout.isTTY) {
    try {
      await autoSetupIfNeeded();
    } catch (err) {
      console.error(`dhikrncode: setup check failed: ${err.message}`);
    }
    factory = COMMANDS.repl;
  } else {
    factory = COMMANDS[cmd] || COMMANDS.help;
  }

  const fn = factory();
  try {
    await fn(rest);
  } catch (err) {
    console.error(`dhikrncode: ${err.message}`);
    if (process.env.DHIKRNCODE_DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
