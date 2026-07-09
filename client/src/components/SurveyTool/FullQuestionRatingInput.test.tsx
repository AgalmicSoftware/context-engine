import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FullQuestionRatingInput, { resolveFullQuestionRatingSliderStyle } from './FullQuestionRatingInput';
import { RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';

describe('FullQuestionRatingInput', () => {
  it('renders the current rating and forwards slider updates', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    render(<FullQuestionRatingInput value={6} onChange={onChange} onChangeComplete={onChangeComplete} />);

    const slider = screen.getByRole('slider');
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(slider).toHaveAttribute('min', String(RATING_MIN));
    expect(slider).toHaveAttribute('max', String(RATING_MAX));

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '8' } });

    expect(onChange).toHaveBeenCalledWith(8, expect.anything());
    expect(onChangeComplete).toHaveBeenCalled();
  });

  it('does not emit slider updates when disabled', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    render(<FullQuestionRatingInput value={6} disabled onChange={onChange} onChangeComplete={onChangeComplete} />);

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '8' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(onChangeComplete).not.toHaveBeenCalled();
  });

  it('resolves the fixed rating slider width', () => {
    expect(resolveFullQuestionRatingSliderStyle()).toEqual({ width: '200px' });
  });
});
