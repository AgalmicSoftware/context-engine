import {
  buildResponsePayload,
  captureInterviewPredictionComparisonSubmissions,
  type BuildResponsePayloadOptions,
} from './surveyToolResponsePayloadController';

const defaultOpts = (overrides: Partial<BuildResponsePayloadOptions> = {}): BuildResponsePayloadOptions => ({
  isStandalone: false,
  singleQuestionMode: false,
  surveyId: 'survey-1',
  account: '0xUser',
  surveyIndex: 0,
  surveyResponseState: {
    answers: {},
    additionalComments: {},
    importance: {},
    conviction: {},
  },
  questionPool: [],
  pileQuestions: [],
  resolveFieldEncryptionAudience: () => 'default-audience',
  getQuestionEncryptionGates: () => [],
  resolveFieldEncryptionGateId: () => null,
  normalizeFieldAudienceMode: () => 'default',
  getSurveyMetadataForJson: () => ({ surveyTitle: null, sessionName: '' }),
  resolveSessionContext: () => ({ sessionName: '' }),
  getConvictionFromSlice: () => null,
  getImportanceFromSlice: () => null,
  sanitizeQuestionPromptForResponsePayload: (q) => String(q.prompt || ''),
  ...overrides,
});

describe('surveyToolResponsePayloadController', () => {
  it('returns empty object when surveyResponseState is null', () => {
    expect(
      buildResponsePayload(
        defaultOpts({
          surveyResponseState: null,
        }),
      ),
    ).toEqual({});
  });

  it('builds survey-mode payload with responses array', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Yes or no?' }],
        surveyResponseState: {
          answers: { q1: { value: 'Yes' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        surveyID: 'survey-1',
        responder: '0xUser',
        timeStamp: expect.any(Number),
      }),
    );
    expect(result.responses!).toHaveLength(1);
    expect(result.responses![0]).toEqual(
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Yes' }),
      }),
    );
  });

  it('includes consented self-reported interview provenance beside the final editable answer', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
        surveyResponseState: {
          answers: { q1: { value: 'Final edited answer' } },
          additionalComments: {},
          importance: {},
          conviction: {},
          interviewProvenance: {
            q1: {
              includeAiProvenance: true,
              includePredictionComparison: true,
              responderName: '  Ada   Example  ',
              source: {
                platform: 'claude',
                modelId: 'claude-example',
                verification: 'self_reported',
                researchCoverage: {
                  historyChatsSearched: null,
                  historyChatsUsed: 8.9,
                  memoryItemsSearched: 20,
                  memoryItemsUsed: 4,
                  connectedSourcesSearched: 3,
                  connectedSourcesUsed: 1,
                  userStatementsUsed: 15,
                  searchScopeNote: '  Search API did not expose total chats.  ',
                },
              },
              promptVersion: 'ce-interview-brief-v1',
              questionSetHash: 'hash',
              originalPrediction: { answer: 'Original agent prediction', confidence: 0.22 },
              submissionValueSnapshot: {
                answer: 'Final edited answer',
                additionalComments: '',
              },
              appliedAt: 123,
            },
          },
        } as never,
      }),
    );

    expect(result.responses![0]).toEqual(
      expect.objectContaining({
        answer: expect.objectContaining({ value: 'Final edited answer' }),
        responderName: 'Ada Example',
        interviewProvenance: expect.objectContaining({
          version: 1,
          source: {
            platform: 'claude',
            modelId: 'claude-example',
            verification: 'self_reported',
            researchCoverage: {
              historyChatsSearched: null,
              historyChatsUsed: 8,
              memoryItemsSearched: 20,
              memoryItemsUsed: 4,
              connectedSourcesSearched: 3,
              connectedSourcesUsed: 1,
              userStatementsUsed: 15,
              searchScopeNote: 'Search API did not expose total chats.',
            },
          },
          promptVersion: 'ce-interview-brief-v1',
          questionSetHash: 'hash',
          originalPrediction: {
            answer: 'Original agent prediction',
            additionalComments: '',
            importance: null,
            conviction: null,
            confidence: 0.22,
            evidence: '',
          },
          predictionComparison: {
            version: 1,
            original: {
              answer: 'Original agent prediction',
              additionalComments: '',
              importance: null,
              conviction: null,
              confidence: 0.22,
              evidence: '',
            },
            submitted: {
              answer: 'Final edited answer',
              additionalComments: '',
              importance: null,
              conviction: null,
            },
            changedFields: ['answer'],
            redactedFields: [],
          },
          appliedAt: 123,
        }),
      }),
    );
  });

  it('redacts encrypted comparison values while retaining edit and confidence measurements', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
        surveyResponseState: {
          answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'answer-envelope' } },
          additionalComments: {
            q1: { value: '*', encrypted: true, encryptedPortion: 'additional-envelope' },
          },
          importance: { q1: 80 },
          conviction: { q1: 70 },
          interviewProvenance: {
            q1: {
              includeAiProvenance: true,
              includePredictionComparison: true,
              source: { platform: 'claude', modelId: 'claude-example' },
              originalPrediction: {
                answer: 'Original private prediction',
                additionalComments: 'Original private note',
                importance: 60,
                conviction: 70,
                confidence: 0.3,
                evidence: 'Indirect support',
              },
              submissionValueSnapshot: {
                answer: 'Final private answer',
                additionalComments: 'Final private note',
              },
            },
          },
        } as never,
        getImportanceFromSlice: () => 80,
        getConvictionFromSlice: () => 70,
      }),
    );

    const provenance = result.responses![0].interviewProvenance as Record<string, any>;
    expect(provenance.originalPrediction).toEqual(
      expect.objectContaining({
        answer: { redacted: true, reason: 'encrypted_field' },
        additionalComments: { redacted: true, reason: 'encrypted_field' },
        confidence: 0.3,
      }),
    );
    expect(provenance.predictionComparison).toEqual(
      expect.objectContaining({
        submitted: expect.objectContaining({
          answer: { redacted: true, reason: 'encrypted_field' },
          additionalComments: { redacted: true, reason: 'encrypted_field' },
          importance: 80,
          conviction: 70,
        }),
        changedFields: ['answer', 'additionalComments', 'importance'],
        redactedFields: ['answer', 'additionalComments'],
      }),
    );
    expect(JSON.stringify(provenance)).not.toContain('private');
  });

  it('omits prediction values when comparison consent is disabled', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
        surveyResponseState: {
          answers: { q1: { value: 'Final answer' } },
          additionalComments: {},
          importance: {},
          conviction: {},
          interviewProvenance: {
            q1: {
              includeAiProvenance: true,
              includePredictionComparison: false,
              source: { platform: 'claude', modelId: 'claude-example' },
              originalPrediction: { answer: 'Original prediction', confidence: 0.4 },
            },
          },
        } as never,
      }),
    );

    expect(result.responses![0].interviewProvenance).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({ platform: 'claude', modelId: 'claude-example' }),
      }),
    );
    expect(result.responses![0].interviewProvenance).not.toHaveProperty('originalPrediction');
    expect(result.responses![0].interviewProvenance).not.toHaveProperty('predictionComparison');
  });

  it('captures final plaintext values before response encryption replaces them', () => {
    const slice = {
      answers: { q1: { value: 'Final private answer', encrypted: true } },
      additionalComments: { q1: { value: 'Final private note', encrypted: true } },
      importance: {},
      conviction: {},
      interviewProvenance: {
        q1: { includePredictionComparison: true, originalPrediction: { answer: 'Original' } },
        q2: { includePredictionComparison: false, originalPrediction: { answer: 'Ignored' } },
      },
    };

    const captured = captureInterviewPredictionComparisonSubmissions(slice, ['q1', 'q2']);

    expect((captured.interviewProvenance as Record<string, any>).q1.submissionValueSnapshot).toEqual({
      answer: 'Final private answer',
      additionalComments: 'Final private note',
    });
    expect((captured.interviewProvenance as Record<string, any>).q2).not.toHaveProperty('submissionValueSnapshot');
    expect(slice.interviewProvenance.q1).not.toHaveProperty('submissionValueSnapshot');
  });

  it('submits an opted-in responder name without leaking opted-out model provenance', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
        surveyResponseState: {
          answers: { q1: { value: 'Reviewed answer' } },
          additionalComments: {},
          importance: {},
          conviction: {},
          interviewProvenance: {
            q1: {
              includeAiProvenance: false,
              responderName: 'Ada Example',
              source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
            },
          },
        } as never,
      }),
    );

    expect(result.responses![0]).toMatchObject({
      answer: expect.objectContaining({ value: 'Reviewed answer' }),
      responderName: 'Ada Example',
    });
    expect(result.responses![0]).not.toHaveProperty('interviewProvenance');
  });

  it('importance falls back to conviction when null', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'rating', prompt: 'Rate' }],
        surveyResponseState: {
          answers: { q1: { value: 7 } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        getConvictionFromSlice: () => 8,
        getImportanceFromSlice: () => null,
      }),
    );

    expect(result.responses![0].importance).toBe(8);
    expect(result.responses![0].conviction).toBe(8);
  });

  it('single-question mode returns flat response', () => {
    const result = buildResponsePayload(
      defaultOpts({
        singleQuestionMode: true,
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Tell me' }],
        surveyResponseState: {
          answers: { q1: { value: 'hello' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        questionID: 'q1',
        timeStamp: expect.any(Number),
        answer: expect.objectContaining({ value: 'hello' }),
      }),
    );
    expect(result).not.toHaveProperty('responses');
  });

  it('single-question mode returns empty entry when no responses', () => {
    const result = buildResponsePayload(
      defaultOpts({
        singleQuestionMode: true,
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Tell me' }],
        surveyResponseState: {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({
          value: '',
          encrypted: false,
        }),
      }),
    );
  });

  it('sets encryptionGateId only when field is encrypted', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Encrypted?' }],
        surveyResponseState: {
          answers: { q1: { value: 'Yes', encrypted: true, hash: 'abc' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        resolveFieldEncryptionGateId: () => 'gate-1',
      }),
    );

    expect(result.responses![0].answer.encryptionGateId).toBe('gate-1');
    expect(result.responses![0].answer.encrypted).toBe(true);
  });

  it('does not set encryptionGateId when field is not encrypted', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Plain?' }],
        surveyResponseState: {
          answers: { q1: { value: 'No' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        resolveFieldEncryptionGateId: () => 'gate-1',
      }),
    );

    expect(result.responses![0].answer.encryptionGateId).toBeNull();
    expect(result.responses![0].answer.encrypted).toBe(false);
  });

  it('does not mark empty additional comments encrypted in submitted payload', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Encrypted answer' }],
        surveyResponseState: {
          answers: {
            q1: { value: '*', encrypted: true, encryptedPortion: 'answer-envelope', hash: 'answer-hash' },
          },
          additionalComments: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate', encryptedPortion: '', hash: '' },
          },
          importance: {},
          conviction: {},
        },
        resolveFieldEncryptionAudience: (_field, _qid, fieldKey) => (fieldKey === 'additional' ? 'gate' : 'self'),
        resolveFieldEncryptionGateId: () => 'gate-1',
      }),
    );

    expect(result.responses![0].answer).toEqual(
      expect.objectContaining({
        encrypted: true,
        encryptedPortion: 'answer-envelope',
      }),
    );
    expect(result.responses![0].additional).toEqual(
      expect.objectContaining({
        value: '',
        encrypted: false,
        encryptionGateId: null,
        encryptedPortion: '',
      }),
    );
  });

  it('filters to answered questions when pool is empty (synthesized candidates)', () => {
    const result = buildResponsePayload(
      defaultOpts({
        questionPool: [],
        pileQuestions: [],
        surveyResponseState: {
          answers: { q1: { value: 'a' }, q2: { value: '' } },
          additionalComments: { q3: { value: 'note' } },
          importance: {},
          conviction: {},
        },
      }),
    );

    expect(result.responses!).toHaveLength(2);
    expect(result.responses!.map((response) => response.questionID)).toEqual(['q1', 'q3']);
  });

  it('includes surveyTitle from metadata when available', () => {
    const result = buildResponsePayload(
      defaultOpts({
        getSurveyMetadataForJson: () => ({ surveyTitle: 'My Survey', sessionName: 'session-a' }),
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Q' }],
        surveyResponseState: {
          answers: { q1: { value: 'Yes' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      }),
    );

    expect(result.surveyTitle).toBe('My Survey');
    expect(result.sessionName).toBe('session-a');
  });

  it('single-question mode resolves sessionName from question pool first', () => {
    const result = buildResponsePayload(
      defaultOpts({
        singleQuestionMode: true,
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Q', sessionName: 'pool-session' }],
        surveyResponseState: {
          answers: { q1: { value: 'hi' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        resolveSessionContext: () => ({ sessionName: 'context-session' }),
      }),
    );

    expect(result.sessionName).toBe('pool-session');
  });
});
