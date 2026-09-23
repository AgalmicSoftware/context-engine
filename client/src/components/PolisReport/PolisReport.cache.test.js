import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import PolisReport, {
  applyFilterStateToAggregator,
  buildClusterAnalysisDataKey,
  buildPolisReportPdfFilename,
  buildPolisParticipantProfileHref,
  buildPrecomputedDemoClusterState,
  buildRatingMatrixFromRealData,
  buildRatingMatrixFromDemo,
  formatBlockchainNetworkLabel,
  getRenderableParticipantList,
  getPolisHistoricalParticipantAvatar,
  getPolisDemoDatasetForSlug,
  normalizePolisBinaryVote,
  OPINION_GROUPS_TOOLTIP_TEXT,
  PARTICIPANTS_GRAPH_TOOLTIP_TEXT,
  POLIS_CLUSTER_COLORS,
  REPORT_DEFAULT_EMBEDDING_LABEL,
  REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT,
  resolveExploratoryClusterCount,
  resolveJsPdfConstructor,
  resolvePrecomputedClusterDifference,
  shouldAutoEnablePolisDemoData,
} from './PolisReport';
import { CHART_SERIES_COLORS } from '../../utilities/ui/chartColors';
import { computePolisCommentStats, computePolisConversationMath } from '../../utilities/survey/consensusReportMath.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => ({})),
}));

jest.mock('../../utilities/survey/consensusMath', () => ({
  clusterUMAPPointsKmeans: jest.fn((points = []) => new Array(points.length).fill(0)),
  doUMAP: jest.fn((data = []) => data.map((_, index) => [index, index])),
}));

jest.mock('../../utilities/survey/consensusReportMath.js', () => ({
  computePolisConversationMath: jest.fn(() => ({
    stats: {
      nParticipants: 0,
      nComments: 0,
      totalVotes: 0,
      votesPerVoterAvg: 0,
    },
    participantCoords: [],
    statementCoords: [],
    commentStats: [],
    clusterAssignments: [],
    clusterCount: 0,
    repQuestions: {},
  })),
  computePolisCommentStats: jest.fn((matrix = []) =>
    matrix.map((_, index) => ({
      commentIndex: index,
      extremity: index,
      agrees: 0,
      disagrees: 0,
      unsure: 0,
      total: 0,
    })),
  ),
  findRepresentativeQuestions: jest.fn(() => ({})),
}));

jest.mock('utilities/ui/displayHelpers.js', () => ({
  __esModule: true,
  getShortenedAddress: jest.fn((value) => String(value || '')),
}));

jest.mock('utilities/logging.js', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: jest.fn(() => 'data:image/png;base64,mock-blockie'),
}));

