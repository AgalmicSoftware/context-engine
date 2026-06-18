import SurveyTool from './SurveyTool';
import { PileViewMode } from './SurveyPileViewMode';
import SurveyQuestionsLockedQuestionsPanel from './SurveyQuestionsLockedQuestionsPanel';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

const expandInspectableNode = (node) => (
  node?.type === SurveyQuestionsLockedQuestionsPanel
    ? SurveyQuestionsLockedQuestionsPanel(node.props)
    : node
);

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  const expandedNode = expandInspectableNode(node);
  if (expandedNode !== node) return treeHasDataTestId(expandedNode, testId);
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  const expandedNode = expandInspectableNode(node);
  if (expandedNode !== node) return treeHasText(expandedNode, text);
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const treeHasLinkHref = (node, href) => {
  if (node == null) return false;
  const expandedNode = expandInspectableNode(node);
  if (expandedNode !== node) return treeHasLinkHref(expandedNode, href);
  if (Array.isArray(node)) return node.some((child) => treeHasLinkHref(child, href));
  if (typeof node !== 'object') return false;
  if (node?.type === 'a' && node?.props?.href === href) return true;
  return treeHasLinkHref(node?.props?.children, href);
};

describe('SurveyPileViewMode gated empty states', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps hydrate loading active when only gate hints are known and no hidden questions are cached', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      recipients: [{ type: 'lit-sbt-v1' }],
      allowFallbackConditions: true,
    }));
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);

    const tree = subject.render();
    expect(treeHasText(tree, 'No accessible questions. This session has gated content.')).toBe(false);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(true);
  });

  it('shows gated empty state for default-gated pile questions while metadata is still unresolved', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const sessionConfig = {
      slug: 'edge',
      networkChainId: 84532,
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            chainId: 84532,
            mode: 'any',
          },
        },
      },
    };
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      sessionConfig,
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.resolveSbtGateLabel = jest.fn(() => 'Session SBT');

    const tree = subject.render();
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}.`)).toBe(true);
    expect(treeHasText(tree, `${t('sbt')} required: Session SBT. Connect an eligible ${t('walletLower')} to decrypt.`)).toBe(true);
    expect(treeHasText(tree, 'No questions available.')).toBe(false);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(false);
  });

  it('keeps a default-gated empty pile fail-closed after the cache reports ready', () => {
    const refreshQuestionMetadata = jest.fn(() => Promise.resolve());
    const sessionConfig = {
      slug: 'edge',
      networkChainId: 84532,
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            chainId: 84532,
            mode: 'any',
          },
        },
      },
    };
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0x2222222222222222222222222222222222222222',
      loginComplete: true,
      sessionSlug: 'edge',
      sessionConfig,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: null,
      refreshQuestionMetadata,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'granted',
    };

    expect(subject.maybeRecoverUnhydratedGatedPile()).toBe(true);
    expect(refreshQuestionMetadata).toHaveBeenCalledWith({ forceDiscoveryRescan: true });
    expect(subject.maybeRecoverUnhydratedGatedPile()).toBe(false);

    const tree = subject.render();
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}.`)).toBe(true);
    expect(treeHasText(tree, 'No questions available.')).toBe(false);
  });

  it('prefers gated empty state once masked questions are cached even if cache-ready stays false', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: '[encrypted]',
            type: 'freeform',
          },
        },
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.state.hasHiddenGatedQuestions).toBe(true);

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBe(true);
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}`)).toBe(true);
    expect(treeHasText(tree, `Connect an eligible ${t('walletLower')} and decrypt to view the questions.`)).toBe(true);
    expect(treeHasText(tree, `These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`)).toBe(false);
    expect(treeHasText(tree, 'Retry decrypt')).toBe(false);
    expect(treeHasText(tree, 'Decrypt')).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBe(false);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(false);
  });

  it('shows gate requirements in gated pile empty state when masked question gate details are available', async () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: '[encrypted]',
            type: 'freeform',
            encryption: {
              enabled: true,
              gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
            },
          },
        },
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.resolveSbtGateLabel = jest.fn(() => 'VIP SBT');
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    subject.state = {
      ...subject.state,
      questionPool: [{
        id: 'q1',
        prompt: '[encrypted]',
        type: 'freeform',
        encryption: {
          enabled: true,
          gates: [],
        },
      }],
      allQuestionsForFilter: [{
        id: 'q1',
        prompt: '[encrypted]',
        type: 'freeform',
        encryption: {
          enabled: true,
          gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
        },
      }],
      hasHiddenGatedQuestions: true,
    };

    const tree = subject.render();
    const expectedSbtHref = buildSbtDetailPath(gateSbt, 'edge');
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBe(true);
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}`)).toBe(true);
    expect(treeHasText(tree, t('sbt'))).toBe(true);
    expect(treeHasText(tree, 'required:')).toBe(true);
    expect(treeHasText(tree, `Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`)).toBe(true);
    expect(treeHasLinkHref(tree, expectedSbtHref)).toBe(true);
    expect(treeHasText(tree, 'VIP Gate')).toBe(false);
    expect(treeHasText(tree, 'VIP SBT')).toBe(true);
    expect(treeHasText(tree, 'Retry decrypt')).toBe(false);
    expect(treeHasText(tree, 'Decrypt')).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBe(true);

    subject.state = {
      ...subject.state,
      lockedGateDetailsExpanded: true,
    };

    const expandedTree = subject.render();
    expect(treeHasText(expandedTree, 'VIP Gate')).toBe(true);
    expect(treeHasText(expandedTree, 'VIP SBT')).toBe(true);
  });
});
