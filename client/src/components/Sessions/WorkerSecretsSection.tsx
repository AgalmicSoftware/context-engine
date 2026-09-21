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
  workerSecretsEnabled: boolean;
  setWorkerSecretsEnabled: (value: boolean) => void;
  clearWorkerSecretFields: () => void;
  workerResourceKeys?: string[];
  renderResource?: (resourceKey: string, index: number) => React.ReactNode;
  workerAllowOrigins: string;
  setWorkerAllowOrigins: (value: string) => void;
  workerLimitPerWallet: string;
  setWorkerLimitPerWallet: (value: string) => void;
  workerLimitPerAnonymousIp: string;
  setWorkerLimitPerAnonymousIp: (value: string) => void;
  defaultAllowedOrigins: string;
};

const WorkerSecretsSection = ({
  isNormalMode,
  translate,
  renderInfoTooltip,
  workerSecretsEnabled,
  setWorkerSecretsEnabled,
  clearWorkerSecretFields,
  workerResourceKeys = [],
  renderResource,
  workerAllowOrigins,
  setWorkerAllowOrigins,
  workerLimitPerWallet,
  setWorkerLimitPerWallet,
  workerLimitPerAnonymousIp,
  setWorkerLimitPerAnonymousIp,
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
              Secrets stay in this tab&apos;s memory only — re-enter them if you refresh the page.
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
        <FormGroup>
          <Label className={styles.fieldLabelRow} for="ce-worker-limit-per-wallet">
            <span>Authenticated requests per wallet per day</span>
            {renderTooltip({
              id: 'gw-limit-per-wallet',
              content:
                'Optional daily request budget for signed-in wallets. Leave blank for no authenticated wallet-specific daily cap.',
              placement: 'right',
              testId: 'ce-wizard-worker-tooltip-gw-limit-per-wallet',
              ariaLabel: 'Authenticated wallet request limit info',
            })}
          </Label>
          <Input
            id="ce-worker-limit-per-wallet"
            type="number"
            min="0"
            step="1"
            value={workerLimitPerWallet}
            placeholder="Unlimited"
            onChange={(e) => setWorkerLimitPerWallet(e.target.value)}
          />
          <div className={styles.helperText}>
            Authenticated users keep this budget separate from anonymous IP limits.
          </div>
        </FormGroup>
        <FormGroup>
          <Label className={styles.fieldLabelRow} for="ce-worker-limit-per-anonymous-ip">
            <span>Anonymous requests per IP per day</span>
            {renderTooltip({
              id: 'gw-limit-per-anonymous-ip',
              content:
                'Daily budget for anonymous users sharing the same public IP address across public reads and enabled AI, transcription, and realtime routes. Use 0 to disable this Worker daily cap; provider limits and access policy still apply. Leave blank only when importing an older config that should inherit the wallet limit.',
              placement: 'right',
              testId: 'ce-wizard-worker-tooltip-gw-limit-per-anonymous-ip',
              ariaLabel: 'Anonymous IP request limit info',
            })}
          </Label>
          <Input
            id="ce-worker-limit-per-anonymous-ip"
            type="number"
            min="0"
            step="1"
            value={workerLimitPerAnonymousIp}
            placeholder="Inherit authenticated wallet limit"
            onChange={(e) => setWorkerLimitPerAnonymousIp(e.target.value)}
          />
          <div className={styles.helperText}>
            This applies before login to everyone on shared Wi-Fi or the same NAT IP. Enter 0 to disable this
            Worker&apos;s shared-IP daily cap while keeping provider limits and access policy in force.
          </div>
        </FormGroup>
      </div>
    </div>
  );
};

export default WorkerSecretsSection;