jest.mock('utilities/ui/historicalFigureAvatars.js', () => ({
  getHistoricalFigureAvatarOrBlockie: jest.fn(() => 'data:image/png;base64,mock-avatar'),
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {},
  getAllSessionSlugs: jest.fn(() => []),
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

const baseReportProps = {
  questionResponses: {},
  network: { id: 84532 },
  disclaimersActive: false,
  isQuestionCacheReady: true,
  isResponsesCacheReady: true,
};

const seededQuestionResponses = {
  seedQuestion: [
    {
      responder: '0xseed-user',
      questionId: 'seedQuestion',
      response: JSON.stringify({
        type: 'binary',
        prompt: 'Seed prompt',
        answer: { value: 'Agree', encrypted: false },
      }),
    },
  ],
};

const openSettingsRow = () => {
  const btn = screen.queryByLabelText('Show report settings');
  if (btn) fireEvent.click(btn);
};

describe('PolisReport report palette', () => {
  it('shares runtime categorical colors with other report charts', () => {
    expect(POLIS_CLUSTER_COLORS).toBe(CHART_SERIES_COLORS);
    expect(POLIS_CLUSTER_COLORS).toHaveLength(10);
  });
});

describe('PolisReport participant profile links', () => {
  it('keeps the report session attached to user and simulated-user profiles', () => {
    expect(
      buildPolisParticipantProfileHref({
        address: '0x1111111111111111111111111111111111111111',
        sessionSlug: 'demo interview',
      }),
    ).toBe('/u/0x1111111111111111111111111111111111111111?session=demo%20interview');
    expect(
      buildPolisParticipantProfileHref({
        displayName: 'Ada Lovelace',
        sessionSlug: 'demo-interview',
      }),
    ).toBe('/su/Ada%20Lovelace?session=demo-interview');
  });
});

describe('PolisReport cache read options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 0,
        nComments: 0,
        totalVotes: 0,
        votesPerVoterAvg: 0,
      },
      participantCoords: [],
      statementCoords: [],
      commentStats: [],
      clusterAssignments: [],
      clusterCount: 0,
      repQuestions: {},
    });
  });

  it('normalizes legacy binary vote encodings for real report data', async () => {
    expect(normalizePolisBinaryVote('yes')).toBe(1);
    expect(normalizePolisBinaryVote('no')).toBe(-1);
    expect(normalizePolisBinaryVote('unsure')).toBe(0);

    const legacyQuestionResponses = {
      qLegacy: [
        {
          responder: '0xaaa',
          questionId: 'qLegacy',
          response: JSON.stringify({
            type: 'binary',
            prompt: 'Legacy prompt',
            answer: { value: 'yes', encrypted: false },
          }),
        },
        {
          responder: '0xbbb',
          questionId: 'qLegacy',
          response: JSON.stringify({
            type: 'binary',
            prompt: 'Legacy prompt',
            answer: { value: 'no', encrypted: false },
          }),
        },
        {
          responder: '0xccc',
          questionId: 'qLegacy',
          response: JSON.stringify({
            type: 'binary',
            prompt: 'Legacy prompt',
            answer: { value: 'unsure', encrypted: false },
          }),
        },
      ],
    };

    render(
      <PolisReport
        {...baseReportProps}
        slug="legacy-live"
        questionResponses={legacyQuestionResponses}
        demoDataFirstLoad={false}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('No readable responses match the current filters.')).not.toBeInTheDocument();
      expect(computePolisConversationMath).toHaveBeenCalledWith(
        [[1, -1, 0]],
        expect.objectContaining({ qLegacy: 'Legacy prompt' }),
        ['qLegacy'],
        expect.objectContaining({ randomSeed: 42 }),
      );
    });
  });

  it('applies tag and type filters from an identity-matched Worker question cache', () => {
    const sessionConfig = {
      slug: 'worker-session',
      sessionId: `0x${'2'.repeat(32)}`,
      corsWorkerUrl: 'https://polis-worker.example.test',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      storageProfile: {
        backend: 'cloudflare',
        resources: { questions: 'active', surveys: 'active' },
        payloadAccessControl: {
          gate: 'role_gate',
          encryption: 'worker_envelope',
          mode: 'authorized_read',
        },
      },
    };
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: 'worker-session' });
    cacheScripts.peekCacheSync.mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache' || slug !== 'worker-session') return {};
      return {
        worker: withWorkerCanonicalCacheIdentity(
          {
            questions: {
              qKeep: { tags: ['included'], type: 'binary' },
              qDrop: { tags: ['excluded'], type: 'rating' },
            },
          },
          identity,
        ),
      };
    });

    const out = applyFilterStateToAggregator(
      {
        qKeep: [{ responder: '0xabc', questionId: 'qKeep', response: { answer: { value: 'yes' } } }],
        qDrop: [{ responder: '0xdef', questionId: 'qDrop', response: { answer: { value: 4 } } }],
      },
      { id: null },
      { selectedTags: ['included'], questionTypes: ['binary'] },
      'worker-session',
      sessionConfig,
    );

    expect(out).toEqual({
      qKeep: [{ responder: '0xabc', questionId: 'qKeep', response: { answer: { value: 'yes' } } }],
    });
  });

  it('keeps invalid precomputed cluster difference inputs unavailable', () => {
    expect(resolvePrecomputedClusterDifference(undefined, undefined, undefined)).toBeNull();
    expect(resolvePrecomputedClusterDifference(undefined, 70, 40)).toBe(30);
    expect(resolvePrecomputedClusterDifference(12, undefined, undefined)).toBe(12);
  });

  it('resolves exploratory cluster counts without allowing zero-cluster k-means', () => {
    expect(resolveExploratoryClusterCount({ activeClusterCount: 0, manualClusterCountValue: null })).toBe(0);
    expect(resolveExploratoryClusterCount({ activeClusterCount: 0, manualClusterCountValue: '2' })).toBe(2);
    expect(resolveExploratoryClusterCount({ activeClusterCount: 3, manualClusterCountValue: null })).toBe(3);
  });

  it('excludes seeded demo fixture rows from real report calculations', async () => {
    const mixedQuestionResponses = {
      qFixture: [
        {
          responder: 'demo-participant-1',
          questionId: 'qFixture',
          response: JSON.stringify({
            type: 'binary',
            prompt: 'Fixture prompt',
            source: 'demo-polis-data',
            answer: { value: 'Agree', encrypted: false },
          }),
        },
      ],
      qLive: [
        {
          responder: '0xlive',
          questionId: 'qLive',
          response: JSON.stringify({
            type: 'binary',
            prompt: 'Live prompt',
            answer: { value: 'Disagree', encrypted: false },
          }),
        },
      ],
    };

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge-live"
        questionResponses={mixedQuestionResponses}
        demoDataFirstLoad={false}
      />,
    );

    await waitFor(() => {
      expect(computePolisConversationMath).toHaveBeenCalledWith(
        [[-1]],
        expect.objectContaining({ qLive: 'Live prompt' }),
        ['qLive'],
        expect.objectContaining({ randomSeed: 42 }),
      );
    });
    expect(JSON.stringify(computePolisConversationMath.mock.calls)).not.toContain('qFixture');
  });

  it('excludes foreign-session real rows from built-in demo live report calculations', async () => {
    const mixedQuestionResponses = {
      qDemo: [
        {
          responder: '0xdemo',
          questionId: 'qDemo',
          response: JSON.stringify({
            type: 'binary',
            sessionSlug: 'demo',
            prompt: 'Shared demo prompt',
            responderName: 'Ada Example',
            answer: { value: 'Agree', encrypted: false },
          }),
        },
        {
          responder: '0xforeign',
          questionId: 'qDemo',
          response: JSON.stringify({
            type: 'binary',
            sessionSlug: 'test-2',
            prompt: 'Shared demo prompt',
            answer: { value: 'Disagree', encrypted: false },
          }),
        },
      ],
    };

    const result = buildRatingMatrixFromRealData(mixedQuestionResponses, { sessionSlug: 'demo' });

    expect(result.matrix).toEqual([[1]]);
    expect(result.promptsMap).toEqual({ qDemo: 'Shared demo prompt' });
    expect(result.questions).toEqual(['qDemo']);
    expect(result.responders).toEqual(['0xdemo']);
    expect(result.displayNamesMap).toEqual({ '0xdemo': 'Ada Example' });
    expect(JSON.stringify(result)).not.toContain('0xforeign');
    expect(JSON.stringify(result)).not.toContain('test-2');
  });

  it('reads question and sbt caches with clone disabled during filter application', () => {
    const out = applyFilterStateToAggregator({ q1: [] }, { id: 84532 }, {}, 'edge');

    expect(cacheScripts.peekCacheSync).toHaveBeenNthCalledWith(1, 'questionsCache', 'edge', { clone: false });
    expect(cacheScripts.peekCacheSync).toHaveBeenNthCalledWith(2, 'sbtCache', 'edge', { clone: false });
    expect(out).toEqual(expect.any(Object));
  });

  it('keeps participant graph tooltip copy aligned with the Polis graph modes', () => {
    expect(REPORT_DEFAULT_EMBEDDING_LABEL).toBe('Polis Auto');
    expect(PARTICIPANTS_GRAPH_TOOLTIP_TEXT).toBe(
      "This diagram opens in UMAP with 3 clusters. Switch to SVD/PCA for the PCA view, or Polis Auto for the report's Polis-inspired automatic clustering.",
    );
    expect(REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT).toBe(
      "Polis Auto uses Context Engine's Polis-inspired automatic clustering. It keeps the report's PCA-based participant layout and auto-selects opinion clusters from that layout. UMAP and SVD/PCA are exploratory views where you can override K manually. This is Polis-inspired analysis inside Context Engine, not an official Polis/Pol.is integration or endorsement.",
    );
    expect(OPINION_GROUPS_TOOLTIP_TEXT).toBe(
      "Leave K on auto to use Polis Auto's automatic clustering, or set K manually when exploring UMAP or SVD/PCA layouts.",
    );
  });

  it('sanitizes session-derived PDF export filenames', () => {
    const timestamp = new Date('2026-01-02T03:04:05.006Z');

    expect(buildPolisReportPdfFilename('../Demo <script>alert(1)</script>', timestamp)).toBe(
      'contextEngine_report_Demo_script_alert_1_script_2026_01_02T03_04_05_006Z.pdf',
    );
    expect(buildPolisReportPdfFilename('', timestamp)).toBe('contextEngine_report_2026_01_02T03_04_05_006Z.pdf');
  });

  it('resolves jsPDF constructors across dynamic import module shapes', () => {
    function LegacyJsPdf() {}
    function NamedJsPdf() {}
    function NamespacedJsPdf() {}

    expect(resolveJsPdfConstructor({ default: LegacyJsPdf })).toBe(LegacyJsPdf);
    expect(resolveJsPdfConstructor({ jsPDF: NamedJsPdf })).toBe(NamedJsPdf);
    expect(resolveJsPdfConstructor({ default: { jsPDF: NamespacedJsPdf } })).toBe(NamespacedJsPdf);
    expect(() => resolveJsPdfConstructor({ default: {} })).toThrow('jsPDF constructor is unavailable');
  });

  it('formats the live network label with chain id instead of hardcoding a chain name', () => {
    expect(formatBlockchainNetworkLabel({ id: 11155420, name: 'OP Sepolia' })).toBe('OP Sepolia (11155420)');
    expect(formatBlockchainNetworkLabel({ id: 84532, name: 'Base Sepolia' })).toBe('Base Sepolia (84532)');
    expect(formatBlockchainNetworkLabel({ id: 84532, name: 'Base Sepolia' }, 11155420)).toBe('OP Sepolia (11155420)');
    expect(formatBlockchainNetworkLabel(null, 11155420)).toBe('OP Sepolia (11155420)');
    expect(formatBlockchainNetworkLabel({ id: 31337 })).toBe('Anvil (31337)');
    expect(formatBlockchainNetworkLabel(null)).toBe('Unknown');
  });

  it('renders the report blockchain row from session chain context when no wallet network is present', async () => {
    render(
      <PolisReport
        {...baseReportProps}
        questionResponses={seededQuestionResponses}
        network={null}
        networkChainId={11155420}
        slug="edge"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
      expect(screen.getByText('Summary and Statistics')).toHaveClass('sectionHeader', 'sectionTitle');
      expect(screen.getByText('OP Sepolia (11155420)')).toBeInTheDocument();
    });
  });

  it('prefers the session chain over a mismatched connected-wallet network in the blockchain row', async () => {
    render(
      <PolisReport
        {...baseReportProps}
        questionResponses={seededQuestionResponses}
        network={{ id: 84532, name: 'Base Sepolia' }}
        networkChainId={11155420}
        slug="edge"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('OP Sepolia (11155420)')).toBeInTheDocument();
    });
    expect(screen.queryByText('Base Sepolia (84532)')).not.toBeInTheDocument();
  });

  it('omits the blockchain row when the validated session route supplies no chain context', async () => {
    render(
      <PolisReport
        {...baseReportProps}
        questionResponses={seededQuestionResponses}
        network={{ id: null, chainId: null }}
        networkChainId={null}
        slug="demo-sh"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
    });
    expect(screen.queryByText('Blockchain:')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('keeps the participants graph guidance hidden until the tooltip is hovered', () => {
    render(<PolisReport {...baseReportProps} slug="demo" />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByLabelText('Participants graph view details'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(PARTICIPANTS_GRAPH_TOOLTIP_TEXT);
  });

  it('keeps cached report content visible while question and response caches refresh', async () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        questionResponses={seededQuestionResponses}
        isQuestionCacheReady={false}
        isResponsesCacheReady={false}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByLabelText('Loading report')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText('Refreshing report')).toBeInTheDocument();
    expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
  });

  it('shows block-count loading progress under the Polis spinner when scoped question scan progress is available', () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        isQuestionCacheReady={false}
        isResponsesCacheReady={false}
        questionScanProgress={{
          slug: 'edge',
          phase: 'scan',
          totalBlocks: 120,
          requestedTotalBlocks: 120,
          scannedBlocks: 30,
          remainingBlocks: 90,
        }}
      />,
    );

    expect(screen.getByLabelText('Loading report')).toBeInTheDocument();
    expect(screen.getByText('Scanning session blocks')).toBeInTheDocument();
    expect(screen.getByText('90 blocks left')).toBeInTheDocument();
    expect(screen.getByText('30 / 120')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Polis report loading progress' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(screen.getByTestId(E2E_TESTIDS.POLIS_REPORT_LOADING_PROGRESS)).toBeInTheDocument();
  });

  it('settles the report body instead of showing a finished block-scan spinner', () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        isQuestionCacheReady={false}
        isResponsesCacheReady={false}
        questionScanProgress={{
          slug: 'edge',
          phase: 'scan',
          totalBlocks: 3182031,
          requestedTotalBlocks: 3182031,
          scannedBlocks: 3182031,
          remainingBlocks: 0,
        }}
      />,
    );

    expect(screen.queryByLabelText('Loading report')).not.toBeInTheDocument();
    expect(screen.queryByText('Scanning session blocks')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.POLIS_REPORT_LOADING_PROGRESS)).not.toBeInTheDocument();
    expect(screen.getByText('No readable responses match the current filters.')).toBeInTheDocument();
  });

  it('shows neutral hydrate loading copy while keeping hydrate progress details when counts exist', () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        isQuestionCacheReady={false}
        isResponsesCacheReady={false}
        questionScanProgress={{
          slug: 'edge',
          phase: 'hydrate',
          discoveredQuestions: 5,
          hydratedQuestions: 2,
        }}
      />,
    );

    expect(screen.getByLabelText('Loading report')).toBeInTheDocument();
    expect(screen.getByText('Loading report data')).toBeInTheDocument();
    expect(screen.queryByText('Hydrating question metadata')).not.toBeInTheDocument();
    expect(screen.getByText('3 items left')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Polis report loading progress' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('keeps the hydrate loading label but hides empty zero-count progress details', () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        isQuestionCacheReady={false}
        isResponsesCacheReady={false}
        questionScanProgress={{
          slug: 'edge',
          phase: 'hydrate',
          discoveredQuestions: 0,
          hydratedQuestions: 0,
        }}
      />,
    );

    expect(screen.getByLabelText('Loading report')).toBeInTheDocument();
    expect(screen.getByText('Loading report data')).toBeInTheDocument();
    expect(screen.queryByText('0 items left')).not.toBeInTheDocument();
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Polis report loading progress' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.POLIS_REPORT_LOADING_PROGRESS)).not.toBeInTheDocument();
  });

  it('keeps question and SBT cache reads scoped to the session route when applying filters', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);
      cacheScripts.peekCacheSync.mockImplementation((namespace, slug) => {
        if (namespace === 'questionsCache') {
          return { 84532: { questions: {} } };
        }
        if (namespace === 'sbtCache' && slug === 'alpha') {
          return {
            84532: {
              sbtList: {
                '0x1111111111111111111111111111111111111111': {
                  mintedAddresses: ['0xabc'],
                  burnedAddresses: [],
                },
              },
            },
          };
        }
        return {};
      });

      const out = applyFilterStateToAggregator(
        {
          q2: [{ responder: '0xAbC', questionId: 'q2', response: { answer: { value: 'yes' } } }],
        },
        { id: 84532 },
        {
          sbtFilter: {
            selectedSBTGroupsResponder: [{ address: '0x1111111111111111111111111111111111111111' }],
          },
        },
        'edge',
      );

      expect(out).toEqual({});
      expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('sbtCache', 'edge', { clone: false });
      expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('sbtCache', 'alpha', { clone: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('uses count maps for SBT responder filters so reminted holders remain included', () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace, slug) => {
      if (namespace === 'questionsCache') {
        return { 84532: { questions: {} } };
      }
      if (namespace === 'sbtCache' && slug === 'alpha') {
        return {
          84532: {
            sbtList: {
              '0x1111111111111111111111111111111111111111': {
                mintedAddresses: ['0xabc'],
                burnedAddresses: ['0xabc'],
                mintedCountByAddress: { '0xabc': 2 },
                burnedCountByAddress: { '0xabc': 1 },
                countsLoaded: true,
              },
            },
          },
        };
      }
      return {};
    });

    const out = applyFilterStateToAggregator(
      {
        q2: [{ responder: '0xAbC', questionId: 'q2', response: { answer: { value: 'yes' } } }],
      },
      { id: 84532 },
      {
        sbtFilter: {
          selectedSBTGroupsResponder: [{ address: '0x1111111111111111111111111111111111111111' }],
        },
      },
      'alpha',
    );

    expect(out).toEqual({
      q2: [{ responder: '0xAbC', questionId: 'q2', response: { answer: { value: 'yes' } } }],
    });
  });

  it('ignores checkpoint-backed partial count maps for SBT responder filters', () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace, slug) => {
      if (namespace === 'questionsCache') {
        return { 84532: { questions: {} } };
      }
      if (namespace === 'sbtCache' && slug === 'alpha') {
        return {
          84532: {
            sbtList: {
              '0x1111111111111111111111111111111111111111': {
                mintedAddresses: ['0xabc'],
                burnedAddresses: [],
                mintedCountByAddress: { '0xabc': 1 },
                burnedCountByAddress: {},
                countsLoaded: false,
                countsScanCheckpoint: {
                  phase: 'activity',
                  blockNumber: 15,
                  mintedCountByAddress: { '0xabc': 1 },
                  burnedCountByAddress: {},
                },
              },
            },
          },
        };
      }
      return {};
    });

    const out = applyFilterStateToAggregator(
      {
        q2: [{ responder: '0xAbC', questionId: 'q2', response: { answer: { value: 'yes' } } }],
      },
      { id: 84532 },
      {
        sbtFilter: {
          selectedSBTGroupsResponder: [{ address: '0x1111111111111111111111111111111111111111' }],
        },
      },
      'alpha',
    );

    expect(out).toEqual({});
  });
});

