import {
  applyUserPageDecryptedPatchToResponseField,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponsePatch,
  buildUserPageEncryptedVisibilityDisplayState,
  buildUserPageEncryptedVisibilityStatusRequestPlan,
  buildUserPageGateAccessCheckPlan,
  buildUserPageGateAccessCacheKey,
  buildUserPageGateAccessRequestDescriptor,
  buildUserPageGateAccessSettlementPlan,
  buildUserPageGatePendingKey,
  buildUserPageGateRetryTimerPlan,
  buildUserPageQuestionResponseSourceDescriptor,
  buildUserPageResponseDecryptSurveyBindings,
  buildUserPageSurveyResponseSourceDescriptor,
  dispatchUserPageGateAccessCheckThroughPort,
  getUserPageGateResourceKeysToCheck,
  inferUserPageResponseEncryptionAudience,
  inferUserPageResponseFieldEncryptionAudience,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageEncryptedResponseField,
  isUserPageQuestionPayloadEncrypted,
  isUserPageResponsePayloadEncrypted,
  normalizeUserPageGateResourceKey,
  normalizeUserPageGateSlug,
  normalizeUserPageSourceSlugForSignature,
} from './userPageGateHelpers';

describe('userPageGateHelpers', () => {
  it('builds gate and source cache keys from normalized parts', () => {
    expect(normalizeUserPageGateSlug(' General ')).toBe('');
    expect(normalizeUserPageGateSlug(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageSourceSlugForSignature('general')).toBe('general');
    expect(normalizeUserPageSourceSlugForSignature(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageGateResourceKey('  field-1  ')).toBe('field-1');
    expect(normalizeUserPageGateResourceKey('')).toBe('default');

    expect(buildUserPageGateAccessCacheKey({
      account: ' 0xABC ',
      networkID: 84532,
      resourceKey: ' field-1 ',
      sbtCacheRevision: 7,
      slug: ' General ',
    })).toBe('0xabc|84532|7||field-1');
    expect(buildUserPageGateAccessCacheKey({
      resourceKey: '',
      slug: 'alpha',
    })).toBe('anon||0|alpha|default');
    expect(buildUserPageGatePendingKey({
      resourceKey: ' response ',
      slug: 'Beta',
    })).toBe('beta::response');
    expect(buildUserPageGatePendingKey({ slug: 'general' })).toBe('::default');
    expect(getUserPageGateResourceKeysToCheck(' response ')).toEqual(['response', 'default']);
    expect(getUserPageGateResourceKeysToCheck()).toEqual(['default']);
  });

  it('describes gated survey response source identity without reading cache', () => {
    expect(buildUserPageSurveyResponseSourceDescriptor({
      surveyId: ' Survey-A ',
      surveyResponseSourceSlugByKey: {
        ' survey-a |0xabc': 'ignored-raw-key',
        'survey-a|0xabc': 'response-key-slug',
      },
      surveyResponseSourceSlugById: {
        'survey-a': 'response-id-slug',
      },
      surveySourceSlugById: {
        'survey-a': 'survey-id-slug',
      },
      viewAddressLower: ' 0xABC ',
    })).toEqual({
      fallbackSlug: 'response-key-slug',
      responseSourceKey: 'survey-a|0xabc',
      sourceSlug: 'response-key-slug',
    });

    expect(buildUserPageSurveyResponseSourceDescriptor({
      surveyId: 'survey-a',
      surveyResponseSourceSlugById: {
        'survey-a': 'response-id-slug',
      },
      surveySourceSlugById: {
        'survey-a': 'survey-id-slug',
      },
      viewAddressLower: '0xabc',
    })).toEqual({
      fallbackSlug: 'response-id-slug',
      responseSourceKey: 'survey-a|0xabc',
      sourceSlug: 'response-id-slug',
    });

    expect(buildUserPageSurveyResponseSourceDescriptor({
      surveyId: 'missing',
      viewAddressLower: '0xabc',
    })).toEqual({
      fallbackSlug: '',
      responseSourceKey: 'missing|0xabc',
      sourceSlug: '',
    });
  });

  it('describes gated question response source identity through the existing question resolver', () => {
    const getSessionSlugByName = jest.fn((name) => (
      name === 'Mapped Session' ? 'mapped-session' : null
    ));

    expect(buildUserPageQuestionResponseSourceDescriptor({
      getSessionSlugByName,
      questionData: {
        id: 'q1',
        sessionName: 'Mapped Session',
      },
      questionId: ' Q1 ',
      questionResponseSourceSlugByKey: {
        'q1|0xabc': 'response-key-slug',
      },
      questionResponseSourceSlugById: {
        q1: 'response-id-slug',
      },
      questionSourceSlugById: {
        q1: 'question-id-slug',
      },
      viewAddressLower: ' 0xABC ',
    })).toEqual({
      fallbackSlug: 'response-key-slug',
      responseSourceKey: 'q1|0xabc',
      sourceSlug: 'mapped-session',
    });
    expect(getSessionSlugByName).toHaveBeenCalledWith('Mapped Session');

    expect(buildUserPageQuestionResponseSourceDescriptor({
      questionData: {
        id: 'q2',
        sessionSlug: ' Explicit-Session ',
      },
      questionId: 'q2',
      questionResponseSourceSlugById: {
        q2: 'response-id-slug',
      },
      questionSourceSlugById: {
        q2: 'question-id-slug',
      },
      viewAddressLower: '0xabc',
    })).toEqual({
      fallbackSlug: 'response-id-slug',
      responseSourceKey: 'q2|0xabc',
      sourceSlug: 'Explicit-Session',
    });

    expect(buildUserPageQuestionResponseSourceDescriptor({
      questionData: {},
      questionId: 'q3',
      questionSourceSlugById: {
        q3: 'question-id-slug',
      },
      viewAddressLower: '0xabc',
    })).toEqual({
      fallbackSlug: 'question-id-slug',
      responseSourceKey: 'q3|0xabc',
      sourceSlug: 'question-id-slug',
    });
  });

  it('builds gate-access request descriptors without executing sponsored access checks', () => {
    expect(buildUserPageGateAccessRequestDescriptor({
      account: ' 0xABC ',
      networkID: 84532,
      pendingKey: ' General:: questionResponses ',
      sbtCacheRevision: 7,
    })).toEqual({
      account: '0xABC',
      cacheKey: '0xabc|84532|7||questionResponses',
      pendingKey: '::questionResponses',
      resourceKey: 'questionResponses',
      sessionSlug: '',
      sponsoredAccessRequest: {
        account: '0xABC',
        resourceKey: 'questionResponses',
        sessionSlug: '',
      },
    });
    expect(buildUserPageGateAccessRequestDescriptor({
      pendingKey: 'Beta::',
    })).toMatchObject({
      account: '',
      cacheKey: 'anon||0|beta|default',
      pendingKey: 'beta::default',
      resourceKey: 'default',
      sessionSlug: 'beta',
      sponsoredAccessRequest: {
        account: '',
        resourceKey: 'default',
        sessionSlug: 'beta',
      },
    });
  });

  it('dispatches gate access checks through an injected port without owning settlement', async () => {
    const sessionConfig = { slug: 'edge', sponsoredKeys: { questionResponses: { encrypted: true } } };
    const requestDescriptor = buildUserPageGateAccessRequestDescriptor({
      account: ' 0xABC ',
      networkID: 84532,
      pendingKey: ' Edge:: questionResponses ',
      sbtCacheRevision: 7,
    });
    const gateResult = { status: 'granted', resourceKey: 'questionResponses' };
    const checkGateAccess = jest.fn(() => Promise.resolve(gateResult));

    const dispatchResult = dispatchUserPageGateAccessCheckThroughPort({
      checkGateAccess,
      requestDescriptor,
      sessionConfig,
    });

    expect(dispatchResult.action).toBe('dispatch');
    expect(dispatchResult.cacheKey).toBe('0xabc|84532|7|edge|questionResponses');
    expect(dispatchResult.pendingKey).toBe('edge::questionResponses');
    expect(dispatchResult.requestDescriptor).toBe(requestDescriptor);
    expect(dispatchResult.sponsoredAccessRequest).toEqual({
      account: '0xABC',
      resourceKey: 'questionResponses',
      sessionConfig,
      sessionSlug: 'edge',
    });
    expect(checkGateAccess).toHaveBeenCalledTimes(1);
    expect(checkGateAccess).toHaveBeenCalledWith(dispatchResult.sponsoredAccessRequest);
    await expect(dispatchResult.promise).resolves.toBe(gateResult);
    expect(Object.keys(dispatchResult).sort()).toEqual([
      'action',
      'cacheKey',
      'pendingKey',
      'promise',
      'reason',
      'requestDescriptor',
      'sponsoredAccessRequest',
    ]);
  });

  it('skips gate access dispatch without a descriptor or injected port', () => {
    const requestDescriptor = buildUserPageGateAccessRequestDescriptor({
      account: '0xABC',
      networkID: 84532,
      pendingKey: 'edge::questionResponses',
      sbtCacheRevision: 7,
    });
    const checkGateAccess = jest.fn();

    expect(dispatchUserPageGateAccessCheckThroughPort({
      checkGateAccess,
      requestDescriptor: null,
    })).toEqual({
      action: 'skip',
      cacheKey: '',
      pendingKey: '',
      promise: null,
      reason: 'missing-descriptor',
      requestDescriptor: null,
      sponsoredAccessRequest: null,
    });
    expect(dispatchUserPageGateAccessCheckThroughPort({
      requestDescriptor,
    })).toEqual({
      action: 'skip',
      cacheKey: '0xabc|84532|7|edge|questionResponses',
      pendingKey: 'edge::questionResponses',
      promise: null,
      reason: 'missing-port',
      requestDescriptor,
      sponsoredAccessRequest: null,
    });
    expect(checkGateAccess).not.toHaveBeenCalled();
  });

  it('returns rejected gate access port promises without catching side effects', async () => {
    const requestDescriptor = buildUserPageGateAccessRequestDescriptor({
      account: '0xABC',
      networkID: 84532,
      pendingKey: 'edge::questionResponses',
      sbtCacheRevision: 7,
    });
    const error = new Error('gate unavailable');
    const checkGateAccess = jest.fn(() => Promise.reject(error));

    const dispatchResult = dispatchUserPageGateAccessCheckThroughPort({
      checkGateAccess,
      requestDescriptor,
      sessionConfig: {},
    });

    expect(dispatchResult.action).toBe('dispatch');
    expect(checkGateAccess).toHaveBeenCalledTimes(1);
    await expect(dispatchResult.promise).rejects.toBe(error);
  });

  it('plans gate-access result settlement without scheduling timers or cache refreshes', () => {
    expect(buildUserPageGateAccessSettlementPlan({
      previousStatus: 'granted',
      resultStatus: 'granted',
      shouldPreserveStatusWhileRevalidating: true,
    })).toEqual({
      nextStatus: 'granted',
      shouldQueueCacheRefresh: false,
      shouldScheduleRetry: false,
    });
    expect(buildUserPageGateAccessSettlementPlan({
      previousStatus: 'granted',
      resultStatus: 'error',
      shouldPreserveStatusWhileRevalidating: true,
    })).toEqual({
      nextStatus: 'error',
      shouldQueueCacheRefresh: true,
      shouldScheduleRetry: true,
    });
    expect(buildUserPageGateAccessSettlementPlan({
      previousStatus: 'unknown',
      resultStatus: '',
      shouldPreserveStatusWhileRevalidating: false,
    })).toEqual({
      nextStatus: 'unknown',
      shouldQueueCacheRefresh: true,
      shouldScheduleRetry: true,
    });
  });

  it('plans response-gate retry timer coalescing without scheduling timers', () => {
    expect(buildUserPageGateRetryTimerPlan({
      delayMs: 30_000,
      isMounted: false,
      nowMs: 1000,
    })).toEqual({
      action: 'ignore-unmounted',
      nextDueAt: 31_000,
      safeDelayMs: 30_000,
      shouldClearExistingTimer: false,
      shouldScheduleTimer: false,
    });
    expect(buildUserPageGateRetryTimerPlan({
      currentDueAt: 20_000,
      delayMs: 30_000,
      hasCurrentTimer: true,
      nowMs: 1000,
    })).toEqual({
      action: 'keep-existing',
      nextDueAt: 31_000,
      safeDelayMs: 30_000,
      shouldClearExistingTimer: false,
      shouldScheduleTimer: false,
    });
    expect(buildUserPageGateRetryTimerPlan({
      currentDueAt: 60_000,
      delayMs: 10_000,
      hasCurrentTimer: true,
      nowMs: 1000,
    })).toEqual({
      action: 'schedule',
      nextDueAt: 11_000,
      safeDelayMs: 10_000,
      shouldClearExistingTimer: true,
      shouldScheduleTimer: true,
    });
  });

  it('builds encrypted visibility display descriptors without mutating inputs', () => {
    const statusByResource = [
      { resourceKey: ' questionResponses ', status: 'unknown' },
      { resourceKey: 'default', status: 'no-gate' },
    ];
    const originalStatusByResource = statusByResource.map((entry) => ({ ...entry }));

    expect(buildUserPageEncryptedVisibilityDisplayState({
      encryptionAudience: 'gate',
      resourceKey: ' questionResponses ',
      statusByResource,
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000aa',
    })).toEqual({
      visible: true,
      canDecryptOtherResponses: true,
      uncertain: false,
      pendingResourceKeys: [],
      uncertainResourceKey: '',
    });
    expect(buildUserPageEncryptedVisibilityDisplayState({
      encryptionAudience: ' self ',
      resourceKey: 'questionResponses',
      statusByResource,
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: false,
      pendingResourceKeys: [],
      uncertainResourceKey: '',
    });
    expect(buildUserPageEncryptedVisibilityDisplayState({
      encryptionAudience: 'gate',
      resourceKey: 'questionResponses',
      statusByResource: [{ resourceKey: 'default', status: 'granted' }],
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      visible: true,
      canDecryptOtherResponses: true,
      uncertain: false,
      pendingResourceKeys: ['default'],
      uncertainResourceKey: '',
    });
    expect(buildUserPageEncryptedVisibilityDisplayState({
      encryptionAudience: 'gate',
      resourceKey: 'questionResponses',
      statusByResource: [
        { resourceKey: 'questionResponses', status: 'denied' },
        { resourceKey: 'default', status: 'no-gate' },
      ],
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: false,
      pendingResourceKeys: ['questionResponses', 'default'],
      uncertainResourceKey: '',
    });
    expect(buildUserPageEncryptedVisibilityDisplayState({
      encryptionAudience: 'gate',
      resourceKey: ' questionResponses ',
      statusByResource,
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: true,
      pendingResourceKeys: ['questionResponses', 'default'],
      uncertainResourceKey: 'questionResponses',
    });
    expect(buildUserPageEncryptedVisibilityDisplayState({
      resourceKey: 'surveyResponses',
      viewAddressLower: '0x00000000000000000000000000000000000000aa',
      viewerAccount: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: true,
      pendingResourceKeys: ['surveyResponses', 'default'],
      uncertainResourceKey: 'surveyResponses',
    });
    expect(statusByResource).toEqual(originalStatusByResource);
  });

  it('plans encrypted visibility status reads around terminal viewer identities', () => {
    expect(buildUserPageEncryptedVisibilityStatusRequestPlan({
      encryptionAudience: 'gate',
      resourceKey: 'questionResponses',
      viewAddressLower: '0xabc',
      viewerAccount: '0xABC',
    })).toEqual({
      action: 'terminal',
      displayState: {
        visible: true,
        canDecryptOtherResponses: true,
        uncertain: false,
        pendingResourceKeys: [],
        uncertainResourceKey: '',
      },
      resourceKeysToCheck: [],
      terminalReason: 'own-profile',
    });

    expect(buildUserPageEncryptedVisibilityStatusRequestPlan({
      encryptionAudience: ' self ',
      resourceKey: 'questionResponses',
      viewAddressLower: '0xabc',
      viewerAccount: '0xdef',
    })).toEqual({
      action: 'terminal',
      displayState: {
        visible: false,
        canDecryptOtherResponses: false,
        uncertain: false,
        pendingResourceKeys: [],
        uncertainResourceKey: '',
      },
      resourceKeysToCheck: [],
      terminalReason: 'self-audience',
    });

    expect(buildUserPageEncryptedVisibilityStatusRequestPlan({
      encryptionAudience: 'gate',
      resourceKey: 'questionResponses',
      viewAddressLower: '0xabc',
      viewerAccount: '',
    })).toEqual({
      action: 'terminal',
      displayState: {
        visible: false,
        canDecryptOtherResponses: false,
        uncertain: false,
        pendingResourceKeys: [],
        uncertainResourceKey: '',
      },
      resourceKeysToCheck: [],
      terminalReason: 'missing-viewer-account',
    });

    expect(buildUserPageEncryptedVisibilityStatusRequestPlan({
      encryptionAudience: 'gate',
      resourceKey: 'questionResponses',
      viewAddressLower: '0xabc',
      viewerAccount: '0xdef',
    })).toEqual({
      action: 'read-statuses',
      displayState: null,
      resourceKeysToCheck: ['questionResponses', 'default'],
      terminalReason: '',
    });
  });

  it('plans gate-access check scheduling without executing sponsored access checks', () => {
    const nowMs = 100_000;
    const unknownRetryMs = 30_000;
    const terminalRecheckMs = 60_000;

    expect(buildUserPageGateAccessCheckPlan({
      cachedStatus: 'granted',
      cachedTs: nowMs - 10_000,
      hasCachedEntry: true,
      nowMs,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual({
      action: 'skip',
      cachedAgeMs: 10_000,
      previousStatus: 'granted',
      readinessDescriptor: {
        hasCachedEntry: true,
        hasInFlight: false,
        isRetryDelayActive: false,
        isStaleTerminalStatus: false,
        isTerminalStatus: true,
        isTransientRetryStatus: false,
      },
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    });

    expect(buildUserPageGateAccessCheckPlan({
      cachedStatus: 'unknown',
      cachedTs: nowMs - 5_000,
      hasCachedEntry: true,
      nowMs,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual({
      action: 'schedule-retry',
      cachedAgeMs: 5_000,
      previousStatus: 'unknown',
      readinessDescriptor: {
        hasCachedEntry: true,
        hasInFlight: false,
        isRetryDelayActive: true,
        isStaleTerminalStatus: false,
        isTerminalStatus: false,
        isTransientRetryStatus: true,
      },
      retryDelayMs: 25_000,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    });

    expect(buildUserPageGateAccessCheckPlan({
      cachedStatus: 'denied',
      cachedTs: nowMs - 90_000,
      hasCachedEntry: true,
      nowMs,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual({
      action: 'execute',
      cachedAgeMs: 90_000,
      previousStatus: 'denied',
      readinessDescriptor: {
        hasCachedEntry: true,
        hasInFlight: false,
        isRetryDelayActive: false,
        isStaleTerminalStatus: true,
        isTerminalStatus: true,
        isTransientRetryStatus: false,
      },
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: true,
      shouldSetCheckingStatus: false,
    });

    expect(buildUserPageGateAccessCheckPlan({
      cachedStatus: 'missing',
      hasCachedEntry: false,
      hasInFlight: true,
      nowMs,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual({
      action: 'in-flight',
      cachedAgeMs: Number.POSITIVE_INFINITY,
      previousStatus: 'missing',
      readinessDescriptor: {
        hasCachedEntry: false,
        hasInFlight: true,
        isRetryDelayActive: false,
        isStaleTerminalStatus: false,
        isTerminalStatus: false,
        isTransientRetryStatus: false,
      },
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    });

    expect(buildUserPageGateAccessCheckPlan({
      hasCachedEntry: false,
      nowMs,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual({
      action: 'execute',
      cachedAgeMs: Number.POSITIVE_INFINITY,
      previousStatus: 'missing',
      readinessDescriptor: {
        hasCachedEntry: false,
        hasInFlight: false,
        isRetryDelayActive: false,
        isStaleTerminalStatus: false,
        isTerminalStatus: false,
        isTransientRetryStatus: false,
      },
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: true,
    });

    expect(buildUserPageGateAccessCheckPlan({
      cachedStatus: 'granted',
      cachedTs: nowMs - 10_000,
      hasCachedEntry: true,
      terminalRecheckMs,
      unknownRetryMs,
    })).toEqual(expect.objectContaining({
      action: 'execute',
      cachedAgeMs: Number.POSITIVE_INFINITY,
      readinessDescriptor: expect.objectContaining({
        hasCachedEntry: true,
        isStaleTerminalStatus: true,
        isTerminalStatus: true,
      }),
      shouldPreserveStatusWhileRevalidating: true,
    }));
  });

  it('revalidates stale terminal gate statuses while preserving their visible state', () => {
    const nowMs = 200_000;
    const staleTs = nowMs - 120_000;

    ['granted', 'denied', 'no-gate'].forEach((cachedStatus) => {
      expect(buildUserPageGateAccessCheckPlan({
        cachedStatus,
        cachedTs: staleTs,
        hasCachedEntry: true,
        hasInFlight: false,
        nowMs,
        terminalRecheckMs: 60_000,
        unknownRetryMs: 30_000,
      })).toEqual({
        action: 'execute',
        cachedAgeMs: 120_000,
        previousStatus: cachedStatus,
        readinessDescriptor: {
          hasCachedEntry: true,
          hasInFlight: false,
          isRetryDelayActive: false,
          isStaleTerminalStatus: true,
          isTerminalStatus: true,
          isTransientRetryStatus: false,
        },
        retryDelayMs: 0,
        shouldPreserveStatusWhileRevalidating: true,
        shouldSetCheckingStatus: false,
      });
    });
  });

  it('detects encrypted response fields and payload audiences', () => {
    expect(isUserPageEncryptedResponseField(null)).toBe(false);
    expect(isUserPageEncryptedResponseField({ value: '*' })).toBe(false);
    expect(isUserPageEncryptedResponseField({ value: '*', encryptionAudience: 'self' })).toBe(true);
    expect(isUserPageEncryptedResponseField({ encryptedPortion: 'ciphertext' })).toBe(true);

    const response = {
      answer: { value: '*', encryptionAudience: 'gate' },
      additional: { encrypted: true },
    };
    expect(isUserPageAnswerFieldEncrypted(response)).toBe(true);
    expect(isUserPageAdditionalFieldEncrypted(response)).toBe(true);
    expect(isUserPageResponsePayloadEncrypted(response)).toBe(true);
    expect(isUserPageResponsePayloadEncrypted({ answer: { value: 'plain' } })).toBe(false);

    expect(inferUserPageResponseFieldEncryptionAudience({
      answer: { encryptionAudience: ' Self ' },
    }, 'answer', 'gate')).toBe('self');
    expect(inferUserPageResponseFieldEncryptionAudience({
      answer: { encryptionAudience: 'public' },
    }, 'answer', ' Self ')).toBe('self');
    expect(inferUserPageResponseEncryptionAudience({
      answer: { encryptionAudience: 'self' },
      additional: { encryptionAudience: 'self' },
    })).toBe('self');
    expect(inferUserPageResponseEncryptionAudience({
      answer: { encryptionAudience: 'self' },
      additional: { encryptionAudience: 'gate' },
    })).toBe('gate');
    expect(inferUserPageResponseEncryptionAudience({}, '')).toBe('gate');
  });

  it('detects encrypted and masked question payloads', () => {
    expect(isUserPageQuestionPayloadEncrypted(null)).toBe(false);
    expect(isUserPageQuestionPayloadEncrypted({ prompt: 'Public prompt' })).toBe(false);
    expect(isUserPageQuestionPayloadEncrypted({ promptEncrypted: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ encryptedPrompt: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ optionsEncrypted: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ encryptedOptions: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ tagsEncrypted: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ encryptedTags: '{"v":2}' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ prompt: '[encrypted]' })).toBe(true);
    expect(isUserPageQuestionPayloadEncrypted({ options: [], optionsEncrypted: '{"v":2}' })).toBe(true);
  });

  it('builds decryptable response fields and decrypted patches', () => {
    expect(buildUserPageDecryptableResponseField({
      value: 'ciphertext',
      encryptedPortion: 'payload',
      keep: 'yes',
    })).toEqual({
      value: 'ciphertext',
      encryptedPortion: 'payload',
      keep: 'yes',
      encrypted: true,
    });
    expect(buildUserPageDecryptableResponseField({ encrypted: false })).toEqual({
      encrypted: false,
      value: '',
    });

    const originalField = { value: '*', encrypted: true, encryptedPortion: 'payload', keep: 'yes' };
    expect(applyUserPageDecryptedPatchToResponseField(originalField, {})).toBe(originalField);
    expect(applyUserPageDecryptedPatchToResponseField(originalField, {
      value: 'clear',
      zkSalt: 'salt-1',
    })).toEqual({
      value: 'clear',
      encrypted: false,
      keep: 'yes',
      zkSalt: 'salt-1',
    });

    expect(buildUserPageDecryptedResponsePatch({
      responseObj: {
        answer: { value: '*', encrypted: true, encryptedPortion: 'answer-cipher' },
        additional: { value: '*', encrypted: true, encryptedPortion: 'additional-cipher' },
        untouched: true,
      },
      questionId: ' Q1 ',
      fieldToDecrypt: 'both',
      decryptedResult: {
        answers: {
          q1: { value: 'answer clear' },
        },
        additionalComments: {
          q1: { value: 'additional clear' },
        },
      },
    })).toEqual({
      answer: { value: 'answer clear', encrypted: false },
      additional: { value: 'additional clear', encrypted: false },
      untouched: true,
    });
    expect(buildUserPageDecryptedResponsePatch({
      responseObj: { answer: { value: '*' } },
      questionId: 'q1',
      fieldToDecrypt: 'additional',
      decryptedResult: { answers: { q1: { value: 'ignored' } } },
    })).toBeNull();
  });

  it('builds response decrypt survey bindings from response and survey details', () => {
    const hashZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const responseOverride = { surveyID: 'OverrideSurvey' };

    expect(buildUserPageResponseDecryptSurveyBindings({
      hashZero,
      questionId: ' Q1 ',
      responseOverride,
      questionResponseInfo: [
        { id: 'q1', associatedSurveyId: 'InfoAssoc', surveyId: 'InfoSurvey' },
        { id: 'other', surveyId: 'IgnoredInfo' },
      ],
      detailedSurveyResponses: {
        'Survey-Key': [
          {
            questionData: { id: 'Q1', surveyID: 'QuestionSurvey' },
            responseData: { surveyId: 'ResponseSurvey' },
          },
        ],
        ReferenceSurvey: [
          {
            questionData: { id: 'Other' },
            responseData: responseOverride,
          },
        ],
        IgnoredSurvey: [
          {
            questionData: { id: 'Other', surveyID: 'IgnoredQuestion' },
            responseData: { surveyId: 'IgnoredResponse' },
          },
        ],
      },
    })).toEqual({
      surveyId: 'overridesurvey',
      acceptedSurveyIds: [
        'overridesurvey',
        'infoassoc',
        'infosurvey',
        'survey-key',
        'questionsurvey',
        'responsesurvey',
        'referencesurvey',
        hashZero,
      ],
    });
    expect(buildUserPageResponseDecryptSurveyBindings({
      hashZero,
      questionId: 'missing',
    })).toEqual({
      surveyId: hashZero,
      acceptedSurveyIds: [hashZero],
    });
    expect(buildUserPageResponseDecryptSurveyBindings({
      hashZero,
      questionId: 'q1',
      responseOverride: null,
      detailedSurveyResponses: {
        IncludedSurvey: [
          {
            questionData: { id: 'Q1', surveyID: 'QuestionSurvey' },
            responseData: { surveyId: 'ResponseSurvey' },
          },
        ],
        IgnoredSurvey: [
          {
            questionData: { id: 'Other', surveyID: 'IgnoredQuestion' },
            responseData: { surveyId: 'IgnoredResponse' },
          },
        ],
      },
    })).toEqual({
      surveyId: 'includedsurvey',
      acceptedSurveyIds: [
        'includedsurvey',
        'questionsurvey',
        'responsesurvey',
        hashZero,
      ],
    });
  });
});
