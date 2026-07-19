import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faSpinner, faUpload } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { SessionWizardPublishActionDisplayState } from './sessionWizardPublishReadiness';

export type SessionPublishActionControlsDisplayProps = {
  displayState: SessionWizardPublishActionDisplayState;
  showSettingsButton: boolean;
};

export type SessionPublishActionExecutionProps = {
  onPublish: () => void;
  onTogglePublishAdvanced: () => void;
};

export type SessionPublishActionControlsProps = SessionPublishActionControlsDisplayProps &
  SessionPublishActionExecutionProps;

const SessionPublishActionControls = ({
  displayState,
  onPublish,
  onTogglePublishAdvanced,
  showSettingsButton,
}: SessionPublishActionControlsProps): React.ReactElement => {
  const { displayMode, publishBusy, publishButtonDisabled, publishButtonLabel, settingsButtonActive } = displayState;
  const isNormalMode = displayMode === 'normal';
  const containerClassName = isNormalMode ? styles.publishActionCluster : styles.publishRow;
  const primaryButtonClassName = isNormalMode ? styles.publishPrimaryButton : styles.primaryButton;
  const settingsButtonClassName = isNormalMode
    ? `${styles.publishSettingsButton} ${settingsButtonActive ? styles.publishSettingsButtonActive : ''}`
    : `${styles.iconButton} ${settingsButtonActive ? styles.iconButtonActive : ''}`;

  return (
    <div className={containerClassName}>
      <Button
        onClick={onPublish}
        className={primaryButtonClassName}
        data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
        disabled={publishButtonDisabled}
      >
        {publishBusy ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faUpload} /> {publishButtonLabel}
          </>
        )}
      </Button>
      {showSettingsButton ? (
        <button
          type="button"
          className={settingsButtonClassName}
          onClick={onTogglePublishAdvanced}
          title="Advanced publish settings"
          aria-label="Advanced publish settings"
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      ) : null}
    </div>
  );
};

export default SessionPublishActionControls;
