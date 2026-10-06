import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';

const SCALES = [
  { label: '0-10', min: 0, max: 10 },
  { label: '1-5', min: 1, max: 5 },
];

const renderFull = (scale: { min: number; max: number }, value: unknown, onDeferredRatingCommit = jest.fn()) => {
  render(
    <SurveyQuestionsFullQuestionResponseInput
      question={{ id: 'q-rating', type: 'rating', scale: { min: scale.min, max: scale.max } } as any}
      answer={{ value } as any}
      onDeferredRatingCommit={onDeferredRatingCommit}
      {...({} as any)}
    />,
  );
  return onDeferredRatingCommit;
};

describe.each(SCALES)('full view, unanswered rating on a $label scale', (scale) => {
  it('R1 shows the unanswered state, not the minimum', () => {
    renderFull(scale, '');
    expect(screen.getByLabelText('Current rating')).toHaveTextContent('–');
  });

  it('R2 pointer: press and release on the thumb at the minimum commits the minimum', () => {
    const commit = renderFull(scale, '');
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue(String(scale.min));
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: String(scale.min) } }); // no native change at the same value
    fireEvent.mouseUp(slider);
    expect(commit).toHaveBeenCalledWith(scale.min);
  });

  it('R2k keyboard: ArrowLeft/ArrowDown at the minimum commits the minimum', () => {
    const commit = renderFull(scale, '');
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(commit).toHaveBeenCalledWith(scale.min);
  });

  it('control: ArrowRight then ArrowLeft reaches the minimum in two commits', () => {
    const commit = jest.fn();
    const { rerender } = render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{ id: 'q-rating', type: 'rating', scale } as any}
        answer={{ value: '' } as any}
        onDeferredRatingCommit={commit}
        {...({} as any)}
      />,
    );
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(commit).toHaveBeenLastCalledWith(scale.min + 1);
    rerender(
      <SurveyQuestionsFullQuestionResponseInput
        question={{ id: 'q-rating', type: 'rating', scale } as any}
        answer={{ value: scale.min + 1 } as any}
        onDeferredRatingCommit={commit}
        {...({} as any)}
      />,
    );
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(commit).toHaveBeenLastCalledWith(scale.min);
  });

  it('control: a saved minimum displays the minimum', () => {
    renderFull(scale, scale.min);
    expect(screen.getByLabelText('Current rating')).toHaveTextContent(String(scale.min));
  });
});
