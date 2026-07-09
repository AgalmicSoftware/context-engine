import {
  resolveUserPageQuestionPromptText,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageSbtDisplayState,
  resolveUserPageSurveyCountDisplayState,
  resolveUserPageSurveyCreatedCardState,
  resolveUserPageSurveyPreviewDisplayState,
  resolveUserPageSurveyResponseCardState,
  resolveUserPageSurveySectionDisplayState,
  shortenUserPageQuestionId,
} from './userPageSectionDisplayHelpers';

describe('userPageSectionDisplayHelpers', () => {
  it('resolves question text and compact ids', () => {
    expect(resolveUserPageQuestionPromptText({ question: '  Question text  ', prompt: 'Prompt text' })).toBe(
      'Question text',
    );
    expect(resolveUserPageQuestionPromptText({ question: '   ', prompt: '  Prompt text  ' })).toBe('Prompt text');
    expect(resolveUserPageQuestionPromptText({ question: 123, prompt: null })).toBe('');
    expect(shortenUserPageQuestionId('12345678901234567890')).toBe('12345678901234567890');
    expect(shortenUserPageQuestionId('123456789012345678901')).toBe('12345678...678901');
  });

  it('builds created survey card state from previews or question ids', () => {
    expect(
      resolveUserPageSurveyCreatedCardState({
        survey: {
          tags: ['tag-a'],
          documentURLs: ['https://example.test/doc'],
          questionIDs: ['q-one', 'q-two'],
          slug: ' Survey Session ',
        },
      }),
    ).toEqual({
      hasDocURLs: true,
      hasExpandContent: true,
      hasQuestionIDs: true,
      hasTags: true,
      questionPreviewEntries: [
        { id: 'q-one', text: '' },
        { id: 'q-two', text: '' },
      ],
      surveyLinkSlug: 'Survey Session',
    });

    expect(
      resolveUserPageSurveyCreatedCardState({
        survey: {
          questionPreviews: [{ id: 'preview-one', text: 'Preview text' }],
        },
      }),
    ).toEqual({
      hasDocURLs: false,
      hasExpandContent: false,
      hasQuestionIDs: false,
      hasTags: false,
      questionPreviewEntries: [{ id: 'preview-one', text: 'Preview text' }],
      surveyLinkSlug: '',
    });
  });

  it('resolves survey preview, count, and response card display state', () => {
    expect(
      resolveUserPageSurveyPreviewDisplayState({
        actionsClassName: 'survey-preview-actions',
        baseClassName: 'survey-preview',
        interactive: true,
      }),
    ).toEqual({
      className: 'survey-preview survey-preview-actions',
      style: { cursor: 'pointer' },
    });
    expect(
      resolveUserPageSurveyCountDisplayState({
        count: 7,
        countOnlyClassName: 'survey-count-only',
        infoClassName: 'survey-info',
      }),
    ).toEqual({
      ariaLabel: '7 questions',
      className: 'survey-info survey-count-only',
      title: '7 questions',
    });
    expect(
      resolveUserPageSurveyResponseCardState({
        questionArray: [{ id: 'q-one' }],
        survey: {
          tags: ['tag-a'],
          documentURLs: ['https://example.test/doc'],
        },
      }),
    ).toEqual({
      hasDocURLs: true,
      hasResponses: true,
      hasTags: true,
    });
  });

  it('resolves survey, question, and SBT section empty states', () => {
    expect(
      resolveUserPageSurveySectionDisplayState({
        surveyCreationInfo: [{ id: 'created-survey' }],
        surveyResponseInfo: [{ id: 'response-survey' }],
      }),
    ).toEqual({
      hasCreatedSurveys: true,
      hasSurveyResponses: true,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(
      resolveUserPageSurveySectionDisplayState({
        isDeepScanning: true,
        surveyCreationInfo: [],
        surveyResponseInfo: [],
        surveyResponsesLoadingEmpty: true,
        surveysCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedSurveys: false,
      hasSurveyResponses: false,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(
      resolveUserPageQuestionSectionDisplayState({
        questionCreationInfo: [],
        questionResponseInfo: [],
        questionResponsesLoadingEmpty: true,
        questionsCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedQuestions: false,
      hasQuestionResponses: false,
      shouldRenderQuestionResponsesEmptyText: false,
      shouldRenderQuestionsCreatedEmptyText: true,
    });
    expect(
      resolveUserPageSbtDisplayState({
        isSBTCacheReady: false,
        loadingSBTs: false,
        sbtList: [],
        sbtSectionLoadingEmpty: true,
      }),
    ).toEqual({
      hasSbts: false,
      shouldRenderMainEmptyText: false,
      shouldRenderModalEmptyText: false,
      shouldRenderModalSpinner: true,
    });
  });
});
