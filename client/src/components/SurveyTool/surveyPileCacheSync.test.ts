import {
  buildPileCacheUpdatePlan,
  hasAnyPileBaselineInput,
  isPileCacheConsistentWithBaseline,
  shouldSeedPileBaselineFromPrefill,
} from './surveyPileCacheSync.js';

describe('surveyPileCacheSync', () => {
  it('builds pile cache update plans for optimistic, reload, live-edit, and loading cases', () => {
    expect(
      buildPileCacheUpdatePlan({
        responseNonceTick: true,
        isOptimistic: true,
        hasLiveEdits: false,
      }),
    ).toEqual({
      action: 'check-optimistic-baseline',
      delayMs: 80,
    });

    expect(
      buildPileCacheUpdatePlan({
        nonceTick: true,
        isOptimistic: false,
        hasLiveEdits: false,
      }),
    ).toEqual({
      action: 'reload',
      delayMs: 80,
    });

    expect(
      buildPileCacheUpdatePlan({
        cacheReadyTick: true,
        isOptimistic: false,
        hasLiveEdits: true,
      }),
    ).toEqual({
      action: 'skip-live-edits',
      delayMs: 80,
    });

    expect(
      buildPileCacheUpdatePlan({
        pileQuestionsLength: 0,
        hasLiveEdits: false,
        isQuestionCacheReady: false,
        loading: false,
      }),
    ).toEqual({
      action: 'show-loading',
      delayMs: 80,
    });
  });

  it('detects whether a pile slice already contains baseline input', () => {
    expect(
      hasAnyPileBaselineInput({
        answers: { q1: { value: '' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }),
    ).toBe(false);

    expect(
      hasAnyPileBaselineInput({
        answers: { q1: { value: 'Answer' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }),
    ).toBe(true);

    expect(
      hasAnyPileBaselineInput({
        answers: {},
        additionalComments: {},
        importance: { q1: 5 },
        conviction: {},
      }),
    ).toBe(true);
  });

  it('seeds pile baseline from prefill only when no baseline, no existing input, and no pending edits exist', () => {
    expect(
      shouldSeedPileBaselineFromPrefill({
        editBaseline: null,
        currentSlice: {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        pendingTotal: 0,
      }),
    ).toBe(true);

    expect(
      shouldSeedPileBaselineFromPrefill({
        editBaseline: { answers: {} },
        currentSlice: {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        pendingTotal: 0,
      }),
    ).toBe(false);

    expect(
      shouldSeedPileBaselineFromPrefill({
        editBaseline: null,
        currentSlice: {
          answers: { q1: { value: 'Draft' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        pendingTotal: 0,
      }),
    ).toBe(false);

    expect(
      shouldSeedPileBaselineFromPrefill({
        editBaseline: null,
        currentSlice: {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        pendingTotal: 1,
      }),
    ).toBe(false);
  });

  it('treats matching optimistic pile cache as consistent, including encrypted rating gaps', () => {
    expect(
      isPileCacheConsistentWithBaseline({
        baseline: {
          answers: {
            q1: { value: '*', encrypted: true, encryptedPortion: 'enc' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false },
          },
          importance: {
            q1: 5,
          },
          conviction: {},
        },
        renderedIds: ['q1'],
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: '*', encrypted: true, encryptedPortion: 'enc' },
              additional: { value: '', encrypted: false },
            },
          },
        },
        account: '0xabc',
      }),
    ).toBe(true);
  });

  it('treats stale cleared pile cache answers as inconsistent with the optimistic baseline', () => {
    expect(
      isPileCacheConsistentWithBaseline({
        baseline: {
          answers: {
            q1: { value: '', encrypted: false },
          },
          additionalComments: {
            q1: { value: '', encrypted: false },
          },
          importance: {},
          conviction: {},
        },
        renderedIds: ['q1'],
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'stale-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
        account: '0xabc',
      }),
    ).toBe(false);
  });
});
