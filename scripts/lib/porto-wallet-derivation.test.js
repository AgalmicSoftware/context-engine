'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');

const {
  base64UrlToBuffer,
  buildWalletFromPasskeyRawId,
  derivePrivateKeyFromPasskeyRawId,
} = require('./porto-wallet-derivation.js');

const DEFAULT_PASSKEY_RAW_ID = 'AQIDBAUGBwgJCgsMDQ4PEA';

test('derives Porto E2E wallets with the client HKDF parameters', () => {
  const privateKey = derivePrivateKeyFromPasskeyRawId(DEFAULT_PASSKEY_RAW_ID);
  const wallet = new ethers.Wallet(privateKey);

  assert.equal(
    privateKey,
    '0x4daa512883fd54723702b79af448bcc701397721e1ea82a969c35025f55b60f7',
  );
  assert.equal(wallet.address, '0xf010CB406808D7ABf0E23A9d2C8a3c27bC136B04');
});

test('does not regress to the old raw-id keccak derivation', () => {
  const rawIdBytes = base64UrlToBuffer(DEFAULT_PASSKEY_RAW_ID);
  const oldPrivateKey = ethers.utils.keccak256(rawIdBytes);
  const wallet = buildWalletFromPasskeyRawId(DEFAULT_PASSKEY_RAW_ID);

  assert.notEqual(wallet.privateKey, oldPrivateKey);
  assert.equal(new ethers.Wallet(oldPrivateKey).address, '0x1E9a72A127dAB666fd47dFAFAe15CCd9e08505eE');
});
