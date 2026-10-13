import { readStoredRating } from './storedRating';

describe('readStoredRating', () => {
  it('reads 0-10 ratings as given', () => {
    expect(readStoredRating(0)).toBe(0);
    expect(readStoredRating(7)).toBe(7);
    expect(readStoredRating(10)).toBe(10);
    expect(readStoredRating(' 4 ')).toBe(4);
    expect(readStoredRating({ value: 6 })).toBe(6);
  });

  it('reads legacy 0-100 interview ratings on the 0-10 scale', () => {
    expect(readStoredRating(75)).toBe(7.5);
    expect(readStoredRating('100')).toBe(10);
    expect(readStoredRating(10.5)).toBe(1.05);
  });

  it('clamps out-of-range values to 0-10', () => {
    expect(readStoredRating(-3)).toBe(0);
    expect(readStoredRating(150)).toBe(10);
  });

  it('returns null for missing, non-numeric, masked or encrypted values', () => {
    [null, undefined, '', '  ', '*', 'high', Number.NaN, true, [], {}, { value: '*', encrypted: true }].forEach(
      (value) => expect(readStoredRating(value)).toBeNull(),
    );
    expect(readStoredRating({ value: 9, encrypted: true })).toBeNull();
    expect(readStoredRating('{"v":1,"recipients":[]}')).toBeNull();
  });
});
