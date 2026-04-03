'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArweaveTxId,
  normalizeRequiredMetadataUri,
} = require('../scripts/lib/e2e/arweave-metadata');

const TX_ID = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';

test('accepts canonical and alias Arweave gateway hosts', () => {
  const inputs = [
    `https://arweave.net/${TX_ID}`,
    `https://www.arweave.net/${TX_ID}`,
    `https://gateway.irys.xyz/${TX_ID}`,
    `https://subdomain.arweave.net/${TX_ID}?download=1`,
    `ar://${TX_ID}`,
    TX_ID,
  ];
  inputs.forEach((input) => {
    assert.equal(parseArweaveTxId(input), TX_ID);
  });
});

test('rejects lookalike or untrusted hosts', () => {
  const inputs = [
    `https://arweave.net.evil.com/${TX_ID}`,
    `https://evil.example/${TX_ID}`,
  ];
  inputs.forEach((input) => {
    assert.equal(parseArweaveTxId(input), '');
    assert.equal(normalizeRequiredMetadataUri(input), '');
  });
});

test('normalizes accepted metadata values to ar:// tx URIs', () => {
  assert.equal(normalizeRequiredMetadataUri(TX_ID), `ar://${TX_ID}`);
  assert.equal(normalizeRequiredMetadataUri(`https://www.arweave.net/${TX_ID}`), `ar://${TX_ID}`);
});
