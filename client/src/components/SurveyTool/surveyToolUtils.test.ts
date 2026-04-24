import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
} from './surveyToolViewState.js';

describe('surveyToolUtils helper coverage', () => {
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
