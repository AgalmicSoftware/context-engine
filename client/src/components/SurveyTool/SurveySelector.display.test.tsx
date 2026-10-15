import {
  SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
  SURVEY_SELECTOR_CREATE_BUTTON_STYLE,
  SURVEY_SELECTOR_HEADER_SUBMIT_SPINNER_STYLE,
  SurveySelector,
  buildSurveySelectorDropdownItemClassName,
  buildSurveySelectorHeaderSubmitButtonClassName,
  resolveSurveySelectorFilterButtonStyle,
  resolveSurveySelectorFilterIconStyle,
} from './SurveySelector';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { fireEvent, render, screen } from '@testing-library/react';

const syncClassSetState = (subject: any) => {
  subject.setState = jest.fn((next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

const findElement = (node: any, predicate: (candidate: any) => boolean): any => {
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

const nodeHasClassName = (node: any, className: string): boolean => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const treeHasText = (node: any, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

describe('SurveySelector display guards', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('builds SurveySelector display classes and header styles', () => {
    expect(resolveSurveySelectorFilterButtonStyle(true)).toEqual({
      color: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
      borderColor: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
    });
    expect(resolveSurveySelectorFilterButtonStyle(false)).toEqual({});
    expect(resolveSurveySelectorFilterIconStyle(true)).toEqual({
      color: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
    });
    expect(resolveSurveySelectorFilterIconStyle(false)).toEqual({});
    expect(SURVEY_SELECTOR_CREATE_BUTTON_STYLE).toEqual({ marginLeft: '10px' });
    expect(SURVEY_SELECTOR_HEADER_SUBMIT_SPINNER_STYLE).toEqual({ marginLeft: 8 });
    expect(buildSurveySelectorDropdownItemClassName(styles, 'questions')).toBe(
      `${styles.dropdownItem} ${styles.questionsItem}`,
    );
    expect(buildSurveySelectorDropdownItemClassName(styles, 'survey')).toBe(
      `${styles.dropdownItem} ${styles.surveyItem}`,
    );
    expect(buildSurveySelectorHeaderSubmitButtonClassName(styles)).toBe(
      `${styles.headerSubmitButton} ${styles.submitGlow}`,
    );
  });

  it('does not render the SurveySelector header progress bar during background scanning', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: false,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      account: '0xabc',
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 100,
        remainingBlocks: 40,
        scannedBlocks: 60,
      },
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showLongLoading: false,
    };

    const tree = subject.render();

    expect(treeHasText(tree, 'Scanning...')).toBe(false);
    expect(treeHasText(tree, 'blocks left')).toBe(false);
    expect(treeHasText(tree, 'items left')).toBe(false);
    expect(treeHasText(tree, '60 / 100')).toBe(false);
  });

  it('exposes a stable hook for the questions toolbar', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showLongLoading: false,
    };

    const toolbar = findElement(
      subject.render(),
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_TOOLBAR,
    );

    expect(toolbar).toBeTruthy();
    expect(toolbar.props.id).toBe(styles.surveysRow);
  });

  it('marks the embedded session toolbar for the wider tablet layout', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      embeddedSessionToolbar: true,
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showLongLoading: false,
    };

    const toolbar = findElement(
      subject.render(),
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_TOOLBAR,
    );

    expect(toolbar).toBeTruthy();
    expect(nodeHasClassName(toolbar, styles.embeddedSessionToolbar)).toBe(true);
    expect(nodeHasClassName(toolbar, styles.toolbarWithoutSubmit)).toBe(true);
  });

  it('places one live toolbar in the Explorer header without moving its state ownership', () => {
    const toolbarTarget = document.createElement('div');
    document.body.appendChild(toolbarTarget);
    const subject = new SurveySelector({
      toolbarTarget,
      preventUrlChange: true,
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      network: { id: 11155420 },
    });
    syncClassSetState(subject);
    subject.state = { ...subject.state, loading: false };
    const getToolbarPortal = () => findElement(subject.render(), (node) => node?.containerInfo === toolbarTarget);
    expect(getToolbarPortal()).toBeTruthy();
    const rendered = render(getToolbarPortal());

    expect(screen.getAllByTestId(E2E_TESTIDS.SURVEY_TOOLBAR)).toHaveLength(1);
    expect(toolbarTarget).toContainElement(screen.getByTestId(E2E_TESTIDS.SURVEY_TOOLBAR));
    expect(rendered.container).toBeEmptyDOMElement();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_CREATE_TOGGLE));
    expect(subject.state.createSurveyMode).toBe(true);
    rendered.rerender(getToolbarPortal());
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_CREATE_TOGGLE));
    expect(subject.state.createSurveyMode).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Filter questions' }));
    expect(subject.state.filterModalOpen).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Results' }));
    expect(subject.state.showResults).toBe(true);

    rendered.unmount();
    expect(toolbarTarget).toBeEmptyDOMElement();
    toolbarTarget.remove();
  });

  it('renders the SurveySelector header submit CTA with submitGlow when pending edits exist', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      embeddedSessionToolbar: true,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showLongLoading: false,
      pendingSubmitStats: {
        total: 2,
        encrypted: 1,
        submittedSinceLastEdit: false,
        isSubmitting: false,
      },
    };

    const tree = subject.render();
    const headerSubmitButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT,
    );
    const toolbar = findElement(tree, (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_TOOLBAR);

    const revert = jest.fn();
    const target = { handleRevertPendingChanges: revert, state: { isSubmitting: false } };
    subject.surveyQuestionsRef = { current: target };
    const clear = findElement(tree, (element) => element?.props?.['aria-label'] === 'Clear pending changes');
    expect(clear).toBeTruthy();
    clear.props.onClick();
    expect(revert).toHaveBeenCalledTimes(1);
    target.state.isSubmitting = true;
    clear.props.onClick();
    expect(revert).toHaveBeenCalledTimes(1);
    expect(headerSubmitButton).toBeTruthy();
    expect(nodeHasClassName(headerSubmitButton, styles.headerSubmitButton)).toBe(true);
    expect(nodeHasClassName(headerSubmitButton, styles.submitGlow)).toBe(true);
    expect(nodeHasClassName(toolbar, styles.embeddedSessionToolbar)).toBe(true);
    expect(nodeHasClassName(toolbar, styles.toolbarWithoutSubmit)).toBe(false);
  });
});

it.each([{ showSpinner: true }, { showCacheError: true }])(
  'does not present an inconclusive zero as a confirmed count (%j)',
  (status) => {
    const subject = new SurveySelector({});
    const view = render(subject.renderQuestionSelectorLabel({ count: 0, ...status }));
    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
    view.rerender(subject.renderQuestionSelectorLabel({ count: 0 }));
    expect(screen.getByText('(0)')).toBeInTheDocument();
  },
);
