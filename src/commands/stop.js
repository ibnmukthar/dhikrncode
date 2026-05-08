'use strict';

const { send } = require('../lib/daemon-client.js');

async function run() {
  await send('stop', { source: 'manual' });
  console.log('dhikrncode: signaled "ready".');
}

module.exports = { run };
