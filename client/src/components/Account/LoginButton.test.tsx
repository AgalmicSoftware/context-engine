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
});