describe('PolisReport demo data defaults', () => {
  it('auto-enables demo data for configured demo slugs', () => {
    expect(shouldAutoEnablePolisDemoData({ slug: 'demo' })).toBe(true);
    expect(shouldAutoEnablePolisDemoData({ slug: 'demo-1' })).toBe(true);
    expect(shouldAutoEnablePolisDemoData({ slug: 'demo-3' })).toBe(true);
    expect(shouldAutoEnablePolisDemoData({ slug: 'demo-2' })).toBe(true);
    expect(shouldAutoEnablePolisDemoData({ slug: 'edge' })).toBe(false);
    expect(shouldAutoEnablePolisDemoData({ slug: 'edge', demoDataFirstLoad: true })).toBe(false);
    expect(
      shouldAutoEnablePolisDemoData({
        slug: 'edge',
        demoDataFirstLoad: true,
        demoDataBySlug: {
          edge: {
            comments: [],
            participantsVotes: [],
          },
        },
      }),
    ).toBe(true);
  });

  it('keeps legacy demo datasets shared while demo-2 uses its typed fixture', () => {
    expect(getPolisDemoDatasetForSlug('demo-1', { allowFallback: false })).toBe(
      getPolisDemoDatasetForSlug('demo', { allowFallback: false }),
    );
    expect(getPolisDemoDatasetForSlug('demo-3', { allowFallback: false })).toBe(
      getPolisDemoDatasetForSlug('demo', { allowFallback: false }),
    );
    expect(getPolisDemoDatasetForSlug('demo-sh', { allowFallback: false })).toBe(
      getPolisDemoDatasetForSlug('demo', { allowFallback: false }),
    );
    const demo2Dataset = getPolisDemoDatasetForSlug('demo-2', { allowFallback: false });
    expect(demo2Dataset).not.toBe(getPolisDemoDatasetForSlug('demo', { allowFallback: false }));
    expect(demo2Dataset?.comments).toHaveLength(49);
    expect(demo2Dataset?.clusterAnalysis).toHaveLength(3);
  });

  it('shows the demo data toggle as enabled by default for the demo slug', () => {
    const { container } = render(<PolisReport {...baseReportProps} slug="demo" />);

    openSettingsRow();

    expect(container.querySelector('.settingsRow')).toHaveClass('pdfIgnore');
    expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).toBeChecked();
  });

  it.each(['demo', 'demo-2'])('renders all answer sections from the built-in %s data', (slug) => {
    const { rerender } = render(<PolisReport {...baseReportProps} slug={slug} />);
    ['binary', 'freeform', 'rating', 'multichoice', 'quadratic'].forEach((type) => {
      expect(screen.getByTestId(`ce-polis-answers-${type}`)).toBeInTheDocument();
    });
    const sections = screen.getByTestId('ce-polis-answer-sections');
    expect(
      screen.getByText('Participants Graph').compareDocumentPosition(sections) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'All Questions' })).toContainElement(sections);
    ['Binary', 'Freeform', 'Ratings', 'Multiple choice', 'Quadratic allocation'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true');
    });
    expect(screen.getByText('Which AI governance measures would you support or oppose?')).toBeInTheDocument();
    rerender(<PolisReport {...baseReportProps} slug={slug} filterState={{ selectedTags: ['education'] }} />);
    expect(screen.queryByText('Which AI governance measures would you support or oppose?')).not.toBeInTheDocument();
    expect(screen.getByText('Which uses of AI in education would you support or oppose?')).toBeInTheDocument();
    rerender(<PolisReport {...baseReportProps} slug={slug} filterState={{ selectedTags: ['no-demo-matches'] }} />);
    expect(screen.queryByTestId('ce-polis-answers-quadratic')).not.toBeInTheDocument();
  });

  it('opens every type when All Questions reopens and preserves View more state', () => {
    render(<PolisReport {...baseReportProps} slug="demo" />);
    const parent = screen.getByRole('button', { name: 'All Questions' });
    const binary = screen.getByTestId('ce-polis-answers-binary');
    const ratings = screen.getByTestId('ce-polis-answers-rating');
    expect(binary.querySelector('svg[aria-label^="Agree"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
    fireEvent.click(within(ratings).getByRole('button', { name: 'View more (2)' }));
    expect(ratings.querySelectorAll('article')).toHaveLength(3);
    fireEvent.click(parent);
    expect(binary).not.toBeVisible();
    expect(ratings).not.toBeVisible();
    fireEvent.click(parent);
    expect(binary).toBeVisible();
    expect(ratings).toBeVisible();
    expect(ratings.querySelectorAll('article')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
    expect(binary.querySelector('svg[aria-label^="Agree"]')).toBeNull();
    expect(ratings.querySelectorAll('article')).toHaveLength(3);
  });

  it('previews the five most divisive binary questions and expands the remaining questions in score order', () => {
    const scores = [0.1, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3];
    computePolisConversationMath.mockReturnValue({
      stats: { nParticipants: 1, nComments: 7, totalVotes: 7, votesPerVoterAvg: 7 },
      participantCoords: [],
      statementCoords: [],
      clusterAssignments: [],
      clusterCount: 0,
      repQuestions: {},
      commentStats: scores.map((extremity, commentIndex) => ({ extremity, commentIndex })),
    });
    const rows = Object.fromEntries(
      scores.map((_, index) => [
        `q${index}`,
        [
          {
            responder: 'person-a',
            response: {
              type: 'binary',
              prompt: `Binary example ${index}`,
              answer: { value: 'Agree' },
            },
          },
        ],
      ]),
    );
    render(<PolisReport {...baseReportProps} questionResponses={rows} />);
    const section = screen.getByTestId('ce-polis-answers-binary');
    const prompts = () =>
      [...section.querySelectorAll('[data-pdf-keep-together]')].map(
        (el) => el.textContent.match(/Binary example (\d)/)?.[1],
      );
    expect(prompts()).toEqual(['1', '3', '5', '2', '4']);
    fireEvent.click(within(section).getByRole('button', { name: 'View more (2)' }));
    expect(prompts()).toEqual(['1', '3', '5', '2', '4', '6', '0']);
    fireEvent.click(within(section).getByRole('button', { name: 'View less' }));
    expect(prompts()).toEqual(['1', '3', '5', '2', '4']);
  });

  it('shows the demo data toggle as enabled by default for demo-1', () => {
    const { container } = render(<PolisReport {...baseReportProps} slug="demo-1" />);

    expect(container.querySelector('.settingsRow')).toHaveClass('pdfIgnore');
    expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).toBeChecked();
  });

  it('lets the built-in demo session toggle from fixture data to live responses', async () => {
    render(
      <PolisReport
        {...baseReportProps}
        slug="demo"
        questionResponses={seededQuestionResponses}
        demoDataFirstLoad={true}
        isQuestionCacheReady={true}
        isResponsesCacheReady={true}
      />,
    );

    openSettingsRow();

    const demoToggle = screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE);
    expect(demoToggle).toBeChecked();
    expect(demoToggle).not.toBeDisabled();
    expect(screen.getByTestId('ce-polis-answers-quadratic')).toBeInTheDocument();

    fireEvent.click(demoToggle);

    expect(demoToggle).not.toBeChecked();
    await waitFor(() => {
      expect(screen.queryByTestId('ce-polis-answers-quadratic')).not.toBeInTheDocument();
      expect(screen.queryByText('None (Demo Data Active)')).not.toBeInTheDocument();
      expect(screen.queryByText('No readable responses match the current filters.')).not.toBeInTheDocument();
      expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
    });
  });

  it('includes the participants list and answer sections in the global collapse and expand controls', async () => {
    const demoDataset = getPolisDemoDatasetForSlug('demo');
    const participant = Array.isArray(demoDataset?.participantsVotes)
      ? demoDataset.participantsVotes.find((entry) => entry?.xid || entry?.participant)
      : null;
    const participantLabel = participant?.xid || participant?.participant;

    expect(participantLabel).toBeTruthy();

    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 4,
        nComments: 3,
        totalVotes: 12,
        votesPerVoterAvg: 3,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0, y: 1, index: 2 },
        { x: 1, y: 1, index: 3 },
      ],
      statementCoords: [{ x: 0, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0, 0, 1, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    render(<PolisReport {...baseReportProps} slug="demo" questionResponses={seededQuestionResponses} />);

    await waitFor(() => {
      expect(screen.getByText('List of Participants')).toBeInTheDocument();
      expect(screen.getByTitle(participantLabel)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));
    expect(screen.getByRole('button', { name: 'All Questions' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Ratings', hidden: true })).toHaveAttribute('aria-expanded', 'false');

    expect(screen.getByText('List of Participants')).toBeInTheDocument();
    expect(screen.queryByTitle(participantLabel)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand All' }));

    expect(screen.getByTitle(participantLabel)).toBeInTheDocument();
    ['Binary', 'Freeform', 'Ratings', 'Multiple choice', 'Quadratic allocation'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('defaults built-in /session/demo to UMAP with 3 groups and still exposes precomputed Polis analysis after switching modes', async () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 4,
        nComments: 3,
        totalVotes: 12,
        votesPerVoterAvg: 3,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0, y: 1, index: 2 },
        { x: 1, y: 1, index: 3 },
      ],
      statementCoords: [{ x: 0, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0, 0, 1, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    render(<PolisReport {...baseReportProps} slug="demo" questionResponses={seededQuestionResponses} />);

    const embeddingSelect = screen.getByDisplayValue('UMAP');
    const clusterInput = screen.getByRole('spinbutton');

    expect(screen.getByDisplayValue('UMAP')).toBeInTheDocument();
    expect(clusterInput).toHaveValue(3);

    fireEvent.change(embeddingSelect, { target: { value: 'POLIS' } });

    expect(screen.getByDisplayValue(REPORT_DEFAULT_EMBEDDING_LABEL)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId(E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS)).toHaveLength(3);
    });
  });

  it('hydrates demo-2 authored cluster labels after switching to Polis Auto', async () => {
    render(<PolisReport {...baseReportProps} slug="demo-2" />);

    fireEvent.change(screen.getByDisplayValue('UMAP'), { target: { value: 'POLIS' } });

    await waitFor(() => {
      expect(screen.getByText('Cluster 0: Builders & Engineers')).toBeInTheDocument();
      expect(screen.getByText('Cluster 1: Precautionary Stewards')).toBeInTheDocument();
      expect(screen.getByText('Cluster 2: Democratic Humanists')).toBeInTheDocument();
      expect(screen.getAllByTestId(E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS)).toHaveLength(3);
    });
  });

  it('separates summaries for different filtered participants with identical cluster assignments', () => {
    const common = { activeClusterAssignments: [0, 1], allQuestions: ['q1'] };
    const first = buildClusterAnalysisDataKey({ ...common, allResponders: ['0x111', '0x222'] });
    expect(first).not.toBe(buildClusterAnalysisDataKey({ ...common, allResponders: ['0x333', '0x444'] }));
    expect(first).not.toBe(buildClusterAnalysisDataKey({ ...common, allResponders: ['0x222', '0x111'] }));
    expect(first).toBe(buildClusterAnalysisDataKey({ ...common, allResponders: ['0x111', '0x222'] }));
  });

  it('ignores questionResponsesNonce churn in the demo-mode cluster-analysis cache key', () => {
    const sharedArgs = {
      activeClusterAssignments: [0, 1, 1, 0],
      activeClusterCount: 2,
      activeRepQuestions: { 0: [{ questionIndex: 0 }], 1: [{ questionIndex: 1 }] },
      embeddingChoice: 'UMAP',
      questionPrompts: { 0: 'Prompt A', 1: 'Prompt B' },
      allQuestions: [{}, {}],
    };

    const demoKeyA = buildClusterAnalysisDataKey({
      ...sharedArgs,
      useDemoData: true,
      questionResponsesNonce: 0,
    });
    const demoKeyB = buildClusterAnalysisDataKey({
      ...sharedArgs,
      useDemoData: true,
      questionResponsesNonce: 7,
    });
    const liveKeyA = buildClusterAnalysisDataKey({
      ...sharedArgs,
      useDemoData: false,
      questionResponsesNonce: 0,
    });
    const liveKeyB = buildClusterAnalysisDataKey({
      ...sharedArgs,
      useDemoData: false,
      questionResponsesNonce: 7,
    });

    expect(demoKeyA).toBe(demoKeyB);
    expect(liveKeyA).not.toBe(liveKeyB);
  });

  it('defaults custom demo datasets to UMAP with 3 groups and clears manual K in Polis Auto mode', () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 4,
        nComments: 3,
        totalVotes: 12,
        votesPerVoterAvg: 3,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0, y: 1, index: 2 },
        { x: 1, y: 1, index: 3 },
      ],
      statementCoords: [{ x: 0, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0, 0, 1, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        questionResponses={seededQuestionResponses}
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: { ...getPolisDemoDatasetForSlug('demo') } }}
      />,
    );

    const embeddingSelect = screen.getByDisplayValue('UMAP');
    const clusterInput = screen.getByRole('spinbutton');
    const statementsToggle = screen.getByLabelText('Statements');
    const options = screen.getAllByRole('option');

    expect(screen.getByDisplayValue('UMAP')).toBeInTheDocument();
    expect(options[0]).toHaveTextContent('UMAP');
    expect(clusterInput).toHaveValue(3);
    expect(statementsToggle).not.toBeChecked();

    fireEvent.click(statementsToggle);
    expect(screen.getByDisplayValue('SVD/PCA')).toBeInTheDocument();
    expect(statementsToggle).toBeChecked();

    fireEvent.change(clusterInput, { target: { value: '4' } });
    expect(clusterInput).toHaveValue(4);

    fireEvent.change(embeddingSelect, { target: { value: 'POLIS' } });
    expect(screen.getByDisplayValue(REPORT_DEFAULT_EMBEDDING_LABEL)).toBeInTheDocument();
    expect(clusterInput).toHaveValue(2);
    expect(statementsToggle).not.toBeChecked();
  });

  it('hides statement dots when switching from SVD/PCA back to Polis Auto', () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 3,
        nComments: 1,
        totalVotes: 3,
        votesPerVoterAvg: 1,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0.5, y: 1, index: 2 },
      ],
      statementCoords: [{ x: 10, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0, 0, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    const { container } = render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        questionResponses={seededQuestionResponses}
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: { ...getPolisDemoDatasetForSlug('demo') } }}
      />,
    );
    const statementsToggle = screen.getByLabelText('Statements');
    const embeddingSelect = screen.getByDisplayValue('UMAP');

    fireEvent.click(statementsToggle);
    expect(screen.getByDisplayValue('SVD/PCA')).toBeInTheDocument();
    expect(container.querySelector('circle[r="3"]')).not.toBeNull();

    fireEvent.change(embeddingSelect, { target: { value: 'POLIS' } });

    expect(screen.getByDisplayValue(REPORT_DEFAULT_EMBEDDING_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText('Statements')).not.toBeChecked();
    expect(container.querySelector('circle[r="3"]')).toBeNull();
  });

  it('includes statement coordinates when scaling the comment overlay', () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 3,
        nComments: 1,
        totalVotes: 3,
        votesPerVoterAvg: 1,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0.5, y: 1, index: 2 },
      ],
      statementCoords: [{ x: 10, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0, 0, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    const { container } = render(
      <PolisReport {...baseReportProps} slug="demo" questionResponses={seededQuestionResponses} />,
    );
    fireEvent.click(screen.getByLabelText('Statements'));

    const statementCircle = container.querySelector('circle[r="3"]');
    expect(statementCircle).not.toBeNull();
    expect(Math.abs(Number(statementCircle.getAttribute('cx') || 0))).toBeLessThanOrEqual(210);
  });

  it('does not show the empty-state fallback when built-in demo data is available', () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 69,
        nComments: 100,
        totalVotes: 3200,
        votesPerVoterAvg: 46.38,
      },
      participantCoords: [{ x: 0, y: 0, index: 0 }],
      statementCoords: [{ x: 0, y: 0, index: 0 }],
      commentStats: [],
      clusterAssignments: [0],
      clusterCount: 1,
      repQuestions: { 0: [] },
    });

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        questionResponses={seededQuestionResponses}
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: { ...getPolisDemoDatasetForSlug('demo') } }}
      />,
    );

    expect(screen.queryByText('No readable responses match the current filters.')).not.toBeInTheDocument();
    expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
  });

  it('memoizes beeswarm comment stats across rerenders with unchanged data', () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 4,
        nComments: 2,
        totalVotes: 8,
        votesPerVoterAvg: 2,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0, y: 1, index: 2 },
        { x: 1, y: 1, index: 3 },
      ],
      statementCoords: [],
      commentStats: [
        { commentIndex: 0, extremity: 0, total: 4 },
        { commentIndex: 1, extremity: 1, total: 4 },
      ],
      clusterAssignments: [0, 0, 1, 1],
      clusterCount: 2,
      repQuestions: {},
    });

    const { rerender } = render(<PolisReport {...baseReportProps} slug="demo" />);

    expect(computePolisCommentStats).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-polis-beeswarm-plot')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^ce-polis-beeswarm-point-/)).toHaveLength(2);

    rerender(<PolisReport {...baseReportProps} slug="demo" />);

    expect(computePolisCommentStats).not.toHaveBeenCalled();
  });

  it('recomputes fallback comment stats when Polis math fails after the initial render', async () => {
    computePolisConversationMath.mockImplementation(() => {
      throw new Error('math exploded');
    });

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        demoDataFirstLoad={true}
        demoDataBySlug={{
          edge: {
            comments: [{ commentId: 'edge-c1', commentBody: 'Edge prompt', type: 'binary' }],
            participantsVotes: [
              { participant: 'edge-user-1', votes: { 0: 1 } },
              { participant: 'edge-user-2', votes: { 0: -1 } },
            ],
          },
        }}
      />,
    );

    await waitFor(() => {
      expect(computePolisCommentStats).toHaveBeenCalled();
    });
  });

  it('keeps a single auto cluster in exploratory mode when Polis math finds one group', async () => {
    computePolisConversationMath.mockReturnValue({
      stats: {
        nParticipants: 3,
        nComments: 2,
        totalVotes: 6,
        votesPerVoterAvg: 2,
      },
      participantCoords: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 0, y: 1, index: 2 },
      ],
      statementCoords: [],
      commentStats: [
        { commentIndex: 0, extremity: 0, total: 3 },
        { commentIndex: 1, extremity: 1, total: 3 },
      ],
      clusterAssignments: [0, 0, 0],
      clusterCount: 1,
      repQuestions: {},
    });

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        questionResponses={seededQuestionResponses}
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: { ...getPolisDemoDatasetForSlug('demo') } }}
      />,
    );

    const clusterInput = screen.getByRole('spinbutton');

    fireEvent.change(clusterInput, { target: { value: '' } });

    await waitFor(
      () => {
        expect(clusterInput).toHaveValue(1);
      },
      { timeout: 5000 },
    );
  });

  it('hydrates precomputed cluster analysis when demo data includes a matching versioned fixture', () => {
    const demoDataset = getPolisDemoDatasetForSlug('demo');
    const demoMatrix = buildRatingMatrixFromDemo(demoDataset);
    const precomputedState = buildPrecomputedDemoClusterState(demoDataset);

    expect(demoDataset?.clusterAnalysisVersion).toBe(2);
    expect(demoDataset?.clusterAnalysis?.length || 0).toBeGreaterThan(0);
    expect(demoMatrix.matrix?.length).toBeGreaterThan(0);
    expect(demoMatrix.responders?.length).toBeGreaterThan(0);
    expect(precomputedState).toEqual(
      expect.objectContaining({
        clusterCount: demoDataset.clusterAnalysis.length,
      }),
    );
  });

  it('hydrates built-in /session/demo with ready precomputed analysis cache entries', () => {
    const demoDataset = getPolisDemoDatasetForSlug('demo');
    const precomputedState = buildPrecomputedDemoClusterState(demoDataset);

    expect(precomputedState).not.toBeNull();
    expect(Object.keys(precomputedState.analysisCacheByClusterIndex || {})).toEqual(['0', '1', '2']);
    expect(precomputedState.analysisCacheByClusterIndex[0]).toEqual(
      expect.objectContaining({
        name: 'Technocratic Innovators',
        short: expect.stringMatching(/Inventors and technical optimists/i),
      }),
    );
    expect(precomputedState.analysisCacheByClusterIndex[2]).toEqual(
      expect.objectContaining({
        name: 'Governance & Guardrails',
        short: expect.stringMatching(/Safety-minded institutionalists/i),
      }),
    );
    expect(
      Object.values(precomputedState.repQuestions)
        .flat()
        .every((question) => question.difference === null),
    ).toBe(true);
  });

  it('shows actual response percentages even when demo representative differences are missing', async () => {
    render(<PolisReport {...baseReportProps} slug="demo" questionResponses={seededQuestionResponses} />);

    fireEvent.change(screen.getByDisplayValue('UMAP'), { target: { value: 'POLIS' } });

    expect(await screen.findAllByText(/% (agree|disagree) in this cluster · \d+% overall/)).not.toHaveLength(0);
    expect(screen.queryByText(/by 0\.0 percentage points/i)).not.toBeInTheDocument();
  });

  it.each([
    ['agree', '50% agree in this cluster · 33% overall'],
    ['disagree', '0% disagree in this cluster · 33% overall'],
  ])('compares %s percentages using respondents, including unsure votes', (stance, expected) => {
    computePolisConversationMath.mockReturnValue({
      stats: { nParticipants: 4, nComments: 2, totalVotes: 4, votesPerVoterAvg: 1 },
      participantCoords: [],
      statementCoords: [],
      commentStats: [],
      clusterAssignments: [0, 0, 1, 0],
      clusterCount: 2,
      repQuestions: {
        0: [{ questionIndex: 0, label: '#1', prompt: 'A test statement', repfulFor: stance, difference: null }],
      },
    });
    const responses = {
      q1: ['Agree', 'Unsure', 'Disagree'].map((value, index) => ({
        responder: `person-${index}`,
        response: { type: 'binary', prompt: 'A test statement', answer: { value } },
      })),
      q2: [
        {
          responder: 'person-3',
          response: { type: 'binary', prompt: 'Another statement', answer: { value: 'Agree' } },
        },
      ],
    };
    render(<PolisReport {...baseReportProps} questionResponses={responses} />);
    fireEvent.change(screen.getByDisplayValue('UMAP'), { target: { value: 'POLIS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Expand Clusters' }));
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/percentage points/)).not.toBeInTheDocument();
  });

  it('skips precomputed cluster analysis when the fixture version does not match', () => {
    const demoDataset = getPolisDemoDatasetForSlug('demo');
    const staleVersionDataset = {
      ...demoDataset,
      clusterAnalysisVersion: 1,
    };

    expect(buildPrecomputedDemoClusterState(staleVersionDataset)).toBeNull();
  });

  it('does not auto-apply precomputed cluster analysis for a caller-provided demo dataset on /session/demo', () => {
    const customDemoDataset = {
      ...getPolisDemoDatasetForSlug('demo'),
    };

    expect(buildPrecomputedDemoClusterState(customDemoDataset)).not.toBeNull();

    render(<PolisReport {...baseReportProps} slug="demo" demoDataBySlug={{ demo: customDemoDataset }} />);

    expect(screen.queryByTestId(E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS)).not.toBeInTheDocument();
  });

  it('does not auto-apply precomputed cluster analysis for a non-demo slug with custom demo data', () => {
    const customEdgeDataset = {
      ...getPolisDemoDatasetForSlug('demo'),
    };

    expect(buildPrecomputedDemoClusterState(customEdgeDataset)).not.toBeNull();

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: customEdgeDataset }}
      />,
    );

    openSettingsRow();

    expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).toBeChecked();
    expect(screen.queryByTestId(E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS)).not.toBeInTheDocument();
  });

  it('prefers a caller-provided slug dataset for custom demo pages', () => {
    const customEdgeData = {
      comments: [{ commentId: 'edge-c1', commentBody: 'Edge custom prompt' }],
      participantsVotes: [{ participant: 'edge-user-1', votes: { 0: 1 } }],
    };

    expect(
      getPolisDemoDatasetForSlug('edge', {
        demoDataBySlug: { edge: customEdgeData },
        allowFallback: false,
      }),
    ).toBe(customEdgeData);
  });

  it('resets the default demo toggle when the report slug changes', async () => {
    const { rerender } = render(<PolisReport {...baseReportProps} slug="demo" />);

    openSettingsRow();
    expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).toBeChecked();

    rerender(<PolisReport {...baseReportProps} slug="edge" />);

    openSettingsRow();
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).not.toBeChecked();
    });
  });

  it('allows custom demo pages to force demo mode while using slug-scoped datasets', () => {
    const customEdgeData = {
      comments: [{ commentId: 'edge-c1', commentBody: 'Edge custom prompt' }],
      participantsVotes: [{ participant: 'edge-user-1', votes: { 0: 1 } }],
    };

    render(
      <PolisReport
        {...baseReportProps}
        slug="edge"
        demoDataFirstLoad={true}
        demoDataBySlug={{ edge: customEdgeData }}
      />,
    );

    openSettingsRow();

    expect(screen.getByTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE)).toBeChecked();
  });

  it('keeps invalid responder ids out of the participant list when only some demo users have xids', () => {
    expect(
      getRenderableParticipantList(
        ['0x0000000000000000000000000000000000000001', 'edge-user-1', '0x0000000000000000000000000000000000000001'],
        {
          '0x0000000000000000000000000000000000000001': 'Franklin',
        },
      ),
    ).toEqual(['0x0000000000000000000000000000000000000001']);
  });

  it('resolves demo historical participants to blockie avatars instead of remote photos', () => {
    expect(getPolisHistoricalParticipantAvatar('Franklin', '0xabc') || '').not.toMatch(/^https?:/i);
  });

  it('builds demo rating matrices from binary and legacy untyped comments only', () => {
    const demoData = {
      comments: [
        { commentId: 'c-binary-1', commentBody: 'Binary 1', type: 'binary' },
        { commentId: 'c-multi', commentBody: 'Multi', type: 'multichoice' },
        { commentId: 'c-legacy', commentBody: 'Legacy untyped' },
        { commentId: 'c-rating', commentBody: 'Rating', type: 'rating' },
        { commentId: 'c-freeform', commentBody: 'Freeform', type: 'freeform' },
        { commentId: 'c-binary-2', commentBody: 'Binary 2', type: 'binary' },
      ],
      participantsVotes: [
        {
          participant: 'participant-1',
          votes: {
            0: 1,
            1: -1,
            2: 0,
            5: 1,
          },
        },
        {
          participant: 'participant-2',
          votes: {
            0: -1,
            3: 1,
            4: 0,
            5: -1,
          },
        },
      ],
    };

    const out = buildRatingMatrixFromDemo(demoData);

    expect(out.questions).toEqual(['c-binary-1', 'c-legacy', 'c-binary-2']);
    expect(out.promptsMap).toEqual({
      'c-binary-1': 'Binary 1',
      'c-legacy': 'Legacy untyped',
      'c-binary-2': 'Binary 2',
    });
    expect(out.matrix).toEqual([
      [1, -1],
      [0, null],
      [1, -1],
    ]);
    expect(out.questions).not.toContain('c-multi');
    expect(out.questions).not.toContain('c-rating');
    expect(out.questions).not.toContain('c-freeform');
  });
});

