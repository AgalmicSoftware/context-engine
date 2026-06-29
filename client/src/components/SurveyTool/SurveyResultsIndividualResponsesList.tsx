import React from 'react';

import SurveyResultsIndividualResponseCard, {
  type SurveyResultsResponseListEntry,
} from './SurveyResultsIndividualResponseCard';

type SurveyResultsIndividualResponsesListProps = {
  activeToggles?: Record<string, unknown>;
  currentSurveyId?: string;
  effectiveSlug?: string;
  filterLoading?: boolean;
  onToggleResponse: (responseId: string) => void;
  renderResponseBody: (response: SurveyResultsResponseListEntry, index: number) => React.ReactNode;
  responses?: SurveyResultsResponseListEntry[];
  styleMap: Record<string, string>;
};

export const buildSurveyResultsResponseRowId = (
  response: SurveyResultsResponseListEntry,
  fallbackSurveyId = '',
  index = 0
): string => {
  const responder = String(response?.responder || '').trim().toLowerCase();
  const surveyId = String(response?.surveyId || fallbackSurveyId || '').trim();
  if (responder || surveyId) {
    return `${surveyId || 'unknown-survey'}:${responder || 'unknown-responder'}`;
  }
  return `response-row:${index}`;
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
      responses.map((response: SurveyResultsResponseListEntry, index: number) => {
        const responseId = buildSurveyResultsResponseRowId(response, currentSurveyId, index);
        return (
          <SurveyResultsIndividualResponseCard
            key={responseId}
            currentSurveyId={currentSurveyId}
            effectiveSlug={effectiveSlug}
            index={index}
            isOpen={!!activeToggles[responseId]}
            onToggleResponse={onToggleResponse}
            renderResponseBody={renderResponseBody}
            response={response}
            responseId={responseId}
            styleMap={styleMap}
          />
        );
      })
    )}
  </div>
);

export default SurveyResultsIndividualResponsesList;
