import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuadraticQuestionPreview } from './QuadraticQuestionPreview';

describe('a quadratic question on its atlas card', () => {
  it('lists each option on its own row beside a stepper, under the budget', () => {
    render(<QuadraticQuestionPreview credits={16} options={['Parks', 'Roads', 'Libraries']} />);
    const preview = screen.getByTestId('ce-atlas-quadratic-preview');
    expect(preview).toHaveTextContent('16 voice credits · votes cost their square');
    const rows = [...preview.querySelectorAll('li')];
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(['Parks', 'Roads', 'Libraries']);
    rows.forEach((row) => expect(row.lastElementChild).toHaveTextContent('−0+'));
    // A picture of the control, like the other types' previews: kept from assistive technology.
    expect(preview).toHaveAttribute('aria-hidden', 'true');
  });

  it('says so when the options are missing, and counts one credit as one', () => {
    render(<QuadraticQuestionPreview credits={1} options={[]} />);
    expect(screen.getByTestId('ce-atlas-quadratic-preview')).toHaveTextContent('1 voice credit ·');
    expect(screen.getByText('Options unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('ce-atlas-quadratic-preview').querySelector('ul')).toBeNull();
  });
});
