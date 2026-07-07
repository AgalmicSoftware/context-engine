import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import type { SessionWizardModeRequirements } from './sessionWizardModeRequirements';

export type SessionPublishAdvancedSettingsPanelProps = {
  manualGasLimit: string;
  manualGasPriceGwei: string;
  manualMaxFeePerGasGwei: string;
  manualMaxPriorityFeePerGasGwei: string;
  manualMetadataUrl: string;
  onManualGasLimitChange: (value: string) => void;
  onManualGasPriceGweiChange: (value: string) => void;
  onManualMaxFeePerGasGweiChange: (value: string) => void;
  onManualMaxPriorityFeePerGasGweiChange: (value: string) => void;
  onManualMetadataUrlChange: (value: string) => void;
  publishSettingsCapabilities: SessionWizardModeRequirements['publishSettings'];
  renderInfoTooltip: (options: Record<string, unknown>) => React.ReactNode;
  resolvedWorkerBaseUrl: string;
  workerUrlSource: string;
};

const SessionPublishAdvancedSettingsPanel = ({
  manualGasLimit,
  manualGasPriceGwei,
  manualMaxFeePerGasGwei,
  manualMaxPriorityFeePerGasGwei,
  manualMetadataUrl,
  onManualGasLimitChange,
  onManualGasPriceGweiChange,
  onManualMaxFeePerGasGweiChange,
  onManualMaxPriorityFeePerGasGweiChange,
  onManualMetadataUrlChange,
  publishSettingsCapabilities,
  renderInfoTooltip,
  resolvedWorkerBaseUrl,
  workerUrlSource,
}: SessionPublishAdvancedSettingsPanelProps): React.ReactElement => (
  <>
    <div className={styles.statusNote}>
      Arweave upload worker: {resolvedWorkerBaseUrl || 'Not set'} ({workerUrlSource})
    </div>
    <FormGroup className={styles.fieldGroup}>
      <Label>Manual metadata URI (optional)</Label>
      <Input
        type="text"
        value={manualMetadataUrl}
        placeholder="ar://<txId> or https://arweave.net/<txId>"
        onChange={(e) => onManualMetadataUrlChange(e.target.value)}
      />
    </FormGroup>
    <FormGroup className={styles.fieldGroup}>
      <Label className={styles.fieldLabelRow}>
        <span>Gas limit override</span>
        {renderInfoTooltip({
          id: 'gw-tip-gas-limit',
          content: 'Optional. Observed gas: createSession ~350k, setSessionFields ~275k (gates vary with count).',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-tip-gas-limit',
          ariaLabel: 'Gas limit override info',
        })}
      </Label>
      <Input
        type="number"
        value={manualGasLimit}
        placeholder="1000000"
        onChange={(e) => onManualGasLimitChange(e.target.value)}
      />
    </FormGroup>
    <FormGroup className={styles.fieldGroup}>
      <Label className={styles.fieldLabelRow}>
        <span>Gas price override (gwei, legacy)</span>
        {renderInfoTooltip({
          id: 'gw-tip-gas-price',
          content: 'Optional. Forces a legacy gas price (type 0). Some wallets may ignore this on EIP-1559 networks.',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-tip-gas-price',
          ariaLabel: 'Gas price override info',
        })}
      </Label>
      <Input
        type="number"
        step="any"
        value={manualGasPriceGwei}
        placeholder="(leave blank)"
        onChange={(e) => onManualGasPriceGweiChange(e.target.value)}
      />
    </FormGroup>
    <FormGroup className={styles.fieldGroup}>
      <Label className={styles.fieldLabelRow}>
        <span>Max fee per gas (gwei)</span>
        {renderInfoTooltip({
          id: 'gw-tip-max-fee',
          content:
            'Optional. EIP-1559 maxFeePerGas override. Use this (and priority fee) to bump a stuck/pending tx when you hit "replacement fee too low". Leave blank to use wallet defaults.',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-tip-max-fee',
          ariaLabel: 'Max fee per gas info',
        })}
      </Label>
      <Input
        type="number"
        step="any"
        value={manualMaxFeePerGasGwei}
        placeholder="(leave blank)"
        onChange={(e) => onManualMaxFeePerGasGweiChange(e.target.value)}
      />
    </FormGroup>
    <FormGroup className={styles.fieldGroup}>
      <Label className={styles.fieldLabelRow}>
        <span>Max priority fee per gas (gwei)</span>
        {renderInfoTooltip({
          id: 'gw-tip-max-priority',
          content: 'Optional. EIP-1559 maxPriorityFeePerGas override (tip). Leave blank to use wallet defaults.',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-tip-max-priority',
          ariaLabel: 'Max priority fee per gas info',
        })}
      </Label>
      <Input
        type="number"
        step="any"
        value={manualMaxPriorityFeePerGasGwei}
        placeholder="(leave blank)"
        onChange={(e) => onManualMaxPriorityFeePerGasGweiChange(e.target.value)}
      />
    </FormGroup>
  </>
);

export default SessionPublishAdvancedSettingsPanel;
