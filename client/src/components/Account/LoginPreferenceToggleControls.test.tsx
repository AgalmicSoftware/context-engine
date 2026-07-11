import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import LoginDemoSurfaceToggleControl from './LoginDemoSurfaceToggleControl';
import LoginTooltipsToggleControl from './LoginTooltipsToggleControl';

describe('login preference toggle controls', () => {
  it('renders Explainers as a pressed switch control and keeps its state in the accessible name', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <LoginTooltipsToggleControl infoId="explainer-info" onToggle={onToggle} tooltipsEnabled />,
    );

    const enabledToggle = screen.getByRole('button', { name: 'Explainers On' });
    expect(enabledToggle).toHaveAttribute('aria-pressed', 'true');
    expect(enabledToggle.querySelector('span[aria-hidden="true"] span')).toBeInTheDocument();

    fireEvent.click(enabledToggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<LoginTooltipsToggleControl infoId="explainer-info" onToggle={onToggle} tooltipsEnabled={false} />);
    expect(screen.getByRole('button', { name: 'Explainers Off' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders Demo Mode as an off switch and toggles through the existing callback', () => {
    const onToggle = jest.fn();
    render(<LoginDemoSurfaceToggleControl demoSurfaceEnabled={false} onToggle={onToggle} />);

    const toggle = screen.getByRole('button', { name: 'Demo Mode Off' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.querySelector('span[aria-hidden="true"] span')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
