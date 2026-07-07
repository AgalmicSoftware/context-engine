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
    expect(subject._rehydrateLocalCacheLastSig).toBe('rehydrate|q1|unchanged');
  });
});
