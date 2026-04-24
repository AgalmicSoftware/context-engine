import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  formatQuestionScanBlockCount,
  isSurveyToolFilterStateActive,
  normalizeSurveyToolFilterState,
  serializeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
} from './surveyToolViewState.js';

describe('surveyToolViewState', () => {
  it('matches pile progress slugs across general alias and empty scope', () => {
    expect(doesQuestionProgressMatchSlug('general', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('GENERAL', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('', 'general')).toBe(true);
    expect(doesQuestionProgressMatchSlug('edge', '')).toBe(false);
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

  it('formats block counts defensively for invalid inputs', () => {
    expect(formatQuestionScanBlockCount('not-a-number')).toBe('0');
    expect(formatQuestionScanBlockCount(1234.9)).toBe('1,234');
  });

  it('keeps full pile loading visible when progress is active and cards are empty', () => {
    expect(shouldShowPileFullLoadingState({
      loading: false,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
    })).toBe(true);
    expect(shouldShowPileFullLoadingState({
      loading: false,
      hasVisibleQuestions: true,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
    })).toBe(false);
  });

  it('allows settled empty piles to exit full-loading even when cache-ready stays false', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: false,
      recentRateLimit: false,
      hasScanOrHydrationWork: false,
      allowUnreadyEmptySettlement: true,
    })).toBe(false);
  });

  it('allows filtered empty piles to exit full-loading while background refresh continues', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
      allowFilteredEmptySettlement: true,
    })).toBe(false);
  });

  it('exits full-loading when a terminal scan error is present', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: false,
      recentRateLimit: false,
      hasScanOrHydrationWork: false,
      hasTerminalScanError: true,
    })).toBe(false);
  });

  it('normalizes legacy empty filter payloads to an inactive empty state', () => {
    const normalized = normalizeSurveyToolFilterState({
      includedSBTs: [],
      excludedSBTs: [],
      onlyVerifiedHumans: false,
      tags: [],
      types: [],
    });

    expect(normalized).toEqual({});
    expect(serializeSurveyToolFilterState(normalized)).toBe('');
    expect(isSurveyToolFilterStateActive(normalized)).toBe(false);
  });

  it('preserves aiTopN and aiCombine only when aiFilter is active', () => {
    const active = normalizeSurveyToolFilterState({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });
    expect(active).toMatchObject({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });
    expect(isSurveyToolFilterStateActive(active)).toBe(true);

    const inactive = normalizeSurveyToolFilterState({
      aiFilter: null,
      aiTopN: 6,
      aiCombine: true,
    });
    expect(inactive).toEqual({});
  });
});
