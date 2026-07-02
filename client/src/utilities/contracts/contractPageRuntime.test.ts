import {
  base64urlToBase64,
  base64urlToHex,
  hexToBase64url,
} from './contractPageRuntime.js';

describe('contractPageRuntime encoding helpers', () => {
  it('round trips bytes32 pointer encodings through the real helpers', () => {
    const hex = '0xfbffff';
    const base64url = hexToBase64url(hex);

    expect(base64url).toBe('-___');
    expect(base64urlToHex(base64url)).toBe(hex);
    expect(base64urlToBase64(base64url)).toBe('+///');
  });
});
