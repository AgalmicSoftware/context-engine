import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageSurveySection from './UserPageSurveySection';

jest.mock('reactstrap', () => ({
  Collapse: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? <div data-testid="collapse">{children}</div> : null,
}));

jest.mock('../SurveyTool/SingleQuestionResponse', () => ({
  __esModule: true,
  default: ({
    canDecryptOtherResponses,
    onDecryptQuestion,
    question,
    questionResponsesNonce,
    responderAddress,
    response,
    sbtCacheRevision,
    sessionSlug,
  }: {
    canDecryptOtherResponses?: boolean;
    onDecryptQuestion?: (...args: unknown[]) => void;
    question?: { id?: string; prompt?: string };
    questionResponsesNonce?: unknown;
    responderAddress?: unknown;
    response?: unknown;
    sbtCacheRevision?: unknown;
    sessionSlug?: unknown;
  }) => {
    const responseRecord =
      response && typeof response === 'object'
        ? (response as {
            additional?: { encrypted?: unknown; value?: unknown };
            answer?: { encrypted?: unknown; value?: unknown };
          })
        : {};

    return (
      <div
        data-testid="survey-question-response"
        data-answer-encrypted={String(!!responseRecord.answer?.encrypted)}
        data-answer-value={String(responseRecord.answer?.value)}
        data-additional-encrypted={String(!!responseRecord.additional?.encrypted)}
        data-additional-value={String(responseRecord.additional?.value)}
        data-can-decrypt={String(canDecryptOtherResponses)}
        data-has-response={String(!!response)}
        data-nonce={String(questionResponsesNonce)}
        data-responder-address={String(responderAddress)}
        data-revision={String(sbtCacheRevision)}
        data-session-slug={String(sessionSlug)}
      >
        {question?.prompt || question?.id}
        <button type="button" onClick={() => onDecryptQuestion?.(question?.id)}>
          decrypt
        </button>
      </div>
    );
  },
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageSurveySection>> = {}) => ({
  detailedSurveyResponseMap: {
    'survey-response': [
      {
        canDecryptOtherResponses: true,
        questionData: { id: 'q-response', prompt: 'Survey response prompt' },
        responseData: { answer: { value: 'yes' }, additional: { value: '' } },
      },
    ],
  },
  expandedSurveyCreatedMap: {
    'survey-created': true,
  },
  expandedSurveyResponseMap: {
    'survey-response': true,
  },
  getSurveyCreatedHref: jest.fn(() => '/survey/survey-created?session=alpha'),
  isSurveyLoadingAny: true,
  onDecryptQuestion: jest.fn(),
  onOpenSurveyResponse: jest.fn((survey: unknown, event: React.MouseEvent<HTMLElement>) => event.stopPropagation()),
  onShowQuestionsTab: jest.fn((event: React.MouseEvent<HTMLElement>) => event.stopPropagation()),
  onSurveyCreatedToggle: jest.fn(),
  onSurveyResponsesSectionToggle: jest.fn(),
  onSurveyResponseToggle: jest.fn(),
  onSurveysCreatedSectionToggle: jest.fn(),
  questionResponsesNonce: 'nonce-1',
  responderAddress: '0xviewer',
  sbtCacheRevision: 'revision-1',
  surveyCreationEntries: [
    {
      documentURLs: ['https://docs.example.test/created'],
      id: 'survey-created',
      questionIDs: ['question-with-a-very-long-id-1234567890'],
      questionPreviews: [{ id: 'question-with-a-very-long-id-1234567890', text: '' }],
      questionsCount: 1,
      slug: 'alpha',
      tags: ['created-tag'],
      title: 'Created survey',
    },
  ],
  surveyResponseEntries: [
    {
      documentURLs: ['https://docs.example.test/response'],
      id: 'survey-response',
      questionsCount: 1,
      slug: 'beta',
      tags: ['response-tag'],
      title: 'Response survey',
    },
  ],
  surveyResponsesLoadingIndicator: <span data-testid="survey-responses-loading">responses loading</span>,
  surveyResponsesSectionToggleState: {
    isOpen: true,
    shouldRenderClosedIcon: false,
    shouldRenderOpenIcon: true,
  },
  surveySectionDisplayState: {
    hasCreatedSurveys: true,
    hasSurveyResponses: true,
    shouldRenderSurveyResponsesEmptyText: false,
    shouldRenderSurveysCreatedEmptyText: false,
  },
  surveysCreatedLoadingIndicator: <span data-testid="surveys-created-loading">created loading</span>,
  surveysCreatedSectionToggleState: {
    isOpen: true,
    shouldRenderClosedIcon: false,
    shouldRenderOpenIcon: true,
  },
  ...overrides,
});

describe('UserPageSurveySection', () => {
  it('renders survey response and created cards with parent-owned boundaries', () => {
    const getSurveyCreatedHref = jest.fn(() => '/survey/survey-created?session=alpha');
    const onDecryptQuestion = jest.fn();
    const onOpenSurveyResponse = jest.fn((survey: unknown, event: React.MouseEvent<HTMLElement>) =>
      event.stopPropagation(),
    );
    const onShowQuestionsTab = jest.fn((event: React.MouseEvent<HTMLElement>) => event.stopPropagation());
    const onSurveyCreatedToggle = jest.fn();
    const onSurveyResponseToggle = jest.fn();
    const onSurveyResponsesSectionToggle = jest.fn();
    const onSurveysCreatedSectionToggle = jest.fn();

    render(
      <UserPageSurveySection
        {...createProps({
          getSurveyCreatedHref,
          onDecryptQuestion,
          onOpenSurveyResponse,
          onShowQuestionsTab,
          onSurveyCreatedToggle,
          onSurveyResponseToggle,
          onSurveyResponsesSectionToggle,
          onSurveysCreatedSectionToggle,
        })}
      />,
    );

    expect(screen.getByText('Survey Responses')).toBeInTheDocument();
    expect(screen.getByText('Surveys Created')).toBeInTheDocument();
    expect(screen.getByTestId('survey-responses-loading')).toBeInTheDocument();
    expect(screen.getByTestId('surveys-created-loading')).toBeInTheDocument();
    expect(screen.getByText('Response survey')).toBeInTheDocument();
    expect(screen.getByText('Created survey')).toBeInTheDocument();
    expect(screen.getByText('response-tag')).toBeInTheDocument();
    expect(screen.getByText('created-tag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Created survey' })).toHaveAttribute(
      'href',
      '/survey/survey-created?session=alpha',
    );
    expect(screen.getByText('question...567890')).toHaveAttribute('title', 'question-with-a-very-long-id-1234567890');
    expect(screen.getByTestId('survey-question-response')).toHaveAttribute('data-session-slug', 'beta');
    expect(screen.getByTestId('survey-question-response')).toHaveAttribute('data-responder-address', '0xviewer');
    expect(screen.getByTestId('survey-question-response')).toHaveAttribute('data-can-decrypt', 'true');
    expect(screen.getByTestId('survey-question-response')).toHaveAttribute('data-nonce', 'nonce-1');
    expect(screen.getByTestId('survey-question-response')).toHaveAttribute('data-revision', 'revision-1');

    fireEvent.click(screen.getByTestId('survey-question-response').querySelector('button') as HTMLButtonElement);
    expect(onDecryptQuestion).toHaveBeenCalledWith('q-response');

    fireEvent.click(screen.getByRole('button', { name: 'Open full survey page' }));
    expect(onOpenSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'survey-response' }),
      expect.any(Object),
    );
    expect(onSurveyResponseToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Response survey'));
    expect(onSurveyResponseToggle).toHaveBeenCalledWith('survey-response');

    fireEvent.click(screen.getByLabelText('1 questions'));
    expect(onSurveyCreatedToggle).toHaveBeenCalledWith('survey-created');

    fireEvent.click(screen.getByText('Survey Responses').closest('h2') as HTMLHeadingElement);
    fireEvent.click(screen.getByText('Surveys Created').closest('h2') as HTMLHeadingElement);
    expect(onSurveyResponsesSectionToggle).toHaveBeenCalledTimes(1);
    expect(onSurveysCreatedSectionToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Show Questions' })[0]);
    expect(onShowQuestionsTab).toHaveBeenCalledTimes(1);
    expect(onSurveyResponsesSectionToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps gated cached survey responses visible and defers decrypt to the parent handler', () => {
    const onDecryptQuestion = jest.fn();

    render(
      <UserPageSurveySection
        {...createProps({
          detailedSurveyResponseMap: {
            'survey-response': [
              {
                canDecryptOtherResponses: true,
                questionData: { id: 'q-gated-survey', prompt: 'Gated survey prompt' },
                responseData: {
                  additional: {
                    encrypted: true,
                    encryptionAudience: 'gate',
                    value: '*',
                  },
                  answer: {
                    encrypted: true,
                    encryptionAudience: 'gate',
                    value: '*',
                  },
                },
              },
            ],
          },
          onDecryptQuestion,
          questionResponsesNonce: 'survey-cache-nonce',
          sbtCacheRevision: 'survey-cache-revision',
          surveyResponseEntries: [
            {
              documentURLs: [],
              id: 'survey-response',
              questionsCount: 1,
              slug: 'survey-cache-session',
              tags: [],
              title: 'Cached survey response',
            },
          ],
        })}
      />,
    );

    const responseCard = screen.getByTestId('survey-question-response');
    expect(responseCard).toHaveTextContent('Gated survey prompt');
    expect(responseCard).toHaveAttribute('data-has-response', 'true');
    expect(responseCard).toHaveAttribute('data-can-decrypt', 'true');
    expect(responseCard).toHaveAttribute('data-answer-encrypted', 'true');
    expect(responseCard).toHaveAttribute('data-answer-value', '*');
    expect(responseCard).toHaveAttribute('data-additional-encrypted', 'true');
    expect(responseCard).toHaveAttribute('data-additional-value', '*');
    expect(responseCard).toHaveAttribute('data-session-slug', 'survey-cache-session');
    expect(responseCard).toHaveAttribute('data-nonce', 'survey-cache-nonce');
    expect(responseCard).toHaveAttribute('data-revision', 'survey-cache-revision');
    expect(onDecryptQuestion).not.toHaveBeenCalled();

    fireEvent.click(responseCard.querySelector('button') as HTMLButtonElement);
    expect(onDecryptQuestion).toHaveBeenCalledWith('q-gated-survey');
  });

  it('renders parent-derived empty states without loading indicators', () => {
    render(
      <UserPageSurveySection
        {...createProps({
          detailedSurveyResponseMap: {},
          expandedSurveyCreatedMap: {},
          expandedSurveyResponseMap: {},
          isSurveyLoadingAny: false,
          surveyCreationEntries: [],
          surveyResponseEntries: [],
          surveySectionDisplayState: {
            hasCreatedSurveys: false,
            hasSurveyResponses: false,
            shouldRenderSurveyResponsesEmptyText: true,
            shouldRenderSurveysCreatedEmptyText: true,
          },
        })}
      />,
    );

    expect(screen.getByText('No survey responses found.')).toBeInTheDocument();
    expect(screen.getByText('No surveys created.')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-responses-loading')).toBeNull();
    expect(screen.queryByTestId('surveys-created-loading')).toBeNull();
    expect(screen.queryByTestId('survey-question-response')).toBeNull();
  });
});
