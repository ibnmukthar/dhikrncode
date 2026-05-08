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

Run with no arguments in a terminal to drop into an interactive shell.

Usage:
  dhikrncode               Open the interactive shell (REPL)
  dhikrncode init          Install Claude Code hooks (~/.claude/settings.json)
  dhikrncode uninstall     Remove Claude Code hooks
  dhikrncode config        Configure mode (dhikr | quran), surah, etc.
  dhikrncode start         Open the window now (manual mode)
  dhikrncode stop          Signal "ready" now (manual close)
  dhikrncode kill          Stop the running daemon
  dhikrncode restart       Stop daemon and re-open window
  dhikrncode daemon        Run the background daemon (usually auto-spawned)
  dhikrncode hook <event>  Internal: forward a hook event to the daemon
  dhikrncode help          Show this help
  dhikrncode version       Show version

Docs: https://github.com/<owner>/dhikrncode
`);
}

function printVersion() {
  const pkg = require('../package.json');
  console.log(pkg.version);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  // No args + interactive shell → drop into REPL.  Non-TTY (pipes, scripts)
  // keeps the help-and-exit behavior so we don't break existing tooling.
  let factory;
  if (!cmd && process.stdin.isTTY && process.stdout.isTTY) {
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
