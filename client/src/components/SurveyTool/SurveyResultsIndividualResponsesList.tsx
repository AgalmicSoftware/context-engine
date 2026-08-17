import React from 'react';

import SurveyResultsIndividualResponseCard, {
  type SurveyResultsResponseListEntry,
} from './SurveyResultsIndividualResponseCard';

type SurveyResultsIndividualResponsesListProps = {
  activeToggles?: Record<string, unknown>;
  currentSurveyId?: string;
  effectiveSlug?: string;
  filterLoading?: boolean;
  initialVisibleCount?: number;
  onToggleResponse: (responseId: string) => void;
  renderResponseBody: (response: SurveyResultsResponseListEntry, index: number) => React.ReactNode;
  responses?: SurveyResultsResponseListEntry[];
  styleMap: Record<string, string>;
  visibleIncrement?: number;
};

const DEFAULT_RESPONSE_WINDOW_SIZE = 25;

const normalizeResponseWindowSize = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

export const buildSurveyResultsResponseRowId = (
  response: SurveyResultsResponseListEntry,
  fallbackSurveyId = '',
  index = 0,
): string => {
  const responder = String(response?.responder || '')
    .trim()
    .toLowerCase();
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
  initialVisibleCount = DEFAULT_RESPONSE_WINDOW_SIZE,
  onToggleResponse,
  renderResponseBody,
  responses = [],
  styleMap,
  visibleIncrement = DEFAULT_RESPONSE_WINDOW_SIZE,
}: SurveyResultsIndividualResponsesListProps): React.ReactElement => {
  const normalizedInitialVisibleCount = normalizeResponseWindowSize(initialVisibleCount, DEFAULT_RESPONSE_WINDOW_SIZE);
  const normalizedVisibleIncrement = normalizeResponseWindowSize(visibleIncrement, DEFAULT_RESPONSE_WINDOW_SIZE);
  const [visibleCount, setVisibleCount] = React.useState(normalizedInitialVisibleCount);
  const baseVisibleCount = Math.min(responses.length, Math.max(normalizedInitialVisibleCount, visibleCount));
  let openResponseIndex = -1;

  responses.forEach((response: SurveyResultsResponseListEntry, index: number) => {
    const responseId = buildSurveyResultsResponseRowId(response, currentSurveyId, index);
    if (activeToggles[responseId]) {
      openResponseIndex = Math.max(openResponseIndex, index);
    }
  });

  const renderedCount = Math.min(responses.length, Math.max(baseVisibleCount, openResponseIndex + 1));
  const visibleResponses = responses.slice(0, renderedCount);
  const hiddenCount = responses.length - renderedCount;
  const nextLoadCount = Math.min(normalizedVisibleIncrement, hiddenCount);

  return (
    <div className={styleMap.responseList}>
      {responses.length === 0 && !filterLoading ? (
        <p>No results yet.</p>
      ) : (
        <>
          {visibleResponses.map((response: SurveyResultsResponseListEntry, index: number) => {
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
          })}
          {hiddenCount > 0 && (
            <div className={styleMap.responseListWindowStatus}>
              <span data-testid="ce-survey-results-response-window-status">
                {hiddenCount} more {hiddenCount === 1 ? 'response is' : 'responses are'} hidden.
              </span>
              <button
                className={styleMap.responseListLoadMoreButton}
                data-testid="ce-survey-results-load-more-responses"
                onClick={() =>
                  setVisibleCount((currentVisibleCount) =>
                    Math.min(
                      responses.length,
                      Math.max(currentVisibleCount, renderedCount) + normalizedVisibleIncrement,
                    ),
                  )
                }
                type="button"
              >
                Show {nextLoadCount} more {nextLoadCount === 1 ? 'response' : 'responses'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SurveyResultsIndividualResponsesList;
