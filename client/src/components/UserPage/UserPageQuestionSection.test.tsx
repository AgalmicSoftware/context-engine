import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageQuestionSection from './UserPageQuestionSection';

jest.mock('reactstrap', () => ({
  Collapse: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? <div data-testid="collapse">{children}</div> : null,
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
        data-testid={questionOnly ? 'created-question-card' : 'question-response-card'}
        data-answer-encrypted={String(!!responseRecord.answer?.encrypted)}
        data-answer-value={String(responseRecord.answer?.value)}
        data-additional-encrypted={String(!!responseRecord.additional?.encrypted)}
        data-additional-value={String(responseRecord.additional?.value)}
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
        {(questionOnly || canDecryptOtherResponses) && (
          <button type="button" onClick={() => onDecryptQuestion?.(question?.id)}>
            decrypt
          </button>
        )}
      </div>
    );
  },
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageQuestionSection>> = {}) => ({
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
  questionCreationEntries: [
    {
      id: 'q-created',
      prompt: 'Created question',
    },
  ],
  questionResponsesEmptyText: 'No question responses yet.',
  questionResponsesLoadingIndicator: <span data-testid="responses-loading">responses loading</span>,
  questionResponsesNonce: 'nonce-1',
  questionResponseEntries: [
    {
      canDecryptOtherResponses: true,
      id: 'q-response',
      prompt: 'Answered question',
      sessionSlug: 'response-session',
    },
  ],
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
      />,
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
      />,
    );

    expect(screen.getByText('No question responses yet.')).toBeInTheDocument();
    expect(screen.getByText('No questions created.')).toBeInTheDocument();
    expect(screen.queryByTestId('responses-loading')).toBeNull();
    expect(screen.queryByTestId('created-loading')).toBeNull();
    expect(screen.queryByTestId('question-response-card')).toBeNull();
    expect(screen.queryByTestId('created-question-card')).toBeNull();
  });

  it('passes cache-derived decrypt eligibility without invoking decrypt on render', () => {
    const onDecryptQuestion = jest.fn();

    render(
      <UserPageQuestionSection
        {...createProps({
          detailedQuestionResponseMap: {
            'q-gated': {
              answer: { encrypted: true, encryptionAudience: 'gate', value: '*' },
            },
            'q-open': {
              answer: { value: 'cached clear text' },
            },
          },
          onDecryptQuestion,
          questionResponseEntries: [
            {
              canDecryptOtherResponses: false,
              id: 'q-gated',
              prompt: 'Gated cached response',
              slug: 'gated-session',
            },
            {
              id: 'q-open',
              prompt: 'Open cached response',
            },
          ],
          questionResponsesNonce: 'cache-nonce',
          sbtCacheRevision: 'gate-revision',
        })}
      />,
    );

    const responseCards = screen.getAllByTestId('question-response-card');
    expect(responseCards).toHaveLength(2);
    expect(responseCards[0]).toHaveAttribute('data-can-decrypt', 'false');
    expect(responseCards[0]).toHaveAttribute('data-session-slug', 'gated-session');
    expect(responseCards[1]).toHaveAttribute('data-can-decrypt', 'false');
    expect(responseCards[1]).toHaveAttribute('data-session-slug', 'fallback-session');
    responseCards.forEach((card) => {
      expect(card).toHaveAttribute('data-nonce', 'cache-nonce');
      expect(card).toHaveAttribute('data-revision', 'gate-revision');
      expect(card).toHaveAttribute('data-has-response', 'true');
      expect(card.querySelector('button')).toBeNull();
    });
    expect(onDecryptQuestion).not.toHaveBeenCalled();
  });

  it('keeps gated cached responses visible and defers decrypt to the parent click handler', () => {
    const onDecryptQuestion = jest.fn();

    render(
      <UserPageQuestionSection
        {...createProps({
          detailedQuestionResponseMap: {
            'q-gated-visible': {
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
          onDecryptQuestion,
          questionResponseEntries: [
            {
              canDecryptOtherResponses: true,
              id: 'q-gated-visible',
              prompt: 'Visible gated response',
              sessionSlug: 'gated-cache-session',
            },
          ],
          questionResponsesNonce: 'gate-cache-nonce',
          sbtCacheRevision: 'gate-cache-revision',
        })}
      />,
    );

    const responseCard = screen.getByTestId('question-response-card');
    expect(responseCard).toHaveTextContent('Visible gated response');
    expect(responseCard).toHaveAttribute('data-has-response', 'true');
    expect(responseCard).toHaveAttribute('data-can-decrypt', 'true');
    expect(responseCard).toHaveAttribute('data-answer-encrypted', 'true');
    expect(responseCard).toHaveAttribute('data-answer-value', '*');
    expect(responseCard).toHaveAttribute('data-additional-encrypted', 'true');
    expect(responseCard).toHaveAttribute('data-additional-value', '*');
    expect(responseCard).toHaveAttribute('data-session-slug', 'gated-cache-session');
    expect(responseCard).toHaveAttribute('data-nonce', 'gate-cache-nonce');
    expect(responseCard).toHaveAttribute('data-revision', 'gate-cache-revision');
    expect(onDecryptQuestion).not.toHaveBeenCalled();

    fireEvent.click(responseCard.querySelector('button') as HTMLButtonElement);
    expect(onDecryptQuestion).toHaveBeenCalledWith('q-gated-visible');
  });

  it('uses the active session fallback for gated cached response decrypt wiring', () => {
    const onDecryptQuestion = jest.fn();

    render(
      <UserPageQuestionSection
        {...createProps({
          activeSessionSlug: 'active-cache-session',
          detailedQuestionResponseMap: {
            'q-gated-fallback-session': {
              answer: {
                encrypted: true,
                encryptionAudience: 'gate',
                value: '*',
              },
            },
          },
          onDecryptQuestion,
          questionResponseEntries: [
            {
              canDecryptOtherResponses: true,
              id: 'q-gated-fallback-session',
              prompt: 'Fallback session gated response',
            },
          ],
          questionResponsesNonce: 'fallback-cache-nonce',
          sbtCacheRevision: 'fallback-cache-revision',
        })}
      />,
    );

    const responseCard = screen.getByTestId('question-response-card');
    expect(responseCard).toHaveTextContent('Fallback session gated response');
    expect(responseCard).toHaveAttribute('data-has-response', 'true');
    expect(responseCard).toHaveAttribute('data-can-decrypt', 'true');
    expect(responseCard).toHaveAttribute('data-answer-encrypted', 'true');
    expect(responseCard).toHaveAttribute('data-session-slug', 'active-cache-session');
    expect(responseCard).toHaveAttribute('data-nonce', 'fallback-cache-nonce');
    expect(responseCard).toHaveAttribute('data-revision', 'fallback-cache-revision');
    expect(onDecryptQuestion).not.toHaveBeenCalled();

    fireEvent.click(responseCard.querySelector('button') as HTMLButtonElement);
    expect(onDecryptQuestion).toHaveBeenCalledWith('q-gated-fallback-session');
  });
});
