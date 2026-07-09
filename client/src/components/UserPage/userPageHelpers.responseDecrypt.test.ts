import {
  applyUserPageDecryptedPatchToResponseField,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponseStatePatch,
  buildUserPageDecryptedResponsePatch,
  buildUserPageGateAccessCacheKey,
  buildUserPageGatePendingKey,
  buildUserPageResponseDecryptRequestPlan,
  buildUserPageResponseDecryptSurveyBindings,
  getUserPageGateResourceKeysToCheck,
  inferUserPageResponseEncryptionAudience,
  inferUserPageResponseFieldEncryptionAudience,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageEncryptedResponseField,
  isUserPageResponsePayloadEncrypted,
  normalizeUserPageGateResourceKey,
  normalizeUserPageGateSlug,
  normalizeUserPageSourceSlugForSignature,
} from './userPageHelpers';

describe('userPageHelpers response decrypt helpers', () => {
  it('builds gate and source cache keys from normalized parts', () => {
    expect(normalizeUserPageGateSlug(' General ')).toBe('');
    expect(normalizeUserPageGateSlug(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageSourceSlugForSignature('general')).toBe('general');
    expect(normalizeUserPageSourceSlugForSignature(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageGateResourceKey('  field-1  ')).toBe('field-1');
    expect(normalizeUserPageGateResourceKey('')).toBe('default');

    expect(
      buildUserPageGateAccessCacheKey({
        account: ' 0xABC ',
        networkID: 84532,
        resourceKey: ' field-1 ',
        sbtCacheRevision: 7,
        slug: ' General ',
      }),
    ).toBe('0xabc|84532|7||field-1');

    expect(
      buildUserPageGateAccessCacheKey({
        resourceKey: '',
        slug: 'alpha',
      }),
    ).toBe('anon||0|alpha|default');

    expect(
      buildUserPageGatePendingKey({
        resourceKey: ' response ',
        slug: 'Beta',
      }),
    ).toBe('beta::response');
    expect(buildUserPageGatePendingKey({ slug: 'general' })).toBe('::default');
  });

  it('builds gate resource key fallback lists', () => {
    expect(getUserPageGateResourceKeysToCheck()).toEqual(['default']);
    expect(getUserPageGateResourceKeysToCheck('')).toEqual(['default']);
    expect(getUserPageGateResourceKeysToCheck(' response ')).toEqual(['response', 'default']);
  });

  it('detects encrypted response fields and payloads', () => {
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
  });

  it('infers response encryption audiences with field precedence', () => {
    expect(
      inferUserPageResponseFieldEncryptionAudience(
        {
          answer: { encryptionAudience: ' Self ' },
        },
        'answer',
        'gate',
      ),
    ).toBe('self');

    expect(
      inferUserPageResponseFieldEncryptionAudience(
        {
          answer: { encryptionAudience: 'public' },
        },
        'answer',
        ' Self ',
      ),
    ).toBe('self');

    expect(
      inferUserPageResponseEncryptionAudience({
        answer: { encryptionAudience: 'self' },
        additional: { encryptionAudience: 'self' },
      }),
    ).toBe('self');
    expect(
      inferUserPageResponseEncryptionAudience({
        answer: { encryptionAudience: 'self' },
        additional: { encryptionAudience: 'gate' },
      }),
    ).toBe('gate');
    expect(inferUserPageResponseEncryptionAudience({}, 'custom')).toBe('custom');
    expect(inferUserPageResponseEncryptionAudience({}, '')).toBe('gate');
  });

  it('builds decryptable response fields and decrypted patches', () => {
    expect(
      buildUserPageDecryptableResponseField({
        value: 'ciphertext',
        encryptedPortion: 'payload',
        keep: 'yes',
      }),
    ).toEqual({
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
    expect(
      applyUserPageDecryptedPatchToResponseField(originalField, {
        value: 'clear',
        zkSalt: 'salt-1',
      }),
    ).toEqual({
      value: 'clear',
      encrypted: false,
      keep: 'yes',
      zkSalt: 'salt-1',
    });

    expect(
      buildUserPageDecryptedResponsePatch({
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
      }),
    ).toEqual({
      answer: { value: 'answer clear', encrypted: false },
      additional: { value: 'additional clear', encrypted: false },
      untouched: true,
    });

    expect(
      buildUserPageDecryptedResponsePatch({
        responseObj: { answer: { value: '*' } },
        questionId: 'q1',
        fieldToDecrypt: 'additional',
        decryptedResult: { answers: { q1: { value: 'ignored' } } },
      }),
    ).toBeNull();
  });

  it('builds response decrypt survey bindings from response and survey details', () => {
    const hashZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const responseOverride = { surveyID: 'OverrideSurvey' };

    expect(
      buildUserPageResponseDecryptSurveyBindings({
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
      }),
    ).toEqual({
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

    expect(
      buildUserPageResponseDecryptSurveyBindings({
        hashZero,
        questionId: 'missing',
      }),
    ).toEqual({
      surveyId: hashZero,
      acceptedSurveyIds: [hashZero],
    });
  });

  it('builds a typed response decrypt request plan without executing crypto', () => {
    const hashZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const getKey = jest.fn();
    const responseOverride = {
      surveyID: 'Survey-A',
      answer: { value: '*', encryptedPortion: 'answer-cipher' },
      additional: { value: '', encrypted: false },
    };

    expect(
      buildUserPageResponseDecryptRequestPlan({
        account: ' 0xABC ',
        detailedSurveyResponses: {
          SurveyA: [
            {
              questionData: { id: 'Q1' },
              responseData: responseOverride,
            },
          ],
        },
        hashZero,
        litHooks: { getKey },
        networkId: '84532',
        provider: 'provider-ref',
        questionId: ' Q1 ',
        responseOverride,
      }),
    ).toEqual({
      account: '0xABC',
      blockedReason: '',
      cryptoOptions: {
        acceptedSurveyIds: ['survey-a', 'surveya', hashZero],
        account: '0xABC',
        chainId: 84532,
        lit: { getKey },
        provider: 'provider-ref',
        providerKind: 'provider-ref',
        surveyId: 'survey-a',
        throwOnError: true,
      },
      questionId: 'q1',
      responseSlice: {
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'answer-cipher',
          },
        },
        additionalComments: {
          q1: {
            value: '',
            encrypted: false,
          },
        },
        importance: {},
        conviction: {},
      },
      status: 'ready',
    });

    expect(
      buildUserPageResponseDecryptRequestPlan({
        account: '',
        questionId: 'q1',
        responseOverride,
      }),
    ).toEqual(
      expect.objectContaining({
        blockedReason: 'missing-account',
        cryptoOptions: null,
        responseSlice: null,
        status: 'blocked',
      }),
    );
  });

  it('builds decrypted response state patches without mutating previous buckets', () => {
    const encryptedResponse = {
      answer: { value: '*', encrypted: true },
      additional: { value: '', encrypted: false },
    };
    const patchedResponse = {
      answer: { value: 'clear', encrypted: false },
      additional: { value: '', encrypted: false },
    };
    const previousState = {
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1' },
            responseData: encryptedResponse,
          },
          {
            questionData: { id: 'q2' },
            responseData: { answer: { value: 'other' } },
          },
        ],
      },
    };

    const result = buildUserPageDecryptedResponseStatePatch({
      patchedResponse,
      previousState,
      questionId: 'Q1',
      responseOverride: encryptedResponse,
    });

    expect(result.didUpdate).toBe(true);
    expect(result.statePatch).toEqual({
      detailedQuestionResponses: {
        q1: patchedResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1' },
            responseData: patchedResponse,
          },
          previousState.detailedSurveyResponses.s1[1],
        ],
      },
    });
    expect(previousState.detailedQuestionResponses.q1).toBe(encryptedResponse);
    expect(previousState.detailedSurveyResponses.s1[0].responseData).toBe(encryptedResponse);

    expect(
      buildUserPageDecryptedResponseStatePatch({
        patchedResponse,
        previousState: {
          detailedQuestionResponses: {},
          detailedSurveyResponses: {},
        },
        questionId: 'q1',
        responseOverride: encryptedResponse,
      }),
    ).toEqual({
      didUpdate: false,
      statePatch: null,
    });
  });
});
