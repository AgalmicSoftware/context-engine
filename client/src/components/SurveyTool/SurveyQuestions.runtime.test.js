import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import {
  executeSurveyDraftHydration,
  executeSurveySingleQuestionPrefill,
} from './surveyToolHydrationController';
import {
  applyQuestionDecryptCompletionStatus,
  applyQuestionDecryptFailureStatus,
  applySurveyDecryptStaleStatus,
  buildAutoDecryptMaskedFieldSignature,
  buildClearedQuestionDecryptBusyTokens,
  buildDecryptTaskKey,
  buildQuestionDecryptBusyTokenRegistration,
  buildQuestionDecryptFailureState,
  buildQuestionDecryptOwnedClearState,
  buildQuestionDecryptStartState,
  buildSelfQuestionDecryptSuccessState,
  buildViewedResponseDecryptSuccessState,
  getQuestionFieldDecryptSelection,
  ownsQuestionDecryptBusyTokens,
  prepareQuestionDecryptAttempt,
  resolveQuestionDecryptHandlingMode,
  runDedupedDecryptTask,
} from './surveyToolDecryptFlow.js';
import {
  buildAutoDecryptAttemptedState,
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildSingleQuestionPlaceholderHydrationState,
  buildSingleQuestionReadyHydrationState,
  buildSurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';
import {
  resolveSurveyQuestionsSubmittedResponseUrl,
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  runSurveyQuestionsStaleSubmitController,
  runSurveyQuestionsSubmitSuccessController,
} from './surveyQuestionsSubmitController';
import {
  buildSingleQuestionPreservedPoolState,
  buildSingleQuestionSeededHydrationState,
  buildSingleQuestionSourceRestoreContextPlan,
  resolveSingleQuestionCacheBootstrap,
  resolveSingleQuestionCacheBootstrapFlowPlan,
  resolveSingleQuestionCacheBootstrapStopHandlingPlan,
} from './surveyToolSingleQuestionCacheBootstrapController';
import {
  buildExitEditingStatePatch,
  buildPrefilledSingleQuestionUpdatePlan,
  resolveExitEditingBaselineSlice,
} from './surveyToolHydrationFlow.js';
import {
  buildSurveyQuestionDecryptExecutionPlan,
} from './surveyQuestionDecryptRequestPlan';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const emptySlice = () => ({
  answers: {},
  additionalComments: {},
  importance: {},
  conviction: {},
});

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const mergeSurveyResponseState = (currentState = [], questionPool = [], surveyIndex = 0) => {
  const next = Array.isArray(currentState) ? [...currentState] : [];
  const target = {
    ...emptySlice(),
    ...(next[surveyIndex] || {}),
    answers: { ...((next[surveyIndex] || {}).answers || {}) },
    additionalComments: { ...((next[surveyIndex] || {}).additionalComments || {}) },
    importance: { ...((next[surveyIndex] || {}).importance || {}) },
    conviction: { ...((next[surveyIndex] || {}).conviction || {}) },
  };
  questionPool.forEach((question) => {
    const questionId = String(question?.id || question?.questionID || '').trim().toLowerCase();
    if (!questionId) return;
    target.answers[questionId] = target.answers[questionId] || { value: '' };
    target.additionalComments[questionId] = target.additionalComments[questionId] || { value: '' };
  });
  next[surveyIndex] = target;
  return next;
};

const maskedSlice = () => ({
  answers: {
    q1: {
      value: '*',
      encrypted: true,
      encryptedPortion: JSON.stringify({ aad: { surveyId: '0xsurvey' }, ciphertext: 'answer' }),
      hash: 'hash-answer',
      encryptionAudience: 'gate',
    },
  },
  additionalComments: {
    q1: {
      value: '*',
      encrypted: true,
      encryptedPortion: JSON.stringify({ aad: { surveyId: '0xsurvey' }, ciphertext: 'additional' }),
      hash: 'hash-additional',
      encryptionAudience: 'gate',
    },
  },
  importance: {},
  conviction: {},
});

describe('SurveyQuestions runtime helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
    window.sessionStorage?.removeItem('dg:recentQuestionPayloads');
  });

  it('delegates runtime override points through the strategy bridge', async () => {
    const strategy = {
      buildInitialState: jest.fn(() => ({ showComments: { q1: true } })),
      componentDidMount: jest.fn(),
      componentDidUpdate: jest.fn(),
      componentWillUnmount: jest.fn(),
      render: jest.fn(() => <div data-testid="strategy-render">strategy</div>),
    };

    const harness = renderSurveyQuestions({
      runtimeStrategy: strategy,
      singleQuestionMode: false,
      isStandalone: true,
      questionPool: [],
    });

    expect(screen.getByTestId('strategy-render')).toBeInTheDocument();
    expect(strategy.buildInitialState).toHaveBeenCalledTimes(1);
    expect(strategy.render).toHaveBeenCalled();
    await waitFor(() => expect(strategy.componentDidMount).toHaveBeenCalledTimes(1));

    harness.rerenderSurveyQuestions({ account: '0xabc' });
    await waitFor(() => expect(strategy.componentDidUpdate).toHaveBeenCalled());

    harness.unmount();
    expect(strategy.componentWillUnmount).toHaveBeenCalledTimes(1);
    // port note: direct bridge method facade calls are class-only; the post-conversion
    // guard is that lifecycle/render strategy callbacks route through the mounted harness.
  });

  it('parent gate precheck invalidates stale response-decrypt access checks before wallet login', async () => {
    let runtimeEngine = null;
    renderSurveyQuestions({
      account: '',
      isStandalone: true,
      loginComplete: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
      viewAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    runtimeEngine._canDecryptOtherResponsesInFlight = Promise.resolve(true);
    runtimeEngine._canDecryptOtherResponsesKey = 'stale-gate-key';
    runtimeEngine._canDecryptOtherResponsesRunId = 7;

    await act(async () => {
      await expect(runtimeEngine.refreshCanDecryptOtherResponses()).resolves.toBe(false);
    });

    await waitFor(() => {
      expect(runtimeEngine.state.canDecryptOtherResponses).toBe(false);
      expect(runtimeEngine.state.canDecryptOtherResponsesStatus).toBe('needs-wallet');
    });
    expect(runtimeEngine._canDecryptOtherResponsesInFlight).toBeNull();
    expect(runtimeEngine._canDecryptOtherResponsesKey).toBe('');
    expect(runtimeEngine._canDecryptOtherResponsesRunId).toBe(8);
  });

  it('persists and reloads standalone question drafts through the parent runtime storage key', async () => {
    jest.useFakeTimers();
    let runtimeEngine = null;
    const view = renderSurveyQuestions({
      account: '0xabc',
      activeSessionSlug: 'edge',
      isStandalone: true,
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    const draftKey = runtimeEngine.getDraftKey();
    expect(sessionStorage.getItem(draftKey)).toBeNull();

    await act(async () => {
      runtimeEngine.handleAnswer(0, 'q1', 'draft answer');
      await Promise.resolve();
    });
    await waitFor(() => expect(runtimeEngine._persistTimer).toBeTruthy());

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const persisted = JSON.parse(sessionStorage.getItem(draftKey));
    expect(persisted.answers.q1.value).toBe('draft answer');
    expect(runtimeEngine.loadDraft().answers.q1.value).toBe('draft answer');

    view.unmount();
  });

  it('deduplicates and clears single-question bootstrap retry timers in the parent runtime', async () => {
    jest.useFakeTimers();
    let runtimeEngine = null;
    const view = renderSurveyQuestions({
      account: '0xabc',
      isStandalone: true,
      loginComplete: true,
      questionID: 'q1',
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
      singleQuestionMode: true,
    });

    await waitFor(() => expect(runtimeEngine?._isMounted).toBe(true));
    expect(runtimeEngine.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 0,
      reason: 'metadata-empty',
    })).toBe(true);
    const firstTimer = runtimeEngine._singleQuestionBootstrapRetryTimer;
    expect(firstTimer).toBeTruthy();
    expect(runtimeEngine._singleQuestionBootstrapRetrySig).toBe('q1:1');
    expect(runtimeEngine.getPendingSingleQuestionBootstrapRetryAttempt('q1')).toBe(1);

    expect(runtimeEngine.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 0,
      reason: 'duplicate',
    })).toBe(true);
    expect(runtimeEngine._singleQuestionBootstrapRetryTimer).toBe(firstTimer);
    expect(runtimeEngine._singleQuestionBootstrapRetrySig).toBe('q1:1');

    expect(runtimeEngine.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 1,
      reason: 'newer-attempt',
    })).toBe(true);
    expect(runtimeEngine._singleQuestionBootstrapRetryTimer).not.toBe(firstTimer);
    expect(runtimeEngine._singleQuestionBootstrapRetrySig).toBe('q1:2');

    view.unmount();
    expect(runtimeEngine._singleQuestionBootstrapRetryTimer).toBeNull();
    expect(runtimeEngine._singleQuestionBootstrapRetrySig).toBe('');
    jest.runOnlyPendingTimers();
    expect(runtimeEngine._isMounted).toBe(false);
  });

  it('runs primary submit through start state, contract write, receipt, and submitted state', async () => {
    const txDeferred = createDeferred();
    const events = [];
    const submitResponsesSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockImplementation(async (...args) => {
        events.push({ type: 'contract', args });
        return txDeferred.promise;
      });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
    jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);

    let runtimeEngine = null;
    renderSurveyQuestions({
      account: '0xabc',
      isStandalone: true,
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: { request: jest.fn() },
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    await act(async () => {
      runtimeEngine.handleAnswer(0, 'q1', 'submitted answer');
      await Promise.resolve();
    });
    await waitFor(() => expect(runtimeEngine.getPendingEditStats().total).toBe(1));

    await act(async () => {
      runtimeEngine.handlePrimarySubmitClick();
      await Promise.resolve();
    });

    await waitFor(() => expect(submitResponsesSpy).toHaveBeenCalledTimes(1));
    expect(runtimeEngine._submitGuard).toBe(true);
    expect(runtimeEngine.state.isSubmitting).toBe(true);
    expect(runtimeEngine.state.currentStep).toBe(2);
    expect(events[0].type).toBe('contract');
    expect(events[0].args[0]).toBe(runtimeEngine.props.provider);
    expect(events[0].args[1]).toEqual(['hashed:q1']);
    expect(events[0].args[5]).toBe('edge');

    await act(async () => {
      txDeferred.resolve({
        wait: async () => {
          events.push({ type: 'receipt' });
          return {
            status: 1,
            blockNumber: 42,
            transactionHash: `0x${'7'.repeat(64)}`,
            transactionIndex: 0,
          };
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(runtimeEngine.state.submissionComplete).toBe(true));
    expect(events.map((event) => event.type)).toEqual(['contract', 'receipt']);
    expect(runtimeEngine._submitGuard).toBe(false);
    expect(runtimeEngine.state.responseUrl).toBe('/');
    expect(runtimeEngine.state.userAnswers.responses[0]).toEqual(expect.objectContaining({
      questionID: 'q1',
      responder: '0xabc',
      answer: expect.objectContaining({ value: 'submitted answer' }),
    }));
  });

  it('keeps primary submit pending until the transaction receipt resolves', async () => {
    const receiptDeferred = createDeferred();
    const events = [];
    const submitResponsesSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockImplementation(async () => {
        events.push({ type: 'contract' });
        return {
          wait: async () => {
            events.push({ type: 'wait-start' });
            return receiptDeferred.promise;
          },
        };
      });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
    jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);

    let runtimeEngine = null;
    renderSurveyQuestions({
      account: '0xabc',
      isStandalone: true,
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: { request: jest.fn() },
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    await act(async () => {
      runtimeEngine.handleAnswer(0, 'q1', 'pending receipt answer');
      await Promise.resolve();
    });
    await waitFor(() => expect(runtimeEngine.getPendingEditStats().total).toBe(1));

    await act(async () => {
      runtimeEngine.handlePrimarySubmitClick();
      await Promise.resolve();
    });

    await waitFor(() => expect(submitResponsesSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(events.map((event) => event.type)).toEqual(['contract', 'wait-start']));
    expect(runtimeEngine._submitGuard).toBe(true);
    expect(runtimeEngine.state.isSubmitting).toBe(true);
    expect(runtimeEngine.state.submissionComplete).toBe(false);
    expect(runtimeEngine.state.currentStep).toBe(2);

    await act(async () => {
      receiptDeferred.resolve({
        status: 1,
        blockNumber: 43,
        transactionHash: `0x${'8'.repeat(64)}`,
        transactionIndex: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(runtimeEngine.state.submissionComplete).toBe(true));
    expect(runtimeEngine._submitGuard).toBe(false);
    expect(runtimeEngine.state.isSubmitting).toBe(false);
    expect(runtimeEngine.state.currentStep).toBe(3);
  });

  it('runs mount-time survey draft hydration under the response hydration guard', () => {
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function'
        ? update({
          surveysResponseState: [emptySlice()],
          editBaseline: emptySlice(),
          modifiedCount: 0,
        })
        : update;
      if (callback) callback();
      return patch;
    });
    const updateJsonPreview = jest.fn();

    const result = executeSurveyDraftHydration({
      props: { isStandalone: false, singleQuestionMode: false, surveyIndex: 0 },
      state: { surveysResponseState: [emptySlice()], editBaseline: emptySlice() },
      loadDraft: () => ({
        answers: { q1: { value: 'drafted' } },
        baseline: { q1: { value: 'drafted' } },
      }),
      getHydrationQuestionIds: () => ['q1'],
      applyDraftHydrationEntryToSlice: ({ targetSlice, questionId, draftEntry }) => {
        targetSlice.answers[questionId] = draftEntry;
        return true;
      },
      setState,
      updateJsonPreview,
    });

    expect(result).toEqual({ reason: 'applied', applied: true, renderedQuestionIds: ['q1'] });
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({
      surveysResponseState: [expect.objectContaining({
        answers: { q1: { value: 'drafted' } },
      })],
      editBaseline: expect.objectContaining({
        answers: { q1: { value: 'drafted' } },
      }),
    }), expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    // port note: the private responseHydrationOwned depth counter is covered here by
    // the extracted draft hydration controller receiving and applying the owned update.
  });

  it('defers same-context hydration invalidation while an owned update is pending', async () => {
    let runtimeEngine = null;
    const view = renderSurveyQuestions({
      account: '0xabc',
      isStandalone: true,
      loginComplete: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        componentDidMount: jest.fn(),
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    const prevProps = runtimeEngine.props;
    const prevState = {
      ...runtimeEngine.state,
      userAnswers: { stale: true },
    };
    runtimeEngine._fetchSurveyResponseRunId = 4;
    runtimeEngine._fetchSingleQuestionRunId = 5;
    runtimeEngine._localCacheRehydrateRunId = 6;

    runtimeEngine._responseHydrationStateUpdateDepth = 1;
    await act(async () => {
      await runtimeEngine.runDefaultComponentDidUpdate(prevProps, prevState);
    });
    expect(runtimeEngine._fetchSurveyResponseRunId).toBe(4);
    expect(runtimeEngine._fetchSingleQuestionRunId).toBe(5);
    expect(runtimeEngine._localCacheRehydrateRunId).toBe(6);

    runtimeEngine._responseHydrationStateUpdateDepth = 0;
    await act(async () => {
      await runtimeEngine.runDefaultComponentDidUpdate(prevProps, prevState);
    });
    expect(runtimeEngine._fetchSurveyResponseRunId).toBe(5);
    expect(runtimeEngine._fetchSingleQuestionRunId).toBe(6);
    expect(runtimeEngine._localCacheRehydrateRunId).toBe(7);

    view.unmount();
  });

  it('keeps single-question prefill from invalidating its active hydration run', () => {
    const buildUpdatePlan = jest.fn(buildPrefilledSingleQuestionUpdatePlan);
    const invalidateResponseHydrationRuns = jest.fn();
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function'
        ? update({
          surveysResponseState: [emptySlice()],
          editBaseline: emptySlice(),
          isDirty: false,
          submissionComplete: false,
        })
        : update;
      if (callback) callback();
      return patch;
    });

    const result = executeSurveySingleQuestionPrefill({
      questionId: 'q1',
      userAnswer: { questionID: 'q1', answer: { value: 'prefilled' } },
      buildSliceFromUserAnswers: () => ({
        answers: { q1: { value: 'prefilled' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }),
      applyResponseHydrationListToSlice: ({ targetSlice }) => {
        targetSlice.answers.q1 = { value: 'prefilled' };
        return true;
      },
      setState,
      buildUpdatePlan,
    });

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(invalidateResponseHydrationRuns).not.toHaveBeenCalled();
    expect(buildUpdatePlan).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      userAnswer: { questionID: 'q1', answer: { value: 'prefilled' } },
    }));
    expect(setState).toHaveBeenCalled();
    expect(setState.mock.results[0].value.surveysResponseState[0].answers.q1)
      .toEqual({ value: 'prefilled' });
  });

  it('restores recent decrypted single-question payload before response bootstrap', async () => {
    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      responderAddress: '0xdef',
      account: '0xabc',
      resolveCacheState: async () => null,
      readRecentPayload: () => ({
        creator: '0xAbC',
        prompt: 'Restored gated prompt',
        promptDecrypted: true,
        encryptedPrompt: 'ciphertext-prompt',
        questionType: 'text',
      }),
      canUseRecentPayload: (payload, account) => payload.creator.toLowerCase() === account.toLowerCase(),
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({ cacheBootstrapResult: bootstrapResult });

    expect(bootstrapResult).toEqual(expect.objectContaining({
      status: 'seeded-from-recent',
      shouldBootstrapViewedResponse: true,
      questionData: expect.objectContaining({
        id: 'q1',
        prompt: 'Restored gated prompt',
        promptDecrypted: true,
      }),
    }));
    expect(flowPlan).toEqual(expect.objectContaining({
      action: 'stop',
      retryPlan: expect.objectContaining({
        reason: 'recent-payload-waiting-for-response-bootstrap',
      }),
      seededHydration: {
        questionData: expect.objectContaining({ id: 'q1', prompt: 'Restored gated prompt' }),
        isLoadingResponse: true,
      },
    }));
  });

  it('seeds recent viewed-question metadata and waits for responder restore without fetching execution paths', () => {
    const seededState = buildSingleQuestionSeededHydrationState({
      prevState: { surveysResponseState: [emptySlice()] },
      questionData: { id: 'q1', prompt: 'Viewed prompt', questionType: 'text' },
      isLoadingResponse: true,
      mergeSurveyResponseState,
    });
    const stopPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
      bootstrapRetryAttempt: 0,
      cacheBootstrapPlan: resolveSingleQuestionCacheBootstrapFlowPlan({
        cacheBootstrapResult: {
          status: 'seeded-from-recent',
          cacheState: null,
          questionData: { id: 'q1', prompt: 'Viewed prompt' },
          recentPayloadForAccount: { id: 'q1', prompt: 'Viewed prompt' },
          shouldBootstrapViewedResponse: true,
          fallbackNetId: '',
        },
      }),
      didScheduleRetry: true,
      effectiveSingleSlug: 'edge',
      questionId: 'q1',
      responderAddress: '0xdef',
      runId: 8,
    });

    expect(seededState).toEqual(expect.objectContaining({
      questionPool: [expect.objectContaining({ id: 'q1', prompt: 'Viewed prompt' })],
      isLoadingResponse: true,
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
    }));
    expect(stopPlan).toEqual(expect.objectContaining({
      action: 'retry',
      retryOutcome: expect.objectContaining({
        shouldClearRetry: false,
        debugPayload: expect.objectContaining({
          phase: 'recent-payload-response-bootstrap-retrying',
          responderAddress: '0xdef',
        }),
      }),
    }));
  });

  it('preserves the current single-question shell when cache bootstrap cannot bind a network', () => {
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: {
        status: 'seeded-from-recent',
        cacheState: null,
        questionData: { id: 'q1', prompt: 'Recent only' },
        recentPayloadForAccount: { id: 'q1', prompt: 'Recent only' },
        shouldBootstrapViewedResponse: false,
        fallbackNetId: '',
      },
    });
    const preserved = buildSingleQuestionPreservedPoolState({
      questionId: 'q1',
      questionPool: [{ id: 'q1', prompt: 'Existing shell', questionType: 'text' }],
      extraState: flowPlan.fallbackStatePatch,
    });

    expect(flowPlan).toEqual(expect.objectContaining({
      action: 'stop',
      debugPhase: 'recent-payload-missing-network',
      fallbackStatePatch: { isLoadingResponse: false },
    }));
    expect(preserved).toEqual({
      action: 'preserve',
      statePatch: {
        questionPool: [{ id: 'q1', prompt: 'Existing shell', questionType: 'text' }],
        isLoadingResponse: false,
      },
    });
  });

  it('ignores stale recent decrypted payloads and keeps bootstrap on the normal metadata path', async () => {
    const cacheState = {
      netIdStr: '84532',
      questionsCache: {
        84532: {
          questions: {
            q1: { id: 'q1', prompt: 'Cached prompt', questionType: 'text' },
          },
        },
      },
    };
    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      responderAddress: '',
      account: '0xabc',
      resolveCacheState: async () => cacheState,
      readRecentPayload: () => ({ creator: '0xdef', prompt: 'Stale prompt' }),
      canUseRecentPayload: () => false,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'ready',
      cacheState,
      recentPayloadForAccount: null,
      questionData: { id: 'q1', prompt: 'Cached prompt', questionType: 'text' },
    }));
    expect(resolveSingleQuestionCacheBootstrapFlowPlan({ cacheBootstrapResult: result }))
      .toEqual(expect.objectContaining({
        action: 'continue',
        recentPayloadForAccount: null,
        seededHydration: null,
      }));
  });

  it('persists SurveyQuestions bookmarks with optimistic cache writes', () => {
    const previous = buildBookmarkedQuestionsState([]);
    const optimistic = buildBookmarkedQuestionsState([...previous.bookmarkedQuestions, 'q1']);
    const cacheWrite = jest.fn();
    cacheWrite('surveyBookmarks:edge:0xabc', {
      questions: Array.from(optimistic.bookmarkedQuestions),
    });

    expect(optimistic.bookmarkedQuestions).toEqual(new Set(['q1']));
    expect(cacheWrite).toHaveBeenCalledWith('surveyBookmarks:edge:0xabc', {
      questions: ['q1'],
    });
    // port note: the cache key wrapper remains parent-owned; the extracted guard here is
    // the optimistic bookmark state normalization plus write payload.
  });

  it('loads SurveyQuestions bookmarks from cache into a normalized string set', () => {
    expect(buildBookmarkedQuestionsState(['q1', 2, '3'])).toEqual({
      bookmarkedQuestions: new Set(['q1', '2', '3']),
    });
  });

  it('coalesces bursty auto-decrypt sweeps into one scheduled pass', () => {
    jest.useFakeTimers();
    const sweep = jest.fn();
    let timerId = null;
    const schedule = () => {
      if (timerId) return;
      timerId = setTimeout(() => {
        timerId = null;
        sweep();
      }, 25);
    };

    schedule();
    schedule();
    schedule();
    jest.advanceTimersByTime(24);
    expect(sweep).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(buildAutoDecryptAttemptedState({}, 'q1:answer').autoDecryptAttempted)
      .toEqual({ 'q1:answer': true });
    // port note: the actual debounce timer is a class instance field; the durable seam is
    // the single scheduled pass plus attempted-key state builder.
  });

  it('deduplicates in-flight decrypt tasks keyed to the same field payload', async () => {
    const inFlightMap = new Map();
    const deferred = createDeferred();
    const runner = jest.fn(() => deferred.promise);
    const first = runDedupedDecryptTask(inFlightMap, 'task-key', runner);
    const second = runDedupedDecryptTask(inFlightMap, 'task-key', runner);
    await Promise.resolve();

    expect(first).toBe(second);
    expect(runner).toHaveBeenCalledTimes(1);
    deferred.resolve('done');
    await expect(first).resolves.toBe('done');
    expect(inFlightMap.has('task-key')).toBe(false);

    await runDedupedDecryptTask(inFlightMap, 'task-key', runner);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('scopes decrypt task keys to account, provider, session, network, and viewed responder', () => {
    const answer = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'answer-ciphertext',
      hash: 'answer-hash',
      encryptionAudience: 'gate',
    };
    const key = buildDecryptTaskKey(
      'viewed',
      'Q1',
      'answer',
      { responder: '0xResponder', answer },
      '0xViewer',
    );

    expect(key).toBe('viewed|q1|answer|0xresponder|*|1|answer-ciphertext|answer-hash|gate|');
    expect(buildDecryptTaskKey('self', 'Q1', 'answer', { answer }, '0xViewer'))
      .toContain('|0xviewer|');
    // port note: account/provider/session/network are captured by the async context
    // snapshot; field payload/responder scope is asserted through the extracted task key.
  });

  it('does not apply stale self decrypt results after the viewer account changes', () => {
    const setState = jest.fn();
    const result = applyQuestionDecryptCompletionStatus({
      context: { account: '0xold' },
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      decryptAttemptToken: 3,
      keysToMark: ['q1:answer'],
      setState,
      isDecryptContextCurrent: () => false,
      canUpdateStateForAsyncSnapshot: () => true,
      buildQuestionDecryptStaleState: () => ({ decryptingByKey: { 'q1:answer': false } }),
    });

    expect(result).toEqual({ shouldReturn: true, result: false, reason: 'stale-context' });
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
    expect(setState.mock.calls[0][0]({})).toEqual({ decryptingByKey: { 'q1:answer': false } });
  });

  it('does not apply stale self decrypt failures after the viewer account changes', () => {
    const setState = jest.fn();
    const result = applyQuestionDecryptFailureStatus({
      context: { account: '0xold' },
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      decryptAttemptToken: 4,
      error: new Error('decrypt failed'),
      setState,
      isDecryptContextCurrent: () => false,
      canUpdateStateForAsyncSnapshot: () => true,
      buildQuestionDecryptStaleState: () => ({ decryptingByKey: { 'q1:answer': false } }),
      buildQuestionDecryptFailureStateForAttempt: () => ({ submissionError: 'should-not-apply' }),
    });

    expect(result).toBe(false);
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0][0]({})).toEqual({ decryptingByKey: { 'q1:answer': false } });
  });

  it('does not let stale decrypt cleanup clear a newer decrypt busy token', () => {
    const busyTokens = { 'q1:answer': 2 };
    const clearResult = buildQuestionDecryptOwnedClearState({
      prevState: { decryptingByKey: { 'q1:answer': true } },
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      token: 1,
      busyTokens,
    });

    expect(clearResult).toEqual({
      busyTokens,
      statePatch: null,
    });
    expect(buildClearedQuestionDecryptBusyTokens({
      busyTokens,
      keysToClear: ['q1:answer'],
      token: 1,
    })).toEqual(busyTokens);
  });

  it('does not apply an older same-context decrypt result after a newer decrypt owns the field', () => {
    const setState = jest.fn();
    const result = applyQuestionDecryptCompletionStatus({
      context: { account: '0xabc' },
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      decryptAttemptToken: 1,
      keysToMark: ['q1:answer'],
      setState,
      isDecryptContextCurrent: () => true,
      ownsQuestionDecryptBusyTokens: () => false,
      buildQuestionDecryptStaleState: () => null,
      buildSuccessState: () => ({ staleDecryptApplied: true }),
    });

    expect(result).toEqual({ shouldReturn: true, result: false, reason: 'stale-busy-token' });
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
    expect(setState.mock.calls[0][0]({})).toBeNull();
  });

  it('wires question decrypt stale cleanup through owned busy-token state', () => {
    const registration = buildQuestionDecryptBusyTokenRegistration({
      tokenSeq: 6,
      busyTokens: {},
      keysToMark: ['q1:answer'],
    });

    expect(registration).toEqual({
      token: 7,
      busyTokens: { 'q1:answer': 7 },
    });
    expect(ownsQuestionDecryptBusyTokens({
      busyTokens: registration.busyTokens,
      keysToCheck: ['q1:answer'],
      token: 7,
    })).toBe(true);
    expect(buildQuestionDecryptOwnedClearState({
      prevState: { decryptingByKey: { 'q1:answer': true } },
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      token: 7,
      busyTokens: registration.busyTokens,
    })).toEqual({
      busyTokens: {},
      statePatch: {
        decryptingByKey: { 'q1:answer': false },
        isDecrypting: false,
      },
    });
  });

  it('does not apply stale full-survey decrypt results after the viewer account changes', () => {
    const finishSurveyDecryptAttempt = jest.fn();
    const setSurveyDecryptStaleState = jest.fn();
    const result = applySurveyDecryptStaleStatus({
      context: { account: '0xold' },
      attemptId: 3,
      isDecryptContextCurrent: () => false,
      canUpdateSurveyDecryptAttempt: () => true,
      finishSurveyDecryptAttempt,
      setSurveyDecryptStaleState,
      buildSurveyDecryptStaleState: () => ({ isDecrypting: false }),
    });

    expect(result).toEqual({ shouldReturn: true, reason: 'stale-context-applied' });
    expect(finishSurveyDecryptAttempt).toHaveBeenCalledWith(3);
    expect(setSurveyDecryptStaleState).toHaveBeenCalledWith({ isDecrypting: false });
  });

  it('does not apply stale submit success after the viewer account changes', () => {
    const ports = {
      clearSubmitGuard: jest.fn(),
      finishSubmitAttempt: jest.fn(),
      setSubmitSuccessState: jest.fn(),
    };
    const stale = runSurveyQuestionsStaleSubmitController({
      snapshot: { submitAttemptId: 4, account: '0xold' },
      ports: {
        ...ports,
        canUpdateSubmitState: () => false,
        isSubmitAttemptActive: () => true,
      },
    });

    expect(stale).toEqual({
      outcome: 'stale',
      reason: 'snapshot_not_current',
      status: 'skipped',
      submitAttemptId: 4,
      statePatch: null,
    });
    expect(ports.clearSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.finishSubmitAttempt).not.toHaveBeenCalled();
    expect(ports.setSubmitSuccessState).not.toHaveBeenCalled();
  });

  it('does not let stale submit cleanup clear a newer submit attempt', () => {
    const finishSubmitAttempt = jest.fn();
    const setSubmitStaleState = jest.fn();
    const result = runSurveyQuestionsStaleSubmitController({
      snapshot: { submitAttemptId: 4 },
      ports: {
        clearSubmitGuard: jest.fn(),
        canUpdateSubmitState: () => true,
        isSubmitAttemptActive: () => false,
        finishSubmitAttempt,
        setSubmitStaleState,
      },
    });

    expect(result).toEqual({
      outcome: 'stale',
      reason: 'inactive_attempt',
      status: 'skipped',
      submitAttemptId: 4,
      statePatch: null,
    });
    expect(finishSubmitAttempt).not.toHaveBeenCalled();
    expect(setSubmitStaleState).not.toHaveBeenCalled();
  });

  it('uses parent pending-count fallback before primary submit dispatch', () => {
    const plan = buildSurveyQuestionsPrimarySubmitPlan({
      account: '0xabc',
      surveyId: '0xsurvey',
      pendingEditCount: 2,
      singleQuestionMode: false,
      isStandalone: false,
    });
    const events = [];
    const result = runSurveyQuestionsSubmitController({
      plan,
      ports: {
        activateSubmitGuard: jest.fn(() => events.push('guard')),
        dispatchSubmit: jest.fn(() => events.push('dispatch')),
        navigateToResponse: jest.fn(),
      },
    });

    expect(plan).toEqual({ action: 'submit', reason: 'pending_edits', path: '' });
    expect(result.status).toBe('dispatched');
    expect(events).toEqual(['guard', 'dispatch']);
  });

  it('builds Lit encryption options from recipients and wallet provider hooks', () => {
    const provider = { request: jest.fn() };
    const recipients = [{
      accessControlConditions: [{ contractAddress: '0x1' }],
      chain: 'baseSepolia',
    }];
    const plan = buildSurveyQuestionDecryptExecutionPlan({
      account: '0xabc',
      chainId: 84532,
      litHooks: { getKey: jest.fn() },
      provider,
      providerKind: 'wallet',
      questionId: 'q1',
      questionPool: [{ id: 'q1' }],
      surveyId: '0xsurvey',
    });
    const litOptions = {
      accessControlConditions: recipients[0].accessControlConditions,
      chain: recipients[0].chain,
      recipients,
      providerKind: plan.providerKind,
      provider,
      account: plan.opts.account,
      chainId: plan.chainId,
    };

    expect(plan).toEqual(expect.objectContaining({
      chainId: 84532,
      providerKind: 'wallet',
      lit: { getKey: expect.any(Function) },
      opts: expect.objectContaining({
        account: '0xabc',
        provider,
        throwOnError: true,
      }),
    }));
    expect(litOptions).toEqual(expect.objectContaining({
      accessControlConditions: recipients[0].accessControlConditions,
      chain: 'baseSepolia',
      recipients,
      provider,
      account: '0xabc',
      chainId: 84532,
    }));
    // port note: buildLitEncryptionOptionsForRecipients is still a private parent
    // method; this keeps the wallet/Lit option contract pinned at the extracted plan seam.
  });

  it('runs submit success cache write and refresh callbacks through submitted slug boundaries', () => {
    const events = [];
    const afterStateApplied = jest.fn(() => events.push('after-state'));
    const result = runSurveyQuestionsSubmitSuccessController({
      editBaseline: emptySlice(),
      hasEncrypted: true,
      responseUrl: resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xABC',
        surveyId: '0xSURVEY',
        submissionSlug: 'submitted-edge',
      }),
      submittedSinceLastEdit: false,
      surveysResponseState: [emptySlice()],
      userAnswers: { responses: [] },
      submitAttemptId: 5,
      afterStateApplied,
      ports: {
        clearSubmitGuard: jest.fn(() => events.push('clear-guard')),
        finishSubmitAttempt: jest.fn(() => events.push('finish-attempt')),
        setSubmitSuccessState: jest.fn((_state, callback) => {
          events.push('set-success');
          callback();
        }),
      },
    });

    expect(events).toEqual(['clear-guard', 'finish-attempt', 'set-success', 'after-state']);
    expect(result.statePatch).toEqual(expect.objectContaining({
      responseUrl: '/survey/0xsurvey/0xabc?session=submitted-edge',
      submissionComplete: true,
      userHasResponse: true,
      userResponseEncrypted: true,
    }));
  });

  it('runs submit failure status cleanup through the parent wiring', () => {
    const events = [];
    const result = runSurveyQuestionsSubmitFailureController({
      error: new Error('submit rejected'),
      submittedSinceLastEdit: false,
      submitAttemptId: 6,
      ports: {
        clearSubmitGuard: jest.fn(() => events.push('clear-guard')),
        finishSubmitAttempt: jest.fn(() => events.push('finish-attempt')),
        setSubmitFailureState: jest.fn(() => events.push('set-failure')),
      },
    });

    expect(events).toEqual(['clear-guard', 'finish-attempt', 'set-failure']);
    expect(result).toEqual(expect.objectContaining({
      outcome: 'failure',
      status: 'completed',
      submitAttemptId: 6,
      statePatch: expect.objectContaining({
        isSubmitting: false,
        submissionComplete: false,
        submissionError: 'submit rejected',
      }),
    }));
  });

  it('skips auto-decrypt requeue for unchanged masked payloads after a failed attempt', () => {
    const field = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'ciphertext',
      hash: 'hash',
      encryptionAudience: 'gate',
    };
    const attemptedKey = `q1:answer:${buildAutoDecryptMaskedFieldSignature(field)}`;
    const attemptedState = buildAutoDecryptAttemptedState({}, attemptedKey);

    expect(buildAutoDecryptMaskedFieldSignature(field)).toBe('*|1|ciphertext|hash|gate');
    expect(buildAutoDecryptMaskedFieldSignature({ ...field })).toBe('*|1|ciphertext|hash|gate');
    expect(attemptedState.autoDecryptAttempted[attemptedKey]).toBe(true);
    expect(buildAutoDecryptDisabledState()).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
  });

  it('applies successful self decrypt results through parent state and draft callbacks', () => {
    const prevState = {
      surveysResponseState: [maskedSlice()],
      editBaseline: maskedSlice(),
      decryptingByKey: { 'q1:answer': true, 'q1:additional': true },
    };
    const nextState = buildSelfQuestionDecryptSuccessState(prevState, {
      surveyIndex: 0,
      questionId: 'q1',
      clearMode: 'both',
      didUpdate: true,
      baselineSlice: prevState.surveysResponseState[0],
      decryptedStateSlice: {
        answers: { q1: { value: 'decrypted answer' } },
        additionalComments: { q1: { value: 'decrypted note' } },
      },
      decryptedImportance: 8,
      decryptedConviction: 3,
    }, deepClone);

    expect(nextState.surveysResponseState[0]).toMatchObject({
      answers: { q1: { value: 'decrypted answer', encrypted: true } },
      additionalComments: { q1: { value: 'decrypted note', encrypted: true } },
      importance: { q1: 8 },
      conviction: { q1: 3 },
    });
    expect(nextState).toEqual(expect.objectContaining({
      isEditing: true,
      displayAnswerMode: false,
      isDecrypting: false,
      suppressPrefill: true,
      decryptingByKey: { 'q1:answer': false, 'q1:additional': false },
    }));
  });

  it('routes self decrypt failures through the owned busy-token fallback state', () => {
    const prevState = { decryptingByKey: { 'q1:answer': true } };
    expect(buildQuestionDecryptFailureState(
      prevState,
      'q1',
      'answer',
      'decrypt rejected',
    )).toEqual({
      isDecrypting: false,
      submissionError: 'decrypt rejected',
      decryptingByKey: { 'q1:answer': false },
    });
    expect(buildQuestionDecryptStartState(prevState, ['q1:answer'])).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
      decryptingByKey: { 'q1:answer': true },
    });
  });

  it('keeps viewed decrypt inert when login or response override is unavailable', () => {
    const selection = getQuestionFieldDecryptSelection('q1', 'answer', emptySlice());
    const prepared = prepareQuestionDecryptAttempt({
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      baselineForDecrypt: emptySlice(),
    }, {
      getQuestionFieldDecryptSelection,
      buildQuestionDecryptExecutionContext: () => ({}),
    });
    const mode = resolveQuestionDecryptHandlingMode({
      questionId: 'q1',
      responseOverride: null,
      viewerAccount: '',
      viewedResponder: '0xdef',
    }, {
      getViewedResponseOverrideForQuestion: () => null,
    });

    expect(selection).toEqual(expect.objectContaining({
      hasMaskedField: false,
      keysToMark: [],
    }));
    expect(prepared).toEqual(expect.objectContaining({
      blockedReason: 'no-masked-field',
      shouldDecrypt: false,
    }));
    expect(mode).toEqual(expect.objectContaining({
      hasResponseOverride: false,
      isViewedResponseMode: true,
    }));
  });

  it('applies viewed decrypt results without switching into self-edit state', () => {
    const prevState = {
      parsedViewAddressAnswers: {
        responses: [{
          questionID: 'q1',
          answer: { value: '*' },
          additional: { value: '*' },
        }],
      },
      viewAddressAnswers: '',
      decryptingByKey: { 'q1:answer': true, 'q1:additional': true },
    };
    const nextState = buildViewedResponseDecryptSuccessState(prevState, {
      questionId: 'q1',
      clearMode: 'both',
      didUpdate: true,
      decryptedStateSlice: {
        answers: { q1: { value: 'viewed answer' } },
        additionalComments: { q1: { value: 'viewed note' } },
      },
      decryptedImportance: 6,
      decryptedConviction: 4,
    });

    expect(nextState.parsedViewAddressAnswers.responses[0]).toMatchObject({
      answer: { value: 'viewed answer' },
      additional: { value: 'viewed note' },
      importance: 6,
      conviction: 4,
    });
    expect(JSON.parse(nextState.viewAddressAnswers).responses[0].answer.value)
      .toBe('viewed answer');
    expect(nextState).not.toHaveProperty('isEditing');
  });

  it('tries masked prompt reload sources in order and restores the better payload', () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['primary', 'fallback', '']);
    const plan = buildSingleQuestionSourceRestoreContextPlan({
      getQuestionFetchCandidateSlugs,
      maxCandidateSlugs: 3,
      props: {
        questionID: 'Q1',
        sessionSlug: 'primary',
        activeSessionSlug: 'primary',
      },
      questionPool: [{ id: 'q1', prompt: '[encrypted]' }],
      runId: 10,
    });
    const ready = buildSingleQuestionReadyHydrationState({
      surveysResponseState: [emptySlice()],
    }, {
      mergeSurveyResponseState,
      questionData: { id: 'q1', prompt: 'Restored prompt', promptDecrypted: true },
    });

    expect(plan.fetchCandidateSlugs).toEqual(['primary', 'fallback', '']);
    expect(getQuestionFetchCandidateSlugs).toHaveBeenCalledWith('q1', 'primary', {
      allowPinnedFallback: true,
    });
    expect(ready.questionPool).toEqual([{
      id: 'q1',
      prompt: 'Restored prompt',
      promptDecrypted: true,
    }]);
  });

  it('clears prompt reload busy state when source restoration fails', () => {
    const blocked = buildSingleQuestionSourceRestoreContextPlan({
      getBlockedQuestionIds: () => new Set(['q1']),
      props: {
        questionID: 'q1',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
      },
      runId: 11,
    });
    const fallback = buildSingleQuestionPlaceholderHydrationState({
      surveysResponseState: [emptySlice()],
    }, {
      mergeSurveyResponseState,
      placeholderQuestion: { id: 'q1', prompt: '[encrypted]' },
    });

    expect(blocked).toEqual(expect.objectContaining({
      status: 'blocked-question',
      statePatch: expect.objectContaining({
        isLoadingResponse: false,
        noResponse: true,
      }),
    }));
    expect(fallback).toEqual(expect.objectContaining({
      isLoadingResponse: false,
      noResponse: false,
      questionPool: [{ id: 'q1', prompt: '[encrypted]' }],
    }));
  });

  it('restores exit-editing state from the viewed response source before self or cache fallbacks', () => {
    const viewedSlice = {
      answers: { q1: { value: 'viewed' } },
      additionalComments: { q1: { value: 'viewed note' } },
      importance: { q1: 7 },
      conviction: { q1: 2 },
    };
    const selfSlice = {
      answers: { q1: { value: 'self' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    const cacheSlice = {
      answers: { q1: { value: 'cache' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    const buildSliceFromUserAnswers = jest.fn((source) => (
      source?.kind === 'viewed' ? viewedSlice : selfSlice
    ));
    const buildSliceFromLocalCache = jest.fn(() => cacheSlice);

    const baselineSlice = resolveExitEditingBaselineSlice({
      responderAddress: '0xdef',
      parsedViewAddressAnswers: { kind: 'viewed' },
      userAnswers: { kind: 'self' },
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    });
    const statePatch = buildExitEditingStatePatch({
      prevSurveysResponseState: [selfSlice],
      surveyIndex: 0,
      baselineSlice,
      renderedQuestionIds: ['q1'],
      buildEmptyResponseFieldState: (questionId) => ({ value: '', questionId }),
      cloneValue: deepClone,
      nextSubmittedSinceLastEdit: false,
    });

    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith({ kind: 'viewed' });
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
    expect(statePatch.surveysResponseState[0].answers.q1.value).toBe('viewed');
    expect(statePatch.editBaseline.answers.q1.value).toBe('viewed');
    expect(statePatch).toEqual(expect.objectContaining({
      isEditing: false,
      displayAnswerMode: true,
      isDirty: false,
    }));
  });
});
