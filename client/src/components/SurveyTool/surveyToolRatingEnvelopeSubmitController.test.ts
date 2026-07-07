import {
  RATING_FIELD_SPECS,
  buildRatingBaseline,
  pickAudienceForRatingEncryption,
  processRatingEnvelopesForSubmit,
  shouldEncryptRatingForQid,
} from './surveyToolRatingEnvelopeSubmitController';
import type { RatingEnvelopeContext, RatingEnvelopeDeps } from './surveyToolRatingEnvelopeSubmitController';

type TestFieldState = {
  encrypted?: boolean;
  encryptionAudience?: string;
};

type TestSlice = {
  answers?: Record<string, TestFieldState>;
  additionalComments?: Record<string, TestFieldState>;
};

type TestRatingResponse = Record<string, unknown> & {
  additional?: TestFieldState;
  answer?: TestFieldState;
  conviction?: number | null;
  convictionEncrypted?: string;
  importance?: number | null;
  importanceEncrypted?: string;
  questionID?: string;
  questionId?: string;
};

const buildMockDeps = (overrides: Partial<RatingEnvelopeDeps> = {}): RatingEnvelopeDeps => ({
  isQuestionLockedForResponse: () => false,
  resolveFieldEncryptionAudience: () => 'self',
  getEffectiveRecipientsForQid: () => [],
  getEffectiveRecipientsForField: () => [],
  getDefaultResponseEncryptionAudienceForQid: () => 'self',
  buildLitEncryptionOptionsForRecipients: () => ({ lit: true }),
  encryptEnvelopeValue: jest.fn(async (value) => `encrypted:${value}`),
  getImportanceFromResponse: (r) => (typeof r.importance === 'number' ? r.importance : null),
  getConvictionFromResponse: (r) => (typeof r.conviction === 'number' ? r.conviction : null),
  ...overrides,
});

const makeSlice = (overrides: Partial<TestSlice> = {}): TestSlice => ({
  answers: {},
  additionalComments: {},
  ...overrides,
});

const makeContext = (overrides: Partial<RatingEnvelopeContext> = {}): RatingEnvelopeContext => ({
  sliceForSubmit: makeSlice(),
  userAnswersSource: null,
  questionResponses: [],
  changedMapForSubmit: {},
  encryptionBaseOpts: {
    provider: { name: 'provider' },
    account: '0xabc',
    chainId: 11155420,
    surveyId: 'survey-1',
    kind: 'response',
    hasher: { name: 'hasher' },
  },
  ...overrides,
});

