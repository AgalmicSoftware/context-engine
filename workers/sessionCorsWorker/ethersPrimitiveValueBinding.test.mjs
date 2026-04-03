import test from 'node:test';
import assert from 'node:assert/strict';

import { createEthersPrimitiveValueHelpersWithWorkerDeps } from './ethersPrimitiveValueBinding.js';

test('createEthersPrimitiveValueHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createEthersPrimitiveValueHelpersWithWorkerDeps();

  assert.equal(typeof helpers.normalizeSessionIdHex, 'function');
  assert.equal(typeof helpers.toBigInt, 'function');
  assert.equal(typeof helpers.isAddress, 'function');
  assert.equal(typeof helpers.getAddress, 'function');
  assert.equal(typeof helpers.verifyMessage, 'function');
  assert.equal(typeof helpers.getBytes, 'function');
  assert.equal(typeof helpers.solidityKeccak256, 'function');
  assert.equal(typeof helpers.parseEther, 'function');
  assert.equal(typeof helpers.formatEther, 'function');
});

test('createEthersPrimitiveValueHelpersWithWorkerDeps preserves session id canonicalization', () => {
  const { normalizeSessionIdHex } = createEthersPrimitiveValueHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  assert.equal(normalizeSessionIdHex(''), '');
  assert.equal(
    normalizeSessionIdHex('0xABCDEF0123456789ABCDEF0123456789'),
    '0xabcdef0123456789abcdef0123456789',
  );
  assert.equal(
    normalizeSessionIdHex('ab cd-ef01_2345 6789ABCD EF0123456789'),
    '0xabcdef0123456789abcdef0123456789',
  );
  assert.equal(normalizeSessionIdHex('0x1234'), '');
});

test('createEthersPrimitiveValueHelpersWithWorkerDeps preserves bigint coercion and fallback behavior', () => {
  const { toBigInt } = createEthersPrimitiveValueHelpersWithWorkerDeps();

  assert.equal(toBigInt(7n), 7n);
  assert.equal(toBigInt(9.8), 9n);
  assert.equal(toBigInt('42'), 42n);
  assert.equal(toBigInt({ toString: () => '13' }), 13n);
  assert.equal(toBigInt('bad'), 0n);
  assert.equal(toBigInt({ toString: () => 'bad' }), 0n);
  assert.equal(toBigInt(undefined), 0n);
});

test('createEthersPrimitiveValueHelpersWithWorkerDeps preserves primary ethers precedence', () => {
  const calls = [];

  const helpers = createEthersPrimitiveValueHelpersWithWorkerDeps({
    deps: {
      ethers: {
        utils: {
          isAddress: () => false,
          getAddress: () => 'fallback',
        },
        isAddress: (value) => {
          calls.push(['isAddress', value]);
          return true;
        },
        getAddress: (value) => {
          calls.push(['getAddress', value]);
          return `primary:${value}`;
        },
      },
    },
  });

  assert.equal(helpers.isAddress('0xabc'), true);
  assert.equal(helpers.getAddress('0xabc'), 'primary:0xabc');
  assert.deepEqual(calls, [
    ['isAddress', '0xabc'],
    ['getAddress', '0xabc'],
  ]);
});

test('createEthersPrimitiveValueHelpersWithWorkerDeps preserves utils fallback order for message, bytes, hash, and ether helpers', () => {
  const calls = [];
  const helpers = createEthersPrimitiveValueHelpersWithWorkerDeps({
    deps: {
      ethers: {
        utils: {
          verifyMessage: (message, signature) => {
            calls.push(['verifyMessage', message, signature]);
            return '0xrecovered';
          },
          arrayify: (value) => {
            calls.push(['arrayify', value]);
            return Uint8Array.from([1, 2, 3]);
          },
          solidityKeccak256: (types, values) => {
            calls.push(['solidityKeccak256', types, values]);
            return '0xhash';
          },
          parseEther: (value) => {
            calls.push(['parseEther', value]);
            return 200n;
          },
          formatEther: (value) => {
            calls.push(['formatEther', value]);
            return '0.2';
          },
        },
      },
    },
  });

  assert.equal(helpers.verifyMessage('hello', '0xsig'), '0xrecovered');
  assert.deepEqual(Array.from(helpers.getBytes('0x1234')), [1, 2, 3]);
  assert.equal(helpers.solidityKeccak256(['address'], ['0xabc']), '0xhash');
  assert.equal(helpers.parseEther('0.2'), 200n);
  assert.equal(helpers.formatEther('200'), '0.2');
  assert.deepEqual(calls, [
    ['verifyMessage', 'hello', '0xsig'],
    ['arrayify', '0x1234'],
    ['solidityKeccak256', ['address'], ['0xabc']],
    ['parseEther', '0.2'],
    ['formatEther', '200'],
  ]);
});

test('createEthersPrimitiveValueHelpersWithWorkerDeps preserves unavailable fallbacks and raw-address passthrough', () => {
  const helpers = createEthersPrimitiveValueHelpersWithWorkerDeps();

  assert.equal(helpers.isAddress('0xabc'), false);
  assert.equal(helpers.getAddress('0xabc'), '0xabc');
  assert.throws(() => helpers.verifyMessage('hello', '0xsig'), /verifyMessage unavailable/);
  assert.throws(() => helpers.getBytes('0x1234'), /getBytes unavailable/);
  assert.throws(() => helpers.solidityKeccak256(['address'], ['0xabc']), /solidityKeccak256 unavailable/);
  assert.throws(() => helpers.parseEther('0.2'), /parseEther unavailable/);
  assert.throws(() => helpers.formatEther('200'), /formatEther unavailable/);
});
