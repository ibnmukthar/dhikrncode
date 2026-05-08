'use strict';

const { send } = require('../lib/daemon-client.js');

async function run() {
  await send('start', { source: 'manual' });
  console.log('dhikrncode: window opened (or already open).');
}

module.exports = { run };
