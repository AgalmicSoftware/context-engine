import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  LoginSettingsConfigToggleControl,
  LoginSettingsControlRow,
  LoginSettingsSessionSummary,
} from './LoginSettingsControlRow';

describe('LoginSettingsControlRow', () => {
  it('renders the config toggle state and click handler', () => {
    const onToggle = jest.fn();
    render(<LoginSettingsConfigToggleControl expanded onToggle={onToggle} testId="config-toggle" />);

    const button = screen.getByTestId('config-toggle');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders active session summary link', () => {
    render(
      <LoginSettingsSessionSummary
        activeSession={{ label: 'Edge Session', slug: 'edge' }}
        sessionHref="/session/edge"
      />,
    );

    expect(screen.getByLabelText('Active session: Edge Session')).toBeInTheDocument();
    expect(screen.getByLabelText('Open session Edge Session')).toHaveAttribute('href', '/session/edge');
  });

  it('composes injected controls around the session summary', () => {
    render(
      <LoginSettingsControlRow
        activeSession={{ label: 'General', slug: '' }}
        beforeConfig={<span>Before</span>}
        betweenSessionAndTooltips={<span>Network</span>}
        tooltipsControl={<button type="button">Explainers</button>}
        demoControl={<button type="button">Demo</button>}
        afterDemo={<span>After</span>}
      />,
    );

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('SESSION')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explainers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('groups the four primary settings controls into one equal quick-control grid', () => {
    render(
      <LoginSettingsControlRow
        activeSession={{ label: 'General', slug: '' }}
        layout="quick-grid"
        tooltipsControl={<button type="button">Explainers</button>}
        demoControl={<button type="button">Demo</button>}
        themeControl={
          <label htmlFor="theme-test">
            Theme
            <select id="theme-test">
              <option>Context Engine</option>
            </select>
          </label>
        }
      />,
    );

    const grid = screen.getByTestId('ce-settings-quick-controls');
    expect(grid.children).toHaveLength(4);
    expect(grid).toContainElement(screen.getByRole('button', { name: 'Config' }));
    expect(grid).toContainElement(screen.getByLabelText('Active session: General'));
    expect(grid).toContainElement(screen.getByRole('button', { name: 'Explainers' }));
    expect(grid).toContainElement(screen.getByRole('button', { name: 'Demo' }));
    expect(screen.getByLabelText('Theme')).not.toBe(grid);
    expect(grid.parentElement).toContainElement(screen.getByLabelText('Theme'));
  });

  it('can omit the session summary from a settings-only control row', () => {
    render(
      <LoginSettingsControlRow
        activeSession={{ label: 'General', slug: '' }}
        showSession={false}
        tooltipsControl={<button type="button">Explainers</button>}
        demoControl={<button type="button">Demo</button>}
      />,
    );

    expect(screen.queryByText('SESSION')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explainers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demo' })).toBeInTheDocument();
  });
});
