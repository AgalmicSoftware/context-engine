import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ConvictionImportanceLabel, { buildConvictionImportanceToggleLineClassName } from './ConvictionImportanceLabel';

describe('ConvictionImportanceLabel', () => {
  it('renders a simple conviction row when the importance toggle is disabled', () => {
    render(
      <ConvictionImportanceLabel
        importanceToggleEnabled={false}
        sliderMode="conviction"
        isExpanded={false}
        convictionValue={4}
        importanceValue={7}
        onSelectMode={jest.fn()}
      />,
    );

    expect(screen.getByText('Conviction')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Conviction').closest('h6')).toHaveClass('importanceText', 'convictionValueRow');
    expect(screen.queryByRole('button', { name: /importance/i })).not.toBeInTheDocument();
  });

  it('renders both toggle buttons when expanded and reports mode changes', () => {
    const onSelectMode = jest.fn();
    render(
      <ConvictionImportanceLabel
        importanceToggleEnabled
        sliderMode="conviction"
        isExpanded
        convictionValue={3}
        importanceValue={8}
        onSelectMode={onSelectMode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /conviction 3/i }));
    fireEvent.click(screen.getByRole('button', { name: /importance 8/i }));

    expect(screen.getByRole('heading', { name: /conviction 3 importance 8/i })).toHaveClass(
      'importanceText',
      'convictionToggleText',
    );
    expect(onSelectMode).toHaveBeenNthCalledWith(1, 'conviction');
    expect(onSelectMode).toHaveBeenNthCalledWith(2, 'importance');
  });

  it('hides the importance line until the toggle has been expanded', () => {
    render(
      <ConvictionImportanceLabel
        importanceToggleEnabled
        sliderMode="conviction"
        isExpanded={false}
        convictionValue={2}
        importanceValue={6}
        onSelectMode={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /conviction 2/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /importance 6/i })).not.toBeInTheDocument();
  });

  it('builds conviction/importance toggle line classes', () => {
    expect(
      buildConvictionImportanceToggleLineClassName({
        activeClassName: 'active',
        baseClassName: 'line',
        isActive: true,
      }),
    ).toBe('line active');
    expect(
      buildConvictionImportanceToggleLineClassName({
        activeClassName: 'active',
        baseClassName: 'line',
        isActive: false,
      }),
    ).toBe('line');
  });
});