describe('surveyToolRatingEnvelopeSubmitController', () => {
  describe('RATING_FIELD_SPECS', () => {
    it('has exactly importance and conviction entries', () => {
      expect(RATING_FIELD_SPECS).toHaveLength(2);
      expect(RATING_FIELD_SPECS).toEqual([
        { fieldKey: 'importance', envelopeKey: 'importanceEncrypted' },
        { fieldKey: 'conviction', envelopeKey: 'convictionEncrypted' },
      ]);
    });
  });

  describe('buildRatingBaseline', () => {
    it('returns empty map for null and undefined source', () => {
      expect(buildRatingBaseline(null, buildMockDeps()).size).toBe(0);
      expect(buildRatingBaseline(undefined, buildMockDeps()).size).toBe(0);
    });

    it('returns empty map for empty responses array', () => {
      const result = buildRatingBaseline({ responses: [] }, buildMockDeps());

      expect(result.size).toBe(0);
    });

    it('extracts importance and conviction plaintext values from responses', () => {
      const result = buildRatingBaseline(
        {
          responses: [{ questionID: 'Q1', importance: 8, conviction: 3 }],
        },
        buildMockDeps(),
      );

      expect(result.get('q1')).toMatchObject({
        importance: 8,
        conviction: 3,
      });
    });

    it('extracts importanceEncrypted and convictionEncrypted strings', () => {
      const result = buildRatingBaseline(
        {
          responses: [
            {
              questionID: 'Q1',
              importanceEncrypted: 'enc-importance',
              convictionEncrypted: 'enc-conviction',
            },
          ],
        },
        buildMockDeps(),
      );

      expect(result.get('q1')).toMatchObject({
        importanceEncrypted: 'enc-importance',
        convictionEncrypted: 'enc-conviction',
      });
    });

    it('skips responses with no qid', () => {
      const result = buildRatingBaseline(
        {
          responses: [
            { questionID: '', importance: 1, conviction: 1 },
            { conviction: 5 },
            { questionID: 'Q1', importance: 2, conviction: 4 },
          ],
        },
        buildMockDeps(),
      );

      expect(result.size).toBe(1);
      expect(result.has('q1')).toBe(true);
    });

    it('skips responses where all values are null or empty', () => {
      const result = buildRatingBaseline(
        {
          responses: [
            {
              questionID: 'Q1',
              importance: null,
              conviction: null,
              importanceEncrypted: '',
              convictionEncrypted: '',
            },
          ],
        },
        buildMockDeps(),
      );

      expect(result.size).toBe(0);
    });

    it('normalizes qid to lowercase', () => {
      const result = buildRatingBaseline(
        {
          responses: [{ questionId: 'MiXeD-QID', importance: 4, conviction: 7 }],
        },
        buildMockDeps(),
      );

      expect(result.has('mixed-qid')).toBe(true);
      expect(result.has('MiXeD-QID')).toBe(false);
    });
  });

  describe('pickAudienceForRatingEncryption', () => {
    it('returns self for empty qid', () => {
      const result = pickAudienceForRatingEncryption('', makeSlice(), buildMockDeps());

      expect(result).toEqual({ audience: 'self', recipients: [] });
    });

    it('returns gate when question is locked', () => {
      const result = pickAudienceForRatingEncryption(
        'Q1',
        makeSlice(),
        buildMockDeps({
          isQuestionLockedForResponse: () => true,
          getEffectiveRecipientsForQid: () => ['0xLocked'],
        }),
      );

      expect(result).toEqual({
        audience: 'gate',
        recipients: ['0xLocked'],
      });
    });

    it('returns gate when answer field is encrypted with gate audience', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, encryptionAudience: 'gate' },
        },
      });

      const result = pickAudienceForRatingEncryption(
        'Q1',
        slice,
        buildMockDeps({
          resolveFieldEncryptionAudience: (_field, _qid, fieldKey) => (fieldKey === 'answer' ? 'gate' : 'self'),
          getEffectiveRecipientsForField: () => ['0xAnswerGate'],
        }),
      );

      expect(result).toEqual({
        audience: 'gate',
        recipients: ['0xAnswerGate'],
      });
    });

    it('returns self when answer field is encrypted with self audience', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, encryptionAudience: 'self' },
        },
      });

      const result = pickAudienceForRatingEncryption(
        'Q1',
        slice,
        buildMockDeps({
          resolveFieldEncryptionAudience: () => 'self',
          getDefaultResponseEncryptionAudienceForQid: () => 'gate',
          getEffectiveRecipientsForQid: () => ['0xDefaultGate'],
        }),
      );

      expect(result).toEqual({
        audience: 'self',
        recipients: [],
      });
    });

    it('returns gate when additional field is encrypted with gate audience', () => {
      const slice = makeSlice({
        additionalComments: {
          q1: { encrypted: true, encryptionAudience: 'gate' },
        },
      });

      const result = pickAudienceForRatingEncryption(
        'Q1',
        slice,
        buildMockDeps({
          resolveFieldEncryptionAudience: (_field, _qid, fieldKey) => (fieldKey === 'additional' ? 'gate' : 'self'),
          getEffectiveRecipientsForField: () => ['0xAdditionalGate'],
        }),
      );

      expect(result).toEqual({
        audience: 'gate',
        recipients: ['0xAdditionalGate'],
      });
    });

    it('falls back to default audience when no fields are encrypted', () => {
      const result = pickAudienceForRatingEncryption(
        'Q1',
        makeSlice(),
        buildMockDeps({
          getDefaultResponseEncryptionAudienceForQid: () => 'gate',
          getEffectiveRecipientsForQid: () => ['0xDefaultGate'],
        }),
      );

      expect(result).toEqual({
        audience: 'gate',
        recipients: ['0xDefaultGate'],
      });
    });
  });

  describe('shouldEncryptRatingForQid', () => {
    it('returns true when question is locked', () => {
      const result = shouldEncryptRatingForQid(
        'Q1',
        {},
        makeSlice(),
        buildMockDeps({ isQuestionLockedForResponse: () => true }),
      );

      expect(result).toBe(true);
    });

    it('returns true when answer state has encrypted flag', () => {
      const result = shouldEncryptRatingForQid(
        'Q1',
        {},
        makeSlice({
          answers: {
            q1: { encrypted: true },
          },
        }),
        buildMockDeps(),
      );

      expect(result).toBe(true);
    });

    it('returns true when additional state has encrypted flag', () => {
      const result = shouldEncryptRatingForQid(
        'Q1',
        {},
        makeSlice({
          additionalComments: {
            q1: { encrypted: true },
          },
        }),
        buildMockDeps(),
      );

      expect(result).toBe(true);
    });

    it('returns true when payload answer is encrypted', () => {
      const result = shouldEncryptRatingForQid('Q1', { answer: { encrypted: true } }, makeSlice(), buildMockDeps());

      expect(result).toBe(true);
    });

    it('returns false when nothing is encrypted', () => {
      const result = shouldEncryptRatingForQid('Q1', {}, makeSlice(), buildMockDeps());

      expect(result).toBe(false);
    });
  });

  describe('processRatingEnvelopesForSubmit', () => {
    it('skips questions with no qid', async () => {
      const encryptEnvelopeValue = jest.fn(async (value) => `encrypted:${value}`);
      const questionResponses: TestRatingResponse[] = [{ importance: 5, conviction: 2 }];

      const result = await processRatingEnvelopesForSubmit(
        makeContext({ questionResponses }),
        buildMockDeps({ encryptEnvelopeValue }),
      );

      expect(result).toEqual({
        processed: true,
        questionsProcessed: 0,
        questionsEncrypted: 0,
      });
      expect(encryptEnvelopeValue).not.toHaveBeenCalled();
    });

    it('carries forward baseline envelopes on non-rating edits', async () => {
      const encryptEnvelopeValue = jest.fn(async (value) => `encrypted:${value}`);
      const respObj: TestRatingResponse = { questionID: 'Q1', importance: null, conviction: null };

      await processRatingEnvelopesForSubmit(
        makeContext({
          userAnswersSource: {
            responses: [
              {
                questionID: 'Q1',
                importance: 4,
                conviction: 6,
                importanceEncrypted: 'baseline-importance',
                convictionEncrypted: 'baseline-conviction',
              },
            ],
          },
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { answer: true },
          },
        }),
        buildMockDeps({ encryptEnvelopeValue }),
      );

      expect(respObj.importanceEncrypted).toBe('baseline-importance');
      expect(respObj.convictionEncrypted).toBe('baseline-conviction');
      expect(encryptEnvelopeValue).not.toHaveBeenCalled();
    });

    it('preserves baseline plaintext values for non-changed fields', async () => {
      const respObj: TestRatingResponse = { questionID: 'Q1' };

      const result = await processRatingEnvelopesForSubmit(
        makeContext({
          userAnswersSource: {
            responses: [
              {
                questionID: 'Q1',
                importance: 9,
                conviction: 7,
              },
            ],
          },
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { answer: true },
          },
        }),
        buildMockDeps(),
      );

      expect(respObj).toMatchObject({
        importance: 9,
        conviction: 7,
      });
      expect(result.questionsEncrypted).toBe(0);
    });

    it('clears stale envelopes for changed fields when not encrypting', async () => {
      const encryptEnvelopeValue = jest.fn(async (value) => `encrypted:${value}`);
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: null,
        conviction: 3,
        importanceEncrypted: 'stale-importance',
        convictionEncrypted: 'keep-conviction',
      };

      await processRatingEnvelopesForSubmit(
        makeContext({
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { importance: true },
          },
        }),
        buildMockDeps({ encryptEnvelopeValue }),
      );

      expect(respObj.importanceEncrypted).toBe('');
      expect(respObj.convictionEncrypted).toBe('keep-conviction');
      expect(encryptEnvelopeValue).not.toHaveBeenCalled();
    });

    it('encrypts importance and conviction when encryption is active', async () => {
      const encryptEnvelopeValue = jest.fn(
        async (value: unknown, _opts?: Record<string, unknown>) => `encrypted:${value}`,
      );
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: 8,
        conviction: 5,
      };

      const result = await processRatingEnvelopesForSubmit(
        makeContext({
          sliceForSubmit: makeSlice({
            answers: {
              q1: { encrypted: true, encryptionAudience: 'self' },
            },
          }),
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { importance: true, conviction: true },
          },
        }),
        buildMockDeps({ encryptEnvelopeValue }),
      );

      expect(respObj.importanceEncrypted).toBe('encrypted:8');
      expect(respObj.convictionEncrypted).toBe('encrypted:5');
      expect(encryptEnvelopeValue).toHaveBeenCalledTimes(2);
      expect(encryptEnvelopeValue.mock.calls[0]?.[1]).toMatchObject({
        surveyId: 'survey-1',
        qId: 'importance:q1',
      });
      expect(encryptEnvelopeValue.mock.calls[1]?.[1]).toMatchObject({
        surveyId: 'survey-1',
        qId: 'conviction:q1',
      });
      expect(result.questionsEncrypted).toBe(1);
    });

    it('sets plaintext to null after envelope encryption', async () => {
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: 6,
        conviction: 4,
      };

      await processRatingEnvelopesForSubmit(
        makeContext({
          sliceForSubmit: makeSlice({
            answers: {
              q1: { encrypted: true, encryptionAudience: 'self' },
            },
          }),
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { importance: true, conviction: true },
          },
        }),
        buildMockDeps(),
      );

      expect(respObj.importance).toBeNull();
      expect(respObj.conviction).toBeNull();
    });

    it('throws when Lit recipients are missing for gated encryption', async () => {
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: 6,
      };

      await expect(
        processRatingEnvelopesForSubmit(
          makeContext({
            sliceForSubmit: makeSlice({
              answers: {
                q1: { encrypted: true, encryptionAudience: 'gate' },
              },
            }),
            questionResponses: [respObj],
            changedMapForSubmit: {
              q1: { importance: true },
            },
          }),
          buildMockDeps({
            resolveFieldEncryptionAudience: () => 'gate',
            getEffectiveRecipientsForField: () => [],
          }),
        ),
      ).rejects.toThrow('Missing Lit recipients for gated rating encryption (q1).');
    });

    it('throws when Lit hooks are unavailable', async () => {
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: 6,
      };

      await expect(
        processRatingEnvelopesForSubmit(
          makeContext({
            sliceForSubmit: makeSlice({
              answers: {
                q1: { encrypted: true, encryptionAudience: 'gate' },
              },
            }),
            questionResponses: [respObj],
            changedMapForSubmit: {
              q1: { importance: true },
            },
          }),
          buildMockDeps({
            resolveFieldEncryptionAudience: () => 'gate',
            getEffectiveRecipientsForField: () => ['0xGate'],
            buildLitEncryptionOptionsForRecipients: () => null,
          }),
        ),
      ).rejects.toThrow('Lit hooks unavailable; cannot encrypt gated rating.');
    });

    it('serializes encryption calls', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const callOrder: string[] = [];
      const encryptEnvelopeValue = jest.fn(async (_value: unknown, opts?: Record<string, unknown>) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        callOrder.push(String(opts?.qId));
        await Promise.resolve();
        inFlight -= 1;
        return `encrypted:${opts?.qId}`;
      });
      const respObj: TestRatingResponse = {
        questionID: 'Q1',
        importance: 1,
        conviction: 2,
      };

      await processRatingEnvelopesForSubmit(
        makeContext({
          sliceForSubmit: makeSlice({
            answers: {
              q1: { encrypted: true, encryptionAudience: 'self' },
            },
          }),
          questionResponses: [respObj],
          changedMapForSubmit: {
            q1: { importance: true, conviction: true },
          },
        }),
        buildMockDeps({ encryptEnvelopeValue }),
      );

      expect(maxInFlight).toBe(1);
      expect(callOrder).toEqual(['importance:q1', 'conviction:q1']);
    });

    it('returns correct counts in result', async () => {
      const respOne: TestRatingResponse = { questionID: 'Q1', importance: 3 };
      const respTwo: TestRatingResponse = { questionID: 'Q2', importance: 7 };
      const respNoQid: TestRatingResponse = { importance: 9 };

      const result = await processRatingEnvelopesForSubmit(
        makeContext({
          sliceForSubmit: makeSlice({
            answers: {
              q2: { encrypted: true, encryptionAudience: 'self' },
            },
          }),
          questionResponses: [respOne, respTwo, respNoQid],
          changedMapForSubmit: {
            q2: { importance: true },
          },
        }),
        buildMockDeps(),
      );

      expect(result).toEqual({
        processed: true,
        questionsProcessed: 2,
        questionsEncrypted: 1,
      });
    });
  });
});
