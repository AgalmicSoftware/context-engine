import { buildResponsePayload, type BuildResponsePayloadOptions } from './surveyToolResponsePayloadController';
import { getConvictionFromSlice, getImportanceFromSlice } from './surveyToolResponseState';
import { processRatingEnvelopesForSubmit } from './surveyToolRatingEnvelopeSubmitController';

const opts = (
  surveyResponseState: BuildResponsePayloadOptions['surveyResponseState'],
): BuildResponsePayloadOptions => ({
  isStandalone: false,
  singleQuestionMode: false,
  surveyId: 'survey-1',
  account: '0xUser',
  surveyIndex: 0,
  surveyResponseState,
  questionPool: [{ id: 'q1', type: 'binary', prompt: 'Proceed?' }],
  pileQuestions: [],
  resolveFieldEncryptionAudience: (field) =>
    String((field as { encryptionAudience?: string }).encryptionAudience || 'self'),
  getQuestionEncryptionGates: () => [],
  resolveFieldEncryptionGateId: () => null,
  normalizeFieldAudienceMode: () => 'explicit',
  getSurveyMetadataForJson: () => ({ surveyTitle: null, sessionName: '' }),
  resolveSessionContext: () => ({ sessionName: '' }),
  getConvictionFromSlice,
  getImportanceFromSlice,
  sanitizeQuestionPromptForResponsePayload: (q) => String(q.prompt || ''),
});

const ratingDeps = {
  isQuestionLockedForResponse: () => false,
  resolveFieldEncryptionAudience: (field: { encryptionAudience?: unknown }) =>
    String(field.encryptionAudience || 'self'),
  getEffectiveRecipientsForQid: () => [],
  getEffectiveRecipientsForField: () => [],
  getDefaultResponseEncryptionAudienceForQid: () => 'self',
  buildLitEncryptionOptionsForRecipients: () => null,
  encryptEnvelopeValue: async () => '{"v":1,"recipients":[{"type":"self-eip712-v1"}]}',
  getImportanceFromResponse: (r: { importance?: unknown }) => (typeof r.importance === 'number' ? r.importance : null),
  getConvictionFromResponse: (r: { conviction?: unknown }) => (typeof r.conviction === 'number' ? r.conviction : null),
};

const submit = async (slice: Record<string, unknown>, userAnswersSource: unknown = null) => {
  const response = buildResponsePayload(opts(slice as never)).responses![0] as Record<string, unknown>;
  await processRatingEnvelopesForSubmit(
    {
      sliceForSubmit: slice as never,
      userAnswersSource,
      questionResponses: [response as never],
      changedMapForSubmit: { q1: { answer: true, importance: true, conviction: true } },
      encryptionBaseOpts: {
        provider: {},
        account: '0xUser',
        chainId: 1,
        surveyId: 'survey-1',
        kind: 'rating',
        hasher: null,
      },
    },
    ratingDeps as never,
  );
  return response;
};

const provenance = (extra: Record<string, unknown> = {}) => ({
  q1: {
    includePredictionComparison: true,
    originalPrediction: { answer: 'Agree', importance: 7, conviction: 3 },
    submissionValueSnapshot: { answer: 'Agree' },
    ...extra,
  },
});

it('D1 (lane A): an "Only me" question with research consent does not publish its encrypted ratings', async () => {
  const response = await submit({
    answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{"v":1}', encryptionAudience: 'self' } },
    additionalComments: {},
    importance: { q1: 9 },
    conviction: { q1: 2 },
    interviewProvenance: provenance(),
  });
  expect(response.importance).toBeNull();
  expect(response.importanceEncrypted).toEqual(expect.any(String));
  const research = JSON.stringify(response.interviewProvenance);
  expect(research).not.toMatch(/"importance":9/);
  expect(research).not.toMatch(/"conviction":2/);
});

it('R2-D3: public answer and comment keep plaintext ratings in the research data', async () => {
  const response = await submit({
    answers: { q1: { value: 'Agree', encrypted: false } },
    additionalComments: {},
    importance: { q1: 9 },
    conviction: { q1: 2 },
    interviewProvenance: provenance(),
  });
  expect(response.importance).toBe(9);
  expect(response.importanceEncrypted || '').toBe('');
  const p = response.interviewProvenance as Record<string, Record<string, unknown>>;
  expect(p.finalSubmitted).toMatchObject({ importance: 9, conviction: 2 });
  expect(p.originalPrediction).toMatchObject({ importance: 7, conviction: 3 });
  expect(p.predictionComparison).toMatchObject({ submitted: { importance: 9, conviction: 2 } });
});

it('R2-D4: a comment-only lock redacts ratings in research and encrypts them at top level', async () => {
  const response = await submit({
    answers: { q1: { value: 'Agree', encrypted: false } },
    additionalComments: {
      q1: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":1}',
        encryptionAudience: 'self',
        audienceMode: 'explicit',
      },
    },
    importance: { q1: 9 },
    conviction: { q1: 2 },
    interviewProvenance: provenance({ predictionRevisions: [{ revision: 2, importance: 6, conviction: 4 }] }),
  });
  expect(response.importance).toBeNull();
  const research = JSON.stringify(response.interviewProvenance);
  expect(research).not.toMatch(/"importance":(9|7|6)/);
  expect(research).not.toMatch(/"conviction":(2|3|4)/);
  expect(research).toMatch(/"answer":"Agree"/); // the public answer is still shared
});

it('R2-D5: unselected drafts for a locked question redact ratings in original/reviewed/submitted', async () => {
  const response = await submit({
    answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{"v":1}', encryptionAudience: 'self' } },
    additionalComments: {},
    importance: { q1: 9 },
    conviction: { q1: 2 },
    interviewProvenance: provenance({
      unselectedDrafts: [
        {
          questionId: 'q1',
          answerEncrypted: true,
          importance: 8,
          conviction: 1,
          original: { revisions: [{ answer: 'Disagree', importance: 5, conviction: 6 }] },
          submissionValueSnapshot: { answer: 'Agree', importance: 9, conviction: 2 },
        },
      ],
    }),
  });
  const research = JSON.stringify(response.interviewProvenance);
  expect(research).not.toMatch(/"importance":(9|8|5|7)/);
  expect(research).not.toMatch(/"conviction":(2|1|6|3)/);
});

it('R2-D2: ratings that stay encrypted through an existing envelope are not repeated in research', async () => {
  // The answer was saved as "Only me" earlier, so the saved response carries rating envelopes.
  // The user decrypts, makes the answer public, and re-submits with research consent.
  // processRatingEnvelopesForSubmit keeps the ratings encrypted (hasAnyExistingEnvelope),
  // but the research snapshot only looks at the answer/comment locks.
  const saved = {
    questionID: 'q1',
    importance: null,
    conviction: null,
    importanceEncrypted: '{"v":1,"recipients":[{"type":"self-eip712-v1"}]}',
    convictionEncrypted: '{"v":1,"recipients":[{"type":"self-eip712-v1"}]}',
  };
  const response = await submit(
    {
      answers: { q1: { value: 'Agree', encrypted: false } },
      additionalComments: {},
      importance: { q1: 9 },
      conviction: { q1: 2 },
      interviewProvenance: provenance(),
    },
    { responses: [saved] },
  );
  expect(response.importance).toBeNull();
  expect(response.importanceEncrypted).toEqual(expect.any(String));
  const research = JSON.stringify(response.interviewProvenance);
  expect(research).not.toMatch(/"importance":9/);
  expect(research).not.toMatch(/"conviction":2/);
});