describe('Polis mixed answer report filtering', () => {
  const makeRows = (type, values) =>
    values.map((value, i) => ({
      responder: `person-${i}`,
      response: JSON.stringify({ type, prompt: `${type} prompt`, answer: { value } }),
    }));
  const metadata = {
    rating: { type: 'rating', prompt: 'Tagged rating', tags: [' Mobility '] },
    quadratic: { type: 'quadratic', prompt: 'Tagged allocation', tags: ['mobility'], options: ['Bus', 'Garden'] },
    emptyTags: { type: 'freeform', tags: [] },
    otherTag: { type: 'freeform', tags: ['housing'] },
  };
  const responses = {
    rating: makeRows('rating', [0, 8]),
    quadratic: makeRows('quadratic', [[2, -3]]),
    emptyTags: makeRows('freeform', ['Untagged']),
    otherTag: makeRows('freeform', ['Other tag']),
    unknown: makeRows('freeform', ['Unknown tags']),
  };

  beforeEach(() => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) =>
      namespace === 'questionsCache' ? { 84532: { questions: metadata } } : {},
    );
  });

  it('filters by question tags, excludes missing tags, and updates the displayed sections when filters change', () => {
    const { rerender } = render(
      <PolisReport
        {...baseReportProps}
        questionResponses={responses}
        filterState={{ selectedTags: ['MOBILITY'] }}
        disclaimersActive
      />,
    );
    expect(screen.getByText('Tagged rating')).toBeInTheDocument();
    expect(screen.getByText('Tagged allocation')).toBeInTheDocument();
    expect(screen.queryByText('Untagged')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown tags')).not.toBeInTheDocument();
    expect(screen.queryByText(/Only non-encrypted, binary/)).not.toBeInTheDocument();
    rerender(
      <PolisReport {...baseReportProps} questionResponses={responses} filterState={{ selectedTags: ['housing'] }} />,
    );
    expect(screen.queryByText('Tagged rating')).not.toBeInTheDocument();
    expect(screen.getByText('Other tag')).toBeInTheDocument();
    rerender(
      <PolisReport {...baseReportProps} questionResponses={responses} filterState={{ selectedTags: ['missing'] }} />,
    );
    expect(screen.getByText('No readable responses match the current filters.')).toBeInTheDocument();
  });

  it('ranks non-binary questions by response count after tag and type filtering', () => {
    expect(
      Object.keys(
        applyFilterStateToAggregator(
          responses,
          { id: 84532 },
          { selectedTags: ['mobility'], topQuestions: { count: 1, by: 'responses' } },
          '',
        ),
      ),
    ).toEqual(['rating']);
    expect(
      Object.keys(applyFilterStateToAggregator(responses, { id: 84532 }, { questionTypes: ['quadratic'] }, '')),
    ).toEqual(['quadratic']);
  });
});

