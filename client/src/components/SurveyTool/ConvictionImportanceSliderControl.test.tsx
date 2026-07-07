import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ConvictionImportanceSliderControl from './ConvictionImportanceSliderControl';

describe('ConvictionImportanceSliderControl', () => {
  it('renders its label content and forwards slider updates', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    render(
      <ConvictionImportanceSliderControl
        label={<span>Conviction label</span>}
        value={4}
        onChange={onChange}
        onChangeComplete={onChangeComplete}
      />,
    );

    const slider = screen.getByRole('slider');
    expect(screen.getByText('Conviction label')).toBeInTheDocument();

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '9' } });

    expect(onChange).toHaveBeenCalledWith(9, expect.anything());
    expect(onChangeComplete).toHaveBeenCalled();
  });
});
