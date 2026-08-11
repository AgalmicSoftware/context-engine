import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import fs from 'fs';
import path from 'path';
import LoginButton from './LoginButton';

const accountStylesheet = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

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
  it('opens the account modal when idle', () => {
    const launchAccountModal = jest.fn();

    const { container } = render(
      <Provider store={createStore(false) as any}>
        <LoginButton launchAccountModal={launchAccountModal} />
      </Provider>,
    );

    expect(container.querySelector('.navConnectContainer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toHaveClass('navConnectButton');
    expect(screen.getByText(/log in/i)).toHaveClass('loginPromptText');
    expect(container.querySelector('.loginIcons')).toBeInTheDocument();

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

  it('keeps classic login geometry on the shared responsive breakpoints', () => {
    const classicLoginStyles = accountStylesheet.slice(accountStylesheet.indexOf('.classicLoginKey'));

    expect(accountStylesheet).toMatch(
      /@media \(min-width:\s*466px\) and \(max-width:\s*768px\)[\s\S]*?\.navConnectButton\s*{[\s\S]*?min-height:\s*80px !important;/,
    );
    expect(classicLoginStyles).not.toContain('min-width: 150px !important;');
    expect(classicLoginStyles).not.toContain('min-height: 46px !important;');
    expect(classicLoginStyles).not.toContain('min-width: 116px !important;');
    expect(classicLoginStyles).not.toContain('min-height: 40px !important;');
    expect(classicLoginStyles).not.toMatch(/\.loginPromptText\s*{[\s\S]*?font-size:\s*(?:1rem|0\.88rem);/);
  });
});
