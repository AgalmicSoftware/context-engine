/** @file UserPage.deepScanTooltip.test.jsx */
import UserPage from './UserPage';
import styles from './UserPage.module.scss';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiClient.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return collectTreeNodes(rendered, predicate, acc);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const RESOLVABLE_USER_PAGE_COMPONENTS = new Set([
  'UserPageDeepScanStatusIndicator',
  'UserPageDeepScanProgressPanel',
  'UserPageHeader',
  'UserPageQuestionSection',
  'UserPageSbtSection',
  'UserPageSurveySection',
]);

const resolvedComponentCache = new WeakMap();

const renderResolvableComponent = (node) => {
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_USER_PAGE_COMPONENTS.has(typeName)) return null;
  if (typeof node?.type !== 'function') return null;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  const rendered = node.type(node.props || {});
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasText(rendered, text);
  return treeHasText(node?.props?.children, text);
};

const normalizeChildrenArray = (value) => (Array.isArray(value) ? value : [value].filter(Boolean));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  try {
    delete globalThis.CE_SESSION_SCAN_SCOPE;
  } catch (_) {}
  try {
    delete globalThis.CE_SESSION_SCAN_SLUGS;
  } catch (_) {}
});

describe('UserPage deep scan tooltip formatting', () => {
  it('uses explicit demo-session display config for deep-scan tooltip labels when registry config is missing', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(null);
    const demoConfigSpy = jest.spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'edge',
      sessionName: 'Edge Demo Session',
      blockLimits: {
        start: 1000,
      },
    });

    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'edge',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 1600,
            },
          },
        },
      },
    ];

    const rows = instance._deriveDeepScanProgressRows(userCaches, viewLower, 84532, 2000);

    expect(rows).toEqual([
      expect.objectContaining({
        slug: 'edge',
        label: 'Edge Demo Session (edge)',
      }),
    ]);
    expect(demoConfigSpy).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('derives determinate progress rows with percent complete when start and latest blocks are known', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    jest.spyOn(instance, '_getDeepScanSessionDisplayConfig').mockReturnValue({
      sessionName: 'Edge Session',
      blockLimits: {
        start: 1000,
      },
    });
    const userCaches = [
      {
        slug: 'edge',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 1600,
            },
          },
        },
      },
    ];

    const rows = instance._deriveDeepScanProgressRows(userCaches, viewLower, 84532, 2000);

    expect(rows).toEqual([
      expect.objectContaining({
        slug: 'edge',
        chainId: 84532,
        lastBlockScanned: 1600,
        latestBlock: 2000,
        remainingBlocks: 400,
        percentComplete: 60,
        isDeterminate: true,
        label: 'Edge Session (edge)',
        displayLastBlock: 1600,
      }),
    ]);
  });

  it('formats latest-known progress as localized remaining-block counts', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'test-session',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 15234567,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(userCaches, viewLower, 84532, 18000000);

    expect(lines).toEqual(['Session: test-session', `${(18000000 - 15234567).toLocaleString()} blocks remaining`]);
  });

  it('falls back to localized scanned blocks when latest block is unavailable', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'test-session',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 15234567,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(userCaches, viewLower, 84532, null);

    expect(lines).toEqual(['Session: test-session', `${(15234567).toLocaleString()} scanned`]);
  });

  it('shows "Up to date" when session progress is within 100 blocks of latest', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'test-session',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 17999900,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(userCaches, viewLower, 84532, 18000000);

    expect(lines).toEqual(['Session: test-session', 'Up to date']);
  });

  it('renders multiple entries as two-line blocks separated by a blank line', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            11155111: {
              lastBlockScanned: 2500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(userCaches, viewLower, 84532, 3000);

    expect(lines).toEqual([
      'Session: session-b',
      `${(2500).toLocaleString()} scanned`,
      '',
      'Session: session-a',
      `${(1500).toLocaleString()} blocks remaining`,
    ]);
  });

  it('adds chain IDs only for session slugs that appear on multiple networks', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 2500,
            },
            11155111: {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(userCaches, viewLower, 84532, 3000);

    expect(lines).toEqual([
      'Session: session-a (chain 84532)',
      `${(500).toLocaleString()} blocks remaining`,
      '',
      'Session: session-a (chain 11155111)',
      `${(1500).toLocaleString()} scanned`,
      '',
      'Session: session-b',
      `${(2500).toLocaleString()} blocks remaining`,
    ]);
  });

  it('prioritizes the saved scan-scope session order and keeps an out-of-scope active session first', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = ['session-b', 'session-c'];

    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({
      viewAddress,
      activeSessionSlug: 'session-a',
    });
    jest.spyOn(instance, '_getDeepScanSessionDisplayConfig').mockImplementation((slug) => ({
      sessionName: String(slug || '').toUpperCase(),
      blockLimits: {
        start: 1000,
      },
    }));

    const userCaches = [
      {
        slug: 'session-z',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 3900,
            },
          },
        },
      },
      {
        slug: 'session-c',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 3300,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 2700,
            },
          },
        },
      },
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            84532: {
              lastBlockScanned: 1800,
            },
          },
        },
      },
    ];

    const rows = instance._deriveDeepScanProgressRows(userCaches, viewLower, 84532, 4000);

    expect(rows.map((row) => row.slug)).toEqual(['session-a', 'session-b', 'session-c', 'session-z']);
  });

  it('returns memoized deep-scan tooltip lines without re-scanning cache in render path', () => {
    const instance = makeInstance();
    instance.state.deepScanTooltipLines = ['edge / 84532: 120'];
    const scanSpy = jest.spyOn(instance, '_dgReadAll');

    const first = instance.buildDeepScanProgressTooltip();
    const second = instance.buildDeepScanProgressTooltip();

    expect(first).toEqual(['edge / 84532: 120']);
    expect(second).toEqual(['edge / 84532: 120']);
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('includes general-slug progress in deep-scan timer input signatures', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({
      viewAddress,
      network: { id: 84532 },
      latestBlockNumber: 120,
    });
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceSlugsSync').mockReturnValue(['']);
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockReturnValueOnce({
        [viewLower]: {
          84532: {
            lastBlockScanned: 10,
            lastScanTimestamp: 1,
          },
        },
      })
      .mockReturnValueOnce({
        [viewLower]: {
          84532: {
            lastBlockScanned: 11,
            lastScanTimestamp: 2,
          },
        },
      });

    const first = instance._buildDeepScanTooltipInputSignature();
    const second = instance._buildDeepScanTooltipInputSignature();

    expect(first).not.toEqual(second);
    expect(first).toContain(':84532:10:1');
    expect(second).toContain(':84532:11:2');

    listSpy.mockRestore();
    peekSpy.mockRestore();
  });

  it('refreshes deep-scan tooltip lines on timer ticks while deep scanning', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest
      .spyOn(instance, '_buildDeepScanTooltipInputSignature')
      .mockReturnValueOnce('sig-1')
      .mockReturnValueOnce('sig-2');
    jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValueOnce({ lines: ['edge / 84532: 11'], rows: null })
      .mockReturnValueOnce({ lines: ['edge / 84532: 12'], rows: null });

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);
    expect(instance.state.deepScanTooltipLines).toEqual(['edge / 84532: 11']);
    jest.advanceTimersByTime(2000);
    expect(instance.state.deepScanTooltipLines).toEqual(['edge / 84532: 12']);
    instance.stopDeepScanProgressTimer();
  });

  it('skips deep-scan tooltip recompute when timer inputs are unchanged', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest.spyOn(instance, '_buildDeepScanTooltipInputSignature').mockReturnValue('stable');
    const computeSpy = jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValue({ lines: ['edge / 84532: 10'], rows: null });

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(2000);

    expect(computeSpy).toHaveBeenCalledTimes(1);
    instance.stopDeepScanProgressTimer();
  });

  it('skips deep-scan timer state writes when tooltip output is unchanged', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest.spyOn(instance, '_buildDeepScanTooltipInputSignature').mockReturnValue('sig-1');
    jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValue({ lines: ['edge / 84532: 10'], rows: null });
    instance.setState.mockClear();

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);

    expect(instance.setState).not.toHaveBeenCalled();
    instance.stopDeepScanProgressTimer();
  });

  it('renders full deep-scan tooltip line lists without abbreviation', () => {
    const instance = makeInstance();
    const deepLines = Array.from({ length: 10 }, (_, idx) => `session-${idx + 1} / 84532: ${120 + idx}`);
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: deepLines,
      loadingSurveys: true,
      loadingSBTs: true,
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && String(node?.props?.target || '').includes('surveySpinner_'),
    );
    expect(tooltips.length).toBeGreaterThan(0);

    const tooltipChildren = normalizeChildrenArray(tooltips[0]?.props?.children);
    expect(tooltipChildren).toHaveLength(deepLines.length);
    expect(tooltipChildren[deepLines.length - 1]?.props?.children).toBe(deepLines[deepLines.length - 1]);
  });

  it('renders compact progress-bar rows when structured deep-scan progress is available', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: ['Session: Edge Session', '400 blocks remaining'],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: 2000,
          remainingBlocks: 400,
          percentComplete: 60,
          isDeterminate: true,
          label: 'Edge Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && String(node?.props?.target || '').includes('surveySpinner_'),
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Edge Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '400 blocks remaining')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '1,600 / 2,000 scanned')).toBe(true);

    const fills = collectTreeNodes(
      tooltips[0]?.props?.children,
      (node) => node?.props?.className === styles.deepScanProgressFill,
    );
    expect(fills).toHaveLength(1);
    expect(fills[0]?.props?.style).toEqual(expect.objectContaining({ width: '60%' }));
  });

  it('renders indeterminate fallback rows when latest block is unavailable', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: ['Session: Edge Session', '1,600 scanned'],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: null,
          remainingBlocks: null,
          percentComplete: null,
          isDeterminate: false,
          label: 'Edge Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && String(node?.props?.target || '').includes('surveySpinner_'),
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Edge Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '1,600 scanned')).toBe(true);

    const fills = collectTreeNodes(
      tooltips[0]?.props?.children,
      (node) => node?.props?.className === styles.deepScanProgressFill,
    );
    expect(fills).toHaveLength(0);
  });

  it('filters blank separator lines from spinner title text while preserving tooltip spacing', () => {
    const instance = makeInstance();
    const deepLines = ['Session: alpha', '100 scanned', '', 'Session: beta', '200 scanned', '   '];
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: deepLines,
      loadingSurveys: true,
    };

    const tree = instance.render();
    const surveySpinners = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'FontAwesomeIcon' && String(node?.props?.id || '').includes('surveySpinner_'),
    );
    expect(surveySpinners.length).toBeGreaterThan(0);
    expect(surveySpinners[0]?.props?.title).toBe(
      'Deep scan: Session: alpha | 100 scanned | Session: beta | 200 scanned',
    );

    const tooltips = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && String(node?.props?.target || '').includes('surveySpinner_'),
    );
    expect(tooltips.length).toBeGreaterThan(0);
    const tooltipChildren = normalizeChildrenArray(tooltips[0]?.props?.children);
    expect(tooltipChildren.map((child) => child?.props?.children)).toEqual(deepLines);
  });

  it('keeps deep-scan progress details hover-only instead of rendering inline summary copy', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: [
        'Session: Edge Session',
        'Up to date',
        '',
        'Session: Beta Session',
        '400 blocks remaining',
      ],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 2000,
          latestBlock: 2000,
          remainingBlocks: 0,
          percentComplete: 100,
          isDeterminate: true,
          label: 'Edge Session',
          displayLastBlock: 2000,
        },
        {
          slug: 'beta',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: 2000,
          remainingBlocks: 400,
          percentComplete: 60,
          isDeterminate: true,
          label: 'Beta Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    expect(treeHasText(tree, 'Syncing profile history')).toBe(false);
    expect(treeHasText(tree, 'Beta Session: 400 blocks left')).toBe(false);

    const tooltips = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && String(node?.props?.target || '').includes('surveySpinner_'),
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Beta Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '400 blocks remaining')).toBe(true);
  });

  it('sets hover/focus/click + non-autohide props on all section spinner tooltips and exposes the loading panel on each target', () => {
    const instance = makeInstance();
    const deepLines = ['Session: Edge Session', '400 blocks remaining'];
    const progressRows = [
      {
        slug: 'edge',
        chainId: 84532,
        lastBlockScanned: 1600,
        latestBlock: 2000,
        remainingBlocks: 400,
        percentComplete: 60,
        isDeterminate: true,
        label: 'Edge Session',
        displayLastBlock: 1600,
      },
    ];
    const spinnerTargetPattern =
      /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const collectSpinnerTooltips = (tab) => {
      instance.state = {
        ...instance.state,
        selectedTab: tab,
        isDeepScanning: true,
        deepScanTooltipLines: deepLines,
        deepScanProgressRows: progressRows,
        loadingSurveys: true,
        loadingQuestions: true,
        loadingSBTs: true,
      };
      const tree = instance.render();
      return collectTreeNodes(
        tree,
        (node) =>
          getNodeTypeName(node) === 'UncontrolledTooltip' &&
          spinnerTargetPattern.test(String(node?.props?.target || '')),
      );
    };

    const surveyTabTips = collectSpinnerTooltips('surveys');
    const questionTabTips = collectSpinnerTooltips('questions');
    const allTips = [...surveyTabTips, ...questionTabTips];

    allTips.forEach((tip) => {
      expect(tip.props.trigger).toBe('hover focus click');
      expect(tip.props.autohide).toBe(false);
      expect(treeHasText(tip.props.children, 'Deep scan in progress')).toBe(true);
      expect(treeHasText(tip.props.children, 'Edge Session')).toBe(true);
    });

    const allTargets = allTips.map((tip) => String(tip.props.target || '')).join('|');
    expect(allTargets).toContain('surveySpinner_');
    expect(allTargets).toContain('surveysCreatedSpinner_');
    expect(allTargets).toContain('questionSpinner_');
    expect(allTargets).toContain('questionsCreatedSpinner_');
    expect(allTargets).toContain('sbtSpinner_');
  });

  it('sanitizes spinner tooltip target IDs when viewAddress contains route characters', () => {
    const instance = makeInstance({
      viewAddress: '/session/test-10/survey/0xad3f',
    });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 150'],
      loadingSurveys: true,
      loadingQuestions: true,
      loadingSBTs: true,
    };
    const spinnerTargetPattern =
      /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const tree = instance.render();
    const tooltipTargets = collectTreeNodes(
      tree,
      (node) =>
        getNodeTypeName(node) === 'UncontrolledTooltip' && spinnerTargetPattern.test(String(node?.props?.target || '')),
    ).map((node) => String(node?.props?.target || ''));

    expect(tooltipTargets.length).toBeGreaterThan(0);
    tooltipTargets.forEach((target) => {
      expect(target).not.toContain('/');
      expect(target).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  it('stops spinner interactions from bubbling so section headers do not collapse on tooltip click', () => {
    const instance = makeInstance();
    const deepLines = ['edge / 84532: 150'];
    const spinnerTargetPattern =
      /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const collectSpinnerIcons = (tab) => {
      instance.state = {
        ...instance.state,
        selectedTab: tab,
        isDeepScanning: true,
        deepScanTooltipLines: deepLines,
        loadingSurveys: true,
        loadingQuestions: true,
        loadingSBTs: true,
      };
      const tree = instance.render();
      return collectTreeNodes(
        tree,
        (node) =>
          getNodeTypeName(node) === 'FontAwesomeIcon' && spinnerTargetPattern.test(String(node?.props?.id || '')),
      );
    };

    const surveyTabIcons = collectSpinnerIcons('surveys');
    const questionTabIcons = collectSpinnerIcons('questions');
    const allIcons = [...surveyTabIcons, ...questionTabIcons];
    expect(allIcons.length).toBeGreaterThan(0);

    allIcons.forEach((iconNode) => {
      expect(typeof iconNode?.props?.onClick).toBe('function');
      expect(typeof iconNode?.props?.onMouseDown).toBe('function');

      const clickStop = jest.fn();
      iconNode.props.onClick({ stopPropagation: clickStop });
      expect(clickStop).toHaveBeenCalledTimes(1);

      const mouseDownStop = jest.fn();
      iconNode.props.onMouseDown({ stopPropagation: mouseDownStop });
      expect(mouseDownStop).toHaveBeenCalledTimes(1);
    });
  });

  it('links the minimized address text to the profile page and keeps the icon on the block explorer', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: true,
      network: { id: 84532, chainId: 84532 },
    });

    const tree = instance.render();
    const explorerHref = `https://sepolia.basescan.org/address/${viewAddress}`;
    const addressLinks = collectTreeNodes(
      tree,
      (node) =>
        node?.type === 'a' &&
        node?.props?.href === `/u/${viewAddress}` &&
        node?.props?.className === styles.addressLink,
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.['aria-label'] === 'View address on explorer',
    );

    expect(treeHasText(tree, '0x000...00aa')).toBe(true);
    expect(addressLinks).toHaveLength(1);
    expect(explorerLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBeUndefined();
    expect(explorerLinks[0]?.props?.href).toBe(explorerHref);
  });

  it('links the full-size address text to the block explorer', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: false,
      network: { id: 84532, chainId: 84532 },
    });

    const tree = instance.render();
    const explorerHref = `https://sepolia.basescan.org/address/${viewAddress}`;
    const addressLinks = collectTreeNodes(
      tree,
      (node) =>
        node?.type === 'a' && node?.props?.href === explorerHref && node?.props?.className === styles.addressLink,
    );

    expect(addressLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBe('_blank');
  });

  it('uses the session network for explorer links on session-scoped pages', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue({
      slug: 'demo-1',
      networkChainId: 11155420,
    });
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: false,
      activeSessionSlug: 'demo-1',
      network: { id: 84532, chainId: 84532 },
    });

    const tree = instance.render();
    const explorerHref = `https://optimism-sepolia.blockscout.com/address/${viewAddress}`;
    const addressLinks = collectTreeNodes(
      tree,
      (node) =>
        node?.type === 'a' && node?.props?.href === explorerHref && node?.props?.className === styles.addressLink,
    );

    expect(instance.getExplorerUrl()).toBe(explorerHref);
    expect(addressLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBe('_blank');
    expect(contractScriptsModule.getSessionConfigBySlug).toHaveBeenCalledWith('demo-1');
  });

  it('omits explorer links when the active chain has no known explorer metadata', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: false,
      network: { id: 777777, chainId: 777777 },
    });

    const tree = instance.render();
    const addressLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.className === styles.addressLink,
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.className === styles.explorerLink,
    );

    expect(instance.getExplorerUrl()).toBeNull();
    expect(addressLinks).toHaveLength(0);
    expect(explorerLinks).toHaveLength(0);
    expect(treeHasText(tree, '0x000...00aa')).toBe(true);
  });

  it('passes the survey source slug into survey-response question cards', () => {
    const instance = makeInstance({
      viewAddress: '0x00000000000000000000000000000000000000aa',
      selectedTab: 'surveys',
    });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      showSectionSurveyResponsesOpen: true,
      surveyResponseInfo: [
        {
          id: '0xsurvey',
          title: 'Survey 1',
          questionsCount: 1,
          tags: [],
          documentURLs: [],
          slug: 'edge',
        },
      ],
      expandedSurveyResponses: { '0xsurvey': true },
      detailedSurveyResponses: {
        '0xsurvey': [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: { questionID: 'q1', answer: { value: 'visible answer' } },
            canDecryptOtherResponses: true,
          },
        ],
      },
      surveyCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionCreationInfo: [],
      loadingSurveys: false,
      loadingQuestions: false,
      isDeepScanning: false,
    };

    const tree = instance.render();
    const responseCards = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'SingleQuestionResponse');
    const surveyResponseCard = responseCards.find(
      (node) => node?.props?.responderAddress === instance.props.viewAddress,
    );

    expect(surveyResponseCard).toBeDefined();
    expect(surveyResponseCard?.props?.sessionSlug).toBe('edge');
  });

  it('does not render the minimized owner bookmark icon shortcut', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: true,
    });

    const tree = instance.render();
    const ownerBookmarkShortcuts = collectTreeNodes(
      tree,
      (node) => String(node?.props?.['aria-label'] || '') === 'Open My Bookmarks',
    );

    expect(ownerBookmarkShortcuts).toHaveLength(0);
  });
});
