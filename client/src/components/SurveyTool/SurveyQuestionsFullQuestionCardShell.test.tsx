import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';

describe('SurveyQuestionsFullQuestionCardShell', () => {
  it('renders prompt, main content, footer controls, and comments', () => {
    render(
      <SurveyQuestionsFullQuestionCardShell
        promptContent={<span>Prompt text</span>}
        cardIcons={<button type="button">Card action</button>}
        mainContent={<input aria-label="Answer" />}
        sliderSection={<span>Slider</span>}
        footerIcons={<button type="button">Footer action</button>}
        commentsSection={<div>Comments</div>}
      />,
    );

    expect(screen.getByText('Prompt text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card action' })).toBeInTheDocument();
    expect(screen.getByLabelText('Answer')).toBeInTheDocument();
    expect(screen.getByText('Slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Footer action' })).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });
});
