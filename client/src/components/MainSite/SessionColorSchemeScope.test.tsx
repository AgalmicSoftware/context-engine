import { act, render } from '@testing-library/react';
import { setStoredThemePreference } from '../../utilities/ui/themeRuntime';
import SessionColorSchemeScope from './SessionColorSchemeScope';

describe('SessionColorSchemeScope', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.ceTheme = 'context-engine';
    document.documentElement.dataset.ceThemeSource = 'deployment';
    document.documentElement.dataset.ceDeploymentTheme = 'context-engine';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-ce-theme');
    document.documentElement.removeAttribute('data-ce-theme-source');
    document.documentElement.removeAttribute('data-ce-deployment-theme');
  });

  test('replaces session A with session B and removes the scope outside a session route', () => {
    const { container, rerender } = render(
      <SessionColorSchemeScope active sessionConfig={{ appearance: { colorSchemeId: 'ocean' } }}>
        <span>Session</span>
      </SessionColorSchemeScope>,
    );
    const scope = () => container.querySelector('[data-ce-session-color-scope]');

    expect(scope()).toHaveAttribute('data-ce-session-color-scheme', 'ocean');
    rerender(
      <SessionColorSchemeScope active sessionConfig={{ appearance: { colorSchemeId: 'amber' } }}>
        <span>Session</span>
      </SessionColorSchemeScope>,
    );
    expect(scope()).toHaveAttribute('data-ce-session-color-scheme', 'amber');

    rerender(
      <SessionColorSchemeScope active={false} sessionConfig={{ appearance: { colorSchemeId: 'amber' } }}>
        <span>Home</span>
      </SessionColorSchemeScope>,
    );
    expect(scope()).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-ce-session-color-scheme');
    expect(document.body).not.toHaveAttribute('data-ce-session-color-scheme');
  });

  test('falls back for untrusted metadata and suppresses the scope for an explicit user theme', () => {
    const { container } = render(
      <SessionColorSchemeScope
        active
        sessionConfig={{ appearance: { colorSchemeId: 'url(https://example.invalid/theme.css)' } }}
      >
        <span>Session</span>
      </SessionColorSchemeScope>,
    );
    expect(container.querySelector('[data-ce-session-color-scope]')).toHaveAttribute(
      'data-ce-session-color-scheme',
      'context-engine',
    );

    act(() => {
      setStoredThemePreference('classic-95');
    });
    expect(container.querySelector('[data-ce-session-color-scope]')).toBeNull();
  });
});
