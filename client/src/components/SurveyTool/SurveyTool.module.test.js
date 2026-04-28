import SurveyTool, {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
  QuestionsDashboard,
  SurveyQuestions,
  SurveySelector,
  DeferredCommitSlider,
} from './SurveyTool.jsx';
import { PileViewMode, SurveyQuestions as DirectSurveyQuestions } from './SurveyQuestions';
import {
  QuestionsDashboard as DirectQuestionsDashboard,
  SurveySelector as DirectSurveySelector,
} from './SurveySelector';
import BullhornToggleButton from './BullhornToggleButton';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import QuestionCardLinks from './QuestionCardLinks';
import QuestionDecryptControl from './QuestionDecryptControl';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider as DirectDeferredCommitSlider } from './DeferredCommitSlider';
import {
  computeSubmitLabel as directComputeSubmitLabel,
  normalizeSurveyToolFilterState as directNormalizeSurveyToolFilterState,
} from './surveyToolUtils.js';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import ConnectedSurveyResults from './SurveyResults';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
};

const treeHasLabel = (node, label) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasLabel(child, label));
  if (typeof node !== 'object') return false;
  if (node?.props?.label === label) return true;
  return treeHasLabel(node?.props?.children, label);
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

const findFirstNodeByType = (node, targetType) => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node?.type === targetType) return node;
  return findFirstNodeByType(node?.props?.children, targetType);
};

const nodeHasClassName = (node, className) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node, className) => (
  findElement(node, (candidate) => nodeHasClassName(candidate, className))
);

const getElementChildren = (node) => {
  const children = node?.props?.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter((child) => child && typeof child === 'object');
};

