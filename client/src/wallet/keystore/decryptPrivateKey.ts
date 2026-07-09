import type { EncryptedWalletRecord, HexString } from '../types.js';
import { base64URLToBuffer } from '../passkey/encoding.js';

const textDecoder = new TextDecoder();

export const decryptPrivateKey = async ({
  record,
  aesKey,
}: {
  record: EncryptedWalletRecord;
  aesKey: CryptoKey;
}): Promise<HexString> => {
  if (record.encryptionVersion !== 'passkey-prf-aes-gcm-v1') {
    throw new Error(`Unsupported wallet encryption version: ${record.encryptionVersion}`);
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64URLToBuffer(record.iv) },
    aesKey,
    base64URLToBuffer(record.encryptedPrivateKey),
  );
  const privateKey = textDecoder.decode(plaintext).trim();
  if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) {
    throw new Error('Decrypted wallet key is not a valid EVM private key.');
  }
  return privateKey as HexString;
};
