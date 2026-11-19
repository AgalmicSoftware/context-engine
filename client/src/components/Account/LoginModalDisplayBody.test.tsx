import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginModalDisplayBody from './LoginModalDisplayBody';

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