it('filters demo answer sections and binary analysis by the same question tags', () => {
  const dataset = {
    comments: [
      { commentId: 'binary', commentBody: 'Binary excluded', type: 'binary', tags: ['other'] },
      {
        commentId: 'rating',
        commentBody: 'Demo tagged rating',
        type: 'rating',
        scale: { min: 0, max: 10 },
        tags: ['included'],
      },
    ],
    participantsVotes: [{ participant: 'person-a', votes: { 0: 1 }, responses: { 1: { value: 0 } } }],
  };
  render(
    <PolisReport
      {...baseReportProps}
      slug="demo-fixture"
      demoDataFirstLoad
      demoDataBySlug={{ 'demo-fixture': dataset }}
      filterState={{ selectedTags: ['included'] }}
    />,
  );
  expect(screen.getByText('Demo tagged rating')).toBeInTheDocument();
  expect(screen.queryByText('Binary excluded')).not.toBeInTheDocument();
  expect(screen.getByText('Summary and Statistics')).toBeInTheDocument();
  expect(screen.getAllByText('1 (0 Binary)')).toHaveLength(3);
  expect(screen.getByRole('region', { name: 'All Questions' })).toContainElement(
    screen.getByTestId('ce-polis-answers-rating'),
  );
  expect(screen.queryByRole('button', { name: 'Binary' })).not.toBeInTheDocument();
});

