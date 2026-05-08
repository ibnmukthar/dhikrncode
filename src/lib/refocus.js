'use strict';

const { spawn } = require('child_process');

// Bring an application to the foreground using its bundle / window-class
// identifier. Best-effort; never throws — refocus is a polish, not a contract.
function refocusByBundleId(bundleId) {
  if (!bundleId) return false;

  try {
    if (process.platform === 'darwin') {
      // macOS: osascript with bundle id is the most reliable. Works even if
      // the user moved the .app to a non-default location.
      const child = spawn(
        'osascript',
        ['-e', `tell application id "${bundleId}" to activate`],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();
      return true;
    }

    // Linux: wmctrl can match by WM_CLASS — but we have a macOS-style bundle
    // id, not a WM_CLASS. We'd need a different signal on Linux. Skip for
    // now; users still get the OS notification.

    // Windows: similar — would need the process name or HWND. Skip for now.
  } catch {
    // refocus is best-effort
  }
  return false;
}

module.exports = { refocusByBundleId };
