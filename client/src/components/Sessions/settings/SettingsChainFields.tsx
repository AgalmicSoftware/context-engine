import React, { useState } from 'react';
import { Input } from 'reactstrap';

import { rpcProvidersChainReadsPort } from '../../../domains/chain/rpcProvidersChainReadsPort';
import { SetupCheck, SetupField, setupHelpId } from '../setup/SetupPrimitives';
import { asRecord, text, type SetupDraft } from '../setup/setupSectionTypes';
import styles from '../setup/SessionSetup.module.scss';
import { SETTINGS_CONTRACTS, describeChain, readRegistryFacts } from './sessionSettingsChain';

// What an on-chain session's registry record fixes: shown, never edited.
export const SettingsChainFacts = ({
  config,
  sessionSlug,
  workerOrigin,
}: {
  config: Record<string, unknown> | null;
  sessionSlug: string;
  workerOrigin: string;
}) => {
  const facts = readRegistryFacts(config);
  return (
    <dl className={styles.hint} data-testid="ce-settings-locked">
      <dt>Link name</dt>
      <dd className={styles.readOnlyValue}>{sessionSlug}</dd>
      <dt>Session ID</dt>
      <dd className={styles.readOnlyValue}>{facts.sessionId}</dd>
      <dt>Registry network</dt>
      <dd className={styles.readOnlyValue} data-testid="ce-settings-registry-chain">
        {describeChain(facts.registryChainId)}
      </dd>
      <dt>Registry admin</dt>
      <dd className={styles.readOnlyValue}>{facts.adminAddress}</dd>
      <dt>Metadata</dt>
      <dd className={styles.readOnlyValue}>{facts.metadataURI || 'none yet'}</dd>
      <dt>Session Worker</dt>
      <dd className={styles.readOnlyValue}>{workerOrigin || 'none'}</dd>
      <dt>Runs on</dt>
      <dd className={styles.readOnlyValue}>On-chain registry (fixed once published)</dd>
    </dl>
  );
};

type FieldsProps = {
  config: Record<string, unknown> | null;
  draft: SetupDraft;
  onChange: (path: string[], value: unknown) => void;
  /** True while saving would publish synthesized contract addresses. */
  needsContractCheck: boolean;
};

// An on-chain session's contracts, block range and faucet amounts. The
// faucet's key stays with the Worker's other secrets in Admin.
export const SettingsChainFields = ({ config, draft, onChange, needsContractCheck }: FieldsProps) => {
  const facts = readRegistryFacts(config);
  const [blockStatus, setBlockStatus] = useState('');
  const contracts = asRecord(draft.contracts);
  const range = asRecord(draft.blockLimits);
  const faucet = asRecord(draft.faucet);
  const readCurrentBlock = async () => {
    setBlockStatus('Reading the current block…');
    try {
      const block = await rpcProvidersChainReadsPort.getLatestBlockNumberForChain(facts.chainId);
      onChange(['blockLimits', 'start'], String(block));
      setBlockStatus(`Current block on ${describeChain(facts.chainId)}: ${Number(block).toLocaleString()}.`);
    } catch {
      setBlockStatus(`Couldn’t read the current block on ${describeChain(facts.chainId)}. Enter it instead.`);
    }
  };
  const field = (id: string, label: string, value: unknown, path: string[], help: string, numeric = false) => (
    <SetupField id={id} label={label} help={help}>
      <Input
        id={id}
        value={text(value)}
        inputMode={numeric ? 'numeric' : undefined}
        aria-describedby={setupHelpId(id)}
        data-testid={id}
        onChange={(event) => onChange(path, event.target.value)}
      />
    </SetupField>
  );
  return (
    <>
      <h3 className={styles.subheading}>Contracts</h3>
      {SETTINGS_CONTRACTS.map(({ key, label }) => (
        <React.Fragment key={key}>
          {field(
            `ce-settings-contract-${key}`,
            label,
            contracts[key],
            ['contracts', key],
            `Its address on ${describeChain(key === 'sessionRegistry' ? facts.registryChainId : facts.chainId)}.`,
          )}
        </React.Fragment>
      ))}
      {facts.metadataUnavailable ? (
        <p className={styles.conflict} data-testid="ce-settings-metadata-unavailable">
          The session’s metadata couldn’t be loaded, so this page shows the last copy this browser kept, or defaults
          where it has none, such as the chain’s default contracts. Saving replaces the metadata with what this page
          shows.
        </p>
      ) : null}
      {needsContractCheck || draft.contractsChecked === true ? (
        <SetupCheck
          id="ce-settings-contracts-checked"
          label="These contract addresses are right"
          help="Saving is off until you correct these addresses or confirm them."
          checked={draft.contractsChecked === true}
          testId="ce-settings-contracts-checked"
          onChange={(checked) => onChange(['contractsChecked'], checked)}
        />
      ) : null}
      <h3 className={styles.subheading}>Block range</h3>
      {field(
        'ce-settings-block-start',
        'Start block',
        range.start,
        ['blockLimits', 'start'],
        'The first block whose questions and answers belong to this session.',
        true,
      )}
      {field(
        'ce-settings-block-end',
        'End block',
        range.end,
        ['blockLimits', 'end'],
        'Optional. Activity after this block is left out.',
        true,
      )}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={!facts.chainId}
          data-testid="ce-settings-block-current"
          onClick={() => void readCurrentBlock()}
        >
          Use the current block
        </button>
      </div>
      {blockStatus ? (
        <p className={styles.statusText} role="status">
          {blockStatus}
        </p>
      ) : null}
      <h3 className={styles.subheading}>Test ETH faucet</h3>
      {field(
        'ce-settings-faucet-amount',
        'Amount (ETH)',
        faucet.amountEth,
        ['faucet', 'amountEth'],
        'How much test ETH a participant receives.',
      )}
      {field(
        'ce-settings-faucet-threshold',
        'Refill below (ETH)',
        faucet.balanceThresholdEth,
        ['faucet', 'balanceThresholdEth'],
        'Participants with less than this receive test ETH.',
      )}
      <p className={styles.hint}>The faucet’s key is a Worker secret; change it in Admin.</p>
    </>
  );
};
