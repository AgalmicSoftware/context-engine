import { isKnownOpenSbt, readKnownSbtMintMode } from './sbtClaimUrlSafety';

describe('readKnownSbtMintMode', () => {
  it.each([
    [0, 0],
    ['0', 0],
    [1, 1],
    ['1', 1],
    [2, 2],
    ['2', 2],
    [3, 3],
    ['3', 3],
  ])('reads mint mode %p as %p', (mintMode, expected) => {
    expect(readKnownSbtMintMode({ mintMode })).toBe(expected);
  });

  // Number() turns many of these into 0, which would read as "open".
  it.each([
    [undefined],
    [null],
    [''],
    [' '],
    ['\n'],
    [' 0'],
    ['00'],
    ['0x0'],
    ['1e0'],
    ['abc'],
    [false],
    [true],
    [[]],
    [[0]],
    [{}],
    [NaN],
    [1.5],
    [-1],
    [4],
    ['4'],
  ])('treats mint mode %p as unknown, never open', (mintMode) => {
    expect(readKnownSbtMintMode({ mintMode })).toBeNull();
    expect(isKnownOpenSbt({ mintMode })).toBe(false);
  });

  it('calls a group open only when its metadata says so', () => {
    expect(isKnownOpenSbt(null)).toBe(false);
    expect(isKnownOpenSbt({})).toBe(false);
    expect(isKnownOpenSbt({ mintMode: 2 })).toBe(false);
    expect(isKnownOpenSbt({ mintMode: 0 })).toBe(true);
    expect(isKnownOpenSbt({ mintMode: '0' })).toBe(true);
  });
});
