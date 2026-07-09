import {
  buildSubmittedResponseJson,
  buildSurveyDefinitionJson,
  buildSurveyQuestionsJson,
  shouldUseSubmittedResponseJson,
} from './surveyQuestionsJsonDerivation.js';

describe('surveyQuestionsJsonDerivation', () => {
  it('builds question JSON for single-question and survey modes', () => {
    const questionPool = [{ id: 'q1' }, { id: 'q2' }];

    expect(buildSurveyQuestionsJson({ singleQuestionMode: true, questionPool })).toEqual({ id: 'q1' });
    expect(buildSurveyQuestionsJson({ singleQuestionMode: true, questionPool: [] })).toEqual({});
    expect(buildSurveyQuestionsJson({ singleQuestionMode: false, questionPool })).toBe(questionPool);
    expect(buildSurveyQuestionsJson({ singleQuestionMode: false, questionPool: null })).toEqual([]);
  });

  it('detects submitted response sources without treating active edits as submitted views', () => {
    expect(
      shouldUseSubmittedResponseJson({
        viewAddress: '0xabc',
        parsedViewAddressAnswers: { answer: 'saved' },
        isEditing: true,
      }),
    ).toBe(true);

    expect(
      shouldUseSubmittedResponseJson({
        responderAddress: '0xabc',
        parsedViewAddressAnswers: { answer: 'saved' },
        isEditing: true,
      }),
    ).toBe(true);

    expect(
      shouldUseSubmittedResponseJson({
        isEditing: false,
        userAnswers: { answer: 'saved' },
      }),
    ).toBe(true);

    expect(
      shouldUseSubmittedResponseJson({
        viewAddress: '0xabc',
        parsedViewAddressAnswers: null,
        isEditing: true,
        userAnswers: { answer: 'draft' },
      }),
    ).toBe(false);
  });

  it('normalizes submitted single-question responses with rating metadata', () => {
    expect(buildSubmittedResponseJson()).toEqual({});

    expect(
      buildSubmittedResponseJson({
        singleQuestionMode: true,
        rawResponse: { value: 7, conviction: '4', importance: '6' },
      }),
    ).toEqual({
      value: 7,
      conviction: 4,
      importance: 6,
    });

    expect(
      buildSubmittedResponseJson({
        singleQuestionMode: true,
        rawResponse: 'raw-cid',
      }),
    ).toBe('raw-cid');
  });

  it('normalizes submitted survey responses and preserves existing top-level ratings', () => {
    expect(
      buildSubmittedResponseJson({
        singleQuestionMode: false,
        rawResponse: {
          surveyId: 's1',
          conviction: '8',
          responses: [
            { questionId: 'q1', value: 3, conviction: '2' },
            { questionId: 'q2', value: 5, importance: '9' },
            { questionId: 'q3', value: 'freeform' },
          ],
        },
      }),
    ).toEqual({
      surveyId: 's1',
      conviction: '8',
      responses: [
        { questionId: 'q1', value: 3, conviction: 2, importance: null },
        { questionId: 'q2', value: 5, conviction: 9, importance: 9 },
        { questionId: 'q3', value: 'freeform', conviction: null, importance: null },
      ],
    });

    expect(
      buildSubmittedResponseJson({
        rawResponse: {
          surveyId: 's1',
          importance: '7',
          responses: [],
        },
      }),
    ).toEqual({
      surveyId: 's1',
      conviction: 7,
      importance: '7',
      responses: [],
    });
  });

  it('preserves gated encrypted payload shape for submitted response JSON readiness', () => {
    const encryptedPortion = {
      ciphertext: 'ciphertext',
      dataToEncryptHash: 'hash',
    };

    expect(
      buildSubmittedResponseJson({
        singleQuestionMode: true,
        rawResponse: {
          encrypted: true,
          encryptedPortion,
          encryptionAudience: 'gate',
          value: '*',
        },
      }),
    ).toEqual({
      encrypted: true,
      encryptedPortion,
      encryptionAudience: 'gate',
      value: '*',
      conviction: null,
      importance: null,
    });

    expect(
      buildSubmittedResponseJson({
        rawResponse: {
          surveyId: 'survey-gated',
          responses: [
            {
              encrypted: true,
              encryptedPortion,
              encryptionAudience: 'gate',
              questionId: 'q-gated',
              value: '*',
            },
          ],
        },
      }),
    ).toEqual({
      surveyId: 'survey-gated',
      responses: [
        {
          encrypted: true,
          encryptedPortion,
          encryptionAudience: 'gate',
          questionId: 'q-gated',
          value: '*',
          conviction: null,
          importance: null,
        },
      ],
    });
  });

  it('preserves encrypted rating envelopes in submitted response JSON without deriving plaintext ratings', () => {
    expect(
      buildSubmittedResponseJson({
        singleQuestionMode: true,
        rawResponse: {
          answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
          convictionEncrypted: 'conviction-env',
          importanceEncrypted: 'importance-env',
          questionID: 'q-rating',
        },
      }),
    ).toEqual({
      answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
      conviction: null,
      convictionEncrypted: 'conviction-env',
      importance: null,
      importanceEncrypted: 'importance-env',
      questionID: 'q-rating',
    });

    expect(
      buildSubmittedResponseJson({
        rawResponse: {
          surveyId: 'survey-rating',
          responses: [
            {
              additional: { value: '*', encrypted: true, encryptedPortion: 'note-env' },
              convictionEncrypted: 'conviction-env',
              importanceEncrypted: 'importance-env',
              questionID: 'q-rating',
            },
          ],
        },
      }),
    ).toEqual({
      surveyId: 'survey-rating',
      responses: [
        {
          additional: { value: '*', encrypted: true, encryptedPortion: 'note-env' },
          conviction: null,
          convictionEncrypted: 'conviction-env',
          importance: null,
          importanceEncrypted: 'importance-env',
          questionID: 'q-rating',
        },
      ],
    });
  });

  it('expands survey question IDs into full question JSON when possible', () => {
    const survey = {
      id: 's1',
      title: 'Survey',
      questionIDs: ['Q1', 'q2', 'q-missing'],
    };
    const q1 = { id: 'q1', prompt: 'One' };
    const q2 = { id: 'q2', prompt: 'Two' };

    expect(
      buildSurveyDefinitionJson({
        surveys: [survey],
        surveyIndex: 0,
        questionPool: [q1, q2],
      }),
    ).toEqual({
      id: 's1',
      title: 'Survey',
      questions: [q1, q2, { id: 'q-missing', error: 'Question details not found in pool' }],
    });

    expect(
      buildSurveyDefinitionJson({
        isStandalone: true,
        surveys: [survey],
        surveyIndex: 0,
        questionPool: [q1, q2],
      }),
    ).toEqual({});

    expect(
      buildSurveyDefinitionJson({
        singleQuestionMode: true,
        surveys: [survey],
        surveyIndex: 0,
        questionPool: [q1, q2],
      }),
    ).toEqual({});
  });
});
