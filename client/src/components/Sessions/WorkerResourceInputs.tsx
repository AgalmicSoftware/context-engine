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
  const buildSecretFieldTestId = typeof getSecretFieldTestId === 'function' ? getSecretFieldTestId : () => undefined;

  const renderGenericField = (field: ResourceSecretField) => {
    const value = toStr(workerSecrets[field.key]);
    const label = `${field.label}${field.required ? ' *' : ''}`;
    const isTextarea = field.type === 'textarea';
    const placeholder =
      resourceKey === 'rpc' && field.key === 'customRpcUrl' && !toStr(value).trim()
        ? effectiveDefaultWorkerRpcUrl || field.placeholder || ''
        : field.placeholder || '';

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
    const litAccountField: ResourceSecretField = {
      key: 'litAccountApiKey',
      label: 'Lit API key',
      type: 'password',
      placeholder: 'Paste LIT_USAGE_API_KEY',
    };

    return (
      <div className={styles.resourceFields}>
        <div className={styles.resourceInputGrid}>{renderGenericField(litAccountField)}</div>
        <div className={styles.helperText}>
          {/* Worker deploy derives the Lit group, PKP, and CE action from this key when needed. */}
        </div>
      </div>
    );
  }

  return <div className={styles.resourceInputGrid}>{fields.map(renderGenericField)}</div>;
};

export default WorkerResourceInputs;
