import React from 'react';

import PileHologramAssistant from './PileHologramAssistant';
import {
  renderPileInteractionSurface,
  type PileInteractionSurfaceProps,
  type PileQuestionLike,
} from './surveyPileInteractionSurface';

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

const findNodeByClassName = (node: TestTreeNode, className: string): TestElementNode | null => (
  (findElement(node, (candidate) => nodeHasClassName(candidate, className)) as TestElementNode | null)
);

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
  it('renders the gated empty panel before the generic empty copy when gating is active', () => {
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      pileQuestions: [],
      showGatedEmptyState: true,
      gatedEmptyPanel: <div data-testid="gated-empty">Locked by gate</div>,
    });

    expect(findElement(tree, (node) => (
      isElementNode(node) && node.props['data-testid'] === 'gated-empty'
    ))).not.toBeNull();
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
    const progressMeta = findNodeByClassName(tree, 'pileLoadingProgressMeta');
    const progressFill = findNodeByClassName(tree, 'pileLoadingProgressFill');

    expect(loadingHeadline?.props?.children).toEqual(expect.arrayContaining([
      'Loading... ',
      12,
      's',
    ]));
    expect(loadingSubhead?.props?.children).toBe('Loading Metadata (3 / 5)');
    expect(treeHasText(progressMeta, '2 items left')).toBe(true);
    expect(treeHasText(progressMeta, '3 / 5')).toBe(true);
    expect(progressFill?.props?.style).toEqual(expect.objectContaining({
      width: '60%',
    }));
  });

  it('renders a windowed pile deck with controls stacked under the cards', () => {
    const renderActiveQuestion = jest.fn((question: PileQuestionLike) => (
      <div data-testid={`active-${question.id}`}>{question.prompt}</div>
    ));
    const tree = renderPileInteractionSurface({
      ...buildBaseProps(),
      showMiniBackgroundSpinner: true,
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
    expect(findElement(tree, (node) => (
      isElementNode(node) && node.props['data-testid'] === 'active-q4'
    ))).not.toBeNull();
    expect(deckCardCount).toBe(5);
    expect(spinnerNode).not.toBeNull();
    expect(controlsNode).not.toBeNull();
    expect(controlsChildren).toHaveLength(3);
    expect(nodeHasClassName(controlsChildren[0], 'pileActions')).toBe(true);
    expect(nodeHasClassName(controlsChildren[1], 'pileFooter')).toBe(true);
    expect(nodeHasClassName(controlsChildren[2], 'pileNav')).toBe(true);
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

    expect(findElement(tree, (node) => (
      isElementNode(node) && node.type === PileHologramAssistant
    ))).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileControls')).toBeNull();
    expect(findNodeByClassName(tree, 'miniSpinnerWrapper')).toBeNull();
    expect(renderActiveQuestion).not.toHaveBeenCalled();
  });
});
