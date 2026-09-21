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

  it('uses per-question rating endpoints while buffering commits', () => {
    const onCommit = jest.fn();
    render(
      <DeferredRatingSlider
        value={0}
        scale={{ min: 1, max: 10, minLabel: 'Almost none of it', maxLabel: 'All of it' }}
        onCommit={onCommit}
      />,
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '10');
    expect(screen.getByLabelText('Current rating')).toHaveTextContent('1');
    expect(screen.queryByText('Almost none of it')).not.toBeInTheDocument();
    expect(screen.queryByText('All of it')).not.toBeInTheDocument();

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '10' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '10' } });

    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it('resolves the fixed deferred rating slider width', () => {
    expect(resolveDeferredRatingSliderStyle()).toEqual({ width: '200px' });
  });
});
