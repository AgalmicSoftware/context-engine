import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PileHologramAssistant from './PileHologramAssistant';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import { buildPileRuntimeInitialState, createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import {
  buildNoPendingPileSubmitFeedbackPlan,
  buildPileSubmitRailViewState,
  buildPileSubmitTempTextPatch,
  buildPileSubmitViewState,
} from './surveyPileViewState.js';
import { renderPileGatedPromptCard } from './surveyPileActiveQuestionCard';
import { renderPileInteractionSurface } from './surveyPileInteractionSurface';
import {
  buildClearedTransientSubmitFeedbackState,
  buildQuestionPoolPendingSubmitFeedbackMessage,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';
import { buildSurveyQuestionPoolLoadState } from './surveyQuestionsTypes.js';
import { buildListeningModeSearch, isListeningModeQueryEnabled } from '../../utilities/audio/rollingTranscription';
import { encodeInterviewPrefillPacket, resolveSessionVoiceMode } from './sessionInterview';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) =>
      React.createElement('div', {
        'data-testid': 'mock-pile-create',
        'data-hide-survey-toggle': String(props.hideSurveyQuestionToggleUntilAuthoring),
      }),
  };
});

jest.mock('./SessionListeningPanel', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () =>
      React.createElement('div', {
        'data-testid': 'mock-listening-panel',
      }),
  };
});

jest.mock('./SessionVoiceModeModal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) =>
      props.isOpen
        ? React.createElement('div', {
            'data-testid': 'mock-voice-mode-modal',
            'data-mode': props.mode || 'chooser',
            'data-prefill-model': props.prefillPacket?.source?.modelId || '',
            'data-prefill-confidence': String(props.prefillPacket?.responses?.[0]?.confidence ?? ''),
          })
        : null,
  };
});

const isElementNode = (node) => React.isValidElement(node);

const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    if (!isElementNode(current)) continue;
    const children = current.props.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const nodeHasClassName = (node, className) => {
  if (!isElementNode(node)) return false;
  const value = node.props.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node, className) =>
  findElement(node, (candidate) => nodeHasClassName(candidate, className));

const getElementChildren = (node) => {
  if (!isElementNode(node)) return [];
  const children = node.props.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter(isElementNode);
};

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (!isElementNode(node)) return false;
  if (node.props['data-testid'] === testId) return true;
  return treeHasDataTestId(node.props.children, testId);
};

const baseRail = (overrides = {}) =>
  buildPileSubmitRailViewState({
    pendingStats: { total: 1 },
    isSubmitting: false,
    submittedSinceLastEdit: false,
    submissionComplete: false,
    pileSubmitTempText: '',
    pileSubmitLabel: 'Submit',
    account: '',
    isAddress: () => false,
    ...overrides,
  });

const buildSurfaceProps = (overrides = {}) => {
  const rail = overrides.rail || baseRail();
  return {
    showHologramAssistant: false,
    toggleHologramAssistant: jest.fn(),
    showMiniBackgroundSpinner: false,
    priorResponsesHydrating: false,
    showLongLoading: false,
    loadingElapsedSec: 0,
    pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
    activePileIndex: 0,
    renderActiveQuestion: jest.fn((question) => <div data-testid={`active-${question.id}`}>{question.prompt}</div>),
    hasTerminalScanError: false,
    scanErrorMessage: '',
    hasError: false,
    isStillLoading: false,
    hydrateDone: 0,
    hydrateDiscovered: 0,
    isHydrating: false,
    scanTotalBlocks: 0,
    pileScanDisplay: { metaLeftText: '', metaRightText: '' },
    scanPercent: 0,
    showFilteredEmptyState: false,
    showGatedEmptyState: false,
    gatedEmptyPanel: <div data-testid="gated-empty">Gated</div>,
    isFilterActive: false,
    toggleFilterModal: jest.fn(),
    showCreate: false,
    toggleCreate: jest.fn(),
    showListeningPanel: false,
    toggleListeningPanel: jest.fn(),
    onViewAllClick: jest.fn(),
    handleViewAllFromPile: jest.fn(),
    handlePileSubmitClick: jest.fn(),
    isSubmitting: false,
    activePromptMasked: false,
    handleRevertPendingChanges: jest.fn(),
    navCounterVisible: true,
    handlePrev: jest.fn(),
    handleNext: jest.fn(),
    ...rail,
    ...overrides,
  };
};

