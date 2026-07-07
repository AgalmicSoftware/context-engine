import {
  buildSurveyResultsFilterSummaryDisplayPlan,
  buildSurveyResultsStatusMessagesDisplayPlan,
} from './surveyResultsFilterStatusController';

describe('surveyResultsFilterStatusController', () => {
  describe('buildSurveyResultsStatusMessagesDisplayPlan', () => {
    it('shows an alert only while filter loading is inactive', () => {
      expect(
        buildSurveyResultsStatusMessagesDisplayPlan({
          alertMessage: 'No filtered questions to export.',
          filterLoading: false,
        }),
      ).toEqual({
        alertMessage: 'No filtered questions to export.',
        showAlert: true,
        showFilterLoading: false,
      });

      expect(
        buildSurveyResultsStatusMessagesDisplayPlan({
          alertMessage: 'Hidden during loading.',
          filterLoading: true,
        }),
      ).toEqual({
        alertMessage: 'Hidden during loading.',
        showAlert: false,
        showFilterLoading: true,
      });
    });

    it('normalizes empty alert states without inventing display text', () => {
      expect(
        buildSurveyResultsStatusMessagesDisplayPlan({
          alertMessage: null,
          filterLoading: 0,
        }),
      ).toEqual({
        alertMessage: '',
        showAlert: false,
        showFilterLoading: false,
      });
    });
  });

  describe('buildSurveyResultsFilterSummaryDisplayPlan', () => {
    it('uses question-mode filtered counts and clamps stale values to visible totals', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'questions',
          totalQuestionsCount: 3,
          totalResponsesCount: 5,
          filteredQuestionsCount: 42,
          filteredResponsesCount: 7,
          aggregatorEntriesCount: 2,
          areSummaryCountsHydrated: true,
        }),
      ).toEqual({
        displayedTotalQuestionsCount: 3,
        displayedTotalResponsesCount: 5,
        normalizedFilteredQuestionsCount: 3,
        normalizedFilteredResponsesCount: 5,
        showFilteredCountSpinner: false,
      });
    });

    it('falls back to visible aggregator keys for question-mode filtered question counts', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'questions',
          totalQuestionsCount: 8,
          totalResponsesCount: 10,
          filteredQuestionsCount: null,
          filteredResponsesCount: 4,
          aggregatorEntriesCount: 6,
          areSummaryCountsHydrated: true,
        }),
      ).toEqual({
        displayedTotalQuestionsCount: 8,
        displayedTotalResponsesCount: 10,
        normalizedFilteredQuestionsCount: 6,
        normalizedFilteredResponsesCount: 4,
        showFilteredCountSpinner: false,
      });
    });

    it('uses survey aggregate entries with a total-count fallback', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'survey',
          surveyViewMode: 'aggregate',
          totalQuestionsCount: 9,
          totalResponsesCount: 12,
          filteredResponsesCount: 3,
          aggregatorEntriesCount: 0,
          areSummaryCountsHydrated: true,
        }),
      ).toEqual({
        displayedTotalQuestionsCount: 9,
        displayedTotalResponsesCount: 12,
        normalizedFilteredQuestionsCount: 9,
        normalizedFilteredResponsesCount: 3,
        showFilteredCountSpinner: false,
      });

      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'survey',
          surveyViewMode: 'aggregate',
          totalQuestionsCount: 9,
          totalResponsesCount: 12,
          filteredResponsesCount: 3,
          aggregatorEntriesCount: 4,
          areSummaryCountsHydrated: true,
        }).normalizedFilteredQuestionsCount,
      ).toBe(4);
    });

    it('keeps survey individuals on the survey question total', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'survey',
          surveyViewMode: 'individuals',
          totalQuestionsCount: 7,
          totalResponsesCount: 11,
          filteredQuestionsCount: 1,
          filteredResponsesCount: 2,
          aggregatorEntriesCount: 3,
          areSummaryCountsHydrated: true,
        }),
      ).toEqual({
        displayedTotalQuestionsCount: 7,
        displayedTotalResponsesCount: 11,
        normalizedFilteredQuestionsCount: 7,
        normalizedFilteredResponsesCount: 2,
        showFilteredCountSpinner: false,
      });
    });

    it('shows summary spinners while loading or before hydration settles', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'questions',
          totalQuestionsCount: 0,
          totalResponsesCount: 0,
          filteredQuestionsCount: null,
          filteredResponsesCount: 0,
          filterLoading: false,
          areSummaryCountsHydrated: false,
        }).showFilteredCountSpinner,
      ).toBe(true);

      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'questions',
          totalQuestionsCount: 2,
          totalResponsesCount: 3,
          filteredQuestionsCount: 2,
          filteredResponsesCount: 3,
          filterLoading: true,
          areSummaryCountsHydrated: true,
        }).showFilteredCountSpinner,
      ).toBe(true);
    });

    it('normalizes invalid and negative totals to zero', () => {
      expect(
        buildSurveyResultsFilterSummaryDisplayPlan({
          viewMode: 'questions',
          totalQuestionsCount: -2,
          totalResponsesCount: 'not-a-number',
          filteredQuestionsCount: -1,
          filteredResponsesCount: -4,
          aggregatorEntriesCount: -3,
          areSummaryCountsHydrated: true,
        }),
      ).toEqual({
        displayedTotalQuestionsCount: 0,
        displayedTotalResponsesCount: 0,
        normalizedFilteredQuestionsCount: 0,
        normalizedFilteredResponsesCount: 0,
        showFilteredCountSpinner: false,
      });
    });
  });
});
