import SurveyTool from './SurveyTool';
import { PileViewMode } from './SurveyPileViewMode';
import SurveyQuestionsLockedQuestionsPanel from './SurveyQuestionsLockedQuestionsPanel';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

const SESSION_SBT = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';

const defaultQuestionScanProgress = {
  slug: 'edge',
  phase: 'hydrate',
  discoveredQuestions: 1,
  hydratedQuestions: 0,
  pendingMetadataCount: 0,
  remainingBlocks: 0,
};

const defaultNetworkCache = {
  questions: {},
  questionResponses: {},
  pendingQuestionMetadata: {},
};

const mockQuestionsCache = (networkCache = defaultNetworkCache) =>
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace) =>
      namespace === 'questionsCache' ? { 84532: { ...defaultNetworkCache, ...networkCache } } : {},
    );

const renderPile = (props = {}) =>
  renderSurveyPileViewMode({
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
    questionScanProgress: defaultQuestionScanProgress,
    onFilterChange: jest.fn(),
    runtimeStrategy: createPileViewRuntimeStrategy(),
    ...props,
  });

const createLegacyChainSessionConfig = () => ({
  slug: 'edge',
  networkChainId: 84532,
  __registry: {
    sessionIdHex: '0x00112233445566778899aabbccddeeff',
    registryChainId: 84532,
  },
});

const createDefaultGatedSessionConfig = () => ({
  ...createLegacyChainSessionConfig(),
  __registry: {
    ...createLegacyChainSessionConfig().__registry,
    gateAuthority: 'onchain',
    gatesByResource: {
      default: {
        lookupStatus: 'ok',
        sbtAddresses: [SESSION_SBT],
        chainId: 84532,
        mode: 'any',
      },
    },
  },
});

const mockSbtLabels = () =>
  jest
    .spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel')
    .mockImplementation(({ address }) =>
      String(address || '').toLowerCase() === SESSION_SBT.toLowerCase() ? 'Session SBT' : 'VIP SBT',
    );

describe('SurveyPileViewMode gated empty states', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps hydrate loading active when only gate hints are known and no hidden questions are cached', async () => {
    mockQuestionsCache();

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

    expect(await screen.findByText(/Loading Metadata/)).toBeInTheDocument();
    expect(screen.queryByText('No accessible questions. This session has gated content.')).toBeNull();
  });

  it('shows gated empty state for default-gated pile questions while metadata is still unresolved', async () => {
    mockQuestionsCache();
    mockSbtLabels();

    renderPile({
      sessionConfig: createDefaultGatedSessionConfig(),
    });

    expect(await screen.findByText(`This session's questions are ${t('gatedLower')}.`)).toBeInTheDocument();
    expect(
      screen.getByText(`${t('sbt')} required: Session SBT. Connect an eligible ${t('walletLower')} to decrypt.`),
    ).toBeInTheDocument();
    expect(screen.queryByText('No questions available.')).toBeNull();
    expect(screen.queryByText(/Loading Metadata/)).toBeNull();
  });

  it('keeps a default-gated empty pile fail-closed after the cache reports ready', async () => {
    mockQuestionsCache();
    mockSbtLabels();
    const refreshQuestionMetadata = jest.fn(() => Promise.resolve());
    const { rerenderSurveyQuestions } = renderPile({
      account: WALLET,
      loginComplete: true,
      sessionConfig: createDefaultGatedSessionConfig(),
      isQuestionCacheReady: true,
      questionScanProgress: null,
      refreshQuestionMetadata,
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    await waitFor(() => {
      expect(refreshQuestionMetadata).toHaveBeenCalledWith({ forceDiscoveryRescan: true });
    });
    expect(await screen.findByText(`This session's questions are ${t('gatedLower')}.`)).toBeInTheDocument();
    expect(screen.queryByText('No questions available.')).toBeNull();

    rerenderSurveyQuestions({});

    await waitFor(() => {
      expect(refreshQuestionMetadata).toHaveBeenCalledTimes(1);
    });
  });

  it('prefers gated empty state once masked questions are cached even if cache-ready stays false', async () => {
    const sessionConfig = createLegacyChainSessionConfig();
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => (slug === 'edge' ? sessionConfig : null));
    mockQuestionsCache({
      questions: {
        q1: {
          id: 'q1',
          prompt: '[encrypted]',
          type: 'freeform',
        },
      },
    });

    renderPile({
      sessionConfig,
    });

    const lockedBanner = await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER);
    expect(lockedBanner).toBeInTheDocument();
    expect(screen.getByText(`This session's questions are ${t('gatedLower')}`)).toBeInTheDocument();
    expect(
      screen.getByText(`Connect an eligible ${t('walletLower')} and decrypt to view the questions.`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        `These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`,
      ),
    ).toBeNull();
    expect(screen.queryByText('Retry decrypt')).toBeNull();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_DECRYPT)).toHaveTextContent('Decrypt');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBeNull();
    expect(screen.queryByText(/Loading Metadata/)).toBeNull();
  });

  it('shows gate requirements in gated pile empty state when masked question gate details are available', async () => {
    const sessionConfig = createLegacyChainSessionConfig();
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => (slug === 'edge' ? sessionConfig : null));
    const gateSbt = SESSION_SBT;
    mockQuestionsCache({
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
    });
    jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockReturnValue('VIP SBT');

    renderPile({
      sessionConfig,
    });

    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBeInTheDocument();
    expect(screen.getByText(`This session's questions are ${t('gatedLower')}`)).toBeInTheDocument();
    const expectedRequirementText = `${t('sbt')} required: VIP SBT. Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`;
    expect(
      screen.getByText(
        (_, element) =>
          typeof element?.className === 'string' &&
          element.className.includes('lockedQuestionsSubtext') &&
          element.textContent?.replace(/\s+/g, ' ').trim() === expectedRequirementText,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('VIP Gate')).toBeNull();
    expect(screen.getByText(/VIP SBT/)).toBeInTheDocument();
    expect(screen.queryByText('Retry decrypt')).toBeNull();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_DECRYPT)).toHaveTextContent('Decrypt');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET));

    expect(screen.getByText('VIP Gate')).toBeInTheDocument();
    expect(screen.getAllByText(/VIP SBT/).length).toBeGreaterThan(0);
    const expectedSbtHref = buildSbtDetailPath(gateSbt, 'edge');
    screen.getAllByRole('link', { name: /VIP SBT/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', expectedSbtHref);
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
