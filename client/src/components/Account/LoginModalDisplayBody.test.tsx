import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginModalDisplayBody, { SlowFallback } from './LoginModalDisplayBody';

// The profile, as the dialog's lazy chunk: it puts the dialog's rows in its own list.
jest.mock('components/UserPage/UserPage', () => ({
  __esModule: true,
  default: ({ accountMenuRows }: { accountMenuRows?: React.ReactNode }) => (
    <ul data-testid="profile-menu">{accountMenuRows}</ul>
  ),
}));

type Props = React.ComponentProps<typeof LoginModalDisplayBody>;

const renderBody = (props: Partial<Props>) => {
  const renderAgentHandoffPanel = jest.fn(() => <div data-testid="agent-box" />);
  render(
    <LoginModalDisplayBody
      {...({
        account: '',
        handleLogout: jest.fn(),
        handlePasskeyWalletCreate: jest.fn(),
        handlePasskeyWalletSignIn: jest.fn(),
        loginComplete: false,
        loginInProgress: false,
        openBookmarks: jest.fn(),
        openCryptoModal: jest.fn(),
        passkeyWalletStatusMessage: '',
        passkeyWalletStatusTone: '',
        passkeyWalletStatusHelp: '',
        provider: '',
        renderAgentTokenLoginPanel: () => null,
        renderAgentHandoffPanel,
      } as unknown as Props)}
      {...props}
      renderAgentHandoffPanel={renderAgentHandoffPanel}
    />,
  );
  return renderAgentHandoffPanel;
};

it('offers Your AI agent only once someone is signed in', () => {
  expect(renderBody({ loginComplete: false })).not.toHaveBeenCalled();
  expect(screen.queryByTestId('agent-box')).not.toBeInTheDocument();
});

it('shows Your AI agent to a signed-in person', () => {
  expect(renderBody({ loginComplete: true })).toHaveBeenCalled();
  expect(screen.getByTestId('agent-box')).toBeInTheDocument();
});

it('lists Bookmarks, Your AI agent and a red Disconnect, in that order, with no account to show', () => {
  const handleLogout = jest.fn();
  const openBookmarks = jest.fn();
  renderBody({ loginComplete: true, handleLogout, openBookmarks });
  const menu = screen.getByTestId('ce-account-menu');
  expect(Array.from(menu.children).map((row) => row.textContent)).toEqual(['Bookmarks', '', 'Disconnect']);
  expect(menu.children[1]).toContainElement(screen.getByTestId('agent-box'));
  fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
  expect(openBookmarks).toHaveBeenCalledTimes(1);
  const disconnect = screen.getByTestId('ce-account-disconnect');
  expect(disconnect.className).toMatch(/accountMenuRowDanger/);
  fireEvent.click(disconnect);
  expect(handleLogout).toHaveBeenCalledTimes(1);
});

it('shows one Disconnect, in the profile list, when the profile loads quickly, and mounts Your AI agent once', async () => {
  renderBody({ loginComplete: true, account: '0x00000000000000000000000000000000000000aa' });
  // Not swapped from under a click: the rows on their own wait for a slow load.
  expect(screen.queryByTestId('ce-account-disconnect')).not.toBeInTheDocument();
  expect(screen.queryByTestId('agent-box')).not.toBeInTheDocument();
  const profile = await screen.findByTestId('profile-menu');
  expect(profile).toContainElement(screen.getByTestId('agent-box'));
  expect(profile).toContainElement(screen.getByTestId('ce-account-disconnect'));
  expect(screen.getAllByTestId('agent-box')).toHaveLength(1);
});

it('shows the rows on their own only once the profile is slow', () => {
  jest.useFakeTimers();
  try {
    render(
      <SlowFallback>
        <span>Disconnect</span>
      </SlowFallback>,
    );
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
