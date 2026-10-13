import { normalizeSessionIdHex, normalizeSlug, toStr } from './primitives.js';

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

    it('keeps String() results for every other ordinary value', () => {
      expect(toStr('')).toBe('');
      expect(toStr(0)).toBe('0');
      expect(toStr(-0)).toBe('0');
      expect(toStr(1.5)).toBe('1.5');
      expect(toStr(NaN)).toBe('NaN');
      expect(toStr(Infinity)).toBe('Infinity');
      expect(toStr(-Infinity)).toBe('-Infinity');
      expect(toStr(true)).toBe('true');
      expect(toStr(Symbol('x'))).toBe('Symbol(x)');
      expect(toStr([1, 'a', null])).toBe('1,a,');
      expect(toStr([])).toBe('');
      expect(toStr({})).toBe('[object Object]');
      expect(toStr({ toString: () => 'custom' })).toBe('custom');
      expect(toStr(new Error('boom'))).toBe('Error: boom');
      const date = new Date(0);
      expect(toStr(date)).toBe(String(date));
    });

    it('returns an empty string for objects that cannot become text', () => {
      // Uploaded JSON can carry these; String() throws on each.
      expect(toStr(JSON.parse('{"toString":1}'))).toBe('');
      expect(toStr(Object.create(null))).toBe('');
      expect(
        toStr({
          toString: () => {
            throw new Error('nope');
          },
        }),
      ).toBe('');
      expect(toStr({ [Symbol.toPrimitive]: () => ({}) })).toBe('');
      expect(toStr([JSON.parse('{"toString":1}')])).toBe('');
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
});
