/** @file WorkerSecretsSection.tsx */
import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type RenderInfoTooltip = (props: {
  id?: string;
  content?: React.ReactNode;
  placement?: SessionWizardTooltipRenderOptions['placement'];
  testId?: string;
  ariaLabel?: string;
}) => React.ReactNode;

export type WorkerSecretsSectionProps = {
  isNormalMode: boolean;
  translate?: (key: string) => string;
  renderInfoTooltip?: RenderInfoTooltip;
  devPersistWorkerSecrets: boolean;
  persistWorkerSecrets: boolean;
  setPersistWorkerSecrets: (value: boolean) => void;
  workerSecretsEnabled: boolean;
  setWorkerSecretsEnabled: (value: boolean) => void;
  clearWorkerSecretFields: () => void;
  effectivePersistWorkerSecrets: boolean;
  workerResourceKeys?: string[];
  renderResource?: (resourceKey: string, index: number) => React.ReactNode;
  workerAllowOrigins: string;
  setWorkerAllowOrigins: (value: string) => void;
  defaultAllowedOrigins: string;
};

const WorkerSecretsSection = ({
  isNormalMode,
  translate,
  renderInfoTooltip,
  devPersistWorkerSecrets,
  persistWorkerSecrets,
  setPersistWorkerSecrets,
  workerSecretsEnabled,
  setWorkerSecretsEnabled,
  clearWorkerSecretFields,
  effectivePersistWorkerSecrets,
  workerResourceKeys = [],
  renderResource,
  workerAllowOrigins,
  setWorkerAllowOrigins,
  defaultAllowedOrigins,
}: WorkerSecretsSectionProps) => {
  const t = typeof translate === 'function' ? translate : (key: string) => key;
  const renderTooltip = typeof renderInfoTooltip === 'function' ? renderInfoTooltip : () => null;
  const renderResourceCard = typeof renderResource === 'function' ? renderResource : () => null;

  return (
    <div className={styles.workerSecretsPanel}>
      {!isNormalMode && (
        <div className={styles.workerSecretsHeader}>
          <div className={styles.workerSecretsTitle}>Worker secrets</div>
          <div className={styles.workerSecretsToggles}>
            {devPersistWorkerSecrets && (
              <Label className={styles.workerToggle}>
                <Input
                  type="checkbox"
                  checked={persistWorkerSecrets}
                  onChange={(e) => setPersistWorkerSecrets(!!e.target.checked)}
                />
                <span>Dev: keep secrets on refresh</span>
                {renderTooltip({
                  id: 'gw-worker-persist-secrets-tip',
                  content:
                    'Stores worker secrets in localStorage so they survive refresh. Do not enable on shared machines.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-worker-persist-secrets-tip',
                  ariaLabel: 'Persist worker secrets info',
                })}
              </Label>
            )}
            <Label className={styles.workerToggle}>
              <Input
                type="checkbox"
                checked={!workerSecretsEnabled}
                data-testid={E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY}
                onChange={(e) => {
                  const requirePay = !!e.target.checked;
                  setWorkerSecretsEnabled(!requirePay);
                  if (!requirePay) clearWorkerSecretFields();
                }}
              />
              <span>Require users to pay for usage</span>
              {renderTooltip({
                id: 'gw-worker-kv-tip',
                content:
                  'When enabled, users must provide their own API keys and fund minimal transaction and storage fees. When off (default), the session admin provides keys via worker secrets.',
                placement: 'right',
                testId: 'ce-wizard-worker-tooltip-gw-worker-kv-tip',
                ariaLabel: 'Worker secrets mode info',
              })}
            </Label>
          </div>
        </div>
      )}
      <div className={styles.resourceSection}>
        {!isNormalMode && (
          <>
            <div className={styles.resourceHeader}>
              <span className={styles.subSectionTitle}>{`Resource ${t('gatesLower')} (on-chain)`}</span>
              {renderTooltip({
                id: 'gw-tip-resource-gates',
                content: `SessionRegistry ${t('gatesLower')} are authoritative for login/resource access. Default ${t('gateLower')} applies to all resources; click a lock icon to assign a different ${t('gateLower')}.`,
                placement: 'right',
                testId: 'ce-wizard-worker-tooltip-gw-tip-resource-gates',
                ariaLabel: 'Resource gates info',
              })}
            </div>
            <div className={styles.helperText}>
              {effectivePersistWorkerSecrets
                ? 'Developer mode: secrets are cached locally and will survive refresh.'
                : 'Secrets are not saved locally — re-enter them if you refresh the page.'}
            </div>
          </>
        )}
        <div className={styles.gateGrid}>{workerResourceKeys.map(renderResourceCard)}</div>
      </div>
      <div className={styles.workerConfigGrid}>
        <FormGroup>
          <Label className={styles.fieldLabelRow}>
            <span>Allowed origins (comma or newline)</span>
            {renderTooltip({
              id: 'gw-allowed-origins',
              content:
                'The URL(s) where your site will be accessible — e.g. a subdomain of contextengine.eth or a custom domain. Include localhost for development.',
              placement: 'right',
              testId: 'ce-wizard-worker-tooltip-gw-allowed-origins',
              ariaLabel: 'Allowed origins info',
            })}
          </Label>
          <Input
            type="textarea"
            rows="2"
            value={workerAllowOrigins}
            placeholder={defaultAllowedOrigins}
            onChange={(e) => setWorkerAllowOrigins(e.target.value)}
          />
        </FormGroup>
      </div>
    </div>
  );
};

export default WorkerSecretsSection;
