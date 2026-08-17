import { bufferToBase64URL } from './encoding.js';
import { deriveAesGcmKeyFromPrf, getCredentialPrfOutput, getOptionalCredentialPrfOutput } from './prf.js';

const makeCredentialWithPrfOutput = (byteLength: number) =>
  ({
    getClientExtensionResults: () => ({
      prf: {
        enabled: true,
        results: {
          first: new Uint8Array(byteLength).buffer,
        },
      },
    }),
  }) as unknown as PublicKeyCredential;

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

  it('derives an AES key through the real WebCrypto HKDF boundary', async () => {
    const prfOutput = new Uint8Array(32).fill(1).buffer;
    const salt = bufferToBase64URL(new Uint8Array(32).fill(2));

    const key = await deriveAesGcmKeyFromPrf(prfOutput, salt);

    expect(key.type).toBe('secret');
    expect(key.algorithm).toEqual(expect.objectContaining({ name: 'AES-GCM', length: 256 }));
    expect(key.usages).toEqual(['encrypt', 'decrypt']);
  });
});

describe('credential PRF output validation', () => {
  it.each([0, 16, 31, 33])('rejects a non-32-byte PRF output (%i bytes)', (byteLength) => {
    const credential = makeCredentialWithPrfOutput(byteLength);

    expect(getOptionalCredentialPrfOutput(credential)).toBeNull();
    expect(() => getCredentialPrfOutput(credential)).toThrow(/PRF is required/i);
  });

  it('accepts the WebAuthn PRF fixed 32-byte output', () => {
    const credential = makeCredentialWithPrfOutput(32);

    expect(getOptionalCredentialPrfOutput(credential)).toHaveProperty('byteLength', 32);
    expect(getCredentialPrfOutput(credential)).toHaveProperty('byteLength', 32);
  });
});
