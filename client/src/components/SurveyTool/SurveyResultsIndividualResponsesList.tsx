import React from 'react';
import { Card, CardBody, CardHeader, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';

import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';

type SurveyResultsResponseListEntry = {
  responder: string;
  surveyId?: unknown;
} & Record<string, unknown>;

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
        const openToggle = !!activeToggles[index];
        return (
          <Card key={index} className={styleMap.singleResponseCard}>
            <CardHeader
              onClick={() => onToggleResponse(index)}
              className={styleMap.responseHeader}
            >
              <span className={styleMap.responderAddress}>
                <a
                  href={`/u/${encodeURIComponent(response.responder)}`}
                  className={styleMap.responderLink}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                >
                  {getShortenedAddress(response.responder, false)}
                </a>
                <a
                  href={`/survey/${encodeURIComponent(currentSurveyId)}/${encodeURIComponent(response.responder)}${effectiveSlug ? `?session=${encodeURIComponent(effectiveSlug)}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styleMap.externalLink}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </span>
              <FontAwesomeIcon
                icon={openToggle ? faCaretUp : faCaretDown}
                className={styleMap.biggerIcon}
              />
            </CardHeader>
            <Collapse isOpen={openToggle} id={styleMap.surveyResultsCollapse}>
              <CardBody className={styleMap.responseCard}>
                {renderResponseBody(response, index)}
              </CardBody>
            </Collapse>
          </Card>
        );
      })
    )}
  </div>
);

export default SurveyResultsIndividualResponsesList;
