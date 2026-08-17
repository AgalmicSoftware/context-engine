import React from 'react';
import fs from 'fs';
import path from 'path';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Navbar } from './Navbar';

const navbarStylesheet = fs.readFileSync(path.join(__dirname, 'Navbar.module.scss'), 'utf8');
const mockLoginAndSettingsModal = jest.fn((_props: unknown) => <div data-testid="web3-modal" />);

jest.mock('./AccountDisplay', () => ({
  AccountDisplayTorus: ({ account }: any) => <div data-testid="account-display">{account}</div>,
}));

jest.mock('../Account/LoginAndSettingsModal', () => ({
  __esModule: true,
  default: (props: unknown) => mockLoginAndSettingsModal(props),
}));
jest.mock('components/Account/LoginButton', () => () => <button type="button">Connect Wallet</button>);
jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: () => '',
}));

jest.mock('utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../../variables/appConfig.js', () => ({
  ENABLE_CE_LOGO_ANIMATION: false,
  CE_LOGO_ANIMATION_MODE: 'forward',
  CE_LOGO_ANIMATION_DURATION_MS_FORWARD: 0,
  CE_LOGO_ANIMATION_DURATION_MS_PINGPONG: 0,
}));

describe('Navbar logo navigation', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  const buildStore = (overrides: any = {}) =>
    createStore(
      (
        state = {
          sessionState: {
            loginModalToggled: false,
            loginComplete: false,
            ...overrides.sessionState,
          },
          profile: {
            userImageURL: null,
            ...overrides.profile,
          },
        },
      ) => state,
    );

  const renderNavbar = (props: any = {}, storeOverrides: any = {}) =>
    render(
      <Provider store={buildStore(storeOverrides)}>
        <Navbar
          demoMode={{ tools: false }}
          toggleDemoMode={jest.fn()}
          loginComplete={false}
          loginInProgress={false}
          {...props}
        />
      </Provider>,
    );

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).PUBLIC_URL = '/ce-base';
    mockLoginAndSettingsModal.mockClear();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).PUBLIC_URL = originalPublicUrl;
    jest.restoreAllMocks();
  });

  it('prefers router navigation to the configured base url', () => {
    const navigate = jest.fn();

    renderNavbar({ navigate });
    const homeLink = screen.getByRole('link', { name: 'Context Engine home' });

    expect(homeLink).toHaveAttribute('href', '/ce-base');
    fireEvent.click(homeLink);

    expect(navigate).toHaveBeenCalledWith('/ce-base');
  });

  it('exposes the logged-out logo as a keyboard-focusable home link', () => {
    renderNavbar();
    const homeLink = screen.getByRole('link', { name: 'Context Engine home' });

    expect(homeLink).toHaveAttribute('href', '/ce-base');
    homeLink.focus();
    expect(homeLink).toHaveFocus();
  });

  it('exposes the logged-in logo as a keyboard-focusable home link', () => {
    renderNavbar(
      {
        account: '0x1111111111111111111111111111111111111111',
        provider: 'wagmi',
        loginComplete: true,
      },
      {
        sessionState: { loginComplete: true },
      },
    );
    const homeLink = screen.getByRole('link', { name: 'Context Engine home' });

    expect(homeLink).toHaveAttribute('href', '/ce-base');
    homeLink.focus();
    expect(homeLink).toHaveFocus();
  });

  it('falls back to location.assign with the configured base url', () => {
    const subject = new Navbar({});
    subject.navigateWithWindow = jest.fn();

    subject.logoClicked();

    expect(subject.navigateWithWindow).toHaveBeenCalledWith('/ce-base');
  });

  it('renders logged-in account controls without the legacy XP or votes widget', () => {
    renderNavbar(
      {
        account: '0x1111111111111111111111111111111111111111',
        provider: 'wagmi',
        loginComplete: true,
      },
      {
        sessionState: { loginComplete: true },
      },
    );

    expect(screen.getByTestId('account-display')).toHaveTextContent('0x1111111111111111111111111111111111111111');
    expect(screen.queryByText(/Votes:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/i)).not.toBeInTheDocument();
  });

  it('does not render the GitHub link in the navbar', () => {
    renderNavbar();

    expect(screen.queryByTestId('ce-navbar-link-github')).not.toBeInTheDocument();
  });

  it('loads the settings modal only when it opens and forwards the active session config', async () => {
    const sessionConfig = {
      slug: 'worker-session',
      corsWorkerUrl: 'https://worker-session.example',
    };

    renderNavbar({ sessionConfig });
    expect(mockLoginAndSettingsModal).not.toHaveBeenCalled();

    renderNavbar({ sessionConfig }, { sessionState: { loginModalToggled: true } });

    await waitFor(() =>
      expect(mockLoginAndSettingsModal).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionConfig,
        }),
      ),
    );
  });

  it('keeps the navbar account controls anchored to the right edge after legacy widget removal', () => {
    expect(navbarStylesheet).toMatch(
      /#accountSection,\s*#accountSectionLoggedIn\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-end;[\s\S]*margin-left:\s*auto;/,
    );
  });

  it('renders both navbar logo variants through the app-theme brand contract', () => {
    expect(navbarStylesheet).toMatch(
      /#mainLogo\s*{[\s\S]*?opacity:\s*var\(--ce-brand-logo-opacity\);[\s\S]*?mix-blend-mode:\s*var\(--ce-brand-logo-blend-mode\);[\s\S]*?filter:\s*var\(--ce-brand-logo-filter\);/,
    );
    expect(navbarStylesheet).toMatch(
      /#mainLogoLoggedIn\s*{[\s\S]*?opacity:\s*var\(--ce-brand-logo-opacity\);[\s\S]*?mix-blend-mode:\s*var\(--ce-brand-logo-blend-mode\);[\s\S]*?filter:\s*var\(--ce-brand-logo-filter\);/,
    );
    expect(navbarStylesheet).not.toContain('data-ce-theme');
  });

  it('keeps classic logo geometry on the shared responsive breakpoints', () => {
    expect(navbarStylesheet).toMatch(
      /@media \(min-width:\s*466px\) and \(max-width:\s*768px\)[\s\S]*?#mainLogo\s*{[\s\S]*?max-width:\s*156px;[\s\S]*?min-height:\s*75px;/,
    );
    expect(navbarStylesheet).not.toContain('width: 108px;');
    expect(navbarStylesheet).not.toContain('height: 76px;');
    expect(navbarStylesheet).not.toContain('width: 76px;');
    expect(navbarStylesheet).not.toContain('height: 58px;');
  });

  it('vertically centers classic desktop-window account controls with the logo', () => {
    expect(navbarStylesheet).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?#navbarContainer,\s*#navbarContainerLoggedIn\s*{[\s\S]*?align-items:\s*center;/,
    );
  });
});
