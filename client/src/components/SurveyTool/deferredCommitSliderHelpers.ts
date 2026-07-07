export type DeferredCommitSliderState = {
  liveValue: number;
  isInteracting: boolean;
};

export const buildDeferredCommitSliderInitialState = (liveValue: number): DeferredCommitSliderState => ({
  liveValue,
  isInteracting: false,
});

export const buildDeferredCommitSliderLiveValuePatch = (
  liveValue: number,
): Pick<DeferredCommitSliderState, 'liveValue'> => ({
  liveValue,
});

export const buildDeferredCommitSliderInteractingPatch = (
  isInteracting: boolean,
): Pick<DeferredCommitSliderState, 'isInteracting'> => ({
  isInteracting,
});

export const buildDeferredCommitSliderChangeStatePatch = ({
  liveValue,
  normalizedValue,
  isKeyboardEvent = false,
  isInteracting = false,
}: {
  liveValue: number;
  normalizedValue: number;
  isKeyboardEvent?: boolean;
  isInteracting?: boolean;
}): Partial<DeferredCommitSliderState> => {
  const nextState: Partial<DeferredCommitSliderState> = {};

  if (liveValue !== normalizedValue) {
    nextState.liveValue = normalizedValue;
  }
  if (!isKeyboardEvent && !isInteracting) {
    nextState.isInteracting = true;
  }

  return nextState;
};
