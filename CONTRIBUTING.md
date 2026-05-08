# Contributing to dhikrncode

Thanks for considering a contribution. This is a small, focused tool
intended to remain small and focused — please read the philosophy below
before opening a large PR.

## Philosophy

- **Calm UI, no dark patterns.** The window is meant to invite remembrance,
  not capture attention. No upsells, no streaks, no gamification.
- **Local-first, zero telemetry.** All data stays on the user's machine.
  The daemon binds to `127.0.0.1` only.
- **Respect for the source material.** Any Qur'an content added must be
  proofread against a trusted reference (mushaf or `tanzil.net` for the
  Arabic text). Translations should cite their source in the JSON file.
- **Minimal dependencies.** v0.1 has three runtime deps (`open`,
  `node-notifier`, `ws`). New deps require justification.

## Development setup

```bash
git clone https://github.com/ibnmukthar/dhikrncode
cd dhikrncode
npm install
npm test
```

To run the daemon against your local clone without installing globally:

```bash
DHIKRNCODE_NOOPEN=1 node bin/dhikrncode.js daemon
# in another shell:
curl -X POST -H 'Content-Type: application/json' \
  -d '{"type":"user-prompt-submit"}' http://127.0.0.1:31415/event
open http://127.0.0.1:31415/
```

`DHIKRNCODE_NOOPEN=1` skips the auto browser launch — useful when iterating
on the daemon and you don't want a new tab on every restart.

## Architecture (one screen)

```
Claude Code hook  →  dhikrncode hook <event>  →  POST /event  →  daemon
                                                                    │
                                                            WS push │
                                                                    ▼
                                                   browser tab (UI page)
```

- `bin/dhikrncode.js` — `#!/usr/bin/env node` shim
- `src/cli.js` — command dispatch
- `src/commands/*.js` — one file per subcommand
- `src/lib/settings.js` — Claude Code `settings.json` read / merge / write
- `src/lib/config-store.js` — user-level config at
  `~/.config/dhikrncode/config.json`
- `src/lib/daemon-client.js` — talks to the daemon, auto-spawns it
- `src/lib/window.js` — opens the browser
- `src/lib/notify.js` — `node-notifier` wrapper
- `src/ui/` — vanilla-JS browser page (no framework)
- `data/` — bundled adhkar and surahs

## Adding a Qur'an surah

Drop a JSON file into `data/quran/` shaped like
[001-al-fatiha.json](data/quran/001-al-fatiha.json):

```json
{
  "number": 67,
  "name": "الملك",
  "englishName": "Al-Mulk",
  "englishTranslation": "The Sovereignty",
  "revelationType": "Meccan",
  "_attribution": "Arabic from tanzil.net (CC). English from <source>.",
  "ayahs": [
    { "number": 1, "arabic": "تَبَارَكَ ...", "translation": "Blessed ..." }
  ]
}
```

Filename convention: `NNN-slug.json` (e.g., `067-al-mulk.json`).

**Verification before merging:** at least one reviewer must confirm the
Arabic text against a mushaf or against tanzil.net's Uthmani text.

## Testing

```bash
npm test              # all tests
node --test test/settings.test.js
```

Unit tests are intentionally light. End-to-end behavior is exercised by
running the daemon and `curl`ing endpoints (see "Development setup"
above) — no headless browser harness yet.

## Pull request checklist

1. Tests pass (`npm test`).
2. No new runtime dependency without discussion in the PR.
3. New strings (UI labels, CLI output) read calmly and respectfully.
4. If you touched the Qur'an data, the PR description includes which
   reference you cross-checked against.
5. CHANGELOG.md updated under `## Unreleased`.

## Reporting issues

Bug reports are most useful when they include:

- `dhikrncode version`
- The contents of `~/.cache/dhikrncode/daemon.log`
- Your `~/.claude/settings.json` (redact other hooks if you'd like)

## Code of conduct

Treat each other with adab — patience, fairness, and the assumption of
good faith. No personal attacks, no theological policing, no proselytizing
in code review. The goal is a useful, peaceful tool.
