import {
  applyUserPageDecryptedPatchToResponseField,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponsePatch,
  buildUserPageEncryptedVisibilityDisplayState,
  buildUserPageGateAccessCheckPlan,
  buildUserPageGateAccessCacheKey,
  buildUserPageGatePendingKey,
  buildUserPageResponseDecryptSurveyBindings,
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
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: true,
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
  });
});
