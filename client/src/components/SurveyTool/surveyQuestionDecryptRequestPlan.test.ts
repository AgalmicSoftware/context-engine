import {
  buildSurveyQuestionDecryptExecutionPlan,
  buildSurveyQuestionDecryptRequestPlan,
} from './surveyQuestionDecryptRequestPlan';

describe('surveyQuestionDecryptRequestPlan', () => {
  it('builds typed single-question decrypt execution options from concrete domain fields', () => {
    const getKey = jest.fn();
    const provider = { request: jest.fn() };
    const questionPool = [{ id: 'q1' }];

    expect(
      buildSurveyQuestionDecryptExecutionPlan({
        account: '0xABC',
        chainId: '84532',
        fieldToDecrypt: ' Answer ',
        hasher: 'hash-worker',
        litHooks: { getKey },
        provider,
        providerKind: 'browser',
        questionId: ' Q1 ',
        questionPool,
        surveyId: 'Survey-A',
      }),
    ).toEqual({
      chainId: '84532',
      lit: { getKey },
      opts: {
        account: '0xABC',
        chainId: '84532',
        hasher: 'hash-worker',
        lit: { getKey },
        provider,
        providerKind: 'browser',
        questionPool,
        surveyId: 'Survey-A',
        throwOnError: true,
      },
      providerKind: 'browser',
      questionPool,
      surveyId: 'Survey-A',
      target: {
        chainId: '84532',
        fieldToDecrypt: 'answer',
        providerKind: 'browser',
        questionId: 'q1',
        surveyId: 'Survey-A',
      },
    });
  });

  it('blocks decrypt requests before building executable crypto payloads', () => {
    expect(
      buildSurveyQuestionDecryptRequestPlan({
        questionId: '',
        decryptSelection: { hasMaskedField: true, keysToMark: ['q1:answer'] },
      }),
    ).toEqual(
      expect.objectContaining({
        blockedReason: 'missing-question',
        decryptRequest: null,
        opts: null,
        shouldDecrypt: false,
        status: 'blocked',
      }),
    );

    expect(
      buildSurveyQuestionDecryptRequestPlan({
        questionId: 'q1',
        decryptSelection: { hasMaskedField: false, keysToMark: [] },
      }),
    ).toEqual(
      expect.objectContaining({
        blockedReason: 'no-masked-field',
        decryptRequest: null,
        opts: null,
        shouldDecrypt: false,
        status: 'blocked',
      }),
    );
  });

  it('builds a typed decrypt request without executing decrypt or Lit', () => {
    const baselineForDecrypt = {
      answers: { q1: { value: '*', encrypted: true } },
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    const provider = { request: jest.fn() };

    expect(
      buildSurveyQuestionDecryptRequestPlan({
        account: '0xabc',
        baselineForDecrypt,
        chainId: 84532,
        decryptSelection: {
          clearMode: 'answer',
          hasMaskedField: true,
          keysToMark: ['q1:answer'],
          maskedAnswer: true,
          maskedAdditional: false,
        },
        fieldToDecrypt: 'answer',
        provider,
        providerKind: 'browser',
        questionId: 'Q1',
        questionPool: [{ id: 'q1' }],
        surveyId: 'survey-a',
      }),
    ).toEqual(
      expect.objectContaining({
        blockedReason: '',
        shouldDecrypt: true,
        status: 'ready',
        decryptRequest: expect.objectContaining({
          fieldToDecrypt: 'answer',
          questionId: 'q1',
          responseSlice: baselineForDecrypt,
          target: {
            chainId: 84532,
            fieldToDecrypt: 'answer',
            providerKind: 'browser',
            questionId: 'q1',
            surveyId: 'survey-a',
          },
        }),
        target: {
          chainId: 84532,
          fieldToDecrypt: 'answer',
          providerKind: 'browser',
          questionId: 'q1',
          surveyId: 'survey-a',
        },
      }),
    );
  });
});