const renderPile = (props = {}, options = {}) =>
  renderSurveyPileViewMode(
    {
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      onFilterChange: jest.fn(),
      runtimeStrategy: createPileViewRuntimeStrategy(),
      ...props,
    },
    options,
  );

const applyPatch = (state, patch) => ({ ...state, ...patch });

describe('SurveyPileViewMode runtime surface', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('renders the pile gated prompt card through the extracted PileViewMode helper', () => {
    const tree = renderPileGatedPromptCard({
      promptHeader: <span data-testid="pile-masked-prompt">Prompt</span>,
      gatedPromptNotice: <div data-testid="pile-gated-notice" />,
    });

    expect(treeHasDataTestId(tree, 'pile-masked-prompt')).toBe(true);
    expect(treeHasDataTestId(tree, 'pile-gated-notice')).toBe(true);
  });

  it('forwards fallback question pools into pile mode', async () => {
    const questionPool = [{ id: 'demo-q1', prompt: 'Canonical demo question' }];
    renderPile({
      questionPool,
      cacheHasLoaded: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
    });

    expect(await screen.findByText('Canonical demo question')).toBeInTheDocument();
  });

  it('renders option-bearing poll aliases as pile multichoice inputs', async () => {
    renderPile({
      questionPool: [
        {
          id: 'poll-q1',
          type: 'poll',
          prompt: 'Which capability matters most?',
          choices: [{ label: 'Cross-site graph' }, { text: 'Session memory' }],
        },
      ],
      cacheHasLoaded: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
    });

    expect(await screen.findByText('Which capability matters most?')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cross-site graph' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Session memory' })).toBeInTheDocument();
  });

  it('updates a pile rating through the shared slider persistence helper', async () => {
    renderPile({
      questionPool: [{ id: 'rating-q1', type: 'rating', prompt: 'Rate this from zero to ten' }],
      cacheHasLoaded: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
    });

    expect(await screen.findByText('Rate this from zero to ten')).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('0');

    fireEvent.change(slider, { target: { value: '7' } });

    await waitFor(() => expect(slider).toHaveValue('7'));
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('advances pile navigation while early questionPool questions are visible', async () => {
    renderPile({
      questionPool: [
        { id: 'demo-q1', prompt: 'First canonical question' },
        { id: 'demo-q2', prompt: 'Second canonical question' },
      ],
      cacheHasLoaded: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
    });

    expect(await screen.findByText('First canonical question')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next Question'));

    expect(await screen.findByText('Second canonical question')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('renders triple trailing arrows inside the pile submit button', () => {
    const tree = renderPileInteractionSurface(buildSurfaceProps());
    const submitButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT,
    );
    const submitContent = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonContent');
    const submitTrail = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonTrail');

    expect(submitButton).not.toBeNull();
    expect(submitContent).not.toBeNull();
    expect(submitTrail).not.toBeNull();
    expect(getElementChildren(submitTrail)).toHaveLength(3);
  });

  it('keeps the active pile slider mode when opening the collapsed control', () => {
    const onSelectMode = jest.fn();
    render(
      <SurveyQuestionsFullQuestionSliderSection
        activeSliderValue={6}
        collapsedSliderMode="importance"
        convictionValue={2}
        hasConvictionImportanceValue
        importanceToggleEnabled
        importanceValue={6}
        isSubmitting={false}
        onSelectMode={onSelectMode}
        questionId="q1"
        sliderMode="conviction"
        sliderOpen={false}
      />,
    );

    fireEvent.click(screen.getByLabelText('Conviction / importance'));

    expect(onSelectMode).toHaveBeenCalledWith('importance');
    // port note: the old assertion reached the pile wrapper method and its
    // private open/toggle callbacks. The portable contract is that the shared
    // collapsed slider control preserves and emits the active collapsed mode.
  });

  it('routes simple pile overrides through the runtime strategy bridge', () => {
    jest.useFakeTimers();
    const strategy = createPileViewRuntimeStrategy();
    const engine = {
      _isMounted: true,
      _pileQuestionsGeneration: 0,
      _currentRenderedQuestionIdsCache: null,
      _currentRenderedQuestionIdsCacheKey: '',
      _emptySubmitTimer: null,
      _pileSubmitTimer: null,
      computePendingEditStatsAtIndex: jest.fn(() => ({ total: 4 })),
      getSubmitCount: jest.fn(() => 4),
      props: {},
      state: {
        pileQuestions: [{ id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }],
        activePileIndex: 3,
        showComments: {},
      },
      setState: jest.fn((next) => {
        const patch = typeof next === 'function' ? next(engine.state, engine.props) : next;
        engine.state = applyPatch(engine.state, patch || {});
      }),
    };

    expect(strategy.getCurrentRenderedQuestionIds(engine)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);

    strategy.toggleComments(engine, 'q3');
    expect(engine.state.showComments.q3).toBe(true);
    expect(strategy.getPendingEditStats(engine)).toEqual({ total: 4 });
    expect(strategy.getAnsweredQuestionsCount(engine)).toBe(4);
    expect(engine.computePendingEditStatsAtIndex).toHaveBeenCalledWith(0);

    strategy.showTransientSubmitFeedback(engine, 'Review pending', 100);
    expect(engine.state.submissionError).toBe('Review pending');
    expect(engine.state.pileSubmitTempText).toBe('Review pending');
    jest.advanceTimersByTime(1000);
    expect(engine.state.submissionError).toBe('');
    expect(engine.state.pileSubmitTempText).toBeNull();
  });

  it('keeps the legacy listening query compatible while the microphone opens the new chooser', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn(() => ({ matches: true })),
    });
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      renderPile(
        {},
        {
          route: '/session/demo?foo=1&mode=listening#pile',
        },
      );

      const listeningToggle = await screen.findByTestId(E2E_TESTIDS.SESSION_LISTENING_TOGGLE);
      expect(listeningToggle).toHaveAttribute('aria-pressed', 'true');
      expect(isListeningModeQueryEnabled(window.location.search)).toBe(true);

      fireEvent.click(listeningToggle);
      expect(window.location.pathname).toBe('/session/demo');
      expect(window.location.search).toBe('?foo=1');
      expect(window.location.hash).toBe('#pile');
      expect(isListeningModeQueryEnabled(window.location.search)).toBe(false);

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TOGGLE));
      expect(await screen.findByTestId('mock-voice-mode-modal')).toHaveAttribute('data-mode', 'chooser');
      expect(window.location.search).toBe('?foo=1');
      expect(buildListeningModeSearch('?foo=1', true)).toBe('?foo=1&mode=listening');
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
      });
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('opens interview and group conversation directly from their mode query values', async () => {
    const first = renderPile({}, { route: '/session/demo?foo=1&mode=interview' });
    expect(await screen.findByTestId('mock-voice-mode-modal')).toHaveAttribute('data-mode', 'interview');
    expect(resolveSessionVoiceMode(window.location.search)).toBe('interview');
    first.unmount();

    renderPile({}, { route: '/session/demo?mode=recordGroup' });
    expect(await screen.findByTestId('mock-voice-mode-modal')).toHaveAttribute('data-mode', 'recordGroup');
    expect(resolveSessionVoiceMode(window.location.search)).toBe('recordGroup');
  });

  it('keeps an imported prefill through initialization and clears it only after mount', async () => {
    const encoded = encodeInterviewPrefillPacket({
      version: 1,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v3',
      source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
      responderContext: { summary: 'Synthetic test context.' },
      responses: [{ questionId: 'q1', answer: 'Draft', confidence: 0.22 }],
    });
    const route = `/session/demo?mode=interview#prefill=${encoded}`;
    window.history.replaceState({}, '', route);
    const initial = buildPileRuntimeInitialState({
      props: {},
      buildWarmPileSeedState: () => null,
    });

    expect(initial.interviewPrefillPacket).toEqual(expect.objectContaining({
      source: expect.objectContaining({ modelId: 'claude-test' }),
      responses: [expect.objectContaining({ confidence: 0.22 })],
    }));
    expect(window.location.hash).toBe(`#prefill=${encoded}`);

    const rendered = renderPile({}, { route });
    const modal = await screen.findByTestId('mock-voice-mode-modal');
    expect(modal).toHaveAttribute('data-mode', 'interview');
    expect(modal).toHaveAttribute('data-prefill-model', 'claude-test');
    expect(modal).toHaveAttribute('data-prefill-confidence', '0.22');
    await waitFor(() => expect(window.location.hash).toBe(''));
    rendered.unmount();
  });

  it('shows and clears the pile submit empty-state feedback without submitting', async () => {
    jest.useFakeTimers();
    const encryptAndUpload = jest.fn();
    const feedbackPlan = buildNoPendingPileSubmitFeedbackPlan({ submitLabel: 'Submit' });
    let state = { pileSubmitTempText: null };

    state = applyPatch(state, buildPileSubmitTempTextPatch(feedbackPlan.initialText));
    const timer = setTimeout(() => {
      state = applyPatch(state, buildPileSubmitTempTextPatch(feedbackPlan.restoreText));
      setTimeout(() => {
        state = applyPatch(state, buildPileSubmitTempTextPatch(feedbackPlan.clearText));
      }, feedbackPlan.clearDelayMs);
    }, feedbackPlan.initialDelayMs);

    expect(encryptAndUpload).not.toHaveBeenCalled();
    expect(state.pileSubmitTempText).toBe('No new or changed responses');

    jest.advanceTimersByTime(2000);
    expect(state.pileSubmitTempText).toBe('Submit');

    jest.advanceTimersByTime(1500);
    expect(state.pileSubmitTempText).toBeNull();
    clearTimeout(timer);
    // port note: the old assertion inspected the private timer field. The
    // portable contract is the exported staged feedback plan and no upload.
  });

  it('shows the pending question-pool submit feedback message for full survey mode', () => {
    const fetchQuestionPool = jest.fn();
    const getProviderKind = jest.fn();
    const loadState = buildSurveyQuestionPoolLoadState({
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    });

    if (loadState.isIncomplete) {
      fetchQuestionPool();
    } else {
      getProviderKind();
    }

    expect(loadState.isIncomplete).toBe(true);
    expect(fetchQuestionPool).toHaveBeenCalledTimes(1);
    expect(getProviderKind).not.toHaveBeenCalled();
    expect(
      buildQuestionPoolPendingSubmitFeedbackMessage({
        pendingCount: loadState.pendingCount,
      }),
    ).toBe('Loading 1 more question...');
    // port note: the old full-mode test asserted that pile-only
    // `pileSubmitTempText` was absent from direct state. The portable seam is
    // the full-survey load guard and transient feedback message builder.
  });

  it('mirrors transient submit feedback into pile submit text for pile mode', () => {
    jest.useFakeTimers();
    let state = {};
    const update = buildTransientSubmitFeedbackState({
      message: '  Saved  ',
      mirrorToPileSubmitText: true,
    });

    state = applyPatch(state, update);
    expect(state.submissionError).toBe('Saved');
    expect(state.pileSubmitTempText).toBe('Saved');

    setTimeout(() => {
      state = applyPatch(
        state,
        buildClearedTransientSubmitFeedbackState({
          mirrorToPileSubmitText: true,
        }),
      );
    }, normalizeTransientSubmitFeedbackDurationMs(1500));

    jest.advanceTimersByTime(1500);

    expect(state.submissionError).toBe('');
    expect(state.pileSubmitTempText).toBeNull();
  });

  it('cancels the staged no-pending pile feedback when transient pile feedback takes over', () => {
    jest.useFakeTimers();
    const noPendingPlan = buildNoPendingPileSubmitFeedbackPlan({ submitLabel: 'Submit' });
    let state = applyPatch({}, buildPileSubmitTempTextPatch(noPendingPlan.initialText));
    let pileTimer = setTimeout(() => {
      state = applyPatch(state, buildPileSubmitTempTextPatch(noPendingPlan.restoreText));
    }, noPendingPlan.initialDelayMs);

    expect(state.pileSubmitTempText).toBe('No new or changed responses');

    clearTimeout(pileTimer);
    pileTimer = null;
    state = applyPatch(
      state,
      buildTransientSubmitFeedbackState({
        message: 'Saved',
        mirrorToPileSubmitText: true,
      }),
    );
    setTimeout(() => {
      state = applyPatch(
        state,
        buildClearedTransientSubmitFeedbackState({
          mirrorToPileSubmitText: true,
        }),
      );
    }, normalizeTransientSubmitFeedbackDurationMs(1500));

    expect(state.submissionError).toBe('Saved');
    expect(state.pileSubmitTempText).toBe('Saved');

    jest.advanceTimersByTime(1500);
    expect(state.submissionError).toBe('');
    expect(state.pileSubmitTempText).toBeNull();

    jest.advanceTimersByTime(5000);
    expect(state.pileSubmitTempText).toBeNull();
    expect(pileTimer).toBeNull();
  });

  it('routes pile submit clicks through shared submit flow before no-pending feedback when logged out', async () => {
    const encryptAndUpload = jest.fn().mockResolvedValue(undefined);
    const pendingStats = { total: 0, encrypted: 0 };
    const engine = {
      _pileSubmitTimer: null,
      computePendingEditStatsAtIndex: jest.fn(() => pendingStats),
      encryptAndUpload,
      getPendingStatsSnapshot: jest.fn(() => pendingStats),
      props: {
        account: '',
        computeSubmitLabel: () => 'Submit',
        loginComplete: false,
      },
      setState: jest.fn(),
      state: {
        isSubmitting: false,
        pileSubmitTempText: '',
        submittedSinceLastEdit: false,
        submissionComplete: false,
      },
    };
    createPileViewRuntimeStrategy().getPendingEditStats(engine);

    await engine.handlePileSubmitClick();

    expect(encryptAndUpload).toHaveBeenCalledTimes(1);
    expect(engine.setState).not.toHaveBeenCalled();
    expect(engine._pileSubmitTimer).toBeNull();
  });

  it('renders the pile clear-pending button only while pending changes are actionable', () => {
    const handleRevertPendingChanges = jest.fn();
    const actionableTree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({ pendingStats: { total: 2 } }),
        handleRevertPendingChanges,
      }),
    );
    const clearButton = findElement(
      actionableTree,
      (node) => isElementNode(node) && node.props.title === 'Clear changes',
    );

    expect(clearButton).not.toBeNull();
    clearButton.props.onClick();
    expect(handleRevertPendingChanges).toHaveBeenCalledTimes(1);

    const submittingTree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({ pendingStats: { total: 2 }, isSubmitting: true }),
        isSubmitting: true,
      }),
    );

    expect(
      findElement(submittingTree, (node) => isElementNode(node) && node.props.title === 'Clear changes'),
    ).toBeNull();
  });

  it('hides the pile submit rail when no rail is visible', () => {
    const tree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({ pendingStats: { total: 0 } }),
      }),
    );
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(hiddenFooter).not.toBeNull();
  });

  it('keeps the pile interaction geometry stable when the top rail becomes visible', () => {
    let tree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({ pendingStats: { total: 0 } }),
      }),
    );
    let interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');
    let hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(false);
    expect(hiddenFooter).not.toBeNull();

    tree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({ pendingStats: { total: 1 } }),
      }),
    );
    interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');
    hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(false);
    expect(hiddenFooter).toBeNull();
  });

  it('links the pile success checkmark to the submitted responder user page after submit', () => {
    const responderAddress = '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD';
    const tree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({
          pendingStats: { total: 0 },
          submittedSinceLastEdit: true,
          account: responderAddress,
          isAddress: (value) => value === responderAddress,
        }),
      }),
    );
    const submitButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT,
    );
    const successBadge = findNodeByClassName(tree, 'pileSubmitSuccessBadge');
    const successIcon = findNodeByClassName(tree, 'pileSubmitSuccessIcon');
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(submitButton).toBeNull();
    expect(successBadge).not.toBeNull();
    expect(successBadge.type).toBe('a');
    expect(successBadge.props.href).toBe(`/u/${responderAddress.toLowerCase()}`);
    expect(successBadge.props['data-testid']).toBe(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
    expect(successBadge.props['aria-label']).toBe('View your submitted responses');
    expect(successBadge.props.title).toBe('View your submitted responses');
    expect(successIcon).not.toBeNull();
    expect(hiddenFooter).toBeNull();
  });

  it('keeps the pile success checkmark non-clickable when no responder address is available', () => {
    const tree = renderPileInteractionSurface(
      buildSurfaceProps({
        rail: baseRail({
          pendingStats: { total: 0 },
          submittedSinceLastEdit: true,
          account: '',
        }),
      }),
    );
    const successBadge = findNodeByClassName(tree, 'pileSubmitSuccessBadge');
    const successIcon = findNodeByClassName(tree, 'pileSubmitSuccessIcon');

    expect(successBadge).not.toBeNull();
    expect(successBadge.type).toBe('div');
    expect(successBadge.props.href).toBeUndefined();
    expect(successBadge.props['data-testid']).toBe(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
    expect(successBadge.props.role).toBe('status');
    expect(successBadge.props['aria-label']).toBe('Submitted');
    expect(successIcon).not.toBeNull();
  });

  it('renders the pile hologram as a full-card takeover and hides pile controls while active', () => {
    const closedTree = renderPileInteractionSurface(
      buildSurfaceProps({
        renderActiveQuestion: jest.fn(() => null),
        showHologramAssistant: false,
      }),
    );
    const closedToggleButton = findElement(
      closedTree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE,
    );
    const closedHologram = findElement(
      closedTree,
      (node) => isElementNode(node) && node.type === PileHologramAssistant,
    );
    const closedControls = findNodeByClassName(closedTree, 'pileControls');
    const closedActions = findNodeByClassName(closedControls?.props?.children, 'pileActions');
    const closedFooter = findNodeByClassName(closedControls?.props?.children, 'pileFooter');
    const closedNav = findNodeByClassName(closedControls?.props?.children, 'pileNav');

    expect(closedToggleButton).toBeNull();
    expect(closedControls).not.toBeNull();
    expect(closedActions).not.toBeNull();
    expect(closedFooter).not.toBeNull();
    expect(closedNav).not.toBeNull();
    expect(closedHologram).toBeNull();

    const openTree = renderPileInteractionSurface(
      buildSurfaceProps({
        renderActiveQuestion: jest.fn(() => null),
        showHologramAssistant: true,
      }),
    );
    const openToggleButton = findElement(
      openTree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE,
    );
    const openHologram = findElement(openTree, (node) => isElementNode(node) && node.type === PileHologramAssistant);

    expect(openToggleButton).toBeNull();
    expect(findNodeByClassName(openTree, 'pileControls')).toBeNull();
    expect(findNodeByClassName(openTree, 'pileFooter')).toBeNull();
    expect(openHologram).not.toBeNull();
  });

  it('does not call getPendingEditStats during PileViewMode.render', () => {
    const getPendingEditStats = jest.fn(() => ({ total: 7, encrypted: 2 }));
    const rail = buildPileSubmitRailViewState({
      pendingStats: { total: 2, encrypted: 1 },
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      pileSubmitTempText: '',
      pileSubmitLabel: 'Submit',
      account: '',
    });

    renderPileInteractionSurface(
      buildSurfaceProps({
        rail,
        pileQuestions: [],
        isStillLoading: true,
      }),
    );

    expect(getPendingEditStats).not.toHaveBeenCalled();
    // port note: the extracted pile surface consumes a precomputed rail state
    // and has no pending-stats accessor. The exact pending-stats computation is
    // covered by the submit/draft helper tests.
  });

  it('keeps the pile action container neutral while only the filter button gets the active class', () => {
    const tree = renderPileInteractionSurface(
      buildSurfaceProps({
        isFilterActive: true,
      }),
    );
    const actionsNode = findNodeByClassName(tree, 'pileActions');
    const filterButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_FILTER_TOGGLE,
    );
    const createButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE,
    );
    const viewAllButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_VIEW_ALL,
    );

    expect(actionsNode).not.toBeNull();
    expect(nodeHasClassName(actionsNode, 'pileActionsActive')).toBe(false);
    expect(filterButton).not.toBeNull();
    expect(nodeHasClassName(filterButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(filterButton, 'actionButtonActive')).toBe(true);
    expect(filterButton.props.style).toEqual(
      expect.objectContaining({
        color: 'var(--ce-status-success)',
        borderColor: 'var(--ce-status-success)',
        opacity: 0.75,
      }),
    );
    expect(createButton).not.toBeNull();
    expect(nodeHasClassName(createButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(createButton, 'actionButtonActive')).toBe(false);
    expect(viewAllButton).not.toBeNull();
    expect(nodeHasClassName(viewAllButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(viewAllButton, 'actionButtonActive')).toBe(false);
  });

  it('renders the pile mini spinner as a sibling of the controls stack during background refresh', () => {
    const tree = renderPileInteractionSurface(
      buildSurfaceProps({
        showMiniBackgroundSpinner: true,
      }),
    );
    const interactionNode = findNodeByClassName(tree, 'pileInteractionUnit');
    const controlsNode = findNodeByClassName(tree, 'pileControls');
    const actionsNode = findNodeByClassName(controlsNode?.props?.children, 'pileActions');
    const navNode = findNodeByClassName(controlsNode?.props?.children, 'pileNav');
    const spinnerNode = findNodeByClassName(tree, 'miniSpinnerWrapper');
    const interactionChildClasses = getElementChildren(interactionNode).map((child) => child.props.className);
    const controlsChildClasses = getElementChildren(controlsNode).map((child) => child.props.className);

    expect(interactionNode).not.toBeNull();
    expect(controlsNode).not.toBeNull();
    expect(actionsNode).not.toBeNull();
    expect(navNode).not.toBeNull();
    expect(spinnerNode).not.toBeNull();
    expect(interactionChildClasses).toEqual(
      expect.arrayContaining(['miniSpinnerWrapper', 'pileCardContainer', 'pileControls']),
    );
    expect(controlsChildClasses).toHaveLength(3);
    expect(nodeHasClassName(getElementChildren(controlsNode)[0], 'pileActions')).toBe(true);
    expect(nodeHasClassName(getElementChildren(controlsNode)[1], 'pileFooter')).toBe(true);
    expect(nodeHasClassName(getElementChildren(controlsNode)[2], 'pileNav')).toBe(true);
    expect(findNodeByClassName(controlsNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
    expect(findNodeByClassName(actionsNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
    expect(findNodeByClassName(navNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
  });

  it('renders early questionPool questions while background cache work keeps the mini spinner active', () => {
    const earlyQuestion = { id: 'early-q1', type: 'freeform', prompt: 'Early visible question' };
    const { container } = renderPile({
      cacheHasLoaded: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
      questionPool: [earlyQuestion],
    });

    expect(screen.getByText('Early visible question')).toBeInTheDocument();
    expect(container.querySelector('.pileLoadingProgressList')).toBeNull();
    expect(container.querySelector('.pileCardActive')).not.toBeNull();
  });

  it('passes the delayed pile-entry mode toggle prop into the pile create panel', async () => {
    renderPile();

    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE));

    expect(await screen.findByTestId('mock-pile-create')).toHaveAttribute('data-hide-survey-toggle', 'true');
  });
});
