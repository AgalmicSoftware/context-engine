import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCog,
  faSpinner,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type SessionPublishActionControlsProps = {
  canPublishNow: boolean;
  isNormalMode: boolean;
  onPublish: () => void;
  onTogglePublishAdvanced: () => void;
  publishAdvancedOpen: boolean;
  publishBusy: boolean;
};

const SessionPublishActionControls = ({
  canPublishNow,
  isNormalMode,
  onPublish,
  onTogglePublishAdvanced,
  publishAdvancedOpen,
  publishBusy,
}: SessionPublishActionControlsProps): React.ReactElement => {
  const containerClassName = isNormalMode ? styles.publishActionCluster : styles.publishRow;
  const primaryButtonClassName = isNormalMode ? styles.publishPrimaryButton : styles.primaryButton;
  const settingsButtonClassName = isNormalMode
    ? `${styles.publishSettingsButton} ${publishAdvancedOpen ? styles.publishSettingsButtonActive : ''}`
    : `${styles.iconButton} ${publishAdvancedOpen ? styles.iconButtonActive : ''}`;
  const publishLabel = isNormalMode ? 'Deploy Session' : 'Publish';

  return (
    <div className={containerClassName}>
      <Button
        onClick={onPublish}
        className={primaryButtonClassName}
        data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
        disabled={publishBusy || !canPublishNow}
      >
        {publishBusy ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faUpload} /> {publishLabel}
          </>
        )}
      </Button>
      <button
        type="button"
        className={settingsButtonClassName}
        onClick={onTogglePublishAdvanced}
        title="Advanced publish settings"
        aria-label="Advanced publish settings"
      >
        <FontAwesomeIcon icon={faCog} />
      </button>
    </div>
  );
};

export default SessionPublishActionControls;
