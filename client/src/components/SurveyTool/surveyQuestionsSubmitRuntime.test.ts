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

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}): SurveyQuestionsLegacyRecord => ({
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
  getChangedQidsAndFields: jest.fn(() => ({ changedQids: new Set(['q1']), changedMap: { q1: { answer: 1 } } })),
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
  resolveDiffBaselineSlice: jest.fn(() => ({ answers: {}, additionalComments: {}, importance: {}, conviction: {} })),
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
    __ceQuestionResponses: [{ questionID: 'q1' }],
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

  it('passes a pre-encryption prediction comparison snapshot into submission', async () => {
    const context = createContext();
    context.getPendingEditStats.mockReturnValue({ encrypted: 1, total: 1 });
    context.buildFieldEncryptionWorkGroupsCore.mockReturnValue({
      groups: [{ qids: ['q1'], recipients: [], slice: { answers: { q1: { value: 'Final answer' } } } }],
      missingRecipients: [],
    });
    context.stateRef.current.surveysResponseState[2] = {
      additionalComments: { q1: { value: 'Final note', encrypted: true } },
      answers: { q1: { value: 'Final answer', encrypted: true } },
      conviction: {},
      importance: {},
      interviewProvenance: {
        q1: {
          includePredictionComparison: true,
          originalPrediction: { answer: 'Original answer' },
        },
      },
    };

    const runtime = createSurveyQuestionsSubmitRuntime(context);
    await expect(runtime.encryptAndUpload()).resolves.toEqual({ status: 'submitted' });

    expect(context.cryptoUtils.encryptMultipleAnswers).toHaveBeenCalled();
    expect(context.submitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: { q1: { encrypted: true, value: 'encrypted-answer' } },
        interviewProvenance: {
          q1: expect.objectContaining({
            submissionValueSnapshot: {
              answer: 'Final answer',
              additionalComments: 'Final note',
            },
          }),
        },
      }),
      expect.any(Set),
      expect.any(Object),
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

    await expect(runtime.encryptAndUpload()).resolves.toEqual({ status: 'login-required' });

    expect(context.inst._submitGuard).toBe(false);
    expect(context.propsRef.current.toggleLoginModal).toHaveBeenCalledWith(true);
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
  });

  it('returns a failed outcome instead of reporting success when there is nothing to submit', async () => {
    const context = createContext({
      getAnsweredQuestionsCount: jest.fn(() => 0),
    });
    const runtime = createSurveyQuestionsSubmitRuntime(context);

    await expect(runtime.encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message: 'No responses to submit.',
    });

    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
    expect(context.setState).toHaveBeenCalledWith({ submissionError: 'No responses to submit.' });
    clearTimeout(context.inst._emptySubmitTimer);
    context.inst._emptySubmitTimer = null;
  });
});

describe('quadratic submission boundary', () => {
  it.each([[8, -6], [1.5, 0], ['3', -4], [1]])(
    'rejects invalid allocation %j before encryption or upload',
    async (...values) => {
      const context = createContext();
      context.stateRef.current.questionPool = [
        { id: 'q1', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 99 },
      ];
      context.stateRef.current.surveysResponseState[2].answers.q1.value = values;
      await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
      expect(context.submitSurveyResponse).not.toHaveBeenCalled();
      expect(context.cryptoUtils.encryptMultipleAnswers).not.toHaveBeenCalled();
      expect(context.runSurveyQuestionsSubmitFailureController).toHaveBeenCalled();
    },
  );

  it.each(['cloudflare', 'smart-contracts'])('submits valid quadratic answers unchanged in %s mode', async (mode) => {
    const context = createContext();
    context.propsRef.current.sessionConfig =
      mode === 'cloudflare' ? makeWorkerConfig('https://worker.example', 'fixture') : {};
    context.stateRef.current.questionPool = [
      { id: 'q1', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 },
    ];
    context.stateRef.current.surveysResponseState[2].answers.q1.value = [3, -4];
    await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    expect(context.submitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { q1: { value: [3, -4] } } }),
      expect.any(Set),
      expect.any(Object),
    );
    expect(context.runSurveyQuestionsSubmitFailureController).not.toHaveBeenCalled();
  });

  it('validates a quadratic answer whose pool id differs in case from the edited key', async () => {
    const context = createContext();
    context.stateRef.current.questionPool = [
      { id: 'Q1', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 99 },
    ];
    context.stateRef.current.surveysResponseState[2].answers.q1.value = [8, -6];
    await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
    expect(context.runSurveyQuestionsSubmitFailureController).toHaveBeenCalled();
  });

  it('allows a comment-only edit while the existing allocation remains encrypted', async () => {
    const context = createContext();
    context.stateRef.current.questionPool = [{ id: 'q1', type: 'quadratic', options: ['Parks', 'Transit'] }];
    context.stateRef.current.surveysResponseState[2].answers.q1 = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'existing-envelope',
    };
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q1']),
      changedMap: { q1: { additional: 1 } },
    });
    await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    expect(context.submitSurveyResponse).toHaveBeenCalled();
  });
});

