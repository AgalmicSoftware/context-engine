import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyTool.module.scss';
import type {
  SurveyQuestionsLayoutDisplayState,
  SurveyQuestionsRouteViewDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsResponseViewProps = {
  isLoadingResponse?: boolean;
  layoutDisplayState?: Pick<SurveyQuestionsLayoutDisplayState, 'responseViewClassName'>;
  noResponse?: boolean;
  parsedViewAddressAnswers?: any;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer: (question: any, answers: any, index: number, isOwnResponse: unknown) => React.ReactNode;
  renderSurveyAnswers: (responses: any[], isOwnResponse: unknown) => React.ReactNode;
  responderAddress?: string;
  responseLookupWarning?: React.ReactNode;
  routeViewDisplayState?: Pick<
    SurveyQuestionsRouteViewDisplayState,
    'isOwnResponse' | 'shortenedViewAddress' | 'viewedAddressLower' | 'viewedAddressRaw'
  >;
  singleQuestionMode?: unknown;
  userAnswers?: any;
  viewAddress?: string;
};

const SurveyQuestionsResponseView = ({
  isLoadingResponse = false,
  layoutDisplayState,
  noResponse = false,
  parsedViewAddressAnswers = null,
  questionPool = [],
  questionPoolReady,
  renderQuestionAnswer,
  renderSurveyAnswers,
  responderAddress,
  responseLookupWarning = '',
  routeViewDisplayState,
  singleQuestionMode = false,
  userAnswers = null,
  viewAddress,
}: SurveyQuestionsResponseViewProps): React.ReactElement => {
  if (isLoadingResponse) {
    return (
      <div className={styles.loadingContainer}>
        <FontAwesomeIcon icon={faSpinner} spin /> Loading...
      </div>
    );
  }

  if (noResponse) {
    return (
      <div>
        {responseLookupWarning || (
          <>
            No response for this {singleQuestionMode ? 'question' : 'survey'} from address:{' '}
            {viewAddress || responderAddress}
          </>
        )}
      </div>
    );
  }

  const isOwnResponse = routeViewDisplayState?.isOwnResponse;
  const shortenedViewAddress = routeViewDisplayState?.shortenedViewAddress || '';
  const viewedAddressLower = routeViewDisplayState?.viewedAddressLower || '';
  const viewedAddressRaw = routeViewDisplayState?.viewedAddressRaw || '';
  const firstQuestion = Array.isArray(questionPool) ? questionPool[0] : undefined;
  const hasAnswerData =
    (singleQuestionMode && questionPoolReady && firstQuestion && (isOwnResponse || parsedViewAddressAnswers)) ||
    (!singleQuestionMode && questionPoolReady) ||
    (!singleQuestionMode && parsedViewAddressAnswers);

  return (
    <div className={layoutDisplayState?.responseViewClassName}>
      {viewedAddressRaw && (
        <h2 className={styles.viewAddressHeading}>
          <a href={`/u/${viewedAddressLower}`} className={styles.viewAddressLink}>
            {shortenedViewAddress}
          </a>
          <span className={styles.viewAddressHeadingSuffix}>Response:</span>
        </h2>
      )}
      {hasAnswerData
        ? singleQuestionMode
          ? renderQuestionAnswer(
              firstQuestion,
              isOwnResponse ? userAnswers || {} : parsedViewAddressAnswers || {},
              0,
              isOwnResponse,
            )
          : renderSurveyAnswers(
              isOwnResponse ? userAnswers?.responses || [] : parsedViewAddressAnswers?.responses || [],
              isOwnResponse,
            )
        : !noResponse && (
            <div className={styles.loadingContainer}>
              <FontAwesomeIcon icon={faSpinner} spin /> Loading answer data...
            </div>
          )}
    </div>
  );
};

export default SurveyQuestionsResponseView;
