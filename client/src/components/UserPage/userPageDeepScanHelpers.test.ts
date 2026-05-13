import {
  buildUserPageDeepScanProgressRow,
  buildUserPageDeepScanProgressRowDisplayState,
  buildUserPageDeepScanProgressRowsSignature,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanPrioritySlugs,
  buildUserPageDeepScanReportSamples,
  buildUserPageDeepScanReportSignature,
  buildUserPageDeepScanReportStatePatch,
  buildUserPageDeepScanReportStatus,
  buildUserPageDeepScanReportTelemetryPayloads,
  buildUserPageDeepScanRequestStatePatch,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageDeepScanTooltipInputSignature,
  buildUserPageDeepScanTooltipOutputSignature,
  deriveUserPageDeepScanProgressRows,
  formatUserPageDeepScanBlockCount,
  formatUserPageDeepScanTooltipLinesFromRows,
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
  resolveUserPageDeepScanProgressStateUpdate,
  resolveUserPageDeepScanSessionDisplayConfig,
  shouldApplyUserPageDeepScanResponse,
  sortUserPageDeepScanProgressRows,
  type UserPageDeepScanProgressRow,
} from './userPageDeepScanHelpers';

const makeRow = (overrides: Partial<UserPageDeepScanProgressRow> = {}): UserPageDeepScanProgressRow => ({
  chainId: 11155420,
  displayLastBlock: 90,
  isDeterminate: true,
  label: 'Alpha Session',
  lastBlockScanned: 90,
  latestBlock: 100,
  percentComplete: 90,
  remainingBlocks: 10,
  slug: 'alpha',
  startBlock: 0,
  ...overrides,
});

