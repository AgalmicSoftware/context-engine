import {
  buildIndexedQuestionEntryKeys,
  computePendingEditStats,
  computeChangedQidsAndFields,
  orchestrateGetChangedQidsAndFields,
  pickBestField,
  pickBestNumber,
  type ResponseFieldState,
  type ResponseSlice,
} from './surveyToolChangedFieldsController';
import { buildSurveyResponseSliceSignature } from './surveyToolSignatures';

const hasMeaningfulFieldValue = (v: unknown) => {
  if (!v || typeof v !== 'object') return false;
  const val = (v as { value?: unknown }).value;
  if (val === undefined || val === null || val === '' || val === '*') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
};

const valuesEqual = (left: unknown, right: unknown) => {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }
  return false;
};

const buildIndexedKeys = () => new Map([['q1', ['q1']]]);
const normalizeKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();
const buildEmptySlice = () => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const computeChangedFields = ({
  baselineSlice,
  currentSlice,
  ids = new Set(['q1']),
  ratingEnvelopeQids = new Set<string>(),
  resolveAudience = () => 'default',
  resolveGateId = () => '',
  resolveAudienceMode = () => 'default',
}: {
  baselineSlice: ResponseSlice;
  currentSlice: ResponseSlice;
  ids?: Set<string>;
  ratingEnvelopeQids?: Set<string>;
  resolveAudience?: (field: ResponseFieldState) => string;
  resolveGateId?: (field: ResponseFieldState) => string;
  resolveAudienceMode?: (field: ResponseFieldState) => string;
}) =>
  computeChangedQidsAndFields({
    ids,
    baselineSlice,
    currentSlice,
    baselineAnswerKeys: buildIndexedKeys(),
    currentAnswerKeys: buildIndexedKeys(),
    baselineAdditionalKeys: buildIndexedKeys(),
    currentAdditionalKeys: buildIndexedKeys(),
    baselineImportanceKeys: buildIndexedKeys(),
    currentImportanceKeys: buildIndexedKeys(),
    baselineConvictionKeys: buildIndexedKeys(),
    currentConvictionKeys: buildIndexedKeys(),
    ratingEnvelopeQids,
    valuesEqual,
    hasMeaningfulFieldValue,
    resolveAudience,
    resolveGateId,
    resolveAudienceMode,
  });

