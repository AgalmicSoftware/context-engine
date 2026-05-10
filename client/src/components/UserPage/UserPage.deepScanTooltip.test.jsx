/** @file UserPage.deepScanTooltip.test.jsx */
import UserPage from './UserPage';
import styles from './UserPage.module.scss';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';

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

jest.mock('utilities/ai/aiScripts.js', () => ({
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
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
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
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  try { delete globalThis.CE_SESSION_SCAN_SCOPE; } catch (_) {}
  try { delete globalThis.CE_SESSION_SCAN_SLUGS; } catch (_) {}
});

describe('UserPage deep scan tooltip formatting', () => {
  it('uses explicit demo-session display config for deep-scan tooltip labels when registry config is missing', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(null);
    const demoConfigSpy = jest
      .spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'edge',
        sessionName: 'Edge Demo Session',
        blockLimits: {
          start: 1000,
        },
      });

    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'edge',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 1600,
          },
        },
      },
    }];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      2000
    );

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
    const userCaches = [{
      slug: 'edge',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 1600,
          },
        },
      },
    }];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      2000
    );

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
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 15234567,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      18000000
    );

    expect(lines).toEqual([
      'Session: test-session',
      `${(18000000 - 15234567).toLocaleString()} blocks remaining`,
    ]);
  });

  it('falls back to localized scanned blocks when latest block is unavailable', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 15234567,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      null
    );

    expect(lines).toEqual([
      'Session: test-session',
      `${(15234567).toLocaleString()} scanned`,
    ]);
  });

  it('shows "Up to date" when session progress is within 100 blocks of latest', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 17999900,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      18000000
    );

    expect(lines).toEqual([
      'Session: test-session',
      'Up to date',
    ]);
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
            '84532': {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '11155111': {
              lastBlockScanned: 2500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      3000
    );

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
            '84532': {
              lastBlockScanned: 2500,
            },
            '11155111': {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      3000
    );

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
    jest
      .spyOn(instance, '_getDeepScanSessionDisplayConfig')
      .mockImplementation((slug) => ({
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
            '84532': {
              lastBlockScanned: 3900,
            },
          },
        },
      },
      {
        slug: 'session-c',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 3300,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 2700,
            },
          },
        },
      },
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 1800,
            },
          },
        },
      },
    ];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      4000
    );

    expect(rows.map((row) => row.slug)).toEqual([
      'session-a',
      'session-b',
      'session-c',
      'session-z',
    ]);
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
      (node) => node?.type === 'a' && node?.props?.href === `/u/${viewAddress}` && node?.props?.className === styles.addressLink
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.['aria-label'] === 'View address on explorer'
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
      (node) => node?.type === 'a' && node?.props?.href === explorerHref && node?.props?.className === styles.addressLink
    );

    expect(addressLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBe('_blank');
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
      (node) => node?.type === 'a' && node?.props?.className === styles.addressLink
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.className === styles.explorerLink
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
      surveyResponseInfo: [{
        id: '0xsurvey',
        title: 'Survey 1',
        questionsCount: 1,
        tags: [],
        documentURLs: [],
        slug: 'edge',
      }],
      expandedSurveyResponses: { '0xsurvey': true },
      detailedSurveyResponses: {
        '0xsurvey': [{
          questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
          responseData: { questionID: 'q1', answer: { value: 'visible answer' } },
          canDecryptOtherResponses: true,
        }],
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
    const responseCards = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'SingleQuestionResponse'
    );
    const surveyResponseCard = responseCards.find(
      (node) => node?.props?.responderAddress === instance.props.viewAddress
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
      (node) => String(node?.props?.['aria-label'] || '') === 'Open My Bookmarks'
    );

    expect(ownerBookmarkShortcuts).toHaveLength(0);
  });
});
