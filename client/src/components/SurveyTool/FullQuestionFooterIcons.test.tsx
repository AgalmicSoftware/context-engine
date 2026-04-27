import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';

describe('FullQuestionFooterIcons', () => {
  it('renders the comments toggle and passes through lock/tag controls', () => {
    const onToggleComments = jest.fn();
    render(
      <FullQuestionFooterIcons
        hasAdditionalContent
        commentsOpen
        onToggleComments={onToggleComments}
        questionId="Q1"
      />
    );

    fireEvent.click(screen.getByTitle('Additional comments'));

    expect(screen.getByTestId('ce-survey-additional-toggle')).toHaveAttribute('data-ce-question-id', 'q1');
    expect(onToggleComments).toHaveBeenCalledTimes(1);
  });

  it('renders any forwarded footer children after the comments toggle', () => {
    render(
      <FullQuestionFooterIcons
        onToggleComments={jest.fn()}
        questionId="Q1"
      >
        <div data-testid="lock-control" />
        <div data-testid="tag-control" />
      </FullQuestionFooterIcons>
    );

    expect(screen.getByTestId('lock-control')).toBeInTheDocument();
    expect(screen.getByTestId('tag-control')).toBeInTheDocument();
  });
});
