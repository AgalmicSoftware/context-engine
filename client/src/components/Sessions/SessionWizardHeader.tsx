import React from 'react';
import { Input } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type RegistryChainOption = {
  id: string | number;
  name: string;
};

type SessionWizardHeaderProps = {
  hasSponsoredBundleLink?: boolean;
  isNormalMode?: boolean;
  onCloseDisplaySettings: () => void;
  onEnterAdvancedMode: () => void;
  onEnterNormalMode: () => void;
  onRegistryChainIdChange: (value: string) => void;
  onToggleDisplaySettings: () => void;
  registryAddress?: string;
  registryChainId?: string | number;
  registryChainName?: string;
  registryChainOptions?: RegistryChainOption[];
  renderInfoTooltip: (options: {
    ariaLabel?: string;
    content?: React.ReactNode;
    id?: string;
    placement?: SessionWizardTooltipRenderOptions['placement'];
    testId?: string;
  }) => React.ReactNode;
  wizardDisplaySettingsOpen?: boolean;
  wizardMode?: string;
  sessionModeProfileControl?: React.ReactNode;
  sessionModeProfileLabel?: string;
  sessionModeProfileSelectionStep?: boolean;
  showNetworkSelector?: boolean;
};

const SessionWizardHeader = ({
  isNormalMode = true,
  onRegistryChainIdChange,
  registryAddress = '',
  registryChainId = '',
  registryChainName = '',
  registryChainOptions = [],
  renderInfoTooltip,
  sessionModeProfileControl = null,
  sessionModeProfileLabel = '',
  sessionModeProfileSelectionStep = false,
  showNetworkSelector = true,
}: SessionWizardHeaderProps): React.ReactElement => {
  return (
    <header className={`${styles.header} ${sessionModeProfileSelectionStep ? styles.headerProfileSelectionStep : ''}`}>
      <div className={styles.headerTitleBlock}>
        <h1>
          Session Setup
          {!sessionModeProfileSelectionStep && sessionModeProfileLabel ? ` (${sessionModeProfileLabel})` : ''}
        </h1>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.headerControlStack}>
          {sessionModeProfileControl}
          {!sessionModeProfileSelectionStep && !isNormalMode && showNetworkSelector ? (
            <div className={styles.headerSecondaryActions}>
              <div className={styles.headerChainSelector}>
                <span className={styles.headerChainLabel}>Network:</span>
                <Input
                  type="select"
                  value={registryChainId || ''}
                  onChange={(event) => onRegistryChainIdChange(event.target.value)}
                  className={styles.headerChainInput}
                >
                  {registryChainOptions.length ? (
                    registryChainOptions.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name} ({chain.id})
                      </option>
                    ))
                  ) : (
                    <option value={registryChainId || ''}>
                      {registryChainName || registryChainId || 'Select a chain'}
                    </option>
                  )}
                </Input>
                {renderInfoTooltip({
                  id: 'gw-registry-chain',
                  content: `Chain for session deployment. Registry: ${registryAddress || 'Unavailable'}`,
                  placement: 'bottom',
                  testId: 'ce-wizard-tooltip-gw-registry-chain',
                  ariaLabel: 'Registry chain info',
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default SessionWizardHeader;
