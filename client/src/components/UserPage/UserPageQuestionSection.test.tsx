import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageQuestionSection from './UserPageQuestionSection';

jest.mock('reactstrap', () => ({
  Collapse: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) => (
    isOpen ? <div data-testid="collapse">{children}</div> : null
  ),
}));

jest.mock('../SurveyTool/SingleQuestionResponse', () => ({
  __esModule: true,
  default: ({
    canDecryptOtherResponses,
    mode,
    onDecryptQuestion,
    question,
    questionOnly,
    questionResponsesNonce,
    response,
    responderAddress,
    sbtCacheRevision,
    sessionSlug,
    showImportance,
  }: {
    canDecryptOtherResponses?: boolean;
    mode?: string;
    onDecryptQuestion?: (...args: unknown[]) => void;
    question?: { id?: string; prompt?: string };
    questionOnly?: boolean;
    questionResponsesNonce?: unknown;
    response?: unknown;
    responderAddress?: unknown;
    sbtCacheRevision?: unknown;
    sessionSlug?: unknown;
    showImportance?: unknown;
  }) => (
    <div
      data-testid={questionOnly ? 'created-question-card' : 'question-response-card'}
      data-can-decrypt={String(canDecryptOtherResponses)}
      data-has-response={String(!!response)}
      data-mode={String(mode)}
      data-nonce={String(questionResponsesNonce)}
      data-responder-address={String(responderAddress)}
      data-revision={String(sbtCacheRevision)}
      data-session-slug={String(sessionSlug)}
      data-show-importance={String(showImportance)}
    >
      {question?.prompt || question?.id}
      <button type="button" onClick={() => onDecryptQuestion?.(question?.id)}>decrypt</button>
    </div>
  ),
}));

const createProps = (
  overrides: Partial<React.ComponentProps<typeof UserPageQuestionSection>> = {}
) => ({
  activeSessionSlug: 'fallback-session',
  createdQuestionWrapperClassName: 'created-question-wrapper',
  detailedQuestionResponseMap: {
    'q-response': { answer: { value: 'yes' } },
  },
  isQuestionLoadingAny: true,
  network: { id: 84532 },
  onDecryptQuestion: jest.fn(),
  onQuestionResponsesSectionToggle: jest.fn(),
  onQuestionsCreatedSectionToggle: jest.fn(),
  onShowSurveysTab: jest.fn((event: React.MouseEvent<HTMLElement>) => event.stopPropagation()),
  questionCreationEntries: [{
    id: 'q-created',
    prompt: 'Created question',
  }],
  questionResponsesEmptyText: 'No question responses yet.',
  questionResponsesLoadingIndicator: <span data-testid="responses-loading">responses loading</span>,
  questionResponsesNonce: 'nonce-1',
  questionResponseEntries: [{
    canDecryptOtherResponses: true,
    id: 'q-response',
    prompt: 'Answered question',
    sessionSlug: 'response-session',
  }],
  questionResponsesSectionToggleState: {
    isOpen: true,
    shouldRenderClosedIcon: false,
    shouldRenderOpenIcon: true,
  },
  questionSectionDisplayState: {
    hasCreatedQuestions: true,
    hasQuestionResponses: true,
    shouldRenderQuestionResponsesEmptyText: false,
    shouldRenderQuestionsCreatedEmptyText: false,
  },
  questionsCreatedLoadingIndicator: <span data-testid="created-loading">created loading</span>,
  questionsCreatedSectionToggleState: {
    isOpen: true,
    shouldRenderClosedIcon: false,
    shouldRenderOpenIcon: true,
  },
  responderAddress: '0xviewer',
  sbtCacheRevision: 'revision-1',
  surveysQuestionsToggle: null,
  ...overrides,
});

describe('UserPageQuestionSection', () => {
  it('renders question response and created cards with parent-owned callbacks', () => {
    const onDecryptQuestion = jest.fn();
    const onQuestionResponsesSectionToggle = jest.fn();
    const onQuestionsCreatedSectionToggle = jest.fn();
    const onShowSurveysTab = jest.fn((event: React.MouseEvent<HTMLElement>) => event.stopPropagation());

    render(
      <UserPageQuestionSection
        {...createProps({
          onDecryptQuestion,
          onQuestionResponsesSectionToggle,
          onQuestionsCreatedSectionToggle,
          onShowSurveysTab,
        })}
      />
    );

    expect(screen.getByText('Question Responses')).toBeInTheDocument();
    expect(screen.getByText('Questions Created')).toBeInTheDocument();
    expect(screen.getByTestId('responses-loading')).toBeInTheDocument();
    expect(screen.getByTestId('created-loading')).toBeInTheDocument();
    expect(screen.getByTestId('question-response-card')).toHaveAttribute('data-session-slug', 'response-session');
    expect(screen.getByTestId('question-response-card')).toHaveAttribute('data-responder-address', '0xviewer');
    expect(screen.getByTestId('question-response-card')).toHaveAttribute('data-can-decrypt', 'true');
    expect(screen.getByTestId('question-response-card')).toHaveAttribute('data-nonce', 'nonce-1');
    expect(screen.getByTestId('question-response-card')).toHaveAttribute('data-revision', 'revision-1');
    expect(screen.getByTestId('created-question-card')).toHaveAttribute('data-session-slug', 'fallback-session');
    expect(screen.getByTestId('created-question-card')).toHaveAttribute('data-show-importance', 'false');

    fireEvent.click(screen.getByTestId('question-response-card').querySelector('button') as HTMLButtonElement);
    expect(onDecryptQuestion).toHaveBeenCalledWith('q-response');

    fireEvent.click(screen.getByText('Question Responses').closest('h2') as HTMLHeadingElement);
    fireEvent.click(screen.getByText('Questions Created').closest('h2') as HTMLHeadingElement);
    expect(onQuestionResponsesSectionToggle).toHaveBeenCalledTimes(1);
    expect(onQuestionsCreatedSectionToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Show Surveys' })[0]);
    expect(onShowSurveysTab).toHaveBeenCalledTimes(1);
    expect(onQuestionResponsesSectionToggle).toHaveBeenCalledTimes(1);
  });

  it('renders parent-derived empty states without loading indicators', () => {
    render(
      <UserPageQuestionSection
        {...createProps({
          isQuestionLoadingAny: false,
          questionCreationEntries: [],
          questionResponseEntries: [],
          questionSectionDisplayState: {
            hasCreatedQuestions: false,
            hasQuestionResponses: false,
            shouldRenderQuestionResponsesEmptyText: true,
            shouldRenderQuestionsCreatedEmptyText: true,
          },
        })}
      />
    );

    expect(screen.getByText('No question responses yet.')).toBeInTheDocument();
    expect(screen.getByText('No questions created.')).toBeInTheDocument();
    expect(screen.queryByTestId('responses-loading')).toBeNull();
    expect(screen.queryByTestId('created-loading')).toBeNull();
    expect(screen.queryByTestId('question-response-card')).toBeNull();
    expect(screen.queryByTestId('created-question-card')).toBeNull();
  });
});
