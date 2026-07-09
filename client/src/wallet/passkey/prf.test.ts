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
    const importKeySpy = jest
      .spyOn(crypto.subtle, 'importKey')
      .mockImplementation(async (format, keyData, algorithm, extractable, keyUsages) => {
        expect(format).toBe('raw');
        expect(ArrayBuffer.isView(keyData)).toBe(true);
        expect(algorithm).toBe('HKDF');
        expect(extractable).toBe(false);
        expect(keyUsages).toEqual(['deriveKey']);
        return key;
      });
    const deriveKeySpy = jest.spyOn(crypto.subtle, 'deriveKey').mockResolvedValue(key);

    await expect(deriveAesGcmKeyFromPrf(prfOutput, salt)).resolves.toBe(key);

    expect(importKeySpy).toHaveBeenCalledTimes(1);
    expect(deriveKeySpy).toHaveBeenCalledTimes(1);
    const [algorithm] = deriveKeySpy.mock.calls[0];
    expect(ArrayBuffer.isView(algorithm.salt)).toBe(true);
    expect(ArrayBuffer.isView(algorithm.info)).toBe(true);
  });
});
