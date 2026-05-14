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

describe('SurveyTool single-question bootstrap cache', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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

  it('rehydrates standalone prior responses when the response cache nonce ticks', async () => {
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
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 3,
      questionResponsesNonce: 8,
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

    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.resetFormStateForAccountChange = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 7,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.resetFormStateForAccountChange).not.toHaveBeenCalled();
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

  it('skips automatic single-question prompt decrypt for passive Porto sessions', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'binary',
      prompt: '[encrypted]',
      promptEncrypted: '{"recipients":[]}',
      tags: [],
      encryption: { enabled: true },
    });
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);
    jest.spyOn(portoFunctions, 'isPortoAutoSignReady').mockReturnValue(false);
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'demo-4',
      activeSessionSlug: 'demo-4',
      sessionSlugPinned: true,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: 'porto_passkey',
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
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

    await subject.fetchSingleQuestionData();
    subject.clearSingleQuestionBootstrapRetry();

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(getQuestionDataSpy.mock.calls[0][3]).toEqual(
      expect.objectContaining({ skipDecrypt: true })
    );
  });

  it('auto-decrypts single-question prompts when Porto auto-sign is ready', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'binary',
      prompt: 'Decrypted prompt',
      tags: [],
    });
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);
    jest.spyOn(portoFunctions, 'isPortoAutoSignReady').mockReturnValue(true);
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'demo-4',
      activeSessionSlug: 'demo-4',
      sessionSlugPinned: true,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: 'porto_passkey',
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
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

    await subject.fetchSingleQuestionData();
    subject.clearSingleQuestionBootstrapRetry();

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(getQuestionDataSpy.mock.calls[0][3]).not.toEqual(
      expect.objectContaining({ skipDecrypt: true })
    );
    expect(subject.state.questionPool[0]).toEqual(
      expect.objectContaining({ prompt: 'Decrypted prompt' })
    );
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

  it('renders a masked encrypted question placeholder while new Arweave metadata propagates', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'demo-4',
      activeSessionSlug: 'demo-4',
      sessionSlugPinned: true,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [],
      isLoadingResponse: true,
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    const retrySpy = jest.spyOn(subject, 'scheduleSingleQuestionBootstrapRetry').mockReturnValue(true);

    await subject.fetchSingleQuestionData();

    expect(retrySpy).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      reason: 'question-fetch-unavailable',
    }));
    expect(subject.state.isLoadingResponse).toBe(false);
    expect(subject.state.questionPool).toEqual([
      expect.objectContaining({
        id: 'q1',
        prompt: '[encrypted]',
        __ceQuestionMetadataPending: true,
      }),
    ]);
    expect(subject.state.surveysResponseState.length).toBeGreaterThan(0);
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

  it('uses global Lit hooks when ensureQuestionCached builds decrypt context without scoped props', async () => {
    const litHooks = { getKey: jest.fn() };
    const previousLitHooks = window.__litHooks;
    window.__litHooks = litHooks;
    const emptyQuestionsCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'questionsCache' ? emptyQuestionsCache : null
    ));
    jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, updater) => (
      updater(emptyQuestionsCache)
    ));
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: [],
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    syncClassSetState(subject);

    try {
      await subject.ensureQuestionCached('q1');

      expect(getQuestionDataSpy).toHaveBeenCalledWith(
        {},
        'q1',
        'edge',
        {
          decryptContext: expect.objectContaining({
            chainId: 84532,
            litHooks,
            litOpts: { getKey: litHooks.getKey },
          }),
        }
      );
    } finally {
      if (previousLitHooks === undefined) {
        delete window.__litHooks;
      } else {
        window.__litHooks = previousLitHooks;
      }
    }
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
});
