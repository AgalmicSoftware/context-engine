import React from 'react';
import { Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { buildSurveyResultsStatusMessagesDisplayPlan } from './surveyResultsFilterStatusController';

type SurveyResultsStatusMessagesProps = {
  alertMessage?: React.ReactNode;
  filterLoading?: boolean;
  styleMap: Record<string, string>;
};

const SurveyResultsStatusMessages = ({
  alertMessage = '',
  filterLoading = false,
  styleMap,
}: SurveyResultsStatusMessagesProps): React.ReactElement => {
  const displayPlan = buildSurveyResultsStatusMessagesDisplayPlan({
    alertMessage,
    filterLoading,
  });

  return (
    <>
      {displayPlan.showAlert && (
        <Alert color="info" className={styleMap.alertMessage} fade={false}>
          {displayPlan.alertMessage as React.ReactNode}
        </Alert>
      )}

      {displayPlan.showFilterLoading && (
        <div className={styleMap.loadingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>Applying filter...</p>
        </div>
      )}
    </>
  );
};

export default SurveyResultsStatusMessages;
