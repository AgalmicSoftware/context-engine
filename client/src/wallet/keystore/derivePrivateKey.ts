import type {
  HexString,
  PasskeyDerivedWalletRecord,
  PasskeyWalletConfig,
} from '../types.js';
import { bufferToBase64URL } from '../passkey/encoding.js';

const textEncoder = new TextEncoder();
const DERIVATION_VERSION = 'passkey-prf-hkdf-secp256k1-v1' as const;
const SECP256K1_ORDER_HEX = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

const bytesToHex = (bytes: Uint8Array): string => (
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
);

const isValidPrivateKeyHex = (hex: string): boolean => (
  /^[0-9a-f]{64}$/.test(hex) &&
  hex !== '0'.repeat(64) &&
  hex < SECP256K1_ORDER_HEX
);

const namespace = (config: PasskeyWalletConfig): string => (
  String(config.derivationNamespace || 'context-engine').trim() || 'context-engine'
);

export const getPasskeyDerivedPrfSalt = async (config: PasskeyWalletConfig): Promise<Uint8Array> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  const material = textEncoder.encode(
    `context-engine:passkey-derived-prf-salt:v1:${config.rpId}:${namespace(config)}`
  );
  return new Uint8Array(await crypto.subtle.digest('SHA-256', material));
};

export const deriveEoaPrivateKeyFromPrf = async ({
  prfOutput,
  config,
}: {
  prfOutput: ArrayBuffer;
  config: PasskeyWalletConfig;
}): Promise<HexString> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  const baseKey = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveBits']);
  const salt = textEncoder.encode(
    `context-engine:passkey-derived-eoa-salt:v1:${config.rpId}:${namespace(config)}`
  );

  for (let counter = 0; counter < 16; counter += 1) {
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: textEncoder.encode(
          `context-engine:passkey-derived-eoa:v1:${config.rpId}:${namespace(config)}:${counter}`
        ),
      },
      baseKey,
      256
    );
    const hex = bytesToHex(new Uint8Array(bits));
    if (isValidPrivateKeyHex(hex)) return `0x${hex}` as HexString;
  }

  throw new Error('Could not derive a valid EVM private key from passkey PRF output.');
};

export const createPasskeyDerivedWalletRecord = ({
  config,
  credentialId,
  address,
  prfSalt,
  now = new Date(),
}: {
  config: PasskeyWalletConfig;
  credentialId: string;
  address: HexString;
  prfSalt: Uint8Array;
  now?: Date;
}): PasskeyDerivedWalletRecord => {
  const timestamp = now.toISOString();
  return {
    id: `derived-wallet:${config.rpId}:${address.toLowerCase()}`,
    rpId: config.rpId,
    credentialId,
    evmAddress: address,
    keyMode: 'passkey-derived',
    derivationVersion: DERIVATION_VERSION,
    prfSalt: bufferToBase64URL(prfSalt),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
