'use strict';

let notifier = null;
function get() {
  if (notifier !== null) return notifier;
  try {
    notifier = require('node-notifier');
  } catch {
    notifier = false;
  }
  return notifier;
}

function notify({ title, message }) {
  const n = get();
  if (!n) return;
  try {
    n.notify({ title, message, sound: false, wait: false });
  } catch {
    // best-effort; never fail the daemon over a notification
  }
}

module.exports = { notify };
