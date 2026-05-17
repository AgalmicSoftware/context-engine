import SurveyTool from './SurveyTool';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
} from './surveyToolUtils.js';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { QuestionsDashboard } from './SurveySelector';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider } from './DeferredCommitSlider';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  countElements,
  findElement,
  findFirstNodeByType,
  findNodeByClassName,
  getElementChildren,
  nodeHasClassName,
  treeHasDataTestId,
  treeHasLabel,
  treeHasText,
} from './surveyToolTreeTestHelpers.js';

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

describe('SurveyTool locked-question tags', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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

  it('passes an explicit decrypt prompt action into gated prompt notices', () => {
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
    subject.handleReloadMaskedPrompt = jest.fn();

    const tree = subject.renderGatedPromptNotice({
      question: { id: 'Q1', prompt: '[encrypted]' },
      tooltipIdSuffix: 'full',
    });
    const notice = findElement(tree, (node) => node?.type === GatedPromptNotice);

    expect(notice).toBeTruthy();
    expect(notice.props.actionTestId).toBe(E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE);
    expect(notice.props.actionTitle).toBe('Decrypt gated prompt');

    notice.props.onAction();

    expect(subject.handleReloadMaskedPrompt).toHaveBeenCalledWith('q1');
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
      tree?.props?.footerIcons || tree,
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

  it('normalizes hydration question ids from the current rendered-id selector', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['Q1', 'q1', '', 'q2']);

    expect(subject.getHydrationQuestionIds()).toEqual(['q1', 'q2']);
    expect(subject.getCurrentRenderedQuestionIds).toHaveBeenCalledTimes(1);

    expect(subject.getRenderedQuestionIdsForResponseHydration()).toEqual(['q1', 'q2']);
    expect(subject.getCurrentRenderedQuestionIds).toHaveBeenCalledTimes(2);
  });

  it('initializes standalone response state from prop question ids before rendered-id lookup', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      questionPool: [{ id: 'q1' }],
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q2']);

    const initial = subject.initializeSurveyResponseState();

    expect(subject.getCurrentRenderedQuestionIds).not.toHaveBeenCalled();
    expect(initial).toHaveLength(1);
    expect(initial[0].answers.q1).toBeDefined();
    expect(initial[0].answers.q2).toBeUndefined();
  });

  it('memoizes pile rendered question ids until the active pile window changes', () => {
    const subject = new PileViewMode({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.state = {
      ...subject.state,
      activePileIndex: 2,
      pileQuestions: [
        { id: 'q1' },
        { id: 'q2' },
        { id: 'q3' },
        { id: 'q4' },
        { id: 'q5' },
        { id: 'q6' },
      ],
    };

    const first = subject.getCurrentRenderedQuestionIds();
    const second = subject.getCurrentRenderedQuestionIds();
    expect(second).toBe(first);
    expect(second).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);

    subject.state = {
      ...subject.state,
      activePileIndex: 4,
    };
    const third = subject.getCurrentRenderedQuestionIds();
    expect(third).not.toBe(second);
    expect(third).toEqual(['q3', 'q4', 'q5', 'q6']);
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
});
