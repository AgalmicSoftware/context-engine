import {
  buildDeferredCommitSliderChangeStatePatch,
  buildDeferredCommitSliderInitialState,
  buildDeferredCommitSliderInteractingPatch,
  buildDeferredCommitSliderLiveValuePatch,
} from './deferredCommitSliderHelpers.js';

describe('deferredCommitSliderHelpers', () => {
  it('builds initial and simple slider state patches', () => {
    expect(buildDeferredCommitSliderInitialState(4)).toEqual({
      liveValue: 4,
      isInteracting: false,
    });
    expect(buildDeferredCommitSliderLiveValuePatch(7)).toEqual({
      liveValue: 7,
    });
    expect(buildDeferredCommitSliderInteractingPatch(true)).toEqual({
      isInteracting: true,
    });
  });

  it('builds pointer change patches that enter interaction mode', () => {
    expect(
      buildDeferredCommitSliderChangeStatePatch({
        liveValue: 2,
        normalizedValue: 6,
        isKeyboardEvent: false,
        isInteracting: false,
      }),
    ).toEqual({
      liveValue: 6,
      isInteracting: true,
    });
  });

  it('keeps keyboard and unchanged interaction patches minimal', () => {
    expect(
      buildDeferredCommitSliderChangeStatePatch({
        liveValue: 2,
        normalizedValue: 4,
        isKeyboardEvent: true,
        isInteracting: false,
      }),
    ).toEqual({
      liveValue: 4,
    });
    expect(
      buildDeferredCommitSliderChangeStatePatch({
        liveValue: 4,
        normalizedValue: 4,
        isKeyboardEvent: false,
        isInteracting: true,
      }),
    ).toEqual({});
  });
});
