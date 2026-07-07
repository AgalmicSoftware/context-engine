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
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { getPolisDemoQuestionPool } from '../SurveyTool/surveyPolisDemoQuestionPool';
import { writeAgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';

const mockSurveyPage = jest.fn();
const mockPolisReport = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockRiskMatrix = jest.fn();
const mockDebateSelector = jest.fn();
const mockDemoAnalysisWorkspace = jest.fn();
const originalFetch = global.fetch;
const fullCrossCorpusPayload = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../ai-discourse-corpus/corpuses/cross-corpus-debates.json'), 'utf8'),
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

jest.mock('../SurveyTool/SurveyPage.jsx', () => (props) => {
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
  return <div data-testid="sbts-page">{props.showCreateGroupExternal ? 'Create Open' : 'Create Closed'}</div>;
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
            onClick={() =>
              props.onOpenAtlasNode('0x4110000000000000000000000000000000000000000000000000000000000000', {
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
              })
            }
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
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    window.sessionStorage.clear();
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: originalFetch,
    });
  });

  const buildTrustlessProfile = (chainId = 84532) => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = chainId;
    return profile;
  };

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
      sessionModeProfile: buildTrustlessProfile(),
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

  const getAutoMintStorageKey = (account, sbtAddress, chainId = 84532) =>
    `autoMint:${String(account || '').toLowerCase()}:${chainId}:${String(sbtAddress || '').toLowerCase()}`;

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

  it('does not crash when the route hydrates before a network object is available', async () => {
    const { rerender } = render(<OnePageSession {...buildProps()} network={null} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    rerender(<OnePageSession {...buildProps()} network={null} questionResponsesNonce={1} />);

    expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
  });

  it('shows a Telegram-first sign-in prompt instead of the web session UI when unauthenticated', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        sessionConfig={{
          ...buildProps().sessionConfig,
          telegramOnly: true,
          sessionMode: 'telegram_only',
        }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE)).toHaveTextContent(
      /Telegram-first session/i,
    );
    expect(screen.getByTestId('ce-session-telegram-login-open')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-page-pile')).not.toBeInTheDocument();
    expect(mockSurveyPage).not.toHaveBeenCalled();
  });

  it('renders telegram parity surfaces from an exchanged envelope', async () => {
    writeAgentClientLoginEnvelope({
      v: 1,
      sessionSlug: 'edge',
      expiresAt: '2027-07-05T00:00:00.000Z',
      address: '0x3333333333333333333333333333333333333333',
      capabilities: { readQuestions: true, readResults: true, submitAnswers: false },
      credential: { kind: 'session_worker_jwt', token: 'jwt-session-token' },
      agentBridgeUrl: 'https://bridge.example',
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: jest.fn(async (url) => {
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/api/agent/session-meta')) {
          return new Response(
            JSON.stringify({
              ok: true,
              sessionSlug: 'edge',
              telegramOnly: true,
              telegramBridgeEnabled: true,
              clientSubmitReady: true,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (parsed.pathname.endsWith('/api/agent/questions')) {
          return new Response(
            JSON.stringify({
              ok: true,
              questions: [
                {
                  questionId: 'q1',
                  questionType: 'binary',
                  prompt: 'Should the client render Telegram questions?',
                  options: [],
                  tags: ['client'],
                  answeredByUser: false,
                  answerable: true,
                },
              ],
              answerState: { answeredCount: 0, unansweredCount: 1, sort: 'unanswered_first' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (parsed.pathname.endsWith('/api/agent/results')) {
          const view = parsed.searchParams.get('view');
          if (view === 'consensus' || view === 'difference') {
            return new Response(
              JSON.stringify({
                ok: true,
                questions: [
                  {
                    questionId: 'q1',
                    prompt: 'Should the client render Telegram questions?',
                    participants: 3,
                    counts: [
                      { label: 'Agree', count: 2 },
                      { label: 'Disagree', count: 1 },
                    ],
                  },
                ],
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          }
          return new Response(JSON.stringify({ ok: true, counts: { questions: 1 } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: false }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }),
    });

    render(
      <OnePageSession
        {...buildProps()}
        loginComplete={true}
        sessionConfig={{
          ...buildProps().sessionConfig,
          telegramOnly: true,
          sessionMode: 'telegram_only',
        }}
      />,
    );

    expect(await screen.findByTestId('ce-session-telegram-questions')).toHaveTextContent(
      /Should the client render Telegram questions/i,
    );
    expect(await screen.findByTestId('ce-session-telegram-report-approx')).toHaveTextContent(/Approximate report/i);
    expect(await screen.findByTestId('polis-report')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-page-pile')).not.toBeInTheDocument();
  });

  it('derives scoped Chipotle Lit hooks for embedded survey pages from session config', async () => {
    render(
      <OnePageSession
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
      />,
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    const pileProps = mockSurveyPage.mock.calls.find(([props]) => props?.minifiedMode === 'pile')?.[0];

    expect(pileProps?.litHooks).toEqual(
      expect.objectContaining({
        saveKey: expect.any(Function),
        getKey: expect.any(Function),
        litNetwork: 'chipotle',
      }),
    );
  });

  it('uses the title container slot to keep the pile submit rail off the header title', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    const titleHeading = document.getElementById(styles.brandingSectionTitle);
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

  it('limits the pile submit rail title offset to phone widths where the rail is absolute', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const phoneRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (max-width: 480px)',
      '.titleContainerWithPileSubmitRail',
    );
    const desktopRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 769px) and (max-width: 1366px)',
      '.titleContainerWithPileSubmitRail',
    );
    const widescreenRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 1367px)',
      '.titleContainerWithPileSubmitRail',
    );
    const tabletRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 481px) and (max-width: 768px)',
      '.titleContainerWithPileSubmitRail',
    );

    expect(phoneRailBlock).toContain('.titleContainerWithPileSubmitRail');
    expect(phoneRailBlock).toContain('transform: translateY(-44px);');
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

    render(<OnePageSession {...buildProps()} polisDemoDataBySlug={customEdgeData} questionScanProgress={progress} />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });

    const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(polisCalls.length).toBeGreaterThan(0);
    expect(polisCalls[polisCalls.length - 1]?.demoDataBySlug).toBe(customEdgeData);
    expect(polisCalls[polisCalls.length - 1]?.questionScanProgress).toBe(progress);
  });

  it('passes the built-in demo display slug to the embedded report', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        slug="demo"
        questionSessionSlug="demo"
        sessionConfig={{
          ...buildProps().sessionConfig,
          slug: 'demo',
          sessionName: 'Context Engine',
          networkChainId: 11155420,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });

    const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(polisCalls[polisCalls.length - 1]).toEqual(
      expect.objectContaining({
        sessionSlug: 'demo',
        demoDataFirstLoad: true,
      }),
    );
  });

  it('does not pass generated demo Polis responses as live embedded report rows', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        slug="demo"
        questionSessionSlug="demo"
        sessionConfig={{
          ...buildProps().sessionConfig,
          slug: 'demo',
          sessionName: 'Context Engine',
          networkChainId: 11155420,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });

    const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
    const latestReportProps = polisCalls[polisCalls.length - 1] || {};
    const questionResponses = latestReportProps.questionResponses || {};

    expect(latestReportProps).toEqual(
      expect.objectContaining({
        sessionSlug: 'demo',
        demoDataFirstLoad: true,
      }),
    );
    expect(questionResponses).toEqual({});
  });

  it('builds built-in demo live report responses only from the demo source bucket', async () => {
    jest.useFakeTimers();
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo');
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache') return {};
      if (slug === '') {
        return {
          84532: {
            questions: {
              qforeign: {
                id: 'qforeign',
                prompt: 'Foreign default-bucket prompt',
                type: 'binary',
              },
            },
            questionResponses: {
              qforeign: {
                '0xforeign': {
                  type: 'binary',
                  answer: { value: 'yes', encrypted: false },
                },
              },
            },
          },
        };
      }
      if (slug === 'demo') {
        return {
          84532: {
            questions: {
              [demoQuestion.id]: {
                id: demoQuestion.id,
                prompt: 'Live canonical demo prompt',
                type: 'binary',
              },
              qpolluted: {
                id: 'qpolluted',
                prompt: 'Polluted cache prompt without a demo binding',
                type: 'binary',
              },
            },
            questionResponses: {
              [demoQuestion.id]: {
                '0xabc': {
                  type: 'binary',
                  answer: { value: 'yes', encrypted: false },
                },
              },
              qpolluted: {
                '0xpolluted': {
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

    try {
      render(
        <OnePageSession
          {...buildProps()}
          slug="demo"
          questionSessionSlug=""
          isQuestionCacheReady={true}
          network={{ id: 84532, name: 'Base Sepolia' }}
          sessionConfig={{
            ...buildProps().sessionConfig,
            slug: '',
            sessionName: 'Context Engine',
            networkChainId: 84532,
          }}
        />,
      );

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
        const latestReportProps = polisCalls[polisCalls.length - 1] || {};
        expect(latestReportProps).toEqual(
          expect.objectContaining({
            sessionSlug: 'demo',
            demoDataFirstLoad: true,
          }),
        );
        expect(latestReportProps.questionResponses).toEqual({
          [demoQuestion.id]: [
            expect.objectContaining({
              responder: '0xabc',
              questionId: demoQuestion.id,
            }),
          ],
        });
        expect(JSON.stringify(latestReportProps.questionResponses)).not.toContain('qforeign');
        expect(JSON.stringify(latestReportProps.questionResponses)).not.toContain('0xforeign');
        expect(JSON.stringify(latestReportProps.questionResponses)).not.toContain('qpolluted');
        expect(JSON.stringify(latestReportProps.questionResponses)).not.toContain('0xpolluted');
      });
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });

  it('keeps /session/demo report responses wired to the canonical source when the route source is demo', async () => {
    jest.useFakeTimers();
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo');
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();

    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache') return {};
      if (slug === '') {
        return {
          84532: {
            questions: {},
            questionResponses: {},
          },
        };
      }
      if (slug === 'demo') {
        return {
          84532: {
            questions: {},
            questionResponses: {
              [demoQuestion.id]: {
                '0xabc': {
                  type: 'binary',
                  answer: { value: 'yes', encrypted: false },
                },
              },
            },
          },
        };
      }
      return {};
    });

    try {
      render(
        <OnePageSession
          {...buildProps()}
          slug="demo"
          questionSessionSlug="demo"
          isQuestionCacheReady={true}
          network={{ id: 84532, name: 'Base Sepolia' }}
          sessionConfig={{
            ...buildProps().sessionConfig,
            slug: 'demo',
            sessionName: 'Context Engine',
            networkChainId: 84532,
          }}
        />,
      );

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
        const latestReportProps = polisCalls[polisCalls.length - 1] || {};
        expect(latestReportProps.questionResponses).toEqual({
          [demoQuestion.id]: [
            expect.objectContaining({
              responder: '0xabc',
              questionId: demoQuestion.id,
            }),
          ],
        });
      });
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });

  it('uses built-in demo question metadata when live demo responses arrive before cached question metadata', async () => {
    jest.useFakeTimers();
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo');
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();

    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache') return {};
      if (slug === '') {
        return {
          84532: {
            questions: {},
            questionResponses: {},
          },
        };
      }
      if (slug === 'demo') {
        return {
          84532: {
            questions: {},
            questionResponses: {
              [demoQuestion.id]: {
                '0xdef': {
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

    try {
      render(
        <OnePageSession
          {...buildProps()}
          slug="demo"
          questionSessionSlug=""
          isQuestionCacheReady={true}
          network={{ id: 84532, name: 'Base Sepolia' }}
          sessionConfig={{
            ...buildProps().sessionConfig,
            slug: '',
            sessionName: 'Context Engine',
            networkChainId: 84532,
          }}
        />,
      );

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
        const latestReportProps = polisCalls[polisCalls.length - 1] || {};
        expect(latestReportProps.questionResponses).toEqual({
          [demoQuestion.id]: [
            expect.objectContaining({
              responder: '0xdef',
              questionId: demoQuestion.id,
            }),
          ],
        });
      });
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });

  it('builds live demo report responses before question metadata hydration completes', async () => {
    jest.useFakeTimers();
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo');
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();

    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache') return {};
      if (slug === '') {
        return {
          84532: {
            questions: {},
            questionResponses: {},
          },
        };
      }
      if (slug === 'demo') {
        return {
          84532: {
            questions: {},
            questionResponses: {
              [demoQuestion.id]: {
                '0xprehydrate': {
                  type: 'binary',
                  answer: { value: 'yes', encrypted: false },
                },
              },
            },
          },
        };
      }
      return {};
    });

    try {
      render(
        <OnePageSession
          {...buildProps()}
          slug="demo"
          questionSessionSlug="demo"
          isQuestionCacheReady={false}
          isResponsesCacheReady={false}
          questionScanProgress={{
            phase: 'hydrate',
            discoveredQuestions: 42,
            hydratedQuestions: 0,
          }}
          network={{ id: 84532, name: 'Base Sepolia' }}
          sessionConfig={{
            ...buildProps().sessionConfig,
            slug: 'demo',
            sessionName: 'Context Engine',
            networkChainId: 84532,
          }}
        />,
      );

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const polisCalls = mockPolisReport.mock.calls.map((args) => args[0]).filter(Boolean);
        const latestReportProps = polisCalls[polisCalls.length - 1] || {};
        expect(latestReportProps.questionResponses).toEqual({
          [demoQuestion.id]: [
            expect.objectContaining({
              responder: '0xprehydrate',
              questionId: demoQuestion.id,
            }),
          ],
        });
      });
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });

  it('uses shared session-universe discovery when bootstrapping embedded groups', () => {
    const ensureLightSbtUniverse = jest.fn(() => Promise.resolve());
    const subject = createSubject({
      ensureLightSbtUniverse,
      sessionConfig: {
        ...buildProps().sessionConfig,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      },
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
            84532: {
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
            84532: {
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
        <OnePageSession {...buildProps()} isQuestionCacheReady={true} network={{ id: 84532, name: 'Base Sepolia' }} />,
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
    expect(within(fullHeader).getByRole('heading', { name: questionsHeaderName })).toBeInTheDocument();
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

  it('renders the Context header title and View subtitle with the shared section header classes', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        slug="demo"
        sessionConfig={{
          ...buildProps().sessionConfig,
          slug: 'demo',
          sessionName: 'Context Engine',
          networkChainId: 11155420,
        }}
      />,
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    const contextHeader = screen.getByTestId('ce-demo-documents-toggle');
    const contextTitle = within(contextHeader).getByText('Context');
    const contextSubtitle = within(contextHeader).getByText('View');
    const contextTextWrap = contextTitle.closest(`.${styles.sectionHeaderText}`);

    expect(contextTitle).toHaveClass(styles.sectionHeaderTitle);
    expect(contextSubtitle).toHaveClass(styles.sectionHeaderSubtitle);
    expect(contextTextWrap).toBeTruthy();
    expect(contextTextWrap.parentElement).toBe(contextHeader);
  });

  it('keeps section-card headers inline through 767px without pulling full phone layout onto tablets', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const phoneBlock = extractMediaBlock(scss, '@media only screen and (max-width: 600px)', '.onePageDemoContainer');
    const smallTabletBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 601px) and (max-width: 767px)',
      '.sectionHeader {',
    );
    const tabletBlock = extractMediaBlock(
      scss,
      '@media only screen and (min-width: 768px) and (max-width: 1024px)',
      '.onePageDemoContainer',
    );
    const resultsTabletBlock = extractMediaBlock(
      scss,
      '@media only screen and (max-width: 1024px)',
      '.resultsModeActionsScroller',
    );
    const sectionContainerBlock = extractMediaBlock(scss, '.sectionContainer {');
    const sectionHeaderRowBlock = extractMediaBlock(scss, '.sectionHeaderRow {');
    const sectionActionsScrollerBlock = extractMediaBlock(scss, '.sectionHeaderActionsScroller {');
    const miniContentBlock = extractMediaBlock(scss, '.miniSectionContent {');
    const sectionsGridBlock = extractMediaBlock(scss, '.sectionsGrid {');

    expect(sectionContainerBlock).toContain('box-sizing: border-box;');
    expect(sectionContainerBlock).toContain('max-width: 100%;');
    expect(sectionContainerBlock).toContain('min-width: 0;');
    expect(sectionHeaderRowBlock).toContain('max-width: 100%;');
    expect(sectionHeaderRowBlock).toContain('min-width: 0;');
    expect(sectionActionsScrollerBlock).toContain('box-sizing: border-box;');
    expect(sectionActionsScrollerBlock).toContain('max-width: 100%;');
    expect(miniContentBlock).toContain('box-sizing: border-box;');
    expect(miniContentBlock).toContain('max-width: 100%;');
    expect(miniContentBlock).toContain('min-width: 0;');
    expect(miniContentBlock).toContain('overflow-x: auto;');
    expect(sectionsGridBlock).toContain('max-width: 100%;');
    expect(sectionsGridBlock).toContain('min-width: 0;');
    expect(resultsTabletBlock).toContain('.resultsModeActionsScroller {');
    expect(resultsTabletBlock).toContain('max-width: 100%;');
    expect(resultsTabletBlock).toContain('overflow-x: auto;');
    expect(resultsTabletBlock).toContain('overflow-y: hidden;');
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
    expect(phoneBlock).toContain('.documentsSectionHeaderText {');
    expect(phoneBlock).toContain('grid-template-areas:');
    expect(phoneBlock).toContain('"title subtitle"');
    expect(phoneBlock).toContain('"actions actions";');
    expect(phoneBlock).toContain('.documentsSectionHeaderTitleRow {');
    expect(phoneBlock).toContain('display: contents;');
    expect(phoneBlock).toContain('.documentsSectionHeaderMain .sectionToggleIcon {');
    expect(phoneBlock).toContain('margin-right: 0;');
    expect(phoneBlock).toContain('grid-area: actions;');
    expect(phoneBlock).toContain('justify-content: flex-end;');
    expect(phoneBlock).toContain('flex-wrap: wrap;');
    expect(phoneBlock).toContain('box-sizing: border-box;');
    expect(phoneBlock).toContain('padding-right: 10px;');
    expect(phoneBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip {');
    expect(phoneBlock).toContain('justify-content: center;');
    expect(phoneBlock).toContain('min-height: 44px;');
    expect(phoneBlock).toContain('min-width: 44px;');
    expect(phoneBlock).toContain('.pileHeaderRow {');
    expect(phoneBlock).toContain('flex-wrap: nowrap;');
    expect(phoneBlock).toContain('.pileHeaderTitleWrap {');
    expect(phoneBlock).toContain('width: auto;');
    expect(phoneBlock).toContain('font-size: clamp(1.25rem, 4.7vw, 1.55rem);');
    expect(smallTabletBlock).toContain('.sectionHeader {');
    expect(smallTabletBlock).toContain('font-size: 1.6em;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderText {');
    expect(smallTabletBlock).toContain('flex-direction: row;');
    expect(smallTabletBlock).toContain('align-items: baseline;');
    expect(smallTabletBlock).toContain('gap: 6px 12px;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderSubtitle {');
    expect(smallTabletBlock).toContain('font-size: 1.2em;');
    expect(smallTabletBlock).toContain('font-weight: inherit;');
    expect(smallTabletBlock).toContain('color: rgba(255, 255, 255, 0.15);');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderText {');
    expect(smallTabletBlock).toContain('grid-template-areas:');
    expect(smallTabletBlock).toContain('"title subtitle"');
    expect(smallTabletBlock).toContain('"actions actions";');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderTitleRow {');
    expect(smallTabletBlock).toContain('display: contents;');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderMain .sectionToggleIcon {');
    expect(smallTabletBlock).toContain('margin-right: 0;');
    expect(smallTabletBlock).toContain('grid-area: actions;');
    expect(smallTabletBlock).toContain('justify-content: flex-end;');
    expect(smallTabletBlock).toContain('flex-wrap: wrap;');
    expect(smallTabletBlock).toContain('box-sizing: border-box;');
    expect(smallTabletBlock).toContain('padding-right: 10px;');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip {');
    expect(smallTabletBlock).toContain('justify-content: center;');
    expect(smallTabletBlock).toContain('min-height: 44px;');
    expect(smallTabletBlock).toContain('min-width: 44px;');
    expect(smallTabletBlock).toContain('.documentsSectionHeaderMeta .sectionHeaderTooltip > svg {');
    expect(smallTabletBlock).toContain('opacity: 0.6;');
    expect(smallTabletBlock).toContain('.pileHeaderRow {');
    expect(smallTabletBlock).toContain('flex-wrap: nowrap;');
    expect(smallTabletBlock).toContain('.pileHeaderTitleWrap {');
    expect(smallTabletBlock).toContain('width: auto;');
    expect(smallTabletBlock).toContain('font-size: clamp(1.35rem, 4.2vw, 1.75rem);');
    expect(smallTabletBlock).not.toContain('.sectionContainer');
    expect(tabletBlock).toContain('.pileHeaderRow {');
    expect(tabletBlock).toContain('flex-wrap: nowrap;');
    expect(tabletBlock).toContain('.pileHeaderTitleWrap {');
    expect(tabletBlock).toContain('width: auto;');
    expect(tabletBlock).toContain('font-size: clamp(1.4rem, 3.2vw, 1.9rem);');
    expect(scss).toMatch(
      /@media only screen and \(min-width:\s*768px\) and \(max-width:\s*1024px\)\s*{[\s\S]*?\.sectionHeader \.sectionHeaderText\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-start;/,
    );
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

  it('passes the canonical Polis demo questions to both /session/demo question surfaces', async () => {
    const demoSessionConfig = {
      ...buildProps().sessionConfig,
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
    };

    const { rerender } = render(
      <OnePageSession {...buildProps()} slug="demo" questionSessionSlug="" sessionConfig={demoSessionConfig} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });

    const pileProps = mockSurveyPage.mock.calls
      .map((args) => args[0])
      .filter((props) => props?.minifiedMode === 'pile')
      .pop();
    expect(pileProps?.sessionSlug).toBe('demo');
    expect(pileProps?.questionPool).toHaveLength(42);
    expect(pileProps?.questionPool?.[0]).toEqual(
      expect.objectContaining({
        source: 'demo-polis-data',
        sessionSlug: 'demo',
        sessionSlugExplicit: true,
      }),
    );

    rerender(
      <OnePageSession
        {...buildProps()}
        slug="demo"
        questionSessionSlug=""
        routeQuestionsOpen={true}
        sessionConfig={demoSessionConfig}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
    });

    const fullProps = mockSurveyPage.mock.calls
      .map((args) => args[0])
      .filter((props) => props?.miniMode === true)
      .pop();
    expect(fullProps?.sessionSlug).toBe('demo');
    expect(fullProps?.questionPool).toHaveLength(42);
  });

  it('uses the display slug for embedded groups on the built-in demo route', async () => {
    const demoSessionConfig = {
      ...buildProps().sessionConfig,
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
    };
    render(<OnePageSession {...buildProps()} slug="demo" questionSessionSlug="" sessionConfig={demoSessionConfig} />);

    fireEvent.click(screen.getByText(t('sbts')));

    await waitFor(() => {
      expect(screen.getByTestId('sbts-page')).toBeInTheDocument();
    });

    const latestSbtProps = mockSBTsPage.mock.calls
      .map((args) => args[0])
      .filter(Boolean)
      .pop();
    expect(latestSbtProps?.sessionSlug).toBe('demo');
    expect(latestSbtProps?.requireExplicitAutoFeatureSessionSlug).toBe(true);
    expect(latestSbtProps?.sessionConfig).toEqual(
      expect.objectContaining({
        slug: 'demo',
      }),
    );
    expect(latestSbtProps?.sessionConfig?.autoFeatureSBTsBySessionSlug).not.toBe(true);
  });

  it('preserves demo-1 embedded groups featured list and auto-feature policy', async () => {
    const featuredSbt = '0x29563ff3aCC8AFb220D810F8022218095e25C1f6';
    const demoSessionConfig = {
      ...buildProps().sessionConfig,
      slug: 'demo-1',
      sessionName: 'Demo Session',
      networkChainId: 11155420,
      defaultFeaturedSBTs: [featuredSbt],
      autoFeatureSBTsBySessionSlug: false,
    };

    render(
      <OnePageSession
        {...buildProps()}
        slug="demo-1"
        questionSessionSlug="demo-1"
        defaultFeaturedSBTs={[featuredSbt]}
        sessionConfig={demoSessionConfig}
      />,
    );

    fireEvent.click(screen.getByText(t('sbts')));

    await waitFor(() => {
      expect(screen.getByTestId('sbts-page')).toBeInTheDocument();
    });

    const latestSbtProps = mockSBTsPage.mock.calls
      .map((args) => args[0])
      .filter(Boolean)
      .pop();
    expect(latestSbtProps?.sessionSlug).toBe('demo-1');
    expect(latestSbtProps?.defaultFeaturedSBTs).toEqual([featuredSbt]);
    expect(latestSbtProps?.requireExplicitAutoFeatureSessionSlug).toBe(true);
    expect(latestSbtProps?.sessionConfig).toEqual(
      expect.objectContaining({
        slug: 'demo-1',
        autoFeatureSBTsBySessionSlug: false,
      }),
    );
  });

  it('keeps /session/demo on the canonical fixture when routed source slug is demo', async () => {
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo');
    const demoSessionConfig = {
      ...buildProps().sessionConfig,
      slug: 'demo',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
    };

    try {
      render(
        <OnePageSession {...buildProps()} slug="demo" questionSessionSlug="demo" sessionConfig={demoSessionConfig} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });

      const pileProps = mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((props) => props?.minifiedMode === 'pile')
        .pop();
      expect(pileProps?.sessionSlug).toBe('demo');
      expect(pileProps?.questionPool).toHaveLength(42);

      fireEvent.click(screen.getByText(t('sbts')));

      await waitFor(() => {
        expect(screen.getByTestId('sbts-page')).toBeInTheDocument();
      });

      const latestSbtProps = mockSBTsPage.mock.calls
        .map((args) => args[0])
        .filter(Boolean)
        .pop();
      expect(latestSbtProps?.sessionSlug).toBe('demo');
      expect(latestSbtProps?.requireExplicitAutoFeatureSessionSlug).toBe(true);
      expect(latestSbtProps?.sessionConfig).toEqual(
        expect.objectContaining({
          slug: 'demo',
          autoFeatureSBTsBySessionSlug: false,
        }),
      );
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });

  it('passes canonical Polis demo questions to direct /session/demo/questions route renders', async () => {
    const priorUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/session/demo/questions');
    const demoSessionConfig = {
      ...buildProps().sessionConfig,
      slug: 'demo',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
    };

    try {
      render(
        <OnePageSession
          {...buildProps()}
          slug="demo"
          questionSessionSlug="demo"
          routeQuestionsOpen={true}
          sessionConfig={demoSessionConfig}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
      });

      const fullProps = mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((props) => props?.miniMode === true)
        .pop();
      expect(fullProps?.sessionSlug).toBe('demo');
      expect(fullProps?.questionPool).toHaveLength(42);
      expect(fullProps?.questionPool?.[0]).toEqual(
        expect.objectContaining({
          source: 'demo-polis-data',
          sessionSlug: 'demo',
          sessionSlugExplicit: true,
        }),
      );
    } finally {
      window.history.replaceState({}, '', priorUrl || '/');
    }
  });
});
