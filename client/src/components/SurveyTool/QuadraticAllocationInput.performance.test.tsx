import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuadraticAllocationInput from './QuadraticAllocationInput';

const question = { options: ['Parks', 'Transit'], voiceCredits: 99 };

it('keeps drag feedback local and commits one full-page update on release outside the slider', () => {
  const commits = jest.fn();
  const parentRender = jest.fn();
  function QuestionPage() {
    const [value, setValue] = useState([0, 0]);
    parentRender();
    return (
      <QuadraticAllocationInput
        questionId="q"
        {...question}
        value={value}
        deferDragUpdates
        onChange={(next) => {
          commits(next);
          setValue(next);
        }}
      />
    );
  }
  render(<QuestionPage />);
  const slider = screen.getByRole('slider', { name: 'Parks' });
  fireEvent.pointerDown(slider);
  for (let vote = -9; vote <= 9; vote += 1) fireEvent.change(slider, { target: { value: String(vote) } });
  expect(slider).toHaveValue('9');
  expect(screen.getByRole('status')).toHaveTextContent('18 credits left');
  expect(commits).toHaveBeenCalledTimes(0);
  expect(parentRender).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(window);
  expect(commits).toHaveBeenCalledTimes(1);
  expect(commits).toHaveBeenLastCalledWith([9, 0]);
  expect(parentRender).toHaveBeenCalledTimes(2);
});

it.each(['blur', 'pointercancel', 'window-blur'])(
  'commits the final valid allocation on %s without waiting for another change',
  (event) => {
    const onChange = jest.fn();
    render(
      <QuadraticAllocationInput
        questionId="q"
        {...question}
        voiceCredits={25}
        value={[3, -4]}
        deferDragUpdates
        onChange={onChange}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Parks' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '-5' } });
    expect(slider).toHaveValue('-3');
    expect(screen.getByRole('status')).toHaveTextContent('0 credits left');
    expect(onChange).not.toHaveBeenCalled();
    if (event === 'blur') fireEvent.blur(slider);
    else if (event === 'window-blur') fireEvent.blur(window);
    else fireEvent.pointerCancel(window);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([-3, -4]);
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledTimes(1);
  },
);

it('keeps keyboard and assistive input updates immediate', () => {
  const onChange = jest.fn();
  render(<QuadraticAllocationInput questionId="q" {...question} value={[0, 0]} deferDragUpdates onChange={onChange} />);
  const slider = screen.getByRole('slider', { name: 'Parks' });
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  fireEvent.change(slider, { target: { value: '1' } });
  expect(onChange).toHaveBeenCalledWith([1, 0]);
});

it('keeps a new slider drag local when the previously focused slider blurs', () => {
  const onChange = jest.fn();
  render(<QuadraticAllocationInput questionId="q" {...question} value={[9, 0]} deferDragUpdates onChange={onChange} />);
  const parks = screen.getByRole('slider', { name: 'Parks' });
  const transit = screen.getByRole('slider', { name: 'Transit' });
  fireEvent.focus(parks);
  // Browsers send pointerdown on the new slider before blurring the old one.
  fireEvent.pointerDown(transit);
  fireEvent.blur(parks);
  fireEvent.focus(transit);
  for (let vote = -1; vote >= -9; vote -= 1) fireEvent.change(transit, { target: { value: String(vote) } });
  expect(transit).toHaveValue('-4');
  expect(screen.getByRole('status')).toHaveTextContent('2 credits left');
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.pointerUp(window);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([9, -4]);
});

it.each(['question', 'value', 'disabled', 'budget'])(
  'does not commit a stale drag after %s changes externally',
  (change) => {
    const onChange = jest.fn();
    const props = { questionId: 'q', ...question, value: [0, 0], deferDragUpdates: true, onChange };
    const { rerender } = render(<QuadraticAllocationInput {...props} />);
    fireEvent.pointerDown(screen.getByRole('slider', { name: 'Parks' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Parks' }), { target: { value: '7' } });
    const next =
      change === 'question'
        ? { questionId: 'q2' }
        : change === 'value'
          ? { value: [2, 0] }
          : change === 'disabled'
            ? { disabled: true }
            : { voiceCredits: 25 };
    rerender(<QuadraticAllocationInput {...props} {...next} />);
    expect(screen.getByRole('slider', { name: 'Parks' })).toHaveValue(change === 'value' ? '2' : '0');
    fireEvent.pointerUp(window);
    expect(onChange).not.toHaveBeenCalled();
  },
);

it('updates the saved answer before a subsequent submit click and resets without stale votes', () => {
  const saved = jest.fn();
  function Form() {
    const [value, setValue] = useState([0, 0]);
    return (
      <>
        <QuadraticAllocationInput questionId="q" {...question} value={value} deferDragUpdates onChange={setValue} />
        <button onClick={() => saved(value)}>Save answer</button>
      </>
    );
  }
  render(<Form />);
  const slider = screen.getByRole('slider', { name: 'Transit' });
  fireEvent.pointerDown(slider);
  fireEvent.change(slider, { target: { value: '-7' } });
  fireEvent.blur(slider);
  fireEvent.click(screen.getByRole('button', { name: 'Save answer' }));
  expect(saved).toHaveBeenLastCalledWith([0, -7]);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  fireEvent.pointerUp(window);
  fireEvent.click(screen.getByRole('button', { name: 'Save answer' }));
  expect(saved).toHaveBeenLastCalledWith([0, 0]);
});
