import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DeferredConvictionImportanceSlider from './DeferredConvictionImportanceSlider';

describe('DeferredConvictionImportanceSlider', () => {
  it('updates the active conviction label live and commits on completion', () => {
    const onCommit = jest.fn();
    const onSelectMode = jest.fn();
    render(
      <DeferredConvictionImportanceSlider
        value={3}
        importanceToggleEnabled
        sliderMode="conviction"
        isExpanded
        convictionValue={3}
        importanceValue={8}
        onSelectMode={onSelectMode}
        onCommit={onCommit}
      />,
    );

    const slider = screen.getByRole('slider');
    expect(screen.getByRole('button', { name: /conviction/i })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /importance/i })).toHaveTextContent('8');

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '6' } });

    expect(screen.getByRole('button', { name: /conviction/i })).toHaveTextContent('6');
    expect(screen.getByRole('button', { name: /importance/i })).toHaveTextContent('8');

    fireEvent.mouseUp(slider, { currentTarget: { value: '6' } });

    expect(onCommit).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByRole('button', { name: /importance/i }));
    expect(onSelectMode).toHaveBeenCalledWith('importance');
  });

  it('keeps the secondary importance line hidden until expanded', () => {
    render(
      <DeferredConvictionImportanceSlider
        value={2}
        importanceToggleEnabled
        sliderMode="conviction"
        isExpanded={false}
        convictionValue={2}
        importanceValue={5}
        onSelectMode={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /conviction/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /importance/i })).not.toBeInTheDocument();
  });
});
