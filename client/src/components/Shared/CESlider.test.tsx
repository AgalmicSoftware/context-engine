import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import CESlider from './CESlider';

describe('CESlider', () => {
  it('commits an arrow key at a bound without emitting a change', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    render(<CESlider min={1} max={5} value={1} onChange={onChange} onChangeComplete={onChangeComplete} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
    expect(onChangeComplete).toHaveBeenCalledWith(1);
  });

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

it.each<[string, number]>([
  ['Home', 0],
  ['End', 100],
  ['PageUp', 60],
  ['PageDown', 40],
])('commits %s keyboard changes', (key, expected) => {
  const onChange = jest.fn(),
    onChangeComplete = jest.fn();
  render(<CESlider min={0} max={100} step={5} value={50} onChange={onChange} onChangeComplete={onChangeComplete} />);
  fireEvent.keyDown(screen.getByRole('slider'), { key });
  expect(onChange).toHaveBeenCalledWith(expected, expect.any(Event));
  expect(onChangeComplete).toHaveBeenCalledWith(expected);
});
