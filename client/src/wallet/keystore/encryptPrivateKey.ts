import type { EncryptedWalletRecord, HexString, PasskeyWalletConfig } from '../types.js';
import { bufferSourceToUint8Array, bufferToBase64URL } from '../passkey/encoding.js';

const textEncoder = new TextEncoder();

export const encryptPrivateKey = async ({
  privateKey,
  aesKey,
  salt,
  credentialId,
  address,
  config,
  now = new Date(),
}: {
  privateKey: HexString;
  aesKey: CryptoKey;
  salt: string;
  credentialId: string;
  address: HexString;
  config: PasskeyWalletConfig;
  now?: Date;
}): Promise<EncryptedWalletRecord> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bufferSourceToUint8Array(iv) },
    aesKey,
    bufferSourceToUint8Array(textEncoder.encode(privateKey))
  );
  const timestamp = now.toISOString();
  return {
    id: `wallet:${config.rpId}:${address.toLowerCase()}`,
    rpId: config.rpId,
    credentialId,
    evmAddress: address,
    keyMode: 'encrypted-private-key',
    encryptedPrivateKey: bufferToBase64URL(ciphertext),
    encryptionVersion: 'passkey-prf-aes-gcm-v1',
    salt,
    iv: bufferToBase64URL(iv),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
