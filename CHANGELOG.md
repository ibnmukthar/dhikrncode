# Changelog

All notable changes to dhikrncode are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## 0.1.9

- **Fix: window now reopens after a permission/question round-trip.**
  Scenario: agent asks something → window times out via the auto-close
  countdown → user answers in the terminal → agent resumes work. In
  v0.1.8 the dhikr window stayed closed because the `PreToolUse` handler
  only flipped state when it saw "ready" (it ignored "idle"). Now it
  reopens the window from any non-busy state, so the user can keep doing
  dhikr through the rest of the session.

## 0.1.8

- **Refocus the terminal when the dhikr tab closes.** When the auto-close
  countdown finishes (or you click "Close now"), the OS now switches focus
  back to the terminal app where Claude Code is running — no more clicking
  around to get back to your session. The daemon tracks the last
  `__CFBundleIdentifier` it saw on a hook event and uses
  `osascript -e 'tell application id "..." to activate'` to bring it
  forward. macOS only for now.

## 0.1.7

- **Fix: window goes back to "agent working" after permission approval.**
  Before, when Claude asked "do you want me to run X?" and you answered
  yes, the dhikr window stayed in the "ready" state and counted down to
  close — even though Claude was actively running again. Now we hook
  into `PreToolUse`, which fires immediately after approval, and flip
  the state back to busy so you can keep doing dhikr while the session
  continues.
- **Tasbeeh counter now persists.** Per-dhikr counts are saved in
  browser localStorage and survive page reloads, tab close, browser
  restart. There's also a lifetime total shown in the shortcut hint.
- **`dhikrncode on` is now self-healing.** If hooks are missing (because
  you ran `uninstall` previously, or the install was never completed),
  `on` installs them and clears the uninstalled marker. Saves the
  "I toggled on but nothing happens" confusion.
- **Auto-upgrade hooks on every `dhikrncode` run.** Existing users who
  upgrade from 0.1.6 will silently pick up the new `PreToolUse` hook
  the first time they open the shell — no need to re-run `init`.

## 0.1.6

- Add `dhikrncode doctor` — diagnoses common setup problems by checking
  PATH, dependency resolution, config, hook installation, daemon health,
  and surfacing recent errors from `daemon.log`. Run this first when
  something doesn't seem to be working.

## 0.1.5

- **First-run setup wizard.** The very first time you run `dhikrncode`,
  a short interactive setup walks you through three questions —
  install hooks now? mode (dhikr/qur'an)? OS notifications? — then
  prints "you can close this terminal now" and exits. After that, every
  subsequent `dhikrncode` opens the REPL.
- **`dhikrncode on` / `dhikrncode off` shortcuts.** Quick one-liner
  toggle that flips `integrations.claudeCode.enabled` and pushes the
  change to the running daemon. Hooks stay installed; the daemon just
  drops events while off.
- `dhikrncode setup` re-runs the wizard explicitly.
- `dhikrncode init` now also marks setup as complete, so power users
  who skip the wizard don't see it later.
- Help output is reorganized by use-case (most-used / setup / daemon /
  other).

## 0.1.4

- **One-command setup.** Running `dhikrncode` for the first time now
  auto-installs Claude Code hooks and drops into the interactive shell
  — no separate `dhikrncode init` step. New users can:

  ```bash
  npm install -g dhikrncode
  dhikrncode      # done; hooks set up, shell ready
  ```

- **Sticky uninstall.** `dhikrncode uninstall` now also stops the
  running daemon and writes `meta.uninstalledAt` to config. Subsequent
  `dhikrncode` runs respect that — they show "you previously
  uninstalled" and do **not** silently re-install. Run `init` (inside
  the shell or via `dhikrncode init`) to opt back in; that clears the
  marker.

## 0.1.3

- **Fix: closing the tab no longer stops auto-open from working.** v0.1.1
  added a 2-minute global cooldown to prevent extra tabs on queued
  prompts; that turned out to swallow legitimate re-opens after the user
  manually closed the tab. The cooldown is now scoped to "page is still
  loading" — after a real WS connect+disconnect cycle, the next prompt
  immediately opens a fresh tab. The original queued-prompt protection
  is preserved by the in-flight + page-load checks.

## 0.1.2

- **Distinguish Claude Code CLI from Claude Code in Claude Desktop.**
  Hooks now classify each event using macOS's `__CFBundleIdentifier` env
  var (with `TERM_PROGRAM` as fallback) and tag the event as
  `claude-code-cli` or `claude-code-desktop`. The two are now governed
  by separate integration toggles — Claude Desktop defaults to **off**,
  so the dhikr window will no longer pop up while you're using Claude
  Code from inside the desktop app. Toggle on via the settings panel or
  the REPL (`claude-desktop on`) if you want the window there too.
- Daemon log shows the classification reason on every event, e.g.
  `source='claude-code-cli' — terminal bundle id: com.apple.Terminal`,
  so you can verify detection at a glance.

## 0.1.1

- **Fix: queued prompts no longer open extra browser tabs.** Auto-open
  now has a 2-minute cooldown plus an 8-second grace period after a
  WebSocket disconnect, which covers brief tab-freezes and slow first-
  page-loads. Manual `dhikrncode start` still always opens a new tab.
- Daemon startup log now shows the current mode, notifications on/off,
  and which integrations are enabled — makes it obvious when a stale
  config from a previous version still has `notifications.enabled: true`.
  Disable with `dhikrncode config --notifications=false` (or the REPL).

## 0.1.0 — initial public release

First public release.

- **Interactive shell**: run `dhikrncode` with no arguments in a terminal
  to drop into a small REPL — same idea as typing `claude`. Change mode,
  toggle notifications, flip integrations, control the daemon, all from
  one prompt. Non-TTY invocations keep the help-and-exit behavior.
- **Per-source integrations toggle**: `integrations.claudeCode`,
  `integrations.claudeDesktop` (placeholder), `integrations.manual` —
  flip an agent off without uninstalling its hooks.

- Claude Code hook integration (`UserPromptSubmit`, `Notification`, `Stop`)
  via `dhikrncode init` — merges idempotently into `~/.claude/settings.json`
  and never clobbers existing user hooks.
- Local daemon (Node) on `127.0.0.1:31415` that opens a browser window
  with one of two modes:
  - **Dhikr** — large Arabic phrase, transliteration, translation, optional
    tasbeeh counter.
  - **Qur'an** — surah picker, ayah-by-ayah display with translation.
    Bundles Al-Fatiha and the last few short surahs (Al-Asr, Al-Kawthar,
    Al-Ikhlas, Al-Falaq, An-Nas).
- Auto-close countdown on agent ready, with extension button. Dhikr
  defaults to 5 s, Qur'an to 30 s.
- OS notifications: **off by default**; opt in via settings, with optional
  repeat reminders at a configurable interval.
- Settings panel in the browser window (gear icon or `,`) for changing
  mode, surah, notifications, and pacing without leaving the page.
- Keyboard shortcuts for navigation in both modes and for the ready banner.
- `dhikrncode kill` / `restart` / `start` / `stop` for manual control;
  daemon writes a PID file at `~/.cache/dhikrncode/daemon.pid`.
- 17 unit tests covering settings merge, config-store deep-merge, and
  notification debounce semantics.
