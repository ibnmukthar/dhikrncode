# dhikrncode

A small, calm companion that opens a **dhikr** or **Qur'an** window in
your browser while your AI coding agent is working. When the agent
finishes (or asks for input), the window winds down — quickly for dhikr,
slowly for Qur'an reading — so the time you'd otherwise spend watching
tokens scroll becomes time spent in remembrance.

Currently integrates first-class with **Claude Code** via its hooks
system. Manual mode (`dhikrncode start` / `stop`) works with anything
else.

```
┌────────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Claude Code hook  │ ──▶ │   dhikrncode CLI   │ ──▶ │   local daemon   │
│  (settings.json)   │     │   (POST /event)    │     │  (state + WS)    │
└────────────────────┘     └────────────────────┘     └────────┬─────────┘
                                                               │
                                                               ▼
                                              ┌──────────────────────────┐
                                              │  browser tab — dhikr or  │
                                              │  Qur'an, with countdown  │
                                              └──────────────────────────┘
```

---

## Install

Requires Node 18+.

```bash
npm install -g dhikrncode
dhikrncode
```

The first run drops you into a 3-question setup wizard:

```
Set up Claude Code hooks now? [Y]:
Mode — (1) dhikr   (2) qur'an [1]:
OS notifications when the agent is ready? [n]:
```

After that you can **close the terminal** — dhikrncode only runs when
Claude Code triggers it, and shuts itself down after 30 minutes idle.
The window pops up on its own.

```bash
dhikrncode off          # quick toggle (hooks stay; daemon drops events)
dhikrncode on           # quick toggle back
dhikrncode              # re-open the interactive shell
dhikrncode uninstall    # remove hooks, stop daemon, stop nagging
```

`uninstall` also remembers you opted out — running `dhikrncode` after
that won't silently turn things back on. Type `init` inside the shell
(or `dhikrncode init`) to opt back in.

## Use

Just start Claude Code as you normally would:

```bash
claude
```

Send a prompt → a browser tab opens with dhikr (default) or Qur'an
ayahs. When the agent finishes, a banner appears with a countdown.

## Configure

Three equivalent ways — all writing the same `~/.config/dhikrncode/config.json`:

### Interactive shell (`dhikrncode`)

Run `dhikrncode` with no arguments in a terminal — same idea as typing
`claude` — and you get a small REPL:

```
$ dhikrncode
dhikrncode v0.1.0 — type 'help' for commands, 'exit' to quit
mode: dhikr · daemon: down · notifications: off · integrations: claude-code, manual

› mode quran
mode: quran
› notifications on
notifications: on
› claude-code off
claude-code: off
› status
mode: quran · daemon: up · notifications: on (×1) · integrations: manual
› exit
```

If a daemon is running, every change pushes live to the open browser
window. Type `help` inside the shell for the full command list.

### Browser settings panel

Click the `⚙` gear in the top-right (or press `,`). Change mode, surah,
notifications, pacing, integrations — Save. Mode changes reload the
page; everything else applies live.

### One-shot CLI

```bash
dhikrncode config                          # interactive prompts
dhikrncode config --mode=quran --surah=1   # one-liner
dhikrncode config --notifications=true --repeat=3 --repeat-interval=20
```

## Integrations

Per-source toggles let you keep the hooks installed but pause any one
surface without uninstalling. Defaults: Claude Code CLI **on**, Manual
**on**, Claude Desktop **off**.

| Setting                              | Default | Source                                              |
|--------------------------------------|---------|-----------------------------------------------------|
| `integrations.claudeCode.enabled`    | `true`  | Claude Code in a real terminal (Terminal, iTerm, …) |
| `integrations.claudeDesktop.enabled` | `false` | Claude Code running inside Claude Desktop           |
| `integrations.manual.enabled`        | `true`  | `dhikrncode start/stop`                             |

dhikrncode classifies each hook event by inspecting macOS's
`__CFBundleIdentifier` env var (with `TERM_PROGRAM` as a fallback) and
routes it to the matching toggle. The daemon log shows the
classification on every event:

```
event: stop (phase=ready, source='claude-code-cli' — terminal bundle id: com.apple.Terminal)
event: stop skipped (source='claude-code-desktop' disabled — Anthropic desktop bundle id: com.anthropic.claudefordesktop)
```

