import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import PileEndOfSetCard from './PileEndOfSetCard';

describe('PileEndOfSetCard', () => {
  it('says what was answered and offers to send what is unsent', () => {
    const onSubmit = jest.fn();
    render(<PileEndOfSetCard answered={5} total={8} unsent={1} isSubmitting={false} onSubmit={onSubmit} />);
    expect(screen.getByRole('group', { name: 'That was the last question.' })).toHaveTextContent(
      "You answered 5 of 8. 1 isn't submitted yet.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit 1 answer' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows only the steps it was given, and no Submit once all are sent', () => {
    const onTalkItThrough = jest.fn();
    render(
      <PileEndOfSetCard
        answered={3}
        total={3}
        unsent={0}
        isSubmitting={false}
        onSubmit={jest.fn()}
        onTalkItThrough={onTalkItThrough}
        answersHref="/user/me"
      />,
    );
    expect(screen.getByText('You answered 3 of 3.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See results' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join a group' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Talk it through in the interview' }));
    expect(onTalkItThrough).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'See your answers' })).toHaveAttribute('href', '/user/me');
  });

  it('holds Submit while answers are being sent', () => {
    render(<PileEndOfSetCard answered={2} total={4} unsent={2} isSubmitting onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  });
});
