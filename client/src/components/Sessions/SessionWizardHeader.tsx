import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Input } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import CETooltip from '../Shared/CETooltip';
import { PUBLIC_GITHUB_BRANCH, PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
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
  onBackToProfileSelection?: () => void;
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

const ARCHITECTURE_README_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/README.md#architecture-at-a-glance`;
const ARCHITECTURE_TOOLTIP_TARGET_ID = 'ce-session-mode-architecture-help';
const ARCHITECTURE_TOOLTIP_ID = 'ce-session-mode-architecture-tooltip';
const ARCHITECTURE_TOOLTIP_TEXT =
  'Compare where session data is stored and which credentials each setup requires. Open the architecture guide for more detail.';

const SessionWizardHeader = ({
  isNormalMode = true,
  onBackToProfileSelection,
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
  const showInlineProfileControl = !sessionModeProfileSelectionStep && !!sessionModeProfileControl;
  const showHeaderActions =
    sessionModeProfileSelectionStep || (!sessionModeProfileSelectionStep && !isNormalMode && showNetworkSelector);

  return (
    <header className={`${styles.header} ${sessionModeProfileSelectionStep ? styles.headerProfileSelectionStep : ''}`}>
      <div
        className={`${styles.headerTitleBlock} ${
          !sessionModeProfileSelectionStep && onBackToProfileSelection ? styles.headerTitleBlockWithBack : ''
        }`}
      >
        {!sessionModeProfileSelectionStep && onBackToProfileSelection ? (
          <button
            type="button"
            className={styles.headerBackButton}
            data-ce-control-appearance="frameless"
            onClick={onBackToProfileSelection}
          >
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            <span>Back</span>
          </button>
        ) : null}
        <h1>
          Session Setup
          {!sessionModeProfileSelectionStep && sessionModeProfileLabel ? ` (${sessionModeProfileLabel})` : ''}
        </h1>
        {showInlineProfileControl ? <div className={styles.headerTitleInlineControl}>{sessionModeProfileControl}</div> : null}
        {sessionModeProfileSelectionStep ? (
          <>
            <a
              id={ARCHITECTURE_TOOLTIP_TARGET_ID}
              className={styles.modeProfileArchitectureLink}
              href={ARCHITECTURE_README_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the deployment architecture diagram on GitHub"
              aria-describedby={ARCHITECTURE_TOOLTIP_ID}
            >
              <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
            </a>
            <CETooltip
              id={ARCHITECTURE_TOOLTIP_ID}
              target={ARCHITECTURE_TOOLTIP_TARGET_ID}
              placement="top"
              trigger="hover focus"
              delay={0}
              fade={false}
            >
              {ARCHITECTURE_TOOLTIP_TEXT}
            </CETooltip>
          </>
        ) : null}
      </div>
      {showHeaderActions ? (
        <div className={styles.headerActions}>
          <div className={styles.headerControlStack}>
            {sessionModeProfileSelectionStep ? sessionModeProfileControl : null}
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
      ) : null}
    </header>
  );
};

export default SessionWizardHeader;
