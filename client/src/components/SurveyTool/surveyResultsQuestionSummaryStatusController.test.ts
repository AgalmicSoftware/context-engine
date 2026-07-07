import {
  buildSurveyResultsQuestionListDisplayPlan,
  buildSurveyResultsQuestionSummariesListDisplayPlan,
  buildSurveyResultsQuestionSummaryDisplayPlan,
} from './surveyResultsQuestionSummaryStatusController';

describe('surveyResultsQuestionSummaryStatusController', () => {
  describe('buildSurveyResultsQuestionSummaryDisplayPlan', () => {
    it('uses selected question metadata when it is available', () => {
      expect(
        buildSurveyResultsQuestionSummaryDisplayPlan({
          questionId: 'q1',
          question: {
            id: 'q1',
            prompt: 'Explain the tradeoff',
            type: 'freeform',
          },
        }),
      ).toEqual({
        metadataMissing: false,
        questionPrompt: 'Explain the tradeoff',
      });
    });

    it('falls back to a stable unknown-question prompt when selected metadata is missing', () => {
      expect(
        buildSurveyResultsQuestionSummaryDisplayPlan({
          questionId: 'Q1',
          question: null,
        }),
      ).toEqual({
        metadataMissing: true,
        questionPrompt: 'Unknown question: Q1',
      });
    });
  });

  describe('buildSurveyResultsQuestionSummariesListDisplayPlan', () => {
    it('shows summaries and keeps the display active when entries are present', () => {
      const entries: Array<[string, unknown]> = [['q1', [{ answer: 'yes' }]]];

      expect(
        buildSurveyResultsQuestionSummariesListDisplayPlan({
          entries,
          filterLoading: false,
        }),
      ).toEqual({
        emptyMessage: 'No results yet.',
        entries,
        errorMessage: '',
        isInert: false,
        showEmptyState: false,
        showError: false,
        showSummaries: true,
      });
    });

    it('shows the empty state only when not loading or showing an error', () => {
      expect(
        buildSurveyResultsQuestionSummariesListDisplayPlan({
          entries: [],
          filterLoading: false,
        }),
      ).toMatchObject({
        emptyMessage: 'No results yet.',
        isInert: true,
        showEmptyState: true,
        showError: false,
        showSummaries: false,
      });

      expect(
        buildSurveyResultsQuestionSummariesListDisplayPlan({
          entries: [],
          filterLoading: true,
        }),
      ).toMatchObject({
        isInert: true,
        showEmptyState: false,
        showError: false,
        showSummaries: false,
      });
    });

    it('shows an error message instead of the empty state', () => {
      expect(
        buildSurveyResultsQuestionSummariesListDisplayPlan({
          entries: [],
          errorMessage: 'Results could not be displayed.',
          filterLoading: false,
        }),
      ).toMatchObject({
        errorMessage: 'Results could not be displayed.',
        isInert: true,
        showEmptyState: false,
        showError: true,
        showSummaries: false,
      });
    });

    it('treats invalid entries as an inert empty list', () => {
      expect(
        buildSurveyResultsQuestionSummariesListDisplayPlan({
          entries: null,
          filterLoading: false,
        }),
      ).toMatchObject({
        entries: [],
        isInert: true,
        showEmptyState: true,
        showSummaries: false,
      });
    });
  });

  describe('buildSurveyResultsQuestionListDisplayPlan', () => {
    it('describes empty, loading, and populated question-list states without mutating inputs', () => {
      const args = { aggregatorEntriesCount: 0, filterLoading: false };

      expect(buildSurveyResultsQuestionListDisplayPlan(args)).toEqual({
        isInert: true,
        shouldRenderQuestionTable: false,
        showEmptyState: true,
      });
      expect(args).toEqual({ aggregatorEntriesCount: 0, filterLoading: false });

      expect(
        buildSurveyResultsQuestionListDisplayPlan({
          aggregatorEntriesCount: 0,
          filterLoading: true,
        }),
      ).toEqual({
        isInert: true,
        shouldRenderQuestionTable: true,
        showEmptyState: false,
      });

      expect(
        buildSurveyResultsQuestionListDisplayPlan({
          aggregatorEntriesCount: 2,
          filterLoading: false,
        }),
      ).toEqual({
        isInert: false,
        shouldRenderQuestionTable: true,
        showEmptyState: false,
      });
    });
  });
});
