import { buildSbtDetailPath } from './sbtDetailPath.js';

describe('sbtDetailPath', () => {
  const address = '0xABC0000000000000000000000000000000000000';

  it('builds SBT detail paths with optional session query context', () => {
    expect(buildSbtDetailPath(` ${address} `)).toBe(`/group/${address}`);
    expect(buildSbtDetailPath(address, ' Edge Room ')).toBe(`/group/${address}?session=Edge+Room`);
  });

  it('returns an inert link for empty SBT addresses', () => {
    expect(buildSbtDetailPath('')).toBe('#');
    expect(buildSbtDetailPath(null)).toBe('#');
  });
});
