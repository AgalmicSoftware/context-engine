// Submit pipeline order: prepareJsonAndHash -> buildResponsePayload (research snapshot)
// -> processRatingEnvelopesForSubmit (encrypts and nulls top-level ratings).
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

it('an "Only me" question with research consent does not publish its encrypted ratings in plaintext', async () => {
  const slice = {
    // State after field encryption (surveyQuestionsSubmitRuntime.ts:372-395): answer masked,
    // ratings still plaintext in the slice, research snapshot kept from before encryption.
    answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{"v":1}', encryptionAudience: 'self' } },
    additionalComments: {},
    importance: { q1: 9 },
    conviction: { q1: 2 },
    interviewProvenance: {
      q1: {
        includePredictionComparison: true,
        originalPrediction: { answer: 'Agree', importance: 7, conviction: 3 },
        submissionValueSnapshot: { answer: 'Agree' },
      },
    },
  };
  const response = buildResponsePayload(opts(slice as never)).responses![0] as Record<string, unknown>;
  await processRatingEnvelopesForSubmit(
    {
      sliceForSubmit: slice as never,
      userAnswersSource: null,
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
    {
      isQuestionLockedForResponse: () => false,
      resolveFieldEncryptionAudience: (field) => String(field.encryptionAudience || 'self'),
      getEffectiveRecipientsForQid: () => [],
      getEffectiveRecipientsForField: () => [],
      getDefaultResponseEncryptionAudienceForQid: () => 'self',
      buildLitEncryptionOptionsForRecipients: () => null,
      encryptEnvelopeValue: async () => '{"v":1,"recipients":[{"type":"self-eip712-v1"}]}',
      getImportanceFromResponse: (r) => (typeof r.importance === 'number' ? r.importance : null),
      getConvictionFromResponse: (r) => (typeof r.conviction === 'number' ? r.conviction : null),
    },
  );
  // The top-level ratings were moved into envelopes...
  expect(response.importance).toBeNull();
  expect(response.importanceEncrypted).toEqual(expect.any(String));
  const research = JSON.stringify(response.interviewProvenance);
  // ...but the public research metadata must not repeat them in plaintext.
  expect(research).not.toMatch(/"importance":9/);
  expect(research).not.toMatch(/"conviction":2/);
});
