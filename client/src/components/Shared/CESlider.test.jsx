import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import CESlider from './CESlider';

describe('CESlider', () => {
  it('clamps the rendered value inside the range', () => {
    render(<CESlider min={0} max={10} value={25} />);

    expect(screen.getByRole('slider')).toHaveValue('10');
  });

  it('emits numeric change and commit values', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();

    render(<CESlider min={0} max={10} value={5} onChange={onChange} onChangeComplete={onChangeComplete} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '7' } });
    fireEvent.mouseUp(slider, { target: { value: '7' } });

    expect(onChange).toHaveBeenCalledWith(7, expect.any(Event));
    expect(onChangeComplete).toHaveBeenCalledWith(7);
  });

  it('handles arrow keys as committed step changes', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();

    render(<CESlider min={0} max={10} step={2} value={4} onChange={onChange} onChangeComplete={onChangeComplete} />);

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(6, expect.any(Event));
    expect(onChangeComplete).toHaveBeenCalledWith(6);
  });
});
