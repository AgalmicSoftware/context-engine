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

    expect(
      resolveSurveyUserAnswersSlice({
        userAnswers,
        userAnswersSliceCache: {
          source: userAnswers,
          value: cachedSlice,
        },
        buildSliceFromUserAnswers,
      }),
    ).toEqual({
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

    expect(
      resolveSurveyBaselineSourceSlice({
        editBaseline: null,
        allowLocalCache: true,
        userAnswers,
        userAnswersSliceCache: null,
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
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

  it('rebuilds recent submitted-response slices instead of reusing stale source memo or cache fallback', () => {
    const staleUserAnswers = { responses: [{ questionID: 'q1', answer: { value: 'stale' } }] };
    const recentUserAnswers = { responses: [{ questionID: 'q1', answer: { value: 'recent' } }] };
    const recentSlice = {
      answers: { q1: { value: 'recent' } },
      importance: { q1: 6 },
      conviction: {},
      additionalComments: {},
    };
    const staleCachedSlice = {
      answers: { q1: { value: 'stale memo' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const buildSliceFromUserAnswers = jest.fn(() => recentSlice);
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q1: { value: 'stale local cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(
      resolveSurveyBaselineSourceSlice({
        editBaseline: null,
        allowLocalCache: true,
        userAnswers: recentUserAnswers,
        userAnswersSliceCache: {
          source: staleUserAnswers,
          value: staleCachedSlice,
        },
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      baselineSlice: recentSlice,
      nextUserAnswersSliceCache: {
        source: recentUserAnswers,
        value: recentSlice,
      },
      source: 'user-answers',
    });

    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith(recentUserAnswers);
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
  });

  it('falls back to local cache when allowed and there is no baseline or user answer source', () => {
    const localCacheSlice = {
      answers: { q1: { value: 'from-cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    expect(
      resolveSurveyBaselineSourceSlice({
        editBaseline: null,
        allowLocalCache: true,
        userAnswers: null,
        userAnswersSliceCache: null,
        buildSliceFromUserAnswers: jest.fn(),
        buildSliceFromLocalCache: jest.fn(() => localCacheSlice),
      }),
    ).toEqual({
      baselineSlice: localCacheSlice,
      nextUserAnswersSliceCache: {
        source: null,
        value: null,
      },
      source: 'local-cache',
    });
  });

  it('keeps stale decrypted local cache fallback disabled until the parent opts in', () => {
    const staleDecryptedCacheSlice = {
      answers: {
        q1: {
          encrypted: false,
          encryptedPortion: 'stale-answer-envelope',
          value: 'stale decrypted answer',
        },
      },
      importance: { q1: 5 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: {
          encrypted: false,
          encryptedPortion: 'stale-note-envelope',
          value: 'stale decrypted note',
        },
      },
    };
    const buildSliceFromLocalCache = jest.fn(() => staleDecryptedCacheSlice);

    expect(
      resolveSurveyBaselineSourceSlice({
        editBaseline: null,
        allowLocalCache: false,
        userAnswers: null,
        userAnswersSliceCache: null,
        buildSliceFromUserAnswers: jest.fn(),
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      baselineSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      nextUserAnswersSliceCache: {
        source: null,
        value: null,
      },
      source: 'empty',
    });

    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
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

    expect(
      resolveSurveyBaselineSourceSlice({
        editBaseline,
        allowLocalCache: true,
        userAnswers,
        userAnswersSliceCache,
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      baselineSlice: editBaseline,
      nextUserAnswersSliceCache: userAnswersSliceCache,
      source: 'edit-baseline',
    });

    expect(buildSliceFromUserAnswers).not.toHaveBeenCalled();
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
  });

  it('treats missing plaintext ratings as consistent when the latest response carries encrypted rating envelopes', () => {
    const latest = {
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'same' },
          additional: { value: '' },
          importanceEncrypted: 'imp-env',
          convictionEncrypted: 'conv-env',
        },
      ],
    };

    expect(
      areSurveyResponsesConsistent({
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
      }),
    ).toBe(true);
  });

  it('rejects stale decrypted cache values when the latest submitted source is still masked', () => {
    expect(
      areSurveyResponsesConsistent({
        latest: {
          responses: [
            {
              questionID: 'q1',
              answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
              additional: { value: '*', encrypted: true, encryptedPortion: 'note-env' },
              importanceEncrypted: 'imp-env',
              convictionEncrypted: 'conv-env',
            },
          ],
        },
        editBaseline: {
          answers: { q1: { value: 'stale decrypted answer', encrypted: false } },
          additionalComments: { q1: { value: 'stale decrypted note', encrypted: false } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
        },
        renderedIds: ['q1'],
        buildSliceFromUserAnswers: jest.fn(() => ({
          answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'answer-env' } },
          additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'note-env' } },
          importance: {},
          conviction: {},
        })),
        valuesEqual: (left, right) => left === right,
      }),
    ).toBe(false);
  });

  it('detects mismatched answer values even when other fields match', () => {
    expect(
      areSurveyResponsesConsistent({
        latest: {
          responses: [
            {
              questionID: 'q1',
              answer: { value: 'new' },
              additional: { value: '' },
            },
          ],
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
      }),
    ).toBe(false);
  });
});
