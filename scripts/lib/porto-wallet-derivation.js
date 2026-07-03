'use strict';

const crypto = require('crypto');
const { ethers } = require('ethers');

const PORTO_KDF_SALT = Buffer.from('contextengine.xyz:porto:v1', 'utf8');
const PORTO_KDF_INFO = Buffer.from('ethereum-private-key', 'utf8');

const base64UrlToBuffer = (value) => {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
};

const derivePrivateKeyFromPasskeyRawId = (rawIdB64Url) => {
  const rawIdBytes = base64UrlToBuffer(rawIdB64Url);
  const derived = crypto.hkdfSync(
    'sha256',
    rawIdBytes,
    PORTO_KDF_SALT,
    PORTO_KDF_INFO,
    32,
  );
  return `0x${Buffer.from(derived).toString('hex')}`;
};

const buildWalletFromPasskeyRawId = (rawIdB64Url, provider) => {
  const rawIdBytes = base64UrlToBuffer(rawIdB64Url);
  const privateKey = derivePrivateKeyFromPasskeyRawId(rawIdB64Url);
  const wallet = new ethers.Wallet(privateKey, provider || undefined);
  return {
    rawIdBytes,
    privateKey,
    wallet,
  };
};

module.exports = {
  base64UrlToBuffer,
  buildWalletFromPasskeyRawId,
  derivePrivateKeyFromPasskeyRawId,
};
