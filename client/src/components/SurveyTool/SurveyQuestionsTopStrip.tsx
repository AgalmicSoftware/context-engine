import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyTool.module.scss';
import SurveyQuestionsUserResponseNotice from './SurveyQuestionsUserResponseNotice';

type SurveyQuestionsTopStripProps = {
  className?: string;
  isDecrypting?: boolean;
  isEditing?: boolean;
  isSubmitting?: boolean;
  onDecryptEdit: () => void;
  onExitEditing: () => void;
  onStartFresh: () => void;
  onToggleDisplayAnswerMode: () => void;
  responseUrl?: string;
  showUserResponseNotice?: boolean;
  showViewAnswersButton?: boolean;
  submittedStateActive?: boolean;
  userResponseEncrypted?: boolean;
  viewAnswersButtonText?: React.ReactNode;
};

const SurveyQuestionsTopStrip = React.forwardRef<HTMLDivElement, SurveyQuestionsTopStripProps>(({
  className,
  isDecrypting = false,
  isEditing = false,
  isSubmitting = false,
  onDecryptEdit,
  onExitEditing,
  onStartFresh,
  onToggleDisplayAnswerMode,
  responseUrl = '',
  showUserResponseNotice,
  showViewAnswersButton,
  submittedStateActive = false,
  userResponseEncrypted = false,
  viewAnswersButtonText = '',
}, ref): React.ReactElement => (
  <div ref={ref} className={className}>
    {showViewAnswersButton ? (
      <Button onClick={onToggleDisplayAnswerMode} id={styles.answerSurveyButton}>
        <FontAwesomeIcon icon={faArrowLeft} id={styles.encryptIcon} />
        <div id={styles.surveyButtonText}>
          {viewAnswersButtonText}
        </div>
      </Button>
    ) : null}
    <SurveyQuestionsUserResponseNotice
      show={showUserResponseNotice}
      isDecrypting={isDecrypting}
      isEditing={isEditing}
      isSubmitting={isSubmitting}
      onDecryptEdit={onDecryptEdit}
      onExitEditing={onExitEditing}
      onStartFresh={onStartFresh}
      responseUrl={responseUrl}
      submittedStateActive={submittedStateActive}
      userResponseEncrypted={userResponseEncrypted}
    />
  </div>
));

SurveyQuestionsTopStrip.displayName = 'SurveyQuestionsTopStrip';

export default SurveyQuestionsTopStrip;
