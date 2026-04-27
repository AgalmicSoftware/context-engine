import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';

describe('MultichoiceQuestionInput', () => {
  it('adds and removes values for multi-select questions', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha']}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['Alpha', 'Beta']);

    rerender(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha', 'Beta']}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith(['Beta']);
  });

  it('replaces the current choice for single-select multichoice questions', () => {
    const onChange = jest.fn();
    render(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha']}
        isSingleSelect
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith(['Beta']);
  });
});
