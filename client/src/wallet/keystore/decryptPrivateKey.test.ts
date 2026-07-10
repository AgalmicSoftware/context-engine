import type { PasskeyWalletConfig } from '../types.js';
import { decryptPrivateKey } from './decryptPrivateKey.js';
import { encryptPrivateKey } from './encryptPrivateKey.js';

const PRIVATE_KEY = `0x${'11'.repeat(32)}` as `0x${string}`;

const config: PasskeyWalletConfig = {
  rpId: 'localhost',
  rpName: 'Context Engine',
  appOrigin: 'http://localhost:3000',
  accountOrigin: 'http://localhost:3000',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'encrypted-private-key',
  sessionMode: 'soft',
  unlockTtlSeconds: 60,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'context-engine',
};

describe('decryptPrivateKey', () => {
  it('round-trips decoded wallet bytes through the real WebCrypto boundary', async () => {
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const record = await encryptPrivateKey({
      privateKey: PRIVATE_KEY,
      aesKey,
      salt: 'test-salt',
      credentialId: 'test-credential',
      address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      config,
    });

    await expect(decryptPrivateKey({ record, aesKey })).resolves.toBe(PRIVATE_KEY);
  });
});
