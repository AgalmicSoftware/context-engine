import React from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
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
  hasSponsoredBundleLink = false,
  isNormalMode = true,
  onCloseDisplaySettings,
  onEnterAdvancedMode,
  onEnterNormalMode,
  onRegistryChainIdChange,
  onToggleDisplaySettings,
  registryAddress = '',
  registryChainId = '',
  registryChainName = '',
  registryChainOptions = [],
  renderInfoTooltip,
  wizardDisplaySettingsOpen = false,
  wizardMode = 'normal',
  sessionModeProfileControl = null,
  sessionModeProfileLabel = '',
  sessionModeProfileSelectionStep = false,
  showNetworkSelector = true,
}: SessionWizardHeaderProps): React.ReactElement => {
  const wizardModeControls = (
    <div className={styles.wizardModeToggle} role="group" aria-label="Session wizard mode">
      <button
        type="button"
        className={`${styles.wizardModeBtn} ${wizardMode === 'normal' ? styles.wizardModeBtnActive : ''}`}
        onClick={onEnterNormalMode}
        aria-pressed={wizardMode === 'normal'}
        data-testid={E2E_TESTIDS.WIZARD_MODE_NORMAL}
      >
        Normal
      </button>
      <button
        type="button"
        className={`${styles.wizardModeBtn} ${wizardMode === 'advanced' ? styles.wizardModeBtnActive : ''}`}
        onClick={onEnterAdvancedMode}
        aria-pressed={wizardMode === 'advanced'}
        data-testid={E2E_TESTIDS.WIZARD_MODE_ADVANCED}
      >
        Advanced
      </button>
    </div>
  );

  return (
    <header className={`${styles.header} ${sessionModeProfileSelectionStep ? styles.headerProfileSelectionStep : ''}`}>
      <div className={styles.headerTitleBlock}>
        <h1>Session Setup{sessionModeProfileLabel ? ` (${sessionModeProfileLabel})` : ''}</h1>
        {!isNormalMode && <div className={styles.modeHint}>Advanced mode shows the full session configuration.</div>}
      </div>
      <div className={styles.headerActions}>
        <div className={styles.headerControlStack}>
          {sessionModeProfileControl}
          {!sessionModeProfileSelectionStep ? (
            <div className={styles.headerSecondaryActions}>
              {hasSponsoredBundleLink ? (
                <div className={styles.wizardSettingsMenu}>
                  {wizardDisplaySettingsOpen ? (
                    <button
                      type="button"
                      className={styles.wizardSettingsBackdrop}
                      aria-label="Close session wizard display settings"
                      onClick={onCloseDisplaySettings}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.wizardSettingsButton} ${wizardDisplaySettingsOpen ? styles.iconButtonActive : ''}`}
                    onClick={onToggleDisplaySettings}
                    title="Session wizard display settings"
                    aria-label="Session wizard display settings"
                    aria-expanded={wizardDisplaySettingsOpen}
                    aria-haspopup="dialog"
                  >
                    <FontAwesomeIcon icon={faCog} />
                  </button>
                  <div
                    className={styles.wizardSettingsPanel}
                    role="dialog"
                    aria-label="Session wizard display settings"
                    hidden={!wizardDisplaySettingsOpen}
                  >
                    <div className={styles.wizardSettingsLabel}>Display mode</div>
                    {wizardModeControls}
                  </div>
                </div>
              ) : (
                wizardModeControls
              )}
              {wizardMode === 'advanced' && showNetworkSelector && (
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
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default SessionWizardHeader;
