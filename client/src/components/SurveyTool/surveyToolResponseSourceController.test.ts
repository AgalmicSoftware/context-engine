import {
  areSurveyResponsesConsistent,
  resolveSurveyBaselineSourceSlice,
  resolveSurveyUserAnswersSlice,
} from './surveyToolResponseSourceController';

describe('surveyToolResponseSourceController', () => {
  it('reuses a memoized user-answer slice when the source object is unchanged', () => {
    const userAnswers = { responses: [{ questionID: 'q1' }] };
    const cachedSlice = { answers: { q1: { value: 'cached' } } };
    const buildSliceFromUserAnswers = jest.fn();

    expect(resolveSurveyUserAnswersSlice({
      userAnswers,
      userAnswersSliceCache: {
        source: userAnswers,
        value: cachedSlice,
      },
      buildSliceFromUserAnswers,
    })).toEqual({
      slice: cachedSlice,
      nextCache: {
        source: userAnswers,
        value: cachedSlice,
      },
      reusedMemo: true,
    });

    expect(buildSliceFromUserAnswers).not.toHaveBeenCalled();
  });

  it('resolves the baseline slice from user answers before falling back to local cache', () => {
    const userAnswers = { responses: [{ questionID: 'q1' }] };
    const builtSlice = {
      answers: { q1: { value: 'from-user' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const buildSliceFromUserAnswers = jest.fn(() => builtSlice);
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q1: { value: 'from-cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(resolveSurveyBaselineSourceSlice({
      editBaseline: null,
      allowLocalCache: true,
      userAnswers,
      userAnswersSliceCache: null,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      baselineSlice: builtSlice,
      nextUserAnswersSliceCache: {
        source: userAnswers,
        value: builtSlice,
      },
      source: 'user-answers',
    });

    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith(userAnswers);
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
  });

  it('falls back to local cache when allowed and there is no baseline or user answer source', () => {
    const localCacheSlice = {
      answers: { q1: { value: 'from-cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    expect(resolveSurveyBaselineSourceSlice({
      editBaseline: null,
      allowLocalCache: true,
      userAnswers: null,
      userAnswersSliceCache: null,
      buildSliceFromUserAnswers: jest.fn(),
      buildSliceFromLocalCache: jest.fn(() => localCacheSlice),
    })).toEqual({
      baselineSlice: localCacheSlice,
      nextUserAnswersSliceCache: {
        source: null,
        value: null,
      },
      source: 'local-cache',
    });
  });

  it('keeps a decrypted edit baseline ahead of stale self and cache fallback sources', () => {
    const editBaseline = {
      answers: {
        q1: {
          value: 'decrypted answer',
          encrypted: false,
          encryptedPortion: 'answer-env',
        },
      },
      importance: { q1: 6 },
      conviction: { q1: 8 },
      additionalComments: {
        q1: {
          value: 'decrypted note',
          encrypted: false,
          encryptedPortion: 'note-env',
        },
      },
    };
    const userAnswers = { responses: [{ questionID: 'q1' }] };
    const userAnswersSliceCache = {
      source: { responses: [{ questionID: 'old-q' }] },
      value: {
        answers: { q1: { value: 'stale cached self' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    };
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q1: { value: 'stale local cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(resolveSurveyBaselineSourceSlice({
      editBaseline,
      allowLocalCache: true,
      userAnswers,
      userAnswersSliceCache,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      baselineSlice: editBaseline,
      nextUserAnswersSliceCache: userAnswersSliceCache,
      source: 'edit-baseline',
    });

    expect(buildSliceFromUserAnswers).not.toHaveBeenCalled();
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
  });

  it('treats missing plaintext ratings as consistent when the latest response carries encrypted rating envelopes', () => {
    const latest = {
      responses: [{
        questionID: 'q1',
        answer: { value: 'same' },
        additional: { value: '' },
        importanceEncrypted: 'imp-env',
        convictionEncrypted: 'conv-env',
      }],
    };

    expect(areSurveyResponsesConsistent({
      latest,
      editBaseline: {
        answers: { q1: { value: 'same', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
      },
      renderedIds: ['q1'],
      buildSliceFromUserAnswers: jest.fn(() => ({
        answers: { q1: { value: 'same' } },
        additionalComments: { q1: { value: '' } },
        importance: {},
        conviction: {},
      })),
      valuesEqual: (left, right) => left === right,
    })).toBe(true);
  });

  it('detects mismatched answer values even when other fields match', () => {
    expect(areSurveyResponsesConsistent({
      latest: {
        responses: [{
          questionID: 'q1',
          answer: { value: 'new' },
          additional: { value: '' },
        }],
      },
      editBaseline: {
        answers: { q1: { value: 'old', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      },
      renderedIds: ['q1'],
      buildSliceFromUserAnswers: jest.fn(() => ({
        answers: { q1: { value: 'new' } },
        additionalComments: { q1: { value: '' } },
        importance: {},
        conviction: {},
      })),
      valuesEqual: (left, right) => left === right,
    })).toBe(false);
  });
});
