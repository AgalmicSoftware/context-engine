/** @file WorkerResourceInputs.tsx */
import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { toStr } from '../../utilities/shared/primitives.js';

type ResourceSecretField = {
  key: string;
  label: string;
  type?: React.ComponentProps<typeof Input>['type'];
  required?: boolean;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
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
  getSecretFieldTestId?: (fieldKey: string) => string | undefined;
  onUpdateSecret: (fieldKey: string, value: string) => void;
};

const WorkerResourceInputs = ({
  resourceKey,
  fields = [],
  workerSecrets = {},
  workerSecretsEnabled,
  isNormalMode,
  showSponsoredFaucetNotice,
  effectiveDefaultWorkerRpcUrl = '',
  getSecretFieldTestId,
  onUpdateSecret,
}: WorkerResourceInputsProps) => {
  const buildSecretFieldTestId = typeof getSecretFieldTestId === 'function'
    ? getSecretFieldTestId
    : () => undefined;

  const renderGenericField = (field: ResourceSecretField) => {
    const value = toStr(workerSecrets[field.key]);
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
          readOnly={field.readOnly}
          data-testid={buildSecretFieldTestId(field.key)}
        />
        {!isNormalMode && field.key === 'faucetPrivateKey' && showSponsoredFaucetNotice && (
          <div className={styles.helperText}>
            Faucet funding is currently provided by the sponsored bundle. Enter a private key here to override it.
          </div>
        )}
      </FormGroup>
    );
  };

  if (!fields.length) {
    return null;
  }

  if (resourceKey === 'lit') {
    const chipotleFields: ResourceSecretField[] = [
      {
        key: 'litApiBase',
        label: 'Lit API base',
        type: 'text',
        placeholder: 'https://api.chipotle.litprotocol.com',
      },
      {
        key: 'litGroupId',
        label: 'Lit group ID',
        type: 'text',
        placeholder: 'group_...',
      },
      {
        key: 'litPkpId',
        label: 'Lit PKP ID',
        type: 'text',
        placeholder: 'pkp_...',
      },
      {
        key: 'litActionCid',
        label: 'Lit Action CID',
        type: 'text',
        placeholder: 'bafy...',
      },
      {
        key: 'litAccountApiKey',
        label: 'Lit account API key',
        type: 'password',
        placeholder: 'Paste account API key',
      },
      {
        key: 'litUsageApiKey',
        label: 'Lit usage API key',
        type: 'password',
        placeholder: 'Paste usage API key',
      },
    ];

    return (
      <div className={styles.resourceFields}>
        <div className={styles.resourceInputGrid}>
          {chipotleFields.map(renderGenericField)}
        </div>
        <div className={styles.helperText}>
          Enter `Lit API base` plus `Lit account API key` to let the worker bootstrap a fresh group, PKP, usage key, and CE action for this session after deploy. Or fill the group, PKP, action CID, and usage key fields to point at an existing scoped runtime instead.
        </div>
        <div className={styles.helperText}>
          `Lit account API key` is authority. `Lit usage API key` is the scoped runtime credential. Leave the usage key blank when the worker should derive or rotate it server-side.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.resourceInputGrid}>
      {fields.map(renderGenericField)}
    </div>
  );
};

export default WorkerResourceInputs;
