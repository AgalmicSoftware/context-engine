import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type SurveyQuestionsUserResponseNoticeProps = {
  isDecrypting?: boolean;
  isEditing?: boolean;
  isSubmitting?: boolean;
  onDecryptEdit: () => void;
  onExitEditing: () => void;
  onStartFresh: () => void;
  responseUrl?: string;
  show: unknown;
  submittedStateActive?: boolean;
  userResponseEncrypted?: boolean;
};

const SurveyQuestionsUserResponseNotice = ({
  isDecrypting = false,
  isEditing = false,
  isSubmitting = false,
  onDecryptEdit,
  onExitEditing,
  onStartFresh,
  responseUrl = '',
  show,
  submittedStateActive = false,
  userResponseEncrypted = false,
}: SurveyQuestionsUserResponseNoticeProps): React.ReactElement | null => {
  if (!show) {
    return null;
  }

  return (
    <div className={styles.userResponseNotice} data-testid={E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE}>
      <p className={styles.userResponseNoticeTitle}>Existing survey response detected</p>
      <div className={styles.userResponseNoticeActions}>
        <Button
          onClick={onStartFresh}
          id={styles.startFreshButton}
          data-testid={E2E_TESTIDS.SURVEY_START_FRESH}
          disabled={isSubmitting || isDecrypting}
        >
          Start Fresh
        </Button>
        <Button
          onClick={onDecryptEdit}
          id={styles.decryptEditButton}
          data-testid={E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL}
          disabled={isDecrypting || isSubmitting || !userResponseEncrypted}
        >
          {isDecrypting ? 'Decrypting...' : 'Decrypt / Edit All'}
        </Button>
        {submittedStateActive && responseUrl && (
          <a
            href={responseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.userResponseNoticeLink}
            title="View submitted response"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        )}
        {isEditing && (
          <Button
            onClick={onExitEditing}
            id={styles.exitEditingButton}
            data-testid={E2E_TESTIDS.SURVEY_EXIT_EDITING}
            disabled={isSubmitting}
          >
            Exit Editing
          </Button>
        )}
      </div>
    </div>
  );
};

export default SurveyQuestionsUserResponseNotice;
