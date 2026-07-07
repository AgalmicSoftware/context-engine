import {
  buildUserPageDeepScanProgressStatePatch,
  getUserPageErrorMessage,
  isUserPageGateAccessContext,
  isUserPageSbtAggregateEntry,
  type UserPageDeepScanProgressRow,
} from './userPageHelpers';

const makeRow = (overrides: Partial<UserPageDeepScanProgressRow> = {}): UserPageDeepScanProgressRow => ({
  slug: 'alpha',
  chainId: 84532,
  lastBlockScanned: 1000,
  latestBlock: 1200,
  remainingBlocks: 200,
  percentComplete: 50,
  isDeterminate: true,
  label: 'Alpha',
  startBlock: 800,
  displayLastBlock: 1000,
  ...overrides,
});

// Remaining userPageHelpers coverage owns guard and deep-scan helpers that still share mixed setup.
describe('userPageHelpers', () => {
  it('normalizes errors and detects analysis guard records', () => {
    expect(getUserPageErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getUserPageErrorMessage({ message: 123 }, 'fallback')).toBe('fallback');
    expect(getUserPageErrorMessage(null, 'fallback')).toBe('fallback');
    expect(
      isUserPageGateAccessContext({
        pendingKeys: new Set(['a']),
        uncertainResources: new Set(['b']),
      }),
    ).toBe(true);
    expect(
      isUserPageGateAccessContext({
        pendingKeys: [],
        uncertainResources: new Set(['b']),
      }),
    ).toBe(false);
    expect(
      isUserPageSbtAggregateEntry({
        mintedSet: new Set(['0xA']),
        burnedSet: new Set(['0xB']),
      }),
    ).toBe(true);
    expect(
      isUserPageSbtAggregateEntry({
        mintedSet: new Set(['0xA']),
        burnedSet: [],
      }),
    ).toBe(false);
  });

  it('builds deep-scan progress state patches', () => {
    const rows = [makeRow({ slug: 'alpha' })];
    expect(
      buildUserPageDeepScanProgressStatePatch({
        deepScanProgressRows: rows,
        deepScanTooltipLines: ['Alpha: 50%'],
        now: 1234,
      }),
    ).toEqual({
      deepScanProgressTick: 1234,
      deepScanTooltipLines: ['Alpha: 50%'],
      deepScanProgressRows: rows,
    });
    expect(
      buildUserPageDeepScanProgressStatePatch({
        deepScanProgressRows: [],
        deepScanTooltipLines: [],
        now: 0,
      }),
    ).toEqual({
      deepScanProgressTick: 0,
      deepScanTooltipLines: [],
      deepScanProgressRows: [],
    });
  });
});
