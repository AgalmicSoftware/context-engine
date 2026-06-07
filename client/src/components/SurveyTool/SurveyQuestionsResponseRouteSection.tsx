import React from 'react';

import SurveyQuestionsResponseView from './SurveyQuestionsResponseView';
import type {
  SurveyQuestionsLayoutDisplayState,
  SurveyQuestionsRouteViewDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsRouteResponseViewProps = {
  isLoadingResponse?: boolean;
  noResponse?: boolean;
  parsedViewAddressAnswers?: any;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer?: (
    question: any,
    answers: any,
    index: number,
    isOwnResponse: unknown
  ) => React.ReactNode;
  renderSurveyAnswers?: (
    responses: any[],
    isOwnResponse: unknown
  ) => React.ReactNode;
  responderAddress?: string;
  responseLookupWarning?: React.ReactNode;
  singleQuestionMode?: unknown;
  userAnswers?: any;
  viewAddress?: string;
};

type SurveyQuestionsResponseRouteSectionProps = {
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  responseViewProps?: SurveyQuestionsRouteResponseViewProps;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
};

const SurveyQuestionsResponseRouteSection = ({
  layoutDisplayState = {},
  responseViewProps = {},
  routeViewDisplayState = {},
}: SurveyQuestionsResponseRouteSectionProps): React.ReactElement => {
  const responseLayoutDisplayState = {
    responseViewClassName: layoutDisplayState.responseViewClassName,
  };
  const responseRouteViewDisplayState = {
    isOwnResponse: routeViewDisplayState.isOwnResponse,
    shortenedViewAddress: routeViewDisplayState.shortenedViewAddress || '',
    viewedAddressLower: routeViewDisplayState.viewedAddressLower || '',
    viewedAddressRaw: routeViewDisplayState.viewedAddressRaw || '',
  };

  return (
    <SurveyQuestionsResponseView
      isLoadingResponse={responseViewProps.isLoadingResponse}
      layoutDisplayState={responseLayoutDisplayState}
      noResponse={responseViewProps.noResponse}
      parsedViewAddressAnswers={responseViewProps.parsedViewAddressAnswers}
      questionPool={responseViewProps.questionPool}
      questionPoolReady={responseViewProps.questionPoolReady}
      renderQuestionAnswer={responseViewProps.renderQuestionAnswer || (() => null)}
      renderSurveyAnswers={responseViewProps.renderSurveyAnswers || (() => null)}
      responderAddress={responseViewProps.responderAddress}
      responseLookupWarning={responseViewProps.responseLookupWarning}
      routeViewDisplayState={responseRouteViewDisplayState}
      singleQuestionMode={responseViewProps.singleQuestionMode}
      userAnswers={responseViewProps.userAnswers}
      viewAddress={responseViewProps.viewAddress}
    />
  );
};

export default SurveyQuestionsResponseRouteSection;
