import { executeSurveyLocalCacheRehydrate, executeSurveyPriorResponseBackfill } from './surveyToolHydrationController';
import {
  areEnvelopesEquivalent,
  buildDraftAnswersByQuestionId,
  buildDraftAwareCacheHydrationState,
  buildLocalCacheRehydrationUpdatePlan,
  loadLocalCacheHydrationSlice,
  mergeQuestionResponses,
} from './surveyToolUtils.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const applyStateUpdate = (stateRef, update, callback) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  if (patch && typeof patch === 'object') {
    stateRef.current = { ...stateRef.current, ...patch };
  }
  if (typeof callback === 'function') callback();
  return patch;
};

const applyLocalCacheHydrationEntryToSlice = ({
  targetSlice = null,
  questionId = '',
  cachedAnswer = null,
  cachedAdditional = null,
  cachedImportance = undefined,
  cachedConviction = undefined,
  allowMaskedAnswerDraftEmpty = false,
  allowMaskedAdditionalDraftEmpty = false,
} = {}) => {
  if (!targetSlice || !questionId) return false;
  let changed = false;

  if (
    cachedAnswer &&
    (allowMaskedAnswerDraftEmpty ||
      targetSlice.answers?.[questionId]?.value === undefined ||
      (targetSlice.answers?.[questionId]?.value === '' && !targetSlice.answers?.[questionId]?.encryptedPortion))
  ) {
    targetSlice.answers[questionId] = {
      ...(targetSlice.answers[questionId] || {}),
      ...cachedAnswer,
    };
    changed = true;
  }

  if (
    cachedAdditional &&
    (allowMaskedAdditionalDraftEmpty ||
      targetSlice.additionalComments?.[questionId]?.value === undefined ||
      (targetSlice.additionalComments?.[questionId]?.value === '' &&
        !targetSlice.additionalComments?.[questionId]?.encryptedPortion))
  ) {
    targetSlice.additionalComments[questionId] = {
      ...(targetSlice.additionalComments[questionId] || {}),
      ...cachedAdditional,
    };
    changed = true;
  }

  if (
    cachedImportance !== undefined &&
    cachedImportance !== null &&
    !Object.prototype.hasOwnProperty.call(targetSlice.importance || {}, questionId)
  ) {
    targetSlice.importance[questionId] = Number(cachedImportance);
    changed = true;
  }

  if (
    cachedConviction !== undefined &&
    cachedConviction !== null &&
    !Object.prototype.hasOwnProperty.call(targetSlice.conviction || {}, questionId)
  ) {
    targetSlice.conviction[questionId] = Number(cachedConviction);
    changed = true;
  }

  return changed;
};

const runLocalCacheRehydrate = async ({
  stateRef,
  cacheSlice,
  signature = 'rehydrate|q1',
  draft = null,
  loadDraft = () => draft,
  ensurePriorResponses = jest.fn(),
  callback = null,
  onError = jest.fn(),
  buildSliceFromLocalCache = async () => cacheSlice,
} = {}) => {
  const setState = jest.fn((update, cb) => applyStateUpdate(stateRef, update, cb));
  const updateJsonPreview = jest.fn();
  const recalculateEditStats = jest.fn();
  const setLastHydrationSig = jest.fn((value) => {
    stateRef.current._rehydrateLocalCacheLastSig = value;
  });

  const result = await executeSurveyLocalCacheRehydrate({
    props: {
      isStandalone: false,
      singleQuestionMode: false,
      surveyIndex: 0,
    },
    state: stateRef.current,
    lastHydrationSig: stateRef.current._rehydrateLocalCacheLastSig || '',
    getHydrationQuestionIds: () => ['q1'],
    buildHydrationSignature: () => signature,
    buildSliceFromLocalCache,
    setLastHydrationSig,
    loadDraft,
    buildDraftAnswersByQuestionId,
    cloneBaseline: clone,
    buildDraftAwareCacheHydrationState: (args) =>
      buildDraftAwareCacheHydrationState({
        ...args,
        areEnvelopesEquivalent,
      }),
    applyLocalCacheHydrationEntryToSlice,
    setState,
    updateJsonPreview,
    recalculateEditStats,
    ensurePriorResponses,
    callback,
    onError,
  });

  return {
    result,
    setState,
    setLastHydrationSig,
    updateJsonPreview,
    recalculateEditStats,
    ensurePriorResponses,
    callback,
    onError,
  };
};

const createBaseStateRef = (
  slice = {
    answers: {},
    importance: {},
    conviction: {},
    additionalComments: {},
  },
) => ({
  current: {
    suppressPrefill: false,
    submissionError: '',
    submissionComplete: false,
    surveysResponseState: [clone(slice)],
    editBaseline: clone(slice),
    _rehydrateLocalCacheLastSig: '',
  },
});

