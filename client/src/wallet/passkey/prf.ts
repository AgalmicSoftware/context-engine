import {
  base64URLToBuffer,
  bufferSourceToWebCryptoBufferSource,
  bufferToBase64URL,
  isArrayBufferLike,
} from './encoding.js';

type PrfResults = {
  prf?: {
    enabled?: boolean;
    results?: {
      first?: ArrayBuffer;
    };
  };
};

export const PASSKEY_PRF_INFO = new TextEncoder().encode('context-engine:passkey-eoa:v1');

export const buildPrfExtension = (salt: ArrayBuffer | Uint8Array): Record<string, unknown> => ({
  prf: {
    eval: {
      first: salt,
    },
  },
});

export const getCredentialPrfOutput = (credential: PublicKeyCredential): ArrayBuffer => {
  const results = credential.getClientExtensionResults?.() as PrfResults | undefined;
  const first = results?.prf?.results?.first;
  if (!isArrayBufferLike(first) || first.byteLength === 0) {
    throw new Error('WebAuthn PRF is required for the embedded wallet on this browser/authenticator.');
  }
  return first;
};

export const getCredentialPrfEnabled = (credential: PublicKeyCredential): boolean => {
  const results = credential.getClientExtensionResults?.() as PrfResults | undefined;
  return results?.prf?.enabled === true || !!results?.prf?.results?.first;
};

export const deriveAesGcmKeyFromPrf = async (prfOutput: ArrayBuffer, saltBase64Url: string): Promise<CryptoKey> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  const baseKey = await crypto.subtle.importKey('raw', bufferSourceToWebCryptoBufferSource(prfOutput), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bufferSourceToWebCryptoBufferSource(base64URLToBuffer(saltBase64Url)),
      info: bufferSourceToWebCryptoBufferSource(PASSKEY_PRF_INFO),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encodePrfSalt = (salt: ArrayBuffer | Uint8Array): string => bufferToBase64URL(salt);
