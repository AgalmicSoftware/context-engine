import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsQuestionSummary, {
  buildSurveyResultsQuestionSummaryRenderModel,
  countSurveyResultsViewableResponses,
} from './SurveyResultsQuestionSummary';

const mockSingleQuestionResponse = jest.fn((props: any) => (
  <div data-testid="single-question-response">{props.allResponses?.[0]?.response?.answer?.value || ''}</div>
));

jest.mock('./SingleQuestionResponse', () => (props: any) => {
  mockSingleQuestionResponse(props);
  return <div data-testid="single-question-response">{props.allResponses?.[0]?.response?.answer?.value || ''}</div>;
});

const styleMap = {
  aggregatorDarkCardBody: 'aggregatorDarkCardBody',
  aggregatorSummaryCard: 'aggregatorSummaryCard',
  biggerIcon: 'biggerIcon',
  headerLeft: 'headerLeft',
  questionBookmarkButton: 'questionBookmarkButton',
  questionBookmarkIcon: 'questionBookmarkIcon',
  questionExpandIcon: 'questionExpandIcon',
  questionSummaryHeader: 'questionSummaryHeader',
  questionSummaryHeaderIcons: 'questionSummaryHeaderIcons',
  questionTitle: 'questionTitle',
  responseCountContainer: 'responseCountContainer',
  responseCountIcon: 'responseCountIcon',
  responseCountNumber: 'responseCountNumber',
  surveyResultsCollapse: 'surveyResultsCollapse',
  surveyResultsOverride: 'surveyResultsOverride',
};

const responseCardProps = {
  aggregatorContainerClassName: 'aggregatorContainerClassName',
  aggregatorFreeformAnswerClassName: 'aggregatorFreeformAnswerClassName',
  aggregatorParagraphClassName: 'aggregatorParagraphClassName',
  aggregatorTextClassName: 'aggregatorTextClassName',
  bodyClassName: 'bodyClassName',
  containerClassName: 'containerClassName',
  iconButtonClassName: 'iconButtonClassName',
  linksContainerClassName: 'linksContainerClassName',
};

describe('SurveyResultsQuestionSummary', () => {
  beforeEach(() => {
    mockSingleQuestionResponse.mockClear();
  });

  it('counts only latest visible selected-question responses', () => {
    expect(
      countSurveyResultsViewableResponses(
        [
          {
            responder: '0xaaa',
            timestamp: 1,
            response: { answer: { value: 'Older visible answer' } },
          },
          {
            responder: '0xaaa',
            timestamp: 2,
            response: { answer: { value: '   ' } },
          },
          {
            responder: '0xbbb',
            timestamp: 1,
            response: { answer: { encrypted: true, value: '*' } },
          },
          {
            responder: '0xccc',
            timestamp: 1,
            response: { answer: { value: 'Visible answer' } },
          },
        ],
        'freeform',
      ),
    ).toBe(1);
  });

  it('assembles selected-question display data with decrypted overrides', () => {
    const applyDecryptedOverrideToResponse = jest.fn(({ response }) => ({
      ...(response || {}),
      answer: { value: 'Decrypted answer' },
    }));
    const getLockedResponseKey = jest.fn(() => 'locked-key');

    const model = buildSurveyResultsQuestionSummaryRenderModel({
      activeQuestionToggles: { q1: true },
      applyDecryptedOverrideToResponse,
      bookmarkedQuestionIDs: ['q1'],
      getLockedResponseKey,
      networkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Explain the selected result',
          type: 'binary',
        },
      },
      questionId: 'q1',
      responses: [
        {
          responder: '0xaaa',
          response: { answer: { encrypted: true, value: '*' } },
        },
      ],
      surveyId: 'survey-1',
    });

    expect(model).toEqual(
      expect.objectContaining({
        bookmarked: true,
        domId: 'questionCard-q1',
        isActive: true,
        metadataMissing: false,
        questionPrompt: 'Explain the selected result',
        resolvedQuestionType: 'binary',
        viewableResponsesCount: 1,
      }),
    );
    expect(model.displayResponses[0].response).toEqual({
      answer: { value: 'Decrypted answer' },
    });
    expect(getLockedResponseKey).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 'q1',
        responder: '0xaaa',
        surveyId: 'survey-1',
      }),
    );
  });

  it('renders the selected result card and preserves handler wiring', () => {
    const onToggleBookmark = jest.fn();
    const onToggleSummary = jest.fn();

    render(
      <SurveyResultsQuestionSummary
        activeQuestionToggles={{ q1: true }}
        activeSessionSlug="session-one"
        applyDecryptedOverrideToResponse={({ response }) => ({
          ...(response as Record<string, unknown>),
          answer: { value: 'Decrypted answer' },
        })}
        bookmarkedQuestionIDs={['q1']}
        bookmarkIconStyle={{ cursor: 'pointer' }}
        getFallbackQuestion={(questionId) => ({ id: questionId, prompt: 'Unknown question' })}
        getLockedResponseKey={() => 'locked-key'}
        getResponseCardProps={() => responseCardProps}
        metadataMissingStyle={{ fontStyle: 'italic' }}
        network={{ id: 84532 }}
        networkQuestions={{
          q1: {
            id: 'q1',
            prompt: 'Explain the selected result',
            sessionSlug: 'session-one',
            type: 'binary',
          },
        }}
        onToggleBookmark={onToggleBookmark}
        onToggleSummary={onToggleSummary}
        questionId="q1"
        responses={[
          {
            responder: '0xaaa',
            response: { answer: { encrypted: true, value: '*' } },
          },
        ]}
        styleMap={styleMap}
        surveyId="survey-1"
      />,
    );

    expect(screen.getByText('Explain the selected result')).toBeInTheDocument();
    expect(screen.getByTestId('single-question-response')).toHaveTextContent('Decrypted answer');
    expect(mockSingleQuestionResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'session-one',
        aggregatorResponseMode: true,
        network: { id: 84532 },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark' }));
    expect(onToggleBookmark).toHaveBeenCalledWith('q1');

    fireEvent.click(screen.getByText('Explain the selected result').closest('.questionSummaryHeader') as HTMLElement);
    expect(onToggleSummary).toHaveBeenCalledWith('q1');
  });
});
