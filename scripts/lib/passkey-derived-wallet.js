'use strict';

const crypto = require('crypto');
const { ethers } = require('ethers');

const DEFAULT_PASSKEY_RAW_ID_B64URL = 'AQIDBAUGBwgJCgsMDQ4PEA';
const DEFAULT_RP_ID = 'localhost';
const DEFAULT_DERIVATION_NAMESPACE = 'context-engine';
const DERIVATION_VERSION = 'passkey-prf-hkdf-secp256k1-v1';
const SECP256K1_ORDER_HEX = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

const normalizeRpId = (value) => String(value || DEFAULT_RP_ID).trim().toLowerCase() || DEFAULT_RP_ID;

const normalizeDerivationNamespace = (value) => (
  String(value || DEFAULT_DERIVATION_NAMESPACE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || DEFAULT_DERIVATION_NAMESPACE
);

const base64UrlToBuffer = (value) => {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
};

const bufferToBase64Url = (value) => (
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const isValidPrivateKeyHex = (hex) => (
  /^[0-9a-f]{64}$/.test(hex) &&
  hex !== '0'.repeat(64) &&
  hex < SECP256K1_ORDER_HEX
);

const getPasskeyDerivedPrfSalt = ({
  rpId = DEFAULT_RP_ID,
  derivationNamespace = DEFAULT_DERIVATION_NAMESPACE,
} = {}) => (
  sha256(`context-engine:passkey-derived-prf-salt:v1:${normalizeRpId(rpId)}:${normalizeDerivationNamespace(derivationNamespace)}`)
);

const deriveE2ePasskeyPrfOutput = (credentialId) => (
  sha256(`ce-e2e-passkey-prf:${String(credentialId || DEFAULT_PASSKEY_RAW_ID_B64URL).trim()}`)
);

const derivePasskeyEoaPrivateKey = ({
  prfOutput,
  rpId = DEFAULT_RP_ID,
  derivationNamespace = DEFAULT_DERIVATION_NAMESPACE,
} = {}) => {
  const normalizedRpId = normalizeRpId(rpId);
  const namespace = normalizeDerivationNamespace(derivationNamespace);
  const inputKeyMaterial = Buffer.from(prfOutput || deriveE2ePasskeyPrfOutput(DEFAULT_PASSKEY_RAW_ID_B64URL));
  const salt = Buffer.from(`context-engine:passkey-derived-eoa-salt:v1:${normalizedRpId}:${namespace}`);

  for (let counter = 0; counter < 16; counter += 1) {
    const info = Buffer.from(`context-engine:passkey-derived-eoa:v1:${normalizedRpId}:${namespace}:${counter}`);
    const derived = Buffer.from(crypto.hkdfSync('sha256', inputKeyMaterial, salt, info, 32));
    const hex = derived.toString('hex');
    if (isValidPrivateKeyHex(hex)) return `0x${hex}`;
  }

  throw new Error('Could not derive a valid EVM private key from passkey PRF output.');
};

const buildPasskeyDerivedWallet = (rawIdB64Url = DEFAULT_PASSKEY_RAW_ID_B64URL, providerOrOptions = null, maybeOptions = {}) => {
  const provider = providerOrOptions && typeof providerOrOptions.getNetwork === 'function'
    ? providerOrOptions
    : null;
  const options = provider ? maybeOptions : (providerOrOptions || {});
  const credentialId = String(rawIdB64Url || DEFAULT_PASSKEY_RAW_ID_B64URL).trim() || DEFAULT_PASSKEY_RAW_ID_B64URL;
  const rawIdBytes = base64UrlToBuffer(credentialId);
  const prfOutput = deriveE2ePasskeyPrfOutput(credentialId);
  const privateKey = derivePasskeyEoaPrivateKey({
    prfOutput,
    rpId: options.rpId || DEFAULT_RP_ID,
    derivationNamespace: options.derivationNamespace || DEFAULT_DERIVATION_NAMESPACE,
  });
  const wallet = new ethers.Wallet(privateKey, provider || undefined);
  return {
    rawIdB64Url: credentialId,
    credentialId,
    rawIdBytes,
    prfOutput,
    privateKey,
    wallet,
    address: wallet.address,
  };
};

const toPasskeyEoaSeedRecord = ({
  credentialId,
  address,
  rpId = DEFAULT_RP_ID,
  derivationNamespace = DEFAULT_DERIVATION_NAMESPACE,
}) => {
  const normalizedRpId = normalizeRpId(rpId);
  const namespace = normalizeDerivationNamespace(derivationNamespace);
  const id = String(credentialId || DEFAULT_PASSKEY_RAW_ID_B64URL).trim() || DEFAULT_PASSKEY_RAW_ID_B64URL;
  const derivedAddress = buildPasskeyDerivedWallet(id, {
    rpId: normalizedRpId,
    derivationNamespace: namespace,
  }).address;
  if (address && String(address).toLowerCase() !== derivedAddress.toLowerCase()) {
    throw new Error(`Passkey seed address ${address} does not match derived address ${derivedAddress}.`);
  }
  const evmAddress = ethers.utils.getAddress(derivedAddress);
  return {
    credentialId: id,
    address: evmAddress,
    rpId: normalizedRpId,
    derivationNamespace: namespace,
    keyMode: 'passkey-derived',
    derivationVersion: DERIVATION_VERSION,
    prfOutput: bufferToBase64Url(deriveE2ePasskeyPrfOutput(id)),
    prfSalt: bufferToBase64Url(getPasskeyDerivedPrfSalt({
      rpId: normalizedRpId,
      derivationNamespace: namespace,
    })),
  };
};

module.exports = {
  DEFAULT_DERIVATION_NAMESPACE,
  DEFAULT_PASSKEY_RAW_ID_B64URL,
  DEFAULT_RP_ID,
  DERIVATION_VERSION,
  base64UrlToBuffer,
  bufferToBase64Url,
  buildPasskeyDerivedWallet,
  deriveE2ePasskeyPrfOutput,
  derivePasskeyEoaPrivateKey,
  getPasskeyDerivedPrfSalt,
  toPasskeyEoaSeedRecord,
};
