import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getThemeMetadata } from '../../utilities/ui/themeRegistry';
import { clearStoredThemePreference, setStoredThemePreference } from '../../utilities/ui/themeRuntime';

import { LoginSettingsConfigToggleControl, LoginSettingsControlRow } from './LoginSettingsControlRow';

describe('LoginSettingsControlRow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    clearStoredThemePreference();
  });

  it('renders the config toggle state and click handler', () => {
    const onToggle = jest.fn();
    render(<LoginSettingsConfigToggleControl expanded onToggle={onToggle} testId="config-toggle" />);

    const button = screen.getByTestId('config-toggle');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('composes injected controls around the session summary', () => {
    render(
      <LoginSettingsControlRow
        sessionControl={
          <select aria-label="Session">
            <option>General</option>
          </select>
        }
        beforeConfig={<span>Before</span>}
        betweenSessionAndTooltips={<span>Network</span>}
        tooltipsControl={<button type="button">Explainers</button>}
        afterToggles={<span>After</span>}
      />,
    );

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Session' })).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explainers' })).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  const renderStrip = (props: Partial<React.ComponentProps<typeof LoginSettingsControlRow>> = {}) =>
    render(
      <LoginSettingsControlRow
        layout="strip"
        showAppearance
        sessionControl={
          <select aria-label="Session">
            <option>General</option>
          </select>
        }
        tooltipsControl={<button type="button">Explainers On</button>}
        {...props}
      />,
    );

  it('puts Config, Session, Explainers and Appearance in one labelled strip', () => {
    const onToggleConfig = jest.fn();
    renderStrip({ configOpen: true, onToggleConfig, configTestId: 'config-toggle' });

    const strip = screen.getByTestId('ce-settings-quick-controls');
    expect(Array.from(strip.children).map((cell) => cell.getAttribute('data-cell'))).toEqual([
      'config',
      'session',
      'explainers',
      'appearance',
    ]);
    const config = screen.getByRole('button', { name: 'Config' });
    // The first section says only "Config": the word Advanced is gone, and its heading is kept as space alone.
    expect(config).toHaveTextContent(/^Config/);
    expect(strip).not.toHaveTextContent('Advanced');
    expect(strip.querySelector('[data-cell="config"] > span')).toHaveStyle({ visibility: 'hidden' });
    expect(config).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(config);
    expect(onToggleConfig).toHaveBeenCalledTimes(1);
    expect(strip).toContainElement(screen.getByRole('combobox', { name: 'Session' }));
    expect(strip).toContainElement(screen.getByRole('button', { name: 'Explainers On' }));
  });

  it('opens Appearance as a disclosure below the strip and closes it again', async () => {
    const user = userEvent.setup();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    renderStrip();

    const appearance = screen.getByRole('button', { name: /^Appearance / });
    expect(appearance).toHaveAttribute('aria-expanded', 'false');
    expect(appearance).not.toHaveAttribute('aria-controls');
    expect(screen.queryByTestId('ce-settings-appearance-panel')).not.toBeInTheDocument();

    // Tab order follows the strip: Config, Session, Explainers, Appearance.
    for (let step = 0; step < 4; step += 1) await user.tab();
    expect(appearance).toHaveFocus();
    await user.keyboard('{Enter}');

    const panel = screen.getByTestId('ce-settings-appearance-panel');
    expect(appearance).toHaveAttribute('aria-expanded', 'true');
    expect(appearance).toHaveAttribute('aria-controls', panel.id);
    expect(appearance).toHaveFocus();
    expect(screen.getByTestId('ce-settings-quick-controls')).not.toContainElement(panel);
    expect(panel).toContainElement(screen.getByLabelText('Theme'));
    expect(panel).toContainElement(screen.getByRole('checkbox', { name: 'Color-blind mode' }));

    await user.keyboard(' ');
    expect(appearance).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ce-settings-appearance-panel')).not.toBeInTheDocument();
    // Opening and closing is not remembered anywhere.
    expect(setItem).not.toHaveBeenCalled();
  });

  it('names the Appearance button after the theme in use', () => {
    renderStrip();
    const appearance = screen.getByRole('button', { name: /^Appearance / });
    act(() => setStoredThemePreference('civic'));
    expect(appearance).toHaveAccessibleName(`Appearance ${getThemeMetadata('civic').label}`);
  });

  it('leaves Appearance out when the row does not ask for it', () => {
    renderStrip({ showAppearance: false });
    expect(screen.queryByRole('button', { name: /^Appearance/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-settings-quick-controls').children).toHaveLength(3);
  });

  it('can omit the session summary from a settings-only control row', () => {
    render(
      <LoginSettingsControlRow
        sessionControl={
          <select aria-label="Session">
            <option>General</option>
          </select>
        }
        showSession={false}
        tooltipsControl={<button type="button">Explainers</button>}
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Session' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explainers' })).toBeInTheDocument();
  });
});
