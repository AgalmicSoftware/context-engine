import React from 'react';
import { render, screen } from '@testing-library/react';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';

describe('AdditionalCommentsInlineRow', () => {
  it('renders the input slot before the lock slot', () => {
    render(
      <AdditionalCommentsInlineRow
        input={<div data-testid="additional-input" />}
        lockControl={<div data-testid="additional-lock" />}
      />,
    );

    expect(screen.getByTestId('additional-input')).toBeInTheDocument();
    expect(screen.getByTestId('additional-lock')).toBeInTheDocument();
  });
});
