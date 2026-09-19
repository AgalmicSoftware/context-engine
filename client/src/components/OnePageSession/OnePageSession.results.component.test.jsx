/** @file OnePageSession.component.test.jsx */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ethers } from 'ethers';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import OnePageSession from './OnePageSession';
import OnePageSessionStandardShell, { DEFAULT_CORPUS_VIEWER_LOAD_STATE } from './OnePageSessionStandardShell';
import styles from './OnePageSession.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';

const mockSurveyPage = jest.fn();
const mockPolisReport = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockRiskMatrix = jest.fn();
const mockDemoAnalysisWorkspace = jest.fn();
const mockCorpusViewer = jest.fn();
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
jest.mock('../SessionResults/SessionGeneratedResultsViews', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid="session-generated-results-view">
      Generated {props.selectedView} for {props.sessionSlug}
    </div>
  ),
}));
jest.mock('../DemoViews/CorpusViewer', () => {
  const React = require('react');
  const fullCorpusUrl =
    'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ai-discourse-corpus/corpuses/cross-corpus-debates.json';

  function MockCorpusViewer({ externalLoadRequestNonce, onAtlasIssueOpen, onExternalLoadStateChange }) {
    mockCorpusViewer({ externalLoadRequestNonce, onAtlasIssueOpen, onExternalLoadStateChange });
    React.useEffect(() => {
      let cancelled = false;
      if (Number(externalLoadRequestNonce || 0) <= 0) return undefined;

      const loadCorpus = async () => {
        onExternalLoadStateChange?.({
          activeCorpusKey: 'cross_corpus',
          activeCorpusLabel: 'Cross-Corpus',
          loadStatus: 'loading',
          loadButtonLabel: 'Loading full corpus...',
          disableLoadButton: true,
          error: '',
        });
        const response = await global.fetch(fullCorpusUrl, { cache: 'no-store' });
        if (response?.json) await response.json();
        if (!cancelled) {
          onExternalLoadStateChange?.({
            activeCorpusKey: 'cross_corpus',
            activeCorpusLabel: 'Cross-Corpus',
            loadStatus: 'loaded',
            loadButtonLabel: 'Full corpus loaded',
            disableLoadButton: true,
            error: '',
          });
        }
      };

      loadCorpus();
      return () => {
        cancelled = true;
      };
    }, [externalLoadRequestNonce, onExternalLoadStateChange]);

    return React.createElement(
      'div',
      { 'data-testid': 'corpus-viewer' },
      React.createElement('button', { type: 'button' }, 'Tweets'),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onAtlasIssueOpen?.('0x2110000000000000000000000000000000000000000000000000000000000000'),
        },
        'Exponential Progress Debate',
      ),
    );
  }

  return {
    __esModule: true,
    default: MockCorpusViewer,
  };
});
describe('OnePageSession results routing', () => {
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

  const getAutoMintStorageKey = (account, sbtAddress, chainId = 84532) =>
    `autoMint:${String(account || '').toLowerCase()}:${chainId}:${String(sbtAddress || '').toLowerCase()}`;

  it('shows the demo Documents tooltip copy only when the section is expanded', async () => {
    const props = buildProps();
    const documentsTooltipText =
      'Allows the conversation to be enriched by data, and the formats can change per-session';

    render(<OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />);

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.queryByText(documentsTooltipText)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-demo-documents-toggle'));

    expect(screen.getByText(documentsTooltipText)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/tree/main/ai-discourse-corpus',
    );
    expect(screen.getByTestId('ce-demo-documents-load-full-corpus')).toHaveTextContent('Load full corpus');
  });

  it('renders the full corpus loader beside the GitHub link and drives the embedded corpus viewer from the header', async () => {
    const props = buildProps();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => fullCrossCorpusPayload,
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-demo-documents-toggle'));

    const githubLink = screen.getByRole('link', { name: 'GitHub' });
    const loadButton = screen.getByTestId('ce-demo-documents-load-full-corpus');

    expect(loadButton).toHaveTextContent('Load full corpus');
    expect(loadButton.parentElement).toBe(githubLink.parentElement);

    await act(async () => {
      fireEvent.click(loadButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ai-discourse-corpus/corpuses/cross-corpus-debates.json',
        { cache: 'no-store' },
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ce-demo-documents-load-full-corpus')).toHaveTextContent('Full corpus loaded');
    });

    expect(screen.getByTestId('ce-demo-documents-load-full-corpus')).toBeDisabled();
  });

  it('re-triggers auto-open on repeated Raw Results clicks, stays closed after one close, and resets URL on close', async () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollSpy = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    const priorUrl = window.location.href;
    window.history.pushState({}, '', '/session/edge');

    const getFullCalls = () =>
      mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile');

    try {
      render(<OnePageSession {...buildProps()} />);
      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      fireEvent.click(screen.getByRole('button', { name: /Raw Results/i }));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
      });

      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(window.location.pathname).toBe('/session/edge/questions/results');
      expect(window.location.search).toBe('?session=edge');
      expect(
        getFullCalls()
          .slice(-2)
          .map((props) => props.autoOpenResults),
      ).toEqual([false, true]);

      act(() => {
        const latestProps = getFullCalls()[getFullCalls().length - 1];
        latestProps.onResultsModalClose();
      });
      await waitFor(() => {
        expect(getFullCalls()[getFullCalls().length - 1]?.autoOpenResults).toBe(false);
      });
      const callCountAfterClose = getFullCalls().length;
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(getFullCalls()).toHaveLength(callCountAfterClose);
      expect(getFullCalls()[callCountAfterClose - 1]?.autoOpenResults).toBe(false);
      expect(window.location.pathname).toBe('/session/edge');

      fireEvent.click(screen.getByRole('button', { name: /Raw Results/i }));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(
        getFullCalls()
          .slice(-2)
          .map((props) => props.autoOpenResults),
      ).toEqual([false, true]);
      expect(window.location.pathname).toBe('/session/edge/questions/results');
      expect(window.location.search).toBe('?session=edge');
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('preserves worker session context through results open and close under PUBLIC_URL subpaths', async () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    const priorUrl = window.location.href;
    const priorPublicUrl = process.env.PUBLIC_URL;
    const workerSessionSearch = '?worker=https%3A%2F%2Fworker.example.test&session=edge';
    // '/ce/' is our synthetic subpath fixture for the dormant-but-supported
    // PUBLIC_URL mode; root deployment remains the default today.
    process.env.PUBLIC_URL = '/ce/';

    const getFullCalls = () =>
      mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile');

    try {
      window.history.replaceState({}, '', `/ce/session/edge${workerSessionSearch}#responses`);
      render(<OnePageSession {...buildProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      fireEvent.click(screen.getByRole('button', { name: /Raw Results/i }));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/ce/session/edge/questions/results');
      expect(window.location.search).toBe(workerSessionSearch);
      expect(window.location.hash).toBe('#responses');

      act(() => {
        const latestProps = getFullCalls()[getFullCalls().length - 1];
        latestProps.onResultsModalClose();
      });

      await waitFor(() => {
        expect(getFullCalls()[getFullCalls().length - 1]?.autoOpenResults).toBe(false);
      });
      expect(window.location.pathname).toBe('/ce/session/edge');
      expect(window.location.search).toBe(workerSessionSearch);
      expect(window.location.hash).toBe('#responses');
    } finally {
      process.env.PUBLIC_URL = priorPublicUrl;
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('canonicalizes reserved session aliases when opening full results', async () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    const priorUrl = window.location.href;

    const openFullResults = async (extraProps = {}) => {
      const mergedProps = buildProps();
      const sessionSlug = extraProps.sessionSlug;
      const sessionConfig = extraProps.sessionConfig || {
        ...mergedProps.sessionConfig,
        ...(sessionSlug != null ? { slug: sessionSlug } : {}),
      };
      const view = render(<OnePageSession {...mergedProps} {...extraProps} sessionConfig={sessionConfig} />);

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      fireEvent.click(screen.getByRole('button', { name: /Raw Results/i }));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-full')).toBeInTheDocument();
      });

      return view;
    };

    try {
      window.history.replaceState({}, '', '/');
      const debateView = await openFullResults({ sessionSlug: 'DEBATE' });
      expect(window.location.pathname).toBe('/session/DEBATE/questions/results');
      expect(window.location.search).toBe('?session=DEBATE');
      debateView.unmount();

      mockSurveyPage.mockClear();
      window.history.replaceState({}, '', '/');
      const generalView = await openFullResults({ sessionSlug: 'general' });
      expect(window.location.pathname).toBe('/questions/results');
      expect(window.location.search).toBe('');
      generalView.unmount();
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('canonicalizes reserved session aliases when resetting the results fallback URL', () => {
    const priorUrl = window.location.href;

    const buildSubject = (sessionSlug) => {
      const baseProps = buildProps();
      const subject = new OnePageSession({
        ...baseProps,
        sessionSlug,
        activeSessionSlug: sessionSlug,
        sessionConfig: {
          ...baseProps.sessionConfig,
          slug: sessionSlug,
        },
      });
      subject.hasAutoMintIntent = jest.fn(() => false);
      subject.recordOriginalURL = jest.fn();
      subject.originalURL = '';
      subject.state = {
        ...subject.state,
        mintSuccess: false,
      };
      return subject;
    };

    try {
      window.history.replaceState({}, '', '/questions/results?session=stale');

      const debateSubject = buildSubject('DEBATE');
      debateSubject.resetDemoURL();
      expect(window.location.pathname).toBe('/session/DEBATE');
      expect(window.location.search).toBe('?session=DEBATE');

      window.history.replaceState({}, '', '/questions/results?session=stale');

      const generalSubject = buildSubject('general');
      generalSubject.resetDemoURL();
      expect(window.location.pathname).toBe('/session');
      expect(window.location.search).toBe('');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('opens the questions view and auto-opens results when the session route is /questions/results', async () => {
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/edge/questions/results?session=edge');
      render(<OnePageSession {...buildProps()} routeQuestionsOpen={true} routeAutoOpenResults={true} />);

      expect(await screen.findByTestId('survey-page-full')).toBeInTheDocument();
      const fullCalls = mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile');
      expect(fullCalls.length).toBeGreaterThan(0);
      expect(fullCalls[fullCalls.length - 1]?.autoOpenResults).toBe(true);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('closes the route-opened questions/results view when navigation returns to the base session route', async () => {
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/edge/questions/results?session=edge');
      const view = render(<OnePageSession {...buildProps()} routeQuestionsOpen={true} routeAutoOpenResults={true} />);

      expect(await screen.findByTestId('survey-page-full')).toBeInTheDocument();

      window.history.replaceState({}, '', '/session/edge?session=edge');
      view.rerender(<OnePageSession {...buildProps()} routeQuestionsOpen={false} routeAutoOpenResults={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('survey-page-full')).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });



  it('does not show generated AI controls until an explicit plausible-admin check', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        account="0xnotadmin"
        loginComplete={true}
        sessionConfig={{
          ...buildProps().sessionConfig,
          adminAddress: '0xadmin',
          corsWorkerUrl: 'https://worker.example',
          resultsAnalysis: {
            version: 1,
            generationMode: 'manual',
            views: { circles: true, breakdown: true, riskMatrix: true },
            autoAfter: { threshold: 10, unit: 'distinctParticipants' },
            inputScope: 'submitted',
            publication: 'latest_success_visible',
          },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    expect(screen.queryByTestId('ce-session-generated-results-check')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-generated-results-generate')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Report$/i })).toBeInTheDocument();
  });


  it('shows real generated artifacts ahead of seeded demo result fixtures for demo-interview-3', async () => {
    const props = buildProps();
    const demoSessionId = `0x${'2'.repeat(32)}`;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionSlug: 'demo-interview-3',
        sessionId: demoSessionId,
        settings: {
          version: 1,
          generationMode: 'manual',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        artifact: {
          kind: 'ce_session_results_analysis_artifact',
          source: 'ai-generated',
          version: 1,
          generatedAt: '2026-09-19T10:00:00.000Z',
          inputSignature: 'synthetic-demo-real-artifact',
          participants: [],
          sections: {
            argumentMap: { available: true, debates: [] },
            atlas: { available: true, nodes: [], edges: [] },
            breakdown: { available: true, summary: { overview: 'Generated demo artifact' }, dimensions: [], groups: [] },
            riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
          },
        },
        snapshot: { questions: [], responses: [] },
        source: { responseCount: 2, participantCount: 2 },
      }),
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(
      <MemoryRouter initialEntries={['/session/demo-interview-3']}>
        <OnePageSession
          {...props}
          slug="demo-interview-3"
          sessionConfig={{
            ...props.sessionConfig,
            slug: 'demo-interview-3',
            sessionId: demoSessionId,
            corsWorkerUrl: 'https://worker.example',
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
            storageProfile: {
              backend: 'cloudflare',
              resources: { questions: 'active', surveys: 'active', responses: 'active' },
            },
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://worker.example/results-analysis/artifact?'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Circles$/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /^Debate Map$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Breakdown$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Circles$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('session-generated-results-view')).toHaveTextContent('Generated circles for demo-interview-3');
    });
    expect(screen.queryByTestId('ai-policy-atlas')).not.toBeInTheDocument();
  });

  it('offers only the explicit generated AI status check for a plausible admin hint', async () => {
    render(
      <OnePageSession
        {...buildProps()}
        account="0xabc"
        loginComplete={true}
        sessionConfig={{
          ...buildProps().sessionConfig,
          adminAddress: '0xAbC',
          corsWorkerUrl: 'https://worker.example',
          resultsAnalysis: {
            version: 1,
            generationMode: 'manual',
            views: { circles: true, breakdown: true, riskMatrix: true },
            autoAfter: { threshold: 10, unit: 'distinctParticipants' },
            inputScope: 'submitted',
            publication: 'latest_success_visible',
          },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    expect(screen.getByTestId('ce-session-generated-results-check')).toHaveTextContent('Check AI Views');
    expect(screen.queryByTestId('ce-session-generated-results-generate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Circles$/i })).not.toBeInTheDocument();
  });



  it('invokes anonymous generated-results recheck with the rendered session host bound', async () => {
    let callbackThis = null;
    const loadSpy = jest
      .spyOn(OnePageSession.prototype, 'loadGeneratedResultsArtifact')
      .mockImplementation(function mockLoadGeneratedResultsArtifact() {
        callbackThis = this;
        return Promise.resolve();
      });
    const sessionRef = React.createRef();
    render(<OnePageSession {...buildProps()} ref={sessionRef} />);

    act(() => {
      sessionRef.current.setState({
        showResults: true,
        generatedResultsAnalysis: {
          adminAuthorized: false,
          viewerAuthorized: true,
          artifact: null,
          canCheckStatus: true,
          canGenerate: false,
          isRunning: false,
          status: 'ready',
          statusLabel: 'Generated AI views are still being prepared. Check again for the latest status.',
          viewOptions: [],
        },
      });
    });
    loadSpy.mockClear();
    callbackThis = null;

    fireEvent.click(screen.getByTestId('ce-session-generated-results-check'));

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(callbackThis).toBe(sessionRef.current);
  });



  it('shows a Retry action for automatic-only generated analysis failures and a Recheck action after polling expires', async () => {
    const baseGeneratedState = {
      adminAuthorized: true,
      viewerAuthorized: true,
      artifact: null,
      viewOptions: [],
      status: 'ready',
      statusLabel: 'No generated view yet.',
    };
    const authorize = jest.fn();
    const check = jest.fn();
    const generate = jest.fn();
    const shellProps = {
      account: '0xabc',
      aggregatorData: {},
      autoMintCountdown: null,
      autoMintingMode: false,
      autoMintStatuses: [],
      autoMintTargets: [],
      autoOpenResults: false,
      blockLimits: {},
      cacheHasLoaded: true,
      contracts: {},
      corpusViewerLoadRequestNonce: 0,
      corpusViewerLoadState: DEFAULT_CORPUS_VIEWER_LOAD_STATE,
      defaultFeaturedSBTs: [],
      defaultFilterState: {},
      defaultSbtTags: [],
      defaultTags: [],
      disclaimersActive: false,
      displaySessionSlug: 'edge',
      dismissedLoginBanner: false,
      dismissedStatusItems: {},
      effectiveSlug: 'edge',
      embeddedAtlasNodeId: null,
      embeddedAtlasReturnState: null,
      embeddedGroupsSessionConfig: {},
      embeddedGroupsSessionSlug: 'edge',
      embeddedQuestionSessionSlug: 'edge',
      expandedImages: {},
      filterState: {},
      generatedResultsAnalysis: {
        ...baseGeneratedState,
        canGenerate: true,
        generationMode: 'automatic',
        lastFailure: 'Provider failed.',
      },
      generatedResultsAuthAvailable: true,
      isDemoSlug: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
      litHooks: {},
      loginComplete: true,
      needsLoginForAutoMint: false,
      network: {},
      networkChainId: 11155420,
      pileSubmitRailVisible: false,
      provider: {},
      questionPool: [],
      questionResponsesNonce: 1,
      questionScanProgress: null,
      questionsSectionRef: React.createRef(),
      refreshQuestionMetadata: jest.fn(),
      refreshQuestionResponses: jest.fn(),
      refreshSbtData: jest.fn(),
      refreshSurveyResponsesByID: jest.fn(),
      resolvedPolisDemoDataBySlug: {},
      resolvedSessionConfig: {},
      resultsViewMode: 'polis',
      riskMatrixRestoreState: null,
      sbtCacheRevision: 1,
      sbtImages: {},
      sbtNames: {},
      sbtRealtimeCoverageBySlug: {},
      sbtScanProgressBySlug: {},
      sessionHeader: '',
      sessionInfo: '',
      sessionName: 'Edge',
      sharedQuestionPool: [],
      showDocuments: false,
      showEmbeddedCreateGroup: false,
      showGroups: false,
      showQuestions: false,
      showResults: true,
      slug: 'edge',
      titleText: 'edge',
      toggleLoginModal: jest.fn(),
      onCancelAutoMintCountdown: jest.fn(),
      onCorpusAtlasIssueOpen: jest.fn(),
      onCorpusViewerLoadStateChange: jest.fn(),
      onDismissLoginBanner: jest.fn(),
      onDismissStatusItem: jest.fn(),
      onEmbeddedAtlasModalClose: jest.fn(),
      onFilterChange: jest.fn(),
      onGroupsViewAll: jest.fn(),
      onGeneratedResultsAuthorize: authorize,
      onGeneratedResultsCheck: check,
      onGeneratedResultsGenerate: generate,
      onKickoffAutoMintIfNeeded: jest.fn(),
      onLoadFullCorpusClick: jest.fn(),
      onOpenResults: jest.fn(),
      onPileSubmitRailVisibilityChange: jest.fn(),
      onResultsModalClose: jest.fn(),
      onResultsModeChange: jest.fn(),
      onRiskMatrixRestoreApplied: jest.fn(),
      onToggleDocuments: jest.fn(),
      onToggleEmbeddedCreateGroup: jest.fn(),
      onToggleGroups: jest.fn(),
      onToggleQuestions: jest.fn(),
      onToggleResults: jest.fn(),
      onToggleStatusImagePreview: jest.fn(),
      onViewAllQuestionsClick: jest.fn(),
    };

    const view = render(<OnePageSessionStandardShell {...shellProps} />);
    fireEvent.click(screen.getByTestId('ce-session-generated-results-generate'));
    expect(screen.getByTestId('ce-session-generated-results-generate')).toHaveTextContent('Retry AI Views');
    expect(generate).toHaveBeenCalledWith(true);

    view.rerender(
      <OnePageSessionStandardShell
        {...shellProps}
        generatedResultsAnalysis={{
          ...baseGeneratedState,
          canCheckStatus: true,
          canGenerate: false,
          lastFailure: '',
          statusLabel: 'Generated AI views are still being prepared. Check again for the latest status.',
        }}
      />,
    );

    expect(screen.queryByTestId('ce-session-generated-results-generate')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-session-generated-results-check')).toHaveTextContent('Recheck AI Views');
    fireEvent.click(screen.getByTestId('ce-session-generated-results-check'));
    expect(check).toHaveBeenCalledTimes(1);
    expect(authorize).not.toHaveBeenCalled();


    view.rerender(
      <OnePageSessionStandardShell
        {...shellProps}
        generatedResultsAuthAvailable={false}
        generatedResultsAnalysis={{
          ...baseGeneratedState,
          adminAuthorized: false,
          viewerAuthorized: true,
          canCheckStatus: true,
          canGenerate: false,
          lastFailure: '',
          statusLabel: 'Generated AI views are still being prepared. Check again for the latest status.',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('ce-session-generated-results-check'));
    expect(check).toHaveBeenCalledTimes(2);
    expect(authorize).not.toHaveBeenCalled();
  });
  it('renders the Raw Results action only while results are expanded and styles it like the other demo mode buttons', async () => {
    render(<OnePageSession {...buildProps()} />);

    expect(screen.queryByRole('button', { name: /Raw Results/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Raw Results/i })).toBeInTheDocument();
    });

    const rawResultsButton = screen.getByRole('button', { name: /Raw Results/i });
    const resultsActionStrip = rawResultsButton.parentElement;
    expect(rawResultsButton).toHaveClass(styles.sectionHeaderViewModeButton);
    expect(rawResultsButton).not.toHaveClass(styles.sectionHeaderActionButton);
    expect(resultsActionStrip).toHaveClass(styles.resultsModeActions);
    expect(resultsActionStrip.parentElement).toHaveClass(styles.resultsModeActionsScroller);
    expect(screen.getByTestId('polis-report')).toBeInTheDocument();
  });

  it('keeps selected results mode button glow inside a contained scroller gutter', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const tabletResultsBlock = extractMediaBlock(
      scss,
      '@media only screen and (max-width: 1024px)',
      '.resultsModeActionsScroller',
    );

    expect(scss).toMatch(/\.resultsModeActionsScroller\s*{[\s\S]*?padding-block:\s*6px;[\s\S]*?margin-block:\s*-6px;/);
    expect(tabletResultsBlock).toContain('.resultsModeActionsScroller');
    expect(tabletResultsBlock).toContain('max-width: 100%;');
    expect(tabletResultsBlock).toContain('overflow-x: auto;');
    expect(tabletResultsBlock).toContain('overflow-y: hidden;');
    expect(tabletResultsBlock).toContain('padding: 6px 10px;');
  });


  it('renders generated Risk Matrix instead of seeded demo RiskMatrix when a demo artifact provides it', async () => {
    const props = buildProps();
    const demoSessionId = `0x${'3'.repeat(32)}`;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionSlug: 'demo-interview-3',
        sessionId: demoSessionId,
        settings: {
          version: 1,
          generationMode: 'manual',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        artifact: {
          kind: 'ce_session_results_analysis_artifact',
          source: 'ai-generated',
          version: 1,
          sections: {
            argumentMap: { available: true, debates: [] },
            atlas: { available: true, nodes: [], edges: [] },
            breakdown: { available: true, summary: { overview: 'Generated demo artifact' }, dimensions: [], groups: [] },
            riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
          },
        },
        snapshot: { questions: [], responses: [] },
        source: { responseCount: 2, participantCount: 2 },
      }),
    });
    Object.defineProperty(global, 'fetch', { writable: true, value: fetchMock });

    render(
      <MemoryRouter initialEntries={['/session/demo-interview-3']}>
        <OnePageSession
          {...props}
          slug="demo-interview-3"
          sessionConfig={{
            ...props.sessionConfig,
            slug: 'demo-interview-3',
            sessionId: demoSessionId,
            corsWorkerUrl: 'https://worker.example',
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
            storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active', responses: 'active' } },
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    await screen.findByRole('button', { name: /^Risk Matrix$/i });
    fireEvent.click(screen.getByRole('button', { name: /^Risk Matrix$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('session-generated-results-view')).toHaveTextContent('Generated riskMatrix for demo-interview-3');
    });
    expect(screen.queryByTestId('risk-matrix-view')).not.toBeInTheDocument();
  });

  it('renders the shared risk matrix view in embedded mode for demo results', async () => {
    const props = buildProps();

    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Risk Matrix/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Risk Matrix/i }));

    await waitFor(() => {
      expect(screen.getByTestId('risk-matrix-view')).toBeInTheDocument();
    });

    const riskMatrixCalls = mockRiskMatrix.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(riskMatrixCalls.length).toBeGreaterThan(0);
    expect(riskMatrixCalls[riskMatrixCalls.length - 1]).toMatchObject({
      embedded: true,
      onOpenAtlasNode: expect.any(Function),
      onRestoreApplied: expect.any(Function),
    });
  });

  it('opens linked atlas nodes from the embedded risk matrix and returns to risk matrix when the atlas modal closes', async () => {
    const props = buildProps();

    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Risk Matrix/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Risk Matrix/i }));

    await waitFor(() => {
      expect(screen.getByTestId('risk-matrix-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('risk-matrix-open-atlas-node'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-policy-atlas')).toBeInTheDocument();
    });

    const atlasCalls = mockDebateMap.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(atlasCalls[atlasCalls.length - 1]).toMatchObject({
      embedded: true,
      requestedModalNodeId: '0x4110000000000000000000000000000000000000000000000000000000000000',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close Atlas Modal' }));

    await waitFor(() => {
      expect(screen.getByTestId('risk-matrix-view')).toBeInTheDocument();
    });

    const riskMatrixCalls = mockRiskMatrix.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(
      riskMatrixCalls.some(
        (props) =>
          props?.restoreState?.modal === true &&
          props?.restoreState?.selectedCellId === 'Capabilities_vs_Labor' &&
          props?.restoreState?.comment === 'Return here after checking the atlas node.',
      ),
    ).toBe(true);
    expect(screen.queryByTestId('ai-policy-atlas')).not.toBeInTheDocument();
  });

  it('restores the one-page session view after closing an atlas node opened from Context', async () => {
    const props = buildProps();

    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-demo-documents-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    const atlasIssueButtons = await screen.findAllByRole('button', { name: 'Exponential Progress Debate' });
    fireEvent.click(atlasIssueButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('ai-policy-atlas')).toBeInTheDocument();
    });

    const atlasCalls = mockDebateMap.mock.calls.map((args) => args[0]).filter(Boolean);
    expect(atlasCalls[atlasCalls.length - 1]).toMatchObject({
      embedded: true,
      requestedModalNodeId: '0x2110000000000000000000000000000000000000000000000000000000000000',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close Atlas Modal' }));

    await waitFor(() => {
      expect(screen.queryByTestId('ai-policy-atlas')).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: 'Exponential Progress Debate' }).length).toBeGreaterThan(0);
  });

  it('shows the Breakdown results mode for configured demo sessions', async () => {
    const baseProps = buildProps();

    const nonDemoView = render(<OnePageSession {...baseProps} />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^Breakdown$/i })).not.toBeInTheDocument();

    nonDemoView.unmount();
    jest.clearAllMocks();

    render(
      <OnePageSession {...baseProps} slug="demo-1" sessionConfig={{ ...baseProps.sessionConfig, slug: 'demo-1' }} />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Breakdown$/i })).toBeInTheDocument();
    });
  });

  it('hides Breakdown for demo-2 and falls back to Report when a stale analysis mode carries over', async () => {
    const props = buildProps();
    const view = render(
      <OnePageSession {...props} slug="demo-sh" sessionConfig={{ ...props.sessionConfig, slug: 'demo-sh' }} />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: /^Breakdown$/i }));
    expect(await screen.findByTestId('demo-analysis-workspace-view')).toBeInTheDocument();

    view.rerender(
      <OnePageSession {...props} slug="demo-2" sessionConfig={{ ...props.sessionConfig, slug: 'demo-2' }} />,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Breakdown$/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('demo-analysis-workspace-view')).not.toBeInTheDocument();
      expect(screen.getByTestId('polis-report')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Report$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses a report-style icon for the polis results mode switcher', async () => {
    const baseProps = buildProps();

    render(<OnePageSession {...baseProps} slug="demo" sessionConfig={{ ...baseProps.sessionConfig, slug: 'demo' }} />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    const reportButton = await screen.findByRole('button', { name: /Report/i });
    expect(reportButton).toHaveTextContent('🧾');
    expect(reportButton).not.toHaveTextContent('🐝');
  });

  it('orders Debate Map ahead of Breakdown in the demo results mode switcher', async () => {
    const props = buildProps();

    render(<OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    const reportButton = await screen.findByRole('button', { name: /^Report$/i });
    const debateMapButton = screen.getByRole('button', { name: /^Debate Map$/i });
    const breakdownButton = screen.getByRole('button', { name: /^Breakdown$/i });
    const riskMatrixButton = screen.getByRole('button', { name: /^Risk Matrix$/i });

    expect(reportButton).toHaveAttribute('aria-pressed', 'true');
    expect(reportButton.compareDocumentPosition(debateMapButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(debateMapButton.compareDocumentPosition(breakdownButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(breakdownButton.compareDocumentPosition(riskMatrixButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the demo analysis workspace when the Breakdown mode is selected', async () => {
    const props = buildProps();

    render(<OnePageSession {...props} slug="demo" sessionConfig={{ ...props.sessionConfig, slug: 'demo' }} />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Breakdown$/i })).toBeInTheDocument();
    });

    const resultsNav = screen.getByTestId('ce-session-results-view-nav');
    expect(
      within(resultsNav)
        .getAllByRole('button')
        .slice(0, 4)
        .map((button) => button.getAttribute('title') || button.textContent?.trim()),
    ).toEqual(['Report', 'Debate Map', 'Breakdown', 'Risk Matrix']);

    const polisButton = screen.getByRole('button', { name: /^Report$/i });
    const analysisButton = screen.getByRole('button', { name: /^Breakdown$/i });

    expect(polisButton).toHaveAttribute('aria-pressed', 'true');
    expect(analysisButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(analysisButton);

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-workspace-view')).toBeInTheDocument();
    });

    expect(analysisButton).toHaveAttribute('aria-pressed', 'true');
    expect(analysisButton).toHaveClass(styles.sectionHeaderViewModeButtonActive);
    expect(polisButton).toHaveAttribute('aria-pressed', 'false');
    expect(mockDemoAnalysisWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ sessionSlug: 'demo' }));
  });

  it('kicks off a slug-scoped light SBT universe scan on mount and session switches', async () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const props = buildProps();
    const registryProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/demo');
      const { rerender } = render(
        <OnePageSession
          {...props}
          slug="demo"
          sessionConfig={{ ...props.sessionConfig, slug: 'demo', sessionModeProfile: registryProfile }}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />,
      );

      await waitFor(() => {
        expect(ensureLightSbtUniverse).toHaveBeenNthCalledWith(1, ['demo'], {
          forceScopeSlug: 'demo',
        });
      });

      window.history.replaceState({}, '', '/session/edge');
      rerender(
        <OnePageSession
          {...props}
          slug="edge"
          sessionConfig={{ ...props.sessionConfig, slug: 'edge', sessionModeProfile: registryProfile }}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />,
      );

      await waitFor(() => {
        expect(ensureLightSbtUniverse).toHaveBeenNthCalledWith(2, ['edge'], {
          forceScopeSlug: 'edge',
        });
      });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('never starts SBT discovery for a pure Worker session with a legacy chain id', async () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const props = buildProps();
    const workerProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

    render(
      <OnePageSession
        {...props}
        slug="demo-sh"
        sessionConfig={{
          ...props.sessionConfig,
          slug: 'demo-sh',
          networkChainId: 11155420,
          sessionModeProfile: workerProfile,
        }}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
      />,
    );

    await act(async () => Promise.resolve());
    expect(ensureLightSbtUniverse).not.toHaveBeenCalled();
  });

  it('clears pending auto-open results timer on unmount before it fires', async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const priorUrl = window.location.href;

    try {
      const { unmount } = render(<OnePageSession {...buildProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
      fireEvent.click(screen.getByRole('button', { name: /Raw Results/i }));

      unmount();

      expect(() => {
        act(() => {
          jest.runOnlyPendingTimers();
        });
      }).not.toThrow();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('does not build aggregator while results are collapsed', () => {
    jest.useFakeTimers();
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { 84532: { questionResponses: {} } } : {}));
    const props = buildProps();
    const { rerender } = render(<OnePageSession {...props} isQuestionCacheReady={true} />);
    const getQuestionsPeekCalls = () => peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache').length;

    expect(getQuestionsPeekCalls()).toBe(0);

    rerender(
      <OnePageSession
        {...props}
        isQuestionCacheReady={true}
        questionResponsesNonce={props.questionResponsesNonce + 1}
      />,
    );
    jest.advanceTimersByTime(150);

    expect(getQuestionsPeekCalls()).toBe(0);
  });

  it('builds aggregator when results open and when nonce changes while open', () => {
    jest.useFakeTimers();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { 84532: { questionResponses: {} } } : {}));
    const props = buildProps();
    props.sessionConfig.sessionModeProfile = cloneSessionModePreset(
      SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    );
    const { rerender } = render(<OnePageSession {...props} isQuestionCacheReady={true} />);
    const getQuestionsPeekCalls = () => peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache').length;

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(1);

    rerender(
      <OnePageSession
        {...props}
        isQuestionCacheReady={true}
        questionResponsesNonce={props.questionResponsesNonce + 1}
      />,
    );
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(2);
  });

  it('rejects results cached for a different Worker identity under the same slug', () => {
    const buildWorkerConfig = (sessionId, corsWorkerUrl) => ({
      ...buildProps().sessionConfig,
      slug: 'edge',
      sessionId,
      corsWorkerUrl,
      networkChainId: null,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      storageProfile: {
        backend: 'cloudflare',
        resources: {
          questions: 'active',
          surveys: 'active',
        },
      },
    });
    const workerAConfig = buildWorkerConfig(`0x${'1'.repeat(32)}`, 'https://worker-a-results.example.test');
    const workerBConfig = buildWorkerConfig(`0x${'2'.repeat(32)}`, 'https://worker-b-results.example.test');
    const workerAIdentity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: workerAConfig,
      sessionSlug: 'edge',
    });
    const workerBIdentity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: workerBConfig,
      sessionSlug: 'edge',
    });
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      worker: withWorkerCanonicalCacheIdentity(
        {
          questions: {
            'question-a': {
              id: 'question-a',
              prompt: 'Worker A only',
              sessionSlug: 'edge',
            },
          },
          questionResponses: {
            'question-a': {
              '0xresponder': {
                type: 'binary',
                answer: { value: 'yes' },
                sessionSlug: 'edge',
              },
            },
          },
        },
        workerAIdentity,
      ),
    });
    const subject = createSubject({
      slug: 'edge',
      sessionConfig: workerBConfig,
      isQuestionCacheReady: true,
    });
    subject.state = {
      ...subject.state,
      showResults: true,
      aggregatorData: {
        'question-a': [{ questionId: 'question-a', responder: '0xresponder', response: 'Worker A only' }],
      },
    };
    subject._aggregatorDataSig = '1:1:worker-a';

    const workerASignature = subject.buildAggregatorInputSignature(
      { ...subject.props, sessionConfig: workerAConfig },
      subject.state,
    );
    const workerBSignature = subject.buildAggregatorInputSignature(subject.props, subject.state);
    subject.buildAggregator();

    expect(workerBSignature).not.toBe(workerASignature);
    expect(subject.state.aggregatorData).toEqual({});
    expect(subject._aggregatorSourceSigKey).toContain('worker-identity-mismatch');

    peekSpy.mockReturnValue({
      worker: withWorkerCanonicalCacheIdentity(
        {
          questions: {
            'question-b': {
              id: 'question-b',
              prompt: 'Worker B only',
              sessionSlug: 'edge',
            },
          },
          questionResponses: {
            'question-b': {
              '0xresponder': {
                type: 'binary',
                answer: { value: 'yes' },
                sessionSlug: 'edge',
              },
            },
          },
        },
        workerBIdentity,
      ),
    });
    subject.buildAggregator();

    expect(subject.state.aggregatorData).toEqual({
      'question-b': [
        expect.objectContaining({
          questionId: 'question-b',
          responder: '0xresponder',
        }),
      ],
    });
  });

  it('does not amplify results cache reads across repeated results toggles', () => {
    jest.useFakeTimers();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { 84532: { questionResponses: {} } } : {}));
    const props = buildProps();
    props.sessionConfig.sessionModeProfile = cloneSessionModePreset(
      SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    );
    render(<OnePageSession {...props} isQuestionCacheReady={true} />);
    const getQuestionsPeekCalls = () => peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache').length;

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(1);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(1);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(1);
  });

  it('passes an explicit canonical empty filter state to pile mode when defaults are empty', async () => {
    const props = buildProps();
    render(
      <OnePageSession
        {...props}
        defaultFilterState={null}
        sessionConfig={{ ...props.sessionConfig, defaultFilterState: null }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });

    const pileCalls = mockSurveyPage.mock.calls
      .map((args) => args[0])
      .filter((childProps) => childProps?.minifiedMode === 'pile');
    const latestPileFilterState = pileCalls[pileCalls.length - 1]?.filterState || {};

    expect(latestPileFilterState).toEqual({
      topQuestions: null,
      questionTypes: [],
      sbtFilter: null,
      aiFilter: null,
      aiTopN: null,
      aiCombine: false,
      selectedTags: [],
    });
  });


  it('invalidates pending generated viewer loads and reloads when the visible results session changes', async () => {
    const prevProps = buildProps();
    const nextProps = {
      ...buildProps(),
      slug: 'next-session',
      sessionConfig: { ...buildProps().sessionConfig, slug: 'next-session' },
    };
    const subject = createSubject(nextProps);
    subject.state = {
      ...subject.state,
      showResults: true,
      generatedResultsAnalysis: { status: 'idle' },
    };
    const previousSeq = subject._generatedResultsRequestSeq;
    const loadSpy = jest.spyOn(subject, 'loadGeneratedResultsArtifact').mockResolvedValue(undefined);
    subject.kickoffLightSbtUniverseScan = jest.fn();
    subject.clearUnsupportedAutoMintState = jest.fn();
    subject.scheduleBuildAggregator = jest.fn();

    subject.componentDidUpdate(
      { ...prevProps, slug: 'prev-session', sessionConfig: { ...prevProps.sessionConfig, slug: 'prev-session' } },
      { ...subject.state, showResults: true },
    );

    expect(subject._generatedResultsRequestSeq).toBeGreaterThan(previousSeq);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('resyncs local filter state when defaultFilterState changes across session switch', async () => {
    const initialDefault = { selectedTags: ['alpha'] };
    const nextDefault = { selectedTags: ['beta'] };
    const props = buildProps();
    const { rerender } = render(
      <OnePageSession
        {...props}
        slug="edge"
        defaultFilterState={initialDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: initialDefault }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });

    const readLatestPileFilterState = () => {
      const pileCalls = mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.minifiedMode === 'pile');
      return pileCalls[pileCalls.length - 1]?.filterState || {};
    };

    expect(readLatestPileFilterState().selectedTags || []).toEqual(['alpha']);

    rerender(
      <OnePageSession
        {...props}
        slug="next-session"
        defaultFilterState={nextDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'next-session', defaultFilterState: nextDefault }}
      />,
    );

    await waitFor(() => {
      expect(readLatestPileFilterState().selectedTags || []).toEqual(['beta']);
    });
  });

  it('resyncs local filter state when defaultFilterState mutates in place with a stable prop reference', async () => {
    const sharedDefault = { selectedTags: ['alpha'] };
    const props = buildProps();
    const { rerender } = render(
      <OnePageSession
        {...props}
        slug="edge"
        defaultFilterState={sharedDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: sharedDefault }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });

    const readLatestPileFilterState = () => {
      const pileCalls = mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.minifiedMode === 'pile');
      return pileCalls[pileCalls.length - 1]?.filterState || {};
    };

    expect(readLatestPileFilterState().selectedTags || []).toEqual(['alpha']);

    sharedDefault.selectedTags = ['beta'];
    rerender(
      <OnePageSession
        {...props}
        slug="edge"
        defaultFilterState={sharedDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: sharedDefault }}
      />,
    );

    await waitFor(() => {
      expect(readLatestPileFilterState().selectedTags || []).toEqual(['beta']);
    });
  });

  it('runs login-transition auto mint even when filter state resyncs on the same update', async () => {
    const initialDefault = { selectedTags: ['alpha'] };
    const nextDefault = { selectedTags: ['beta'] };
    const props = buildProps();
    const kickoffSpy = jest.spyOn(OnePageSession.prototype, 'kickoffAutoMintIfNeeded').mockImplementation(() => {});

    const { rerender } = render(
      <OnePageSession
        {...props}
        loginComplete={false}
        slug="edge"
        defaultFilterState={initialDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: initialDefault }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
    });
    expect(kickoffSpy).not.toHaveBeenCalled();

    rerender(
      <OnePageSession
        {...props}
        loginComplete={true}
        slug="next-session"
        defaultFilterState={nextDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'next-session', defaultFilterState: nextDefault }}
      />,
    );

    await waitFor(() => {
      expect(kickoffSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('rebuilds results aggregator on session switch when default filter resyncs while results are open', () => {
    jest.useFakeTimers();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { 84532: { questionResponses: {} } } : {}));
    const initialDefault = { selectedTags: ['alpha'] };
    const nextDefault = { selectedTags: ['beta'] };
    const props = buildProps();
    props.sessionConfig.sessionModeProfile = cloneSessionModePreset(
      SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    );
    const { rerender } = render(
      <OnePageSession
        {...props}
        slug="edge"
        isQuestionCacheReady={true}
        defaultFilterState={initialDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: initialDefault }}
      />,
    );
    const getQuestionsPeekCalls = () => peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache').length;

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(1);

    rerender(
      <OnePageSession
        {...props}
        slug="next-session"
        isQuestionCacheReady={true}
        questionResponsesNonce={props.questionResponsesNonce + 1}
        defaultFilterState={nextDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'next-session', defaultFilterState: nextDefault }}
      />,
    );
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(2);
  });
});
