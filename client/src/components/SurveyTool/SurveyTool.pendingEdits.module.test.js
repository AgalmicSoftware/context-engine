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

describe('SurveyTool pending edit accounting', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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
});
