/** @file WorkerResourceInputs.tsx */
import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getLitPayerWalletStatus } from '../../utilities/crypto/litPayerWallet.js';
import { toStr } from '../../utilities/shared/primitives.js';

type ResourceSecretField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
};

type WorkerSecrets = Record<string, unknown>;

export type WorkerResourceInputsProps = {
  resourceKey: string;
  fields?: ResourceSecretField[];
  workerSecrets?: WorkerSecrets;
  workerSecretsEnabled: boolean;
  isNormalMode: boolean;
  showSponsoredFaucetNotice: boolean;
  effectiveDefaultWorkerRpcUrl?: string;
  walletLabel?: string;
  getSecretFieldTestId?: (fieldKey: string) => string | undefined;
  onUpdateSecret: (fieldKey: string, value: string) => void;
  onGenerateLitPayer: () => void;
  onCopyLitPayerAddress: (value: string) => void | Promise<void>;
};

const WorkerResourceInputs = ({
  resourceKey,
  fields = [],
  workerSecrets = {},
  workerSecretsEnabled,
  isNormalMode,
  showSponsoredFaucetNotice,
  effectiveDefaultWorkerRpcUrl = '',
  walletLabel = 'Wallet',
  getSecretFieldTestId,
  onUpdateSecret,
  onGenerateLitPayer,
  onCopyLitPayerAddress,
}: WorkerResourceInputsProps) => {
  const buildSecretFieldTestId = typeof getSecretFieldTestId === 'function'
    ? getSecretFieldTestId
    : () => undefined;

  if (!fields.length) {
    return null;
  }

  if (resourceKey === 'lit') {
    const payerPrivateKey = toStr(workerSecrets.litPayerPrivateKey).trim();
    const hasLitPayerPrivateKey = !!payerPrivateKey;
    const payerStatus = getLitPayerWalletStatus(payerPrivateKey);
    const payerAddress = payerStatus.address || toStr(workerSecrets.litPayerAddress).trim();

    return (
      <div className={styles.resourceFields}>
        <div className={styles.litCompactRow}>
          <FormGroup className={`${styles.resourceInput} ${styles.inlineLabelInput} ${styles.litCompactField}`}>
            <Label>Private key</Label>
            <Input
              type="password"
              value={workerSecrets.litPayerPrivateKey || ''}
              placeholder="0x..."
              onChange={(e) => onUpdateSecret('litPayerPrivateKey', e.target.value)}
              disabled={!workerSecretsEnabled}
              data-testid={buildSecretFieldTestId('litPayerPrivateKey')}
            />
          </FormGroup>
          <Button
            type="button"
            className={styles.secondaryButton}
            onClick={onGenerateLitPayer}
            disabled={!workerSecretsEnabled}
          >
            Generate
          </Button>
        </div>
        {hasLitPayerPrivateKey && payerAddress && (
          <FormGroup className={`${styles.resourceInput} ${styles.inlineLabelInput} ${styles.litCompactField}`}>
            <Label>{walletLabel}</Label>
            <div className={styles.copyFieldRow}>
              <Input
                type="text"
                value={payerAddress}
                readOnly
                data-testid={buildSecretFieldTestId('litPayerAddress')}
              />
              <Button
                type="button"
                size="sm"
                className={styles.secondaryButton}
                onClick={() => onCopyLitPayerAddress(payerAddress)}
                data-testid={E2E_TESTIDS.WIZARD_COPY_LIT_PAYER_ADDRESS}
                aria-label="Copy Lit payer address"
              >
                <FontAwesomeIcon icon={faCopy} /> Copy
              </Button>
            </div>
          </FormGroup>
        )}
      </div>
    );
  }

  return (
    <div className={styles.resourceInputGrid}>
      {fields.map((field) => {
        const value = workerSecrets[field.key] ?? '';
        const label = `${field.label}${field.required ? ' *' : ''}`;
        const isTextarea = field.type === 'textarea';
        const placeholder = (
          resourceKey === 'rpc' &&
          field.key === 'customRpcUrl' &&
          !toStr(value).trim()
        )
          ? (effectiveDefaultWorkerRpcUrl || field.placeholder || '')
          : (field.placeholder || '');

        return (
          <FormGroup key={field.key} className={`${styles.resourceInput} ${!isTextarea ? styles.inlineLabelInput : ''}`}>
            <Label>{label}</Label>
            <Input
              type={isTextarea ? 'textarea' : field.type}
              rows={isTextarea ? field.rows || 3 : undefined}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onUpdateSecret(field.key, e.target.value)}
              disabled={!workerSecretsEnabled}
              required={workerSecretsEnabled && field.required}
              data-testid={buildSecretFieldTestId(field.key)}
            />
            {!isNormalMode && field.key === 'faucetPrivateKey' && showSponsoredFaucetNotice && (
              <div className={styles.helperText}>
                Faucet funding is currently provided by the sponsored bundle. Enter a private key here to override it.
              </div>
            )}
          </FormGroup>
        );
      })}
    </div>
  );
};

export default WorkerResourceInputs;
