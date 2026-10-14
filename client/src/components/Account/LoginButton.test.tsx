import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import fs from 'fs';
import path from 'path';
import * as sass from 'sass';
import LoginButton from './LoginButton';

const accountStylesheet = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');
const compiledAccountStylesheet = sass.compile(path.join(__dirname, 'Account.module.scss')).css;

const createStore = (loginInProgress = false) => ({
  getState: () => ({
    sessionState: {
      loginInProgress,
    },
  }),
  subscribe: () => () => {},
  dispatch: jest.fn(),
});

describe('LoginButton', () => {
  it('pairs Civic account text and inline editor fields with the light-blue account surface', () => {
    const civicStyles = accountStylesheet.slice(
      accountStylesheet.indexOf('@container ce-theme style(--ce-layout-profile: minimal-app)'),
    );
    const accountPanel = civicStyles.slice(
      civicStyles.indexOf('#accountModalPanel {'),
      civicStyles.indexOf('.navConnectContainer {'),
    );
    expect(accountPanel).toContain('color-mix(in srgb, var(--ce-action-submit) 16%, var(--ce-color-white))');
    expect(accountPanel).toContain('color-mix(in srgb, var(--ce-action-submit) 22%, var(--ce-color-white))');
    expect(accountPanel).toContain('color: var(--ce-panel-text);');
    expect(accountPanel).toContain('--ce-text-inverse: var(--ce-panel-text);');
    expect(accountPanel).not.toContain('--ce-panel-text:');
    expect(accountPanel).not.toContain('--ce-input-bg:');
    expect(accountPanel).not.toContain('--ce-focus-ring:');
  });

  it('keeps the dark profile error text out of the Disconnect danger-gradient tokens', () => {
    const panelBlocks = [...compiledAccountStylesheet.matchAll(/#accountModalPanel\s*\{([^}]+)\}/g)];
    const civicPanel = panelBlocks.find(([, declarations]) => declarations.includes('--ce-action-submit'))?.[1];
    expect(civicPanel).toBeDefined();
    expect(civicPanel).not.toContain('--ce-status-error:');
    expect(civicPanel).not.toContain('--ce-status-danger:');
    expect(compiledAccountStylesheet).toMatch(
      /#accountModalPanel \.accountModalProfileShell\s*\{[^}]*--ce-status-error:\s*var\(--ce-status-danger-text\);/,
    );
    expect(compiledAccountStylesheet).toMatch(
      /#accountModalPanel \.disconnectButton\s*\{[^}]*color:\s*var\(--ce-action-primary-text\);/,
    );
  });

  it('gives the Settings dropdown a full row on narrow screens while preserving the desktop grid', () => {
    expect(compiledAccountStylesheet).toMatch(
      /\.settingsQuickControlsGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
    const mobileGrid = compiledAccountStylesheet.match(
      /@media \(max-width: 480px\)\s*\{[\s\S]*?\.settingsQuickControlsGrid\s*\{([^}]+)\}/,
    )?.[1];
    expect(mobileGrid).toContain('grid-template-columns: 1fr;');
  });

  it('opens the account modal when idle', () => {
    const launchAccountModal = jest.fn();

    const { container } = render(
      <Provider store={createStore(false) as any}>
        <LoginButton launchAccountModal={launchAccountModal} />
      </Provider>,
    );

    expect(container.querySelector('.navConnectContainer')).toBeInTheDocument();
    expect(screen.getByTestId('ce-account-login-button')).toBe(screen.getByRole('button', { name: /log in/i }));
    expect(screen.getByRole('button', { name: /log in/i })).toHaveClass('navConnectButton');
    expect(screen.getByText(/log in/i)).toHaveClass('loginPromptText');
    expect(container.querySelector('.loginIcons')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(launchAccountModal).toHaveBeenCalledTimes(1);
  });

  it('disables login while login is in progress', () => {
    const launchAccountModal = jest.fn();

    const { container } = render(
      <Provider store={createStore(true) as any}>
        <LoginButton launchAccountModal={launchAccountModal} />
      </Provider>,
    );

    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(container.querySelector('.loginIcon')).toBeInTheDocument();
    fireEvent.click(button);
    expect(launchAccountModal).not.toHaveBeenCalled();
  });

  it('keeps classic login geometry and uses the theme button face without a key icon', () => {
    const classicLoginStyles = accountStylesheet.slice(
      accountStylesheet.indexOf('@container ce-theme style(--ce-layout-profile: desktop-window)'),
    );

    expect(accountStylesheet).toMatch(
      /@media \(min-width:\s*466px\) and \(max-width:\s*768px\)[\s\S]*?\.navConnectButton\s*{[\s\S]*?min-height:\s*var\(--ce-navbar-control-size,\s*80px\) !important;/,
    );
    expect(classicLoginStyles).not.toContain('min-width: 150px !important;');
    expect(classicLoginStyles).not.toContain('min-height: 46px !important;');
    expect(classicLoginStyles).not.toContain('min-width: 116px !important;');
    expect(classicLoginStyles).not.toContain('min-height: 40px !important;');
    expect(classicLoginStyles).not.toContain('.classicLoginKey');
    expect(classicLoginStyles).toMatch(/\.loginPromptText\s*\{[\s\S]*?font-family:\s*var\(--ce-font-button\);/);
    expect(classicLoginStyles).not.toMatch(/\.loginPromptText\s*{[\s\S]*?font-size:\s*(?:1rem|0\.88rem);/);
  });
});
