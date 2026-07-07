import { arweaveClient } from './arweaveClient.js';

describe('arweaveClient base64url conversion', () => {
  it('does not require the browser Buffer polyfill for storage pointer ids', () => {
    const originalBuffer = global.Buffer;
    const originalAtob = global.atob;
    const originalBtoa = global.btoa;
    const nodeBuffer = originalBuffer;

    try {
      global.atob = (value) => nodeBuffer.from(value, 'base64').toString('binary');
      global.btoa = (value) => nodeBuffer.from(value, 'binary').toString('base64');
      global.Buffer = undefined;

      expect(arweaveClient.hexToBase64url('0x1234abcd')).toBe('EjSrzQ');
      expect(arweaveClient.base64urlToHex('EjSrzQ')).toBe('0x1234abcd');
    } finally {
      global.Buffer = originalBuffer;
      global.atob = originalAtob;
      global.btoa = originalBtoa;
    }
  });
});
