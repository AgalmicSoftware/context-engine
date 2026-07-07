export type PileHydrationExecutionPlan = {
  shouldSkipDuplicateSignature: boolean;
  shouldUpdateResultSignature: boolean;
  nextResultSignature: string;
  shouldInitializeResponses: boolean;
  rehydrateOptions: {
    requestEpoch: number | null;
    forceOverwriteDraft: boolean;
    resetAutoDecryptLedger: boolean;
    autoDecryptReason: string;
    autoDecryptResetReason: string;
  };
};

export const buildPileQuestionSetHydrationPlan = ({
  requestEpoch = null,
  resultSignature = '',
  lastResultSignature = '',
  initializeResponses = true,
  forceOverwriteDraft = false,
  resetAutoDecryptLedger = false,
  autoDecryptReason = 'pile-hydration',
  autoDecryptResetReason = 'pile-hydration-reset',
}: {
  requestEpoch?: number | null;
  resultSignature?: string | null;
  lastResultSignature?: string | null;
  initializeResponses?: boolean;
  forceOverwriteDraft?: boolean;
  resetAutoDecryptLedger?: boolean;
  autoDecryptReason?: string | null;
  autoDecryptResetReason?: string | null;
} = {}): PileHydrationExecutionPlan => {
  const normalizedResultSignature = String(resultSignature || '');
  const normalizedLastResultSignature = String(lastResultSignature || '');
  const shouldSkipDuplicateSignature =
    !!normalizedResultSignature && normalizedResultSignature === normalizedLastResultSignature;
  const shouldUpdateResultSignature =
    !!normalizedResultSignature && normalizedResultSignature !== normalizedLastResultSignature;

  return {
    shouldSkipDuplicateSignature,
    shouldUpdateResultSignature,
    nextResultSignature: shouldUpdateResultSignature ? normalizedResultSignature : normalizedLastResultSignature,
    shouldInitializeResponses: !!initializeResponses,
    rehydrateOptions: {
      requestEpoch,
      forceOverwriteDraft: !!forceOverwriteDraft,
      resetAutoDecryptLedger: !!resetAutoDecryptLedger,
      autoDecryptReason: String(autoDecryptReason || 'pile-hydration'),
      autoDecryptResetReason: String(autoDecryptResetReason || 'pile-hydration-reset'),
    },
  };
};
