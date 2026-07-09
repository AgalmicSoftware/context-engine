import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';

describe('SurveyQuestionsFullQuestionSliderSection', () => {
  it('renders the collapsed bullhorn control and opens conviction mode when clicked', () => {
    const onSelectMode = jest.fn();

    render(
      <SurveyQuestionsFullQuestionSliderSection
        activeSliderValue={4}
        convictionValue={4}
        hasConvictionImportanceValue
        importanceToggleEnabled
        importanceValue={7}
        isSubmitting={false}
        onSelectMode={onSelectMode}
        questionId="q1"
        sliderMode="importance"
        sliderOpen={false}
      />,
    );

    const button = screen.getByRole('button', { name: /conviction \/ importance/i });
    expect(button.className).toContain('iconButtonActive');

    fireEvent.click(button);

    expect(onSelectMode).toHaveBeenCalledWith('conviction');
  });

  it('can preserve the active slider mode when the collapsed control opens', () => {
    const onSelectMode = jest.fn();

    render(
      <SurveyQuestionsFullQuestionSliderSection
        collapsedSliderMode="importance"
        convictionValue={2}
        hasConvictionImportanceValue
        importanceToggleEnabled
        importanceValue={6}
        onSelectMode={onSelectMode}
        questionId="q1"
        sliderMode="importance"
        sliderOpen={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /conviction \/ importance/i }));

    expect(onSelectMode).toHaveBeenCalledWith('importance');
  });

  it('renders the expanded multi-question slider and forwards changes', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    const onSelectMode = jest.fn();

    render(
      <SurveyQuestionsFullQuestionSliderSection
        activeSliderValue={3}
        convictionValue={3}
        hasConvictionImportanceValue
        importanceToggleEnabled
        importanceValue={8}
        isSubmitting={false}
        onChange={onChange}
        onChangeComplete={onChangeComplete}
        onSelectMode={onSelectMode}
        questionId="q1"
        sliderMode="conviction"
        sliderOpen
        sliderToggleExpandedByQuestion={{ q1: true }}
      />,
    );

    expect(screen.getByRole('button', { name: /conviction/i })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /importance/i })).toHaveTextContent('8');

    fireEvent.click(screen.getByRole('button', { name: /importance/i }));
    expect(onSelectMode).toHaveBeenCalledWith('importance');

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '6' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '6' } });

    expect(onChange).toHaveBeenCalledWith(6, expect.anything());
    expect(onChangeComplete).toHaveBeenCalled();
  });

  it('uses the deferred slider in single-question mode and commits on completion', () => {
    const onCommit = jest.fn();
    const onSelectMode = jest.fn();

    render(
      <SurveyQuestionsFullQuestionSliderSection
        activeSliderValue={2}
        convictionValue={2}
        hasConvictionImportanceValue={false}
        importanceToggleEnabled
        importanceValue={5}
        isSubmitting={false}
        onCommit={onCommit}
        onSelectMode={onSelectMode}
        questionId="q1"
        singleQuestionMode
        sliderMode="conviction"
        sliderOpen
        sliderToggleExpandedByQuestion={{ q1: true }}
      />,
    );

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '9' } });

    expect(onCommit).toHaveBeenCalledWith(9);
  });
});
