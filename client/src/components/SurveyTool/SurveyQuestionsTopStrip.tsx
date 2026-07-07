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
  layoutDisplayState?: Pick<SurveyQuestionsLayoutDisplayState, 'topSectionClassName'>;
  onDecryptEdit: () => void;
  onExitEditing: () => void;
  onStartFresh: () => void;
  onToggleDisplayAnswerMode: () => void;
  responseUrl?: string;
  routeViewDisplayState?: Pick<
    SurveyQuestionsRouteViewDisplayState,
    'isOwnResponse' | 'isSingleQuestionView' | 'showViewAnswersButton' | 'viewAnswersButtonText'
  >;
  submitDisplayState?: Pick<SurveyQuestionsSubmitFooterDisplayState, 'submittedStateActive'>;
  userHasResponse?: boolean;
  userResponseEncrypted?: boolean;
  viewAnswersButtonText?: React.ReactNode;
};

const SurveyQuestionsTopStrip = React.forwardRef<HTMLDivElement, SurveyQuestionsTopStripProps>(
  (
    {
      displayAnswerMode = false,
      isDecrypting = false,
      isEditing = false,
      isSubmitting = false,
      layoutDisplayState,
      onDecryptEdit,
      onExitEditing,
      onStartFresh,
      onToggleDisplayAnswerMode,
      responseUrl = '',
      routeViewDisplayState,
      submitDisplayState,
      userHasResponse = false,
      userResponseEncrypted = false,
    },
    ref,
  ): React.ReactElement => {
    const showUserResponseNotice =
      !!userHasResponse &&
      !!routeViewDisplayState?.isOwnResponse &&
      !routeViewDisplayState?.isSingleQuestionView &&
      !!displayAnswerMode;

    return (
      <div ref={ref} className={layoutDisplayState?.topSectionClassName}>
        {routeViewDisplayState?.showViewAnswersButton ? (
          <Button onClick={onToggleDisplayAnswerMode} id={styles.answerSurveyButton}>
            <FontAwesomeIcon icon={faArrowLeft} id={styles.encryptIcon} />
            <div id={styles.surveyButtonText}>{routeViewDisplayState.viewAnswersButtonText}</div>
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
          submittedStateActive={submitDisplayState?.submittedStateActive}
          userResponseEncrypted={userResponseEncrypted}
        />
      </div>
    );
  },
);

SurveyQuestionsTopStrip.displayName = 'SurveyQuestionsTopStrip';

export default SurveyQuestionsTopStrip;