it('ranks submitted consent using the Worker receipt instead of the browser clock', async () => {
  const context = createContext();
  context.prepareJsonAndHash.mockReturnValue({
    timeStamp: 9999999999,
    responses: [{ questionID: 'q1', responderName: 'Participant' }],
  });
  context.submitSurveyResponse.mockResolvedValue({
    __ceQuestionResponses: [{ questionID: 'q1' }],
    questionResponseRefs: [
      { questionId: 'q1', storageRef: { id: 'server-ref', createdAt: '2026-10-02T10:00:00.000Z' } },
    ],
  });
  await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
  const { editBaseline } = context.runSurveyQuestionsSubmitSuccessController.mock.calls[0][0];
  expect(editBaseline.interviewProvenance.q1).toMatchObject({
    consentSavedAt: Date.parse('2026-10-02T10:00:00.000Z'),
    consentStorageRefId: 'server-ref',
  });
});

it('marks only the uploaded questions saved and keeps other changes drafted', async () => {
  const context = createContext();
  context.getChangedQidsAndFields.mockReturnValue({
    changedQids: new Set(['q1', 'q2']),
    changedMap: { q1: { answer: 1 }, q2: { answer: 1 } },
  });
  context.resolveDiffBaselineSlice.mockReturnValue({
    answers: { q1: { value: 'Old' }, q2: { value: 'Saved' } },
    additionalComments: {},
    importance: {},
    conviction: {},
  });
  context.stateRef.current.surveysResponseState[2] = {
    answers: { q1: { value: 'Yes' }, q2: { value: '' } },
    additionalComments: {},
    importance: {},
    conviction: {},
  };

  await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
    status: 'submitted',
  });

  expect(context.clearDraftFor.mock.calls).toEqual([['q1']]);
  const { editBaseline } = context.runSurveyQuestionsSubmitSuccessController.mock.calls[0][0];
  expect(editBaseline.answers).toEqual({ q1: { value: 'Yes' }, q2: { value: 'Saved' } });
});

