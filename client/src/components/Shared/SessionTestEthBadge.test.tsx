import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SessionTestEthBadge from './SessionTestEthBadge';
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';

jest.mock('../../utilities/worker/workerResourcePresence', () => ({
  readWorkerResourcePresence: jest.fn(),
  getCachedWorkerResourcePresence: jest.fn(() => null),
}));

const config = {
  networkChainId: 11155420,
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  workerAuthority: { participantScopes: ['faucet'] },
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows the hosted badge from public presence without signing in', async () => {
  jest.mocked(readWorkerResourcePresence).mockResolvedValue({ ai: false, arweave: false, rpc: false, txGas: true });
  render(<SessionTestEthBadge sessionConfig={config} sessionSlug="example" loadPresence />);
  const badge = await screen.findByTestId('ce-session-test-eth-badge');
  expect(badge).toHaveTextContent('Test ETH');
  expect(badge).toHaveAttribute('title', expect.stringContaining('OP Sepolia'));
});

it('hides the badge without faucet scope and makes no requests in lists', () => {
  const { rerender } = render(
    <SessionTestEthBadge
      sessionConfig={{ ...config, workerAuthority: { participantScopes: [] } }}
      resourcePresence={{ txGas: true }}
    />,
  );
  expect(screen.queryByTestId('ce-session-test-eth-badge')).not.toBeInTheDocument();
  rerender(<SessionTestEthBadge sessionConfig={config} />);
  expect(screen.queryByTestId('ce-session-test-eth-badge')).not.toBeInTheDocument();
  expect(readWorkerResourcePresence).not.toHaveBeenCalled();
});

it('describes the gas gate for registry sessions and clears stale presence on session changes', async () => {
  const { rerender } = render(
    <SessionTestEthBadge sessionConfig={{ networkChainId: 84532 }} resourcePresence={{ txGas: true }} />,
  );
  const badge = screen.getByTestId('ce-session-test-eth-badge');
  expect(badge).toHaveAttribute('title', expect.stringContaining("session's gas gate"));
  jest.mocked(readWorkerResourcePresence).mockResolvedValue(null);
  rerender(<SessionTestEthBadge sessionConfig={config} sessionSlug="other" loadPresence />);
  await waitFor(() => expect(screen.queryByTestId('ce-session-test-eth-badge')).not.toBeInTheDocument());
});
