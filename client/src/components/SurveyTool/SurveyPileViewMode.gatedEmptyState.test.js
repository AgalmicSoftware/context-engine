import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
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

const mockQuestionsCache = (networkCache = defaultNetworkCache) => (
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
    namespace === 'questionsCache'
      ? { '84532': { ...defaultNetworkCache, ...networkCache } }
      : {}
  ))
);

const renderPile = (props = {}) => renderSurveyPileViewMode({
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

const createDefaultGatedSessionConfig = () => ({
  slug: 'edge',
  networkChainId: 84532,
  __registry: {
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

const mockSbtLabels = () => (
  jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockImplementation(({ address }) => (
    String(address || '').toLowerCase() === SESSION_SBT.toLowerCase()
      ? 'Session SBT'
      : 'VIP SBT'
  ))
);

describe('SurveyPileViewMode gated empty states', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps hydrate loading active when only gate hints are known and no hidden questions are cached', async () => {
    mockQuestionsCache();

    renderPile();

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
    expect(screen.getByText(
      `${t('sbt')} required: Session SBT. Connect an eligible ${t('walletLower')} to decrypt.`
    )).toBeInTheDocument();
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
    mockQuestionsCache({
      questions: {
        q1: {
          id: 'q1',
          prompt: '[encrypted]',
          type: 'freeform',
        },
      },
    });

    renderPile();

    const lockedBanner = await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER);
    expect(lockedBanner).toBeInTheDocument();
    expect(screen.getByText(`This session's questions are ${t('gatedLower')}`)).toBeInTheDocument();
    expect(screen.getByText(
      `Connect an eligible ${t('walletLower')} and decrypt to view the questions.`
    )).toBeInTheDocument();
    expect(screen.queryByText(
      `These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`
    )).toBeNull();
    expect(screen.queryByText('Retry decrypt')).toBeNull();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCKED_DECRYPT)).toHaveTextContent('Decrypt');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBeNull();
    expect(screen.queryByText(/Loading Metadata/)).toBeNull();
  });

  it('shows gate requirements in gated pile empty state when masked question gate details are available', async () => {
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

    renderPile();

    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBeInTheDocument();
    expect(screen.getByText(`This session's questions are ${t('gatedLower')}`)).toBeInTheDocument();
    const expectedRequirementText = `${t('sbt')} required: VIP SBT. Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`;
    expect(screen.getByText((_, element) => (
      typeof element?.className === 'string' &&
      element.className.includes('lockedQuestionsSubtext') &&
      element.textContent?.replace(/\s+/g, ' ').trim() === expectedRequirementText
    ))).toBeInTheDocument();
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
  });
});
