import { Input, Label } from 'reactstrap';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';
import { describeHostedFaucetSetup, faucetAddressFromKey, setHostedFaucetEnabled } from './sessionWizardHostedFaucet';
import styles from './SessionWizard.module.scss';
import { SetupHelp, setupHelpId } from './setup/SetupPrimitives';

const FAUCET_ID = 'ce-new-hosted-test-eth';
const FAUCET_LABEL = 'Send participants test ETH for gas';
const FAUCET_HELP =
  'The Session Worker gives each participant 0.0002 test ETH while their balance is under 0.001, up to 3 times a day, so they can pay for their SBT transactions. It pays from the faucet private key below.';

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
      <div className={styles.fieldLabelRow}>
        <Label check>
          <Input
            id={FAUCET_ID}
            type="checkbox"
            role="switch"
            checked={setup.enabled}
            disabled={!setup.eligible}
            aria-describedby={setupHelpId(FAUCET_ID)}
            onChange={(event) => onChange(setHostedFaucetEnabled(draft, event.target.checked))}
            data-testid={FAUCET_ID}
          />{' '}
          {FAUCET_LABEL}
        </Label>
        <SetupHelp id={FAUCET_ID} label={FAUCET_LABEL} help={FAUCET_HELP} />
      </div>
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
