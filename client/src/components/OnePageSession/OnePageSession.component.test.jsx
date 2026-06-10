/** @file OnePageSession.component.test.jsx */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ethers } from 'ethers';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import OnePageSession from './OnePageSession';
import styles from './OnePageSession.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { __test__resetTelegramSessionMetaCache } from '../../utilities/session/telegramSessionMeta.js';
import { __test__workerAuthTokenCache } from '../../utilities/worker/workerAuth.js';

const mockSurveyPage = jest.fn();
const mockPolisReport = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockRiskMatrix = jest.fn();
const mockDebateSelector = jest.fn();
const mockDemoAnalysisWorkspace = jest.fn();
const originalFetch = global.fetch;
const fullCrossCorpusPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../../../ai-discourse-corpus/corpuses/cross-corpus-debates.json'),
    'utf8'
  )
);

const extractMediaBlock = (scss, query, requiredSnippet = '') => {
  let searchFrom = 0;

  while (searchFrom < scss.length) {
    const queryIndex = scss.indexOf(query, searchFrom);
    if (queryIndex === -1) {
      return null;
    }

    const blockStart = scss.indexOf('{', queryIndex);
    if (blockStart === -1) {
      return null;
    }

    let depth = 0;
    for (let index = blockStart; index < scss.length; index += 1) {
      const char = scss[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        const block = scss.slice(queryIndex, index + 1);
        if (!requiredSnippet || block.includes(requiredSnippet)) {
          return block;
        }
        searchFrom = queryIndex + query.length;
        break;
      }
    }
  }

  return null;
};

jest.mock('../SurveyTool/SurveyPage', () => (props) => {
  mockSurveyPage(props);
  if (props.minifiedMode === 'pile') {
    return (
      <div data-testid="survey-page-pile">
        <button type="button" data-testid="pile-view-all" onClick={props.onViewAllClick}>
          View All Questions
        </button>
      </div>
    );
  }
  return <div data-testid="survey-page-full">Full Questions</div>;
});

jest.mock('../SBTs/SBTsPage', () => (props) => {
  mockSBTsPage(props);
  return (
    <div data-testid="sbts-page">
      {props.showCreateGroupExternal ? 'Create Open' : 'Create Closed'}
    </div>
  );
});
jest.mock('../PolisReport/PolisReport', () => (props) => {
  mockPolisReport(props);
  return <div data-testid="polis-report">Polis</div>;
});
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props) => {
    mockDebateMap(props);
    return (
      <div data-testid="ai-policy-atlas">
        AI Policy Atlas
        {props.onModalClose ? (
          <button type="button" onClick={props.onModalClose}>
            Close Atlas Modal
          </button>
        ) : null}
      </div>
    );
  },
}));
jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props) => {
    mockRiskMatrix(props);
    return (
      <div data-testid="risk-matrix-view">
        Risk Matrix
        {typeof props.onOpenAtlasNode === 'function' ? (
          <button
            type="button"
            data-testid="risk-matrix-open-atlas-node"
            onClick={() => props.onOpenAtlasNode(
              '0x4110000000000000000000000000000000000000000000000000000000000000',
              {
                modal: true,
                selectedCellId: 'Capabilities_vs_Labor',
                activeCategoryX: 'Capabilities',
                activeCategoryY: 'Labor',
                comment: 'Return here after checking the atlas node.',
                valence: 'risk',
                intensity: 6,
                comments: [
                  {
                    cell: 'Capabilities.Reasoning.Labor.Productivity',
                    comment: 'Capability gains can compress reporting, research, and drafting cycles.',
                    valence: 'opportunity',
                    intensity: 5,
                  },
                ],
              }
            )}
          >
            Open linked atlas node
          </button>
        ) : null}
      </div>
    );
  },
}));
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props) => {
    mockDemoAnalysisWorkspace(props);
    return <div data-testid="demo-analysis-workspace-view">Demo Analysis</div>;
  },
}));
jest.mock('../DemoViews/DebateHUD/DebateSelector', () => (props) => {
  mockDebateSelector(props);
  return <div data-testid="debate-selector">Debate Selector</div>;
});

