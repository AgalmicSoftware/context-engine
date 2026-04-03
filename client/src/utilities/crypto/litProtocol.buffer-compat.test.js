import { Buffer as ModernBuffer } from 'buffer/';
import { ensureLitBufferCompatibility } from './litProtocol.js';

describe('ensureLitBufferCompatibility', () => {
  let originalBuffer;

  beforeEach(() => {
    originalBuffer = globalThis.Buffer;
  });

  afterEach(() => {
    globalThis.Buffer = originalBuffer;
  });

  it('replaces legacy runtime Buffer without writeBigUInt64BE', () => {
    class LegacyBuffer extends Uint8Array {}
    LegacyBuffer.alloc = (size) => new LegacyBuffer(size);
    globalThis.Buffer = LegacyBuffer;

    const resolved = ensureLitBufferCompatibility();
    const probe = globalThis.Buffer.alloc(8);

    expect(resolved).toBe(globalThis.Buffer);
    expect(globalThis.Buffer).toBe(ModernBuffer);
    expect(typeof probe.writeBigUInt64BE).toBe('function');
    expect(() => probe.writeBigUInt64BE(1n, 0)).not.toThrow();
  });

  it('keeps compatible runtime Buffer unchanged', () => {
    globalThis.Buffer = ModernBuffer;
    const resolved = ensureLitBufferCompatibility();
    expect(resolved).toBe(ModernBuffer);
    expect(globalThis.Buffer).toBe(ModernBuffer);
  });
});
