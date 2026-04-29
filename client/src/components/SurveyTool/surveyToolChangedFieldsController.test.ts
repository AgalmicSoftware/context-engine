import { describe, it, expect, vi } from 'vitest';
import {
  buildIndexedQuestionEntryKeys,
  computeChangedQidsAndFields,
  orchestrateGetChangedQidsAndFields,
  pickBestField,
  pickBestNumber,
} from './surveyToolChangedFieldsController';
import { buildSurveyResponseSliceSignature } from './surveyToolSignatures';

const hasMeaningfulFieldValue = (v: any) => {
  if (!v || typeof v !== 'object') return false;
  const val = v.value;
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
const normalizeKey = (value: string) => String(value || '').trim().toLowerCase();
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
  baselineSlice: {
    answers: Record<string, any>;
    importance: Record<string, any>;
    conviction: Record<string, any>;
    additionalComments: Record<string, any>;
  };
  currentSlice: {
    answers: Record<string, any>;
    importance: Record<string, any>;
    conviction: Record<string, any>;
    additionalComments: Record<string, any>;
  };
  ids?: Set<string>;
  ratingEnvelopeQids?: Set<string>;
  resolveAudience?: (field: any) => string;
  resolveGateId?: (field: any) => string;
  resolveAudienceMode?: (field: any) => string;
}) => computeChangedQidsAndFields({
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
      expect(pickBestField(
        { q1: { value: 'a' } },
        new Map(),
        'q2',
        hasMeaningfulFieldValue,
      )).toEqual({});
    });

    it('returns exact key match with meaningful value immediately', () => {
      expect(pickBestField(
        { q1: { value: 'answer' } },
        new Map([['q1', ['q1']]]),
        'q1',
        hasMeaningfulFieldValue,
      ).value).toBe('answer');
    });

    it('prefers first meaningful value over exact empty match', () => {
      expect(pickBestField(
        { q1: {}, Q1: { value: 'better' } },
        new Map([['q1', ['q1', 'Q1']]]),
        'q1',
        hasMeaningfulFieldValue,
      ).value).toBe('better');
    });

    it('falls back to encrypted value when nothing meaningful', () => {
      expect(pickBestField(
        { q1: { encrypted: true, encryptedPortion: 'data' } },
        new Map([['q1', ['q1']]]),
        'q1',
        () => false,
      )).toEqual(expect.objectContaining({
        encrypted: true,
      }));
    });
  });

  describe('pickBestNumber', () => {
    it('returns null when no matching keys', () => {
      expect(pickBestNumber({}, new Map(), 'q1')).toBeNull();
    });

    it('returns exact key numeric value', () => {
      expect(pickBestNumber(
        { q1: 7 },
        new Map([['q1', ['q1']]]),
        'q1',
      )).toBe(7);
    });

    it('skips non-numeric values', () => {
      expect(pickBestNumber(
        { q1: null, Q1: 5 },
        new Map([['q1', ['q1', 'Q1']]]),
        'q1',
      )).toBe(5);
    });
  });

  describe('buildIndexedQuestionEntryKeys', () => {
    it('groups raw keys by normalized question id', () => {
      expect(buildIndexedQuestionEntryKeys(
        { q1: 1, Q1: 2, '  ': 3, q2: 4 },
        normalizeKey,
      )).toEqual(new Map([
        ['q1', ['q1', 'Q1']],
        ['q2', ['q2']],
      ]));
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
      const bumpPerfCounter = vi.fn();

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
      const bumpPerfCounter = vi.fn();
      const getIndexedQuestionEntryKeys = vi.fn(() => {
        throw new Error('unexpected indexing work on scoped cache hit');
      });
      const buildRatingEnvelopeQidSetFromUserAnswers = vi.fn(() => {
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
      const normalizeResponseEncryptionAudience = vi.fn((audience: any, qid: any) => `${qid}:${audience}`);
      const getDefaultResponseEncryptionAudienceForQid = vi.fn(() => 'default-qid');

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
          bumpPerfCounter: vi.fn(),
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
        resolveAudience: (field) => field === baselineAns ? 'audience-a' : 'audience-b',
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
        resolveGateId: (field) => field === baselineAdditional ? 'gate-1' : 'gate-2',
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
        resolveAudienceMode: (field) => field === baselineAdditional ? 'mode-a' : 'mode-b',
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