describe('SurveyTool local-cache response rehydrate', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('invalidates local-cache rehydrate memo before post-backfill rehydrate', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    const cacheRefs = {
      localCacheSliceMemo: { key: 'stale', value: null, hasValue: true },
      rehydrateLocalCacheLastSig: 'stale|sig',
    };

    await expect(
      executeSurveyPriorResponseBackfill({
        props: {
          account: '0xabc',
          loginComplete: true,
          displayAnswerMode: false,
          viewAddress: '',
          singleQuestionMode: false,
          responderAddress: '',
          refreshQuestionResponses,
        },
        state: {
          submissionComplete: false,
          isSubmitting: false,
        },
        attemptedSet: new Set(),
        getMissingRenderedResponseIdsForAccount: jest.fn().mockResolvedValue({
          missingIds: ['q1'],
          slug: 'edge',
          netId: '84532',
        }),
        setHydratingState: jest.fn(),
        isMounted: true,
        readQuestionsCacheAsync: jest.fn().mockResolvedValue(undefined),
        resetLocalCacheMemo: () => {
          cacheRefs.localCacheSliceMemo = { key: '', value: null, hasValue: false };
          cacheRefs.rehydrateLocalCacheLastSig = '';
        },
        triggerRehydrate: rehydrateLocalCacheAnswersForRenderedIds,
      }),
    ).resolves.toBe(true);

    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(cacheRefs.localCacheSliceMemo).toEqual({ key: '', value: null, hasValue: false });
    expect(cacheRefs.rehydrateLocalCacheLastSig).toBe('');
    expect(rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('does not skip targeted prior-response backfill while pile mode is active', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const getMissingRenderedResponseIdsForAccount = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });

    const fetched = await executeSurveyPriorResponseBackfill({
      props: {
        minifiedMode: 'pile',
        account: '0xabc',
        loginComplete: true,
        displayAnswerMode: false,
        viewAddress: '',
        singleQuestionMode: false,
        responderAddress: '',
        refreshQuestionResponses,
      },
      state: {
        submissionComplete: false,
        isSubmitting: false,
      },
      attemptedSet: new Set(),
      getMissingRenderedResponseIdsForAccount,
      setHydratingState: jest.fn(),
      isMounted: false,
      readQuestionsCacheAsync: jest.fn().mockResolvedValue(undefined),
    });

    expect(fetched).toBe(true);
    expect(getMissingRenderedResponseIdsForAccount).toHaveBeenCalled();
    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
  });

  it('groups pile prior-response backfill by question session slug under list scope', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const rehydrateLocalCacheAnswersForRenderedIds = jest.fn();

    const fetched = await executeSurveyPriorResponseBackfill({
      props: {
        minifiedMode: 'pile',
        account: '0xabc',
        loginComplete: true,
        displayAnswerMode: false,
        viewAddress: '',
        singleQuestionMode: false,
        responderAddress: '',
        refreshQuestionResponses,
      },
      state: {
        submissionComplete: false,
        isSubmitting: false,
      },
      attemptedSet: new Set(),
      getMissingRenderedResponseIdsForAccount: jest.fn().mockResolvedValue({
        requests: [
          { slug: 'alpha', missingIds: ['q1'] },
          { slug: 'beta', missingIds: ['q2'] },
        ],
      }),
      setHydratingState: jest.fn(),
      isMounted: true,
      readQuestionsCacheAsync: jest.fn().mockResolvedValue(undefined),
      resetLocalCacheMemo: jest.fn(),
      triggerRehydrate: rehydrateLocalCacheAnswersForRenderedIds,
    });

    expect(fetched).toBe(true);
    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(1, ['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(2, ['q2'], {
      slug: 'beta',
      responder: '0xabc',
    });
    expect(rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate local-cache responses for unresolved draft slugs without a resolved network id', () => {
    const readQuestionsCache = jest.fn();

    expect(
      loadLocalCacheHydrationSlice({
        scopeSlugs: ['missing-session-slug'],
        networkIdStr: '',
        account: '0xabc',
        renderedQuestionIds: ['q1'],
        readQuestionsCache,
        mergeQuestionResponses,
        parseResponse: (raw) => raw,
        applyCachedResponseEntryToSlice: jest.fn(),
      }),
    ).toBeNull();

    expect(readQuestionsCache).not.toHaveBeenCalled();
  });

  it('builds local-cache slices through the shared cache hydration helper', () => {
    const readQuestionsCache = jest.fn(() => ({
      84532: {
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
    }));
    const applyCachedResponseEntryToSlice = jest.fn(({ targetSlice, questionId, response }) => {
      targetSlice.answers[questionId] = {
        value: response.answer.encrypted ? '*' : response.answer.value,
        encrypted: !!response.answer.encrypted,
        encryptionAudience: response.answer.encryptionAudience || 'self',
        encryptionGateId: `${questionId}:answer`,
        audienceMode: response.answer.audienceMode || 'explicit',
        hash: response.answer.hash || '',
        encryptedPortion: response.answer.encryptedPortion || '',
      };
      targetSlice.additionalComments[questionId] = {
        value: response.additional.encrypted ? '*' : response.additional.value,
        encrypted: !!response.additional.encrypted,
        encryptionAudience: response.additional.encryptionAudience || 'self',
        encryptionGateId: `${questionId}:answer`,
        audienceMode: response.additional.audienceMode || 'explicit',
        hash: response.additional.hash || '',
        encryptedPortion: response.additional.encryptedPortion || '',
        inheritedFromAnswer: response.answer.encryptedPortion || null,
      };
      targetSlice.importance[questionId] = response.importance;
      targetSlice.conviction[questionId] = response.conviction;
      return true;
    });

    const slice = loadLocalCacheHydrationSlice({
      scopeSlugs: ['edge'],
      networkIdStr: '84532',
      account: '0xabc',
      renderedQuestionIds: ['q1'],
      readQuestionsCache,
      mergeQuestionResponses,
      parseResponse: (raw) => raw,
      applyCachedResponseEntryToSlice,
    });

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
    const stateRef = createBaseStateRef();
    const ensurePriorResponses = jest.fn();

    await runLocalCacheRehydrate({
      stateRef,
      cacheSlice: null,
      signature: 'stable|sig',
      ensurePriorResponses,
    });
    await runLocalCacheRehydrate({
      stateRef,
      cacheSlice: null,
      signature: 'stable|sig',
      ensurePriorResponses,
    });

    expect(ensurePriorResponses).toHaveBeenCalledTimes(2);
    expect(stateRef.current._rehydrateLocalCacheLastSig).toBe('');
  });

  it('does not remask decrypted empty additional comments during local-cache rehydrate', async () => {
    const stateRef = createBaseStateRef({
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
    });

    await runLocalCacheRehydrate({
      stateRef,
      signature: 'rehydrate|q1',
      cacheSlice: {
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
    });

    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(stateRef.current.editBaseline?.additionalComments?.q1?.value).toBe('');
  });

  it('replaces masked additional value with draft decrypted-empty value when envelope matches', async () => {
    const stateRef = createBaseStateRef({
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

    await runLocalCacheRehydrate({
      stateRef,
      signature: 'rehydrate|q1|masked',
      draft: {
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
      },
      cacheSlice: {
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
    });

    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
    expect(stateRef.current.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(stateRef.current.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
  });

  it('replaces masked additional value when both draft/cache envelopes are missing but encrypted is true', async () => {
    const stateRef = createBaseStateRef({
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

    await runLocalCacheRehydrate({
      stateRef,
      signature: 'rehydrate|q1|masked-empty-env',
      draft: {
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
      },
      cacheSlice: {
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
    });

    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('');
    expect(stateRef.current.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(stateRef.current.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('');
  });

  it('rehydrates local-cache answers when draft loading throws', async () => {
    const stateRef = createBaseStateRef();
    const ensurePriorResponses = jest.fn();
    const onError = jest.fn();

    await runLocalCacheRehydrate({
      stateRef,
      signature: 'rehydrate|q1|draft-throw',
      loadDraft: () => {
        throw new Error('draft-load-failed');
      },
      onError,
      ensurePriorResponses,
      cacheSlice: {
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
      },
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(stateRef.current.surveysResponseState?.[0]).toEqual({
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
    expect(stateRef.current.editBaseline).toEqual({
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
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
  });

  it('skips setState for local-cache rehydrate when cache data matches current and baseline state', async () => {
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
    const stateRef = createBaseStateRef(matchingSlice);
    const callback = jest.fn();
    const ensurePriorResponses = jest.fn();

    const setState = jest.fn((update, cb) => applyStateUpdate(stateRef, update, cb));
    const setLastHydrationSig = jest.fn((value) => {
      stateRef.current._rehydrateLocalCacheLastSig = value;
    });

    await expect(
      executeSurveyLocalCacheRehydrate({
        props: {
          isStandalone: false,
          singleQuestionMode: false,
          surveyIndex: 0,
        },
        state: stateRef.current,
        lastHydrationSig: '',
        getHydrationQuestionIds: () => ['q1'],
        buildHydrationSignature: () => 'rehydrate|q1|unchanged',
        buildSliceFromLocalCache: () => clone(matchingSlice),
        setLastHydrationSig,
        loadDraft: () => null,
        buildDraftAnswersByQuestionId,
        cloneBaseline: clone,
        buildDraftAwareCacheHydrationState: (args) =>
          buildDraftAwareCacheHydrationState({
            ...args,
            areEnvelopesEquivalent,
          }),
        applyLocalCacheHydrationEntryToSlice,
        setState,
        ensurePriorResponses,
        callback,
        buildRehydrationUpdatePlan: (args) =>
          buildLocalCacheRehydrationUpdatePlan({
            ...args,
            debugLabel: '[Survey][rehydrateLocal]',
          }),
      }),
    ).resolves.toEqual({
      reason: 'no-change',
      applied: false,
      renderedQuestionIds: ['q1'],
      hydrationSig: 'rehydrate|q1|unchanged',
    });

    expect(setState).not.toHaveBeenCalled();
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(stateRef.current._rehydrateLocalCacheLastSig).toBe('rehydrate|q1|unchanged');
  });
});
