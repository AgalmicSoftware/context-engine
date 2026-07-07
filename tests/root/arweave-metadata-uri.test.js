'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArweaveTxId,
  normalizeRequiredMetadataUri,
} = require('../../scripts/lib/arweave-metadata');

const TX_ID = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
const CANONICAL_ARWEAVE_GATEWAY = 'https://arweave.net'; // intentional: real URL — tests allowlist enforcement
const WWW_ARWEAVE_GATEWAY = 'https://www.arweave.net'; // intentional: real URL — tests allowlist enforcement
const IRYS_GATEWAY = 'https://gateway.irys.xyz'; // intentional: real URL — tests allowlist enforcement
const SUBDOMAIN_ARWEAVE_GATEWAY = 'https://subdomain.arweave.net'; // intentional: real URL — tests allowlist enforcement

test('accepts canonical and alias Arweave gateway hosts', () => {
  const inputs = [
    `${CANONICAL_ARWEAVE_GATEWAY}/${TX_ID}`,
    `${WWW_ARWEAVE_GATEWAY}/${TX_ID}`,
    `${IRYS_GATEWAY}/${TX_ID}`,
    `${SUBDOMAIN_ARWEAVE_GATEWAY}/${TX_ID}?download=1`,
    `ar://${TX_ID}`,
    TX_ID,
  ];
  inputs.forEach((input) => {
    assert.equal(parseArweaveTxId(input), TX_ID);
  });
});

test('rejects lookalike or untrusted hosts', () => {
  const inputs = [
    `https://arweave.net.evil.example.test/${TX_ID}`, // intentional: lookalike host keeps the arweave.net prefix
    `https://evil.example.test/${TX_ID}`,
  ];
  inputs.forEach((input) => {
    assert.equal(parseArweaveTxId(input), '');
    assert.equal(normalizeRequiredMetadataUri(input), '');
  });
});

test('normalizes accepted metadata values to ar:// tx URIs', () => {
  assert.equal(normalizeRequiredMetadataUri(TX_ID), `ar://${TX_ID}`);
  assert.equal(normalizeRequiredMetadataUri(`${WWW_ARWEAVE_GATEWAY}/${TX_ID}`), `ar://${TX_ID}`);
});
