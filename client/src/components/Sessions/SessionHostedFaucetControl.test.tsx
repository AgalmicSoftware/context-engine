import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ethers } from 'ethers';
import SessionHostedFaucetControl from './SessionHostedFaucetControl';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const fixture = () => {
  const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  sessionModeProfile.evm.registryChainId = 11155420;
  sessionModeProfile.encryption.accessConditions = {
    match: 'any',
    conditions: [
      { kind: 'sbt_onchain', chainId: 11155420, contract: ethers.Wallet.createRandom().address, anyOrAll: 'any' },
    ],
  };
  return { sessionModeProfile, networkChainId: 11155420 };
};

test('offers an off-by-default hosted faucet with its funding address and daily limit', () => {
  const wallet = ethers.Wallet.createRandom();
  const Harness = () => {
    const [draft, setDraft] = useState<Record<string, unknown>>(fixture());
    return <SessionHostedFaucetControl draft={draft} faucetPrivateKey={wallet.privateKey} onChange={setDraft} />;
  };
  render(<Harness />);
  const control = screen.getByRole('switch', { name: 'Send participants test ETH for gas' });
  expect(control).not.toBeChecked();
  fireEvent.click(control);
  expect(control).toBeChecked();
  expect(screen.getByText(new RegExp(wallet.address))).toHaveTextContent('up to 3 times a day');
});

test('explains mismatched networks and hides the switch without SBT rules', () => {
  const draft = fixture();
  draft.networkChainId = 84532;
  const { rerender } = render(<SessionHostedFaucetControl draft={draft} onChange={jest.fn()} />);
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByText(/Every on-chain SBT rule/)).toBeInTheDocument();
  delete draft.sessionModeProfile.encryption.accessConditions;
  rerender(<SessionHostedFaucetControl draft={draft} onChange={jest.fn()} />);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