describe('userPageDeepScanHelpers', () => {
  it('builds deep-scan tooltip input signatures from cache progress', () => {
    const cacheBySlug: Record<string, unknown> = {
      alpha: {
        '0xabc': {
          '11155420': {
            lastBlockScanned: 50,
            lastScanTimestamp: 123,
          },
        },
      },
      beta: {
        '0xdef': {
          '11155420': {
            lastBlockScanned: 90,
            lastScanTimestamp: 456,
          },
        },
      },
    };

    expect(buildUserPageDeepScanTooltipInputSignature({
      latestBlockNumber: 100,
      listNamespaceSlugs: () => ['beta', 'alpha'],
      network: { id: 11155420 },
      peekCache: (_namespace, slug) => cacheBySlug[slug],
      viewAddress: '0xABC',
    })).toBe('0xabc|11155420|100|alpha:11155420:50:123;beta:');
    expect(buildUserPageDeepScanTooltipInputSignature({
      viewAddress: '',
    })).toBe('');
  });

  it('builds priority slugs and resolves deep-scan session display config fallbacks', () => {
    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: 'alpha',
      getAllowedSessionSlugs: () => ['beta', 'alpha'],
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['beta', 'alpha'],
    })).toEqual(['beta', 'alpha']);
    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: 'alpha',
      getAllowedSessionSlugs: () => ['beta'],
      readSessionScanScope: () => 'active',
      readSessionScanSlugs: () => ['beta'],
    })).toEqual(['alpha', 'beta']);

    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getSessionConfigBySlugOrDefault: () => ({ sessionName: 'Default' }),
      slugIn: '',
    })).toEqual({ sessionName: 'Default' });
    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug: () => ({ sessionName: 'Demo' }),
      getSessionConfigBySlug: () => null,
      slugIn: 'alpha',
    })).toEqual({ sessionName: 'Demo' });
  });

  it('formats deep-scan rows, display state, and tooltip lines', () => {
    expect(formatUserPageDeepScanBlockCount(12345.9)).toBe('12,345');
    expect(formatUserPageDeepScanBlockCount(-5)).toBe('0');
    expect(formatUserPageDeepScanBlockCount('bad')).toBe('0');

    const determinateRow = buildUserPageDeepScanProgressRow({
      chainId: 84532,
      lastBlock: 150,
      latestBlock: 200,
      sessionConfig: { sessionName: 'Alpha Session' },
      slug: 'alpha',
      startBlock: 100,
    });
    expect(determinateRow).toMatchObject({
      chainId: 84532,
      displayLastBlock: 150,
      isDeterminate: true,
      label: 'Alpha Session (alpha)',
      percentComplete: 50,
      remainingBlocks: 50,
    });
    expect(buildUserPageDeepScanProgressRowDisplayState({
      index: 2,
      row: determinateRow,
    })).toMatchObject({
      progressWidth: '50%',
      remainingText: '50 blocks remaining',
      rowKey: 'alpha_84532_2',
      scannedText: '150 / 200 scanned',
      shouldRenderScannedText: true,
    });
    expect(formatUserPageDeepScanTooltipLinesFromRows([determinateRow])).toEqual([
      'Session: Alpha Session (alpha)',
      'Up to date',
    ]);
    expect(formatUserPageDeepScanTooltipLinesFromRows([])).toBeNull();
  });

  it('derives and sorts deep-scan progress rows from user cache entries', () => {
    const viewLower = '0xabc';
    const rows = deriveUserPageDeepScanProgressRows({
      currentChainId: 84532,
      getSessionDisplayConfig: (slug) => (
        slug === 'alpha'
          ? { sessionName: 'Alpha Session', blockLimits: { start: 100 } }
          : { sessionName: 'Beta Session' }
      ),
      latestBlockNum: 200,
      prioritySlugs: ['beta', 'alpha'],
      userCaches: [
        {
          slug: 'alpha',
          data: {
            [viewLower]: {
              '11155420': { lastBlockScanned: 80 },
              '84532': { lastBlockScanned: 150 },
            },
          },
        },
        {
          slug: 'beta',
          data: {
            [viewLower]: {
              '84532': { lastBlockScanned: 190 },
            },
          },
        },
      ],
      viewLower,
    });

    expect(rows?.map((row) => row.label)).toEqual([
      'Beta Session (beta)',
      'Alpha Session (alpha) (chain 84532)',
      'Alpha Session (alpha) (chain 11155420)',
    ]);
    expect(sortUserPageDeepScanProgressRows(rows, ['alpha'])?.[0].slug).toBe('alpha');
    expect(deriveUserPageDeepScanProgressRows({ userCaches: [], viewLower })).toBeNull();
  });

  it('classifies deep-scan reports and builds telemetry payloads', () => {
    const report = {
      anyNewData: true,
      attemptedSlugs: ['alpha', 'beta'],
      coverageComplete: false,
      coverageReason: 'rpc-partial',
      failedActivitySlugs: ['beta'],
      failedSlugs: [],
      hadRpcErrors: true,
      registryEntryCount: 2,
      sampleCreatedQuestionIds: ['q1'],
      sampleCreatedSurveyIds: ['s1'],
      sampleQuestionResponseIds: ['qr1', 'qr2'],
      sampleSbtAddresses: ['0xsbt'],
      sampleSurveyResponseIds: ['sr1'],
      scannedSlugs: ['alpha'],
      skippedSlugs: [],
      totalQuestionResponsesFound: 2,
      totalSurveyResponsesFound: 1,
      usedAllSessions: true,
    };
    const status = buildUserPageDeepScanReportStatus({ report });

    expect(buildUserPageDeepScanReportSignature({ report, reportTargetLower: '0xabc' })).toBe(
      '0xabc|1|rpc-partial|0|alpha,beta|alpha|||beta'
    );
    expect(status).toMatchObject({
      hasCoverageGap: true,
      hasUncertainSbtData: true,
      hasUncertainUserData: true,
      rawHadRpcErrors: true,
    });
    expect(buildUserPageDeepScanReportStatePatch(status)).toEqual({
      hasUncertainGateAccess: false,
      hasUncertainSbtData: true,
      hasUncertainUserData: true,
      isDeepScanning: false,
    });
    expect(buildUserPageDeepScanRequestStatePatch()).toEqual({
      hasUncertainGateAccess: false,
      hasUncertainSbtData: false,
      hasUncertainUserData: false,
      isDeepScanning: true,
    });
    expect(buildUserPageDeepScanReportSamples({ report, limit: 1 })).toEqual({
      sampleCreatedQuestionIds: ['q1'],
      sampleCreatedSurveyIds: ['s1'],
      sampleQuestionResponseIds: ['qr1'],
      sampleSbtAddresses: ['0xsbt'],
      sampleSurveyResponseIds: ['sr1'],
    });
    expect(buildUserPageDeepScanReportTelemetryPayloads({
      report,
      status,
      viewAddress: '0xABC',
    }).telemetryPayload).toMatchObject({
      attemptedSlugs: ['alpha', 'beta'],
      coverageComplete: false,
      hadRpcErrors: true,
      sampleQuestionResponseIds: ['qr1', 'qr2'],
      viewAddress: '0xabc',
    });
  });

  it('builds progress signatures and normalizes carried tooltip state', () => {
    const alpha = makeRow({ label: 'Alpha Session' });
    const beta = makeRow({ label: 'Beta Session', remainingBlocks: 150 });

    expect(buildUserPageDeepScanProgressStatePatch({
      deepScanProgressRows: [alpha],
      deepScanTooltipLines: ['Alpha: 50%'],
      now: 1234,
    })).toEqual({
      deepScanProgressRows: [alpha],
      deepScanProgressTick: 1234,
      deepScanTooltipLines: ['Alpha: 50%'],
    });
    expect(buildUserPageDeepScanTooltipDisplayState({
      deepScanProgressRows: [alpha],
      fallbackLine: 'Scanning...',
    })).toEqual({
      deepScanTooltipContent: ['Scanning...'],
      deepScanTooltipText: 'Scanning...',
      deepScanTooltipTitle: 'Deep scan: Scanning...',
    });
    expect(buildUserPageDeepScanProgressRowsSignature([alpha])).toContain('Alpha Session');
    expect(buildUserPageDeepScanTooltipOutputSignature({
      deepScanProgressRows: [alpha],
      deepScanTooltipLines: ['Alpha', 'Beta'],
    })).toContain('Alpha|Beta');
    expect(resolveUserPageDeepScanProgressStateUpdate({
      currentDeepScanProgressRows: [alpha],
      currentDeepScanTooltipLines: ['Alpha'],
      nextDeepScanProgressRows: [beta],
      nextDeepScanTooltipLines: ['Beta'],
    })).toMatchObject({
      shouldUpdate: true,
    });
    expect(normalizeUserPageDeepScanTooltipLines(['Alpha', 2])).toEqual(['Alpha', '2']);
    expect(normalizeUserPageDeepScanTooltipLines([])).toBeNull();
    expect(normalizeUserPageDeepScanProgressRows([alpha])).toEqual([alpha]);
    expect(normalizeUserPageDeepScanProgressRows([])).toBeNull();
    expect(shouldApplyUserPageDeepScanResponse({
      activeRequestSeq: 2,
      currentViewAddress: '0xABC',
      isMounted: true,
      requestSeq: 2,
      targetLower: '0xabc',
    })).toBe(true);
  });
});
