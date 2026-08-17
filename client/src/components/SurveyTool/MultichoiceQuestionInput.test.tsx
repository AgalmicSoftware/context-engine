import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MultichoiceQuestionInput, {
  buildMultichoiceOptionClassName,
  findDuplicateMultichoiceOptionLabels,
} from './MultichoiceQuestionInput';

describe('MultichoiceQuestionInput', () => {
  it('adds and removes values for multi-select questions', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha']}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['Alpha', 'Beta']);

    rerender(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha', 'Beta']}
        onChange={onChange}
      />,
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
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith(['Beta']);
  });

  it('does not emit value changes when disabled', () => {
    const onChange = jest.fn();
    render(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'Beta']}
        selectedValues={['Alpha']}
        disabled
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks duplicate option labels instead of collapsing selections', () => {
    const onChange = jest.fn();
    render(
      <MultichoiceQuestionInput
        questionId="q1"
        options={['Alpha', 'alpha', 'Beta']}
        selectedValues={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Multichoice options must have unique labels.');
    expect(screen.queryByRole('checkbox', { name: 'Alpha' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('finds duplicate labels case-insensitively', () => {
    expect(findDuplicateMultichoiceOptionLabels(['Alpha', 'Beta', ' alpha '])).toEqual(['alpha']);
  });

  it('builds multichoice option classes', () => {
    expect(
      buildMultichoiceOptionClassName({
        baseClassName: 'option',
        isSelected: true,
        selectedClassName: 'selected',
      }),
    ).toBe('option selected');
    expect(
      buildMultichoiceOptionClassName({
        baseClassName: 'option',
        isSelected: false,
        selectedClassName: 'selected',
      }),
    ).toBe('option');
  });
});
