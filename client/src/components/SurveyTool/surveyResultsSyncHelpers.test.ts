import { isSurveyResultsSourceSynced, isSurveyResultsStateSynced } from './surveyResultsSyncHelpers.js';

describe('surveyResultsSyncHelpers', () => {
  it('requires a local block and network block before a source is synced', () => {
    expect(isSurveyResultsSourceSynced(0, 0, 12)).toBe(false);
    expect(isSurveyResultsSourceSynced(12, 0, 0)).toBe(false);
  });

  it('compares local progress against the network block when no refresh target is set', () => {
    expect(isSurveyResultsSourceSynced(11, 0, 12)).toBe(false);
    expect(isSurveyResultsSourceSynced(12, 0, 12)).toBe(true);
  });

  it('uses a clamped refresh target when one is present', () => {
    expect(isSurveyResultsSourceSynced(9, 10, 12)).toBe(false);
    expect(isSurveyResultsSourceSynced(10, 10, 12)).toBe(true);
    expect(isSurveyResultsSourceSynced(12, 20, 12)).toBe(true);
  });

  it('treats malformed block metadata as missing progress', () => {
    expect(isSurveyResultsSourceSynced('not-a-block', 10, 12)).toBe(false);
    expect(isSurveyResultsSourceSynced(12, Number.POSITIVE_INFINITY, 12)).toBe(true);
    expect(isSurveyResultsSourceSynced(12, 10, Number.NaN)).toBe(false);
  });

  it('requires both question and response sources in question view', () => {
    expect(
      isSurveyResultsStateSynced({
        viewMode: 'questions',
        networkLatestBlock: 12,
        questionLocalBlock: 12,
        responseLocalBlock: 11,
      }),
    ).toBe(false);

    expect(
      isSurveyResultsStateSynced({
        viewMode: 'questions',
        networkLatestBlock: 12,
        questionLocalBlock: 12,
        responseLocalBlock: 12,
      }),
    ).toBe(true);
  });

  it('uses the survey source in survey view', () => {
    expect(
      isSurveyResultsStateSynced({
        viewMode: 'survey',
        networkLatestBlock: 12,
        surveyLocalBlock: 11,
      }),
    ).toBe(false);

    expect(
      isSurveyResultsStateSynced({
        viewMode: 'survey',
        networkLatestBlock: 12,
        surveyLocalBlock: 12,
      }),
    ).toBe(true);
  });
});
