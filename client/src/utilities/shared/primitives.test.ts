import { isValidEthAddress, normalizeSessionIdHex, normalizeSlug, toStr } from './primitives.js';

describe('shared primitives', () => {
  describe('toStr', () => {
    it('preserves strings and normalizes nullish values to an empty string', () => {
      expect(toStr(' value ')).toBe(' value ');
      expect(toStr(null)).toBe('');
      expect(toStr(undefined)).toBe('');
    });

    it('coerces non-string primitives through String', () => {
      expect(toStr(123)).toBe('123');
      expect(toStr(false)).toBe('false');
      expect(toStr(123n)).toBe('123');
    });
  });

  describe('normalizeSlug', () => {
    it('trims, lowercases, and preserves slug-safe separators', () => {
      expect(normalizeSlug(' Session_Name-01 ')).toBe('session_name-01');
    });

    it('removes punctuation and whitespace that are not slug-safe', () => {
      expect(normalizeSlug('Alpha Beta!')).toBe('alphabeta');
    });
  });

  describe('normalizeSessionIdHex', () => {
    it('normalizes non-empty ids to lowercase 0x-prefixed hex strings', () => {
      expect(normalizeSessionIdHex('ABCD')).toBe('0xabcd');
      expect(normalizeSessionIdHex('0xABCD')).toBe('0xabcd');
    });

    it('treats empty and all-zero ids as missing', () => {
      expect(normalizeSessionIdHex('')).toBe('');
      expect(normalizeSessionIdHex('0x')).toBe('');
      expect(normalizeSessionIdHex('0x0000')).toBe('');
    });
  });

  describe('isValidEthAddress', () => {
    it('accepts 20-byte hex addresses and rejects malformed values', () => {
      expect(isValidEthAddress('0x0000000000000000000000000000000000000001')).toBe(true);
      expect(isValidEthAddress('0000000000000000000000000000000000000001')).toBe(false);
      expect(isValidEthAddress('0x000000000000000000000000000000000000000g')).toBe(false);
    });
  });
});
