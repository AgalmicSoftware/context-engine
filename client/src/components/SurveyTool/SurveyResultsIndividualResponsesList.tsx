import React from 'react';

import SurveyResultsIndividualResponseCard, {
  type SurveyResultsResponseListEntry,
} from './SurveyResultsIndividualResponseCard';

type SurveyResultsIndividualResponsesListProps = {
  activeToggles?: Record<number, unknown>;
  currentSurveyId?: string;
  effectiveSlug?: string;
  filterLoading?: boolean;
  onToggleResponse: (index: number) => void;
  renderResponseBody: (response: SurveyResultsResponseListEntry, index: number) => React.ReactNode;
  responses?: SurveyResultsResponseListEntry[];
  styleMap: Record<string, string>;
};

const SurveyResultsIndividualResponsesList = ({
  activeToggles = {},
  currentSurveyId = '',
  effectiveSlug = '',
  filterLoading = false,
  onToggleResponse,
  renderResponseBody,
  responses = [],
  styleMap,
}: SurveyResultsIndividualResponsesListProps): React.ReactElement => (
  <div className={styleMap.responseList}>
    {responses.length === 0 && !filterLoading ? (
      <p>No results yet.</p>
    ) : (
      responses.map((response: SurveyResultsResponseListEntry, index: number) => (
        <SurveyResultsIndividualResponseCard
          key={index}
          currentSurveyId={currentSurveyId}
          effectiveSlug={effectiveSlug}
          index={index}
          isOpen={!!activeToggles[index]}
          onToggleResponse={onToggleResponse}
          renderResponseBody={renderResponseBody}
          response={response}
          styleMap={styleMap}
        />
      ))
    )}
  </div>
);

export default SurveyResultsIndividualResponsesList;
