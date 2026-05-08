'use strict';

// Distinguish Claude Code running in a real CLI/terminal from Claude Code
// running inside the Claude Desktop app. The strongest signal on macOS is
// `__CFBundleIdentifier` — a launchd-propagated env var carrying the bundle
// ID of the GUI app that ultimately launched this process tree. `TERM_PROGRAM`
// is a weaker fallback (only set by terminals).
//
// Returns: { source, reason, hints } where source is one of:
//   - 'claude-code-cli'      → governed by integrations.claudeCode
//   - 'claude-code-desktop'  → governed by integrations.claudeDesktop
//   - 'claude-code'          → unclassified (treated as cli for backward compat)
//
// `reason` is a short human-readable string explaining the classification —
// surfaced in daemon.log so users can see why we chose what we chose.

const TERMINAL_BUNDLE_IDS = [
  'com.apple.Terminal',
  'com.googlecode.iterm2',
  'dev.warp.Warp-Stable',
  'co.zeit.hyper',
  'org.alacritty',
  'net.kovidgoyal.kitty',
  'com.microsoft.VSCode',
  'com.microsoft.VSCodeInsiders',
  'com.todesktop.230313mzl4w4u92', // Cursor
  'com.zed.Zed',
  'company.thebrowser.Browser', // Arc
  'com.tabby.Tabby',
];

const ANTHROPIC_DESKTOP_PATTERNS = [/anthropic/i, /claude(?!-?code)/i];

function isTerminalBundle(id) {
  if (!id) return false;
  return TERMINAL_BUNDLE_IDS.some((t) => id.toLowerCase() === t.toLowerCase());
}

function looksLikeAnthropicDesktop(id) {
  if (!id) return false;
  return ANTHROPIC_DESKTOP_PATTERNS.some((re) => re.test(id));
}

function detectSource(env = process.env) {
  const hints = {
    bundleId: env.__CFBundleIdentifier || null,
    termProgram: env.TERM_PROGRAM || null,
  };

  // Manual override (testing, edge cases)
  if (env.DHIKRNCODE_FORCE_SOURCE) {
    return {
      source: env.DHIKRNCODE_FORCE_SOURCE,
      reason: 'DHIKRNCODE_FORCE_SOURCE env var',
      hints,
    };
  }

  // Strong signal: known terminal bundle ID → CLI
  if (isTerminalBundle(hints.bundleId)) {
    return {
      source: 'claude-code-cli',
      reason: `terminal bundle id: ${hints.bundleId}`,
      hints,
    };
  }

  // Strong signal: anthropic/claude bundle ID → Desktop
  if (looksLikeAnthropicDesktop(hints.bundleId)) {
    return {
      source: 'claude-code-desktop',
      reason: `Anthropic desktop bundle id: ${hints.bundleId}`,
      hints,
    };
  }

  // Weaker signal: TERM_PROGRAM is set → almost certainly a CLI
  if (hints.termProgram) {
    return {
      source: 'claude-code-cli',
      reason: `TERM_PROGRAM=${hints.termProgram}`,
      hints,
    };
  }

  // No clear signal — treat as generic CLI for backward compatibility
  // (preserves existing behavior; user can manually disable claudeCode if
  // they want to silence things globally).
  return {
    source: 'claude-code-cli',
    reason: 'no signal; defaulting to cli',
    hints,
  };
}

module.exports = { detectSource, isTerminalBundle, looksLikeAnthropicDesktop };
