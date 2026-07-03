const textEncoder = new TextEncoder();

export const PASSKEY_DERIVATION_NAMESPACE = 'context-engine';
export const PASSKEY_DERIVATION_VERSION = 'passkey-prf-hkdf-secp256k1-v1';
export const SECP256K1_ORDER_HEX = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

export function normalizeDerivationNamespace(value) {
  return String(value || PASSKEY_DERIVATION_NAMESPACE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || PASSKEY_DERIVATION_NAMESPACE;
}

export function normalizeRpId(value) {
  return String(value || globalThis.location?.hostname || 'localhost')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '') || 'localhost';
}

function resolveCryptoApi(cryptoApi) {
  const resolved = cryptoApi || globalThis.crypto;
  if (!resolved?.subtle) {
    throw new Error('WebCrypto subtle API not available');
  }
  return resolved;
}

function resolveWalletFactory(walletFactory) {
  if (typeof walletFactory === 'function') return walletFactory;
  const Wallet = globalThis.ethers?.Wallet;
  if (!Wallet) {
    throw new Error('ethers Wallet unavailable');
  }
  return (privateKey) => new Wallet(privateKey);
}

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidPrivateKeyHex(hex) {
  return /^[0-9a-f]{64}$/.test(hex) &&
    hex !== '0'.repeat(64) &&
    hex < SECP256K1_ORDER_HEX;
}

export async function getPasskeyDerivedPrfSalt({
  rpId,
  derivationNamespace = PASSKEY_DERIVATION_NAMESPACE,
  cryptoApi,
} = {}) {
  const cryptoRef = resolveCryptoApi(cryptoApi);
  const material = textEncoder.encode(
    `context-engine:passkey-derived-prf-salt:v1:${normalizeRpId(rpId)}:${normalizeDerivationNamespace(derivationNamespace)}`
  );
  return new Uint8Array(await cryptoRef.subtle.digest('SHA-256', material));
}

export function buildPrfExtension(salt) {
  return {
    prf: {
      eval: {
        first: salt,
      },
    },
  };
}

export function getCredentialPrfEnabled(credential) {
  const results = credential?.getClientExtensionResults?.();
  return results?.prf?.enabled === true || !!results?.prf?.results?.first;
}

export function getCredentialPrfOutput(credential) {
  const results = credential?.getClientExtensionResults?.();
  const first = results?.prf?.results?.first;
  if (!(first instanceof ArrayBuffer) || first.byteLength === 0) {
    throw new Error('WebAuthn PRF is required for the embedded wallet on this browser/authenticator.');
  }
  return first;
}

export async function derivePasskeyPrivateKeyFromPrf(prfOutput, {
  rpId,
  derivationNamespace = PASSKEY_DERIVATION_NAMESPACE,
  cryptoApi,
} = {}) {
  const cryptoRef = resolveCryptoApi(cryptoApi);
  const normalizedRpId = normalizeRpId(rpId);
  const namespace = normalizeDerivationNamespace(derivationNamespace);
  const baseKey = await cryptoRef.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveBits']);
  const salt = textEncoder.encode(`context-engine:passkey-derived-eoa-salt:v1:${normalizedRpId}:${namespace}`);

  for (let counter = 0; counter < 16; counter += 1) {
    const derived = await cryptoRef.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: textEncoder.encode(`context-engine:passkey-derived-eoa:v1:${normalizedRpId}:${namespace}:${counter}`),
      },
      baseKey,
      256
    );
    const hex = bytesToHex(new Uint8Array(derived));
    if (isValidPrivateKeyHex(hex)) return `0x${hex}`;
  }

  throw new Error('Could not derive a valid EVM private key from passkey PRF output.');
}

export async function derivePasskeyWalletFromCredential(credential, options = {}) {
  const privateKey = await derivePasskeyPrivateKeyFromPrf(getCredentialPrfOutput(credential), options);
  const wallet = resolveWalletFactory(options.walletFactory)(privateKey);
  return { privateKey, address: wallet.address };
}