describe('answer size budget', () => {
  const KIB = 1024;
  const half = 49_152 / 2;
  // Counted as JSON strings: these fill half the locked-text budget each, quotes included.
  const fill = (bytes: number, char = 'x') => char.repeat(bytes - 2);
  const locked = (value: string) => ({ value, encrypted: true, encryptionAudience: 'self_admin' });
  const TOO_LONG = /This answer( or comment)? is too long to save\. Shorten (it|them) by about [\d,]+ characters?\./;
  const prepare = (
    mode: 'cloudflare' | 'smart-contracts',
    answer: unknown,
    comment: unknown,
    questionPool: Array<Record<string, unknown>> = [{ id: 'q1', type: 'freeform', prompt: 'Tell us more' }],
  ) => {
    const context = createContext();
    context.propsRef.current.sessionConfig =
      mode === 'cloudflare' ? makeWorkerConfig('https://worker.example', '0x00112233445566778899aabbccddeeff') : {};
    context.stateRef.current.questionPool = questionPool;
    context.stateRef.current.surveysResponseState[2] = {
      answers: { q1: typeof answer === 'string' ? { value: answer } : answer },
      additionalComments: { q1: typeof comment === 'string' ? { value: comment } : comment },
      importance: {},
      conviction: {},
    };
    return context;
  };

  it('refuses an oversized Worker answer before locking or upload, by name', async () => {
    const context = prepare('cloudflare', locked(fill(half)), locked(fill(half + 10)));
    const message =
      "“Tell us more” wasn't submitted. This answer or comment is too long to save. Shorten them by about 10 characters.";

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message,
    });
    expect(context.cryptoUtils.encryptMultipleAnswers).not.toHaveBeenCalled();
    expect(context.verifyEncryption).not.toHaveBeenCalled();
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
    expect(context.runSurveyQuestionsSubmitFailureController).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message }) }),
    );
  });

  it('keeps the plain message on a single-question page', async () => {
    const context = prepare('cloudflare', locked(fill(half)), locked(fill(half + 10)));
    context.propsRef.current.singleQuestionMode = true;
    // A single-question page keeps its answers in the first slice.
    context.stateRef.current.surveysResponseState[0] = context.stateRef.current.surveysResponseState[2];

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message: 'This answer or comment is too long to save. Shorten them by about 10 characters.',
    });
  });

  it('submits a Worker answer that exactly fills the budget', async () => {
    const context = prepare('cloudflare', locked(fill(half)), locked(fill(half)));
    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });
    expect(context.submitSurveyResponse).toHaveBeenCalled();
  });

  it('lets unlocked text use the whole stored answer', async () => {
    const context = prepare('cloudflare', fill(40 * KIB), fill(20 * KIB, 'c'));
    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });
  });

  it('leaves answers stored outside the Worker unchanged', async () => {
    const context = prepare('smart-contracts', locked(fill(half)), locked(fill(half + 10)));
    await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    expect(context.submitSurveyResponse).toHaveBeenCalled();
  });

  it('holds back only the oversized answers, names them, and submits the rest', async () => {
    const context = prepare('cloudflare', 'Yes', '', [
      { id: 'q1', type: 'freeform', prompt: 'First question' },
      { id: 'q2', type: 'freeform', prompt: 'Second question' },
    ]);
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q1', 'q2']),
      changedMap: { q1: { answer: 1 }, q2: { answer: 1 } },
    });
    const slice = context.stateRef.current.surveysResponseState[2];
    slice.answers.q2 = { value: fill(100 * KIB) };
    slice.additionalComments.q2 = { value: '' };

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });

    expect(context.submitSurveyResponse).toHaveBeenCalledWith(expect.anything(), new Set(['q1']), expect.anything());
    expect(context.inst._heldBackSubmitQids).toEqual(['q2']);
    expect(context.inst._heldBackSubmitMessage).toMatch(
      /^“Second question” wasn't submitted\. This answer is too long/,
    );
    expect(context.setState).toHaveBeenCalledWith({ submissionError: context.inst._heldBackSubmitMessage });
    // The held-back answer keeps its draft; only the uploaded one is cleared.
    expect(context.clearDraftFor.mock.calls).toEqual([['q1']]);
    context.stateRef.current.draftPersistenceError = 'Draft changes are only in memory.';
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q2']),
      changedMap: { q2: { answer: 1 } },
    });
    await context.runSurveyQuestionsSubmitSuccessController.mock.calls[0][0].afterStateApplied();
    expect(context.setState).not.toHaveBeenCalledWith({ draftPersistenceError: '' });
  });

  it('keeps a held-back answer out of the saved answers it reports', async () => {
    const context = prepare('cloudflare', 'Yes', '', [
      { id: 'q1', type: 'freeform', prompt: 'First question' },
      { id: 'q2', type: 'freeform', prompt: 'Second question' },
      { id: 'q3', type: 'freeform', prompt: 'Third question' },
    ]);
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q1', 'q2', 'q3']),
      changedMap: { q1: { answer: 1 }, q2: { answer: 1 }, q3: { answer: 1 } },
    });
    const slice = context.stateRef.current.surveysResponseState[2];
    slice.answers.q2 = { value: fill(100 * KIB) };
    slice.answers.q3 = { value: fill(100 * KIB, 'z') };
    const builtRow = (questionID: string, value: string) => ({ questionID, answer: { value } });
    context.prepareJsonAndHash.mockImplementation((_index: number, _account: unknown, overrideSlice: any) => ({
      responses: Object.entries(overrideSlice?.answers || {}).map(([qid, field]: [string, any]) =>
        builtRow(qid, field.value),
      ),
    }));
    // q2 has a saved answer; q3 was never saved.
    const savedQ2 = { questionID: 'q2', answer: { value: 'Saved second answer' } };
    context.stateRef.current.userAnswers = { responses: [savedQ2] };

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });

    const [{ userAnswers }] = context.runSurveyQuestionsSubmitSuccessController.mock.calls[0];
    expect(userAnswers.responses).toEqual([expect.objectContaining(builtRow('q1', 'Yes')), savedQ2]);
  });

  it('names every oversized answer when none can be submitted', async () => {
    const context = prepare('cloudflare', fill(100 * KIB), '', [
      { id: 'q1', type: 'freeform', prompt: 'First question' },
      { id: 'q2', type: 'freeform', prompt: '[encrypted]' },
    ]);
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q1', 'q2']),
      changedMap: { q1: { answer: 1 }, q2: { answer: 1 } },
    });
    const slice = context.stateRef.current.surveysResponseState[2];
    slice.answers.q2 = { value: fill(100 * KIB) };
    slice.additionalComments.q2 = { value: '' };

    const result = await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();

    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/^“First question” wasn't submitted\. This answer is too long/);
    expect(result.message).toMatch(/ Question q2… wasn't submitted\. This answer is too long/);
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
  });

  it('keeps a held-back answer named when the rest then fails', async () => {
    const context = prepare('cloudflare', 'Yes', '', [
      { id: 'q1', type: 'freeform', prompt: 'First question' },
      { id: 'q2', type: 'freeform', prompt: 'Second question' },
    ]);
    context.getChangedQidsAndFields.mockReturnValue({
      changedQids: new Set(['q1', 'q2']),
      changedMap: { q1: { answer: 1 }, q2: { answer: 1 } },
    });
    context.stateRef.current.surveysResponseState[2].answers.q2 = { value: fill(100 * KIB) };
    context.submitSurveyResponse.mockRejectedValueOnce(new Error('Upload failed.'));

    const result = await createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();

    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/^Upload failed\. “Second question” wasn't submitted\./);
  });

  it('counts the prompt copy and locking against the stored answer cap', async () => {
    // Inside the locked-text budget, but the 40 KiB prompt each stored answer
    // repeats plus both locked envelopes pass the Worker's 96 KiB cap.
    const context = prepare('cloudflare', locked(fill(24 * KIB)), locked(fill(23 * KIB)), [
      { id: 'Q1', type: 'freeform', prompt: 'p'.repeat(40 * KIB) },
    ]);

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message: expect.stringMatching(TOO_LONG),
    });
    expect(context.cryptoUtils.encryptMultipleAnswers).not.toHaveBeenCalled();
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
  });

  it('counts the saved rating envelopes the upload keeps', async () => {
    // The answer's lock is unchanged and the comment is newly locked; both saved
    // ratings keep their envelopes, which take the stored answer over the cap.
    const savedEnvelope = 'e'.repeat(3 * KIB);
    const answer = {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self_admin',
      encryptedPortion: 'a'.repeat(2 * KIB),
    };
    const context = prepare('cloudflare', answer, locked(fill(46 * KIB)), [
      { id: 'q1', type: 'freeform', prompt: 'p'.repeat(28 * KIB) },
    ]);
    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });

    const withSavedRatings = prepare('cloudflare', answer, locked(fill(46 * KIB)), [
      { id: 'q1', type: 'freeform', prompt: 'p'.repeat(28 * KIB) },
    ]);
    withSavedRatings.stateRef.current.userAnswers = {
      responses: [{ questionID: 'q1', importanceEncrypted: savedEnvelope, convictionEncrypted: savedEnvelope }],
    };
    await expect(createSurveyQuestionsSubmitRuntime(withSavedRatings).encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message: expect.stringMatching(TOO_LONG),
    });
  });

  it('counts saved rating envelopes kept under a blank locked comment', async () => {
    // The comment's lock still covers the ratings, so the upload keeps their
    // saved envelopes even though the comment itself is sent empty.
    const savedEnvelope = 'e'.repeat(3 * KIB);
    const answerText = fill(93 * KIB);
    const run = async (commentLocked: boolean) => {
      const context = prepare('cloudflare', answerText, {
        value: '',
        ...(commentLocked ? { encrypted: true, encryptionAudience: 'self_admin' } : {}),
      });
      const slice = context.stateRef.current.surveysResponseState[2];
      slice.importance = { q1: 4 };
      slice.conviction = { q1: 7 };
      context.stateRef.current.userAnswers = {
        responses: [
          {
            questionID: 'q1',
            importance: null,
            conviction: null,
            importanceEncrypted: savedEnvelope,
            convictionEncrypted: savedEnvelope,
          },
        ],
      };
      // The built answer sends a blank comment unlocked.
      context.prepareJsonAndHash.mockReturnValue({
        responses: [
          {
            questionID: 'q1',
            prompt: 'Tell us more',
            importance: 4,
            conviction: 7,
            answer: { value: answerText, encrypted: false, encryptedPortion: '' },
            additional: { value: '', encrypted: false, encryptionAudience: 'self_admin', encryptedPortion: '' },
          },
        ],
      });
      return createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    };

    await expect(run(true)).resolves.toEqual({ status: 'failed', message: expect.stringMatching(TOO_LONG) });
    // Unlocked, the known ratings go public and their envelopes are dropped.
    await expect(run(false)).resolves.toEqual({ status: 'submitted' });
  });

  it('sizes a gate lock by the SBTs its recipients list', async () => {
    const gateRecipient = (sbtCount: number) => ({
      chain: 'optimismSepolia',
      accessControlConditions: Array.from({ length: sbtCount }, (_, index) => ({
        contractAddress: `0x${String(index + 1).padStart(40, '0')}`,
      })),
    });
    const run = async (sbtCount: number) => {
      const gated = { value: fill(23 * KIB), encrypted: true, encryptionAudience: 'gate' };
      const context = prepare('cloudflare', gated, { ...gated }, [
        { id: 'q1', type: 'freeform', prompt: 'p'.repeat(12 * KIB) },
      ]);
      context.stateRef.current.surveysResponseState[2].importance = { q1: 4 };
      context.stateRef.current.surveysResponseState[2].conviction = { q1: 7 };
      context.buildFieldEncryptionWorkGroupsCore.mockReturnValue({
        groups: [
          {
            recipients: [gateRecipient(sbtCount)],
            qids: ['q1'],
            slice: { answers: { q1: gated }, additionalComments: { q1: gated } },
          },
        ],
        missingRecipients: [],
      });
      return createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    };

    await expect(run(8)).resolves.toEqual({ status: 'failed', message: expect.stringMatching(TOO_LONG) });
    await expect(run(1)).resolves.toEqual(expect.objectContaining({ status: 'submitted' }));
  });

  it('counts copies of the answer in the built upload, such as an interview record', async () => {
    const text = fill(33 * KIB);
    const run = async (withRecord: boolean) => {
      const context = prepare('cloudflare', text, '');
      context.prepareJsonAndHash.mockReturnValue({
        responses: [
          {
            questionID: 'q1',
            prompt: 'Tell us more',
            answer: { value: text, encrypted: false, encryptedPortion: '' },
            additional: { value: '', encrypted: false, encryptedPortion: '' },
            ...(withRecord
              ? {
                  interviewProvenance: {
                    finalSubmitted: { answer: text },
                    predictionComparison: { submitted: { answer: text } },
                  },
                }
              : {}),
          },
        ],
      });
      return createSurveyQuestionsSubmitRuntime(context).encryptAndUpload();
    };

    await expect(run(false)).resolves.toEqual({ status: 'submitted' });
    await expect(run(true)).resolves.toEqual({ status: 'failed', message: expect.stringMatching(TOO_LONG) });
  });

  it('refuses answers to a question whose prompt alone fills the stored answer', async () => {
    const context = prepare('cloudflare', 'Yes', '', [{ id: 'q1', type: 'freeform', prompt: 'p'.repeat(96 * KIB) }]);

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'failed',
      message: expect.stringMatching(
        /wasn't submitted\. Answers to this question can't be saved because its prompt is too long\. Ask the session admin to shorten it\.$/,
      ),
    });
    expect(context.submitSurveyResponse).not.toHaveBeenCalled();
  });

  it('counts a locked question by its masked prompt copy', async () => {
    const context = prepare('cloudflare', 'Yes', '', [
      { id: 'q1', type: 'freeform', prompt: 'p'.repeat(96 * KIB), encryption: { gates: [{ sbtAddress: '0xabc' }] } },
    ]);

    await expect(createSurveyQuestionsSubmitRuntime(context).encryptAndUpload()).resolves.toEqual({
      status: 'submitted',
    });
  });
});
