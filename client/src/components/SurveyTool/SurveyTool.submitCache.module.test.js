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

describe('SurveyTool submit cache writes', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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
});
