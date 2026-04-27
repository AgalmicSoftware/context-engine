import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BinaryChoiceInput from './BinaryChoiceInput';

describe('BinaryChoiceInput', () => {
  it('forwards option changes and repeat clicks on the current selection', () => {
    const onChange = jest.fn();
    render(
      <BinaryChoiceInput
        questionId="q1"
        value="Agree"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Unsure' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Agree' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 'Unsure');
    expect(onChange).toHaveBeenNthCalledWith(2, 'Agree');
  });

  it('renders agree/disagree icons only when requested', () => {
    const { container, rerender } = render(
      <BinaryChoiceInput
        questionId="q1"
        showIcons={false}
      />
    );

    expect(container.querySelectorAll('svg[data-icon="check"]').length).toBe(0);
    expect(container.querySelectorAll('svg[data-icon="times"]').length).toBe(0);

    rerender(
      <BinaryChoiceInput
        questionId="q1"
        showIcons
      />
    );

    expect(container.querySelectorAll('svg[data-icon="check"]').length).toBe(1);
    expect(container.querySelectorAll('svg[data-icon="times"]').length).toBe(1);
  });
});
