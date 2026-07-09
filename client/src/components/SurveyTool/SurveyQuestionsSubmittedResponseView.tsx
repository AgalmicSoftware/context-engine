import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyTool.module.scss';

type SurveyQuestionsSubmittedResponseViewProps = {
  isOwnResponse?: unknown;
  isVisible?: boolean;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer: (question: any, answers: any, index: number, isOwnResponse: unknown) => React.ReactNode;
  renderSurveyAnswers: (responses: any[], isOwnResponse: unknown) => React.ReactNode;
  singleQuestionMode?: unknown;
  userAnswers?: any;
};

const SurveyQuestionsSubmittedResponseView = ({
  isOwnResponse,
  isVisible = false,
  questionPool = [],
  questionPoolReady,
  renderQuestionAnswer,
  renderSurveyAnswers,
  singleQuestionMode = false,
  userAnswers = null,
}: SurveyQuestionsSubmittedResponseViewProps): React.ReactElement | null => {
  if (!isVisible) return null;

  const firstQuestion = Array.isArray(questionPool) ? questionPool[0] : undefined;

  return (
    <div>
      {questionPoolReady && userAnswers ? (
        singleQuestionMode ? (
          firstQuestion ? (
            renderQuestionAnswer(firstQuestion, userAnswers, 0, isOwnResponse)
          ) : (
            <div>Loading question...</div>
          )
        ) : userAnswers.responses ? (
          renderSurveyAnswers(userAnswers.responses, isOwnResponse)
        ) : (
          <div>Loading answers...</div>
        )
      ) : (
        <div className={styles.loadingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin /> Loading submitted response...
        </div>
      )}
    </div>
  );
};

export default SurveyQuestionsSubmittedResponseView;
