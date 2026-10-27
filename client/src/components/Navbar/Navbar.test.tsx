import React from 'react';
import fs from 'fs';
import path from 'path';
import * as sass from 'sass';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Navbar } from './Navbar';

const navbarStylesheet = fs.readFileSync(path.join(__dirname, 'Navbar.module.scss'), 'utf8');
const compiledNavbarStylesheet = sass.compile(path.join(__dirname, 'Navbar.module.scss')).css;
const mockLoginAndSettingsModal = jest.fn((_props: unknown) => <div data-testid="web3-modal" />);

jest.mock('./AccountDisplay', () => ({
  AccountDisplayTorus: ({ account }: any) => <div data-testid="account-display">{account}</div>,
}));

jest.mock('../Account/LoginAndSettingsModal', () => ({
  __esModule: true,
  default: (props: unknown) => mockLoginAndSettingsModal(props),
}));
jest.mock('components/Account/LoginButton', () => () => <button type="button">Connect Wallet</button>);
jest.mock('../../wallet/passkeyWallet.js', () => ({
  getPasskeyWalletChain: () => null,
  restorePasskeyWalletSession: async () => null,
}));
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

  it.each([
    ['logged-out', {}, {}],
    [
      'logged-in',
      { account: '0x1111111111111111111111111111111111111111', provider: 'wagmi', loginComplete: true },
      { sessionState: { loginComplete: true } },
    ],
  ])('renders a single logo image in the %s navbar', (state, props, storeOverrides) => {
    renderNavbar(props, storeOverrides);
    const homeLink = screen.getByRole('link', { name: 'Context Engine home' });

    // Hidden images still download, so every theme shares one logo element.
    expect(homeLink.querySelectorAll('img')).toHaveLength(1);
    expect(homeLink.querySelector('img')).toHaveAttribute(
      'id',
      state === 'logged-in' ? 'mainLogoLoggedIn' : 'mainLogo',
    );
  });

  it('renders the navbar logo through the app-theme brand contract', () => {
    expect(navbarStylesheet).toMatch(
      /#mainLogo\s*{[\s\S]*?opacity:\s*var\(--ce-brand-logo-opacity\);[\s\S]*?mix-blend-mode:\s*var\(--ce-brand-logo-blend-mode\);[\s\S]*?filter:\s*var\(--ce-brand-logo-filter\);/,
    );
    expect(navbarStylesheet).toMatch(
      /#mainLogoLoggedIn\s*{[\s\S]*?opacity:\s*var\(--ce-brand-logo-opacity\);[\s\S]*?mix-blend-mode:\s*var\(--ce-brand-logo-blend-mode\);[\s\S]*?filter:\s*var\(--ce-brand-logo-filter\);/,
    );
    expect(navbarStylesheet).not.toContain('data-ce-theme');
  });

  it('keeps both logo states at the signed-out size without enlarging the account button', () => {
    const sharedLogo = compiledNavbarStylesheet.match(/#mainLogo,\s*#mainLogoLoggedIn\s*\{([^}]+)\}/)?.[1];
    expect(sharedLogo).toContain('width: var(--ce-navbar-logo-size);');
    expect(sharedLogo).toContain('max-width: var(--ce-navbar-logo-size);');
    expect(sharedLogo).toContain('height: var(--ce-navbar-logo-size);');
    expect(sharedLogo).toContain('transform: scale(calc(var(--ce-navbar-logo-scale) * 1.343));');
    expect(compiledNavbarStylesheet).toMatch(
      /#navbarContainer,\s*#navbarContainerLoggedIn\s*\{[^}]*--ce-navbar-logo-size: 100px;[^}]*--ce-navbar-logo-scale: 1;/,
    );
    expect(compiledNavbarStylesheet).toMatch(/#navbarContainerLoggedIn\s*\{\s*--ce-navbar-control-size: 49px;/);
    expect(compiledNavbarStylesheet).toMatch(/\.addressButton\s*\{\s*height: var\(--ce-navbar-control-size, auto\);/);
  });

  it('reserves balanced vertical whitespace around the logo in both account states', () => {
    expect(compiledNavbarStylesheet).toMatch(
      /#navbarContainer,\s*#navbarContainerLoggedIn\s*\{[^}]*--ce-navbar-logo-size: 100px;[^}]*padding-top: 16px;[^}]*padding-bottom: 16px;/,
    );
  });

  it('anchors the scaled phone account control to the right so it clears the full-size logo', () => {
    expect(compiledNavbarStylesheet).toMatch(
      /@media \(min-width: 320px\) and \(max-width: 465px\)\s*\{\s*#AccountSectionLoggedIn\s*\{[^}]*transform: scale\(var\(--ce-navbar-control-scale, 0.8\)\);[^}]*transform-origin: right center;/,
    );
    expect(compiledNavbarStylesheet).toMatch(
      /@media \(min-width: 320px\) and \(max-width: 465px\)\s*\{\s*@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*\{\s*#navbarContainerLoggedIn\s*\{[^}]*flex-wrap: wrap;[^}]*row-gap: 8px;/,
    );
  });

  it.each([
    [768, 80, null],
    [465, 70, 0.9],
  ])('shares the signed-out logo geometry across both states below %spx', (breakpoint, size, scale) => {
    // Theme-scoped media rules do not replace these shared breakpoint defaults.
    const responsiveLogo = [
      ...compiledNavbarStylesheet.matchAll(
        new RegExp(
          `^@media \\(max-width: ${breakpoint}px\\)\\s*\\{\\s*#navbarContainer,\\s*#navbarContainerLoggedIn\\s*\\{([^}]+)\\}`,
          'gm',
        ),
      ),
    ].at(-1)?.[1];
    expect(responsiveLogo).toContain(`--ce-navbar-logo-size: ${size}px;`);
    if (scale !== null) expect(responsiveLogo).toContain(`--ce-navbar-logo-scale: ${scale};`);
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
