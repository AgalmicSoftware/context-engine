import {
  areEnvelopesEquivalent,
} from './surveyToolUtils.js';
import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
} from './surveyToolViewState.js';

describe('surveyToolUtils helper coverage', () => {
  it('treats empty envelopes as equivalent only when both sides are encrypted', () => {
    expect(areEnvelopesEquivalent('env-a', 'env-a', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('env-a', 'env-b', true, true)).toBe(false);
    expect(areEnvelopesEquivalent('', '', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('', '', true, false)).toBe(false);
    expect(areEnvelopesEquivalent('env-a', '', true, true)).toBe(false);
  });

  it('formats capped question scan progress against the requested total range', () => {
    const display = buildQuestionScanProgressDisplay({
      totalBlocks: 50000,
      requestedTotalBlocks: 234000,
      wasCapped: true,
      scannedBlocks: 50000,
      remainingBlocks: 184000,
    });

    expect(display.metaLeftText).toBe('184,000 blocks left');
    expect(display.metaRightText).toBe('50,000 / 234,000');
    expect(display.percentComplete).toBe(21);
  });
});
