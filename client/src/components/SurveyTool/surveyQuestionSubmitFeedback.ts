export type TransientSubmitFeedbackStatePatch = {
  submissionError: string;
  pileSubmitTempText?: string | null;
};

export const buildTransientSubmitFeedbackState = ({
  message = '',
  mirrorToPileSubmitText = false,
}: {
  message?: string | null;
  mirrorToPileSubmitText?: boolean;
} = {}): TransientSubmitFeedbackStatePatch => {
  const nextMessage = String(message || '').trim();
  if (mirrorToPileSubmitText) {
    return {
      submissionError: nextMessage,
      pileSubmitTempText: nextMessage || null,
    };
  }

  return {
    submissionError: nextMessage,
  };
};

export const buildClearedTransientSubmitFeedbackState = ({
  mirrorToPileSubmitText = false,
}: {
  mirrorToPileSubmitText?: boolean;
} = {}): TransientSubmitFeedbackStatePatch => {
  if (mirrorToPileSubmitText) {
    return {
      submissionError: '',
      pileSubmitTempText: null,
    };
  }

  return {
    submissionError: '',
  };
};

export const normalizeTransientSubmitFeedbackDurationMs = (durationMs: unknown = 2000): number =>
  Math.max(1000, Number(durationMs) || 2000);

export const buildQuestionPoolPendingSubmitFeedbackMessage = ({
  pendingCount = 0,
}: {
  pendingCount?: unknown;
} = {}): string => {
  const nextPendingCount = Number(pendingCount || 0);
  const questionLabel = nextPendingCount === 1 ? 'question' : 'questions';
  return `Loading ${nextPendingCount} more ${questionLabel}...`;
};