it('renders named quadratic totals from a scoped Worker cache and filters its question tags', () => {
  const sessionConfig = {
    slug: 'worker-session',
    sessionId: `0x${'2'.repeat(32)}`,
    corsWorkerUrl: 'https://polis-worker.example.test',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    storageProfile: {
      backend: 'cloudflare',
      resources: { questions: 'active', surveys: 'active' },
      payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope', mode: 'authorized_read' },
    },
  };
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: 'worker-session' });
  cacheScripts.peekCacheSync.mockImplementation((namespace) =>
    namespace === 'questionsCache'
      ? {
          worker: withWorkerCanonicalCacheIdentity(
            {
              questions: {
                quadratic: {
                  type: 'quadratic',
                  prompt: 'Worker allocation',
                  tags: ['included'],
                  options: ['Garden', 'Transit'],
                  voiceCredits: 200,
                },
              },
            },
            identity,
          ),
        }
      : {},
  );
  const questionResponses = {
    quadratic: [{ responder: 'person-a', response: { type: 'quadratic', answer: { value: [12, -5] } } }],
  };
  const { rerender } = render(
    <PolisReport
      {...baseReportProps}
      network={null}
      slug="worker-session"
      sessionConfig={sessionConfig}
      questionResponses={questionResponses}
      filterState={{ selectedTags: ['included'] }}
    />,
  );
  expect(screen.getByText('Worker allocation')).toBeInTheDocument();
  expect(screen.getByText('Garden')).toBeInTheDocument();
  expect(screen.getAllByText('+12')).toHaveLength(2);
  rerender(
    <PolisReport
      {...baseReportProps}
      network={null}
      slug="worker-session"
      sessionConfig={sessionConfig}
      questionResponses={questionResponses}
      filterState={{ selectedTags: ['other'] }}
    />,
  );
  expect(screen.queryByText('Worker allocation')).not.toBeInTheDocument();
});

