import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TelegramQuestionPile from './TelegramQuestionPile';

jest.mock('../../SurveyTool/SurveyAudioFieldInput', () => ({
  __esModule: true,
  default: (props: { value?: string }) => (
    <div data-testid="mock-rich-freeform-composer" data-value={props.value || ''} />
  ),
}));

describe('TelegramQuestionPile', () => {
  const baseProps = {
    activeIndex: 0,
    status: 'ready',
    submittedQuestionIds: new Set<string>(),
    submittingQuestionId: '',
    submitError: '',
    onActiveIndexChange: jest.fn(),
    onSubmitAnswer: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses a lightweight freeform textarea until rich voice and AI tools are requested', async () => {
    render(
      <TelegramQuestionPile
        {...baseProps}
        questions={[
          {
            questionId: 'q-freeform',
            questionType: 'freeform',
            prompt: 'Describe the tradeoff.',
          } as any,
        ]}
      />
    );

    const textarea = screen.getByTestId('ce-session-telegram-question-freeform-textarea');
    expect(textarea).toBeInTheDocument();
    expect(screen.queryByTestId('mock-rich-freeform-composer')).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Ship the small version first.' } });
    fireEvent.click(screen.getByTestId('ce-session-telegram-question-rich-freeform-toggle'));

    expect(await screen.findByTestId('mock-rich-freeform-composer')).toHaveAttribute(
      'data-value',
      'Ship the small version first.'
    );
  });
});
