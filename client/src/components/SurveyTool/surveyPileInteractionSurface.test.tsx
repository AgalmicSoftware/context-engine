import React from 'react';

import PileHologramAssistant from './PileHologramAssistant';
import { renderPileInteractionSurface } from './surveyPileInteractionSurface';

const findElement = (node: any, predicate: any) => {
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

const nodeHasClassName = (node: any, className: any) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node: any, className: any) => (
  findElement(node, (candidate: any) => nodeHasClassName(candidate, className))
);

const countElements = (node: any, predicate: any) => {
  let count = 0;
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
    if (predicate(current)) count += 1;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }

  return count;
};

const getElementChildren = (node: any) => {
  const children = node?.props?.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter((child) => child && typeof child === 'object');
};

const buildBaseProps = () => ({
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
  it('renders a windowed pile deck with controls stacked under the cards', () => {
    const renderActiveQuestion = jest.fn((question: any) => (
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
    const deckCardCount = countElements(tree, (node: any) => nodeHasClassName(node, 'pileCard'));
    const controlsChildren = getElementChildren(controlsNode);

    expect(renderActiveQuestion).toHaveBeenCalledTimes(1);
    expect(renderActiveQuestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'q4' }));
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'active-q4')).not.toBeNull();
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

    expect(findElement(tree, (node: any) => node?.type === PileHologramAssistant)).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileControls')).toBeNull();
    expect(findNodeByClassName(tree, 'miniSpinnerWrapper')).toBeNull();
    expect(renderActiveQuestion).not.toHaveBeenCalled();
  });
});