const countElements = (node, predicate) => {
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

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

describe('SurveyTool module', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('re-exports extracted SurveySelector classes through SurveyTool.jsx', () => {
    expect(SurveySelector).toBe(DirectSurveySelector);
    expect(QuestionsDashboard).toBe(DirectQuestionsDashboard);
  });

  it('re-exports DeferredCommitSlider through SurveyTool.jsx', () => {
    expect(DeferredCommitSlider).toBe(DirectDeferredCommitSlider);
  });

  it('re-exports extracted SurveyQuestions through SurveyTool.jsx', () => {
    expect(SurveyQuestions).toBe(DirectSurveyQuestions);
  });

  it('re-exports extracted survey tool utils through SurveyTool.jsx', () => {
    expect(computeSubmitLabel).toBe(directComputeSubmitLabel);
    expect(normalizeSurveyToolFilterState).toBe(directNormalizeSurveyToolFilterState);
  });

  it('loads without syntax/runtime import errors', () => {
    expect(SurveyTool).toBeDefined();
  });

  it('uses __registry.registryChainId when SurveyQuestions resolves the session chain', () => {
    const subject = new SurveyQuestions({
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
    });
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({
      slug: 'edge',
      __registry: {
        registryChainId: 84532,
      },
    }));

    expect(subject.resolveSessionChainId('edge')).toBe(84532);
  });

  it('renders extracted PileViewMode through SurveyTool.jsx in pile mode', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      onFilterChange: jest.fn(),
    });

    const tree = shell.render();

    expect(tree.type).toBe(PileViewMode);
  });

  it('renders triple trailing arrows inside the pile submit button', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const submitButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT
    );
    const submitContent = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonContent');
    const submitTrail = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonTrail');
    const submitTrailChildren = getElementChildren(submitTrail);

    expect(submitButton).not.toBeNull();
    expect(submitContent).not.toBeNull();
    expect(submitTrail).not.toBeNull();
    expect(submitTrailChildren).toHaveLength(3);
  });

  it('hides the pile submit rail when no rail is visible', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(hiddenFooter).not.toBeNull();
  });

  it('only reserves the pile submit rail offset when the rail is visible', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    let tree = subject.render();
    let interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(false);

    subject.getPendingStatsSnapshot.mockReturnValue({ total: 1, encrypted: 0 });

    tree = subject.render();
    interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(true);
  });

  it('replaces the pile submit button with a centered success checkmark after submit', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0x1111111111111111111111111111111111111111',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: true,
      submittedSinceLastEdit: true,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const submitButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT
    );
    const successBadge = findNodeByClassName(tree, 'pileSubmitSuccessBadge');
    const successIcon = findNodeByClassName(tree, 'pileSubmitSuccessIcon');
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(submitButton).toBeNull();
    expect(successBadge).not.toBeNull();
    expect(successBadge?.props?.['data-testid']).toBe(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
    expect(successBadge?.props?.role).toBe('status');
    expect(successBadge?.props?.['aria-label']).toBe('Submitted');
    expect(successIcon).not.toBeNull();
    expect(hiddenFooter).toBeNull();
  });

  it('keeps pile action opacity scoped to buttons and anchors the mini spinner outside the controls stack', () => {
    const scssPath = path.join(__dirname, 'SurveyTool.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');
    const pileActionsBlocks = scss.match(/\.pileActions\s*{[^}]*}/g) || [];

    expect(pileActionsBlocks.length).toBeGreaterThanOrEqual(2);
    pileActionsBlocks.forEach((block) => {
      expect(block).not.toMatch(/opacity\s*:/);
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const submitButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT
    );
    const submitContent = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonContent');
    const submitTrail = findNodeByClassName(submitButton?.props?.children, 'pileSubmitButtonTrail');
    const submitTrailChildren = getElementChildren(submitTrail);

    expect(submitButton).not.toBeNull();
    expect(submitContent).not.toBeNull();
    expect(submitTrail).not.toBeNull();
    expect(submitTrailChildren).toHaveLength(3);
  });

  it('hides the pile submit rail when no rail is visible', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(hiddenFooter).not.toBeNull();
  });

  it('keeps the pile interaction geometry stable when the top rail becomes visible', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    let tree = subject.render();
    let interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');
    let hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(false);
    expect(hiddenFooter).not.toBeNull();

    subject.getPendingStatsSnapshot.mockReturnValue({ total: 1, encrypted: 0 });

    tree = subject.render();
    interactionUnit = findNodeByClassName(tree, 'pileInteractionUnit');
    hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(interactionUnit).not.toBeNull();
    expect(nodeHasClassName(interactionUnit, 'pileInteractionUnitWithSubmitRail')).toBe(false);
    expect(hiddenFooter).toBeNull();
  });

  it('links the pile success checkmark to the submitted responder user page after submit', () => {
    const responderAddress = '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD';
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: responderAddress,
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: true,
      submittedSinceLastEdit: true,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const submitButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT
    );
    const successBadge = findNodeByClassName(tree, 'pileSubmitSuccessBadge');
    const successIcon = findNodeByClassName(tree, 'pileSubmitSuccessIcon');
    const hiddenFooter = findNodeByClassName(tree, 'pileFooterHidden');

    expect(submitButton).toBeNull();
    expect(successBadge).not.toBeNull();
    expect(successBadge?.type).toBe('a');
    expect(successBadge?.props?.href).toBe(`/u/${responderAddress.toLowerCase()}`);
    expect(successBadge?.props?.['data-testid']).toBe(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
    expect(successBadge?.props?.['aria-label']).toBe('View your submitted responses');
    expect(successBadge?.props?.title).toBe('View your submitted responses');
    expect(successIcon).not.toBeNull();
    expect(hiddenFooter).toBeNull();
  });

  it('keeps the pile success checkmark non-clickable when no responder address is available', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.isMaskedPromptText = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: true,
      submittedSinceLastEdit: true,
      isSubmitting: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const successBadge = findNodeByClassName(tree, 'pileSubmitSuccessBadge');
    const successIcon = findNodeByClassName(tree, 'pileSubmitSuccessIcon');

    expect(successBadge).not.toBeNull();
    expect(successBadge?.type).toBe('div');
    expect(successBadge?.props?.href).toBeUndefined();
    expect(successBadge?.props?.['data-testid']).toBe(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
    expect(successBadge?.props?.role).toBe('status');
    expect(successBadge?.props?.['aria-label']).toBe('Submitted');
    expect(successIcon).not.toBeNull();
  });

  it('renders the pile hologram as a full-card takeover and hides pile controls while active', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
      onViewAllClick: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.renderActiveQuestion = jest.fn(() => null);
    subject.isMaskedPromptText = jest.fn(() => false);
    subject.setState = (updater) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
    };
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      showHologramAssistant: false,
    };

    const closedTree = subject.render();
    const closedToggleButton = findElement(
      closedTree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE
    );
    const closedHologram = findElement(
      closedTree,
      (node) => node?.type === PileHologramAssistant
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

    subject.toggleHologramAssistant();

    const openTree = subject.render();
    const openToggleButton = findElement(
      openTree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE
    );
    const openHologram = findElement(
      openTree,
      (node) => node?.type === PileHologramAssistant
    );

    expect(openToggleButton).toBeNull();
    expect(findNodeByClassName(openTree, 'pileControls')).toBeNull();
    expect(findNodeByClassName(openTree, 'pileFooter')).toBeNull();
    expect(openHologram).not.toBeNull();
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

  it('trims /results from URL when closing results modal without external close handler', () => {
    const priorUrl = window.location.href;

    try {
      window.history.pushState({}, '', '/session/edge/questions/results');
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
      expect(window.location.pathname).toBe('/session/edge/questions');
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
    const resultsNode = findElement(tree, (candidate) => candidate?.type === ConnectedSurveyResults);

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
    const resultsNode = findElement(tree, (candidate) => candidate?.type === ConnectedSurveyResults);

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

  it('keeps hydrate loading active when only gate hints are known and no hidden questions are cached', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.getResponseGateRecipientSpecs = jest.fn(() => ([{ type: 'lit-sbt-v1' }]));
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);

    const tree = subject.render();
    expect(treeHasText(tree, 'No accessible questions. This session has gated content.')).toBe(false);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(true);
  });

  it('prefers gated empty state once masked questions are cached even if cache-ready stays false', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: '[encrypted]',
            type: 'freeform',
          },
        },
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.state.hasHiddenGatedQuestions).toBe(true);

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBe(true);
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}`)).toBe(true);
    expect(treeHasText(tree, `Connect an eligible ${t('walletLower')} and decrypt to view the questions.`)).toBe(true);
    expect(treeHasText(tree, `These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`)).toBe(false);
    expect(treeHasText(tree, 'Retry decrypt')).toBe(false);
    expect(treeHasText(tree, 'Decrypt')).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBe(false);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(false);
  });

  it('shows gate requirements in gated pile empty state when masked question gate details are available', async () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: '[encrypted]',
            type: 'freeform',
            encryption: {
              enabled: true,
              gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
            },
          },
        },
        questionResponses: {},
        pendingQuestionMetadata: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 0,
        pendingMetadataCount: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.resolveSbtGateLabel = jest.fn(() => 'VIP SBT');
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    subject.state = {
      ...subject.state,
      questionPool: [{
        id: 'q1',
        prompt: '[encrypted]',
        type: 'freeform',
        encryption: {
          enabled: true,
          gates: [],
        },
      }],
      allQuestionsForFilter: [{
        id: 'q1',
        prompt: '[encrypted]',
        type: 'freeform',
        encryption: {
          enabled: true,
          gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
        },
      }],
      hasHiddenGatedQuestions: true,
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER)).toBe(true);
    expect(treeHasText(tree, `This session's questions are ${t('gatedLower')}`)).toBe(true);
    expect(treeHasText(tree, `Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`)).toBe(true);
    expect(treeHasText(tree, 'VIP Gate')).toBe(false);
    expect(treeHasText(tree, 'VIP SBT')).toBe(false);
    expect(treeHasText(tree, 'Retry decrypt')).toBe(false);
    expect(treeHasText(tree, 'Decrypt')).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET)).toBe(true);

    subject.state = {
      ...subject.state,
      lockedGateDetailsExpanded: true,
    };

    const expandedTree = subject.render();
    expect(treeHasText(expandedTree, 'VIP Gate')).toBe(true);
    expect(treeHasText(expandedTree, 'VIP SBT')).toBe(true);
  });

  it('does not write fetched question payloads into a borrowed general network cache when the slug is unresolved', async () => {
    const slug = 'missing-session-slug';
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (inputSlug) => (
      String(inputSlug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((inputSlug) => (
      strictLookup(inputSlug) || generalCfg
    ));

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', slug, {
      '84532': {
        questions: {
          qGeneral: {
            id: 'qGeneral',
            prompt: 'Borrowed general prompt',
          },
        },
        questionResponses: {},
      },
    });

    try {
      const subject = new SurveyQuestions({
        singleQuestionMode: true,
        isStandalone: false,
        surveyIndex: 0,
        questionID: 'q1',
        sessionSlug: slug,
        activeSessionSlug: '',
      });

      subject.cacheQuestionPayloadForSlug(slug, 'q1', {
        id: 'q1',
        prompt: 'Fetched prompt',
        type: 'freeform',
      });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questions?.qGeneral).toEqual(expect.objectContaining({
        id: 'qGeneral',
        prompt: 'Borrowed general prompt',
      }));
      expect(questionsCache?.['84532']?.questions?.q1).toBeUndefined();
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    }
  });

  it('does not warm pile state from a borrowed general network cache when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questions: {
            q1: { id: 'q1', type: 'freeform', prompt: 'Borrowed general prompt' },
          },
          questionResponses: {},
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      isQuestionCacheReady: true,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'missing-session-slug', { clone: false });
    expect(subject.state.pileQuestions).toEqual([]);
    expect(subject.state.allQuestionsForFilter).toEqual([]);
    expect(subject.state.loading).toBe(true);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);
  });

  it('does not load/sort pile questions from a borrowed general network cache when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Borrowed general prompt' },
        },
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.loading).toBe(false);
    expect(subject.state.pileQuestions).toEqual([]);
    expect(subject.state.allQuestionsForFilter).toEqual([]);
    expect(subject.initializeResponseState).not.toHaveBeenCalled();
  });

  it('prefers explicit route session slug for audio-input worker props in single-question mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    const inferredSlugSpy = jest.fn(() => 'other');
    subject._getEffectiveDraftSlug = inferredSlugSpy;

    const workerProps = subject.getAudioInputWorkerProps();

    expect(workerProps.sessionSlug).toBe('edge');
    expect(workerProps.sessionSlug).toBe('edge');
    expect(inferredSlugSpy).not.toHaveBeenCalled();
  });

  it('does not inherit the general session config for unknown audio-input worker slugs', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');

    const workerProps = subject.getAudioInputWorkerProps();

    expect(workerProps).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      context: {
        chainId: 84532,
      },
    });
  });

  it('applies active icon classes to bullhorn button when active', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const activeButton = subject.renderBullhornToggleButton({ active: true });
    expect(activeButton?.type).toBe(BullhornToggleButton);
    expect(activeButton?.props?.active).toBe(true);

    const inactiveButton = subject.renderBullhornToggleButton({ active: false });
    expect(inactiveButton?.type).toBe(BullhornToggleButton);
    expect(inactiveButton?.props?.active).toBe(false);
  });

  it('locks and opens the pile lock audience menu on first click when no default gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: {} };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');
    subject.toggleAnswerEncryption = jest.fn();
    subject.toggleAdditionalCommentsEncryption = jest.fn();
    subject.toggleLockAudienceMenu = jest.fn();

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });
    const lockButton = findFirstNodeByType(lockControl, 'button');
    expect(lockButton).toBeTruthy();

    lockButton.props.onClick();

    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', true, 'answer');
    expect(subject.toggleAnswerEncryption).toHaveBeenCalledWith(0, 'q1', true);
    expect(subject.toggleAnswerEncryption).toHaveBeenCalledTimes(1);
    expect(subject.toggleAdditionalCommentsEncryption).not.toHaveBeenCalled();
  });

  it('opens the pile lock audience menu without locking on first click when a gate option is available', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: {} };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({ address: '0x00000000000000000000000000000000000000a1' }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');
    subject.toggleAnswerEncryption = jest.fn();
    subject.toggleAdditionalCommentsEncryption = jest.fn();
    subject.toggleLockAudienceMenu = jest.fn();

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });
    const lockButton = findFirstNodeByType(lockControl, 'button');
    expect(lockButton).toBeTruthy();

    lockButton.props.onClick();

    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', true, 'answer');
    expect(subject.toggleAnswerEncryption).not.toHaveBeenCalled();
    expect(subject.toggleAdditionalCommentsEncryption).not.toHaveBeenCalled();
  });

  it('shows only the self audience option in pile lock menu when no gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { q1: true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    expect(treeHasText(lockControl, 'only me')).toBe(true);
    expect(treeHasDataTestId(lockControl, E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).toBe(false);
  });

  it('derives lock-audience display state for additional fields with inherit mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { 'q1:additional': true },
      lockAudienceGateDetailsByQuestion: {},
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const displayState = subject.getLockAudienceDisplayState({
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      field: { encrypted: true, encryptionAudience: 'self', audienceMode: 'inherit' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Comments encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      visualContext: 'pile',
    });

    expect(displayState.effectiveFieldKey).toBe('additional');
    expect(displayState.menuOpen).toBe(true);
    expect(displayState.followActive).toBe(true);
    expect(displayState.allowPlaintextOption).toBe(false);
    expect(displayState.isPileVisualContext).toBe(true);
    expect(displayState.buttonTitle).toBe('Choose encryption audience');
  });

  it('uses a darker pressed state for the open pile lock menu without applying the bright active glow', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { q1: true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      visualContext: 'pile',
    });
    const lockButton = findFirstNodeByType(lockControl, 'button');

    expect(lockButton).toBeTruthy();
    expect(String(lockButton?.props?.className || '')).toContain(styles.pileLockButton);
    expect(String(lockButton?.props?.className || '')).toContain(styles.pileLockButtonMenuOpen);
    expect(String(lockButton?.props?.className || '')).not.toContain(styles.iconButtonActive);
    expect(findNodeByClassName(lockControl, styles.iconGlow)).toBeNull();
    expect(findNodeByClassName(lockControl, styles.pileLockAudiencePopover)).toBeTruthy();
  });

  it('labels response gate audience options with the session name', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getResponseGatePolicy = jest.fn(() => ({
      gates: [{
        gateId: 'default_gate',
        label: 'Registry default gate',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }],
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject.resolveLockAudienceSessionName = jest.fn(() => 'test-12');
    subject.resolveConfiguredGateLabel = jest.fn(() => 'Registry default gate');
    subject.resolveGateDisplayLabel = jest.fn(() => 'Registry default gate');

    const gateOptions = subject.getResponseGateOptions('q1');

    expect(gateOptions).toHaveLength(1);
    expect(gateOptions[0]).toEqual(expect.objectContaining({
      gateId: 'default_gate',
      label: 'test-12',
    }));
  });

  it('treats sponsored access errors as uncertain when checking response decrypt access', async () => {
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess')
      .mockResolvedValueOnce({
        status: 'error',
        gate: null,
        resourceKey: 'surveyResponses',
      })
      .mockResolvedValueOnce({
        status: 'denied',
        gate: null,
        resourceKey: 'default',
      });
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'surveyResponses',
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));

    const canDecrypt = await subject.refreshCanDecryptOtherResponses();

    expect(canDecrypt).toBe(false);
    expect(gateSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.canDecryptOtherResponses).toBe(false);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('unknown');
  });

  it('marks response decrypt access as needs-wallet when auth is missing', async () => {
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess');
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'granted',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'surveyResponses',
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));
    subject._canDecryptOtherResponsesKey = 'stale-key';
    subject._canDecryptOtherResponsesInFlight = Promise.resolve(true);

    const canDecrypt = await subject.refreshCanDecryptOtherResponses();

    expect(canDecrypt).toBe(false);
    expect(gateSpy).not.toHaveBeenCalled();
    expect(subject.state.canDecryptOtherResponses).toBe(false);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('needs-wallet');
    expect(subject._canDecryptOtherResponsesKey).toBe('');
    expect(subject._canDecryptOtherResponsesInFlight).toBeNull();
  });

  it('keeps lock audience SBT detail links on terminology-aware routes instead of nested /u/ links', () => {
    const address = '0x1111111111111111111111111111111111111111';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const menuKey = subject.getLockAudienceMenuStateKey('q1', 'answer');
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { [menuKey]: true },
      lockAudienceGateDetailsByQuestion: { [menuKey]: 'vip_gate' },
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({
      gateDetails: [{
        gateId: 'vip_gate',
        label: 'VIP gate',
        sbtItems: subject.buildGateAudienceSbtItems([address], 'edge'),
      }],
    }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveFieldEncryptionGateId = jest.fn(() => '');
    subject.resolveSbtGateLabel = jest.fn(() => '');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Choose encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const markup = renderToStaticMarkup(lockControl);
    expect(markup).toContain(`href="${buildSbtDetailPath(address, 'edge')}"`);
    expect(markup).not.toContain(`href="/u/${address}"`);
  });

  it('does not inherit the general session name in lock audience labels when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      sessionName: 'General Session',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getResponseGatePolicy = jest.fn(() => ({
      gates: [{
        gateId: 'default_gate',
        label: 'Registry default gate',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }],
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject.resolveConfiguredGateLabel = jest.fn(() => 'Registry default gate');
    subject.resolveGateDisplayLabel = jest.fn(() => 'Registry default gate');

    const gateOptions = subject.getResponseGateOptions('q1');

    expect(gateOptions).toHaveLength(1);
    expect(gateOptions[0]).toEqual(expect.objectContaining({
      gateId: 'default_gate',
      label: 'session',
    }));
    expect(gateOptions[0].label).not.toBe('General Session');
  });

  it('does not inherit the general response gate policy for unknown explicit session slugs', () => {
    const generalCfg = {
      slug: '',
      sessionName: 'General Session',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'general_gate',
        gates: {
          general_gate: {
            gateId: 'general_gate',
            type: 'sbt',
            label: 'General Gate',
            chainId: 84532,
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
        resources: {
          questionResponses: { gateId: 'general_gate' },
          default: { gateId: 'general_gate' },
        },
      },
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sessionConfig: {
        sessionName: 'Pinned Missing Session',
      },
    });

    const policy = subject.getResponseGatePolicy();

    expect(policy).toEqual({
      primaryResource: 'questionResponses',
      gates: [],
      recipients: [],
      allowFallbackConditions: true,
    });
    expect(subject._responseGatePolicyCache?.cfg).toMatchObject({
      slug: 'missing-session-slug',
      sessionName: 'Pinned Missing Session',
    });
    expect(subject._responseGatePolicyCache?.cfg?.sponsored).toBeUndefined();
  });

  it('keeps response gate SBT details hidden behind the caret until expanded', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: {},
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({
      gateDetails: [{
        gateId: 'default_gate',
        label: 'test-12',
        sbtItems: [{
          address: '0x1111111111111111111111111111111111111111',
          label: 'AI Gate Test SBT',
          meta: '0x1111...1111',
          href: '/sbt/0x1111111111111111111111111111111111111111',
        }],
      }],
    }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveFieldEncryptionGateId = jest.fn(() => null);

    const collapsedControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    expect(treeHasText(collapsedControl, 'only me')).toBe(true);
    expect(treeHasText(collapsedControl, 'test-12')).toBe(true);
    expect(treeHasText(collapsedControl, 'for test-12')).toBe(false);
    expect(treeHasText(collapsedControl, 'AI Gate Test SBT')).toBe(false);
    expect(findNodeByClassName(collapsedControl, styles.lockAudienceCaretButton)).toBeTruthy();

    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: { q1: 'default_gate' },
    };

    const expandedControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    expect(treeHasText(expandedControl, 'AI Gate Test SBT')).toBe(true);
    expect(treeHasText(expandedControl, '0x1111...1111')).toBe(true);
  });

  it('wires shared lock-audience gate helper callbacks for select and details toggle', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.toggleLockAudienceGateDetails = jest.fn();
    const onSelectAudience = jest.fn();

    const gateOption = subject.renderLockAudienceGateOption({
      qid: 'q1',
      effectiveFieldKey: 'answer',
      option: {
        gateId: 'vip_gate',
        label: 'VIP gate',
        sbtItems: [{
          address: '0x1111111111111111111111111111111111111111',
          label: 'AI Gate Test SBT',
          meta: '0x1111...1111',
          href: '/sbt/0x1111111111111111111111111111111111111111',
        }],
      },
      gateActive: false,
      currentGateId: '',
      expandedGateId: '',
      onSelectAudience,
    });

    const gateButton = findElement(
      gateOption,
      (candidate) => candidate?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE
        && candidate?.props?.['data-ce-gate-id'] === 'vip_gate'
    );
    const caretButton = findNodeByClassName(gateOption, styles.lockAudienceCaretButton);

    expect(gateButton).toBeTruthy();
    expect(caretButton).toBeTruthy();

    gateButton.props.onClick();
    expect(onSelectAudience).toHaveBeenCalledWith('gate', 'vip_gate');

    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    caretButton.props.onClick({ preventDefault, stopPropagation });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(subject.toggleLockAudienceGateDetails).toHaveBeenCalledWith('q1', 'vip_gate', 'answer');
  });

  it('hides the plaintext audience option for additional comment lock menus', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { 'q1:additional': true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      field: { encrypted: false, encryptionAudience: 'self' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Comments encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      showFollowOption: true,
    });

    expect(treeHasText(lockControl, 'Not encrypted')).toBe(false);
    expect(treeHasDataTestId(lockControl, E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).toBe(false);
    expect(treeHasText(lockControl, 'only me')).toBe(true);
    expect(treeHasText(lockControl, 'Match Answer')).toBe(true);
  });

  it('turns off additional comment encryption when clicking the open active lock', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { 'q1:additional': true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');
    subject.toggleAnswerEncryption = jest.fn();
    subject.toggleAdditionalCommentsEncryption = jest.fn();
    subject.toggleLockAudienceMenu = jest.fn();

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: true, encryptionAudience: 'self' },
      field: { encrypted: true, encryptionAudience: 'self', audienceMode: 'explicit' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Encrypted comments',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      showFollowOption: true,
    });
    const lockButton = findFirstNodeByType(lockControl, 'button');
    expect(lockButton).toBeTruthy();

    lockButton.props.onClick();

    expect(subject.toggleAdditionalCommentsEncryption).toHaveBeenCalledWith(0, 'q1', false);
    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', false, 'additional');
    expect(subject.toggleAnswerEncryption).not.toHaveBeenCalled();
  });

  it('shows the same forced audience menu in full mode when no gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { q1: true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const question = {
      id: 'q1',
      type: 'freeform',
      question: 'How are you?',
    };
    const currentSurveyResponseState = {
      answers: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);

    expect(treeHasText(fullQuestionCard, 'only me')).toBe(true);
    expect(treeHasDataTestId(fullQuestionCard, E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).toBe(false);
  });

  it('renders full-mode additional comments without the extra header and keeps the lock beside the field', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const question = {
      id: 'q1',
      type: 'freeform',
      question: 'How are you?',
    };
    const currentSurveyResponseState = {
      answers: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);
    const inlineRow = findFirstNodeByType(fullQuestionCard, AdditionalCommentsInlineRow);

    expect(inlineRow).not.toBeNull();
    expect(findNodeByClassName(fullQuestionCard, styles.additionalCommentsHeader)).toBeNull();
    expect(treeHasText(fullQuestionCard, 'Additional comments')).toBe(false);
    expect(inlineRow.props.input.type).toBe(SurveyAudioFieldInput);
    expect(inlineRow.props.input.props.placeholder).toBe('related thoughts or URLs (optional)');
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsInputWrap);
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsLockSlot);
    expect(treeHasDataTestId(inlineRow.props.lockControl, E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK)).toBe(true);
  });

  it('normalizes shared question field task keys and decrypt busy lookups', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:prompt': true, 'q1:additional': true },
    };

    expect(subject.getQuestionFieldTaskKey(' Q1 ', ' Prompt ')).toBe('q1:prompt');
    expect(subject.getQuestionFieldTaskKey('q1', 'additional')).toBe('q1:additional');
    expect(subject.getQuestionFieldTaskKey('', 'answer')).toBe('');
    expect(subject.getQuestionFieldTaskKeys(' Q1 ', {
      includeAnswer: true,
      includeAdditional: true,
    })).toEqual(['q1:answer', 'q1:additional']);
    expect(subject.markQuestionFieldBusyMap({
      'q1:prompt': true,
    }, ['q1:answer', '', 'q1:additional'])).toEqual({
      'q1:prompt': true,
      'q1:answer': true,
      'q1:additional': true,
    });
    expect(subject.isQuestionFieldBusy(' Q1 ', ' prompt ')).toBe(true);
    expect(subject.isQuestionFieldBusy('q1', 'additional')).toBe(true);
    expect(subject.isQuestionFieldBusy('q1', 'answer')).toBe(false);
    expect(subject.isQuestionFieldBusy('', 'prompt')).toBe(false);
    expect(subject.clearQuestionFieldBusyMap({
      'q1:answer': true,
      'q1:additional': true,
      'q1:prompt': true,
    }, ' Q1 ', 'additional')).toEqual({
      'q1:answer': true,
      'q1:additional': false,
      'q1:prompt': true,
    });
  });

  it('derives shared question field decrypt selection for answer and additional flows', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.getQuestionFieldDecryptSelection('q1', 'both', {
      answers: {
        q1: { value: '*', encrypted: true },
      },
      additionalComments: {
        q1: { value: '*', encryptedPortion: 'sealed' },
      },
    })).toEqual({
      maskedAnswer: true,
      maskedAdditional: true,
      hasMaskedField: true,
      clearMode: 'both',
      keysToMark: ['q1:answer', 'q1:additional'],
    });

    expect(subject.getQuestionFieldDecryptSelection('q1', 'additional', {
      answers: {
        q1: { value: '*', encrypted: true },
      },
      additionalComments: {
        q1: { value: 'plain', encrypted: true },
      },
    })).toEqual({
      maskedAnswer: false,
      maskedAdditional: false,
      hasMaskedField: false,
      clearMode: '',
      keysToMark: [],
    });
  });

  it('decrypts shared question rating envelopes into numeric values', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    const decryptEnvelopeValueSpy = jest
      .spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (env) => {
        if (env === 'importance-env') return '7';
        if (env === 'conviction-env') return 'not-a-number';
        return null;
      });

    await expect(subject.decryptQuestionRatingEnvelopes(
      {
        importanceEncrypted: 'importance-env',
        convictionEncrypted: 'conviction-env',
      },
      {
        account: '0xabc',
        chainId: 84532,
        lit: { getKey: jest.fn() },
        providerLike: { provider: true },
      },
    )).resolves.toEqual({
      decryptedImportance: 7,
      decryptedConviction: null,
    });

    expect(decryptEnvelopeValueSpy).toHaveBeenCalledTimes(2);
    decryptEnvelopeValueSpy.mockRestore();
  });

  it('builds shared question decrypt execution context from current props and state', () => {
    const getProviderKindSpy = jest
      .spyOn(cryptoUtils, 'getProviderKind')
      .mockReturnValue('browser');
    const litHooks = { getKey: jest.fn() };
    const provider = { provider: true };
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      provider,
      litHooks,
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'pool-q' }],
      pileQuestions: [{ id: 'pile-q' }],
      hasher: 'hash-worker',
    };
    subject.resolveDecryptSurveyId = jest.fn(() => 'survey-1');

    expect(subject.buildQuestionDecryptExecutionContext(
      { answers: {} },
      'Q1',
    )).toEqual({
      providerKind: 'browser',
      chainId: 84532,
      surveyId: 'survey-1',
      questionPool: [{ id: 'pool-q' }],
      lit: { getKey: litHooks.getKey },
      opts: {
        providerKind: 'browser',
        provider,
        account: '0xabc',
        chainId: 84532,
        surveyId: 'survey-1',
        questionPool: [{ id: 'pool-q' }],
        lit: { getKey: litHooks.getKey },
        hasher: 'hash-worker',
        throwOnError: true,
      },
    });

    getProviderKindSpy.mockRestore();
  });

  it('applies shared decrypted question response values onto viewed response records', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.applyDecryptedQuestionResponseValues(
      {
        answer: { value: '*' },
        additional: { value: '*' },
        importance: 1,
        conviction: 2,
      },
      {
        questionId: 'Q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
          additionalComments: { q1: { value: 'clear notes' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answer: { value: 'clear answer' },
      additional: { value: 'clear notes' },
      importance: 7,
      conviction: 9,
    });
  });

  it('applies shared decrypted question state onto survey response slices', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.applyDecryptedQuestionStateToSurveySlice(
      {
        answers: { q1: { value: '*', encrypted: true } },
        additionalComments: { q1: { value: '*', encrypted: true } },
        importance: { q1: 1 },
        conviction: { q1: 2 },
      },
      {
        questionId: 'Q1',
        baselineSlice: {
          answers: { q1: { value: '*', encryptedPortion: 'ans-env' } },
          additionalComments: { q1: { value: '*', encrypted: true } },
        },
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer', zkSalt: 'salt-a' } },
          additionalComments: { q1: { value: 'clear notes', zkSalt: 'salt-b' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('syncs shared decrypted question state back into the edit baseline', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.syncDecryptedQuestionIntoBaseline(
      null,
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: 'clear answer', encrypted: true } },
        additionalComments: { q1: { value: 'clear notes', encrypted: true } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
      },
      {
        questionId: 'Q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
          additionalComments: { q1: { value: 'clear notes' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('merges latest encrypted question fields into the working decrypt slice', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.mergeLatestEncryptedQuestionFields(
      {
        answers: { q1: { value: '*', encrypted: false, hash: 'old-a' } },
        additionalComments: { q1: { value: '*', encrypted: true, hash: 'old-b' } },
      },
      'Q1',
      {
        answer: { encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' },
        additional: { encrypted: false, hash: 'new-b', encryptedPortion: 'add-env' },
      },
      {
        includeAnswer: true,
        includeAdditional: true,
      },
    )).toEqual({
      answers: { q1: { value: '*', encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' } },
      additionalComments: { q1: { value: '*', encrypted: true, hash: 'new-b', encryptedPortion: 'add-env' } },
    });
  });

  it('builds shared decrypt start and failure state updates', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.buildQuestionDecryptStartState(
      { decryptingByKey: { 'q1:prompt': true } },
      ['q1:answer', 'q1:additional'],
    )).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
      decryptingByKey: {
        'q1:prompt': true,
        'q1:answer': true,
        'q1:additional': true,
      },
    });

    expect(subject.buildQuestionDecryptFailureState(
      { decryptingByKey: { 'q1:answer': true, 'q1:additional': true, 'q1:prompt': true } },
      'Q1',
      'additional',
      'boom',
    )).toEqual({
      isDecrypting: false,
      submissionError: 'boom',
      decryptingByKey: {
        'q1:answer': true,
        'q1:additional': false,
        'q1:prompt': true,
      },
    });
  });

  it('merges question response overrides into the working decrypt slice', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.mergeQuestionResponseOverrideIntoDecryptSlice(
      {
        answers: { q1: { value: '*', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
      },
      'Q1',
      {
        answer: { value: '*', encryptedPortion: 'ans-env', hash: 'ans-hash' },
        additional: { value: 'notes', encrypted: true, hash: 'add-hash' },
      },
    )).toEqual({
      answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env', hash: 'ans-hash' } },
      additionalComments: { q1: { value: 'notes', encrypted: true, hash: 'add-hash' } },
    });
  });

  it('extracts and merges question rating envelope state across response sources', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.getQuestionRatingEnvelopes(
      {
        responses: [
          { questionID: 'q2', importanceEncrypted: 'skip-me' },
          { questionID: 'Q1', convictionEncrypted: 'conv-1' },
        ],
      },
      'q1',
    )).toEqual({
      importanceEncrypted: '',
      convictionEncrypted: 'conv-1',
    });

    expect(subject.mergeQuestionRatingEnvelopeState(
      { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
      { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
      'q1',
    )).toEqual({
      importanceEncrypted: 'imp-1',
      convictionEncrypted: 'conv-2',
    });
  });

  it('normalizes decrypt slice shape and builds viewed-response decrypt baselines', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: null,
    }));

    expect(subject.ensureQuestionDecryptSliceShape({
      answers: { q1: { value: '*' } },
      additionalComments: null,
    })).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });

    expect(subject.buildViewedResponseDecryptBaseline(
      { questionId: 'Q1', answer: { value: '*' } },
      'q1',
    )).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
  });

  it('builds self-response decrypt baselines from current survey state or user answers', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [null],
      userAnswers: { responses: [] },
    };
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: { q1: { value: '' } },
    }));

    expect(subject.buildSelfQuestionDecryptBaseline(0)).toEqual({
      baselineSlice: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
      },
      baselineForDecrypt: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
        importance: {},
        conviction: {},
      },
    });
  });

  it('derives shared decrypt display state for answer and additional fields', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:additional': true },
    };

    const stateWithoutLogin = subject.getQuestionFieldDisplayState({
      questionId: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: '' },
      additional: { value: '*', encrypted: true, encryptedPortion: '' },
    });

    expect(stateWithoutLogin.answerDecryptState.masked).toBe(true);
    expect(stateWithoutLogin.answerDecryptState.allowDecrypt).toBe(false);
    expect(stateWithoutLogin.additionalDecryptState.masked).toBe(true);
    expect(stateWithoutLogin.additionalDecryptState.allowDecrypt).toBe(false);
    expect(stateWithoutLogin.additionalDecryptState.busy).toBe(true);
    expect(stateWithoutLogin.decryptTooltip).toBe('Login to decrypt this encrypted field.');

    subject.props = {
      ...subject.props,
      account: '0xabc',
      loginComplete: true,
    };

    const stateWithLogin = subject.getQuestionFieldDisplayState({
      questionId: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: '' },
      additional: { value: 'notes', encrypted: true, encryptedPortion: '' },
    });

    expect(stateWithLogin.answerDecryptState.allowDecrypt).toBe(true);
    expect(stateWithLogin.additionalDecryptState.masked).toBe(false);
    expect(stateWithLogin.hasAdditionalContent).toBe(true);
    expect(stateWithLogin.glowAnswer).toBe(true);
    expect(stateWithLogin.glowAdditional).toBe(true);
  });

  it('derives shared question response display state for full and pile render setup', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.getSliderMode = jest.fn(() => 'importance');

    const displayState = subject.getQuestionResponseDisplayState({
      questionId: 'q1',
      responseSlice: {
        answers: { q1: { value: 'answer', encrypted: false } },
        additionalComments: {},
        importance: { q1: 9 },
        conviction: { q1: 3 },
      },
    });

    expect(displayState.answer.value).toBe('answer');
    expect(displayState.additional.value).toBe('');
    expect(displayState.convictionValue).toBe(3);
    expect(displayState.importanceValue).toBe(9);
    expect(displayState.hasConvictionImportanceValue).toBe(true);
    expect(displayState.sliderMode).toBe('importance');
    expect(displayState.activeSliderValue).toBe(9);
  });

  it('derives combined question render display state for shared render branches', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:answer': true },
    };
    subject.getSliderMode = jest.fn(() => 'conviction');

    const displayState = subject.getQuestionRenderDisplayState({
      questionId: 'q1',
      responseSlice: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '' } },
        additionalComments: { q1: { value: 'notes', encrypted: true } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
      },
    });

    expect(displayState.answer.value).toBe('*');
    expect(displayState.additional.value).toBe('notes');
    expect(displayState.maskedAnswer).toBe(true);
    expect(displayState.maskedAdditional).toBe(false);
    expect(displayState.allowDecryptAnswer).toBe(false);
    expect(displayState.isAnswerDecrypting).toBe(true);
    expect(displayState.hasAdditionalContent).toBe(true);
    expect(displayState.glowAnswer).toBe(true);
    expect(displayState.glowAdditional).toBe(true);
    expect(displayState.sliderMode).toBe('conviction');
    expect(displayState.activeSliderValue).toBe(7);
  });

  it('derives normalized gated prompt notice ids and copy for both single and multiple gates', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.resolveGatedPromptGateNames = jest.fn(() => ['Gate Alpha', 'Gate Beta']);
    expect(subject.getGatedPromptNoticeState({
      question: { id: 'Q 1' },
      tooltipIdSuffix: 'pile',
    })).toEqual({
      tooltipId: 'ce-gated-prompt-tip-q-1-pile',
      tooltipText: `Required ${t('sbt')} ${t('gates')}: Gate Alpha, Gate Beta`,
    });

    subject.resolveGatedPromptGateNames = jest.fn(() => []);
    expect(subject.getGatedPromptNoticeState({
      question: { id: '' },
      tooltipIdSuffix: 'full',
      fallbackId: 'fallback id',
    })).toEqual({
      tooltipId: 'ce-gated-prompt-tip-fallback-id-full',
      tooltipText: `${t('sbt')} ${t('gate')} required`,
    });
  });

  it('lets additional comments Match Answer until an explicit override is chosen', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getEffectiveRecipientsForQid = jest.fn(() => [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }]);
    subject.getResponseGateOptions = jest.fn(() => [
      {
        gateId: 'gate-a',
        label: 'Gate A',
        sbtAddresses: ['0x00000000000000000000000000000000000000a1'],
        sbtSummary: 'Gate A SBT',
        recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }],
      },
      {
        gateId: 'gate-b',
        label: 'Gate B',
        sbtAddresses: ['0x00000000000000000000000000000000000000b1'],
        sbtSummary: 'Gate B SBT',
        recipients: [{ accessControlConditions: [{ contractAddress: '0x2' }], chain: 'base' }],
      },
    ]);
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            value: 'answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptionGateId: 'gate-a',
            audienceMode: 'explicit',
          },
        },
        additionalComments: {
          q1: {
            value: 'comments',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptionGateId: 'gate-a',
            audienceMode: 'inherit',
          },
        },
        importance: {},
        conviction: {},
      }],
    };

    subject.applyAnswerEncryptionAudience(0, 'q1', 'gate', { gateId: 'gate-b' });
    expect(subject.state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-b');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-b');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');

    subject.applyAdditionalEncryptionAudience(0, 'q1', 'self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('explicit');

    subject.applyAnswerEncryptionAudience(0, 'q1', 'gate', { gateId: 'gate-a' });
    expect(subject.state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-a');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBeNull();

    subject.applyAdditionalEncryptionAudience(0, 'q1', 'follow');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('applies answer and additional audiences into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getEffectiveRecipientsForQid = jest.fn(() => [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }]);
    subject.getResponseGateOptions = jest.fn(() => [
      {
        gateId: 'gate-a',
        label: 'Gate A',
        sbtAddresses: ['0x00000000000000000000000000000000000000a1'],
        sbtSummary: 'Gate A SBT',
        recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }],
      },
    ]);
    subject.state = {
      ...subject.state,
      surveysResponseState: [],
    };

    subject.applyAnswerEncryptionAudience(2, 'q1', 'gate', { gateId: 'gate-a' });
    expect(subject.state.surveysResponseState).toHaveLength(3);
    expect(subject.state.surveysResponseState[2].answers.q1.encryptionAudience).toBe('gate');
    expect(subject.state.surveysResponseState[2].answers.q1.encryptionGateId).toBe('gate-a');

    subject.applyAdditionalEncryptionAudience(2, 'q1', 'follow');
    expect(subject.state.surveysResponseState[2].additionalComments.q1.audienceMode).toBe('inherit');
    expect(subject.state.surveysResponseState[2].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('groups answer and additional encryption work by field-specific gate recipients', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const gateARecipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const gateBRecipients = [{ accessControlConditions: [{ contractAddress: '0x2' }], chain: 'base' }];
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.resolveFieldEncryptionGateId = (field) => field?.encryptionGateId || null;
    subject.getEffectiveRecipientsForField = jest.fn(({ field }) => (
      field?.encryptionGateId === 'gate-b' ? gateBRecipients : gateARecipients
    ));

    const { groups, missingRecipients } = subject.buildFieldEncryptionWorkGroups({
      answers: {
        q1: {
          value: 'answer',
          encrypted: true,
          encryptionAudience: 'gate',
          encryptionGateId: 'gate-a',
        },
      },
      additionalComments: {
        q1: {
          value: 'comments',
          encrypted: true,
          encryptionAudience: 'gate',
          encryptionGateId: 'gate-b',
        },
      },
      importance: {},
      conviction: {},
    }, new Set(['q1']));

    expect(missingRecipients).toEqual([]);
    expect(groups).toHaveLength(2);
    expect(groups[0].slice.answers.q1 || groups[1].slice.answers.q1).toBeTruthy();
    expect(groups[0].slice.additionalComments.q1 || groups[1].slice.additionalComments.q1).toBeTruthy();
    expect(groups.map((group) => JSON.stringify(group.recipients))).toEqual(expect.arrayContaining([
      JSON.stringify(gateARecipients),
      JSON.stringify(gateBRecipients),
    ]));
  });

  it('clamps full-mode rating answers into the supported slider range and avoids duplicate id styling hooks', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    const withNumericString = {
      answers: { q1: { value: '8', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    let fullQuestionCard = subject.renderQuestion(question, 0, withNumericString);
    let ratingInput = findFirstNodeByType(fullQuestionCard, FullQuestionRatingInput);
    expect(ratingInput).not.toBeNull();
    expect(ratingInput.props.value).toBe(8);
    expect(ratingInput.props.disabled).toBe(false);
    expect(typeof ratingInput.props.onChange).toBe('function');
    expect(typeof ratingInput.props.onChangeComplete).toBe('function');
    expect(renderToStaticMarkup(ratingInput)).toContain('8');

    const withOverflowValue = {
      answers: { q1: { value: '18', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    fullQuestionCard = subject.renderQuestion(question, 0, withOverflowValue);
    ratingInput = findFirstNodeByType(fullQuestionCard, FullQuestionRatingInput);
    expect(ratingInput).not.toBeNull();
    expect(ratingInput.props.value).toBe(10);
    expect(renderToStaticMarkup(ratingInput)).toContain('10');

    const withNonNumericValue = {
      answers: { q1: { value: 'abc', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    fullQuestionCard = subject.renderQuestion(question, 0, withNonNumericValue);
    ratingInput = findFirstNodeByType(fullQuestionCard, FullQuestionRatingInput);
    expect(ratingInput).not.toBeNull();
    expect(ratingInput.props.value).toBe(0);
    expect(renderToStaticMarkup(ratingInput)).toContain('0');
  });

  it('persists keyboard-driven full-mode rating edits immediately', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = jest.fn(() => []);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.isQuestionLockedForResponse = () => false;

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    subject.state = {
      ...subject.state,
      questionPool: [question],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: 2, encrypted: false, encryptionAudience: 'self' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, subject.state.surveysResponseState[0]);
    const ratingInput = findFirstNodeByType(fullQuestionCard, FullQuestionRatingInput);

    expect(ratingInput).not.toBeNull();

    ratingInput.props.onChange(6, { type: 'keydown' });

    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe(6);
    expect(subject.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledTimes(1);
  });

  it('uses the deferred slider wrapper for single-question rating cards', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    const currentSurveyResponseState = {
      answers: { q1: { value: '8', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);
    const deferredSlider = findElement(fullQuestionCard, (node) => node?.type === DeferredRatingSlider);

    expect(deferredSlider).not.toBeNull();
    expect(deferredSlider.props.value).toBe(8);
    expect(typeof deferredSlider.props.onCommit).toBe('function');
  });

  it('encrypts both rating envelopes with one audience context and clears plaintext rating values', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {
            q1: { value: '*', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'gate' },
          },
          importance: { q1: 7 },
          conviction: { q1: 3 },
        },
      ],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
      additional: { value: '', encrypted: false },
      importance: 7,
      conviction: 3,
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { importance: 1, conviction: 1 } },
    }));
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'gate');
    subject.getDefaultResponseEncryptionAudienceForQid = jest.fn(() => 'gate');
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = { recipients, accessControlConditions: recipients[0].accessControlConditions, chain: 'base' };
    subject.getEffectiveRecipientsForQid = jest.fn(() => recipients);
    subject.buildLitEncryptionOptionsForRecipients = jest.fn(() => sharedLitOpts);

    const encryptSpy = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockImplementation(async (_value, opts) => `env:${opts.qId}`);
    const submitSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: `0x${'1'.repeat(64)}`,
        }),
      });

    const receipt = await subject.submitSurveyResponse();

    expect(receipt).toEqual(expect.objectContaining({ status: 1 }));
    expect(encryptSpy).toHaveBeenCalledTimes(2);
    expect(encryptSpy.mock.calls[0][1].qId).toBe('importance:q1');
    expect(encryptSpy.mock.calls[1][1].qId).toBe('conviction:q1');
    expect(encryptSpy.mock.calls[0][1].lit).toBe(sharedLitOpts);
    expect(encryptSpy.mock.calls[1][1].lit).toBe(sharedLitOpts);

    const submittedResponses = submitSpy.mock.calls[0][2];
    expect(submittedResponses[0]).toEqual(expect.objectContaining({
      importanceEncrypted: 'env:importance:q1',
      convictionEncrypted: 'env:conviction:q1',
      importance: null,
      conviction: null,
    }));
  });

  it('uses the session chain for rating envelope encryption when wallet-facing network props point at Base mainnet', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 8453, chainId: 8453, name: 'Base' },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge', networkChainId: 84532 },
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {
            q1: { value: '*', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'gate' },
          },
          importance: { q1: 7 },
          conviction: { q1: 3 },
        },
      ],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
      additional: { value: '', encrypted: false },
      importance: 7,
      conviction: 3,
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { importance: 1, conviction: 1 } },
    }));
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'gate');
    subject.getDefaultResponseEncryptionAudienceForQid = jest.fn(() => 'gate');
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = { recipients, accessControlConditions: recipients[0].accessControlConditions, chain: 'base' };
    subject.getEffectiveRecipientsForQid = jest.fn(() => recipients);
    subject.buildLitEncryptionOptionsForRecipients = jest.fn(() => sharedLitOpts);

    const encryptSpy = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockImplementation(async (_value, opts) => `env:${opts.qId}`);
    const submitSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: `0x${'3'.repeat(64)}`,
        }),
      });

    await subject.submitSurveyResponse();

    expect(encryptSpy).toHaveBeenCalledTimes(2);
    expect(encryptSpy.mock.calls[0][1].chainId).toBe(84532);
    expect(encryptSpy.mock.calls[1][1].chainId).toBe(84532);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('writes submitted responses into local caches without advancing scan watermarks', async () => {
    const slug = 'edge-submit-local';
    const surveyId = '0xsurvey';
    const responder = '0xabc';
    const surveyResponseSeed = {
      surveyID: surveyId,
      responder,
      surveyTitle: 'Existing Survey',
      responses: [
        {
          questionID: 'q0',
          responder,
          type: 'freeform',
          prompt: 'Existing prompt',
          answer: { value: 'old', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
      blockNumber: 5,
      transactionIndex: 0,
      logIndex: 0,
      timestamp: 5,
    };

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    await cacheScripts.writeCache('surveysCache', slug, {
      '84532': {
        surveys: {
          [surveyId]: {
            id: surveyId,
            surveyID: surveyId,
            title: 'Existing Survey',
            questionIDs: ['q0'],
          },
        },
        surveysLatestBlock: 0,
        surveyResponses: {
          [surveyId]: {
            [responder]: surveyResponseSeed,
          },
        },
        surveyResponsesLatestBlock: {},
      },
    });

    try {
      const subject = new SurveyQuestions({
        surveyIndex: 0,
        surveyId,
        account: responder,
        loginComplete: true,
        network: { id: 84532 },
        sessionSlug: slug,
        activeSessionSlug: slug,
      });
      subject._getEffectiveDraftSlug = jest.fn(() => slug);

      const result = await subject.writeSubmittedResponsesToLocalCaches({
        receipt: {
          blockNumber: 22,
          transactionIndex: 3,
          transactionHash: `0x${'2'.repeat(64)}`,
        },
        questionResponses: [
          {
            questionID: 'q1',
            responder,
            type: 'freeform',
            prompt: 'New prompt',
            answer: { value: 'fresh', encrypted: false },
            additional: { value: '', encrypted: false },
            importance: null,
            conviction: null,
            sessionName: 'Edge Session',
          },
        ],
        surveyResponse: {
          surveyID: surveyId,
          responder,
          surveyTitle: 'Updated Survey',
          sessionName: 'Edge Session',
          responses: [
            {
              questionID: 'q1',
              responder,
              type: 'freeform',
              prompt: 'New prompt',
              answer: { value: 'fresh', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
        },
        surveyId,
      });

      expect(result).toEqual({ questionCacheWritten: true, surveyCacheWritten: true });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questionResponses?.q1?.[responder]).toEqual(expect.objectContaining({
        questionID: 'q1',
        blockNumber: 22,
        transactionIndex: 3,
        logIndex: 0,
        transactionHash: `0x${'2'.repeat(64)}`,
      }));
      expect(questionsCache?.['84532']?.questionResponsesMeta?.q1?.[responder]).toEqual(expect.objectContaining({
        bn: 22,
        txi: 3,
        li: 0,
      }));
      expect(questionsCache?.['84532']?.questionResponsesLatestBlock).toBe(0);
      expect(questionsCache?.['84532']?.questions?.q1).toEqual(expect.objectContaining({
        id: 'q1',
        prompt: 'New prompt',
        type: 'freeform',
        sessionName: 'Edge Session',
      }));

      const surveysCache = await cacheScripts.readCache('surveysCache', slug);
      const mergedSurveyResponse = surveysCache?.['84532']?.surveyResponses?.[surveyId]?.[responder];
      expect(mergedSurveyResponse).toEqual(expect.objectContaining({
        surveyID: surveyId,
        blockNumber: 22,
        transactionIndex: 3,
        logIndex: 0,
        transactionHash: `0x${'2'.repeat(64)}`,
      }));
      expect(mergedSurveyResponse?.responses).toEqual(expect.arrayContaining([
        expect.objectContaining({ questionID: 'q0' }),
        expect.objectContaining({ questionID: 'q1' }),
      ]));
      expect(surveysCache?.['84532']?.surveys?.[surveyId]).toEqual(expect.objectContaining({
        title: 'Updated Survey',
        sessionName: 'Edge Session',
        questionIDs: expect.arrayContaining(['q0', 'q1']),
      }));
      expect(surveysCache?.['84532']?.surveyResponsesLatestBlock).toEqual({});
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
      await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    }
  });

  it('writes submitted responses into the explicit submission slug cache instead of the route slug', async () => {
    const routeSlug = 'edge-submit-route';
    const submissionSlug = 'alpha-submit-target';
    const responder = '0xabc';

    await cacheScripts.removeCache('questionsCache', routeSlug).catch(() => null);
    await cacheScripts.removeCache('questionsCache', submissionSlug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', routeSlug, {
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });

    try {
      const subject = new SurveyQuestions({
        surveyIndex: 0,
        account: responder,
        loginComplete: true,
        network: { id: 84532 },
        sessionSlug: routeSlug,
        activeSessionSlug: routeSlug,
      });
      subject._getEffectiveDraftSlug = jest.fn(() => routeSlug);

      const result = await subject.writeSubmittedResponsesToLocalCaches({
        receipt: {
          blockNumber: 31,
          transactionIndex: 4,
          transactionHash: `0x${'8'.repeat(64)}`,
        },
        questionResponses: [
          {
            questionID: 'q1',
            responder,
            type: 'freeform',
            prompt: 'Alpha prompt',
            answer: { value: 'fresh', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
        submissionSlug,
      });

      expect(result).toEqual({ questionCacheWritten: true, surveyCacheWritten: false });
      const routeCache = await cacheScripts.readCache('questionsCache', routeSlug);
      const submissionCache = await cacheScripts.readCache('questionsCache', submissionSlug);
      expect(routeCache?.['84532']?.questionResponses?.q1).toBeUndefined();
      expect(submissionCache?.['84532']?.questionResponses?.q1?.[responder]).toEqual(expect.objectContaining({
        questionID: 'q1',
        blockNumber: 31,
        transactionIndex: 4,
      }));
    } finally {
      await cacheScripts.removeCache('questionsCache', routeSlug).catch(() => null);
      await cacheScripts.removeCache('questionsCache', submissionSlug).catch(() => null);
    }
  });

  it('routes pile submissions through the changed question session slug', async () => {
    const submitSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: `0x${'6'.repeat(64)}`,
        }),
      });

    const subject = new SurveyQuestions({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [],
      pileQuestions: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Prompt 1',
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
      }],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));

    const receipt = await subject.submitSurveyResponse();

    expect(submitSpy.mock.calls[0][5]).toBe('alpha');
    expect(receipt).toEqual(expect.objectContaining({
      status: 1,
      __ceSubmissionGroupKey: 'alpha',
    }));
  });

  it('blocks pile submissions that span multiple session slugs', async () => {
    const submitSpy = jest.spyOn(contractScripts, 'submitResponses').mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        transactionHash: `0x${'7'.repeat(64)}`,
      }),
    });

    const subject = new SurveyQuestions({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: { value: 'yes', encrypted: false },
          q2: { value: 'no', encrypted: false },
        },
        additionalComments: {
          q1: { value: '', encrypted: false },
          q2: { value: '', encrypted: false },
        },
        importance: {},
        conviction: {},
      }],
      questionPool: [],
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Prompt 1', sessionSlug: 'alpha' },
        { id: 'q2', type: 'freeform', prompt: 'Prompt 2', sessionSlug: 'beta' },
      ],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
        {
          questionID: 'q2',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 2',
          answer: { value: 'no', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1', 'q2']),
      changedMap: {
        q1: { answer: 1 },
        q2: { answer: 1 },
      },
    }));

    await expect(subject.submitSurveyResponse()).rejects.toThrow(
      'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.'
    );
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('does not write submitted responses into a borrowed general network cache when the draft slug is unresolved', async () => {
    const slug = 'missing-session-slug';
    const surveyId = '0xsurvey';
    const responder = '0xabc';
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (inputSlug) => (
      String(inputSlug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((inputSlug) => (
      strictLookup(inputSlug) || generalCfg
    ));

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', slug, {
      '84532': {
        questions: {
          qGeneral: {
            id: 'qGeneral',
            prompt: 'Borrowed general prompt',
          },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    await cacheScripts.writeCache('surveysCache', slug, {
      '84532': {
        surveys: {
          [surveyId]: {
            id: surveyId,
            surveyID: surveyId,
            title: 'Borrowed General Survey',
            questionIDs: ['qGeneral'],
          },
        },
        surveyResponses: {},
      },
    });

    try {
      const subject = new SurveyQuestions({
        surveyIndex: 0,
        surveyId,
        account: responder,
        loginComplete: true,
        sessionSlug: slug,
        activeSessionSlug: '',
      });
      subject._getEffectiveDraftSlug = jest.fn(() => slug);

      const result = await subject.writeSubmittedResponsesToLocalCaches({
        receipt: {
          blockNumber: 22,
          transactionIndex: 3,
          transactionHash: `0x${'2'.repeat(64)}`,
        },
        questionResponses: [
          {
            questionID: 'q1',
            responder,
            type: 'freeform',
            prompt: 'New prompt',
            answer: { value: 'fresh', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
        surveyResponse: {
          surveyID: surveyId,
          responder,
          surveyTitle: 'Updated Survey',
          responses: [
            {
              questionID: 'q1',
              responder,
              type: 'freeform',
              prompt: 'New prompt',
              answer: { value: 'fresh', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
        },
        surveyId,
      });

      expect(result).toEqual({ questionCacheWritten: false, surveyCacheWritten: false });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questions?.qGeneral).toEqual(expect.objectContaining({
        id: 'qGeneral',
        prompt: 'Borrowed general prompt',
      }));
      expect(questionsCache?.['84532']?.questions?.q1).toBeUndefined();
      expect(questionsCache?.['84532']?.questionResponses?.q1).toBeUndefined();

      const surveysCache = await cacheScripts.readCache('surveysCache', slug);
      expect(surveysCache?.['84532']?.surveys?.[surveyId]).toEqual(expect.objectContaining({
        title: 'Borrowed General Survey',
        questionIDs: ['qGeneral'],
      }));
      expect(surveysCache?.['84532']?.surveyResponses?.[surveyId]?.[responder]).toBeUndefined();
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
      await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    }
  });

  it('skips immediate response refreshes after submit when local cache write-through succeeds', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 42,
      transactionHash: `0x${'3'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
          importance: null,
          conviction: null,
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        surveyTitle: 'Survey 1',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: true,
      surveyCacheWritten: true,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
    };
    subject._submitGuard = true;

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({ status: 1, blockNumber: 42 }),
      surveyId: '0xsurvey',
    }));
    expect(subject._submitGuard).toBe(false);
    expect(refreshQuestionResponses).not.toHaveBeenCalled();
    expect(refreshSurveyResponsesByID).not.toHaveBeenCalled();
  });

  it('falls back to immediate response refreshes after submit when local cache write-through cannot update caches', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 42,
      transactionHash: `0x${'4'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: false,
      surveyCacheWritten: false,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
    };

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('passes the merged encrypted slice into submit work before async state flush', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1, additional: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 1 }));
    subject.buildFieldEncryptionWorkGroups = jest.fn(() => ({
      groups: [{
        recipients: [{ type: 'lit-sbt-v1' }],
        qids: ['q1'],
        slice: {
          answers: {
            q1: {
              value: 'yes',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: '',
            },
          },
          additionalComments: {
            q1: {
              value: 'context',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: '',
            },
          },
          importance: {},
          conviction: {},
        },
      }],
      missingRecipients: [],
    }));
    subject.encryptFieldWorkGroups = jest.fn().mockResolvedValue({
      answers: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'answer-env',
          hash: 'answer-hash',
        },
      },
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'additional-env',
          hash: 'additional-hash',
        },
      },
    });
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 77,
      transactionHash: `0x${'7'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
          additional: { value: '*', encrypted: true, encryptedPortion: 'additional-env' },
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
            additional: { value: '*', encrypted: true, encryptedPortion: 'additional-env' },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: true,
      surveyCacheWritten: true,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
          additional: { value: '*', encrypted: true, encryptedPortion: 'additional-env' },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            value: 'yes',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: '',
          },
        },
        additionalComments: {
          q1: {
            value: 'context',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: '',
          },
        },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
    };

    const deferredStatePatches = [];
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        if (Object.prototype.hasOwnProperty.call(patch, 'surveysResponseState')) {
          deferredStatePatches.push(patch);
        } else {
          subject.state = { ...subject.state, ...patch };
        }
      }
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
      return patch;
    };
    subject._submitGuard = true;

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(
      deferredStatePatches.some((patch) => Array.isArray(patch?.surveysResponseState))
    ).toBe(true);
    expect(subject.submitSurveyResponse).toHaveBeenCalledTimes(1);
    expect(subject.submitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({
          q1: expect.objectContaining({
            value: '*',
            encrypted: true,
            encryptedPortion: 'answer-env',
          }),
        }),
        additionalComments: expect.objectContaining({
          q1: expect.objectContaining({
            value: '*',
            encrypted: true,
            encryptedPortion: 'additional-env',
          }),
        }),
      }),
      expect.any(Set),
    );
    expect(subject.submitSurveyResponse.mock.calls[0][1]).toEqual(new Set(['q1']));
    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({ status: 1, blockNumber: 77 }),
    }));
  });

  it('uses the resolved submission slug for post-submit cache writes and refresh fallback', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 52,
      transactionHash: `0x${'9'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
      __ceSubmissionGroupKey: 'alpha',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: false,
      surveyCacheWritten: false,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
    };

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      submissionSlug: 'alpha',
    }));
    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('canonicalizes reserved session aliases in post-submit survey response links', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const buildSubject = (submissionGroupKey) => {
      const subject = new SurveyQuestions({
        surveyIndex: 0,
        surveyId: '0xsurvey',
        account: '0xabc',
        loginComplete: true,
        provider: {},
        network: { id: 84532 },
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
      });

      subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
      subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
      subject.getChangedQidsAndFields = jest.fn(() => ({
        changedQids: new Set(['q1']),
        changedMap: { q1: { answer: 1 } },
      }));
      subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
      subject.submitSurveyResponse = jest.fn().mockResolvedValue({
        status: 1,
        blockNumber: 52,
        transactionHash: `0x${'9'.repeat(64)}`,
        __ceQuestionResponses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
        __ceSurveyResponse: {
          surveyID: '0xsurvey',
          responder: '0xabc',
          responses: [
            {
              questionID: 'q1',
              responder: '0xabc',
              type: 'freeform',
              prompt: 'Prompt 1',
              answer: { value: 'yes', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
        },
        __ceSurveyId: '0xsurvey',
        __ceSubmissionGroupKey: submissionGroupKey,
      });
      subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
        questionCacheWritten: true,
        surveyCacheWritten: true,
      });
      subject.clearDraftFor = jest.fn();
      subject.invalidateDiffCaches = jest.fn();
      subject.prepareJsonAndHash = jest.fn(() => ({
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      }));
      subject.state = {
        ...subject.state,
        surveysResponseState: [{
          answers: { q1: { value: 'yes', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false } },
          importance: {},
          conviction: {},
        }],
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
        pileQuestions: [],
        isSubmitting: false,
        submissionComplete: false,
        submittedSinceLastEdit: false,
        modifiedCount: 1,
        hasEncryptedChanges: false,
      };
      subject.setState = (updater, callback) => {
        const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
        subject.state = { ...subject.state, ...(patch || {}) };
        if (typeof callback === 'function') {
          const pending = callback();
          if (pending && typeof pending.then === 'function') {
            subject._lastSetStatePromise = pending;
          }
        }
      };

      return subject;
    };

    const debateSubject = buildSubject('DEBATE');
    await debateSubject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (debateSubject._lastSetStatePromise) await debateSubject._lastSetStatePromise;
    expect(debateSubject.state.responseUrl).toBe('/survey/0xsurvey/0xabc?session=DEBATE');

    const generalSubject = buildSubject('general');
    await generalSubject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (generalSubject._lastSetStatePromise) await generalSubject._lastSetStatePromise;
    expect(generalSubject.state.responseUrl).toBe('/survey/0xsurvey/0xabc');
  });

  it('ignores out-of-scope baseline keys and clears pending count after undo in full mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: {
        q1: { value: 'base', encrypted: false, encryptionAudience: 'self' },
        orphan: { value: 'stale', encrypted: false, encryptionAudience: 'self' },
      },
      additionalComments: {
        q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        orphan: { value: '', encrypted: false, encryptionAudience: 'self' },
      },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: {
        q1: { value: 'base', encrypted: false, encryptionAudience: 'self' },
      },
      additionalComments: {
        q1: { value: '', encrypted: false, encryptionAudience: 'self' },
      },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    expect(subject.getPendingEditStats(0).total).toBe(0);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'base + edit',
    };
    subject._changedQidsAndFieldsCache = null;
    expect(subject.getPendingEditStats(0).total).toBe(1);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'base',
    };
    subject._changedQidsAndFieldsCache = null;
    expect(subject.getPendingEditStats(0).total).toBe(0);
  });

  it('uses pile question scope for pending diffs so one edit counts as one', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      questionPool: [],
      pileQuestions: [{ id: 'pile-q1' }],
      surveysResponseState: [
        {
          answers: { 'pile-q1': { value: 'same', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: { 'pile-q1': { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: {
          'pile-q1': { value: 'same', encrypted: false, encryptionAudience: 'self' },
          orphan: { value: 'stale', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          'pile-q1': { value: '', encrypted: false, encryptionAudience: 'self' },
          orphan: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      userAnswers: null,
      isLoadingResponse: false,
    };

    expect(subject.getPendingEditStats(0).total).toBe(0);

    subject.state.surveysResponseState[0].answers['pile-q1'] = {
      ...subject.state.surveysResponseState[0].answers['pile-q1'],
      value: 'edited',
    };
    subject._changedQidsAndFieldsCache = null;
    expect(subject.getPendingEditStats(0).total).toBe(1);
  });

  it('tracks visible and off-screen edits from response slices while keeping unchanged baseline at zero', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);

    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
            q2: { value: 'other', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: { q1: { ...emptyField }, q2: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: {
          q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
          q2: { value: 'other', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: { q1: { ...emptyField }, q2: { ...emptyField } },
        importance: {},
        conviction: {},
      },
      userAnswers: null,
      isLoadingResponse: false,
    };

    const unchanged = subject.getChangedQidsAndFields(0);
    expect(unchanged.changedQids.size).toBe(0);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          ...subject.state.surveysResponseState[0],
          answers: {
            ...subject.state.surveysResponseState[0].answers,
            q1: { value: 'edited-visible', encrypted: false, encryptionAudience: 'self' },
          },
        },
      ],
    };
    subject._changedQidsAndFieldsCache = null;
    const visibleEdit = subject.getChangedQidsAndFields(0);
    expect(visibleEdit.changedQids.has('q1')).toBe(true);
    expect(visibleEdit.changedQids.has('q2')).toBe(false);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          ...subject.state.surveysResponseState[0],
          answers: {
            ...subject.state.surveysResponseState[0].answers,
            q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
            q2: { value: 'edited-offscreen', encrypted: false, encryptionAudience: 'self' },
          },
        },
      ],
    };
    subject._changedQidsAndFieldsCache = null;
    const offscreenEdit = subject.getChangedQidsAndFields(0);
    expect(offscreenEdit.changedQids.has('q1')).toBe(false);
    expect(offscreenEdit.changedQids.has('q2')).toBe(true);
  });

  it('reuses changed-qids cache when slice refs churn but semantic content is unchanged', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: { q1: { value: 'same', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: { q1: { value: 'same', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    const indexSpy = jest.spyOn(subject, 'getIndexedQuestionEntryKeys');
    const first = subject.getChangedQidsAndFields(0);
    expect(first.changedQids.size).toBe(0);
    expect(indexSpy).toHaveBeenCalled();

    indexSpy.mockClear();
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { ...current.answers.q1 } },
        additionalComments: { q1: { ...current.additionalComments.q1 } },
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: { q1: { ...baseline.answers.q1 } },
        additionalComments: { q1: { ...baseline.additionalComments.q1 } },
        importance: {},
        conviction: {},
      },
    };

    const second = subject.getChangedQidsAndFields(0);
    expect(second).toBe(first);
    expect(indexSpy).not.toHaveBeenCalled();
  });

  it('recomputes changed-qids cache when a middle array value changes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: {
        q1: {
          value: ['A', 'B', 'C'],
          encrypted: false,
          encryptionAudience: 'self',
        },
      },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: {
        q1: {
          value: ['A', 'B', 'C'],
          encrypted: false,
          encryptionAudience: 'self',
        },
      },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    const first = subject.getChangedQidsAndFields(0);
    expect(first.changedQids.size).toBe(0);

    const indexSpy = jest.spyOn(subject, 'getIndexedQuestionEntryKeys');
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            ...current.answers.q1,
            value: ['A', 'D', 'C'],
          },
        },
        additionalComments: { q1: { ...current.additionalComments.q1 } },
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: { q1: { ...baseline.answers.q1 } },
        additionalComments: { q1: { ...baseline.additionalComments.q1 } },
        importance: {},
        conviction: {},
      },
    };

    const second = subject.getChangedQidsAndFields(0);
    expect(second).not.toBe(first);
    expect(second.changedQids.has('q1')).toBe(true);
    expect(indexSpy).toHaveBeenCalled();
  });

  it('counts encrypted rating edits when baseline has missing plaintext rating', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: '*', encrypted: true, encryptionAudience: 'self' } },
          additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: { q1: 7 },
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: '*', encrypted: true, encryptionAudience: 'self' } },
        additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
        importance: {},
        conviction: {},
      },
      userAnswers: null,
      isLoadingResponse: false,
    };

    expect(subject.getPendingEditStats(0).total).toBe(1);
  });

  it('clears binary answer when selecting the same option again', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = () => [];
    subject.resolveFieldEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: 'Agree', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 'Agree');
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('');
  });

  it('skips no-op answer updates for repeated freeform values with stable encryption state', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.setState = jest.fn();
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = jest.fn(() => []);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'same',
              encrypted: false,
              encryptionAudience: 'self',
              hash: '0xabc',
            },
          },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 'same');
    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.getEffectiveRecipientsForQid).not.toHaveBeenCalled();
  });

  it('defers draft persistence for slider-driven rating updates until the drag completes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = jest.fn(() => []);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.isQuestionLockedForResponse = () => false;
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'rating' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: 2, encrypted: false, encryptionAudience: 'self' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 6, { persistDraft: false });

    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe(6);
    expect(subject.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).not.toHaveBeenCalled();

    subject.flushDraftPersistAfterSliderChange();
    expect(subject.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('gates deferred json preview updates when response preview is hidden', () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.updateJsonPreview = jest.fn();
    subject.state = { ...subject.state, showResponseJson: false };

    subject.scheduleJsonPreviewUpdate(40);
    jest.advanceTimersByTime(50);
    expect(subject.updateJsonPreview).not.toHaveBeenCalled();

    subject.state = { ...subject.state, showResponseJson: true };
    subject.scheduleJsonPreviewUpdate(40);
    jest.advanceTimersByTime(50);
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('refreshes json preview immediately when response json panel is opened', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.updateJsonPreview = jest.fn();
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    };
    subject.state = { ...subject.state, showResponseJson: false };

    subject.toggleShowResponseJson();

    expect(subject.state.showResponseJson).toBe(true);
    expect(subject.updateJsonPreview).toHaveBeenCalledWith(true);
  });

  it('does not inherit the general session name in single-question response json when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      sessionName: 'General Session',
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      provider: {},
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt without session name' }],
      surveysResponseState: [{
        answers: {
          q1: { value: 'hello', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
      }],
    };

    const json = subject.prepareJsonAndHash(0);

    expect(json).toEqual(expect.objectContaining({
      questionID: 'q1',
      responder: '0xabc',
      prompt: 'Prompt without session name',
      sessionName: '',
    }));
  });

  it('masks locked question prompts in response json payloads', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: {},
    });
    subject.state = {
      ...subject.state,
      questionPool: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Secret locked prompt',
        promptEncrypted: '{"ciphertext":"prompt-cipher"}',
      }],
      surveysResponseState: [{
        answers: {
          q1: { value: 'answer', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
      }],
    };

    const json = subject.prepareJsonAndHash(0);

    expect(json.prompt).toBe('[encrypted]');
    expect(JSON.stringify(json)).not.toContain('Secret locked prompt');
  });

  it('allows submit click when submitted latch is active but pending edits exist', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const uploadSpy = jest.fn();
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 1, encrypted: 0 });
    subject.state = {
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      modifiedCount: 1,
    };

    subject.handlePrimarySubmitClick();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks rapid double submit clicks until encryptAndUpload releases the guard', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const deferred = createDeferred();
    const uploadSpy = jest.fn(() => deferred.promise);
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 1, encrypted: 0 });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      modifiedCount: 1,
    };

    subject.handlePrimarySubmitClick();
    subject.handlePrimarySubmitClick();

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(subject._submitGuard).toBe(true);

    deferred.resolve();
    await flushAsyncCallbacks();
  });

  it('revert X only seeds empty structures for currently rendered ids', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: { q1: { value: 'dirty', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: 'saved', encrypted: false, encryptionAudience: 'self' } },
        additionalComments: { q1: { ...emptyField } },
        importance: {},
        conviction: {},
      },
    };
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1', 'q2']);
    subject.clearDraft = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    };

    subject.handleRevertPendingChanges();

    const reverted = subject.state.surveysResponseState?.[0];
    expect(reverted?.answers?.q1?.value).toBe('saved');
    expect(reverted?.answers?.q2).toBeUndefined();
    expect(reverted?.additionalComments?.q2).toBeUndefined();
  });

  it('revert X re-latches submitted state when no pending edits remain', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: { q1: { value: 'dirty', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: 'saved', encrypted: false, encryptionAudience: 'self' } },
        additionalComments: { q1: { ...emptyField } },
        importance: {},
        conviction: {},
      },
      userHasResponse: true,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      pileDiscardedEdits: false,
      isSubmitting: false,
      isDirty: true,
      modifiedCount: 1,
      encryptedModifiedCount: 0,
      hasEncryptedChanges: false,
    };
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.getPendingEditStats = jest.fn().mockReturnValue({ total: 0, encrypted: 0 });
    subject.clearDraft = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    };

    subject.handleRevertPendingChanges();

    expect(subject.state.pileDiscardedEdits).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(true);
    expect(subject.state.modifiedCount).toBe(0);
    expect(subject.state.isDirty).toBe(false);
  });

  it('restores the viewed-response slice when exiting edit mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 2,
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      parsedViewAddressAnswers: { answer: { value: 'viewed' } },
      userAnswers: { answer: { value: 'self' } },
      submittedSinceLastEdit: true,
    };
    syncClassSetState(subject);
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'viewed' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    subject.buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q9: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1', 'q2']);
    subject.buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject.recalculateEditStats = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.clearDraft = jest.fn();

    subject.handleExitEditing();

    expect(subject.state.displayAnswerMode).toBe(true);
    expect(subject.state.isEditing).toBe(false);
    expect(subject.state.startFresh).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(subject.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      {
        answers: {
          q1: { value: 'viewed' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
    ]);
    expect(subject.state.editBaseline).toEqual({
      answers: {
        q1: { value: 'viewed' },
        q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
        q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
      },
    });
    expect(subject.buildSliceFromUserAnswers).toHaveBeenCalledWith({ answer: { value: 'viewed' } });
    expect(subject.clearDraft).toHaveBeenCalledTimes(1);
    expect(subject.recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('renders submitted indicator test id when submitted latch is active', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      questionPool: [],
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('keeps inline submitted indicator visible after submit when userHasResponse is true', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: null,
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('does not render existing-response notice in single-question mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { answer: { ...emptyField } },
    };

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(false);
  });

  it('keeps existing-response notice available in survey mode for bulk decrypt actions', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { responses: [] },
    };

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(true);
  });

  it('renders the single-question inline submit below the question when edits are pending', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).toContain('Question Card');
    expect(markup).toContain('SUBMIT');
    expect(markup).toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(markup).not.toContain('Clear pending changes');
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render single-question submit controls before pending edits appear', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).not.toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render submitted CTA state in single-question mode when no pending edits remain', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: true,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMIT)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(false);
  });

  it('applies single-question response page wrappers in read mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      isLoadingResponse: false,
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      parsedViewAddressAnswers: { answer: { value: '*', encrypted: true } },
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };
    subject.renderQuestionAnswer = jest.fn(() => <div key="resp" data-testid="response-card-stub">Response Card</div>);

    const tree = subject.render();
    const pageRoot = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionPage')
    );
    const responseView = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionResponseView')
    );
    const addressLink = findElement(
      tree,
      (node) => node?.type === 'a' && node?.props?.href === '/u/0xdef'
    );

    expect(pageRoot).not.toBeNull();
    expect(responseView).not.toBeNull();
    expect(addressLink).not.toBeNull();
    expect(treeHasLabel(tree, 'question .json')).toBe(true);
    expect(treeHasLabel(tree, 'response .json')).toBe(true);
    expect(subject.renderQuestionAnswer).toHaveBeenCalledTimes(1);
  });

  it('does not call getPendingEditStats during SurveyQuestions.render', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.getPendingEditStats = jest.fn(() => ({ total: 9, encrypted: 4 }));
    subject.state = {
      ...subject.state,
      displayAnswerMode: false,
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt' }],
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
      showComments: {},
    };

    subject.render();

    expect(subject.getPendingEditStats).not.toHaveBeenCalled();
  });

  it('treats survey/view/network/session context switches as diff input changes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      viewAddress: '0x111',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge-a',
      sessionSlug: 'edge-a',
      sessionSlugPinned: true,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
    };

    const prevState = { ...subject.state };
    const hasDiff = (patch) => {
      const prevProps = { ...subject.props };
      subject.props = { ...subject.props, ...patch };
      const result = subject.didEditDiffInputsChange(prevProps, prevState);
      subject.props = prevProps;
      return result;
    };

    expect(hasDiff({ surveyId: 'survey-b' })).toBe(true);
    expect(hasDiff({ viewAddress: '0x222' })).toBe(true);
    expect(hasDiff({ network: { id: 84533 } })).toBe(true);
    expect(hasDiff({ networkChainId: 84533 })).toBe(true);
    expect(hasDiff({ sessionSlug: 'edge-b' })).toBe(true);
    expect(hasDiff({ sessionSlugPinned: false })).toBe(true);
  });

  it('does not treat ref-only pool churn as diff input change when question ids are unchanged', () => {
    const sharedResponsesState = [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }];
    const sharedBaseline = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const sharedUserAnswers = null;

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'prop-q1' }],
    });

    const prevState = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      isLoadingResponse: false,
      questionPool: [{ id: 'state-q1' }, { id: 'state-q2' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };

    subject.state = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      isLoadingResponse: false,
      questionPool: [{ id: 'state-q2' }, { id: 'state-q1' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };

    const prevProps = { ...subject.props, questionPool: [{ id: 'prop-q1' }] };
    subject.props = { ...subject.props, questionPool: [{ id: 'prop-q1' }] };

    expect(subject.didEditDiffInputsChange(prevProps, prevState)).toBe(false);
  });

  it('skips no-op SurveyQuestions questionPool state writes when fetched payloads are semantically unchanged', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', type: 'binary', prompt: 'Existing in state' },
            },
          },
        };
      }
      return {};
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(subject.props.ensureQuestionCached).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toBeNull();
    expect(subject.state.questionPool[0].prompt).toBe('Existing in state');
  });

  it('updates SurveyQuestions questionPool when fetched payload changes under the same ids', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache' },
            },
          },
        };
      }
      return {};
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(subject.props.ensureQuestionCached).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toEqual({
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt from cache' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    });
    expect(subject.state.questionPool[0].prompt).toBe('Prompt from cache');
  });

  it('hydrates all survey question ids into the direct-route question pool', async () => {
    const surveyQuestionIds = Array.from({ length: 10 }, (_, index) => `q${index + 1}`);
    const questionsCache = { '84532': { questions: {} } };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const ensureQuestionCached = jest.fn(async (qid) => {
      questionsCache['84532'].questions[String(qid).toLowerCase()] = {
        id: String(qid).toLowerCase(),
        type: 'freeform',
        prompt: `Prompt ${qid}`,
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(ensureQuestionCached).toHaveBeenCalledTimes(10);
    expect(subject.state.questionPool).toHaveLength(10);
    expect(subject.state.questionPool[9]).toEqual(expect.objectContaining({ id: 'q10' }));
  });

  it('keeps direct-route survey questions that hydrated successfully when one cache fetch fails', async () => {
    const surveyQuestionIds = ['q1', 'q2', 'q3', 'q4'];
    const questionsCache = { '84532': { questions: {} } };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const ensureQuestionCached = jest.fn(async (qid) => {
      const lowered = String(qid).toLowerCase();
      if (lowered === 'q3') {
        throw new Error('transient fetch failure');
      }
      questionsCache['84532'].questions[lowered] = {
        id: lowered,
        type: 'freeform',
        prompt: `Prompt ${qid}`,
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(ensureQuestionCached).toHaveBeenCalledTimes(4);
    expect(subject.state.questionPool.map((q) => q.id)).toEqual(['q1', 'q2', 'q4']);
    expect(subject.state.questionPoolExpectedIds).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(subject.state.questionPoolPendingIds).toEqual(['q3']);
  });

  it('does not read survey/question caches from a borrowed general network when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Borrowed Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: {
                id: 'q1',
                type: 'freeform',
                prompt: 'Borrowed general question',
              },
            },
          },
        };
      }
      return {};
    });
    const getSurveyDataByIdSpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      questionIDs: ['q1'],
      title: 'Borrowed Survey',
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'stale-q1', prompt: 'stale question' }],
      questionPoolExpectedIds: ['stale-q1'],
      questionPoolPendingIds: [],
    };
    syncClassSetState(subject);
    peekSpy.mockClear();

    await subject.fetchQuestionPool();

    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
    expect(subject.props.ensureQuestionCached).not.toHaveBeenCalled();
    expect(peekSpy).not.toHaveBeenCalled();
    expect(subject.state.questionPool).toEqual([]);
    expect(subject.state.questionPoolExpectedIds).toEqual([]);
    expect(subject.state.questionPoolPendingIds).toEqual([]);

    peekSpy.mockClear();

    await expect(subject.loadQuestionFromCache('q1')).resolves.toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('reports pending survey question-pool hydration from SurveyQuestions state', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
    });

    subject.state = {
      ...subject.state,
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    };

    expect(subject.getSurveyQuestionPoolLoadState()).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    subject.props = {
      ...subject.props,
      isStandalone: true,
    };

    expect(subject.getSurveyQuestionPoolLoadState()).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('clears auto-decrypt state when a blocked provider toggles auto-decrypt', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
    });

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      decryptingByKey: { 'q1:answer': true },
    };
    syncClassSetState(subject);
    subject.isAutoDecryptBlocked = jest.fn(() => true);
    subject.clearAutoDecryptSweepScheduling = jest.fn();
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };

    subject.toggleAutoDecrypt();

    expect(subject.state.autoDecryptEnabled).toBe(false);
    expect(subject.state.decryptingByKey).toEqual({});
    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(subject.clearAutoDecryptSweepScheduling).toHaveBeenCalledTimes(1);
  });

  it('blocks survey submit while expected survey questions are still loading', async () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
      surveysResponseState: [{
        answers: { q1: { value: 'Answer 1', encrypted: false } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', encrypted: false } },
      }],
      submissionError: '',
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    const getProviderKindSpy = jest.spyOn(cryptoUtils, 'getProviderKind');
    subject._submitGuard = true;

    try {
      await subject.encryptAndUpload();

      expect(subject.fetchQuestionPool).toHaveBeenCalledTimes(1);
      expect(getProviderKindSpy).not.toHaveBeenCalled();
      expect(subject._submitGuard).toBe(false);
      expect(subject.state.isSubmitting).toBe(false);
      expect(subject.state.submissionError).toBe('Loading 1 more question...');

      jest.runOnlyPendingTimers();
      expect(subject.state.submissionError).toBe('');
    } finally {
      getProviderKindSpy.mockRestore();
    }
  });

  it('skips rendered pool patching when incoming payload is semantically unchanged', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    const baselineQuestion = { id: 'q1', type: 'binary', prompt: 'Stable prompt' };
    subject.state = {
      ...subject.state,
      questionPool: [baselineQuestion],
      pileQuestions: [baselineQuestion],
      allQuestionsForFilter: [baselineQuestion],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.applyQuestionPayloadToRenderedPools('q1', {
      id: 'q1',
      type: 'binary',
      prompt: 'Stable prompt',
    });

    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toBeNull();
  });

  it('recomputes pending stats before survey context reloads', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-b',
      viewAddress: '0xbbb',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 5, encrypted: 2 }));
    subject.emitPendingStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    subject.fetchSurveyResponse = jest.fn().mockResolvedValue(undefined);
    subject.checkAndHandleStartFresh = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      surveyId: 'survey-a',
      viewAddress: '0xaaa',
      network: { id: 1 },
      networkChainId: 1,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(subject.emitPendingStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
    expect(subject.recalculateEditStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
  });

  it('recalculates modified stats on diff-input-only updates', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 3, encrypted: 1 }));
    subject.emitPendingStats = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      loginComplete: false,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(subject.emitPendingStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
    expect(subject.recalculateEditStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
  });

  it('auto-starts fresh only when the active slice is effectively empty', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
      viewAddress: '',
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        null,
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.handleStartFresh = jest.fn();

    subject.checkAndHandleStartFresh();
    expect(subject.handleStartFresh).toHaveBeenCalledTimes(1);

    subject.handleStartFresh.mockClear();
    subject.state.surveysResponseState[1].additionalComments.q1 = { value: 'notes' };
    subject.checkAndHandleStartFresh();
    expect(subject.handleStartFresh).not.toHaveBeenCalled();
  });

  it('builds and applies start-fresh survey state before clearing drafts', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 2,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      submittedSinceLastEdit: true,
    };
    syncClassSetState(subject);
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1', 'q2']);
    subject.buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject.clearDraftFor = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.persistDraftSafely = jest.fn();

    subject.handleStartFresh();

    expect(subject.state.suppressPrefill).toBe(true);
    expect(subject.state.startFresh).toBe(true);
    expect(subject.state.modifiedCount).toBe(0);
    expect(subject.state.hasEncryptedChanges).toBe(false);
    expect(subject.state.isDirty).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(subject.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      {
        answers: {
          q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
    ]);
    expect(subject.deepClone).toHaveBeenCalledTimes(1);
    expect(subject.state.editBaseline).toEqual({
      answers: {
        q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
        q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
        q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
      },
    });
    expect(subject.clearDraftFor).toHaveBeenNthCalledWith(1, 'q1');
    expect(subject.clearDraftFor).toHaveBeenNthCalledWith(2, 'q2');
    expect(subject.recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('resets form state for account changes from initialized survey state', () => {
    jest.useFakeTimers();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
    });

    subject.state = {
      ...subject.state,
      submittedSinceLastEdit: true,
      surveysResponseState: [{ answers: { stale: { value: 'stale' } } }],
    };
    syncClassSetState(subject);
    subject.persistDraft = jest.fn();
    subject.initializeSurveyResponseState = jest.fn(() => [
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
    ]);
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject._persistTimer = setTimeout(() => {}, 1000);
    const callback = jest.fn();

    subject.resetFormStateForAccountChange(callback);

    expect(subject.persistDraft).toHaveBeenCalledTimes(1);
    expect(subject._persistTimer).toBeNull();
    expect(subject.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
    ]);
    expect(subject.state.editBaseline).toEqual({
      answers: { q2: { value: '' } },
      importance: {},
      conviction: {},
      additionalComments: { q2: { value: '' } },
    });
    expect(subject.state.isEditing).toBe(false);
    expect(subject.state.isLoadingResponse).toBe(true);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not short-circuit when state questionPool ref changes under stable ids', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'next' }],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.emitPendingStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = { ...subject.props };
    const prevState = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'prev' }],
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.hydrateGateSbtLabels).toHaveBeenCalledTimes(1);
  });

  it('does not short-circuit masked refresh when lit hooks become ready', async () => {
    const litHooksReady = { getKey: jest.fn() };
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: '0xquestion',
      responderAddress: '',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      litHooks: litHooksReady,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    };

    subject.hasMaskedCurrentQuestionPayload = () => true;
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = { ...subject.props, litHooks: null };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledTimes(1);
  });

  it('retries viewed-response bootstrap on readiness even when questionPool is already seeded', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: '0xquestion',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      displayAnswerMode: true,
      parsedViewAddressAnswers: null,
      noResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [{ id: '0xquestion', type: 'binary', prompt: 'seeded' }],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    };

    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      provider: null,
      loginComplete: false,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledTimes(1);
  });

  it('rehydrates standalone prior responses when wallet auth becomes ready after mount', async () => {
    const questionPool = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      provider: 'porto_passkey',
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      questionPool,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.resetFormStateForAccountChange = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevProps = {
      ...subject.props,
      account: '',
      loginComplete: false,
      provider: '',
    };

    await subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.resetFormStateForAccountChange).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('keeps single-question metadata fetch scoped to pinned session slug', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);
    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue(['edge', 'other']);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug) => (
      String(slug || '').toLowerCase() === 'edge'
        ? { slug: 'edge', networkChainId: 84532 }
        : null
    ));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.fetchSingleQuestionData();
    subject.clearSingleQuestionBootstrapRetry();

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(
      getQuestionDataSpy.mock.calls.every((call) => String(call[2] || '').toLowerCase() === 'edge')
    ).toBe(true);
  });

  it('falls back to known candidate slugs when pinned single-question slug is unresolved', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(
      async (_provider, _questionId, candidateSlug) => (
        String(candidateSlug || '').toLowerCase() === 'edge'
          ? { id: 'q1', type: 'binary', prompt: 'Recovered prompt', tags: [] }
          : null
      )
    );
    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue(['edge']);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      String(slug || '').toLowerCase() === 'edge' ? { networkChainId: 84532 } : null
    ));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'general3',
      activeSessionSlug: 'general3',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });

    await subject.fetchSingleQuestionData();
    await callbackRun;
    subject.clearSingleQuestionBootstrapRetry();

    const calledSlugs = getQuestionDataSpy.mock.calls.map((call) => String(call[2] || '').toLowerCase());
    expect(calledSlugs).toContain('general3');
    expect(calledSlugs).toContain('edge');
    expect(subject.state.questionPool[0]).toEqual(
      expect.objectContaining({ id: 'q1', prompt: 'Recovered prompt' })
    );
  });

  it('recovers from timed-out question metadata fetch when late payload arrives', async () => {
    jest.useFakeTimers();
    const deferred = createDeferred();
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(() => deferred.promise);
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });
    const retrySpy = jest.spyOn(subject, 'scheduleSingleQuestionBootstrapRetry');

    const runPromise = subject.fetchSingleQuestionData({
      questionFetchTimeoutMs: 3000,
      questionFetchTimeoutRecoveryMs: 12000,
    });
    await Promise.resolve();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    deferred.resolve({
      id: 'q1',
      type: 'binary',
      prompt: 'Recovered prompt',
      tags: [],
    });
    await Promise.resolve();
    await runPromise;

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
    expect(subject.state.questionPool[0].prompt).toBe('Recovered prompt');
  });

  it('preserves the current single-question metadata when a refetch loses cache state', async () => {
    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce({
        '84532': {
          questions: {
            q1: { id: 'q1', type: 'binary', prompt: 'Existing prompt', tags: [] },
          },
          questionResponses: {},
          questionResponsesMeta: {},
        },
      })
      .mockResolvedValueOnce(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isLoadingResponse: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing prompt', tags: [] }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });

    expect(subject.state.isLoadingResponse).toBe(false);
    expect(subject.state.questionPool).toEqual([
      expect.objectContaining({ id: 'q1', prompt: 'Existing prompt' }),
    ]);
  });

  it('does not downgrade scheduled single-question bootstrap retry attempts on cache ticks', async () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);

    const first = subject.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 2,
      reason: 'seed-attempt',
    });
    const second = subject.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 0,
      reason: 'cache-tick',
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(subject._singleQuestionBootstrapRetrySig).toBe('q1:3');

    jest.advanceTimersByTime(12000);
    await Promise.resolve();
    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({
        forceQuestionMetadataRefetch: true,
        bootstrapRetryAttempt: 3,
      })
    );
  });

  it('reuses the pending single-question bootstrap retry attempt when cache ticks trigger componentDidUpdate', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 1,
      questionResponsesNonce: 1,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      parsedViewAddressAnswers: null,
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt', tags: [] }],
      pileQuestions: [],
    };
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject._singleQuestionBootstrapRetrySig = 'q1:3';

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 0,
    };
    const prevState = {
      ...subject.state,
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({ bootstrapRetryAttempt: 3 })
    );
  });

  it('reuses the pending single-question bootstrap retry attempt during account-change rehydration fetches', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      parsedViewAddressAnswers: { answer: { value: 'cached' } },
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt', tags: [] }],
      pileQuestions: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.resetFormStateForAccountChange = jest.fn((cb) => {
      if (typeof cb === 'function') return cb();
      return undefined;
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject._singleQuestionBootstrapRetrySig = 'q1:3';
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') return cb();
      return patch;
    });

    const prevProps = {
      ...subject.props,
      account: '',
      loginComplete: false,
      provider: null,
    };
    const prevState = {
      ...subject.state,
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.resetFormStateForAccountChange).toHaveBeenCalledTimes(1);
    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({ bootstrapRetryAttempt: 3 })
    );
  });

  it('falls back to a deterministic warning state when viewed response payload shape is malformed', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({});
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      displayAnswerMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      responseLookupWarning: '',
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(subject.state.noResponse).toBe(true);
    expect(subject.state.isLoadingResponse).toBe(false);
    expect(String(subject.state.responseLookupWarning || '')).toContain('could not be rendered');
  });

  it('marks viewed response as no-response when response payload retries are exhausted', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    const getResponseHashSpy = jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue('tx-response-hash');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });
    const retrySpy = jest
      .spyOn(subject, 'scheduleSingleQuestionBootstrapRetry')
      .mockReturnValue(false);

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(getResponseSpy).toHaveBeenCalled();
    expect(getResponseHashSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalled();
    expect(subject.state.noResponse).toBe(true);
    expect(subject.state.isLoadingResponse).toBe(false);
  });

  it('hydrates a viewed response from a fresh persistent cache reread before falling back to hash-only retries', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const staleCache = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    };
    const freshCachedResponse = {
      questionID: 'q1',
      responder: responderAddress,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      additional: { value: '', encrypted: false },
      timestamp: 1700000000,
    };
    const freshCache = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {
          q1: {
            [responderAddress]: freshCachedResponse,
          },
        },
        questionResponsesMeta: {
          q1: {
            [responderAddress]: { bn: 12, txi: 0, li: 0, ts: 1700000000 },
          },
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(staleCache)
      .mockResolvedValueOnce(freshCache);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    const getResponseHashSpy = jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue('tx-response-hash');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      responseLookupWarning: '',
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });
    const retrySpy = jest.spyOn(subject, 'scheduleSingleQuestionBootstrapRetry');

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(getResponseSpy).toHaveBeenCalled();
    expect(getResponseHashSpy).not.toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
    expect(subject.state.noResponse).toBe(false);
    expect(subject.state.isLoadingResponse).toBe(false);
    expect(subject.state.parsedViewAddressAnswers).toEqual(expect.objectContaining({
      responder: responderAddress,
      answer: expect.objectContaining({
        encryptedPortion: 'cipher-answer',
      }),
    }));
  });

  it('marks viewed response as no-response when recent payload bootstrap retries are exhausted', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account,
      loginComplete: true,
      provider: {},
      sessionSlug: 'unknown-slug',
      activeSessionSlug: 'unknown-slug',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    const retrySpy = jest
      .spyOn(subject, 'scheduleSingleQuestionBootstrapRetry')
      .mockReturnValue(false);

    try {
      await subject.fetchSingleQuestionData();
      expect(retrySpy).toHaveBeenCalled();
      expect(subject.state.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
      expect(subject.state.noResponse).toBe(true);
      expect(subject.state.isLoadingResponse).toBe(false);
    } finally {
      sessionStorage.removeItem(recentPayloadKey);
      subject.clearSingleQuestionBootstrapRetry();
    }
  });

  it('writes recent payload into the slugged questions cache before viewed-response bootstrap retries', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    const updateCacheAtomicSpy = jest
      .spyOn(cacheScripts, 'updateCacheAtomic')
      .mockImplementation(async (_namespace, _slug, updater) => updater(null));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account,
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    const retrySpy = jest
      .spyOn(subject, 'scheduleSingleQuestionBootstrapRetry')
      .mockReturnValue(true);

    try {
      await subject.fetchSingleQuestionData();

      expect(retrySpy).toHaveBeenCalled();
      expect(updateCacheAtomicSpy).toHaveBeenCalledWith(
        'questionsCache',
        'edge',
        expect.any(Function)
      );
      expect(subject.state.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
      expect(subject.state.isLoadingResponse).toBe(true);

      const seededCache = await updateCacheAtomicSpy.mock.results[0].value;
      expect(seededCache).toEqual(expect.objectContaining({
        '84532': expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({ id: 'q1', prompt: 'Prompt from recent payload' }),
          }),
        }),
      }));
    } finally {
      sessionStorage.removeItem(recentPayloadKey);
      subject.clearSingleQuestionBootstrapRetry();
    }
  });

  it('does not bootstrap own single-question response from a borrowed general network when the slug is unresolved', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'should-not-load', encrypted: false },
      additional: { value: '', encrypted: false },
    });
    const writeCacheSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account,
      loginComplete: true,
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      userHasResponse: false,
      userResponseEncrypted: false,
      userAnswers: null,
      startFresh: false,
      suppressPrefill: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.prefillSingleQuestionResponse = jest.fn();

    try {
      await subject.fetchSingleQuestionData();
      expect(getResponseSpy).not.toHaveBeenCalled();
      expect(writeCacheSpy).not.toHaveBeenCalled();
      expect(subject.state.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
      expect(subject.state.isLoadingResponse).toBe(false);
      expect(subject.state.userHasResponse).toBe(false);
      expect(subject.prefillSingleQuestionResponse).not.toHaveBeenCalled();
    } finally {
      sessionStorage.removeItem(recentPayloadKey);
      subject.clearSingleQuestionBootstrapRetry();
    }
  });

  it('hydrates own response when recent payload exists and cache state is unavailable', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    const latestResponse = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: '', encrypted: false },
      blockNumber: 12,
      logIndex: 1,
    };
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(latestResponse);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account,
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'unknown-slug',
      activeSessionSlug: 'unknown-slug',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      userHasResponse: false,
      userResponseEncrypted: false,
      userAnswers: null,
      startFresh: false,
      suppressPrefill: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });
    subject.prefillSingleQuestionResponse = jest.fn();

    try {
      await subject.fetchSingleQuestionData();
      await callbackRun;
      expect(getResponseSpy).toHaveBeenCalledWith(
        subject.props.provider,
        account,
        'q1',
        expect.any(String)
      );
      expect(subject.prefillSingleQuestionResponse).toHaveBeenCalledWith(latestResponse);
      expect(subject.state.userHasResponse).toBe(true);
      expect(subject.state.noResponse).toBe(false);
    } finally {
      sessionStorage.removeItem(recentPayloadKey);
      subject.clearSingleQuestionBootstrapRetry();
    }
  });

  it('re-reads fresh cache before ensureQuestionCached write-through to avoid clobbering parallel inserts', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {
          q2: { id: 'q2', type: 'freeform', prompt: 'Already cached', creator: '0xbbb', tags: [] },
        },
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    let readCount = 0;
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return null;
      readCount += 1;
      return readCount === 1 ? clone(staleCache) : clone(freshCache);
    });
    const atomicSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, updater) => (
      updater(clone(freshCache))
    ));
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: ['tag-1'],
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.ensureQuestionCached('q1');

    expect(atomicSpy).toHaveBeenCalled();
    const written = await atomicSpy.mock.results[0].value;
    expect(written['84532'].questions.q2).toEqual(expect.objectContaining({ id: 'q2' }));
    expect(written['84532'].questions.q1).toEqual(expect.objectContaining({ id: 'q1' }));
  });

  it('does not write ensureQuestionCached payloads into a borrowed general network cache when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          qGeneral: { id: 'qGeneral', type: 'freeform', prompt: 'Borrowed general prompt' },
        },
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    });
    const atomicSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic');
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: ['tag-1'],
    });

    const subject = new SurveyTool({
      provider: {},
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.ensureQuestionCached('q1');

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(getQuestionDataSpy).not.toHaveBeenCalled();
    expect(atomicSpy).not.toHaveBeenCalled();
  });

  it('does not write updateCache state into a borrowed general network cache when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyTool({
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      cacheHasLoaded: true,
    });
    syncClassSetState(subject);

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        surveysLatestBlock: 0,
        surveys: {
          surveyGeneral: {
            id: 'surveyGeneral',
            title: 'Borrowed general survey',
            questionIDs: [],
          },
        },
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
      },
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(undefined);

    subject.updateCache((prevCache) => ({
      ...prevCache,
      surveys: {
        ...(prevCache.surveys || {}),
        q1: {
          id: 'q1',
          title: 'Pinned unresolved survey',
          questionIDs: ['question-1'],
        },
      },
    }));

    expect(subject.state.cache.surveys.q1).toEqual(expect.objectContaining({
      id: 'q1',
      title: 'Pinned unresolved survey',
    }));
    expect(peekSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('keeps all parallel ensureQuestionCached writes when a survey route hydrates many question ids at once', async () => {
    await cacheScripts.removeCache('questionsCache', 'edge').catch(() => null);
    jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(async (_provider, questionId) => ({
      id: String(questionId).toLowerCase(),
      type: 'freeform',
      prompt: `Prompt ${questionId}`,
      creator: '0xabc',
      tags: [],
    }));

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) => subject.ensureQuestionCached(`q${index + 1}`))
    );

    const persistedCache = await cacheScripts.readCache('questionsCache', 'edge');
    expect(Object.keys(persistedCache?.['84532']?.questions || {})).toHaveLength(10);
    expect(persistedCache['84532'].questions.q10).toEqual(expect.objectContaining({ id: 'q10' }));
  });

  it('re-reads fresh cache before getLatestQuestionResponse write-through to keep parallel responder data', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: { q1: {} },
        questionResponsesMeta: { q1: {} },
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {
          q1: {
            '0xbbb': {
              answer: { value: 'existing-response' },
              blockNumber: 7,
              logIndex: 2,
            },
          },
        },
        questionResponsesMeta: {
          q1: {
            '0xbbb': { bn: 7, li: 2 },
          },
        },
        questionResponsesLatestBlock: 0,
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'questionsCache' ? clone(freshCache) : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'latest-response' },
      blockNumber: 8,
      logIndex: 3,
    });

    const subject = new SurveyQuestions({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');

    await subject.getLatestQuestionResponse('0xAAA', 'q1', '84532', clone(staleCache));

    expect(writeSpy).toHaveBeenCalled();
    const latestCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const written = latestCall[2];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing-response' } })
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest-response' } })
    );
  });

  it('does not hydrate decrypt envelopes from a borrowed general network when the draft slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { encryptedPortion: 'borrowed-env', encrypted: true, value: '*' },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
    jest.spyOn(cryptoUtils, 'decryptSingleField').mockResolvedValue({
      answers: {},
      additionalComments: {},
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      answer: { encryptedPortion: 'borrowed-env', encrypted: true, value: '*' },
      additional: { value: '', encrypted: false },
    });
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: '',
          },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: false,
            encryptedPortion: '',
            hash: '',
          },
        },
      }],
      userAnswers: null,
      decryptingByKey: {},
      hasher: {},
    };
    peekSpy.mockClear();

    const didUpdate = await subject.handleDecryptQuestionAnswerInternal('q1', 'answer');

    expect(didUpdate).toBe(false);
    expect(subject.getLatestQuestionResponse).not.toHaveBeenCalled();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('routes viewed single-question decrypts through the viewed response payload instead of self-response fallback reads', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.handleDecryptViewedResponseField = jest.fn().mockResolvedValue(true);
    subject.getLatestQuestionResponse = jest.fn();
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
    };

    const didUpdate = await subject.handleDecryptQuestionAnswerInternal('q1', 'answer');

    expect(didUpdate).toBe(true);
    expect(subject.handleDecryptViewedResponseField).toHaveBeenCalledWith(
      'q1',
      'answer',
      expect.objectContaining({
        questionID: 'q1',
        responder: '0xbbb',
        responderAddress: '0xbbb',
        answer: expect.objectContaining({
          encryptedPortion: 'cipher-answer',
        }),
      }),
    );
    expect(subject.getLatestQuestionResponse).not.toHaveBeenCalled();
  });

  it('prefers the latest self-response answer envelope when local response state is stale', async () => {
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptSingleField').mockImplementation(async (slice) => {
      expect(slice.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');
      return {
        answers: {
          q1: { value: 'Choice 2' },
        },
        additionalComments: {},
      };
    });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'self-session',
      activeSessionSlug: 'self-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'self-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xaaa',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
        },
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      userAnswers: null,
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptQuestionAnswerInternal('q1', 'answer');

    expect(didUpdate).toBe(true);
    expect(subject.getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xaaa',
      'q1',
      '84532',
      expect.any(Object),
    );
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('Choice 2');
    decryptSpy.mockRestore();
  });

  it('hydrates missing viewed-response additional envelopes from the responder latest payload before decrypting', async () => {
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptSingleField').mockImplementation(async (slice) => {
      expect(slice.additionalComments.q1.encryptedPortion).toBe('cipher-add');
      return {
        answers: {},
        additionalComments: {
          q1: { value: 'decrypted additional comment' },
        },
      };
    });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'viewed-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      additional: { value: '*', encrypted: true, encryptedPortion: 'cipher-add' },
    });
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        responder: '0xbbb',
        responderAddress: '0xbbb',
        answer: { value: '8', encrypted: false, encryptedPortion: '' },
        additional: { value: '*', encrypted: true, encryptedPortion: '' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptViewedResponseFieldInternal('q1', 'additional', {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '8', encrypted: false, encryptedPortion: '' },
      additional: { value: '*', encrypted: true, encryptedPortion: '' },
    });

    expect(didUpdate).toBe(true);
    expect(subject.getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xbbb',
      'q1',
      '84532',
      expect.any(Object),
    );
    expect(subject.state.parsedViewAddressAnswers.additional.value).toBe('decrypted additional comment');
    decryptSpy.mockRestore();
  });

  it('prefers the latest viewed-response answer envelope when the route payload is stale', async () => {
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptSingleField').mockImplementation(async (slice) => {
      expect(slice.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');
      return {
        answers: {
          q1: { value: 'Choice 2' },
        },
        additionalComments: {},
      };
    });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'viewed-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        responder: '0xbbb',
        responderAddress: '0xbbb',
        answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
        additional: { value: '', encrypted: false, encryptedPortion: '' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptViewedResponseFieldInternal('q1', 'answer', {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
      additional: { value: '', encrypted: false, encryptedPortion: '' },
    });

    expect(didUpdate).toBe(true);
    expect(subject.getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xbbb',
      'q1',
      '84532',
      expect.any(Object),
    );
    expect(subject.state.parsedViewAddressAnswers.answer.value).toBe('Choice 2');
    decryptSpy.mockRestore();
  });

  it('re-reads fresh cache before single-question responder write-through to preserve concurrent responders', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const baseQuestion = {
      id: 'q1',
      type: 'freeform',
      prompt: 'Question 1',
      creator: '0xcreator',
      tags: [],
    };
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: { q1: { ...baseQuestion } },
        questionResponses: { q1: {} },
        questionResponsesMeta: { q1: {} },
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: { q1: { ...baseQuestion } },
        questionResponses: {
          q1: {
            '0xbbb': {
              answer: { value: 'existing' },
              additional: { value: '' },
              blockNumber: 4,
              logIndex: 1,
            },
          },
        },
        questionResponsesMeta: {
          q1: {
            '0xbbb': { bn: 4, txi: 0, li: 1, ts: 11 },
          },
        },
        questionResponsesLatestBlock: 0,
      },
    };
    let readCount = 0;
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return null;
      readCount += 1;
      return readCount === 1 ? clone(staleCache) : clone(freshCache);
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'latest' },
      additional: { value: '' },
      blockNumber: 5,
      transactionIndex: 0,
      logIndex: 2,
      timestamp: 12,
    });
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xAAA',
      account: '0xccc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(writeSpy).toHaveBeenCalled();
    const latestCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const written = latestCall[2];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing' } })
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest' } })
    );
  });

  it('persists fetched surveys through optimistic survey cache writes', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'surveysCache' ? {} : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      title: 'Fetched survey',
      questionIDs: ['q1'],
      creator: '0xcreator',
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);

    const surveyData = await subject.getSurveyData('0xSurvey');

    expect(surveyData).toEqual(expect.objectContaining({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Fetched survey',
    }));
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'edge',
      expect.objectContaining({
        '84532': expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      })
    );
  });

  it('uses an explicit SurveyTool session prop for fetched survey reads and cache writes', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'surveysCache' ? {} : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    const getSurveySpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      title: 'Fetched survey',
      questionIDs: ['q1'],
      creator: '0xcreator',
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'rxc',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);

    const surveyData = await subject.getSurveyData('0xSurvey');

    expect(surveyData).toEqual(expect.objectContaining({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Fetched survey',
    }));
    expect(getSurveySpy).toHaveBeenCalledWith({}, '0xsurvey', 'rxc');
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'rxc',
      expect.objectContaining({
        '84532': expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      })
    );
  });

  it('does not read survey list/data from a borrowed general network when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                title: 'Borrowed Survey',
                questionIDs: ['q1'],
              },
            },
          },
        };
      }
      return null;
    });
    const getSurveyDataByIdSpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Borrowed Survey',
      questionIDs: ['q1'],
    });

    const subject = new SurveyTool({
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);
    subject.updateSelectedSurvey = jest.fn();
    subject.state = {
      ...subject.state,
      surveys: [{ id: 'stale-survey', title: 'Stale Survey', questionIDs: ['q1'] }],
      loading: false,
    };
    syncClassSetState(subject);
    readCacheSpy.mockClear();

    await subject.fetchSurveys();

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.surveys).toEqual([]);
    expect(subject.state.loading).toBe(false);
    expect(subject.updateSelectedSurvey).not.toHaveBeenCalled();

    readCacheSpy.mockClear();

    await expect(subject.getSurveyData('0xSurvey')).resolves.toBeNull();
    expect(subject.findSurveyInAllCaches).toHaveBeenCalledWith('0xsurvey');
    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
  });

  it('blocks submit click when submitted latch is active and no pending edits exist', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const uploadSpy = jest.fn();
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
    subject.state = {
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      modifiedCount: 0,
    };

    subject.handlePrimarySubmitClick();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(false);
  });

  it('canonicalizes reserved session aliases when reopening a submitted survey response', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    const buildSubject = (activeSessionSlug) => {
      const subject = new SurveyQuestions({
        singleQuestionMode: false,
        isStandalone: false,
        surveyIndex: 0,
        surveyId: '0xSurvey',
        account: '0xAbC',
        loginComplete: true,
        network: { id: 84532 },
        activeSessionSlug,
        sessionSlug: activeSessionSlug,
      });
      subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
      subject.state = {
        ...subject.state,
        isSubmitting: false,
        submittedSinceLastEdit: false,
        submissionComplete: true,
        modifiedCount: 0,
      };
      return subject;
    };

    try {
      window.history.replaceState({}, '', '/survey/0xsurvey');

      const debateSubject = buildSubject('DEBATE');
      debateSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc?session=DEBATE');

      const generalSubject = buildSubject('general');
      generalSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('flushes pending standalone draft to storage on unmount', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    expect(key).toBeTruthy();

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
      isDirty: true,
      modifiedCount: 1,
    };

    subject.persistDraftSafely(60);
    expect(subject._persistTimer).toBeTruthy();

    subject.componentWillUnmount();

    const raw = sessionStorage.getItem(key);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed?.answers?.q1?.value).toBe('carry');

    sessionStorage.clear();
  });

  it('keeps unresolved draft storage scoped to __pending__ instead of inheriting the general network key', () => {
    sessionStorage.clear();

    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      questionPool: [{ id: 'q1' }],
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');

    const pendingKey = 'dg:surveyDraft:missing-session-slug:__pending__:0xabc:questions';
    const legacyGeneralKey = 'dg:surveyDraft:missing-session-slug:84532:0xabc:questions';
    sessionStorage.setItem(pendingKey, JSON.stringify({
      meta: { networkId: null, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'pending-draft',
        },
      },
    }));
    sessionStorage.setItem(legacyGeneralKey, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 222 },
      answers: {
        q1: {
          value: 'wrong-general-draft',
        },
      },
    }));

    expect(subject.getDraftKey()).toBe(pendingKey);
    expect(subject.loadDraft()).toMatchObject({
      meta: { networkId: null, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'pending-draft',
        },
      },
    });

    sessionStorage.clear();
  });

  it('drops invalid persisted draft payloads during loadDraft', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      baseline: {
        q1: {
          value: 'invalid-without-answers',
        },
      },
    }));

    expect(subject.loadDraft()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();

    sessionStorage.clear();
  });

  it('applies draft tracking patches without clobbering omitted fields', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject._draftParseCache = { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } };
    subject._lastDraftKey = 'draft-key';
    subject._lastDraftJSON = '{"answers":{}}';
    subject._lastDraftSemanticSignature = 'sig:old';

    subject._applyDraftTrackingState({
      lastDraftJSON: null,
      lastDraftSemanticSignature: 'sig:new',
    });

    expect(subject._draftParseCache).toEqual({ key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } });
    expect(subject._lastDraftKey).toBe('draft-key');
    expect(subject._lastDraftJSON).toBeNull();
    expect(subject._lastDraftSemanticSignature).toBe('sig:new');
  });

  it('applies draft hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyDraftHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      draftEntry: {
        value: 'draft answer',
        answerEncrypted: true,
        answerEncryptionAudience: 'gate',
        additional: 'draft notes',
        additionalEncrypted: true,
        additionalAudienceMode: 'inherit',
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: false,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'draft answer',
      encrypted: true,
      encryptionAudience: 'self',
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'draft notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('applies response hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyResponseHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      response: {
        answer: {
          value: 'hydrated answer',
          encrypted: true,
        },
        additional: {
          value: 'hydrated notes',
          encrypted: true,
          audienceMode: 'inherit',
        },
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: true,
      parseValue: (value) => value,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'hydrated answer',
      encrypted: true,
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'hydrated notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('skips draft rewrites when only timestamp would change and writes again after semantic edits', () => {
    sessionStorage.clear();
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    subject.persistDraft();
    const firstRaw = sessionStorage.getItem(key);
    const firstTs = JSON.parse(firstRaw)?.meta?.ts;

    subject.persistDraft();
    const secondRaw = sessionStorage.getItem(key);
    const secondTs = JSON.parse(secondRaw)?.meta?.ts;

    expect(secondRaw).toBe(firstRaw);
    expect(secondTs).toBe(firstTs);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'carry-updated',
    };
    subject._draftDirtyQids.add('q1');
    subject.persistDraft();
    const thirdRaw = sessionStorage.getItem(key);
    const thirdTs = JSON.parse(thirdRaw)?.meta?.ts;

    expect(thirdRaw).not.toBe(firstRaw);
    expect(thirdTs).toBe(3000);
    expect(setSpy.mock.calls.filter((call) => call[0] === key)).toHaveLength(2);

    nowSpy.mockRestore();
    setSpy.mockRestore();
    sessionStorage.clear();
  });

  it('persists and rehydrates encrypted portions for decrypted empty fields', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'baseline-answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-base-1',
          },
        },
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'add-base-1',
          },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'anchor-answer',
              encrypted: false,
              encryptionAudience: 'self',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {
            q1: {
              value: '',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'add-env-1',
            },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();
    const key = subject.getDraftKey();
    const persisted = JSON.parse(sessionStorage.getItem(key) || '{}');

    expect(persisted?.answers?.q1?.answerEncryptedPortion).toBe('ans-env-1');
    expect(persisted?.answers?.q1?.additionalEncryptedPortion).toBe('add-env-1');
    expect(persisted?.baseline?.q1?.answerEncryptedPortion).toBe('ans-base-1');
    expect(persisted?.baseline?.q1?.additionalEncryptedPortion).toBe('add-base-1');
    expect(persisted?.baseline?.q1?.value).toBe('baseline-answer');

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        {
          answers: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    reloaded.rehydrateDraftForRenderedIds(true);

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.encryptedPortion).toBe('ans-env-1');
    expect(reloaded.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('add-env-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-1');
    expect(reloaded.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('add-base-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('baseline-answer');

    sessionStorage.clear();
  });

  it('rewrites draft payload when only baseline changes', () => {
    sessionStorage.clear();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'stable-answer', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: {
          q1: { value: 'baseline-v1', encrypted: true, encryptionAudience: 'gate', encryptedPortion: 'ans-base-1' },
        },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
    };

    const key = subject.getDraftKey();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    subject.persistDraft();
    const first = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(first?.answers?.q1?.value).toBe('stable-answer');
    expect(first?.baseline?.q1?.value).toBe('baseline-v1');

    subject.state.editBaseline.answers.q1 = {
      value: 'baseline-v2',
      encrypted: true,
      encryptionAudience: 'gate',
      encryptedPortion: 'ans-base-2',
    };

    subject.persistDraft();
    const second = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(second?.answers?.q1?.value).toBe('stable-answer');
    expect(second?.baseline?.q1?.value).toBe('baseline-v2');
    expect(second?.baseline?.q1?.answerEncryptedPortion).toBe('ans-base-2');
    expect(setSpy.mock.calls.filter((call) => call[0] === key)).toHaveLength(2);

    setSpy.mockRestore();
    sessionStorage.clear();
  });

  it('rehydrates baseline from draft even when no answer entry exists', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {},
      baseline: {
        q1: {
          value: 'baseline-only',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-only',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    }));

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.rehydrateDraftForRenderedIds(true);

    expect(subject.state.surveysResponseState?.[0]?.answers?.q1).toBeUndefined();
    expect(subject.state.editBaseline?.answers?.q1?.value).toBe('baseline-only');
    expect(subject.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-only');

    sessionStorage.clear();
  });

  it('keeps restored draft baseline aligned after masked prefill on refresh', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'real text',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-env-1',
          },
        },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'real text',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    reloaded.updateJsonPreview = jest.fn();
    reloaded.recalculateEditStats = jest.fn();

    reloaded.rehydrateDraftForRenderedIds(true);
    reloaded.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env-1' },
          additional: { value: '', encrypted: false, encryptedPortion: '' },
        },
      ],
    });

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-env-1');

    sessionStorage.clear();
  });

  it('keeps decrypted-empty answer aligned when masked response has encrypted=true without envelope', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const prevSlice = {
      answers: {
        q1: {
          value: '',
          encrypted: true,
          encryptedPortion: '',
          encryptionAudience: 'gate',
        },
      },
      additionalComments: {},
      importance: {},
      conviction: {},
    };

    const userAnswers = {
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: '' },
          additional: { value: '*', encrypted: true, encryptedPortion: '' },
        },
      ],
    };

    const nextSlice = subject.buildSliceFromUserAnswers(userAnswers, prevSlice);

    expect(nextSlice.answers.q1.value).toBe('');
    expect(nextSlice.additionalComments.q1.value).toBe('*');
  });

  it('prefills single-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [],
      editBaseline: null,
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSingleQuestionResponse({
      questionID: 'q1',
      answer: { value: 'hydrated answer' },
      additional: { value: 'hydrated notes' },
    });

    expect(subject.state.surveysResponseState).toHaveLength(1);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: {},
      conviction: {},
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('prefills multi-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      targetSlice.importance.q1 = responses[0].importance;
      targetSlice.conviction.q1 = responses[0].conviction;
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'hydrated answer' },
          additional: { value: 'hydrated notes' },
          importance: 4,
          conviction: 7,
        },
      ],
    });

    expect(subject.state.surveysResponseState).toHaveLength(2);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { keep: { value: 'persisted' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(subject.state.surveysResponseState[1]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('merges survey response state into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.buildEmptyResponseFieldState = jest.fn((qid, fieldKey = 'answer') => ({
      value: '',
      qid,
      fieldKey,
    }));

    expect(subject.mergeSurveyResponseState([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    ], [{ id: 'q1' }], 2)).toEqual([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: '', qid: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', qid: 'q1', fieldKey: 'additional' } },
      },
    ]);
  });

  it('does not resurrect cleared draft answers from stale cache', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      editBaseline: {
        answers: {
          q1: { value: 'keep-baseline', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'keep', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const seedPayload = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'keep',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-me',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
      baseline: {
        q1: {
          value: 'keep-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };
    const seedRaw = JSON.stringify(seedPayload);
    sessionStorage.setItem(key, seedRaw);
    subject._lastDraftKey = key;
    subject._lastDraftJSON = seedRaw;
    subject._lastDraftSemanticSignature = buildSurveyDraftSemanticSignature(seedPayload);
    subject._draftParseCache = { key, raw: seedRaw, parsed: seedPayload };

    subject.clearDraftFor('q2');
    const afterClear = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterClear?.answers?.q2).toBeUndefined();
    expect(afterClear?.baseline?.q2).toBeUndefined();

    subject.persistDraft();
    const afterPersist = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterPersist?.answers?.q2).toBeUndefined();
    expect(afterPersist?.baseline?.q2).toBeUndefined();
    expect(afterPersist?.answers?.q1?.value).toBe('keep');
    expect(afterPersist?.baseline?.q1?.value).toBe('keep-baseline');

    sessionStorage.clear();
  });

  it('builds locked-question gate details with SBT links', () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q1',
          prompt: '[encrypted]',
          promptDecrypted: false,
          sessionSlug: 'alpha',
          encryption: {
            enabled: true,
            gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveSbtGateLabel = () => 'VIP SBT';

    const details = subject.buildLockedQuestionGateDetails(['q1']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('VIP Gate');
    expect(details[0].sbts[0]).toMatchObject({
      address: gateSbt,
      label: 'VIP SBT',
      href: buildSbtDetailPath(gateSbt, 'alpha'),
    });
  });

  it('prefers configured gate labels in locked-question details', () => {
    const gateSbt = '0x3333333333333333333333333333333333333333';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q2',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [{
              gateId: 'vip_access',
              label: 'default gate',
              resourceKey: 'questionResponses',
              sbtAddress: gateSbt,
            }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveConfiguredGateLabel = () => 'Configured VIP Gate';
    subject.resolveSbtGateLabel = () => 'VIP SBT';

    const details = subject.buildLockedQuestionGateDetails(['q2']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('Configured VIP Gate');
  });

  it('prefers allQuestionsForFilter when it has richer locked-question gate metadata', () => {
    const gateSbt = '0x5555555555555555555555555555555555555555';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q-rich',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [],
          },
        },
      ],
      allQuestionsForFilter: [
        {
          id: 'q-rich',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [{ label: 'Registry questionResponses gate', sbtAddress: gateSbt }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveSbtGateLabel = () => 'Filter Gate SBT';

    const details = subject.buildLockedQuestionGateDetails(['q-rich']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('Registry questionResponses gate');
    expect(details[0].sbts[0]).toMatchObject({
      address: gateSbt,
      label: 'Filter Gate SBT',
    });
  });

  it('uses neutral gated prompt copy for manual prompt decrypt buttons', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderPromptWithManualDecrypt({
      id: 'q1',
      prompt: '[encrypted]',
    });
    const button = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_DECRYPT_PROMPT
    );

    expect(button).toBeTruthy();
    expect(button.props.title).toBe('Decrypt gated prompt');
  });

  it('does not render inline single-question tags in the prompt title block', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderPromptWithManualDecrypt({
      id: 'q1',
      prompt: 'Question prompt',
      tags: ['Governance', 'AI Policy'],
    });
    const promptTitleBlock = findNodeByClassName(tree, styles.promptTitleBlock);

    expect(promptTitleBlock).toBeTruthy();
    expect(getElementChildren(promptTitleBlock)).toHaveLength(1);
    expect(treeHasText(promptTitleBlock, '#Governance')).toBe(false);
    expect(treeHasText(promptTitleBlock, '#AI Policy')).toBe(false);
  });

  it('keeps full-question tag dropdown scoped to the survey session on unpinned survey routes', () => {
    const previousUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', `/survey/0x${'1'.repeat(64)}`);

    try {
      const subject = new SurveyQuestions({
        singleQuestionMode: false,
        isStandalone: false,
        surveyID: `0x${'1'.repeat(64)}`,
        surveyIndex: 0,
        account: '0xabc',
        loginComplete: true,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        sessionSlug: 'edge',
        sessionSlugPinned: false,
      });

      const dropdown = subject.renderQuestionTagDropdown({
        id: 'q1',
        prompt: 'Question prompt',
        tags: ['Governance'],
      });

      expect(dropdown).toBeTruthy();
      expect(dropdown.props.sessionSlug).toBe('edge');
    } finally {
      window.history.replaceState({}, '', previousUrl || '/');
    }
  });

  it('wires SurveyQuestionTagControl into full question cards when tags are present', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptionNonce: 0,
      isLoadingResponse: false,
      bookmarkedQuestions: new Set(),
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
      showComments: {},
      sliderToggleExpandedByQuestion: {},
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };
    subject.handleBookmarkToggle = jest.fn();
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderQuestion(
      {
        id: 'q1',
        type: 'freeform',
        prompt: 'Question prompt',
        tags: ['governance'],
      },
      0,
      subject.state.surveysResponseState[0]
    );
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(dropdown).toBeTruthy();
    expect(dropdown.props.tags).toEqual(['governance']);
    expect(dropdown.props.useTagModal).toBe(true);
    expect(typeof dropdown.props.onTagSelect).toBe('function');
  });

  it('applies the row layout style when rendering full-question tag dropdown rows', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject._getEffectiveDraftSlug = () => 'edge';

    const dropdown = subject.renderQuestionTagDropdownRow({
      id: 'q1',
      prompt: 'Question prompt',
      tags: ['governance'],
    });

    expect(dropdown).toBeTruthy();
    expect(dropdown.props.rowStyle).toBeTruthy();
    expect(dropdown.props.rowStyle.display).toBe('flex');
  });

  it('keeps gated notice and tag controls on masked full-question cards', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptionNonce: 0,
      isLoadingResponse: false,
      bookmarkedQuestions: new Set(),
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
      showComments: {},
      sliderToggleExpandedByQuestion: {},
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };
    subject.handleBookmarkToggle = jest.fn();
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.resolveGatedPromptGateNames = jest.fn(() => ['Gate A']);

    const tree = subject.renderQuestion(
      {
        id: 'q1',
        type: 'freeform',
        prompt: '[encrypted]',
        promptDecrypted: false,
        tags: ['governance'],
      },
      0,
      subject.state.surveysResponseState[0]
    );
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );
    const gatedNotice = findElement(
      tree,
      (node) => node?.type === GatedPromptNotice
    );

    expect(gatedNotice).toBeTruthy();
    expect(gatedNotice.props.tooltipText).toBe(`Required ${t('sbt')} ${t('gate')}: Gate A`);
    expect(dropdown).toBeTruthy();
    expect(dropdown.props.tags).toEqual(['governance']);
  });

  it('renders gated notice and omits tag controls on masked pile cards', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      showComments: {},
      showConviction: {},
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
    };
    subject.resolveGatedPromptGateNames = jest.fn(() => ['Gate A']);

    const tree = subject.renderActiveQuestion({
      id: 'q1',
      type: 'freeform',
      prompt: '[encrypted]',
      promptDecrypted: false,
      tags: ['governance'],
    });
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );
    const gatedNotice = findElement(
      tree,
      (node) => node?.type === GatedPromptNotice
    );

    expect(gatedNotice).toBeTruthy();
    expect(gatedNotice.props.tooltipText).toBe(`Required ${t('sbt')} ${t('gate')}: Gate A`);
    expect(dropdown).toBeNull();
  });

  it('opens the shared tag modal from full-question tag dropdown selections', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Question prompt',
        tags: ['governance'],
      }],
      decryptionNonce: 0,
      isLoadingResponse: false,
      bookmarkedQuestions: new Set(),
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
      showComments: {},
      sliderToggleExpandedByQuestion: {},
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      activeTagModalTag: '',
    };
    subject.handleBookmarkToggle = jest.fn();
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (updates) => {
      const nextState = typeof updates === 'function'
        ? updates(subject.state, subject.props)
        : updates;
      subject.state = { ...subject.state, ...nextState };
    };

    const dropdown = subject.renderQuestionTagDropdown({
      id: 'q1',
      prompt: 'Question prompt',
      tags: ['governance'],
    });

    dropdown.props.onTagSelect('governance');

    const tree = subject.render();
    const modal = findElement(
      tree,
      (node) => node?.type === TagModal
    );

    expect(subject.state.activeTagModalTag).toBe('governance');
    expect(modal).toBeTruthy();
    expect(modal.props.isOpen).toBe(true);
    expect(modal.props.activeTag).toBe('governance');
  });

  it('omits SurveyQuestionTagControl from pile cards even when tags are present', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      showComments: {},
      showConviction: {},
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
    };
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);

    const question = {
      id: 'q1',
      type: 'freeform',
      prompt: 'Question prompt',
      tags: ['governance'],
    };
    subject.state = {
      ...subject.state,
      allQuestionsForFilter: [question],
      pileQuestions: [question],
      activePileIndex: 0,
      filterModalOpen: false,
      loading: false,
      showHologramAssistant: false,
    };

    const tree = subject.render();
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(dropdown).toBeNull();
  });

  it('retries gate label hydration for same signature after a transient miss', async () => {
    const gateSbt = '0x4444444444444444444444444444444444444444';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      gateSbtNameRevision: 0,
    };
    subject.collectGateSbtAddressesForHydration = () => [gateSbt];
    subject.resolveEffectiveResponseGateConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
    };
    subject.scheduleGateSbtHydrationRetry = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ address: gateSbt, name: 'Recovered Name', info: { name: 'Recovered Name' } }]);

    await subject.hydrateGateSbtLabels();
    expect(subject.scheduleGateSbtHydrationRetry).toHaveBeenCalledTimes(1);
    expect(subject._gateSbtHydrationSig).toBe('');

    await subject.hydrateGateSbtLabels();
    expect(warmSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.gateSbtNameRevision).toBe(1);

    warmSpy.mockRestore();
  });

  it('does not retry gate label hydration when targeted lookup policy is disabled', async () => {
    const previousPolicy = globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP;
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = false;
    const gateSbt = '0x7777777777777777777777777777777777777777';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      gateSbtNameRevision: 0,
    };
    subject.collectGateSbtAddressesForHydration = () => [gateSbt];
    subject.resolveEffectiveResponseGateConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
    };
    subject.scheduleGateSbtHydrationRetry = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([]);

    try {
      await subject.hydrateGateSbtLabels();
      expect(subject.scheduleGateSbtHydrationRetry).not.toHaveBeenCalled();
      expect(subject._gateSbtHydrationSig).not.toBe('');

      await subject.hydrateGateSbtLabels();
      expect(warmSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = previousPolicy;
      warmSpy.mockRestore();
    }
  });

  it('memoizes rendered question ids until question sources change', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }, { id: 'q2' }],
      pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
    };

    const first = subject.getCurrentRenderedQuestionIds();
    const second = subject.getCurrentRenderedQuestionIds();
    expect(second).toBe(first);
    expect(second).toEqual(['q1', 'q2', 'q3']);

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }, { id: 'q2' }, { id: 'q4' }],
    };
    const third = subject.getCurrentRenderedQuestionIds();
    expect(third).not.toBe(second);
    expect(third).toEqual(['q1', 'q2', 'q4', 'q3']);
  });

  it('invalidates local-cache rehydrate memo before post-backfill rehydrate', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      submissionComplete: false,
      isSubmitting: false,
    };
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.props = {
      ...subject.props,
      account: '0xabc',
      loginComplete: true,
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      refreshQuestionResponses: jest.fn().mockResolvedValue(undefined),
    };
    subject.getMissingRenderedResponseIdsForAccount = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject._localCacheSliceMemo = { key: 'stale', value: null, hasValue: true };
    subject._rehydrateLocalCacheLastSig = 'stale|sig';

    await subject.ensurePriorResponsesForRenderedIds();

    expect(subject.props.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(subject._localCacheSliceMemo).toEqual({ key: '', value: null, hasValue: false });
    expect(subject._rehydrateLocalCacheLastSig).toBe('');
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('does not skip targeted prior-response backfill while pile mode is active', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      minifiedMode: 'pile',
    });

    subject.state = {
      ...subject.state,
      submissionComplete: false,
      isSubmitting: false,
    };
    subject.props = {
      ...subject.props,
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      refreshQuestionResponses: jest.fn().mockResolvedValue(undefined),
    };
    subject.getMissingRenderedResponseIdsForAccount = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();

    const fetched = await subject.ensurePriorResponsesForRenderedIds();

    expect(fetched).toBe(true);
    expect(subject.getMissingRenderedResponseIdsForAccount).toHaveBeenCalled();
    expect(subject.props.refreshQuestionResponses).toHaveBeenCalled();
  });

  it('groups pile prior-response backfill by question session slug under list scope', async () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {},
        },
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      minifiedMode: 'pile',
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      submissionComplete: false,
      isSubmitting: false,
      pileQuestions: [
        { id: 'q1', sessionSlug: 'alpha', type: 'freeform', prompt: 'Alpha prompt' },
        { id: 'q2', sessionSlug: 'beta', type: 'freeform', prompt: 'Beta prompt' },
      ],
    };
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.props = {
      ...subject.props,
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      refreshQuestionResponses: jest.fn().mockResolvedValue(undefined),
    };
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject._localCacheSliceMemo = { key: 'stale', value: null, hasValue: true };
    subject._rehydrateLocalCacheLastSig = 'stale|sig';

    const fetched = await subject.ensurePriorResponsesForRenderedIds();

    expect(fetched).toBe(true);
    expect(subject.props.refreshQuestionResponses).toHaveBeenNthCalledWith(1, ['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(subject.props.refreshQuestionResponses).toHaveBeenNthCalledWith(2, ['q2'], {
      slug: 'beta',
      responder: '0xabc',
    });
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate local-cache responses for unresolved draft slugs without a resolved network id', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'wrong-cache-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    peekSpy.mockClear();

    expect(subject.buildSliceFromLocalCache()).toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('builds local-cache slices through the shared cache hydration helper', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache' || slug !== 'edge') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': {
                answer: {
                  value: 'plaintext answer should stay masked',
                  encrypted: true,
                  encryptionAudience: 'gate',
                  encryptedPortion: 'ans-env',
                },
                additional: {
                  value: 'plaintext additional should stay masked',
                  encrypted: true,
                  encryptionAudience: 'gate',
                  audienceMode: 'inherit',
                  encryptedPortion: 'add-env',
                },
                importance: 4,
                conviction: 7,
              },
            },
          },
        },
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      questionsCacheNonce: 1,
      questionResponsesNonce: 1,
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.normalizeResponseEncryptionAudience = jest.fn((audience) => audience || 'self');
    subject.resolveFieldEncryptionGateId = jest.fn((_field, qid, fieldKey) => `${qid}:${fieldKey}`);
    subject.normalizeFieldAudienceMode = jest.fn((mode) => mode || 'explicit');
    subject.buildInheritedAdditionalFieldState = jest.fn((additionalState, answerState) => ({
      ...additionalState,
      encryptionGateId: answerState?.encryptionGateId || null,
      inheritedFromAnswer: answerState?.encryptedPortion || null,
    }));

    const slice = subject.buildSliceFromLocalCache();

    expect(slice).toEqual({
      answers: {
        q1: {
          value: '*',
          encrypted: true,
          encryptionAudience: 'gate',
          encryptionGateId: 'q1:answer',
          audienceMode: 'explicit',
          hash: '',
          encryptedPortion: 'ans-env',
        },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptionAudience: 'gate',
          encryptionGateId: 'q1:answer',
          audienceMode: 'inherit',
          hash: '',
          encryptedPortion: 'add-env',
          inheritedFromAnswer: 'ans-env',
        },
      },
    });
  });

  it('does not block retry when local-cache slice is missing', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };

    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('stable|sig');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue(null);
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject._rehydrateLocalCacheLastSig = '';

    await subject.rehydrateLocalCacheAnswersForRenderedIds();
    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.ensurePriorResponsesForRenderedIds).toHaveBeenCalledTimes(2);
    expect(subject._rehydrateLocalCacheLastSig).toBe('');
  });

  it('does not remask decrypted empty additional comments during local-cache rehydrate', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'enc-1',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
  });

  it('replaces masked additional value with draft decrypted-empty value when envelope matches', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.loadDraft = jest.fn().mockReturnValue({
      answers: {
        q1: {
          value: 'anchor-answer',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          answerEncryptedPortion: 'ans-1',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          additionalEncryptedPortion: 'enc-1',
          importance: null,
          conviction: null,
        },
      },
    });
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|masked');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'enc-1',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
  });

  it('replaces masked additional value when both draft/cache envelopes are missing but encrypted is true', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.loadDraft = jest.fn().mockReturnValue({
      answers: {
        q1: {
          value: 'anchor-answer',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          answerEncryptedPortion: 'ans-1',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          additionalEncryptedPortion: '',
          importance: null,
          conviction: null,
        },
      },
    });
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|masked-empty-env');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: '',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('');
  });

  it('rehydrates local-cache answers when draft loading throws', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    };
    subject.loadDraft = jest.fn(() => {
      throw new Error('draft-load-failed');
    });
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|draft-throw');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {
        q1: {
          value: 'cached answer',
          encrypted: false,
        },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          value: 'cached notes',
          encrypted: false,
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.loadDraft).toHaveBeenCalledTimes(1);
    expect(subject.state.surveysResponseState?.[0]).toEqual({
      answers: {
        q1: {
          value: 'cached answer',
          encrypted: false,
        },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          value: 'cached notes',
          encrypted: false,
        },
      },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: {
        q1: {
          value: 'cached answer',
          encrypted: false,
        },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          value: 'cached notes',
          encrypted: false,
        },
      },
    });
    expect(subject.ensurePriorResponsesForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('skips setState for local-cache rehydrate when cache data matches current and baseline state', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const matchingSlice = {
      answers: {
        q1: {
          value: 'cached answer',
          encrypted: false,
        },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          value: 'cached notes',
          encrypted: false,
        },
      },
    };

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [matchingSlice],
      editBaseline: JSON.parse(JSON.stringify(matchingSlice)),
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|unchanged');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(matchingSlice)));
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = jest.fn();
    const callback = jest.fn();

    await subject.rehydrateLocalCacheAnswersForRenderedIds(callback);

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.ensurePriorResponsesForRenderedIds).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(subject._rehydrateLocalCacheLastSig).toBe('rehydrate|q1|unchanged');
  });

  it('uses clone-free questions cache reads in SurveyQuestions.handleFilter', () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questionResponses: {
              q1: {
                '0xaa': '{"type":"binary","answer":{"value":"yes"}}',
              },
            },
          },
        };
      }
      return {};
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: [],
      pileQuestions: [],
      activePileIndex: 0,
      filterState: {},
      hasHiddenGatedQuestions: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleFilter([{ id: 'q1', type: 'binary', prompt: 'Q1' }], {});

    const questionCacheCalls = peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache');
    expect(questionCacheCalls.length).toBeGreaterThan(0);
    expect(questionCacheCalls.some((args) => args[2]?.clone === false)).toBe(true);
  });

  it('avoids redundant pile wrapper state updates when answering', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.handleAnswer = jest.fn();
    subject.setState = jest.fn();

    subject.handleAnswerPile('q1', 'value');

    expect(subject.handleAnswer).toHaveBeenCalledWith(0, 'q1', 'value', {});
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('passes cache-backed question responses into pile filters so responded status works in embedded pile mode', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': { answer: { value: 'yes' } },
            },
          },
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      questionResponsesNonce: 2,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleQuestions = [
      { id: 'q1', type: 'binary', prompt: 'Q1' },
      { id: 'q2', type: 'binary', prompt: 'Q2' },
    ];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleQuestions,
      pileQuestions: visibleQuestions,
      activePileIndex: 0,
      filterModalOpen: true,
      loading: false,
      showHologramAssistant: false,
    };

    const tree = subject.render();
    const questionFilterNode = findElement(
      tree,
      (node) =>
        node?.props?.onFilter === subject.handleFilter &&
        node?.props?.currentViewModeForUrl === 'questions'
    );

    expect(questionFilterNode).toBeTruthy();
    expect(questionFilterNode.props.questionResponses).toEqual({
      q1: {
        '0xabc': { answer: { value: 'yes' } },
      },
    });

    const filterSubject = new RawQuestionFilter({
      ...questionFilterNode.props,
      account: '0xabc',
    });
    filterSubject.state = {
      ...filterSubject.state,
      filterByResponded: true,
      filterByNotResponded: false,
    };

    const filtered = filterSubject.getQuestionsSubsetBeforeAi();

    expect(filtered.map((question) => question.id)).toEqual(['q1']);
  });

  it('does not borrow general response or filter config in pile filters when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      BLOCKED_QUESTION_IDS: ['q-blocked'],
      HIGHLIGHTED_QUESTION_IDS: ['q1'],
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': { answer: { value: 'yes' } },
            },
          },
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '0xabc',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      questionResponsesNonce: 2,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleQuestions = [
      { id: 'q2', type: 'binary', prompt: 'Q2' },
      { id: 'q1', type: 'binary', prompt: 'Q1' },
      { id: 'q_blocked', type: 'binary', prompt: 'Blocked Q' },
    ];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleQuestions,
      pileQuestions: visibleQuestions,
      activePileIndex: 0,
      filterModalOpen: true,
      loading: false,
      showHologramAssistant: false,
      filterState: {},
      hasHiddenGatedQuestions: false,
    };
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    syncClassSetState(subject);
    peekSpy.mockClear();

    const tree = subject.render();
    const questionFilterNode = findElement(
      tree,
      (node) =>
        node?.props?.onFilter === subject.handleFilter &&
        node?.props?.currentViewModeForUrl === 'questions'
    );

    expect(questionFilterNode).toBeTruthy();
    expect(questionFilterNode.props.questionResponses).toEqual({});
    expect(peekSpy).not.toHaveBeenCalled();

    subject.handleFilter(visibleQuestions, {});

    expect(subject.state.pileQuestions.map((question) => question.id)).toEqual(['q2', 'q1', 'q_blocked']);
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('clamps pile rating answers into the supported slider range and guards non-numeric values', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'rating', prompt: 'Rate this' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Rate this');
    subject.state = {
      ...subject.state,
      showComments: {},
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '7', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    let tree = subject.renderActiveQuestion(question);
    let slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(7);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(typeof slider.props.onChangeComplete).toBe('function');
    expect(treeHasText(tree, '7')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: '14', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(10);
    expect(treeHasText(tree, '10')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: 'abc', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(0);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(treeHasText(tree, '0')).toBe(true);
  });

  it('renders pile additional comments without the extra header and keeps the lock beside the field', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);
    const inlineRow = findFirstNodeByType(tree, AdditionalCommentsInlineRow);

    expect(inlineRow).not.toBeNull();
    expect(findNodeByClassName(tree, styles.additionalCommentsHeader)).toBeNull();
    expect(treeHasText(tree, 'Additional comments')).toBe(false);
    expect(inlineRow.props.input.type).toBe(SurveyAudioFieldInput);
    expect(inlineRow.props.input.props.placeholder).toBe('Additional comments...');
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsInputWrap);
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsLockSlot);
    expect(treeHasDataTestId(inlineRow.props.lockControl, E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK)).toBe(true);
  });

  it('renders pile question icons through the shared footer helper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.toggleComments = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const tree = subject.renderPileQuestionIcons({
      questionId: 'q1',
      answer: { value: '', encrypted: false },
      glowAnswer: false,
      maskedAnswer: false,
      hasAdditionalContent: true,
    });
    const commentsButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE
    );

    expect(commentsButton).not.toBeNull();
    commentsButton.props.onClick();
    expect(subject.toggleComments).toHaveBeenCalledWith('q1');
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_ANSWER_LOCK)).toBe(true);
  });

  it('renders full-question footer icons through the shared footer helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.toggleComments = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderFullQuestionFooterIcons({
      surveyIndex: 0,
      question: {
        id: 'q1',
        prompt: 'Question prompt',
        tags: ['governance'],
      },
      answer: { value: '', encrypted: false },
      glowAnswer: false,
      maskedAnswer: false,
      hasAdditionalContent: true,
      commentsOpen: false,
      onToggleComments: () => subject.toggleComments('q1', true),
    });
    const footer = findFirstNodeByType(tree, FullQuestionFooterIcons);
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(footer).not.toBeNull();
    expect(typeof footer.props.onToggleComments).toBe('function');
    footer.props.onToggleComments();
    expect(subject.toggleComments).toHaveBeenCalledWith('q1', true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_ANSWER_LOCK)).toBe(true);
    expect(dropdown).toBeTruthy();
    expect(dropdown.props.tags).toEqual(['governance']);
  });

  it('renders full-question card links through the shared header helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.handleBookmarkToggle = jest.fn();
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderFullQuestionCardIcons({
      question: {
        id: 'q1',
        arweaveTxId: 'https://arweave.net/example',
      },
      showResponseLookupSpinner: true,
      isQuestionBookmarked: true,
    });
    const links = findFirstNodeByType(tree, QuestionCardLinks);

    expect(links).not.toBeNull();
    expect(links.props.showResponseLookupSpinner).toBe(true);
    expect(links.props.isQuestionBookmarked).toBe(true);
    expect(links.props.arweaveHref).toContain('arweave.net');
    expect(links.props.questionHref).toContain('/question/q1');
    links.props.onBookmarkToggle();
    expect(subject.handleBookmarkToggle).toHaveBeenCalledWith('q1');
  });

  it('renders pile freeform answers with the shared audio field input wrapper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.state = {
      ...subject.state,
      showComments: {},
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: 'hello', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);
    const audioInput = findFirstNodeByType(tree, SurveyAudioFieldInput);

    expect(audioInput).not.toBeNull();
    expect(audioInput.props.placeholder).toBe('Your response...');
    expect(audioInput.props.disableEncryption).toBe(true);
    expect(audioInput.props.enableDownloads).toBe(false);
  });

  it('routes pile encrypted answer and comments through the shared decrypt control wrapper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
          additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);

    expect(countElements(tree, (node) => node?.type === QuestionDecryptControl)).toBe(2);
    expect(findFirstNodeByType(tree, AdditionalCommentsInlineRow)).toBeNull();
  });

  it('does not call getPendingEditStats during PileViewMode.render', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.getPendingEditStats = jest.fn(() => ({ total: 7, encrypted: 2 }));
    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      filterState: {},
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      submittedSinceLastEdit: false,
      submissionComplete: false,
    };

    subject.render();

    expect(subject.getPendingEditStats).not.toHaveBeenCalled();
  });

  it('keeps the pile action container neutral while only the filter button gets the active class', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
      onViewAllClick: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.renderActiveQuestion = jest.fn(() => null);
    subject.isMaskedPromptText = jest.fn(() => false);
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: true,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();
    const actionsNode = findNodeByClassName(tree, 'pileActions');
    const filterButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_FILTER_TOGGLE);
    const createButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE);
    const viewAllButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_VIEW_ALL);

    expect(actionsNode).not.toBeNull();
    expect(nodeHasClassName(actionsNode, 'pileActionsActive')).toBe(false);
    expect(filterButton).not.toBeNull();
    expect(nodeHasClassName(filterButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(filterButton, 'actionButtonActive')).toBe(true);
    expect(filterButton.props.style).toEqual(expect.objectContaining({
      color: '#4cd964',
      borderColor: '#4cd964',
      opacity: 0.75,
    }));
    expect(createButton).not.toBeNull();
    expect(nodeHasClassName(createButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(createButton, 'actionButtonActive')).toBe(false);
    expect(viewAllButton).not.toBeNull();
    expect(nodeHasClassName(viewAllButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(viewAllButton, 'actionButtonActive')).toBe(false);
  });

  it('renders the pile mini spinner as a sibling of the controls stack during background refresh', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
      onViewAllClick: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.renderActiveQuestion = jest.fn(() => null);
    subject.isMaskedPromptText = jest.fn(() => false);
    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const interactionNode = findNodeByClassName(tree, 'pileInteractionUnit');
    const controlsNode = findNodeByClassName(tree, 'pileControls');
    const actionsNode = findNodeByClassName(controlsNode?.props?.children, 'pileActions');
    const navNode = findNodeByClassName(controlsNode?.props?.children, 'pileNav');
    const spinnerNode = findNodeByClassName(tree, 'miniSpinnerWrapper');
    const interactionChildClasses = getElementChildren(interactionNode).map((child) => child?.props?.className);
    const controlsChildClasses = getElementChildren(controlsNode).map((child) => child?.props?.className);

    expect(interactionNode).not.toBeNull();
    expect(controlsNode).not.toBeNull();
    expect(actionsNode).not.toBeNull();
    expect(navNode).not.toBeNull();
    expect(spinnerNode).not.toBeNull();
    expect(interactionChildClasses).toEqual(expect.arrayContaining([
      'miniSpinnerWrapper',
      'pileCardContainer',
      'pileControls',
    ]));
    expect(controlsChildClasses).toHaveLength(3);
    expect(nodeHasClassName(getElementChildren(controlsNode)[0], 'pileActions')).toBe(true);
    expect(nodeHasClassName(getElementChildren(controlsNode)[1], 'pileFooter')).toBe(true);
    expect(nodeHasClassName(getElementChildren(controlsNode)[2], 'pileNav')).toBe(true);
    expect(findNodeByClassName(controlsNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
    expect(findNodeByClassName(actionsNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
    expect(findNodeByClassName(navNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
  });

  it('passes the delayed pile-entry mode toggle prop into the pile create panel', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: true,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();
    const createSurveyNode = findElement(
      tree,
      (node) => node?.props?.hideSurveyQuestionToggleUntilAuthoring === true
    );

    expect(createSurveyNode).not.toBeNull();
  });

  it('keeps masked visibility memo hot when alternating stable pool references', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const poolA = [{ id: 'qa', prompt: 'A', promptDecrypted: false }];
    const poolB = [{ id: 'qb', prompt: 'B', promptDecrypted: false }];
    subject.isMaskedPromptText = jest.fn(() => false);

    const firstA = subject.getMemoizedMaskedQuestionVisibility(poolA, false);
    const firstB = subject.getMemoizedMaskedQuestionVisibility(poolB, false);
    const secondA = subject.getMemoizedMaskedQuestionVisibility(poolA, false);

    expect(firstA).toBe(secondA);
    expect(firstB).not.toBe(firstA);
    expect(subject.isMaskedPromptText).toHaveBeenCalledTimes(2);
  });

  it('reuses current pile signature path on repeated identical filters', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questionResponses: {},
          },
        };
      }
      return {};
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleList,
      pileQuestions: visibleList,
      activePileIndex: 0,
      filterState: {},
      hasHiddenGatedQuestions: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.syncCurrentPileQuestionsSignature(visibleList);
    const signatureSpy = jest.spyOn(subject, 'buildQuestionListSignature');
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleFilter(visibleList, {});
    subject.handleFilter(visibleList, {});

    expect(subject.setState).not.toHaveBeenCalled();
    expect(signatureSpy).toHaveBeenCalledTimes(2);
  });

  it('does not replay pile hydration on nonce-only ticks when question signatures are unchanged', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);

    subject.props = {
      ...subject.props,
      questionResponsesNonce: subject.props.questionResponsesNonce + 1,
      questionsCacheNonce: subject.props.questionsCacheNonce + 1,
    };
    await subject.loadAndSortQuestions();

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('keeps pile loading active during early empty-cache settle before showing a definitive empty state', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalled();

    subject._emptyReadyProbeStartedAtMs = Date.now() - 25000;
    subject.scheduleLoadAndSortQuestions.mockClear();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();
  });

  it('keeps unanswered questions visible in pile mode when response map is empty', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Unanswered prompt' },
        },
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(Array.isArray(subject.state.pileQuestions)).toBe(true);
    expect(subject.state.pileQuestions.map((q) => String(q.id))).toEqual(['q1']);
    expect(subject.state.allQuestionsForFilter.map((q) => String(q.id))).toEqual(['q1']);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);
  });

  it('settles stuck hydrate 0/0 empty piles into deterministic no-questions state', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 0,
        hydratedQuestions: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions available.')).toBe(true);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(false);
  });

  it('settles scan 0/0 empty piles into deterministic no-questions state for newly created sessions', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 0,
        requestedTotalBlocks: 0,
        scannedBlocks: 0,
        remainingBlocks: 0,
        discoveredQuestions: 0,
        hydratedQuestions: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions available.')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('shows a filtered empty state instead of full loading when filters remove all visible pile cards', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 50000,
        scannedBlocks: 12500,
        remainingBlocks: 37500,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [
        { id: 'q1', prompt: 'Q1', type: 'binary' },
      ],
      activePileIndex: 0,
      filterState: { questionTypes: ['freeform'] },
      isFilterActive: true,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      loadingElapsedSec: 9,
    };

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions match current filters.')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('keeps pile loading when pending question metadata retries exist after hydrate appears settled', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        pendingQuestionMetadata: {
          q_pending: {
            attempts: 2,
            nextRetryAtMs: Date.now() + 60_000,
          },
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 1,
        pendingMetadataCount: 1,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    const tree = subject.render();
    expect(treeHasText(tree, 'Loading...')).toBe(true);
  });

  it('renders terminal scan errors in pile mode instead of continuing full loading', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionScanProgress: {
        slug: 'edge',
        phase: 'error',
        errorCode: 'session_not_found',
        errorMessage: 'No session found for "general".',
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();
    expect(treeHasText(tree, 'No session found for "general".')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('replays pile hydration when the rendered question response snapshot changes', async () => {
    const cacheState = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => cacheState);

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);

    cacheState['84532'].questionResponses.q1['0xabc'] = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: 'note', encrypted: false },
      importance: 5,
      conviction: 7,
    };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: subject.props.questionResponsesNonce + 1,
      questionsCacheNonce: subject.props.questionsCacheNonce + 1,
    };
    await subject.loadAndSortQuestions();

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(2);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(2);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(2);
  });

  it('does not replay pile hydration when nonce ticks only touch off-screen responses', async () => {
    const cacheState = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => cacheState);

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);

    cacheState['84532'].questionResponses.q2 = {
      '0xabc': {
        answer: { value: 'Off-screen', encrypted: false },
        additional: { value: '', encrypted: false },
      },
    };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: subject.props.questionResponsesNonce + 1,
      questionsCacheNonce: subject.props.questionsCacheNonce + 1,
    };
    await subject.loadAndSortQuestions();

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('rehydrates newly visible pile window answers when active index changes without nonce ticks', async () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Q1' },
        { id: 'q2', type: 'freeform', prompt: 'Q2' },
        { id: 'q3', type: 'freeform', prompt: 'Q3' },
        { id: 'q4', type: 'freeform', prompt: 'Q4' },
        { id: 'q5', type: 'freeform', prompt: 'Q5' },
        { id: 'q6', type: 'freeform', prompt: 'Q6' },
      ],
      activePileIndex: 0,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    };
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {
        q6: { value: 'Hydrated q6', encrypted: false },
      },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.rehydrateLocalCacheAnswersForRenderedIds();
    expect(subject.buildSliceFromLocalCache).toHaveBeenCalledTimes(1);
    expect(subject.state.surveysResponseState?.[0]?.answers?.q6).toBeUndefined();

    subject.state = { ...subject.state, activePileIndex: 5 };
    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.buildSliceFromLocalCache).toHaveBeenCalledTimes(2);
    expect(subject.state.surveysResponseState?.[0]?.answers?.q6?.value).toBe('Hydrated q6');
  });

  it('schedules pile reload when scoped hydration progress advances without nonce ticks', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 12,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };

    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 11,
      },
    };
    const prevState = { ...subject.state };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
    expect(subject.checkCacheAgainstBaseline).not.toHaveBeenCalled();
  });

  it('schedules pile reload when pending metadata retry count changes without hydrate count changes', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 2,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };

    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 0,
      },
    };
    const prevState = { ...subject.state };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
  });

  it('persists SurveyQuestions bookmarks with optimistic cache writes', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ questions: [] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);

    const subject = new SurveyQuestions({
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleBookmarkToggle('q1');
    await Promise.resolve();

    expect(subject.state.bookmarkedQuestions).toEqual(new Set(['q1']));
    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      questions: ['q1'],
    });
  });

  it('coalesces bursty auto-decrypt sweeps into one scheduled pass', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
    };
    subject.isAutoDecryptBlocked = jest.fn(() => false);
    subject.shouldUseAnimationFrameForAutoDecryptSweep = jest.fn(() => false);
    subject.maybeAutoDecryptVisibleFields = jest.fn();

    subject.queueAutoDecryptVisibleSweep('a');
    subject.queueAutoDecryptVisibleSweep('b');
    subject.queueAutoDecryptVisibleSweep('c');

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.maybeAutoDecryptVisibleFields).toHaveBeenCalledTimes(1);
  });

  it('deduplicates in-flight decrypt tasks keyed to the same field payload', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const deferred = createDeferred();
    const runner = jest.fn(() => deferred.promise);

    const first = subject.runDedupedDecryptTask('task-key', runner);
    const second = subject.runDedupedDecryptTask('task-key', runner);
    await Promise.resolve();

    expect(second).toBe(first);
    expect(runner).toHaveBeenCalledTimes(1);

    deferred.resolve(true);
    await first;

    await subject.runDedupedDecryptTask('task-key', runner);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('skips auto-decrypt requeue for unchanged masked payloads after a failed attempt', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const maskedAnswer = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'enc-1',
    };
    const maskedSig = subject.buildAutoDecryptMaskedFieldSignature(maskedAnswer);

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      submissionError: '',
      showComments: {},
      autoDecryptAttempted: {},
      decryptingByKey: {},
      surveysResponseState: [
        { answers: { q1: maskedAnswer }, additionalComments: {} },
      ],
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.processAutoDecryptQueue = jest.fn();
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': maskedSig };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(0);
    expect(subject.processAutoDecryptQueue).not.toHaveBeenCalled();

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {
            q1: {
              ...maskedAnswer,
              encryptedPortion: 'enc-2',
            },
          },
          additionalComments: {},
        },
      ],
    };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(1);
    expect(subject._autoDecQueue[0]).toMatchObject({ qid: 'q1', field: 'answer' });
    expect(subject.processAutoDecryptQueue).toHaveBeenCalledTimes(1);
  });

  it('keeps pile warm-seed questions session-local on /session routes even when list scope includes other slugs', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug) => {
        if (slug === 'edge') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'alpha') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: ['qblockedalpha'] };
        if (slug === 'beta') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);

      const questionCachesBySlug = {
        edge: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge 1' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { id: 'q2', prompt: 'Alpha 2' },
              qBlockedAlpha: { id: 'qBlockedAlpha', prompt: 'Blocked alpha' },
            },
            questionResponses: {},
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { id: 'q3', prompt: 'Beta 3' },
            },
            questionResponses: {},
          },
        },
      };
      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });

      const shell = new SurveyTool({
        minifiedMode: 'pile',
        network: { id: 84532 },
        networkChainId: 84532,
        account: '',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        isQuestionCacheReady: true,
        questionResponsesNonce: 1,
        questionsCacheNonce: 1,
        onFilterChange: jest.fn(),
      });
      const pileElement = shell.render();
      const PileViewModeClass = pileElement.type;
      const subject = new PileViewModeClass(pileElement.props);

      const idsLower = subject.state.pileQuestions.map((q) => String(q.id).toLowerCase());
      expect(idsLower).toEqual(['q1']);
      expect(subject.state.allQuestionsForFilter.map((q) => String(q.id).toLowerCase())).toEqual(['q1']);
      const byIdLower = new Map(
        subject.state.pileQuestions.map((q) => [String(q.id).toLowerCase(), q])
      );
      expect(byIdLower.get('q1')?.sessionSlug).toBe('edge');
      expect(byIdLower.has('q2')).toBe(false);
      expect(byIdLower.has('q3')).toBe(false);
      expect(idsLower).not.toContain('qblockedalpha');
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps pile question loads session-local on /session routes even when list scope includes other slugs', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug) => {
        if (slug === 'edge') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'alpha') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'beta') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);

      const questionCachesBySlug = {
        edge: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
            },
            questionResponses: {
              q2: {
                '0xabc': { answer: { value: 'yes', encrypted: false }, additional: { value: '', encrypted: false } },
              },
            },
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
            },
            questionResponses: {},
          },
        },
      };
      const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });

      const shell = new SurveyTool({
        minifiedMode: 'pile',
        network: { id: 84532 },
        networkChainId: 84532,
        account: '0xAbC',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        isQuestionCacheReady: true,
        questionResponsesNonce: 5,
        questionsCacheNonce: 1,
        onFilterChange: jest.fn(),
      });
      const pileElement = shell.render();
      const PileViewModeClass = pileElement.type;
      const subject = new PileViewModeClass(pileElement.props);

      subject.state = {
        ...subject.state,
        loading: true,
        pileQuestions: [],
        allQuestionsForFilter: [],
        activePileIndex: 0,
        filterState: {},
        isFilterActive: false,
        submissionComplete: false,
        autoDecryptEnabled: false,
        autoDecryptAttempted: {},
        decryptingByKey: {},
      };
      subject.setState = jest.fn((update, cb) => {
        const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
        if (patch && typeof patch === 'object') {
          subject.state = { ...subject.state, ...patch };
        }
        if (typeof cb === 'function') cb();
        return patch;
      });
      subject.initializeResponseState = jest.fn((cb) => {
        if (typeof cb === 'function') cb();
      });
      subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
        if (typeof cb === 'function') cb();
      });
      subject.rehydrateDraftForRenderedIds = jest.fn();

      await subject.loadAndSortQuestions();

      expect(subject.state.pileQuestions.map((q) => String(q.id).toLowerCase())).toEqual(['q1']);
      expect(subject.state.allQuestionsForFilter.map((q) => String(q.id).toLowerCase())).toEqual(['q1']);
      expect(subject.getPileFilterQuestionResponses()).toEqual({});
      const byIdLower = new Map(
        subject.state.pileQuestions.map((q) => [String(q.id).toLowerCase(), q])
      );
      expect(byIdLower.has('q2')).toBe(false);
      const tree = subject.render();
      const questionFilterNode = findElement(
        tree,
        (node) =>
          node?.props?.onFilter === subject.handleFilter &&
          node?.props?.currentViewModeForUrl === 'questions'
      );
      expect(questionFilterNode?.props?.storageKeyPrefix).toBe('dg:filters:edge');
      expect(readSpy).toHaveBeenCalledWith('questionsCache', 'edge');
      expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha');
      expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'beta');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('forwards hideEmbeddedDebugUi from QuestionsDashboard to standalone SurveyQuestions', () => {
    const subject = new QuestionsDashboard({
      hideEmbeddedDebugUi: true,
      account: '0xabc',
      network: { id: 84532 },
      provider: {},
      loginComplete: true,
      onPendingStatsChange: jest.fn(),
      questionFilterRef: { current: null },
      activeSessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      filterLoading: false,
      questions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      filteredQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
    };

    const tree = subject.render();
    const surveyQuestionsNode = findFirstNodeByType(tree, SurveyQuestions);

    expect(surveyQuestionsNode).toBeTruthy();
    expect(surveyQuestionsNode?.props?.hideEmbeddedDebugUi).toBe(true);
  });

  it('recomputes SurveySelector question count on questionResponsesNonce tick', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      questionResponsesNonce: 2,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.state = {
      ...subject.state,
      showLongLoading: false,
      loading: false,
    };

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 1,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.computeFilteredQuestionCount).toHaveBeenCalledTimes(1);
  });

  it('recomputes SurveySelector question count when only networkChainId changes', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      questionResponsesNonce: 2,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.clearStickyQuestionCountSnapshot = jest.fn();
    subject.state = {
      ...subject.state,
      showLongLoading: false,
      loading: false,
    };

    const prevProps = {
      ...subject.props,
      networkChainId: 84531,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.clearStickyQuestionCountSnapshot).toHaveBeenCalledTimes(1);
    expect(subject.fetchSurveys).toHaveBeenCalledTimes(1);
    expect(subject.computeFilteredQuestionCount).toHaveBeenCalledTimes(1);
  });

  it('passes the session chain through when SurveySelector opens SurveyResults', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      networkChainId: 11155420,
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showResults: true,
      showLongLoading: false,
    };

    const tree = subject.render();
    const resultsNode = findElement(tree, (candidate) => candidate?.type === ConnectedSurveyResults);

    expect(resultsNode).toBeTruthy();
    expect(resultsNode.props.networkChainId).toBe(11155420);
  });

  it('renders SurveySelector selected-survey doc link when document URLs exist', () => {
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
      viewMode: 'survey',
      showLongLoading: false,
      surveys: [
        {
          id: 'survey-with-docs',
          title: 'Survey with docs',
          documentURLs: [
            'https://example.com/docs/one',
            'https://example.com/docs/two',
          ],
        },
      ],
      selectedSurveyIndex: 0,
    };
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.areSurveySpecificQuestionsLoaded = jest.fn(() => true);

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === 'https://example.com/docs/one'
    );

    expect(docLink).toBeTruthy();
    expect(docLink?.props?.title).toBe('2 documents');
  });

  it('renders SurveySelector dropdown survey-entry doc link when document URLs exist', () => {
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
      viewMode: 'survey',
      showLongLoading: false,
      surveys: [
        {
          id: 'survey-with-docs',
          title: 'Survey with docs',
          documentURLs: [
            'https://example.com/docs/one',
            'https://example.com/docs/two',
          ],
        },
      ],
      selectedSurveyIndex: null,
    };
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.areSurveySpecificQuestionsLoaded = jest.fn(() => true);

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) => (
        element?.type === 'a' &&
        element?.props?.href === 'https://example.com/docs/one' &&
        nodeHasClassName(element, 'surveyItemDocLink')
      )
    );

    expect(docLink).toBeTruthy();
    expect(docLink?.props?.title).toBe('2 documents');
  });

  it('shows the questions selector encrypted count only while the dropdown is open', () => {
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
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.handleFilteredQuestionCountUpdate(12, 1);

    const closedTree = subject.render();
    const questionToggle = findElement(
      closedTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const closedEncryptedCountBadge = findElement(
      closedTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(questionToggle).toBeTruthy();
    expect(closedEncryptedCountBadge).toBeNull();

    subject.state = {
      ...subject.state,
      selectorDropdownOpen: true,
    };

    const openTree = subject.render();
    const openEncryptedCountBadge = findElement(
      openTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(openEncryptedCountBadge).toBeTruthy();
    expect(openEncryptedCountBadge?.props?.['data-ce-encrypted-question-count']).toBe('1');
    expect(treeHasText(openEncryptedCountBadge, '1')).toBe(true);
  });

  it('keeps the last valid questions selector count visible while same-session loading is active', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    subject.props = {
      ...subject.props,
      isQuestionCacheReady: false,
    };
    subject.state = {
      ...subject.state,
      loading: true,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: true,
    };

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const questionToggleCount = findElement(
      questionToggle,
      (element) => nodeHasClassName(element, styles.questionSelectorCount)
    );
    const loadingSpinner = findElement(
      questionToggle,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(questionToggle).toBeTruthy();
    expect(questionToggleCount).toBeTruthy();
    expect(loadingSpinner).toBeTruthy();
    expect(treeHasText(questionToggle, 'Loading...')).toBe(true);
    expect(renderToStaticMarkup(questionToggleCount)).toContain('(12)');
    expect(renderToStaticMarkup(questionToggleCount)).not.toContain('(0)');
  });

  it('shows an immediate Loading label for the questions selector while question cache bootstrap is still pending', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: false,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );

    expect(questionToggle).toBeTruthy();
    expect(treeHasText(questionToggle, 'Loading...')).toBe(true);
  });

  it('keeps the open questions dropdown row aligned to the sticky count and encrypted badge while loading', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: true,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    subject.props = {
      ...subject.props,
      isQuestionCacheReady: false,
    };
    subject.state = {
      ...subject.state,
      loading: false,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      selectorDropdownOpen: true,
    };

    const tree = subject.render();
    const encryptedCountBadge = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );
    const loadingSpinnerCount = countElements(
      tree,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );
    const stickyCountNodeTotal = countElements(
      tree,
      (element) => (
        nodeHasClassName(element, styles.questionSelectorCount) &&
        renderToStaticMarkup(element).includes('(12)')
      )
    );

    expect(loadingSpinnerCount).toBeGreaterThanOrEqual(2);
    expect(stickyCountNodeTotal).toBeGreaterThanOrEqual(2);
    expect(encryptedCountBadge).toBeTruthy();
    expect(encryptedCountBadge?.props?.['data-ce-encrypted-question-count']).toBe('1');
    expect(treeHasText(encryptedCountBadge, '1')).toBe(true);
  });

  it('does not reuse the sticky questions selector count after a session switch', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    const prevProps = { ...subject.props };
    subject.props = {
      ...subject.props,
      activeSessionSlug: 'alpha',
      isQuestionCacheReady: false,
    };
    subject.state = {
      ...subject.state,
      loading: true,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: true,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const questionToggleCount = findElement(
      questionToggle,
      (element) => nodeHasClassName(element, styles.questionSelectorCount)
    );
    const encryptedCountBadge = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(questionToggle).toBeTruthy();
    expect(questionToggleCount).toBeTruthy();
    expect(renderToStaticMarkup(questionToggleCount)).not.toContain('(12)');
    expect(renderToStaticMarkup(questionToggleCount)).toContain('(0)');
    expect(encryptedCountBadge).toBeNull();
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

  it('renders the SurveySelector header submit CTA with submitGlow when pending edits exist', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
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
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT
    );

    expect(headerSubmitButton).toBeTruthy();
    expect(nodeHasClassName(headerSubmitButton, styles.headerSubmitButton)).toBe(true);
    expect(nodeHasClassName(headerSubmitButton, styles.submitGlow)).toBe(true);
  });

  it('formats capped question scan progress against the requested total range', () => {
    const display = buildQuestionScanProgressDisplay({
      totalBlocks: 50000,
      requestedTotalBlocks: 234000,
      wasCapped: true,
      scannedBlocks: 50000,
      remainingBlocks: 184000,
    });

    expect(display.metaLeftText).toBe('184,000 blocks left');
    expect(display.metaRightText).toBe('50,000 / 234,000');
    expect(display.percentComplete).toBe(21);
  });

  it('renders capped pile loading progress with the requested total block count', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 234000,
        wasCapped: true,
        scannedBlocks: 50000,
        remainingBlocks: 184000,
        startedAtMs: 1000,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();

    expect(treeHasText(tree, '184,000 blocks left')).toBe(true);
    expect(treeHasText(tree, '0 / 184,000')).toBe(true);
  });

  it('tracks pile loading progress relative to the current refresh window', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 234000,
        wasCapped: true,
        scannedBlocks: 50000,
        remainingBlocks: 184000,
        startedAtMs: 1000,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    subject.render();

    subject.props = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 234000,
        wasCapped: true,
        scannedBlocks: 100000,
        remainingBlocks: 134000,
        startedAtMs: 1000,
      },
    };

    const tree = subject.render();

    expect(treeHasText(tree, '134,000 blocks left')).toBe(true);
    expect(treeHasText(tree, '50,000 / 184,000')).toBe(true);
  });

  it('emits pending stats with isSubmitting for header submit spinner state', () => {
    const onPendingStatsChange = jest.fn();
    const subject = new SurveyQuestions({
      onPendingStatsChange,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      questionPool: [],
      isStandalone: true,
    });
    subject.state = {
      ...subject.state,
      isSubmitting: true,
      submittedSinceLastEdit: false,
    };

    subject.emitPendingStats({ total: 2, encrypted: 1 });

    expect(onPendingStatsChange).toHaveBeenCalledWith({
      total: 2,
      encrypted: 1,
      submittedSinceLastEdit: false,
      isSubmitting: true,
    });
  });

  it('hides top JSON in single-question mode and hides embedded JSON controls in embedded full mode', () => {
    const questionPool = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];
    const baseStateSlice = {
      answers: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
      additionalComments: { q1: { value: '', encrypted: false } },
    };

    const embeddedFull = new SurveyQuestions({
      hideEmbeddedDebugUi: true,
      useHeaderSubmit: true,
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    embeddedFull.state = {
      ...embeddedFull.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    embeddedFull.renderQuestion = jest.fn(() => null);
    const embeddedTree = embeddedFull.render();
    expect(treeHasLabel(embeddedTree, '.json')).toBe(false);

    const singleQuestion = new SurveyQuestions({
      hideEmbeddedDebugUi: false,
      useHeaderSubmit: true,
      isStandalone: false,
      singleQuestionMode: true,
      questionPool,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    singleQuestion.state = {
      ...singleQuestion.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    singleQuestion.renderQuestion = jest.fn(() => null);
    const singleQuestionTree = singleQuestion.render();
    expect(treeHasLabel(singleQuestionTree, '.json')).toBe(false);
    expect(treeHasLabel(singleQuestionTree, 'Back to top')).toBe(false);
  });

  it('shows question and response JSON controls for standalone questions pages with multiple questions', () => {
    const questionPool = [
      { id: 'q1', type: 'freeform', prompt: 'Q1' },
      { id: 'q2', type: 'freeform', prompt: 'Q2' },
    ];
    const baseStateSlice = {
      answers: {
        q1: { value: '', encrypted: false },
        q2: { value: '', encrypted: false },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', encrypted: false },
        q2: { value: '', encrypted: false },
      },
    };

    const standaloneQuestions = new SurveyQuestions({
      hideEmbeddedDebugUi: false,
      useHeaderSubmit: true,
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    standaloneQuestions.state = {
      ...standaloneQuestions.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    standaloneQuestions.renderQuestion = jest.fn(() => null);

    const standaloneTree = standaloneQuestions.render();

    expect(treeHasLabel(standaloneTree, 'question .json')).toBe(true);
    expect(treeHasLabel(standaloneTree, 'response .json')).toBe(true);
    expect(treeHasLabel(standaloneTree, 'View Survey .json')).toBe(false);
  });

  it('schedules pile reload on questionResponsesNonce tick', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };
    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 6,
    };
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: 7,
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
  });

  it('keeps optimistic pile state when cache has stale value for a cleared baseline answer', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      submissionComplete: true,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      editBaseline: {
        answers: { q1: { value: '', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      },
    };
    subject.loadAndSortQuestions = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': JSON.stringify({
                answer: { value: 'stale-answer' },
                additional: { value: '' },
              }),
            },
          },
        },
      };
    });

    subject.checkCacheAgainstBaseline();

    expect(subject.state.submissionComplete).toBe(true);
    expect(subject.loadAndSortQuestions).not.toHaveBeenCalled();
  });

  it('does not prefill pile answers from a borrowed general response cache when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'wrong-general-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: null,
    };
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);
    peekSpy.mockClear();

    subject.prefillUserAnswersFromCache();

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.state.surveysResponseState?.[0]?.answers?.q1).toBeUndefined();
    expect(subject.state.editBaseline).toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('hydrates off-screen pile draft answers so submit count stays aligned with full mode', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionResponsesNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Q1' },
        { id: 'q2', type: 'freeform', prompt: 'Q2' },
        { id: 'q3', type: 'freeform', prompt: 'Q3' },
        { id: 'q4', type: 'freeform', prompt: 'Q4' },
        { id: 'q5', type: 'freeform', prompt: 'Q5' },
        { id: 'q6', type: 'freeform', prompt: 'Q6' },
      ],
      activePileIndex: 0,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      isDirty: false,
      modifiedCount: 0,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
    };

    subject.loadDraft = jest.fn(() => ({
      answers: {
        q6: {
          value: 'off-screen draft',
          answerEncrypted: false,
          additional: '',
          additionalEncrypted: false,
          importance: null,
          conviction: null,
        },
      },
    }));
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1', 'q2', 'q3']);
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
    };

    subject.rehydrateDraftForRenderedIds(true);

    expect(subject.state.surveysResponseState?.[0]?.answers?.q6?.value).toBe('off-screen draft');
  });
});