describe('surveyToolChangedFieldsController', () => {
  describe('pickBestField', () => {
    it('returns empty object when no matching keys', () => {
      expect(pickBestField({ q1: { value: 'a' } }, new Map(), 'q2', hasMeaningfulFieldValue)).toEqual({});
    });

    it('returns exact key match with meaningful value immediately', () => {
      expect(
        pickBestField({ q1: { value: 'answer' } }, new Map([['q1', ['q1']]]), 'q1', hasMeaningfulFieldValue).value,
      ).toBe('answer');
    });

    it('prefers first meaningful value over exact empty match', () => {
      expect(
        pickBestField(
          { q1: {}, Q1: { value: 'better' } },
          new Map([['q1', ['q1', 'Q1']]]),
          'q1',
          hasMeaningfulFieldValue,
        ).value,
      ).toBe('better');
    });

    it('falls back to encrypted value when nothing meaningful', () => {
      expect(
        pickBestField(
          { q1: { encrypted: true, encryptedPortion: 'data' } },
          new Map([['q1', ['q1']]]),
          'q1',
          () => false,
        ),
      ).toEqual(
        expect.objectContaining({
          encrypted: true,
        }),
      );
    });
  });

  describe('pickBestNumber', () => {
    it('returns null when no matching keys', () => {
      expect(pickBestNumber({}, new Map(), 'q1')).toBeNull();
    });

    it('returns exact key numeric value', () => {
      expect(pickBestNumber({ q1: 7 }, new Map([['q1', ['q1']]]), 'q1')).toBe(7);
    });

    it('skips non-numeric values', () => {
      expect(pickBestNumber({ q1: null, Q1: 5 }, new Map([['q1', ['q1', 'Q1']]]), 'q1')).toBe(5);
    });
  });

  describe('buildIndexedQuestionEntryKeys', () => {
    it('groups raw keys by normalized question id', () => {
      expect(buildIndexedQuestionEntryKeys({ q1: 1, Q1: 2, '  ': 3, q2: 4 }, normalizeKey)).toEqual(
        new Map([
          ['q1', ['q1', 'Q1']],
          ['q2', ['q2']],
        ]),
      );
    });
  });

  describe('orchestrateGetChangedQidsAndFields', () => {
    it('derives ids from slices when no scoped ids are provided', () => {
      const baselineSlice = {
        ...buildEmptySlice(),
        answers: { Q1: { value: 'old' } },
      };
      const currentSlice = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'new' } },
      };
      const bumpPerfCounter = jest.fn();

      const { result, newCache } = orchestrateGetChangedQidsAndFields(
        {
          surveyIndex: 2,
          currentSlice,
          isLoggedIn: false,
          isLoadingResponse: false,
          scopedIds: new Set(),
          userAnswers: null,
        },
        {
          resolveDiffBaselineSlice: () => baselineSlice,
          getIndexedQuestionEntryKeys: (source) => buildIndexedQuestionEntryKeys(source, normalizeKey),
          getDefaultResponseEncryptionAudience: () => 'default',
          normalizeResponseEncryptionAudience: (audience) => audience,
          getDefaultResponseEncryptionAudienceForQid: () => 'default',
          resolveFieldEncryptionGateId: () => '',
          normalizeFieldAudienceMode: (mode) => mode,
          valuesEqual,
          buildSurveyResponseSliceSignature,
          buildRatingEnvelopeQidSetFromUserAnswers: () => new Set<string>(),
          hasMeaningfulFieldValue,
          bumpPerfCounter,
        },
        null,
      );

      expect(result.changedQids.has('q1')).toBe(true);
      expect(result.changedMap.q1.answer).toBe(1);
      expect(newCache.idsScopeMode).toBe('slice');
      expect(newCache.idsScopeKey).toBe('slice:q1');
      expect(bumpPerfCounter).toHaveBeenCalledWith('getChangedQidsAndFieldsCount');
    });

    it('reuses scoped cache result when filtered signatures match', () => {
      const baselineSliceCached = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same' } },
      };
      const currentSliceCached = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same' } },
      };
      const baselineSliceNext = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same' } },
      };
      const currentSliceNext = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same' } },
      };
      const normalizedIdFilter = new Set(['q1']);
      const cachedResult = { changedQids: new Set<string>(), changedMap: {} };
      const existingCache = {
        surveyIndex: 1,
        currentSlice: currentSliceCached,
        baselineSlice: baselineSliceCached,
        currentSliceSignature: buildSurveyResponseSliceSignature(currentSliceCached, { normalizedIdFilter }),
        baselineSliceSignature: buildSurveyResponseSliceSignature(baselineSliceCached, { normalizedIdFilter }),
        allowLocalCache: true,
        idsScopeKey: 'scope:q1',
        idsScopeMode: 'scope',
        result: cachedResult,
      };
      const bumpPerfCounter = jest.fn();
      const getIndexedQuestionEntryKeys = jest.fn(() => {
        throw new Error('unexpected indexing work on scoped cache hit');
      });
      const buildRatingEnvelopeQidSetFromUserAnswers = jest.fn(() => {
        throw new Error('unexpected rating work on scoped cache hit');
      });

      const orchestration = orchestrateGetChangedQidsAndFields(
        {
          surveyIndex: 1,
          currentSlice: currentSliceNext,
          isLoggedIn: false,
          isLoadingResponse: false,
          scopedIds: new Set(['q1']),
          userAnswers: null,
        },
        {
          resolveDiffBaselineSlice: () => baselineSliceNext,
          getIndexedQuestionEntryKeys,
          getDefaultResponseEncryptionAudience: () => 'default',
          normalizeResponseEncryptionAudience: (audience) => audience,
          getDefaultResponseEncryptionAudienceForQid: () => 'default',
          resolveFieldEncryptionGateId: () => '',
          normalizeFieldAudienceMode: (mode) => mode,
          valuesEqual,
          buildSurveyResponseSliceSignature,
          buildRatingEnvelopeQidSetFromUserAnswers,
          hasMeaningfulFieldValue,
          bumpPerfCounter,
        },
        existingCache,
      );

      expect(orchestration.result).toBe(cachedResult);
      expect(orchestration.newCache).toBe(existingCache);
      expect(getIndexedQuestionEntryKeys).not.toHaveBeenCalled();
      expect(buildRatingEnvelopeQidSetFromUserAnswers).not.toHaveBeenCalled();
      expect(bumpPerfCounter).toHaveBeenNthCalledWith(1, 'getChangedQidsAndFieldsCount');
      expect(bumpPerfCounter).toHaveBeenNthCalledWith(2, 'noopSkipCount');
    });

    it('uses field encryptionAudience values before per-qid defaults', () => {
      const baselineSlice = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same', encrypted: true, encryptionAudience: 'alpha' } },
      };
      const currentSlice = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'same', encrypted: true, encryptionAudience: 'beta' } },
      };
      const normalizeResponseEncryptionAudience = jest.fn((audience: unknown, qid: string) => `${qid}:${audience}`);
      const getDefaultResponseEncryptionAudienceForQid = jest.fn(() => 'default-qid');

      const { result } = orchestrateGetChangedQidsAndFields(
        {
          surveyIndex: 0,
          currentSlice,
          isLoggedIn: false,
          isLoadingResponse: false,
          scopedIds: new Set(['q1']),
          userAnswers: null,
        },
        {
          resolveDiffBaselineSlice: () => baselineSlice,
          getIndexedQuestionEntryKeys: (source) => buildIndexedQuestionEntryKeys(source, normalizeKey),
          getDefaultResponseEncryptionAudience: () => 'default-all',
          normalizeResponseEncryptionAudience,
          getDefaultResponseEncryptionAudienceForQid,
          resolveFieldEncryptionGateId: () => '',
          normalizeFieldAudienceMode: (mode) => mode,
          valuesEqual,
          buildSurveyResponseSliceSignature,
          buildRatingEnvelopeQidSetFromUserAnswers: () => new Set<string>(),
          hasMeaningfulFieldValue,
          bumpPerfCounter: jest.fn(),
        },
        null,
      );

      expect(result.changedQids.has('q1')).toBe(true);
      expect(result.changedMap.q1.encryptedAnswer).toBe(1);
      expect(normalizeResponseEncryptionAudience).toHaveBeenNthCalledWith(1, 'alpha', 'q1');
      expect(normalizeResponseEncryptionAudience).toHaveBeenNthCalledWith(2, 'beta', 'q1');
      expect(getDefaultResponseEncryptionAudienceForQid).toHaveBeenCalled();
    });
  });

  describe('computePendingEditStats', () => {
    it('returns cached result without recomputing when references still match', () => {
      const currentSlice = buildEmptySlice();
      const userAnswers = {};
      const diffCacheRef = {};
      const questionPool = {};
      const pileQuestions = {};
      const result = { total: 3, encrypted: 2 };
      const existingCache = {
        idx: 4,
        diffCacheRef,
        currentSlice,
        userAnswers,
        questionPool,
        pileQuestions,
        questionId: 'q1',
        result,
      };
      const getChangedQidsAndFields = jest.fn(() => ({
        changedQids: new Set<string>(),
        changedMap: {},
      }));
      const buildRatingEnvelopeQidSetFromUserAnswers = jest.fn(() => new Set<string>());

      const stats = computePendingEditStats(
        {
          idx: 4,
          currentSlice,
          userAnswers,
          existingCache,
          diffCacheRef,
          questionPool,
          pileQuestions,
          questionId: 'q1',
        },
        {
          getChangedQidsAndFields,
          isQuestionLockedForResponse: jest.fn(() => false),
          buildRatingEnvelopeQidSetFromUserAnswers,
        },
      );

      expect(stats.result).toBe(result);
      expect(stats.newCache).toBe(existingCache);
      expect(getChangedQidsAndFields).not.toHaveBeenCalled();
      expect(buildRatingEnvelopeQidSetFromUserAnswers).not.toHaveBeenCalled();
    });

    it('computes fresh stats and returns a new cache on cache miss', () => {
      const currentSlice = {
        ...buildEmptySlice(),
        additionalComments: { q1: { value: 'note' } },
      };
      const userAnswers = { cached: false };
      const diffCacheRef = {};
      const questionPool = {};
      const pileQuestions = {};
      const getChangedQidsAndFields = jest.fn(() => ({
        changedQids: new Set(['q1']),
        changedMap: { q1: { additional: 1 } },
      }));

      const stats = computePendingEditStats(
        {
          idx: 1,
          currentSlice,
          userAnswers,
          existingCache: null,
          diffCacheRef,
          questionPool,
          pileQuestions,
          questionId: 'q1',
        },
        {
          getChangedQidsAndFields,
          isQuestionLockedForResponse: jest.fn(() => false),
          buildRatingEnvelopeQidSetFromUserAnswers: jest.fn(() => new Set<string>()),
        },
      );

      expect(getChangedQidsAndFields).toHaveBeenCalledWith(1);
      expect(stats.result).toEqual({ total: 1, encrypted: 0 });
      expect(stats.newCache).toEqual({
        idx: 1,
        diffCacheRef,
        currentSlice,
        userAnswers,
        questionPool,
        pileQuestions,
        questionId: 'q1',
        result: { total: 1, encrypted: 0 },
      });
      expect(stats.newCache.result).toBe(stats.result);
    });

    it('counts questions with encrypted answer edits', () => {
      const currentSlice = {
        ...buildEmptySlice(),
        answers: { q1: { value: 'changed', encrypted: true } },
      };

      const stats = computePendingEditStats(
        {
          idx: 2,
          currentSlice,
          userAnswers: {},
          existingCache: null,
          diffCacheRef: {},
          questionPool: {},
          pileQuestions: {},
          questionId: 'q1',
        },
        {
          getChangedQidsAndFields: jest.fn(() => ({
            changedQids: new Set(['q1']),
            changedMap: { q1: { answer: 1 } },
          })),
          isQuestionLockedForResponse: jest.fn(() => false),
          buildRatingEnvelopeQidSetFromUserAnswers: jest.fn(() => new Set<string>()),
        },
      );

      expect(stats.result).toEqual({ total: 1, encrypted: 1 });
    });

    it('counts rating edits as encrypted when the question is locked or baseline ratings are encrypted', () => {
      const currentSlice = buildEmptySlice();
      const isQuestionLockedForResponse = jest.fn((qid: string) => qid === 'Q1');
      const buildRatingEnvelopeQidSetFromUserAnswers = jest.fn(() => new Set(['q2']));

      const stats = computePendingEditStats(
        {
          idx: 5,
          currentSlice,
          userAnswers: { responses: true },
          existingCache: null,
          diffCacheRef: {},
          questionPool: {},
          pileQuestions: {},
          questionId: 'q1',
        },
        {
          getChangedQidsAndFields: jest.fn(() => ({
            changedQids: new Set(['Q1', ' Q2 ']),
            changedMap: {
              Q1: { importance: 1 },
              ' Q2 ': { conviction: 1 },
            },
          })),
          isQuestionLockedForResponse,
          buildRatingEnvelopeQidSetFromUserAnswers,
        },
      );

      expect(stats.result).toEqual({ total: 2, encrypted: 2 });
      expect(isQuestionLockedForResponse).toHaveBeenCalledTimes(2);
      expect(buildRatingEnvelopeQidSetFromUserAnswers).toHaveBeenCalledWith({ responses: true });
    });

    it('returns zero stats for an empty changed set without building rating envelopes', () => {
      const buildRatingEnvelopeQidSetFromUserAnswers = jest.fn(() => new Set(['q1']));
      const isQuestionLockedForResponse = jest.fn(() => false);

      const stats = computePendingEditStats(
        {
          idx: 6,
          currentSlice: buildEmptySlice(),
          userAnswers: {},
          existingCache: null,
          diffCacheRef: {},
          questionPool: {},
          pileQuestions: {},
          questionId: null,
        },
        {
          getChangedQidsAndFields: jest.fn(() => ({
            changedQids: new Set<string>(),
            changedMap: {},
          })),
          isQuestionLockedForResponse,
          buildRatingEnvelopeQidSetFromUserAnswers,
        },
      );

      expect(stats.result).toEqual({ total: 0, encrypted: 0 });
      expect(buildRatingEnvelopeQidSetFromUserAnswers).not.toHaveBeenCalled();
      expect(isQuestionLockedForResponse).not.toHaveBeenCalled();
    });
  });

  describe('computeChangedQidsAndFields', () => {
    it('detects answer value change', () => {
      const { changedQids, changedMap } = computeChangedFields({
        baselineSlice: {
          answers: { q1: { value: 'old' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: { q1: { value: 'new' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      });

      expect(changedQids.has('q1')).toBe(true);
      expect(changedMap.q1.answer).toBe(1);
    });

    it('detects importance change', () => {
      const { changedQids, changedMap } = computeChangedFields({
        baselineSlice: {
          answers: {},
          importance: { q1: 3 },
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: {},
          importance: { q1: 7 },
          conviction: {},
          additionalComments: {},
        },
      });

      expect(changedQids.has('q1')).toBe(true);
      expect(changedMap.q1.importance).toBe(1);
    });

    it('treats missing rating as unchanged when response is encrypted', () => {
      const { changedQids } = computeChangedFields({
        baselineSlice: {
          answers: { q1: { value: '*', encrypted: true } },
          importance: { q1: 5 },
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: { q1: { value: '*', encrypted: true } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      });

      expect(changedQids.has('q1')).toBe(false);
    });

    it('returns empty sets when nothing changed', () => {
      const baselineSlice = {
        answers: { q1: { value: 'same' } },
        importance: { q1: 5 },
        conviction: { q1: 6 },
        additionalComments: { q1: { value: 'same note' } },
      };

      const { changedQids } = computeChangedFields({
        baselineSlice,
        currentSlice: baselineSlice,
      });

      expect(changedQids.size).toBe(0);
    });

    it('treats missing importance as unchanged when rating envelope exists for the question', () => {
      const { changedQids } = computeChangedFields({
        baselineSlice: {
          answers: { q1: { value: 'a' } },
          importance: { q1: 5 },
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: { q1: { value: 'a' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        ratingEnvelopeQids: new Set(['q1']),
      });

      expect(changedQids.has('q1')).toBe(false);
    });

    it('detects audience change on encrypted answer field', () => {
      const baselineAns = { value: 'x', encrypted: true };
      const currentAns = { value: 'x', encrypted: true };
      const { changedQids, changedMap } = computeChangedFields({
        baselineSlice: {
          answers: { q1: baselineAns },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: { q1: currentAns },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        resolveAudience: (field) => (field === baselineAns ? 'audience-a' : 'audience-b'),
      });

      expect(changedQids.has('q1')).toBe(true);
      expect(changedMap.q1.encryptedAnswer).toBe(1);
    });

    it('detects gate ID change on encrypted additional field', () => {
      const baselineAdditional = { value: 'note', encrypted: true };
      const currentAdditional = { value: 'note', encrypted: true };
      const { changedQids, changedMap } = computeChangedFields({
        baselineSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: { q1: baselineAdditional },
        },
        currentSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: { q1: currentAdditional },
        },
        resolveGateId: (field) => (field === baselineAdditional ? 'gate-1' : 'gate-2'),
      });

      expect(changedQids.has('q1')).toBe(true);
      expect(changedMap.q1.encryptedAdditional).toBe(1);
    });

    it('detects audience mode change on additional field', () => {
      const baselineAdditional = { value: 'note' };
      const currentAdditional = { value: 'note' };
      const { changedQids, changedMap } = computeChangedFields({
        baselineSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: { q1: baselineAdditional },
        },
        currentSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: { q1: currentAdditional },
        },
        resolveAudienceMode: (field) => (field === baselineAdditional ? 'mode-a' : 'mode-b'),
      });

      expect(changedQids.has('q1')).toBe(true);
      expect(changedMap.q1.encryptedAdditional).toBe(1);
    });

    it('handles array answer values with valuesEqual', () => {
      const { changedQids } = computeChangedFields({
        baselineSlice: {
          answers: { q1: { value: ['a', 'b'] } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        currentSlice: {
          answers: { q1: { value: ['a', 'b'] } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      });

      expect(changedQids.has('q1')).toBe(false);
    });
  });
});
