import { bufferSourceToWebCryptoBufferSource } from './encoding.js';

const toBytes = (value: BufferSource): number[] => {
  if (ArrayBuffer.isView(value)) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  return Array.from(new Uint8Array(value));
};

describe('bufferSourceToWebCryptoBufferSource', () => {
  it('preserves bytes while returning a WebCrypto-compatible BufferSource', () => {
    const source = new Uint8Array([1, 2, 3]);
    const normalized = bufferSourceToWebCryptoBufferSource(source);

    expect(ArrayBuffer.isView(normalized) || normalized instanceof ArrayBuffer).toBe(true);
    expect(toBytes(normalized)).toEqual([1, 2, 3]);

    if ((globalThis as typeof globalThis & { Buffer?: { isBuffer?: (value: unknown) => boolean } }).Buffer?.isBuffer) {
      expect(
        (globalThis as typeof globalThis & { Buffer: { isBuffer: (value: unknown) => boolean } }).Buffer.isBuffer(
          normalized,
        ),
      ).toBe(true);
    }
  });
});
