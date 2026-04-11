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

const mockSurveyPage = jest.fn();
const mockPolisReport = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockRiskMatrix = jest.fn();
const mockDebateSelector = jest.fn();
const mockDemoAnalysisWorkspace = jest.fn();

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

  const getAutoMintStorageKey = (account, sbtAddress, chainId = 84532) => (
    `autoMint:${String(account || '').toLowerCase()}:${chainId}:${String(sbtAddress || '').toLowerCase()}`
  );

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

  it('uses the title container slot to reserve pile submit rail space when the embedded pile signals visibility', async () => {
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
      '.titleContainerWithPileSubmitRail'
    );
    const tabletRailBlock = extractMediaBlock(
      scss,
      '@media only screen and (max-width: 600px)',
      '.titleContainerWithPileSubmitRail'
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

  it('aggregates embedded PolisReport question responses across list scope on session pages', async () => {
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
              questionResponses: {
                q1: {
                  '0xedge': {
                    type: 'binary',
                    answer: { value: 'yes', encrypted: false },
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
    expect(smallTabletBlock).toContain('.sectionHeader {');
    expect(smallTabletBlock).toContain('font-size: 1.6em;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderText {');
    expect(smallTabletBlock).toContain('flex-direction: row;');
    expect(smallTabletBlock).toContain('align-items: baseline;');
    expect(smallTabletBlock).toContain('gap: 6px 12px;');
    expect(smallTabletBlock).toContain('.sectionHeader .sectionHeaderSubtitle {');
    expect(smallTabletBlock).toContain('font-size: 0.68em;');
    expect(smallTabletBlock).toContain('color: rgba(244, 247, 255, 0.58);');
    expect(smallTabletBlock).not.toContain('.sectionContainer');
    expect(scss).toMatch(/@media only screen and \(min-width:\s*768px\) and \(max-width:\s*1024px\)\s*{[\s\S]*?\.sectionHeader \.sectionHeaderText\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-start;/);
  });

  it('shows the demo Documents tooltip copy only when the section is expanded', async () => {
    const props = buildProps();
    const documentsTooltipText = 'This corpus is evolving into a conversational layer for the session: you’ll be able to chat with the material, have it surface and pose relevant questions, and connect those prompts fluidly with responses.';

    render(
      <OnePageSession
        {...props}
        slug="demo"
        sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
      />
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.queryByText(documentsTooltipText)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-demo-documents-toggle'));

    expect(screen.getByText(documentsTooltipText)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/tree/main/ai-discourse-corpus'
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

  it('re-triggers auto-open on repeated Raw Results clicks, stays closed after one close, and resets URL on close', async () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollSpy = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    const priorUrl = window.location.href;
    window.history.pushState({}, '', '/session/edge');

    const getFullCalls = () => (
      mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile')
    );

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
      expect(window.location.pathname).toBe('/questions/results');
      expect(window.location.search).toBe('?session=edge');
      expect(getFullCalls().slice(-2).map((props) => props.autoOpenResults)).toEqual([false, true]);

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

      expect(getFullCalls().slice(-2).map((props) => props.autoOpenResults)).toEqual([false, true]);
      expect(window.location.pathname).toBe('/questions/results');
      expect(window.location.search).toBe('?session=edge');
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps results-route open and close navigation under PUBLIC_URL subpaths', async () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    const priorUrl = window.location.href;
    const priorPublicUrl = process.env.PUBLIC_URL;
    // '/ce/' is our synthetic subpath fixture for the dormant-but-supported
    // PUBLIC_URL mode; root deployment remains the default today.
    process.env.PUBLIC_URL = '/ce/';

    const getFullCalls = () => (
      mockSurveyPage.mock.calls
        .map((args) => args[0])
        .filter((childProps) => childProps?.miniMode === true && childProps?.minifiedMode !== 'pile')
    );

    try {
      window.history.replaceState({}, '', '/ce/session/edge');
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
      expect(window.location.pathname).toBe('/ce/questions/results');
      expect(window.location.search).toBe('?session=edge');

      act(() => {
        const latestProps = getFullCalls()[getFullCalls().length - 1];
        latestProps.onResultsModalClose();
      });

      await waitFor(() => {
        expect(getFullCalls()[getFullCalls().length - 1]?.autoOpenResults).toBe(false);
      });
      expect(window.location.pathname).toBe('/ce/session/edge');
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
      const view = render(
        <OnePageSession
          {...mergedProps}
          {...extraProps}
          sessionConfig={sessionConfig}
        />
      );

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
      expect(window.location.pathname).toBe('/questions/results');
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
      render(
        <OnePageSession
          {...buildProps()}
          routeQuestionsOpen={true}
          routeAutoOpenResults={true}
        />
      );

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
      const view = render(
        <OnePageSession
          {...buildProps()}
          routeQuestionsOpen={true}
          routeAutoOpenResults={true}
        />
      );

      expect(await screen.findByTestId('survey-page-full')).toBeInTheDocument();

      window.history.replaceState({}, '', '/session/edge?session=edge');
      view.rerender(
        <OnePageSession
          {...buildProps()}
          routeQuestionsOpen={false}
          routeAutoOpenResults={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('survey-page-pile')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('survey-page-full')).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
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

  it('keeps DebateSelector out of debate map mode', async () => {
    const props = buildProps();

    render(
      <OnePageSession
        {...props}
        slug="demo"
        sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Debate Map$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Debate Map$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('ai-policy-atlas')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('debate-selector')).not.toBeInTheDocument();
  }, 15000);

  it('renders the shared risk matrix view in embedded mode for demo results', async () => {
    const props = buildProps();

    render(
      <OnePageSession
        {...props}
        slug="demo"
        sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
      />
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
    });
  });

  it('restores the one-page session view after closing an atlas node opened from Context', async () => {
    const props = buildProps();

    render(
      <OnePageSession
        {...props}
        slug="demo"
        sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
      />
    );

    expect(await screen.findByTestId('survey-page-pile')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-demo-documents-toggle'));

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

  it('shows the Breakdown results mode only for /session/demo', async () => {
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
      <OnePageSession
        {...baseProps}
        slug="demo"
        sessionConfig={{ ...baseProps.sessionConfig, slug: 'demo' }}
      />
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Breakdown$/i })).toBeInTheDocument();
    });
  });

  it('uses a report-style icon for the polis results mode switcher', async () => {
    const baseProps = buildProps();

    render(
      <OnePageSession
        {...baseProps}
        slug="demo"
        sessionConfig={{ ...baseProps.sessionConfig, slug: 'demo' }}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    const reportButton = await screen.findByRole('button', { name: /Report/i });
    expect(reportButton).toHaveTextContent('🧾');
    expect(reportButton).not.toHaveTextContent('🐝');
  });

  it('renders the demo analysis workspace when the Breakdown mode is selected', async () => {
    const props = buildProps();

    render(
      <OnePageSession
        {...props}
        slug="demo"
        sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_TOGGLE));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Breakdown$/i })).toBeInTheDocument();
    });

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
    expect(mockDemoAnalysisWorkspace).toHaveBeenCalled();
  });

  it('kicks off a slug-scoped light SBT universe scan on mount and session switches', async () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const props = buildProps();
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/session/demo');
      const { rerender } = render(
        <OnePageSession
          {...props}
          slug="demo"
          sessionConfig={{ ...props.sessionConfig, slug: 'demo' }}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />
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
          sessionConfig={{ ...props.sessionConfig, slug: 'edge' }}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />
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
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { '84532': { questionResponses: {} } } : {}));
    const props = buildProps();
    const { rerender } = render(<OnePageSession {...props} isQuestionCacheReady={true} />);
    const getQuestionsPeekCalls = () => peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache').length;

    expect(getQuestionsPeekCalls()).toBe(0);

    rerender(
      <OnePageSession
        {...props}
        isQuestionCacheReady={true}
        questionResponsesNonce={props.questionResponsesNonce + 1}
      />
    );
    jest.advanceTimersByTime(150);

    expect(getQuestionsPeekCalls()).toBe(0);
  });

  it('builds aggregator when results open and when nonce changes while open', () => {
    jest.useFakeTimers();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { '84532': { questionResponses: {} } } : {}));
    const props = buildProps();
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
      />
    );
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(2);
  });

  it('does not amplify results cache reads across repeated results toggles', () => {
    jest.useFakeTimers();
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { '84532': { questionResponses: {} } } : {}));
    const props = buildProps();
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
      />
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
      />
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
      />
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
      />
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
      />
    );

    await waitFor(() => {
      expect(readLatestPileFilterState().selectedTags || []).toEqual(['beta']);
    });
  });

  it('runs login-transition auto mint even when filter state resyncs on the same update', async () => {
    const initialDefault = { selectedTags: ['alpha'] };
    const nextDefault = { selectedTags: ['beta'] };
    const props = buildProps();
    const kickoffSpy = jest
      .spyOn(OnePageSession.prototype, 'kickoffAutoMintIfNeeded')
      .mockImplementation(() => {});

    const { rerender } = render(
      <OnePageSession
        {...props}
        loginComplete={false}
        slug="edge"
        defaultFilterState={initialDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: initialDefault }}
      />
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
      />
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
      .mockImplementation((namespace) => (namespace === 'questionsCache' ? { '84532': { questionResponses: {} } } : {}));
    const initialDefault = { selectedTags: ['alpha'] };
    const nextDefault = { selectedTags: ['beta'] };
    const props = buildProps();
    const { rerender } = render(
      <OnePageSession
        {...props}
        slug="edge"
        isQuestionCacheReady={true}
        defaultFilterState={initialDefault}
        sessionConfig={{ ...props.sessionConfig, slug: 'edge', defaultFilterState: initialDefault }}
      />
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
      />
    );
    jest.advanceTimersByTime(150);
    expect(getQuestionsPeekCalls()).toBe(2);
  });

  it('uses getNativeBalance for auto-mint balance checks when the legacy getETHBalance alias is unavailable', async () => {
    const subject = createSubject({
      sessionConfig: {
        ...buildProps().sessionConfig,
        slug: 'demo-30',
      },
    });
    const account = '0x00000000000000000000000000000000000000aa';
    const nativeBalanceSpy = jest
      .spyOn(contractScripts, 'getNativeBalance')
      .mockResolvedValue(ethers.utils.parseEther('0.1'));
    const originalLegacyReader = contractScripts.getETHBalance;

    try {
      delete contractScripts.getETHBalance;
      const ok = await subject.waitForSufficientBalance(
        'mock',
        account,
        ethers.utils.parseEther('0.00002'),
        50,
        1
      );

      expect(ok).toBe(true);
      expect(nativeBalanceSpy).toHaveBeenCalledWith(account, expect.any(String));
    } finally {
      contractScripts.getETHBalance = originalLegacyReader;
    }
  });

  it('pins the session slug on auto-mint status links', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const subject = createSubject({
      slug: 'edge',
      sessionConfig: {
        ...buildProps().sessionConfig,
        slug: 'edge',
      },
    });
    subject.state = {
      ...subject.state,
      autoMintStatuses: {
        [sbtAddress.toLowerCase()]: {
          status: 'success',
          name: 'Joined: Edge Badge',
        },
      },
    };

    render(subject.render());

    const statusAlert = screen.getByTestId(E2E_TESTIDS.SESSION_AUTO_MINT_STATUS);
    const link = within(statusAlert).getByRole('link', { name: 'Joined: Edge Badge' });
    expect(link.getAttribute('href')).toBe(buildSbtDetailPath(sbtAddress.toLowerCase(), 'edge'));
  });

  it('auto-mints public no-password SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000b2',
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Public Badge',
      tokenURI: 'ar://public-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledWith('wagmi', sbtAddress);
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Public Badge',
    });
    expect(subject.props.refreshSbtData).toHaveBeenCalledWith(sbtAddress, expect.any(String));
  });

  it('consumes successful public auto-mint targets so rerunning the queue does not claim twice', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b3';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b4';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'One Shot Badge',
      tokenURI: 'ar://one-shot-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();
    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: One Shot Badge',
    });
  });

  it('re-evaluates cached auto-mint targets when the connected wallet changes', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000be';
    const accountA = '0x00000000000000000000000000000000000000bf';
    const accountB = '0x00000000000000000000000000000000000000c0';
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.history.replaceState({}, '', `/?auto=1&sbt=${sbtAddress}`);
      window.sessionStorage.setItem(getAutoMintStorageKey(accountA, sbtAddress), 'done');

      const subject = createSubject({
        account: accountA,
        loginComplete: true,
        slug: 'edge',
      });

      expect(subject.parseAutoMintFragment()).toEqual([]);

      subject.props = {
        ...subject.props,
        account: accountB,
      };

      expect(subject.parseAutoMintFragment()).toEqual([{
        sbt: sbtAddress,
        gp: '',
        inv: '',
      }]);
    } finally {
      window.history.replaceState({}, '', originalUrl || '/');
    }
  });

  it('does not consume public auto-mint attempts when a claim fails before succeeding later', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b5';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b6';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Retry Badge',
      tokenURI: 'ar://retry-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim')
      .mockRejectedValueOnce(new Error('temporary rpc failure'))
      .mockResolvedValueOnce({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBeNull();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: Retry Badge',
    });
  });

  it('keeps failed auto-mint targets queued until they succeed later', async () => {
    const firstSbtAddress = '0x00000000000000000000000000000000000000c1';
    const secondSbtAddress = '0x00000000000000000000000000000000000000c2';
    const account = '0x00000000000000000000000000000000000000c3';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    const persistedIntent = [
      'auto=1',
      `sbt=${firstSbtAddress}`,
      `sbt1=${secondSbtAddress}`,
      'auto1=1',
    ].join('&');
    let secondClaimAttempts = 0;

    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: firstSbtAddress }, { sbt: secondSbtAddress }],
    };

    window.sessionStorage.setItem(subject.getAutoHashStorageKey(), persistedIntent);
    window.history.replaceState({}, '', `/demo?${persistedIntent}`);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockImplementation(async (_provider, sbtAddress) => ({
      name: sbtAddress === firstSbtAddress ? 'First Badge' : 'Second Badge',
      tokenURI: `ar://${String(sbtAddress || '').toLowerCase()}`,
      hasPasswordMint: false,
      maxTokens: '0',
    }));
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockImplementation(async (_provider, sbtAddress) => {
      if (sbtAddress === firstSbtAddress) {
        return { transactionHash: '0xclaim-first' };
      }
      secondClaimAttempts += 1;
      if (secondClaimAttempts === 1) {
        throw new Error('temporary rpc failure');
      }
      return { transactionHash: '0xclaim-second' };
    });
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.autoMintTargets).toEqual([{ sbt: secondSbtAddress }]);
    expect(subject.state.mintSuccess).toBe(false);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, firstSbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, secondSbtAddress))).toBeNull();
    expect(window.sessionStorage.getItem(subject.getAutoHashStorageKey())).toBe(persistedIntent);
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(3);
    expect(subject.state.autoMintTargets).toEqual([]);
    expect(subject.state.mintSuccess).toBe(true);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, secondSbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(subject.getAutoHashStorageKey())).toBeNull();
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it('does not consume public auto-mint attempts when the balance gate times out', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b7';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b8';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Gas Retry Badge',
      tokenURI: 'ar://gas-retry-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBeNull();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: Gas Retry Badge',
    });
  });

  it('scopes consumed auto-mint attempts to the connected wallet', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b9';
    const sbtKey = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000ba';
    const accountB = '0x00000000000000000000000000000000000000bb';
    const subjectA = createSubject({
      account: accountA,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    const subjectB = createSubject({
      account: accountB,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subjectA.state = {
      ...subjectA.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };
    subjectB.state = {
      ...subjectB.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Wallet Scoped Badge',
      tokenURI: 'ar://wallet-scoped-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subjectA.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subjectB.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subjectA.runAutoMintQueue();
    await subjectA.runAutoMintQueue();
    await subjectB.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(accountA, sbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(accountB, sbtAddress))).toBe('done');
  });

  it('scopes consumed auto-mint attempts to the session chain as well as the wallet', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000bc';
    const account = '0x00000000000000000000000000000000000000bd';
    const subjectSepolia = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionConfig: {
        ...buildProps().sessionConfig,
        networkChainId: 84532,
      },
    });
    const subjectBase = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
      network: { id: 8453, name: 'Base' },
      sessionConfig: {
        ...buildProps().sessionConfig,
        networkChainId: 8453,
      },
    });
    subjectSepolia.state = {
      ...subjectSepolia.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };
    subjectBase.state = {
      ...subjectBase.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Cross Chain Badge',
      tokenURI: 'ar://cross-chain-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subjectSepolia.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subjectBase.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subjectSepolia.runAutoMintQueue();
    await subjectBase.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress, 84532))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress, 8453))).toBe('done');
  });

  it('auto-mints invite-code SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000c1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000c2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, inv: 'invite-token' }],
    };
    subject.decodeInviteInput = jest.fn().mockReturnValue({ nonce: '7', signature: '0xinvite' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Invite Badge',
      tokenURI: 'ar://invite-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    const claimInviteSpy = jest
      .spyOn(contractScripts, 'claimWithInvite')
      .mockResolvedValue({ transactionHash: '0xinviteclaim' });

    await subject.runAutoMintQueue();

    expect(claimInviteSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '7', '0xinvite');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Invite Badge',
    });
  });

  it('auto-mints limited password SBTs through generated invite payloads in the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000d1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000d2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, gp: 'shared-secret' }],
    };
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Limited Badge',
      tokenURI: 'ar://limited-badge',
      hasPasswordMint: true,
      maxTokens: '5',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');
    const generateInviteSpy = jest
      .spyOn(contractScripts, 'generateInvitePayloads')
      .mockResolvedValue([{ nonce: '1', signature: '0xlimitedinvite' }]);
    const claimInviteSpy = jest
      .spyOn(contractScripts, 'claimWithInvite')
      .mockResolvedValue({ transactionHash: '0xlimitedclaim' });

    await subject.runAutoMintQueue();

    expect(generateInviteSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress,
      nonces: ['1'],
      walletScopeSbtAddress: sbtAddress,
    });
    expect(claimInviteSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '1', '0xlimitedinvite');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Limited Badge',
    });
  });

  it('auto-mints unlimited group-password SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000e1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000e2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, gp: 'shared-secret' }],
    };
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subject.verifyGroupPasswordBinding = jest.fn().mockResolvedValue(true);
    subject.mintUnlimitedSBTWithGroupPassword = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Unlimited Badge',
      tokenURI: 'ar://unlimited-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest
      .spyOn(contractScripts, 'getGroupPasswordHash')
      .mockResolvedValue('0x1111111111111111111111111111111111111111111111111111111111111111');

    await subject.runAutoMintQueue();

    expect(subject.verifyGroupPasswordBinding).toHaveBeenCalledWith(sbtAddress, 'shared-secret');
    expect(subject.mintUnlimitedSBTWithGroupPassword).toHaveBeenCalledWith(sbtAddress, 'shared-secret');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Unlimited Badge',
    });
  });

  it('treats positive count-map ownership as already joined during auto mint preflight', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f1';
    const account = '0x00000000000000000000000000000000000000f2';
    const accountLower = account.toLowerCase();
    const subject = createSubject({
      account,
      loginComplete: true,
      slug: 'edge',
      refreshSbtData: jest.fn(),
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
          sbtList: {
            [sbtAddress.toLowerCase()]: {
              sbtAddress,
              sbtInfo: {
                name: 'Reminted Badge',
                tokenURI: 'ar://reminted-badge',
                hasPasswordMint: false,
                maxTokens: '0',
              },
              mintedAddresses: [accountLower],
              burnedAddresses: [accountLower],
              mintedCountByAddress: { [accountLower]: 2 },
              burnedCountByAddress: { [accountLower]: 1 },
              countsLoaded: true,
            },
          },
        },
      };
    });
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).not.toHaveBeenCalled();
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Group Already Joined',
    });
  });

  it('ignores checkpoint-backed partial ownership counts during auto mint preflight', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f3';
    const account = '0x00000000000000000000000000000000000000f4';
    const accountLower = account.toLowerCase();
    const subject = createSubject({
      account,
      loginComplete: true,
      slug: 'edge',
      refreshSbtData: jest.fn(),
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
          sbtList: {
            [sbtAddress.toLowerCase()]: {
              sbtAddress,
              sbtInfo: {
                name: 'Partial Badge',
                tokenURI: 'ar://partial-badge',
                hasPasswordMint: false,
                maxTokens: '0',
              },
              mintedAddresses: [accountLower],
              burnedAddresses: [],
              mintedCountByAddress: { [accountLower]: 1 },
              burnedCountByAddress: {},
              countsLoaded: false,
              countsScanCheckpoint: {
                phase: 'activity',
                blockNumber: 15,
                mintedCountByAddress: { [accountLower]: 1 },
                burnedCountByAddress: {},
              },
            },
          },
        },
      };
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledWith('wagmi', sbtAddress);
  });
});
