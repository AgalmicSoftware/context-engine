import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DeferredRatingSlider, { resolveDeferredRatingSliderStyle } from './DeferredRatingSlider';

describe('DeferredRatingSlider', () => {
  it('buffers slider movement locally and commits after completion', () => {
    const onCommit = jest.fn();
    render(<DeferredRatingSlider value={4} onCommit={onCommit} />);

    const slider = screen.getByRole('slider');
    expect(screen.getByText('4')).toBeInTheDocument();

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '7' } });

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.mouseUp(slider, { currentTarget: { value: '7' } });

    expect(onCommit).toHaveBeenCalledWith(7);
  });
});
