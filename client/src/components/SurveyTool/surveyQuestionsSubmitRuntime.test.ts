import { createSurveyQuestionsSubmitRuntime } from './surveyQuestionsSubmitRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const makeWorkerConfig = (workerOrigin: string, sessionId: string) => ({
  slug: 'draft-edge',
  sessionId,
  corsWorkerUrl: workerOrigin,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
    },
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      mode: 'authorized_read',
    },
  },
});

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildCurrentStepState: jest.fn((step) => ({ currentStep: step })),
  buildFieldEncryptionWorkGroupsCore: jest.fn(() => ({
    groups: [],
    missingRecipients: [],
  })),
  buildSubmissionErrorState: jest.fn((message = '') => ({ submissionError: message })),
  buildSurveysResponseStatePatch: jest.fn((surveysResponseState) => ({ surveysResponseState })),
  canUpdateStateForAsyncSnapshot: jest.fn(() => true),
  clearDraft: jest.fn(),
  clearDraftFor: jest.fn(),
  cryptoUtils: {
    encryptMultipleAnswers: jest.fn(async () => ({
      additionalComments: {
        q1: { encrypted: true, value: 'encrypted-additional' },
      },
      answers: {
        q1: { encrypted: true, value: 'encrypted-answer' },
      },
    })),
    getProviderKind: jest.fn(() => 'injected'),
  },
  deepClone: jest.fn((value) => JSON.parse(JSON.stringify(value))),
  ethers: {
    constants: {
      HashZero: '0x0',
    },
  },
  getAnsweredQuestionsCount: jest.fn(() => 1),
  getChangedQidsAndFields: jest.fn(() => ({ changedQids: new Set(['q1']) })),
  getEffectiveRecipientsForField: jest.fn(() => []),
  getPendingEditStats: jest.fn(() => ({ encrypted: 0, total: 1 })),
  inst: {
    _activeSubmitAttemptSeq: 0,
    _emptySubmitTimer: null,
    _getEffectiveDraftSlug: jest.fn(() => 'draft-edge'),
    _isMounted: true,
    _persistTimer: null,
    _submitAttemptSeq: 0,
    _submitGuard: true,
    _userAnswersSliceCache: { source: 'old', value: {} },
  },
  invalidateDiffCaches: jest.fn(),
  isQuestionLockedForResponse: jest.fn(() => false),
  maybeBlockSubmitUntilQuestionPoolComplete: jest.fn(() => false),
  normalizeQuestionIdKey: jest.fn((value) => String(value || '').toLowerCase()),
  normalizeSessionSlugValue: jest.fn((value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
  prepareJsonAndHash: jest.fn(() => ({ answers: { q1: 'Yes' } })),
  propsRef: {
    current: {
      account: '0xabc',
      isStandalone: false,
      lit: {
        connectTimeout: 1000,
        getKey: jest.fn(),
        litNetwork: 'datil-dev',
        resourceAbilityRequests: [{ resource: 'resource' }],
        saveKey: jest.fn(),
      },
      loginComplete: true,
      network: { chainId: 11155420 },
      provider: { id: 'provider' },
      questionID: 'q1',
      sessionConfig: null as unknown,
      singleQuestionMode: false,
      surveyId: 'survey-1',
      surveyIndex: 2,
      toggleLoginModal: jest.fn(),
    },
  },
  resolveEffectiveSlug: jest.fn(() => 'route-edge'),
  resolveEffectiveResponseGateConfig: jest.fn((_slug, props) => props?.sessionConfig || {}),
  resolveFieldEncryptionAudience: jest.fn(),
  resolveFieldEncryptionGateId: jest.fn(),
  resolveSessionChainId: jest.fn(() => 11155420),
  resolveSubmitEffectiveDraftSlug: jest.fn(({ draftSlug }) => draftSlug),
  resolveSurveyQuestionsSubmittedResponseUrl: jest.fn(() => '/response/0xabc'),
  resolveSurveyQuestionsSubmitPendingStats: jest.fn(({ getPendingEditStats }) => getPendingEditStats()),
  runSurveyQuestionsStaleSubmitController: jest.fn(({ snapshot, ports }) => {
    ports.clearSubmitGuard();
    ports.canUpdateSubmitState(snapshot);
    ports.isSubmitAttemptActive(snapshot.submitAttemptId, snapshot);
    ports.finishSubmitAttempt(snapshot.submitAttemptId);
    ports.setSubmitStaleState({ isSubmitting: false });
    return { statePatch: { isSubmitting: false } };
  }),
  runSurveyQuestionsSubmitFailureController: jest.fn(),
  runSurveyQuestionsSubmitStartController: jest.fn(({ ports }) => {
    const submitAttemptId = ports.startSubmitAttempt();
    ports.setSubmitStartState({ isSubmitting: true });
    return { statePatch: { isSubmitting: true }, submitAttemptId };
  }),
  runSurveyQuestionsSubmitSuccessController: jest.fn(),
  setState: jest.fn(),
  stateRef: {
    current: {
      hasEncryptedChanges: false,
      hasher: { id: 'hasher' },
      modifiedCount: 1,
      pileQuestions: [],
      questionPool: [{ id: 'q1' }],
      submittedSinceLastEdit: false,
      surveysResponseState: [
        { answers: {} },
        { answers: {} },
        {
          additionalComments: {},
          answers: {
            q1: { value: 'Yes' },
          },
          conviction: {},
          importance: {},
        },
      ],
    },
  },
  submitSurveyResponse: jest.fn(async () => ({
    __ceQuestionResponses: [],
    __ceSubmissionGroupKey: 'draft-edge',
    __ceSurveyId: 'survey-1',
    __ceSurveyResponse: {},
    blockNumber: 10,
  })),
  surveyLog: {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
  verifyEncryption: jest.fn(async () => true),
  writeSubmittedResponsesToLocalCaches: jest.fn(async () => ({
    questionCacheWritten: true,
    surveyCacheWritten: true,
  })),
  ...overrides,
});

describe('surveyQuestionsSubmitRuntime', () => {
  it('builds Lit encryption options from recipient gates and current hooks', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsSubmitRuntime(context);
    const recipient = {
      accessControlConditions: [{ contractAddress: '0x1' }],
      chain: 'optimismSepolia',
    };

    expect(runtime.buildLitEncryptionOptionsForRecipients([recipient])).toEqual(
      expect.objectContaining({
        accessControlConditions: recipient.accessControlConditions,
        chain: 'optimismSepolia',
        connectTimeout: 1000,
        litNetwork: 'datil-dev',
        providerLike: context.propsRef.current.provider,
        recipients: [recipient],
        resourceAbilityRequests: [{ resource: 'resource' }],
      }),
    );
  });

  it('builds stable submit context keys and owns active attempt cleanup', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsSubmitRuntime(context);

    const snapshot = runtime.buildSubmitContextSnapshot();
    const key = runtime.buildSubmitContextKey(snapshot);
    const attemptId = runtime.startSubmitAttempt();

    expect(snapshot).toEqual(
      expect.objectContaining({
        account: '0xabc',
        chainId: 11155420,
        effectiveDraftSlug: 'draft-edge',
        providerKind: 'injected',
        surveyIndex: 2,
      }),
    );
    expect(key).toContain('0xabc|injected|draft-edge|11155420|survey|2|survey-1|q1');
    expect(attemptId).toBe(1);
    expect(context.inst._activeSubmitAttemptSeq).toBe(1);

    runtime.finishSubmitAttempt(99);
    expect(context.inst._activeSubmitAttemptSeq).toBe(1);
    runtime.finishSubmitAttempt(1);
    expect(context.inst._activeSubmitAttemptSeq).toBe(0);
  });

  it('invalidates a submit snapshot when the same slug switches Worker identity', () => {
    const configA = makeWorkerConfig('https://a.example.com', '0x00112233445566778899aabbccddeeff');
    const configB = makeWorkerConfig('https://b.example.com', '0xffeeddccbbaa99887766554433221100');
    const context = createContext();
    context.propsRef.current.sessionConfig = configA;
    context.resolveSessionChainId.mockReturnValue(null as unknown as number);
    const runtime = createSurveyQuestionsSubmitRuntime(context);
    const snapshotA = runtime.buildSubmitContextSnapshot();

    context.propsRef.current = {
      ...context.propsRef.current,
      sessionConfig: configB,
    };
    const snapshotB = runtime.buildSubmitContextSnapshot();

    expect(snapshotA.workerTargetValid).toBe(true);
    expect(snapshotA.workerTargetKey).not.toBe(snapshotB.workerTargetKey);
    expect(runtime.isSubmitContextCurrent(snapshotA)).toBe(false);
  });

  it('runs stale submit cleanup through the submit controller ports', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsSubmitRuntime(context);
    context.inst._activeSubmitAttemptSeq = 3;

    runtime.handleStaleSubmitContext({ mounted: true, submitAttemptId: 3 });

    expect(context.inst._submitGuard).toBe(false);
    expect(context.runSurveyQuestionsStaleSubmitController).toHaveBeenCalled();
    expect(context.setState).toHaveBeenCalledWith({ isSubmitting: false });
    expect(context.inst._activeSubmitAttemptSeq).toBe(0);
  });

  it('encrypts field work groups with Lit recipients when gated', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsSubmitRuntime(context);
    const workGroups = [
      {
        qids: ['q1'],
        recipients: [
          {
            accessControlConditions: [{ contractAddress: '0x1' }],
            chain: 'optimismSepolia',
          },
        ],
        slice: {
          additionalComments: {
            q1: { value: 'note' },
          },
          answers: {
            q1: { value: 'Yes' },
          },
        },
      },
    ];

    await expect(runtime.encryptFieldWorkGroups({ workGroups, baseOpts: { chainId: 11155420 } })).resolves.toEqual({
      additionalComments: {
        q1: { encrypted: true, value: 'encrypted-additional' },
      },
      answers: {
        q1: { encrypted: true, value: 'encrypted-answer' },
      },
    });
    expect(context.cryptoUtils.encryptMultipleAnswers).toHaveBeenCalledWith(
      workGroups[0].slice,
      expect.objectContaining({
        chainId: 11155420,
        lit: expect.objectContaining({
          chain: 'optimismSepolia',
        }),
        onlyTheseQids: ['q1'],
      }),
    );
  });

  it('clears the submit guard and opens login instead of submitting when unauthenticated', async () => {
    const context = createContext({
      propsRef: {
        current: {
          ...createContext().propsRef.current,
          loginComplete: false,
        },
      },
    });
    const runtime = createSurveyQuestionsSubmitRuntime(context);

    await runtime.encryptAndUpload();

    expect(context.inst._submitGuard).toBe(false);
    expect(context.propsRef.current.toggleLoginModal).toHaveBeenCalledWith(true);
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
  });
});
