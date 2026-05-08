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
  setup: () => require('./commands/setup.js').run,
  on: () => require('./commands/onoff.js').on.run,
  off: () => require('./commands/onoff.js').off.run,
  help: () => printHelp,
  '--help': () => printHelp,
  '-h': () => printHelp,
  version: () => printVersion,
  '--version': () => printVersion,
  '-v': () => printVersion,
};

function printHelp() {
  console.log(`dhikrncode — dhikr / Qur'an companion for AI coding sessions

Most-used:
  dhikrncode               First time: runs the setup wizard.
                           After that: opens the interactive shell.
  dhikrncode on            Quick toggle on (keeps hooks installed)
  dhikrncode off           Quick toggle off
  dhikrncode uninstall     Remove hooks, stop daemon, stop nagging

Setup / config:
  dhikrncode setup         Re-run the setup wizard
  dhikrncode init          Install hooks non-interactively (skip wizard)
  dhikrncode config        Detailed configuration

Daemon / window:
  dhikrncode start         Open the window now (manual)
  dhikrncode stop          Signal "ready" now
  dhikrncode kill          Stop the daemon
  dhikrncode restart       Stop + reopen
  dhikrncode daemon        Run daemon in foreground (debug)

Other:
  dhikrncode help          This help
  dhikrncode version       Show version
  dhikrncode hook <event>  Internal: invoked by Claude Code

Docs: https://github.com/ibnmukthar/dhikrncode
`);
}

function printVersion() {
  const pkg = require('../package.json');
  console.log(pkg.version);
}

function noticeIfHooksMissing() {
  const { loadSettings, hooksInstalled } = require('./lib/settings.js');
  const config = require('./lib/config-store.js');
  const settings = loadSettings();
  const cfg = config.load();
  if (hooksInstalled(settings)) return;
  if (cfg.meta && cfg.meta.uninstalledAt) {
    console.log('dhikrncode: hooks are not installed (you previously uninstalled).');
    console.log("Type 'init' to re-enable Claude Code integration, or 'exit' to leave.\n");
  } else {
    console.log('dhikrncode: hooks not installed. Run `dhikrncode init` to enable Claude Code integration.\n');
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  let factory;

  if (!cmd && process.stdin.isTTY && process.stdout.isTTY) {
    // First-ever run? Walk the user through setup.
    const config = require('./lib/config-store.js');
    const cfg = config.load();
    if (!cfg.meta || !cfg.meta.setupCompletedAt) {
      factory = COMMANDS.setup;
    } else {
      // Subsequent run → check hooks state, drop into REPL
      try {
        noticeIfHooksMissing();
      } catch (err) {
        console.error(`dhikrncode: ${err.message}`);
      }
      factory = COMMANDS.repl;
    }
  } else if (!cmd) {
    // Non-TTY with no command: just print help.
    factory = COMMANDS.help;
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
