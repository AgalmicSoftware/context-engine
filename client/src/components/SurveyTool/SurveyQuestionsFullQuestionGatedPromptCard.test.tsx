import React from 'react';
import { render, screen } from '@testing-library/react';

import { renderSurveyQuestionsFullQuestionGatedPromptCard } from './SurveyQuestionsFullQuestionGatedPromptCard';

describe('SurveyQuestionsFullQuestionGatedPromptCard', () => {
  it('renders prompt chrome, card icons, gate notice, and tag controls', () => {
    render(
      <>
        {renderSurveyQuestionsFullQuestionGatedPromptCard({
          promptContent: <span>Encrypted prompt</span>,
          cardIcons: <button type="button">Open question</button>,
          gatedPromptNotice: <div data-testid="gate-notice">Requires access</div>,
          tagDropdownRow: <div data-testid="tag-row">Tags</div>,
        })}
      </>,
    );

    expect(screen.getByText('Encrypted prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open question' })).toBeInTheDocument();
    expect(screen.getByTestId('gate-notice')).toHaveTextContent('Requires access');
    expect(screen.getByTestId('tag-row')).toHaveTextContent('Tags');
    expect(screen.getByText('Encrypted prompt').closest('.questionTitleBody')).toHaveClass('fullQuestionBody');
  });
});