describe('OnePageSession view gating', () => {
  afterEach(() => {
    __test__resetTelegramSessionMetaCache();
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: originalFetch,
    });
  });

  const buildProps = () => ({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'wagmi',
    account: '',
    loginComplete: false,
    toggleLoginModal: jest.fn(),
    isQuestionCacheReady: false,
    isResponsesCacheReady: false,
    isSBTCacheReady: false,
    isSurveyCacheReady: false,
    sbtCacheRevision: 0,
    sbtScanProgressBySlug: {},
    questionResponsesNonce: 0,
    questionScanProgress: null,
    refreshSurveyResponsesByID: jest.fn(),
    refreshQuestionMetadata: jest.fn(),
    refreshQuestionResponses: jest.fn(),
    refreshSbtData: jest.fn(),
    defaultFilterState: { includedSBTs: [], excludedSBTs: [], onlyVerifiedHumans: false },
    sessionConfig: {
      slug: 'edge',
      sessionName: 'Edge Session',
      sessionInfo: 'Edge info',
      defaultTags: [],
      defaultSbtTags: [],
      defaultFeaturedSBTs: [],
      contracts: {},
      blockLimits: {},
      networkChainId: 84532,
    },
  });

  const createSubject = (props = {}) => {
    const mergedProps = { ...buildProps(), ...props };
    const subject = new OnePageSession(mergedProps);
    subject._isMounted = true;
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    return subject;
  };

  const getAutoMintStorageKey = (account, sbtAddress, chainId = 84532) => (
    `autoMint:${String(account || '').toLowerCase()}:${chainId}:${String(sbtAddress || '').toLowerCase()}`
  );

  const seedTelegramStoredCredentials = ({
    address = '0x00000000000000000000000000000000000000aa',
    exp = Math.floor(Date.now() / 1000) + 3600,
  } = {}) => {
    window.localStorage.setItem(
      __test__workerAuthTokenCache.buildTelegramWorkerLoginKey({ slug: 'edge' }),
      JSON.stringify({
        v: 1,
        sessionSlug: 'edge',
        workerUrl: 'https://session-worker.example',
        agentBridgeUrl: 'https://bridge.example',
        agentToken: `ceagt_${'G'.repeat(32)}`,
        address,
        updatedAt: Date.now(),
      })
    );
    window.localStorage.setItem(
      __test__workerAuthTokenCache.buildTokenCacheKey({
        workerUrl: 'https://session-worker.example',
        slug: 'edge',
        address,
      }),
      JSON.stringify(__test__workerAuthTokenCache.buildTokenCacheEnvelope({
        token: 'worker-jwt-cached',
        exp,
        workerUrl: 'https://session-worker.example',
        sessionSlug: 'edge',
        address,
      }))
    );
    return { address, exp };
  };

  const buildTelegramAgentFetchMock = ({
    questions = [{ questionId: 'q1', questionType: 'binary', prompt: 'Fund the proposal?', tags: ['governance'] }],
    answerState = { answeredCount: 1, unansweredCount: 2, sort: 'unanswered_first' },
    resultsByView = {},
    failAgentReads = false,
    exchange = null,
  } = {}) => jest.fn(async (url) => {
    const urlString = String(url);
    if (urlString.includes('/telegram-topic-map/')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (urlString.includes('/telegram/agent/api/session-meta')) {
      return {
        ok: true,
        json: async () => ({ ok: true, sessionSlug: 'edge', telegramOnly: true, telegramBridgeEnabled: true }),
      };
    }
    if (urlString.includes('/client-login/exchange') && exchange) {
      return exchange();
    }
    if (urlString.includes('/telegram/agent/api/questions')) {
      if (failAgentReads) throw new Error('worker offline');
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, sessionSlug: 'edge', answerState, questions }),
      };
    }
    if (urlString.includes('/telegram/agent/api/results')) {
      if (failAgentReads) throw new Error('worker offline');
      const view = new URL(urlString).searchParams.get('view') || '';
      if (resultsByView[view]) return resultsByView[view]();
      if (view === 'polis') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, reason: 'unsupported_results_view' }),
        };
      }
      if (view === 'consensus' || view === 'difference') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            questionCount: 1,
            responseCount: 3,
            questions: [{
              questionId: view === 'consensus' ? 'q-consensus' : 'q-difference',
              prompt: view === 'consensus' ? 'Agree on funding?' : 'Split on roadmap?',
              total: 3,
              participants: 3,
              agreementScore: 0.66,
              differenceScore: 0.2,
              counts: [
                { label: 'Agree', count: 2 },
                { label: 'Disagree', count: 1 },
              ],
            }],
          }),
        };
      }
      if (view === 'groups') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            groupCount: 1,
            suppressedGroupCount: 0,
            participantCount: 3,
            questionCount: 1,
            minGroupSize: 2,
            groups: [{
              groupId: 'g1',
              label: 'Group A',
              theme: 'Builders',
              size: 3,
              averageScore: 0.5,
              topStatements: [{
                prompt: 'Agree on funding?',
                cluster: { agree: 2, disagree: 1, unsure: 0, responded: 3 },
                differenceScore: 0.4,
              }],
            }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, available: false, unavailableReason: 'not_enough_responses', counts: {} }),
      };
    }
    throw new Error(`Unexpected fetch: ${urlString}`);
  });

  const installFetchMock = (fetchMock) => {
    Object.defineProperty(global, 'fetch', { writable: true, value: fetchMock });
    return fetchMock;
  };

  const openTelegramQuestions = async () => {
    const toggle = await screen.findByTestId('ce-session-telegram-questions-toggle');
    if (!screen.queryByTestId('ce-session-telegram-questions')) {
      fireEvent.click(toggle);
    }
    return screen.findByTestId('ce-session-telegram-questions');
  };

  it('renders only one SurveyPage instance when switching from pile to full view', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-page-full')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pile-view-all'));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_PILE_BACK)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('survey-page-pile')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('survey-page-full')).toHaveLength(1);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_PILE_BACK));

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('survey-page-full')).not.toBeInTheDocument();
  });

  it('shows the Telegram token login for Telegram-only sessions', async () => {
    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
      }}
    />);

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE)).toHaveTextContent(
      /Telegram-only session/i
    );
    expect(screen.getByTestId('ce-session-telegram-token-login')).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-telegram-token-input')).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/copied bot message/i)
    );
    expect(screen.queryByText(/Connect wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/passkey/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-page-pile')).not.toBeInTheDocument();
    expect(mockSurveyPage).not.toHaveBeenCalled();
  });

  it('restores Telegram token login from stored credentials on reload', async () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const exp = Math.floor(Date.now() / 1000) + 3600;
    window.localStorage.setItem(
      __test__workerAuthTokenCache.buildTelegramWorkerLoginKey({ slug: 'edge' }),
      JSON.stringify({
        v: 1,
        sessionSlug: 'edge',
        workerUrl: 'https://session-worker.example',
        agentBridgeUrl: 'https://bridge.example',
        agentToken: `ceagt_${'G'.repeat(32)}`,
        address,
        updatedAt: Date.now(),
      })
    );
    window.localStorage.setItem(
      __test__workerAuthTokenCache.buildTokenCacheKey({
        workerUrl: 'https://session-worker.example',
        slug: 'edge',
        address,
      }),
      JSON.stringify(__test__workerAuthTokenCache.buildTokenCacheEnvelope({
        token: 'worker-jwt-cached',
        exp,
        workerUrl: 'https://session-worker.example',
        sessionSlug: 'edge',
        address,
      }))
    );

    installFetchMock(buildTelegramAgentFetchMock());

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-telegram-questions')).not.toBeInTheDocument();
    await openTelegramQuestions();
    expect(await screen.findByText('Fund the proposal?')).toBeInTheDocument();
    // Worker-backed telegram sessions must not mount the on-chain question pile,
    // and question ids stay out of the UI.
    expect(screen.queryByTestId('survey-page-pile')).not.toBeInTheDocument();
    expect(mockSurveyPage).not.toHaveBeenCalled();
    expect(screen.queryByText('q1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-telegram-token-login')).not.toBeInTheDocument();
  });

  it('shows the token gate when session-meta reports telegram-only without the config flag', async () => {
    const fetchMock = jest.fn(async (url) => {
      if (String(url).includes('/telegram/agent/api/session-meta')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: 'edge',
            telegramOnly: true,
            telegramBridgeEnabled: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-token-login')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE)).toHaveTextContent(
      /Telegram-only session/i
    );
  });

  it('ignores query-param bridge overrides when probing session-meta', async () => {
    const sessionMetaUrls = [];
    const fetchMock = jest.fn(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/telegram/agent/api/session-meta')) {
        sessionMetaUrls.push(urlString);
        return {
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: 'edge',
            telegramOnly: true,
            telegramBridgeEnabled: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${urlString}`);
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    try {
      window.history.replaceState({}, '', '/session/edge?bridge=https://attacker.example');

      render(<OnePageSession
        {...buildProps()}
        sessionConfig={{
          ...buildProps().sessionConfig,
          agentBridgeUrl: 'https://bridge.example',
        }}
      />);

      await waitFor(() => {
        expect(sessionMetaUrls.length).toBeGreaterThan(0);
      });
      expect(sessionMetaUrls.every((url) => url.startsWith('https://bridge.example'))).toBe(true);
      expect(sessionMetaUrls.some((url) => url.includes('attacker.example'))).toBe(false);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('keeps the token gate hidden when session-meta reports not telegram-only', async () => {
    const fetchMock = jest.fn(async (url) => {
      if (String(url).includes('/telegram/agent/api/session-meta')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: 'edge',
            telegramOnly: false,
            telegramBridgeEnabled: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://bridge.example/telegram/agent/api/session-meta?sessionSlug=edge'
      );
    });
    expect(screen.queryByTestId('ce-session-telegram-token-login')).toBeNull();
  });

  it('shows refresh results button after telegram login and re-pulls worker data', async () => {
    seedTelegramStoredCredentials();
    const refreshSpy = jest.fn(() => Promise.resolve());
    const fetchMock = installFetchMock(buildTelegramAgentFetchMock());

    render(<OnePageSession
      {...buildProps()}
      refreshQuestionResponses={refreshSpy}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    expect(await screen.findByTestId('ce-session-telegram-results')).toBeInTheDocument();
    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    expect(await screen.findByTestId('ce-session-telegram-report-approx')).toBeInTheDocument();

    const questionCallsBefore = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/telegram/agent/api/questions')).length;
    const refreshButton = await screen.findByTestId('ce-session-results-refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      const questionCallsAfter = fetchMock.mock.calls
        .filter(([url]) => String(url).includes('/telegram/agent/api/questions')).length;
      expect(questionCallsAfter).toBeGreaterThan(questionCallsBefore);
    });
    await waitFor(() => {
      expect(screen.getByTestId('ce-session-results-refresh')).not.toBeDisabled();
    });
    // Telegram sessions refresh from the worker, not the on-chain scan.
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('recovers when telegram worker reads fail', async () => {
    seedTelegramStoredCredentials();
    const refreshSpy = jest.fn(() => Promise.resolve());
    installFetchMock(buildTelegramAgentFetchMock({ failAgentReads: true }));

    render(<OnePageSession
      {...buildProps()}
      refreshQuestionResponses={refreshSpy}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    await openTelegramQuestions();
    expect(await screen.findByText(/could not load questions/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    const refreshButton = await screen.findByTestId('ce-session-results-refresh');

    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByTestId('ce-session-results-refresh')).not.toBeDisabled();
    });
    // Per-view failures degrade to subsection-level messages, not a dead panel.
    expect((await screen.findAllByText(/unavailable right now/i)).length).toBeGreaterThan(0);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('renders research buckets instead of SBT groups for telegram sessions', async () => {
    installFetchMock(buildTelegramAgentFetchMock({
      exchange: () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          tokenType: 'session_worker_jwt',
          sessionSlug: 'edge',
          accountAddress: '0x00000000000000000000000000000000000000aa',
          workerUrl: 'https://session-worker.example',
          workerToken: 'worker-jwt-fresh',
          exp: Math.floor(Date.now() / 1000) + 3600,
          buckets: {
            categories: [{
              categoryId: 'events_attended',
              label: 'Attendance',
              options: [
                { optionId: 'week_1', label: 'Week 1' },
                { optionId: 'week_2', label: 'Week 2' },
              ],
            }],
            selections: { events_attended: ['week_1'] },
          },
        }),
      }),
    }));

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    fireEvent.change(await screen.findByTestId('ce-session-telegram-token-input'), {
      target: { value: `ceagt_${'B'.repeat(32)}` },
    });
    fireEvent.click(screen.getByTestId('ce-session-telegram-token-submit'));

    expect(await screen.findByText('Research Buckets')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Research Buckets'));

    expect(await screen.findByTestId('ce-session-telegram-buckets')).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    // Options live in a dropdown; the current selection also renders as a chip.
    const bucketSelect = screen.getByTestId('ce-session-telegram-bucket-select');
    expect(bucketSelect).toHaveValue('week_1');
    expect(within(bucketSelect).getByText('Week 2')).toBeInTheDocument();
    expect(screen.getAllByText('Week 1').length).toBeGreaterThan(0);
    fireEvent.change(bucketSelect, { target: { value: 'week_2' } });
    expect(bucketSelect).toHaveValue('week_2');
    expect(screen.queryByTestId('sbts-page')).not.toBeInTheDocument();
    expect(mockSBTsPage).not.toHaveBeenCalled();
    expect(screen.queryByText('Join or Create')).not.toBeInTheDocument();
  });

  it('renders the real polis report when the worker exposes response vectors', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock({
      resultsByView: {
        polis: () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            participantCount: 2,
            questionCount: 1,
            responseCount: 2,
            questions: [{ questionId: 'q-binary', prompt: 'Fund the proposal?', questionType: 'binary' }],
            responses: {
              'q-binary': [
                { responder: 'P1', value: 'Agree' },
                { responder: 'P2', value: 'Disagree' },
              ],
            },
          }),
        }),
      },
    }));

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockPolisReport).toHaveBeenCalledWith(expect.objectContaining({
        questionResponses: expect.objectContaining({
          'q-binary': expect.arrayContaining([
            expect.objectContaining({ responder: 'P1', questionId: 'q-binary' }),
          ]),
        }),
      }));
    });
    expect(screen.queryByTestId('ce-session-telegram-report-approx')).not.toBeInTheDocument();
    // The real report replaces the aggregate card sections.
    expect(screen.queryByText('Agree on funding?')).not.toBeInTheDocument();
  });

  it('synthesizes a real polis report from aggregate rows when live vectors are unavailable', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock({
      resultsByView: {
        groups: () => ({
          ok: false,
          status: 403,
          json: async () => ({ ok: false, reason: 'anonymized_groups_admin_disabled' }),
        }),
      },
    }));

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    expect(await screen.findByTestId('ce-session-telegram-report-approx')).toHaveTextContent(/Approximate view/i);
    await waitFor(() => {
      const latestProps = mockPolisReport.mock.calls[mockPolisReport.mock.calls.length - 1]?.[0] || {};
      const rows = Object.values(latestProps.questionResponses || {}).flat();
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(JSON.parse(row.response)).toMatchObject({
          type: 'binary',
          answer: { value: expect.stringMatching(/Agree|Disagree|Unsure/) },
        });
      });
    });
    expect(screen.queryByText('Consensus')).not.toBeInTheDocument();
    expect(screen.queryByText('Differences')).not.toBeInTheDocument();
  });

  it('synthesizes telegram polis participants from anonymized groups when available', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock());

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    await waitFor(() => {
      const latestProps = mockPolisReport.mock.calls[mockPolisReport.mock.calls.length - 1]?.[0] || {};
      const rows = Object.values(latestProps.questionResponses || {}).flat();
      expect(rows.map((row) => row.responder)).toEqual(expect.arrayContaining(['G1-P1', 'G1-P2']));
    });
  });

  it('offers a copyable codex topic-map prompt in telegram results', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock());
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    const nav = await screen.findByTestId('ce-session-results-view-nav');
    expect(within(nav).getByRole('button', { name: /Report/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Debate Map/i })).toBeInTheDocument();
    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-telegram-topicmap-section')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Debate Map/i }));

    expect(await screen.findByTestId('ce-session-telegram-topicmap-section')).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-telegram-topicmap')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-session-telegram-topicmap-copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const prompt = writeText.mock.calls[0][0];
    expect(prompt).toContain('client/public/telegram-topic-map/edge.json');
    expect(prompt).toContain('DATASET:');
    expect(prompt).toContain('"sessionSlug": "edge"');
    expect(prompt).toContain('Fund the proposal?');
    // The stored ceagt token must never leak into the prompt.
    expect(prompt).not.toContain('ceagt_');
    await screen.findByText('Copied!');
  });

  it('renders read-only telegram pile controls by question type', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock({
      questions: [
        { questionId: 'q-binary', questionType: 'binary', prompt: 'Disclose agent identity?', tags: ['norms'] },
        {
          questionId: 'q-multi',
          questionType: 'multichoice',
          prompt: 'Which tools matter?',
          options: ['Geo', 'Index'],
          tags: ['tools'],
        },
        { questionId: 'q-rating', questionType: 'rating', prompt: 'How comfortable are you?', tags: ['trust'] },
        { questionId: 'q-freeform', questionType: 'freeform', prompt: 'How can agents help?', tags: ['agents'] },
      ],
    }));

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    await openTelegramQuestions();
    expect(await screen.findByText('Disclose agent identity?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agree' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disagree' })).toBeDisabled();

    fireEvent.click(screen.getByTestId('ce-session-telegram-question-next'));
    expect(await screen.findByText('Which tools matter?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Geo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Index' })).toBeDisabled();

    fireEvent.click(screen.getByTestId('ce-session-telegram-question-next'));
    expect(await screen.findByText('How comfortable are you?')).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-telegram-question-rating-controls')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-session-telegram-question-next'));
    expect(await screen.findByText('How can agents help?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Freeform response')).toBeDisabled();
    expect(screen.queryByText('q-binary')).not.toBeInTheDocument();
  });

  it('keeps non-telegram result tabs unchanged', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    const nav = screen.getByTestId('ce-session-results-view-nav');

    expect(within(nav).getByRole('button', { name: /Report/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: /Debate Map/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-telegram-topicmap-section')).not.toBeInTheDocument();
  });

  it('shows per-view disabled state in telegram results', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock({
      resultsByView: {
        consensus: () => ({
          ok: false,
          status: 403,
          json: async () => ({ ok: false, reason: 'level_3_aggregate_results_admin_disabled' }),
        }),
        difference: () => ({
          ok: false,
          status: 403,
          json: async () => ({ ok: false, reason: 'level_3_aggregate_results_admin_disabled' }),
        }),
        groups: () => ({
          ok: false,
          status: 403,
          json: async () => ({ ok: false, reason: 'anonymized_groups_admin_disabled' }),
        }),
      },
    }));

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    expect(await screen.findByTestId('ce-session-telegram-results')).toBeInTheDocument();

    expect((await screen.findAllByText(/not enabled for this session/i)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('polis-report')).not.toBeInTheDocument();
    expect(mockPolisReport).not.toHaveBeenCalled();
  });

  it('reopens token entry with a clear message when the telegram token expired', async () => {
    const fetchMock = jest.fn(async (url) => {
      if (String(url).includes('/client-login/exchange')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            ok: false,
            reason: 'agent_token_not_found',
            action: 'refresh_user_agent_token',
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    fireEvent.change(await screen.findByTestId('ce-session-telegram-token-input'), {
      target: { value: `ceagt_${'A'.repeat(32)}` },
    });
    fireEvent.click(screen.getByTestId('ce-session-telegram-token-submit'));

    expect(await screen.findByText(/token expired or was revoked/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-telegram-token-input')).toBeInTheDocument();
  });

  it('lets a logged-in user open the change-token form', async () => {
    seedTelegramStoredCredentials();
    installFetchMock(buildTelegramAgentFetchMock());

    render(<OnePageSession
      {...buildProps()}
      sessionConfig={{
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        agentBridgeUrl: 'https://bridge.example',
      }}
    />);

    expect(await screen.findByTestId('ce-session-telegram-questions-toggle')).toBeInTheDocument();
    const changeToken = await screen.findByTestId('ce-session-telegram-change-token');

    fireEvent.click(changeToken);

    expect(screen.getByTestId('ce-session-telegram-token-input')).toBeInTheDocument();
  });

  it('treats expired in-memory Telegram client auth as logged out', () => {
    const subject = createSubject({
      sessionConfig: {
        ...buildProps().sessionConfig,
        telegramOnly: true,
        sessionMode: 'telegram_only',
      },
    });
    subject.state.telegramClientAuth = {
      accountAddress: '0x00000000000000000000000000000000000000aa',
      workerToken: 'worker-jwt-expired',
      sessionSlug: 'edge',
      exp: Math.floor(Date.now() / 1000) - 60,
    };

    expect(subject.hasTelegramClientAuth('edge')).toBe(false);
  });

  it('derives scoped Chipotle Lit hooks for embedded survey pages from session config', async () => {
    render(<OnePageSession
      {...buildProps()}
      account="0x1E9a72A127dAB666fd47dFAFAe15CCd9e08505eE"
      loginComplete={true}
      sessionConfig={{
        ...buildProps().sessionConfig,
        slug: 'chipotle-session',
        corsWorkerUrl: 'https://worker.example.test',
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000001'],
              chainId: 11155420,
              mode: 'any',
            },
          },
        },
      }}
    />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    const pileProps = mockSurveyPage.mock.calls.find(([props]) => props?.minifiedMode === 'pile')?.[0];

    expect(pileProps?.litHooks).toEqual(expect.objectContaining({
      saveKey: expect.any(Function),
      getKey: expect.any(Function),
      litNetwork: 'chipotle',
    }));
  });

  it('uses the title container slot to keep the pile submit rail off the header title', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    const titleHeading = document.querySelector(`.${styles.brandingSectionTitle}`);
    const titleContainer = titleHeading?.closest(`.${styles.titleContainer}`);
    const latestSurveyPageProps = mockSurveyPage.mock.calls[mockSurveyPage.mock.calls.length - 1]?.[0];

    expect(titleHeading).not.toBeNull();
    expect(titleContainer).not.toBeNull();
    expect(titleContainer).not.toHaveClass(styles.titleContainerWithPileSubmitRail);

    act(() => {
      latestSurveyPageProps.onPileSubmitRailVisibilityChange(true);
    });

    expect(titleContainer).toHaveClass(styles.titleContainerWithPileSubmitRail);

    act(() => {
      latestSurveyPageProps.onPileSubmitRailVisibilityChange(false);
    });

    expect(titleContainer).not.toHaveClass(styles.titleContainerWithPileSubmitRail);
  });

  it('applies pile submit rail title offsets only on pile top-rail breakpoints', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const phoneRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (max-width: 480px)',
      '.titleContainerWithPileSubmitRail'
    );
    const desktopRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 769px) and (max-width: 1366px)',
      '.titleContainerWithPileSubmitRail'
    );
    const widescreenRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 1367px)',
      '.titleContainerWithPileSubmitRail'
    );
    const tabletRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 481px) and (max-width: 768px)',
      '.titleContainerWithPileSubmitRail'
    );

    expect(scss).toContain('.brandingSectionWithPileSubmitRail');
    expect(scss).toContain('.titleContainerWithPileSubmitRail');
    expect(phoneRailBlock).toContain('.titleContainerWithPileSubmitRail');
    expect(phoneRailBlock).toContain('transform: translateY(-40px);');
    expect(desktopRailBlock).toContain('.titleContainerWithPileSubmitRail');
    expect(desktopRailBlock).toContain('transform: translateY(-40px);');
    expect(widescreenRailBlock).toContain('.titleContainerWithPileSubmitRail');
    expect(widescreenRailBlock).toContain('transform: translateY(-52px);');
    expect(tabletRailBlock).toBeNull();
  });

  it('passes hideEmbeddedDebugUi only to embedded full SurveyPage mode', async () => {
    render(<OnePageSession {...buildProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });

    const pileCalls = mockSurveyPage.mock.calls
      .map((args) => args[0])
      .filter((childProps) => childProps?.minifiedMode === 'pile');
    expect(pileCalls.length).toBeGreaterThan(0);
    expect(pileCalls[pileCalls.length - 1]?.hideEmbeddedDebugUi).not.toBe(true);

    fireEvent.click(screen.getByTestId('pile-view-all'));
    await waitFor(() => {
      expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
    });

    const fullCalls = mockSurveyPage.mock.calls
      .map((args) => args[0])
      .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile');
    expect(fullCalls.length).toBeGreaterThan(0);
    expect(fullCalls[fullCalls.length - 1]?.hideEmbeddedDebugUi).toBe(true);
    expect(fullCalls[fullCalls.length - 1]?.sessionSlugPinned).toBe(true);
  });

  it('passes slug-scoped Polis demo data through to the embedded report', async () => {
    const customEdgeData = {
      edge: {
        comments: [{ commentId: 'edge-c1', commentBody: 'Edge custom prompt' }],
        participantsVotes: [{ participant: 'edge-user-1', votes: { 0: 1 } }],
      },
    };
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };

    render(
      <OnePageSession
        {...buildProps()}
        polisDemoDataBySlug={customEdgeData}
        questionScanProgress={progress}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });

    const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(polisCalls.length).toBeGreaterThan(0);
    expect(polisCalls[polisCalls.length - 1]?.demoDataBySlug).toBe(customEdgeData);
    expect(polisCalls[polisCalls.length - 1]?.questionScanProgress).toBe(progress);
  });

  it('uses shared session-universe discovery when bootstrapping embedded groups', () => {
    const ensureLightSbtUniverse = jest.fn(() => Promise.resolve());
    const subject = createSubject({
      ensureLightSbtUniverse,
    });
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/edge');
      subject.kickoffLightSbtUniverseScan({
        ...subject.props,
        slug: 'edge',
        ensureLightSbtUniverse,
      });

      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(['edge'], {
        forceScopeSlug: 'edge',
      });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('skips embedded group bootstrapping when shared universe discovery is unavailable', () => {
    const ensureLightSbtUniverse = jest.fn(() => Promise.resolve());
    const subject = createSubject();
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/edge');
      subject.kickoffLightSbtUniverseScan({
        ...subject.props,
        slug: 'edge',
      });

      expect(ensureLightSbtUniverse).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps embedded PolisReport question responses scoped to visible route questions', async () => {
    jest.useFakeTimers();
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        if (slug === 'edge') {
          return {
            '84532': {
              questions: {
                q1: { id: 'q1', prompt: 'Edge prompt', type: 'binary' },
                qPending: {
                  id: 'qPending',
                  prompt: '[encrypted]',
                  type: 'binary',
                  __ceQuestionMetadataPending: true,
                },
                qForeignExplicit: {
                  id: 'qForeignExplicit',
                  prompt: 'Foreign prompt',
                  type: 'binary',
                  sessionSlug: 'demo',
                  sessionSlugExplicit: true,
                },
              },
              questionResponses: {
                q1: {
                  '0xedge': {
                    type: 'binary',
                    answer: { value: 'yes', encrypted: false },
                  },
                },
                qPending: {
                  '0x02a2a289d5cde3c7d7b957c7f32299ca35d53526': {
                    type: 'binary',
                    answer: { value: 'no', encrypted: false },
                  },
                },
                qForeignExplicit: {
                  '0x02a2a289d5cde3c7d7b957c7f32299ca35d53526': {
                    type: 'binary',
                    answer: { value: 'no', encrypted: false },
                  },
                },
              },
            },
          };
        }
        if (slug === 'alpha') {
          return {
            '84532': {
              questionResponses: {
                q2: {
                  '0xalpha': {
                    type: 'binary',
                    answer: { value: 'no', encrypted: false },
                  },
                },
              },
            },
          };
        }
        return {};
      });

      render(
        <OnePageSession
          {...buildProps()}
          isQuestionCacheReady={true}
          network={{ id: 84532, name: 'Base Sepolia' }}
        />
      );

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('polis-report')).toBeInTheDocument();
      });

      const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
      const latestQuestionResponses = polisCalls[polisCalls.length - 1]?.questionResponses || {};
      expect(Object.keys(latestQuestionResponses).sort()).toEqual(['q1']);
      expect(JSON.stringify(latestQuestionResponses)).not.toContain('0x02a2a289d5cde3c7d7b957c7f32299ca35d53526');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('moves the full questions title into the top back-button header', async () => {
    const questionsHeaderName = /Questions(?:\s+[-–]\s+|\s+)Answer or Add/i;

    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pile-view-all'));

    const fullHeader = await screen.findByTestId(E2E_TESTIDS.SESSION_QUESTIONS_FULL_HEADER);

    expect(within(fullHeader).getByTestId(E2E_TESTIDS.SESSION_PILE_BACK)).toBeInTheDocument();
    expect(
      within(fullHeader).getByRole('heading', { name: questionsHeaderName })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: questionsHeaderName })).toHaveLength(1);
  });

  it('uses a two-up sections grid when only groups and results are visible', async () => {
    const { container } = render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    const sectionsGrid = container.querySelector(`.${styles.sectionsGrid}`);
    expect(sectionsGrid).not.toBeNull();
    expect(sectionsGrid).toHaveClass(styles.sectionsGridTwoUp);
    expect(screen.queryByText('Documents')).not.toBeInTheDocument();
  });

  it('renders title and subtitle text for section headers', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    expect(screen.getByText(t('sbts'))).toHaveClass(styles.sectionHeaderTitle);
    expect(screen.getByText('Join or Create')).toHaveClass(styles.sectionHeaderSubtitle);

    fireEvent.click(screen.getByTestId('pile-view-all'));

    const fullHeader = await screen.findByTestId(E2E_TESTIDS.SESSION_QUESTIONS_FULL_HEADER);
    expect(within(fullHeader).getByText('Questions')).toHaveClass(styles.sectionHeaderTitle);
    expect(within(fullHeader).getByText('Answer or Add')).toHaveClass(styles.sectionHeaderSubtitle);
  });

  it('keeps section-card headers inline through 767px without pulling full phone layout onto tablets', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const phoneBlock = extractMediaBlock(scss, '@media only screen and (max-width: 600px)', '.onePageDemoContainer');
    const smallTabletBlock = extractMediaBlock(scss, '@media only screen and (min-width: 601px) and (max-width: 767px)', '.sectionHeader {');

    expect(phoneBlock).toContain('.sectionContainer');
    expect(phoneBlock).toContain('border: none;');
    expect(phoneBlock).toContain('.sectionHeader .sectionHeaderSubtitle {');
    expect(phoneBlock).toContain('font-size: 1em;');
    expect(phoneBlock).toContain('font-weight: inherit;');
    expect(phoneBlock).toContain('color: rgba(255, 255, 255, 0.15);');
    expect(phoneBlock).toContain('.sectionHeader {');
    expect(phoneBlock).toContain('align-items: center;');
    expect(phoneBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip > svg {');
    expect(phoneBlock).toContain('opacity: 0.6;');
    expect(phoneBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip {');
    expect(phoneBlock).toContain('justify-content: center;');
    expect(phoneBlock).toContain('min-height: 44px;');
    expect(phoneBlock).toContain('min-width: 44px;');
    expect(smallTabletBlock).toContain('.sectionHeader {');
    expect(smallTabletBlock).toContain('align-items: center;');
    expect(smallTabletBlock).toContain('font-size: 1.6em;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderText {');
    expect(smallTabletBlock).toContain('flex-direction: row;');
    expect(smallTabletBlock).toContain('align-items: center;');
    expect(smallTabletBlock).toContain('gap: 6px 12px;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderSubtitle {');
    expect(smallTabletBlock).toContain('font-size: 1.2em;');
    expect(smallTabletBlock).toContain('font-weight: inherit;');
    expect(smallTabletBlock).toContain('color: rgba(255, 255, 255, 0.15);');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip {');
    expect(smallTabletBlock).toContain('justify-content: center;');
    expect(smallTabletBlock).toContain('min-height: 44px;');
    expect(smallTabletBlock).toContain('min-width: 44px;');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip > svg {');
    expect(smallTabletBlock).toContain('opacity: 0.6;');
    expect(smallTabletBlock).not.toContain('.sectionContainer');
    expect(scss).toMatch(/@media only screen and \(min-width:\s*768px\) and \(max-width:\s*1024px\)\s*{[\s\S]*?\.sectionHeader \.sectionHeaderText\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-start;/);
  });

  it('shows groups header actions only while expanded and drives embedded create state from the header', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(screen.queryByRole('button', { name: /^View All$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Create$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(t('sbts')));

    await waitFor(() => {
      expect(screen.getByTestId('sbts-page')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /^View All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create$/i })).toBeInTheDocument();

    const sbtPropsBeforeToggle = mockSBTsPage.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(sbtPropsBeforeToggle[sbtPropsBeforeToggle.length - 1]?.hideMiniActionRow).toBe(true);
    expect(sbtPropsBeforeToggle[sbtPropsBeforeToggle.length - 1]?.showCreateGroupAboveFeatured).toBe(true);
    expect(sbtPropsBeforeToggle[sbtPropsBeforeToggle.length - 1]?.showCreateGroupExternal).toBe(false);
    expect(sbtPropsBeforeToggle[sbtPropsBeforeToggle.length - 1]?.preferCacheBackedFeaturedCards).toBe(true);
    expect(sbtPropsBeforeToggle[sbtPropsBeforeToggle.length - 1]?.sbtScanProgressBySlug).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Exit$/i })).toBeInTheDocument();
    });

    const sbtPropsAfterToggle = mockSBTsPage.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(sbtPropsAfterToggle[sbtPropsAfterToggle.length - 1]?.showCreateGroupAboveFeatured).toBe(true);
    expect(sbtPropsAfterToggle[sbtPropsAfterToggle.length - 1]?.showCreateGroupExternal).toBe(true);
  });

});
