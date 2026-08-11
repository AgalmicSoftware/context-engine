import React from 'react';

import PileHologramAssistant from './PileHologramAssistant';
import {
  PILE_LOADING_ICON_WRAP_STYLE,
  PILE_SCAN_ERROR_DETAIL_STYLE,
  buildPileActionsClassName,
  buildPileCardClassName,
  buildPileFilterButtonClassName,
  buildPileFooterClassName,
  buildPileHologramToggleClassName,
  buildPileSubmitButtonClassName,
  renderPileInteractionSurface,
  resolvePileCardStatusClassName,
  resolvePileFilterButtonStyle,
  resolvePileFilterIconStyle,
  resolvePileLoadingProgressFillStyle,
  resolvePileMiniLoaderStyle,
  resolvePileNavCounterStyle,
  shouldCollapsePileActionsIntoMenu,
  type PileInteractionSurfaceProps,
  type PileQuestionLike,
} from './surveyPileInteractionSurface';
import styles from './SurveyTool.module.scss';

type TestTreeNode = React.ReactNode;
type TestElementNode = React.ReactElement<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}>;
type TestTreePredicate = (node: unknown) => boolean;

const isElementNode = (node: unknown): node is TestElementNode => React.isValidElement(node);

const findElement = (node: TestTreeNode, predicate: TestTreePredicate): unknown => {
  const stack: unknown[] = [node];
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

const nodeHasClassName = (node: unknown, className: string): boolean => {
  if (!isElementNode(node)) return false;
  const value = node.props.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node: TestTreeNode, className: string): TestElementNode | null =>
  findElement(node, (candidate) => nodeHasClassName(candidate, className)) as TestElementNode | null;

const countElements = (node: TestTreeNode, predicate: TestTreePredicate): number => {
  let count = 0;
  const stack: unknown[] = [node];

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
    if (predicate(current)) count += 1;
    if (!isElementNode(current)) continue;
    const children = current.props.children;
    if (children !== undefined) stack.push(children);
  }

  return count;
};

const treeHasText = (node: TestTreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (!isElementNode(node)) return false;
  return treeHasText(node.props.children, text);
};

const collectTreeText = (node: TestTreeNode): string => {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(collectTreeText).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!isElementNode(node)) return '';
  return collectTreeText(node.props.children);
};

const treeTextIncludes = (node: TestTreeNode, text: string): boolean => collectTreeText(node).includes(text);

const getElementChildren = (node: TestTreeNode): TestElementNode[] => {
  if (!isElementNode(node)) return [];
  const children = node.props.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter(isElementNode);
};

const buildBaseProps = (): PileInteractionSurfaceProps => ({
  showHologramAssistant: false,
  toggleHologramAssistant: jest.fn(),
  showMiniBackgroundSpinner: false,
  priorResponsesHydrating: false,
  showLongLoading: false,
  loadingElapsedSec: 0,
  pileQuestions: [],
  activePileIndex: 0,
  renderActiveQuestion: jest.fn(() => <div data-testid="active-question" />),
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
  onViewAllClick: jest.fn(),
  handleViewAllFromPile: jest.fn(),
  pileTopRailVisible: true,
  showSuccessBadgeLink: false,
  pileSubmitResponderHref: '',
  showSuccessBadgeStatus: false,
  showSubmitButton: true,
  handlePileSubmitClick: jest.fn(),
  hasPendingPileChanges: true,
  shouldHidePileSubmitButton: false,
  isSubmitting: false,
  activePromptMasked: false,
  finalSubmitText: 'Submit',
  showClearPendingButton: false,
  handleRevertPendingChanges: jest.fn(),
  navCounterVisible: true,
  handlePrev: jest.fn(),
  handleNext: jest.fn(),
});

