import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import LoginButton from './LoginButton';

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

    render(
      <Provider store={createStore(false) as any}>
        <LoginButton launchAccountModal={launchAccountModal} />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(launchAccountModal).toHaveBeenCalledTimes(1);
  });

  it('disables login while login is in progress', () => {
    const launchAccountModal = jest.fn();

    render(
      <Provider store={createStore(true) as any}>
        <LoginButton launchAccountModal={launchAccountModal} />
      </Provider>
    );

    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(launchAccountModal).not.toHaveBeenCalled();
  });
});
