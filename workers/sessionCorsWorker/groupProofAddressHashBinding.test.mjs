import test from 'node:test';
import assert from 'node:assert/strict';

import { createGroupProofAddressHashHelpersWithWorkerDeps } from './groupProofAddressHashBinding.js';

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const SBT_ADDRESS = '0x0000000000000000000000000000000000000101';
const RECIPIENT = '0x00000000000000000000000000000000000000aa';
const SIGNER = '0x00000000000000000000000000000000000000bb';
const GROUP_HASH = `0x${'1'.repeat(64)}`;

test('createGroupProofAddressHashHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createGroupProofAddressHashHelpersWithWorkerDeps();

  assert.equal(typeof helpers.normalizeAddressLower, 'function');
  assert.equal(typeof helpers.computeGroupMintMessageHash, 'function');
  assert.equal(typeof helpers.verifyGroupSignatureForFaucet, 'function');
});

test('createGroupProofAddressHashHelpersWithWorkerDeps preserves address normalization and getAddress fallback behavior', () => {
  const calls = [];
  const helpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: (value) => {
        calls.push(value);
        if (value.toLowerCase() === SIGNER.toLowerCase()) {
          throw new Error('checksum failed');
        }
        return value.toUpperCase();
      },
    },
  });

  assert.equal(helpers.normalizeAddressLower(SBT_ADDRESS), SBT_ADDRESS.toLowerCase());
  assert.equal(helpers.normalizeAddressLower(SIGNER), SIGNER.toLowerCase());
  assert.equal(helpers.normalizeAddressLower('not-an-address'), '');
  assert.deepEqual(calls, [SBT_ADDRESS, SIGNER]);
});

test('createGroupProofAddressHashHelpersWithWorkerDeps preserves group mint hash address validation and hashing inputs', () => {
  const calls = [];
  const helpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    deps: {
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: (value) => `canon:${value.toLowerCase()}`,
      solidityKeccak256: (types, values) => {
        calls.push([types, values]);
        return '0xgroup-hash';
      },
    },
  });

  assert.equal(
    helpers.computeGroupMintMessageHash({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
    }),
    '0xgroup-hash',
  );
  assert.deepEqual(calls, [[
    ['address', 'address'],
    [`canon:${SBT_ADDRESS.toLowerCase()}`, `canon:${RECIPIENT.toLowerCase()}`],
  ]]);
  assert.throws(
    () => helpers.computeGroupMintMessageHash({
      sbtAddress: 'bad',
      recipientAddress: RECIPIENT,
    }),
    /Invalid address for group faucet proof\./,
  );
});

test('createGroupProofAddressHashHelpersWithWorkerDeps preserves missing signature and missing password hash failures', () => {
  const helpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    constants: {
      zeroBytes32: ZERO_BYTES32,
    },
  });

  assert.deepEqual(
    helpers.verifyGroupSignatureForFaucet({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
      signature: '',
      expectedGroupPasswordHash: GROUP_HASH,
    }),
    { ok: false, status: 400, error: 'Missing group signature.' },
  );
  assert.deepEqual(
    helpers.verifyGroupSignatureForFaucet({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
      signature: '0xsigned',
      expectedGroupPasswordHash: ZERO_BYTES32,
    }),
    { ok: false, status: 400, error: 'Missing group password hash.' },
  );
});

test('createGroupProofAddressHashHelpersWithWorkerDeps preserves successful group signature verification', () => {
  const calls = [];
  const helpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: (value) => value.toLowerCase(),
      getBytes: (value) => {
        calls.push(['getBytes', value]);
        return `bytes:${value}`;
      },
      verifyMessage: (message, signature) => {
        calls.push(['verifyMessage', message, signature]);
        return `0x${SIGNER.slice(2).toUpperCase()}`;
      },
      solidityKeccak256: (types, values) => {
        calls.push(['solidityKeccak256', types, values]);
        if (types.length === 2) return '0xmessage-hash';
        return GROUP_HASH;
      },
    },
    constants: {
      zeroBytes32: ZERO_BYTES32,
    },
  });

  assert.deepEqual(
    helpers.verifyGroupSignatureForFaucet({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
      signature: '0xsigned',
      expectedGroupPasswordHash: GROUP_HASH,
    }),
    { ok: true, signer: SIGNER.toLowerCase() },
  );
  assert.deepEqual(calls, [
    ['solidityKeccak256', ['address', 'address'], [SBT_ADDRESS.toLowerCase(), RECIPIENT.toLowerCase()]],
    ['getBytes', '0xmessage-hash'],
    ['verifyMessage', 'bytes:0xmessage-hash', '0xsigned'],
    ['solidityKeccak256', ['address'], [SIGNER.toLowerCase()]],
  ]);
});

test('createGroupProofAddressHashHelpersWithWorkerDeps preserves invalid signature and thrown error normalization', () => {
  const invalidHelpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: (value) => value.toLowerCase(),
      getBytes: (value) => value,
      verifyMessage: () => 'not-an-address',
      solidityKeccak256: (types) => (types.length === 2 ? '0xmessage-hash' : GROUP_HASH),
    },
    constants: {
      zeroBytes32: ZERO_BYTES32,
    },
  });

  assert.deepEqual(
    invalidHelpers.verifyGroupSignatureForFaucet({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
      signature: '0xsigned',
      expectedGroupPasswordHash: GROUP_HASH,
    }),
    { ok: false, status: 403, error: 'Invalid group signature.' },
  );

  const errorHelpers = createGroupProofAddressHashHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: (value) => value.toLowerCase(),
      getBytes: () => {
        throw new Error('getBytes unavailable');
      },
      verifyMessage: () => SIGNER,
      solidityKeccak256: () => '0xmessage-hash',
    },
    constants: {
      zeroBytes32: ZERO_BYTES32,
    },
  });

  assert.deepEqual(
    errorHelpers.verifyGroupSignatureForFaucet({
      sbtAddress: SBT_ADDRESS,
      recipientAddress: RECIPIENT,
      signature: '0xsigned',
      expectedGroupPasswordHash: GROUP_HASH,
    }),
    { ok: false, status: 400, error: 'getBytes unavailable' },
  );
});
