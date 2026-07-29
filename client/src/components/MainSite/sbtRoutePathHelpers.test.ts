import {
  buildSbtDetailRouteStatePatch,
  getSbtAddressFromPath,
  getSbtListRouteSessionSlug,
  getUserAddressFromPath,
  isSbtListRoutePath,
} from './sbtRoutePathHelpers';

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const isAddress = (value: string): boolean => value.startsWith('0x') && value.length >= 42;
const normalizeSessionSlug = (value: unknown): string => String(value || '').toLowerCase();

describe('getSbtAddressFromPath', () => {
  it('returns the address for sbt and group detail routes', () => {
    expect(getSbtAddressFromPath(`/sbt/${VALID_ADDRESS}`, { isAddress })).toBe(VALID_ADDRESS);
    expect(getSbtAddressFromPath(`/group/${VALID_ADDRESS}?tab=details#mint`, { isAddress })).toBe(VALID_ADDRESS);
  });

  it('returns null for invalid, unrelated, or empty paths', () => {
    expect(getSbtAddressFromPath('/sbt/invalid', { isAddress })).toBeNull();
    expect(getSbtAddressFromPath(`/other/${VALID_ADDRESS}`, { isAddress })).toBeNull();
    expect(getSbtAddressFromPath('', { isAddress })).toBeNull();
  });
});

describe('isSbtListRoutePath', () => {
  it('matches sbts and groups list routes except new routes', () => {
    expect(isSbtListRoutePath('/sbts')).toBe(true);
    expect(isSbtListRoutePath('/sbts/demo')).toBe(true);
    expect(isSbtListRoutePath('/sbts/new')).toBe(false);
    expect(isSbtListRoutePath('/groups')).toBe(true);
    expect(isSbtListRoutePath('/other')).toBe(false);
  });
});

describe('getSbtListRouteSessionSlug', () => {
  it('returns normalized route session slugs for sbts and groups list routes', () => {
    expect(getSbtListRouteSessionSlug('/sbts/demo', { normalizeSessionSlug })).toBe('demo');
    expect(getSbtListRouteSessionSlug('/sbts/new', { normalizeSessionSlug })).toBe('');
    expect(getSbtListRouteSessionSlug('/sbts', { normalizeSessionSlug })).toBe('');
    expect(getSbtListRouteSessionSlug('/groups/MyGroup', { normalizeSessionSlug })).toBe('mygroup');
    expect(
      getSbtListRouteSessionSlug('/groups', {
        normalizeSessionSlug,
        search: '?sessionName=Demo-SH',
      }),
    ).toBe('demo-sh');
  });
});

describe('getUserAddressFromPath', () => {
  it('returns the address for user-prefixed and bare address routes', () => {
    expect(getUserAddressFromPath(`/u/${VALID_ADDRESS}`, { isAddress })).toBe(VALID_ADDRESS);
    expect(getUserAddressFromPath(`/${VALID_ADDRESS}`, { isAddress })).toBe(VALID_ADDRESS);
  });

  it('returns null for invalid or unrelated user paths', () => {
    expect(getUserAddressFromPath('/u/invalid', { isAddress })).toBeNull();
    expect(getUserAddressFromPath('/other', { isAddress })).toBeNull();
  });
});

describe('buildSbtDetailRouteStatePatch', () => {
  it('builds the pinned SBT detail route state patch', () => {
    expect(
      buildSbtDetailRouteStatePatch({
        detailSlug: 'demo',
        address: VALID_ADDRESS,
      }),
    ).toEqual({
      sbtDetailGroupSlug: 'demo',
      sbtDetailAddress: VALID_ADDRESS,
    });
  });

  it('builds the cleared SBT detail route state patch by default', () => {
    expect(buildSbtDetailRouteStatePatch()).toEqual({
      sbtDetailGroupSlug: null,
      sbtDetailAddress: null,
    });
  });
});
