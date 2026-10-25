import React from 'react';
import { Input, Label } from 'reactstrap';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';
import { describeHostedFaucetSetup, faucetAddressFromKey, setHostedFaucetEnabled } from './sessionWizardHostedFaucet';
import styles from './SessionWizard.module.scss';

type Props<Draft extends UnknownRecord> = {
  draft: Draft;
  faucetPrivateKey?: unknown;
  onChange: (draft: Draft) => void;
};

export default function SessionHostedFaucetControl<Draft extends UnknownRecord>({
  draft,
  faucetPrivateKey,
  onChange,
}: Props<Draft>) {
  const setup = describeHostedFaucetSetup(draft);
  if (!setup.visible) return null;
  const address = faucetAddressFromKey(faucetPrivateKey);
  return (
    <div className={styles.modeSection}>
      <Label check>
        <Input
          type="checkbox"
          role="switch"
          checked={setup.enabled}
          disabled={!setup.eligible}
          onChange={(event) => onChange(setHostedFaucetEnabled(draft, event.target.checked))}
          data-testid="ce-new-hosted-test-eth"
        />{' '}
        Send participants test ETH for gas
      </Label>
      {!setup.eligible && <div className={styles.helperText}>{setup.reason}</div>}
      {setup.enabled && (
        <div className={styles.helperText}>
          {address
            ? `Fund ${address} with test ETH on ${setup.network}.`
            : `Enter a valid faucet private key below, then fund its address with test ETH on ${setup.network}.`}{' '}
          Each participant can receive 0.0002 test ETH while their balance is under 0.001, up to 3 times a day.
        </div>
      )}
    </div>
  );
}
