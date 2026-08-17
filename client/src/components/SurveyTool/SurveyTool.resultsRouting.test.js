import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SurveyTool from './SurveyTool';
import { SurveySelector } from './SurveySelector';

jest.mock('./SurveyResults', () => ({
  __esModule: true,
  default: ({ onClose }) =>
    jest.requireActual('react').createElement('button', { onClick: onClose }, 'Close functional results'),
}));

jest.mock('./SurveySelector', () => ({
  SurveySelector: () => jest.requireActual('react').createElement('div', { 'data-testid': 'mock-survey-selector' }),
}));

const REACT_LAZY_TYPE = Symbol.for('react.lazy');

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
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
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const findLazySurveyResultsNode = (node) =>
  findElement(
    node,
    (candidate) =>
      candidate?.type?.$$typeof === REACT_LAZY_TYPE &&
      Object.prototype.hasOwnProperty.call(candidate.props || {}, 'isOpen'),
  );

describe('SurveyTool results routing', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not auto-open SurveyTool results modal from ?results=true URL param', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/surveys?results=true');
    try {
      const subject = new SurveyTool({
        autoOpenResults: false,
        preventUrlChange: true,
      });

      expect(subject.state.showResultsModal).toBe(false);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('calls onResultsModalClose after closing the results modal', () => {
    const priorUrl = window.location.href;

    try {
      window.history.pushState({}, '', '/session/edge/questions/results');
      const onResultsModalClose = jest.fn();
      const subject = new SurveyTool({
        autoOpenResults: false,
        onResultsModalClose,
        preventUrlChange: true,
      });

      subject.setState = jest.fn((next) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
      });

      subject.closeResultsModal();

      expect(subject.setState).toHaveBeenCalledWith({ showResultsModal: false });
      expect(window.location.pathname).toBe('/session/edge/questions/results');
      expect(onResultsModalClose).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it.each([
    '/session/edge/questions/results',
    '/session/edge/questions/results/',
    '/session/edge/QUESTIONS/RESULTS',
    '/ce/session/edge/questions/results',
  ])('returns to the session root without dropping query or hash when closing results from %s', (resultsPath) => {
    const priorUrl = window.location.href;

    try {
      window.history.pushState(
        {},
        '',
        `${resultsPath}?worker=https%3A%2F%2Fworker.example.test&session=edge#responses`,
      );
      const subject = new SurveyTool({
        autoOpenResults: false,
        preventUrlChange: true,
      });

      subject.setState = jest.fn((next) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
      });

      subject.closeResultsModal();

      expect(subject.setState).toHaveBeenCalledWith({ showResultsModal: false });
      expect(window.location.pathname).toBe(resultsPath.startsWith('/ce/') ? '/ce/session/edge' : '/session/edge');
      expect(window.location.search).toBe('?worker=https%3A%2F%2Fworker.example.test&session=edge');
      expect(window.location.hash).toBe('#responses');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('preserves query and hash through the functional results close path', async () => {
    const priorUrl = window.location.href;
    try {
      window.history.pushState(
        {},
        '',
        '/ce/session/edge/questions/results?worker=https%3A%2F%2Fworker.example.test&session=edge#responses',
      );
      render(
        <SurveyTool autoOpenResults={true} preventUrlChange={true} activeSessionSlug="edge" network={{ id: 84532 }} />,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

      expect(window.location.pathname).toBe('/ce/session/edge');
      expect(window.location.search).toBe('?worker=https%3A%2F%2Fworker.example.test&session=edge');
      expect(window.location.hash).toBe('#responses');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('leaves functional results routing to an external close owner', async () => {
    const priorUrl = window.location.href;
    const onResultsModalClose = jest.fn();
    try {
      window.history.pushState({}, '', '/session/edge/questions/results?worker=external#owned');
      render(
        <SurveyTool
          autoOpenResults={true}
          preventUrlChange={true}
          activeSessionSlug="edge"
          network={{ id: 84532 }}
          onResultsModalClose={onResultsModalClose}
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

      expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
        '/session/edge/questions/results?worker=external#owned',
      );
      expect(onResultsModalClose).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps route-driven auto-open owned by SurveyTool instead of cascading it into SurveySelector', () => {
    const subject = new SurveyTool({
      autoOpenResults: true,
      surveyId: '0xABC',
      filterState: {},
      network: { id: 84532 },
      networkChainId: 11155420,
      activeSessionSlug: 'edge',
    });

    const tree = subject.render();
    const selectorNode = findElement(tree, (candidate) => candidate?.type === SurveySelector);
    const resultsNode = findLazySurveyResultsNode(tree);

    expect(selectorNode).toBeTruthy();
    expect(selectorNode.props.autoOpenResults).toBe(false);
    expect(resultsNode).toBeTruthy();
    expect(resultsNode.props.isOpen).toBe(true);
    expect(resultsNode.props.surveyId).toBe('0xabc');
    expect(resultsNode.props.networkChainId).toBe(11155420);
  });

  it('does not render orphaned results text and keeps embedded results props aligned', () => {
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };
    const subject = new SurveyTool({
      filterState: {},
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      hideEmbeddedDebugUi: true,
      questionScanProgress: progress,
    });

    const tree = subject.render();
    const resultsNode = findLazySurveyResultsNode(tree);

    expect(resultsNode).toBeTruthy();
    expect(resultsNode.props.sessionSlugPinned).toBe(true);
    expect(resultsNode.props.hideEmbeddedDebugUi).toBe(true);
    expect(resultsNode.props.questionScanProgress).toBe(progress);
    expect(treeHasText(tree, ')}')).toBe(false);
  });

  it('does not render a local SurveyTool session selector and keeps default global session resolution', () => {
    const subject = new SurveyTool({
      surveyId: '0xABC',
      filterState: {},
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlugPinned: false,
    });

    const initialTree = subject.render();
    const initialSelectorNode = findElement(initialTree, (candidate) => candidate?.type === SurveySelector);

    expect(treeHasDataTestId(initialTree, 'ce-surveytool-session-selector')).toBe(false);
    expect(treeHasDataTestId(initialTree, 'ce-surveytool-session-selector-toggle')).toBe(false);
    expect(treeHasDataTestId(initialTree, 'ce-surveytool-session-selector-panel')).toBe(false);
    expect(treeHasDataTestId(initialTree, 'ce-surveytool-session-selector-backdrop')).toBe(false);
    expect(initialSelectorNode.props.sessionSlug).toBeUndefined();
  });

  it('does not render a local session selector in embedded one-page-demo mode', () => {
    const subject = new SurveyTool({
      surveyId: '0xABC',
      filterState: {},
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      hideSessionSelector: true,
      preventUrlChange: true,
      miniMode: true,
    });

    const tree = subject.render();

    expect(treeHasDataTestId(tree, 'ce-surveytool-session-selector')).toBe(false);
    expect(treeHasDataTestId(tree, 'ce-surveytool-session-selector-toggle')).toBe(false);
  });

  it('does not render a local session selector on routed SurveyPage surfaces that prevent URL writes', () => {
    const subject = new SurveyTool({
      surveyId: '0xABC',
      filterState: {},
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      preventUrlChange: true,
    });

    const tree = subject.render();

    expect(treeHasDataTestId(tree, 'ce-surveytool-session-selector')).toBe(false);
    expect(treeHasDataTestId(tree, 'ce-surveytool-session-selector-toggle')).toBe(false);
  });

  it('preserves filter query and session slug when SurveyTool updates results URL state', () => {
    const priorUrl = window.location.href;
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    try {
      window.history.replaceState({}, '', '/surveys');
      const subject = new SurveyTool({
        surveyId: '0xABC',
        activeSessionSlug: 'edge',
        preventUrlChange: false,
      });

      subject.handleTopLevelFilterStateUrlUpdate({ questionTypes: ['binary'] });

      const nextUrl = String(replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1]?.[2] || '');
      expect(nextUrl).toContain('/survey/0xabc/results');
      expect(nextUrl).toContain('filter=');
      expect(nextUrl).toContain('session=edge');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('preserves question-results session pins and avoids hardcoded session subroutes when SurveyTool updates URL state', () => {
    const priorUrl = window.location.href;
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    try {
      window.history.replaceState({}, '', '/session/edge/questions/results');
      const subject = new SurveyTool({
        activeSessionSlug: 'edge',
        preventUrlChange: false,
      });

      subject.handleTopLevelFilterStateUrlUpdate({ questionTypes: ['binary'] });

      const nextUrl = String(replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1]?.[2] || '');
      expect(nextUrl).toContain('/questions/results');
      expect(nextUrl).toContain('filter=');
      expect(nextUrl).toContain('session=edge');
      expect(nextUrl).not.toContain('/session/edge/questions/results');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('uses an explicit SurveyTool session prop when updating the results URL state', () => {
    const priorUrl = window.location.href;
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    try {
      window.history.replaceState({}, '', '/surveys');
      const subject = new SurveyTool({
        surveyId: '0xABC',
        activeSessionSlug: 'edge',
        sessionSlug: 'rxc',
        preventUrlChange: false,
      });

      subject.handleTopLevelFilterStateUrlUpdate({ questionTypes: ['binary'] });

      const nextUrl = String(replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1]?.[2] || '');
      expect(nextUrl).toContain('/survey/0xabc/results');
      expect(nextUrl).toContain('session=rxc');
      expect(nextUrl).not.toContain('session=edge');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });
});
