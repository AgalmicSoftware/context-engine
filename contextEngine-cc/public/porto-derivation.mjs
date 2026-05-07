const textEncoder = new TextEncoder();

export const PORTO_KDF_SALT_TEXT = 'contextengine.xyz:porto:v1';
export const PORTO_KDF_INFO_TEXT = 'ethereum-private-key';
export const PORTO_KDF_SALT = textEncoder.encode(PORTO_KDF_SALT_TEXT);
export const PORTO_KDF_INFO = textEncoder.encode(PORTO_KDF_INFO_TEXT);

function normalizeRawIdBytes(rawIdBytes) {
  if (rawIdBytes instanceof Uint8Array) return rawIdBytes;
  if (rawIdBytes instanceof ArrayBuffer) return new Uint8Array(rawIdBytes);
  if (ArrayBuffer.isView(rawIdBytes)) {
    return new Uint8Array(rawIdBytes.buffer, rawIdBytes.byteOffset, rawIdBytes.byteLength);
  }
  throw new TypeError('Expected credential rawId bytes');
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

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function derivePortoPrivateKey(rawIdBytes, { cryptoApi } = {}) {
  const cryptoRef = resolveCryptoApi(cryptoApi);
  const ikm = normalizeRawIdBytes(rawIdBytes);
  const baseKey = await cryptoRef.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const derived = await cryptoRef.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: PORTO_KDF_SALT, info: PORTO_KDF_INFO },
    baseKey,
    256
  );
  return `0x${bytesToHex(new Uint8Array(derived))}`;
}

export async function derivePortoWalletFromCredential(credential, options = {}) {
  const rawIdBytes = credential?.rawId ?? credential;
  const privateKey = await derivePortoPrivateKey(rawIdBytes, options);
  const wallet = resolveWalletFactory(options.walletFactory)(privateKey);
  return { privateKey, address: wallet.address };
}
