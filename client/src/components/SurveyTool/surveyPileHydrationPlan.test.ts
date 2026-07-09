import { buildPileQuestionSetHydrationPlan } from './surveyPileHydrationPlan';

describe('surveyPileHydrationPlan', () => {
  it('skips duplicate pile hydration signatures while preserving prior signature state', () => {
    expect(
      buildPileQuestionSetHydrationPlan({
        requestEpoch: 7,
        resultSignature: 'same-signature',
        lastResultSignature: 'same-signature',
        initializeResponses: true,
        forceOverwriteDraft: true,
        resetAutoDecryptLedger: true,
      }),
    ).toEqual({
      shouldSkipDuplicateSignature: true,
      shouldUpdateResultSignature: false,
      nextResultSignature: 'same-signature',
      shouldInitializeResponses: true,
      rehydrateOptions: {
        requestEpoch: 7,
        forceOverwriteDraft: true,
        resetAutoDecryptLedger: true,
        autoDecryptReason: 'pile-hydration',
        autoDecryptResetReason: 'pile-hydration-reset',
      },
    });
  });

  it('updates pile hydration signatures and preserves rehydrate options for follow-up work', () => {
    expect(
      buildPileQuestionSetHydrationPlan({
        requestEpoch: 9,
        resultSignature: 'next-signature',
        lastResultSignature: 'prev-signature',
        initializeResponses: false,
        forceOverwriteDraft: false,
        resetAutoDecryptLedger: true,
        autoDecryptReason: 'pile-refresh',
        autoDecryptResetReason: 'pile-refresh-reset',
      }),
    ).toEqual({
      shouldSkipDuplicateSignature: false,
      shouldUpdateResultSignature: true,
      nextResultSignature: 'next-signature',
      shouldInitializeResponses: false,
      rehydrateOptions: {
        requestEpoch: 9,
        forceOverwriteDraft: false,
        resetAutoDecryptLedger: true,
        autoDecryptReason: 'pile-refresh',
        autoDecryptResetReason: 'pile-refresh-reset',
      },
    });
  });

  it('keeps the last signature untouched when no result signature is provided', () => {
    expect(
      buildPileQuestionSetHydrationPlan({
        requestEpoch: 3,
        resultSignature: '',
        lastResultSignature: 'prev-signature',
      }),
    ).toEqual({
      shouldSkipDuplicateSignature: false,
      shouldUpdateResultSignature: false,
      nextResultSignature: 'prev-signature',
      shouldInitializeResponses: true,
      rehydrateOptions: {
        requestEpoch: 3,
        forceOverwriteDraft: false,
        resetAutoDecryptLedger: false,
        autoDecryptReason: 'pile-hydration',
        autoDecryptResetReason: 'pile-hydration-reset',
      },
    });
  });
});
