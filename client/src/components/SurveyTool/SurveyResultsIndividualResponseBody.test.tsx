import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyResultsIndividualResponseBody, {
  buildSurveyResultsIndividualResponseDisplayRows,
} from './SurveyResultsIndividualResponseBody';

const mockSingleQuestionResponse = jest.fn((props: any) => (
  <div
    data-testid="single-question-response"
    data-own-response={String(!!props.isOwnResponse)}
    data-session-slug={props.activeSessionSlug || ''}
  >
    {props.question?.prompt}:{props.response?.answer?.value}
  </div>
));

jest.mock('./SingleQuestionResponse', () => (props: any) => {
  return mockSingleQuestionResponse(props);
});

const styleMap = {
  surveyResultsOverride: 'surveyResultsOverride',
};

describe('SurveyResultsIndividualResponseBody', () => {
  beforeEach(() => {
    mockSingleQuestionResponse.mockClear();
  });

  it('builds display rows from response identity, question metadata, and decrypted overrides', () => {
    const answerRow = {
      questionID: 'Q1',
      answer: { encrypted: true, value: '[locked]' },
    };
    const applyDecryptedOverrideToResponse = jest.fn(() => ({
      ...answerRow,
      answer: { encrypted: true, value: 'Visible answer' },
    }));
    const getLockedResponseKey = jest.fn(() => 'survey|responder|q1|hash');
    const rows = buildSurveyResultsIndividualResponseDisplayRows({
      account: '0xABC',
      applyDecryptedOverrideToResponse,
      currentSurveyId: 'survey-current',
      effectiveSlug: 'session-fallback',
      getFallbackQuestion: jest.fn(),
      getLockedResponseKey,
      preNetworkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Question one',
          sessionSlug: 'question-session',
        },
      },
      response: {
        responder: '0xabc',
        response: {
          responses: [answerRow],
        },
      },
    });

    expect(rows).toEqual([
      {
        activeSessionSlug: 'question-session',
        displayResponse: {
          ...answerRow,
          answer: { encrypted: true, value: 'Visible answer' },
        },
        isOwnResponse: true,
        question: {
          id: 'q1',
          prompt: 'Question one',
          sessionSlug: 'question-session',
        },
        questionId: 'q1',
        rowKey: 0,
      },
    ]);
    expect(getLockedResponseKey).toHaveBeenCalledWith({
      responder: '0xabc',
      questionId: 'q1',
      surveyId: 'survey-current',
      response: answerRow,
    });
    expect(applyDecryptedOverrideToResponse).toHaveBeenCalledWith({
      response: answerRow,
      key: 'survey|responder|q1|hash',
    });
  });

  it('renders malformed individual response payloads as an inert empty body', () => {
    const applyDecryptedOverrideToResponse = jest.fn(({ response }) => response);
    const getFallbackQuestion = jest.fn();
    const getLockedResponseKey = jest.fn(() => 'unused-key');
    const getResponseCardProps = jest.fn(() => ({ containerClassName: 'response-card' }));

    render(
      <SurveyResultsIndividualResponseBody
        applyDecryptedOverrideToResponse={applyDecryptedOverrideToResponse}
        getFallbackQuestion={getFallbackQuestion}
        getLockedResponseKey={getLockedResponseKey}
        getResponseCardProps={getResponseCardProps}
        response={{
          responder: '0xempty',
          response: { responses: null },
        }}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('No question-level responses found for this user.')).toBeInTheDocument();
    expect(getFallbackQuestion).not.toHaveBeenCalled();
    expect(getLockedResponseKey).not.toHaveBeenCalled();
    expect(applyDecryptedOverrideToResponse).not.toHaveBeenCalled();
    expect(getResponseCardProps).not.toHaveBeenCalled();
    expect(mockSingleQuestionResponse).not.toHaveBeenCalled();
  });

  it('renders display rows through SingleQuestionResponse without owning execution', () => {
    const getResponseCardProps = jest.fn(() => ({
      bodyClassName: 'response-body',
      containerClassName: 'response-card',
    }));

    render(
      <SurveyResultsIndividualResponseBody
        account="0xowner"
        applyDecryptedOverrideToResponse={jest.fn(({ response }) => ({
          ...response,
          answer: { value: 'Decrypted body' },
        }))}
        effectiveSlug="session-fallback"
        getFallbackQuestion={jest.fn((questionId) => ({
          id: questionId,
          prompt: `Fallback ${questionId}`,
        }))}
        getLockedResponseKey={jest.fn(() => 'row-key')}
        getResponseCardProps={getResponseCardProps}
        network={{ id: 84532 }}
        questionResponsesNonce={1}
        questionsCacheNonce={2}
        response={{
          responder: '0xother',
          response: {
            responses: [
              {
                questionId: 'q2',
                answer: { value: '[locked]' },
              },
            ],
          },
        }}
        sbtCacheRevision={3}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByTestId('single-question-response')).toHaveTextContent('Fallback q2:Decrypted body');
    expect(screen.getByTestId('single-question-response')).toHaveAttribute('data-own-response', 'false');
    expect(screen.getByTestId('single-question-response')).toHaveAttribute('data-session-slug', 'session-fallback');
    expect(mockSingleQuestionResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregatorResponseMode: false,
        bodyClassName: 'response-body',
        containerClassName: 'response-card',
        mode: 'fullscreen',
        network: { id: 84532 },
        questionResponsesNonce: 1,
        questionsCacheNonce: 2,
        sbtCacheRevision: 3,
      }),
    );
    expect(getResponseCardProps).toHaveBeenCalledTimes(1);
  });
});
