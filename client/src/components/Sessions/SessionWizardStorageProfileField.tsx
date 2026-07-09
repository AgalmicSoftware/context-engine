import React from 'react';
import { Button } from 'reactstrap';

import type { AnyRecord } from '../shellTypes';
import CollapsibleFieldGroup from './CollapsibleFieldGroup';
import {
  SESSION_STORAGE_BACKENDS,
  buildSessionStorageProfileDisplayDescriptor,
  normalizeSessionStorageProfileConfig,
} from './sessionWizardStorageProfile';
import styles from './SessionWizard.module.scss';

export type SessionWizardStorageProfileFieldProps = {
  isCollapsed?: boolean;
  onStorageProfileChange: (nextProfile: AnyRecord) => void;
  onToggleCollapsed: () => void;
  title: string;
  value?: unknown;
};

const toObject = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};

const SessionWizardStorageProfileField = ({
  isCollapsed = false,
  onStorageProfileChange,
  onToggleCollapsed,
  title,
  value = {},
}: SessionWizardStorageProfileFieldProps): React.ReactElement => {
  const rawValue = toObject(value);
  const storageProfile = normalizeSessionStorageProfileConfig(rawValue);
  const storageProfileDisplay = buildSessionStorageProfileDisplayDescriptor(storageProfile);
  const updateStorageBackend = (backend: string) => {
    onStorageProfileChange(
      normalizeSessionStorageProfileConfig({
        ...rawValue,
        backend,
      }),
    );
  };
  const updateCloudflarePayloadAccessMode = (mode: string) => {
    onStorageProfileChange(
      normalizeSessionStorageProfileConfig({
        ...rawValue,
        backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE,
        payloadAccessControl: { mode },
      }),
    );
  };

  return (
    <CollapsibleFieldGroup
      title={title}
      isCollapsed={isCollapsed}
      toggleAriaLabel={`${title} ${isCollapsed ? 'expand' : 'collapse'}`}
      onToggleCollapsed={onToggleCollapsed}
    >
      {!isCollapsed && (
        <>
          <div className={styles.inlineToggleRow} role="radiogroup" aria-label="Session storage profile">
            {storageProfileDisplay.backendOptions.map((option) => (
              <Button
                key={option.backend}
                type="button"
                role="radio"
                aria-checked={option.selected}
                className={`${styles.workerModePill} ${option.selected ? styles.workerModePillActive : ''}`}
                onClick={() => updateStorageBackend(option.backend)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {storageProfileDisplay.backendHelperText && !storageProfileDisplay.showCloudflarePayloadAccessControls ? (
            <div className={styles.helperText}>{storageProfileDisplay.backendHelperText}</div>
          ) : null}
          {storageProfileDisplay.showCloudflarePayloadAccessControls ? (
            <>
              <div className={styles.helperText}>{storageProfileDisplay.backendHelperText}</div>
              <div className={styles.inlineToggleRow} role="radiogroup" aria-label="Cloudflare payload access mode">
                {storageProfileDisplay.cloudflarePayloadAccessOptions.map((option) => (
                  <Button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={option.selected}
                    className={`${styles.workerModePill} ${option.selected ? styles.workerModePillActive : ''}`}
                    onClick={() => updateCloudflarePayloadAccessMode(option.mode)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className={styles.helperText}>{storageProfileDisplay.cloudflarePayloadAccessHelperText}</div>
            </>
          ) : null}
        </>
      )}
    </CollapsibleFieldGroup>
  );
};

export default SessionWizardStorageProfileField;
