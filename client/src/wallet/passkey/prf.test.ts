import { bufferToBase64URL } from './encoding.js';
import { deriveAesGcmKeyFromPrf } from './prf.js';

describe('deriveAesGcmKeyFromPrf', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes PRF output before importing HKDF key material', async () => {
    const key = {} as CryptoKey;
    const prfOutput = new Uint8Array(32).fill(1).buffer;
    const salt = bufferToBase64URL(new Uint8Array(32).fill(2));
    const importKeySpy = jest.spyOn(crypto.subtle, 'importKey').mockImplementation(async (
      format,
      keyData,
      algorithm,
      extractable,
      keyUsages
    ) => {
      expect(format).toBe('raw');
      expect(keyData).toBeInstanceOf(Uint8Array);
      expect(algorithm).toBe('HKDF');
      expect(extractable).toBe(false);
      expect(keyUsages).toEqual(['deriveKey']);
      return key;
    });
    const deriveKeySpy = jest.spyOn(crypto.subtle, 'deriveKey').mockImplementation(async (
      algorithm,
      baseKey,
      derivedKeyType,
      extractable,
      keyUsages
    ) => {
      expect(algorithm).toEqual(expect.objectContaining({
        name: 'HKDF',
        hash: 'SHA-256',
      }));
      expect((algorithm as HkdfParams).salt).toBeInstanceOf(Uint8Array);
      expect((algorithm as HkdfParams).info).toBeInstanceOf(Uint8Array);
      expect(baseKey).toBe(key);
      expect(derivedKeyType).toEqual({ name: 'AES-GCM', length: 256 });
      expect(extractable).toBe(false);
      expect(keyUsages).toEqual(['encrypt', 'decrypt']);
      return key;
    });

    await expect(deriveAesGcmKeyFromPrf(prfOutput, salt)).resolves.toBe(key);

    expect(importKeySpy).toHaveBeenCalledTimes(1);
    expect(deriveKeySpy).toHaveBeenCalledTimes(1);
  });
});
