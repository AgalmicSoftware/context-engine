import {
  computeChangedQidsAndFields,
  pickBestField,
  pickBestNumber,
} from './surveyToolChangedFieldsController';

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