it('uses native Group members for all answer sections and blocks unreadable cohorts without changing SBT filters', async () => {
  const tokenSpy = jest
    .spyOn(require('../../utilities/worker/workerAuth'), 'getWorkerSessionToken')
    .mockResolvedValue('synthetic-token');
  const memberSpy = jest.spyOn(require('../../domains/worker/workerGroupPorts'), 'loadWorkerGroupMembers');
  const account = '0x' + 'a'.repeat(40),
    outsider = '0x' + 'b'.repeat(40);
  const sessionConfig = {
    slug: 'group-report',
    sessionIdHex: '0x' + '3'.repeat(32),
    corsWorkerUrl: 'https://group-report.example',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  };
  const group = {
    groupId: 'eddy-2026',
    label: 'EDDY-2026',
    sessionSlug: sessionConfig.slug,
    joinMode: 'open',
    memberVisibility: 'session',
  };
  memberSpy.mockResolvedValue({
    group,
    members: [{ principal: { kind: 'passkey_account', address: account } }],
    nextCursor: '',
    memberCount: 1,
  });
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: sessionConfig.slug });
  const metadata = { q: { type: 'freeform', prompt: 'Group feedback', creator: account } };
  cacheScripts.peekCacheSync.mockImplementation((namespace) =>
    namespace === 'questionsCache'
      ? {
          worker: withWorkerCanonicalCacheIdentity({ questions: metadata }, identity),
          84532: { questions: metadata },
        }
      : {},
  );
  const selection = {
    sessionSlug: sessionConfig.slug,
    sessionId: sessionConfig.sessionIdHex,
    workerUrl: sessionConfig.corsWorkerUrl,
    creatorInclude: [],
    creatorExclude: [],
    responderInclude: [group],
    responderExclude: [],
  };
  const responses = {
    q: [
      { responder: account, response: { type: 'freeform', answer: { value: 'Member-only feedback' } } },
      { responder: outsider, response: { type: 'freeform', answer: { value: 'Outside feedback' } } },
    ],
  };
  const props = { ...baseReportProps, account, sessionConfig, slug: sessionConfig.slug, questionResponses: responses };
  try {
    const { rerender } = render(<PolisReport {...props} filterState={{ workerGroupFilter: selection }} />);
    expect(screen.queryByText('Outside feedback')).not.toBeInTheDocument();
    await screen.findByText('Member-only feedback');
    expect(screen.queryByText('Outside feedback')).not.toBeInTheDocument();
    rerender(
      <PolisReport
        {...props}
        filterState={{ workerGroupFilter: { ...selection, responderInclude: [], responderExclude: [group] } }}
      />,
    );
    await screen.findByText('Outside feedback');
    expect(screen.queryByText('Member-only feedback')).not.toBeInTheDocument();
    memberSpy.mockRejectedValue(new Error('worker_group_member_list_forbidden'));
    rerender(<PolisReport {...props} account={outsider} filterState={{ workerGroupFilter: selection }} />);
    expect(screen.queryByText('Outside feedback')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'));
    rerender(
      <PolisReport {...props} sessionConfig={{ chainId: 84532 }} filterState={{ workerGroupFilter: selection }} />,
    );
    await screen.findByText('Outside feedback');
    expect(screen.getByText('Member-only feedback')).toBeInTheDocument();
  } finally {
    tokenSpy.mockRestore();
    memberSpy.mockRestore();
  }
});

