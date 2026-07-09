import {
  base64urlToBase64,
  base64urlToHex,
  bindArweaveEncoding,
  hexToBase64url,
  type ArweaveEncodingScripts,
} from './arweaveEncoding';

describe('arweave encoding port', () => {
  it('uses call-time script lookup for every helper', () => {
    const firstScripts: ArweaveEncodingScripts = {
      hexToBase64url: jest.fn(() => 'first-base64url'),
      base64urlToHex: jest.fn(() => '0x1111'),
      base64urlToBase64: jest.fn(() => 'first-base64'),
    };
    const secondScripts: ArweaveEncodingScripts = {
      hexToBase64url: jest.fn(() => 'second-base64url'),
      base64urlToHex: jest.fn(() => '0x2222'),
      base64urlToBase64: jest.fn(() => 'second-base64'),
    };
    let scripts = firstScripts;
    const port = bindArweaveEncoding({
      client: () => scripts,
    });

    expect(port.hexToBase64url('0x11')).toBe('first-base64url');

    scripts = secondScripts;

    expect(port.hexToBase64url('0x22')).toBe('second-base64url');
    expect(port.base64urlToHex('second-base64url')).toBe('0x2222');
    expect(port.base64urlToBase64('second-base64url')).toBe('second-base64');

    expect(firstScripts.hexToBase64url).toHaveBeenCalledWith('0x11');
    expect(secondScripts.hexToBase64url).toHaveBeenCalledWith('0x22');
    expect(secondScripts.base64urlToHex).toHaveBeenCalledWith('second-base64url');
    expect(secondScripts.base64urlToBase64).toHaveBeenCalledWith('second-base64url');
  });

  it('round trips bytes32 pointer encodings through the real helpers', () => {
    const hex = '0xfbffff';
    const base64url = hexToBase64url(hex);

    expect(base64url).toBe('-___');
    expect(base64urlToHex(base64url)).toBe(hex);
    expect(base64urlToBase64(base64url)).toBe('+///');
  });
});
