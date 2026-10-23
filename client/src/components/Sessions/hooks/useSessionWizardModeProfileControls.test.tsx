import React, { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../../utilities/session/sessionModeProfile';
import useSessionWizardModeProfileControls from './useSessionWizardModeProfileControls';

const Harness = ({ network = 11155420, onRegistryChainChange = (_chainId: number) => {} }) => {
  const [draft, setDraft] = useState(() => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.evm.registryChainId = 11155420;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x00000000000000000000000000000000000000bb',
          anyOrAll: 'any',
        },
      ],
    };
    return { sessionModeProfile: profile, networkChainId: 11155420 };
  });
  const draftRef = useRef(draft);
  const [, setCollapsedSections] = useState({ encryption: false });
  const controls = useSessionWizardModeProfileControls({
    draft,
    draftRef,
    setDraft,
    setCollapsedSections,
    registryChainId: network,
    onRegistryChainChange,
    entryOnly: false,
    customizing: true,
    showContinue: false,
    onContinue: () => {},
    onEnterAdvancedMode: () => {},
    onEnterNormalMode: () => {},
  });
  return (
    <>
      {controls.worker}
      {controls.privacy}
    </>
  );
};

test('clears the faucet switch when the wizard network changes', () => {
  const { rerender } = render(<Harness />);
  const control = screen.getByRole('switch', { name: 'Send participants test ETH for gas' });
  fireEvent.click(control);
  expect(control).toBeChecked();
  rerender(<Harness network={84532} />);
  expect(control).not.toBeChecked();
});

test('a rule network edit updates the shared wizard network', () => {
  const onRegistryChainChange = jest.fn();
  render(<Harness onRegistryChainChange={onRegistryChainChange} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'SBT network' }), { target: { value: '84532' } });
  expect(onRegistryChainChange).toHaveBeenLastCalledWith(84532);
});
