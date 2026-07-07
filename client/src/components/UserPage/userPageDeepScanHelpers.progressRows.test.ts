import {
  buildUserPageDeepScanProgressRow,
  buildUserPageDeepScanProgressRowDisplayState,
  buildUserPageDeepScanProgressRowsSignature,
  buildUserPageDeepScanTooltipOutputSignature,
  deriveUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
  resolveUserPageDeepScanProgressStateUpdate,
  sortUserPageDeepScanProgressRows,
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

describe('userPageDeepScanHelpers progress row helpers', () => {
  it('sorts deep-scan rows by priority, attention, recency, label, and chain', () => {
    const rows = [
      makeRow({ slug: 'beta', label: 'Beta', lastBlockScanned: 900, remainingBlocks: 0 }),
      makeRow({ slug: 'alpha', label: 'Alpha', lastBlockScanned: 700, remainingBlocks: 500 }),
      makeRow({ slug: 'gamma', label: 'Gamma', lastBlockScanned: 1200, latestBlock: null, remainingBlocks: null }),
      makeRow({ slug: 'beta', label: 'Beta B', chainId: 10, lastBlockScanned: 900, remainingBlocks: 0 }),
    ];

    expect(sortUserPageDeepScanProgressRows(rows, ['beta', 'alpha'])?.map((row) => row.label)).toEqual([
      'Beta',
      'Beta B',
      'Alpha',
      'Gamma',
    ]);
    expect(sortUserPageDeepScanProgressRows([], ['beta'])).toBeNull();
  });

  it('builds deep-scan rows with display labels and determinate progress', () => {
    const determinateRow = buildUserPageDeepScanProgressRow({
      slug: 'edge-session',
      chainId: 11155420,
      lastBlock: 125,
      latestBlock: 200,
      startBlock: 100,
      sessionConfig: { sessionName: 'Edge Session' },
      slugHasMultipleNetworks: true,
    });
    expect(determinateRow).toEqual({
      slug: 'edge-session',
      chainId: 11155420,
      lastBlockScanned: 125,
      latestBlock: 200,
      remainingBlocks: 75,
      percentComplete: 25,
      isDeterminate: true,
      label: 'Edge Session (edge-session) (chain 11155420)',
      startBlock: 100,
      displayLastBlock: 125,
    });
    expect(
      buildUserPageDeepScanProgressRowDisplayState({
        index: 2,
        row: determinateRow,
      }),
    ).toEqual({
      indeterminateText: '125 scanned',
      progressFillStyle: { width: '25%' },
      progressWidth: '25%',
      remainingText: '75 blocks remaining',
      rowKey: 'edge-session_11155420_2',
      scannedText: '125 / 200 scanned',
      shouldRenderScannedText: true,
    });

    const indeterminateRow = buildUserPageDeepScanProgressRow({
      slug: '',
      chainId: null,
      lastBlock: '50',
      latestBlock: null,
      sessionConfig: { sessionName: 'general' },
      startBlock: null,
    });
    expect(indeterminateRow).toMatchObject({
      slug: 'general',
      label: 'general',
      lastBlockScanned: 50,
      latestBlock: null,
      remainingBlocks: null,
      percentComplete: null,
      isDeterminate: false,
    });
    expect(
      buildUserPageDeepScanProgressRowDisplayState({
        row: indeterminateRow,
        showScannedText: false,
      }),
    ).toMatchObject({
      indeterminateText: 'Syncing... latest block pending',
      progressFillStyle: { width: '0%' },
      progressWidth: '0%',
      remainingText: 'Up to date',
      rowKey: 'general_na_0',
      scannedText: '',
      shouldRenderScannedText: false,
    });
  });

  it('derives deep-scan progress rows from user cache entries', () => {
    const viewAddress = '0x00000000000000000000000000000000000000AA';
    const viewLower = viewAddress.toLowerCase();
    const getSessionDisplayConfig = jest.fn((slug: string) =>
      slug === 'edge-session' ? { sessionName: 'Edge Session', blockLimits: { start: 100 } } : null,
    );

    const rows = deriveUserPageDeepScanProgressRows({
      currentChainId: 84532,
      getSessionDisplayConfig,
      latestBlockNum: 200,
      prioritySlugs: ['edge-session'],
      userCaches: [
        {
          slug: 'edge-session',
          data: {
            [viewLower]: {
              '84532': { lastBlockScanned: 125 },
              '10': { lastBlockScanned: 80 },
              bad: { lastBlockScanned: 0 },
            },
          },
        },
      ],
      viewLower,
    });

    expect(rows).toEqual([
      {
        slug: 'edge-session',
        chainId: 84532,
        lastBlockScanned: 125,
        latestBlock: 200,
        remainingBlocks: 75,
        percentComplete: 25,
        isDeterminate: true,
        label: 'Edge Session (edge-session) (chain 84532)',
        startBlock: 100,
        displayLastBlock: 125,
      },
      {
        slug: 'edge-session',
        chainId: 10,
        lastBlockScanned: 80,
        latestBlock: null,
        remainingBlocks: null,
        percentComplete: null,
        isDeterminate: false,
        label: 'Edge Session (edge-session) (chain 10)',
        startBlock: 100,
        displayLastBlock: 100,
      },
    ]);
    expect(getSessionDisplayConfig).toHaveBeenCalledTimes(1);
    expect(deriveUserPageDeepScanProgressRows({ userCaches: [], viewLower })).toBeNull();
  });

  it('builds deep-scan row signatures from progress fields', () => {
    expect(buildUserPageDeepScanProgressRowsSignature([makeRow({ label: 'Alpha Session' })])).toBe(
      'alpha:84532:1000:1200:200:50:1:Alpha Session',
    );
    expect(buildUserPageDeepScanProgressRowsSignature(null)).toBe('');
    expect(
      buildUserPageDeepScanTooltipOutputSignature({
        deepScanTooltipLines: ['Alpha', 'Beta'],
        deepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
      }),
    ).toBe('Alpha|Beta||alpha:84532:1000:1200:200:50:1:Alpha Session');
    expect(
      buildUserPageDeepScanTooltipOutputSignature({
        deepScanTooltipLines: null,
        deepScanProgressRows: null,
      }),
    ).toBe('||');
    expect(
      resolveUserPageDeepScanProgressStateUpdate({
        currentDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
        currentDeepScanTooltipLines: ['Alpha', 'Beta'],
        nextDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
        nextDeepScanTooltipLines: ['Alpha', 'Beta'],
      }),
    ).toEqual({
      nextOutputSignature: 'Alpha|Beta||alpha:84532:1000:1200:200:50:1:Alpha Session',
      shouldUpdate: false,
    });
    expect(
      resolveUserPageDeepScanProgressStateUpdate({
        currentDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
        currentDeepScanTooltipLines: ['Alpha'],
        nextDeepScanProgressRows: [makeRow({ label: 'Beta Session', remainingBlocks: 150 })],
        nextDeepScanTooltipLines: ['Beta'],
      }),
    ).toEqual({
      nextOutputSignature: 'Beta||alpha:84532:1000:1200:150:50:1:Beta Session',
      shouldUpdate: true,
    });
    expect(normalizeUserPageDeepScanTooltipLines(['Alpha', 2])).toEqual(['Alpha', '2']);
    expect(normalizeUserPageDeepScanTooltipLines([])).toBeNull();
    expect(normalizeUserPageDeepScanProgressRows([makeRow({ label: 'Alpha Session' })])).toEqual([
      makeRow({ label: 'Alpha Session' }),
    ]);
    expect(normalizeUserPageDeepScanProgressRows([])).toBeNull();
  });
});
