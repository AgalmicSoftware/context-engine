import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';

const styleMap = {
  surveyViewModeToggle: 'surveyViewModeToggle',
  toggleKnob: 'toggleKnob',
  toggleLabel: 'toggleLabel',
  toggleSwitch: 'toggleSwitch',
};

describe('SurveyResultsSurveyViewModeToggle', () => {
  it('renders the individual and aggregate labels with the current switch state', () => {
    render(
      <SurveyResultsSurveyViewModeToggle
        isAggregate={true}
        knobStyle={{ transform: 'translateX(22px)' }}
        onKeyDown={jest.fn()}
        onToggle={jest.fn()}
        styleMap={styleMap}
        trailingLabelStyle={{ marginLeft: '10px' }}
      />,
    );

    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();

    const switchControl = screen.getByRole('switch', {
      name: 'Toggle between individual and aggregate view',
    });
    expect(switchControl).toHaveAttribute('aria-checked', 'true');
  });

  it('wires click and keyboard handlers without owning mode changes', () => {
    const onKeyDown = jest.fn();
    const onToggle = jest.fn();

    render(
      <SurveyResultsSurveyViewModeToggle
        isAggregate={false}
        onKeyDown={onKeyDown}
        onToggle={onToggle}
        styleMap={styleMap}
      />,
    );

    const switchControl = screen.getByRole('switch', {
      name: 'Toggle between individual and aggregate view',
    });
    expect(switchControl).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(switchControl);
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(switchControl, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