Toggle in the shell:
```
› claude-code off       # silence the CLI integration
› claude-desktop on     # turn on the desktop one
› manual off
```

If the auto-detection misfires for your setup, override it on a
per-process basis:

```bash
DHIKRNCODE_FORCE_SOURCE=claude-code-desktop claude
```

## Notifications

OS notifications are **off by default** — the browser banner is the
primary signal. Turn them on if you want an audible / system reminder
when the agent is ready (you may want this if you Alt-Tab away
frequently). You can also configure how many times to remind and at
what interval, in case the first one doesn't catch your attention.

| Setting                            | Default | Notes                              |
|------------------------------------|---------|------------------------------------|
| `notifications.enabled`            | `false` | Master switch                      |
| `notifications.events.done`        | `true`  | Notify when agent finishes         |
| `notifications.events.approval`    | `true`  | Notify when agent needs input      |
| `notifications.repeat`             | `1`     | Total reminders per ready event    |
| `notifications.repeatIntervalSeconds` | `30`  | Gap between reminders              |

Repeats are cancelled automatically when you submit a new prompt.

## Pacing — how the window closes

| Mode    | Auto-close | Extension button     |
|---------|------------|----------------------|
| Dhikr   | 5 s        | Stay → +15 s         |
| Qur'an  | 30 s       | Finish ayah → +30 s  |

`window.close()` is best-effort — some browsers don't allow it for tabs
the user could have opened themselves. When close is blocked, the
banner shifts to "✓ You can close this tab now."

## Keyboard shortcuts

**Dhikr mode**

| Key                 | Action            |
|---------------------|-------------------|
| `←` / `h`           | Previous dhikr    |
| `→` / `l`           | Next dhikr        |
| `Space` / `↓` / `j` | Tap counter (+1)  |
| `R` / `0`           | Reset counter     |

**Qur'an mode**

| Key       | Action            |
|-----------|-------------------|
| `←` / `h` | Previous ayah     |
| `→` / `l` | Next ayah         |
| `↓` / `j` | Next surah        |
| `↑` / `k` | Previous surah    |
| `S`       | Focus surah list  |

**Always**

| Key             | Action                       |
|-----------------|------------------------------|
| `,`             | Open settings panel          |
| `Esc`           | Close settings or banner     |
| `E` / `+`       | Extend countdown (in banner) |
| `C`             | Close now (in banner)        |

## Manual mode (no hooks)

If you don't use Claude Code, or want to test the UI:

```bash
dhikrncode start    # open the window now
dhikrncode stop     # signal "ready" → countdown starts
dhikrncode kill     # stop the daemon
dhikrncode restart  # kill + start
```

## Bundled Qur'an content

Ships with: **Al-Fatiha (1)**, **Al-Asr (103)**, **Al-Kawthar (108)**,
**Al-Ikhlas (112)**, **Al-Falaq (113)**, **An-Nas (114)**.

Each surah is a JSON file in `data/quran/` with attribution. To add
more, see [CONTRIBUTING.md](./CONTRIBUTING.md#adding-a-quran-surah).

## Privacy

- Everything is local. The daemon binds to `127.0.0.1` only.
- No telemetry, no analytics, no remote calls.
- The daemon idles down after 30 minutes of no activity.

## Commands reference

| Command                 | What it does                                    |
|-------------------------|-------------------------------------------------|
| `dhikrncode`            | Interactive shell (TTY only)                    |
| `dhikrncode init`       | Install Claude Code hooks                       |
| `dhikrncode uninstall`  | Remove them                                     |
| `dhikrncode config`     | Configure (interactive or via flags)            |
| `dhikrncode start`      | Open the window now (manual)                    |
| `dhikrncode stop`       | Signal "ready" now                              |
| `dhikrncode kill`       | Stop the daemon                                 |
| `dhikrncode restart`    | Kill + start                                    |
| `dhikrncode daemon`     | Run daemon in foreground (debug)                |
| `dhikrncode hook <e>`   | Internal: invoked by Claude Code                |
| `dhikrncode help`       | Help                                            |

## Contributing

Issues and PRs welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
for the project philosophy (small, calm, local-first), how to verify
Qur'an content, and the dev workflow.

## License

MIT — see [LICENSE](./LICENSE). Bundled Qur'an translations are credited
inline in each JSON file.
