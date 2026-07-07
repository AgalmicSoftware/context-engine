import type { PasskeyWalletConfig } from '../types.js';
import { deriveEoaPrivateKeyFromPrf } from './derivePrivateKey.js';

const config: PasskeyWalletConfig = {
  rpId: 'localhost',
  rpName: 'Context Engine',
  appOrigin: 'http://localhost:3000',
  accountOrigin: 'http://localhost:3000',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'passkey-derived',
  sessionMode: 'soft',
  unlockTtlSeconds: 60,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'context-engine',
};

describe('deriveEoaPrivateKeyFromPrf', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes PRF output before importing HKDF key material', async () => {
    const key = {} as CryptoKey;
    const prfOutput = new Uint8Array(32).fill(1).buffer;
    const derivedPrivateKey = new Uint8Array(32);
    derivedPrivateKey[31] = 1;
    const importKeySpy = jest
      .spyOn(crypto.subtle, 'importKey')
      .mockImplementation(async (format, keyData, algorithm, extractable, keyUsages) => {
        expect(format).toBe('raw');
        expect(keyData).toBeInstanceOf(Uint8Array);
        expect(algorithm).toBe('HKDF');
        expect(extractable).toBe(false);
        expect(keyUsages).toEqual(['deriveBits']);
        return key;
      });
    const deriveBitsSpy = jest.spyOn(crypto.subtle, 'deriveBits').mockResolvedValue(derivedPrivateKey.buffer);

    await expect(deriveEoaPrivateKeyFromPrf({ prfOutput, config })).resolves.toBe(`0x${'0'.repeat(63)}1`);

    expect(importKeySpy).toHaveBeenCalledTimes(1);
    expect(deriveBitsSpy).toHaveBeenCalledTimes(1);
    const [algorithm] = deriveBitsSpy.mock.calls[0];
    expect(ArrayBuffer.isView(algorithm.salt)).toBe(true);
    expect(ArrayBuffer.isView(algorithm.info)).toBe(true);
  });
});
