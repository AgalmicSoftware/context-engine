import { buildSbtDetailPath } from './sbtDetailPath.js';

describe('sbtDetailPath', () => {
  const address = '0xABC0000000000000000000000000000000000000';

  it('builds SBT detail paths with optional session query context', () => {
    expect(buildSbtDetailPath(` ${address} `)).toBe(`/group/${address}`);
    expect(buildSbtDetailPath(address, ' Edge Room ')).toBe(`/group/${address}?session=Edge+Room`);
  });

  it('builds SBT detail paths under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    try {
      expect(buildSbtDetailPath(address)).toBe(`/ce/group/${address}`);
      expect(buildSbtDetailPath(address, 'edge')).toBe(`/ce/group/${address}?session=edge`);
    } finally {
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  it('returns an inert link for empty SBT addresses', () => {
    expect(buildSbtDetailPath('')).toBe('#');
    expect(buildSbtDetailPath(null)).toBe('#');
  });
});