it('updates all-type summary counts on response nonce changes without waiting for binary analysis', () => {
  const responses = {
    text: [{ responder: 'person-a', response: { type: 'freeform', prompt: 'Explain', answer: { value: 'First' } } }],
  };
  const { rerender } = render(
    <PolisReport {...baseReportProps} questionResponses={responses} questionResponsesNonce={1} />,
  );
  expect(screen.getAllByText('1 (0 Binary)')).toHaveLength(3);
  // Cache hydration may append to the same aggregator object after submission.
  responses.text.push({
    responder: 'person-b',
    response: { type: 'freeform', prompt: 'Explain', answer: { value: 'Second' } },
  });
  rerender(<PolisReport {...baseReportProps} questionResponses={responses} questionResponsesNonce={2} />);
  expect(screen.getAllByText('2 (0 Binary)')).toHaveLength(2);
  expect(screen.getByText('1 (0 Binary)')).toBeInTheDocument();
  expect(screen.getByText('1.00 (0.00 Binary)')).toBeInTheDocument();
});

it.each([
  [null, ['1', '1', '1', '1.00']],
  ['person-a', ['1', '2 (1 Binary)', '2 (1 Binary)', '2.00 (1.00 Binary)']],
  ['person-b', ['2 (1 Binary)', '2 (1 Binary)', '2 (1 Binary)', '1.00']],
])('shows binary statistics only when each value differs (written responder: %s)', (writtenResponder, expected) => {
  const responses = {
    binary: [{ responder: 'person-a', response: { type: 'binary', prompt: 'Agree?', answer: { value: 'Agree' } } }],
    ...(writtenResponder
      ? {
          written: [
            {
              responder: writtenResponder,
              response: { type: 'freeform', prompt: 'Explain', answer: { value: 'Thoughts' } },
            },
          ],
        }
      : {}),
  };
  render(<PolisReport {...baseReportProps} questionResponses={responses} />);
  ['Participants', 'Questions', 'Responses', 'Responses/Participant Avg'].forEach((label, index) => {
    const stat = screen.getByText(
      (_, node) => node?.classList.contains('statLabel') && node.firstChild?.textContent.trim() === label,
    ).parentElement;
    expect(stat.querySelector('.statValue').textContent).toBe(expected[index]);
  });
});