describe('surveyPileInteractionSurface', () => {
  it('builds pile display classes and styles', () => {
    expect(PILE_SCAN_ERROR_DETAIL_STYLE).toEqual({ opacity: 0.8, marginTop: 8 });
    expect(PILE_LOADING_ICON_WRAP_STYLE).toEqual({
      fontSize: '2.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
    });
    expect(resolvePileNavCounterStyle(true)).toEqual({
      opacity: 0.8,
      transition: 'opacity 0.5s ease-in-out',
    });
    expect(resolvePileNavCounterStyle(false)).toEqual({
      opacity: 0,
      transition: 'opacity 0.5s ease-in-out',
    });
    expect(resolvePileFilterButtonStyle(true)).toEqual({
      color: 'var(--ce-status-success)',
      borderColor: 'var(--ce-status-success)',
      opacity: 0.75,
    });
    expect(resolvePileFilterButtonStyle(false)).toEqual({});
    expect(resolvePileFilterIconStyle(true)).toEqual({ color: 'var(--ce-status-success)' });
    expect(resolvePileFilterIconStyle(false)).toEqual({});
    expect(buildPileFilterButtonClassName(styles, true)).toBe(`${styles.actionButton} ${styles.actionButtonActive}`);
    expect(buildPileActionsClassName(styles, true)).toBe(`${styles.pileActions} ${styles.pileActionsMenuEligible}`);
    expect(buildPileActionsClassName(styles, false)).toBe(styles.pileActions);
    expect(buildPileFooterClassName(styles, false)).toBe(`${styles.pileFooter} ${styles.pileFooterHidden}`);
    expect(buildPileSubmitButtonClassName(styles, true, true)).toBe(
      `${styles.pileSubmitButton} ${styles.submitGlow} ${styles.pileSubmitButtonInactive}`,
    );
    expect(resolvePileCardStatusClassName(styles, 0)).toBe(styles.pileCardActive);
    expect(resolvePileCardStatusClassName(styles, 1)).toBe(styles.pileCardNext);
    expect(resolvePileCardStatusClassName(styles, -1)).toBe(styles.pileCardPrev);
    expect(resolvePileCardStatusClassName(styles, 2)).toBe(styles.pileCardAfter);
    expect(resolvePileCardStatusClassName(styles, -2)).toBe(styles.pileCardBefore);
    expect(buildPileCardClassName(styles, styles.pileCardActive)).toBe(`${styles.pileCard} ${styles.pileCardActive}`);
    expect(
      resolvePileLoadingProgressFillStyle({
        isHydrating: true,
        hydrateDone: 3,
        hydrateDiscovered: 5,
        scanPercent: 80,
      }),
    ).toEqual({ width: '60%' });
    expect(
      resolvePileLoadingProgressFillStyle({
        isHydrating: false,
        hydrateDone: 0,
        hydrateDiscovered: 0,
        scanPercent: 72,
      }),
    ).toEqual({ width: '72%' });
    expect(buildPileHologramToggleClassName(styles, true)).toBe(
      `${styles.pileHologramToggle} ${styles.pileHologramToggleActive}`,
    );
    expect(resolvePileMiniLoaderStyle(true)).toEqual({ opacity: 0.5 });
    expect(resolvePileMiniLoaderStyle(false)).toEqual({ opacity: 1 });
    expect(
      shouldCollapsePileActionsIntoMenu({
        pileTopRailVisible: true,
        showSubmitButton: true,
        hasPendingPileChanges: true,
        isSubmitting: false,
        shouldHidePileSubmitButton: false,
      }),
    ).toBe(true);
    expect(
      shouldCollapsePileActionsIntoMenu({
        pileTopRailVisible: true,
        showSubmitButton: true,
        hasPendingPileChanges: false,
        isSubmitting: false,
        shouldHidePileSubmitButton: true,
      }),
    ).toBe(false);
  });

  it('renders the gated empty panel before the generic empty copy when gating is active', () => {
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      pileQuestions: [],
      showGatedEmptyState: true,
      gatedEmptyPanel: <div data-testid="gated-empty">Locked by gate</div>,
    });

    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'gated-empty'),
    ).not.toBeNull();
    expect(treeHasText(tree, 'No questions available.')).toBe(false);
  });

  it('renders the pile loading empty state with progress copy and fill width', () => {
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      pileQuestions: [],
      isStillLoading: true,
      loadingElapsedSec: 12,
      isHydrating: true,
      hydrateDone: 3,
      hydrateDiscovered: 5,
      scanTotalBlocks: 20,
      pileScanDisplay: {
        metaLeftText: 'ignored left',
        metaRightText: 'ignored right',
      },
      scanPercent: 80,
    });

    const loadingHeadline = findNodeByClassName(tree, 'pileLoadingHeadline');
    const loadingSubhead = findNodeByClassName(tree, 'pileLoadingSubhead');
    const progressList = findNodeByClassName(tree, 'pileLoadingProgressList');
    const progressFillCount = countElements(tree, (node) => nodeHasClassName(node, 'pileLoadingProgressFill'));
    const progressFill = findElement(tree, (node) =>
      nodeHasClassName(node, 'pileLoadingProgressFill'),
    ) as TestElementNode | null;

    expect(treeTextIncludes(loadingHeadline, 'Loading... 12s')).toBe(true);
    expect(treeHasText(loadingSubhead, 'Loading Metadata (3 / 5)')).toBe(true);
    expect(progressList).toBeNull();
    expect(progressFillCount).toBe(1);
    expect(progressFill?.props?.style).toEqual(
      expect.objectContaining({
        width: '60%',
      }),
    );
    expect(treeHasText(tree, 'Session')).toBe(false);
    expect(treeHasText(tree, 'Groups')).toBe(false);
    expect(treeHasText(tree, 'Questions')).toBe(false);
    expect(treeHasText(tree, 'Responses')).toBe(false);
  });

  it('keeps the dev-style timer-only loading copy when scan and hydration counters are unavailable', () => {
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      pileQuestions: [],
      isStillLoading: true,
      loadingElapsedSec: 101,
      isHydrating: false,
      hydrateDone: 0,
      hydrateDiscovered: 0,
      scanTotalBlocks: 0,
      pileScanDisplay: {
        metaLeftText: '',
        metaRightText: '',
      },
      scanPercent: 0,
    });

    const progressList = findNodeByClassName(tree, 'pileLoadingProgressList');
    const progressFillCount = countElements(tree, (node) => nodeHasClassName(node, 'pileLoadingProgressFill'));
    const activeRowCount = countElements(
      tree,
      (node) => isElementNode(node) && node.props['data-progress-status'] === 'active',
    );

    expect(treeTextIncludes(tree, 'Loading... 101s')).toBe(true);
    expect(progressList).toBeNull();
    expect(progressFillCount).toBe(0);
    expect(activeRowCount).toBe(0);
    expect(treeHasText(tree, 'Session')).toBe(false);
    expect(treeHasText(tree, 'Groups')).toBe(false);
    expect(treeHasText(tree, 'Questions')).toBe(false);
    expect(treeHasText(tree, 'Responses')).toBe(false);
    expect(treeHasText(tree, 'Loading session data')).toBe(false);
  });

  it('renders a windowed pile deck with controls stacked under the cards', () => {
    const renderActiveQuestion = jest.fn((question: PileQuestionLike) => (
      <div data-testid={`active-${question.id}`}>{question.prompt}</div>
    ));
    const toggleListeningPanel = jest.fn();
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      showMiniBackgroundSpinner: true,
      showListeningPanel: true,
      toggleListeningPanel,
      pileQuestions: [
        { id: 'q1', prompt: 'Q1' },
        { id: 'q2', prompt: 'Q2' },
        { id: 'q3', prompt: 'Q3' },
        { id: 'q4', prompt: 'Q4' },
        { id: 'q5', prompt: 'Q5' },
        { id: 'q6', prompt: 'Q6' },
      ],
      activePileIndex: 3,
      renderActiveQuestion,
    });

    const controlsNode = findNodeByClassName(tree, 'pileControls');
    const spinnerNode = findNodeByClassName(tree, 'miniSpinnerWrapper');
    const deckCardCount = countElements(tree, (node) => nodeHasClassName(node, 'pileCard'));
    const controlsChildren = getElementChildren(controlsNode);

    expect(renderActiveQuestion).toHaveBeenCalledTimes(1);
    expect(renderActiveQuestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'q4' }));
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'active-q4'),
    ).not.toBeNull();
    expect(deckCardCount).toBe(5);
    expect(spinnerNode).not.toBeNull();
    expect(controlsNode).not.toBeNull();
    expect(controlsChildren).toHaveLength(3);
    expect(nodeHasClassName(controlsChildren[0], 'pileActions')).toBe(true);
    expect(nodeHasClassName(controlsChildren[0], 'pileActionsMenuEligible')).toBe(true);
    expect(nodeHasClassName(controlsChildren[1], 'pileFooter')).toBe(true);
    expect(nodeHasClassName(controlsChildren[2], 'pileNav')).toBe(true);
    expect(findNodeByClassName(tree, 'pileActionMenuToggle')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileActionButtonGroup')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileWindowTitlebar')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileWindowClose')).not.toBeNull();
    expect(treeTextIncludes(tree, 'Question 4 of 6')).toBe(true);

    const listeningToggle = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === 'ce-session-listening-toggle',
    ) as TestElementNode | null;
    expect(listeningToggle).not.toBeNull();
    expect(listeningToggle?.props['aria-pressed']).toBe(true);
    expect(nodeHasClassName(listeningToggle, 'actionButtonActive')).toBe(true);
    (listeningToggle?.props.onClick as () => void)();
    expect(toggleListeningPanel).toHaveBeenCalledTimes(1);
  });

  it('leaves pile actions inline when the submit rail is inactive', () => {
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      hasPendingPileChanges: false,
      pileTopRailVisible: false,
      shouldHidePileSubmitButton: true,
      pileQuestions: [{ id: 'q1', prompt: 'Q1' }],
    });

    const actionsNode = findNodeByClassName(tree, 'pileActions');

    expect(actionsNode).not.toBeNull();
    expect(nodeHasClassName(actionsNode, 'pileActionsMenuEligible')).toBe(false);
    expect(findNodeByClassName(tree, 'pileActionMenuToggle')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileActionButtonGroup')).not.toBeNull();
  });

  it('renders the hologram takeover instead of the pile controls when active', () => {
    const renderActiveQuestion = jest.fn(() => <div data-testid="active-question" />);
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      showHologramAssistant: true,
      showMiniBackgroundSpinner: true,
      pileQuestions: [{ id: 'q1', prompt: 'Q1' }],
      renderActiveQuestion,
    });

    expect(findElement(tree, (node) => isElementNode(node) && node.type === PileHologramAssistant)).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileControls')).toBeNull();
    expect(findNodeByClassName(tree, 'miniSpinnerWrapper')).toBeNull();
    expect(renderActiveQuestion).not.toHaveBeenCalled();
  });
});
