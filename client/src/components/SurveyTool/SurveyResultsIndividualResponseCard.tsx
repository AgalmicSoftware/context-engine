import React from 'react';
import { Card, CardBody, CardHeader, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';

import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';

export type SurveyResultsResponseListEntry = {
  responder: string;
  surveyId?: unknown;
} & Record<string, unknown>;

type SurveyResultsIndividualResponseCardProps = {
  currentSurveyId?: string;
  effectiveSlug?: string;
  index: number;
  isOpen?: boolean;
  onToggleResponse: (responseId: string) => void;
  renderResponseBody: (response: SurveyResultsResponseListEntry, index: number) => React.ReactNode;
  response: SurveyResultsResponseListEntry;
  responseId: string;
  styleMap: Record<string, string>;
};

const SurveyResultsIndividualResponseCard = ({
  currentSurveyId = '',
  effectiveSlug = '',
  index,
  isOpen = false,
  onToggleResponse,
  renderResponseBody,
  response,
  responseId,
  styleMap,
}: SurveyResultsIndividualResponseCardProps): React.ReactElement => (
  <Card className={styleMap.singleResponseCard}>
    <CardHeader
      onClick={() => onToggleResponse(responseId)}
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
        icon={isOpen ? faCaretUp : faCaretDown}
        className={styleMap.biggerIcon}
      />
    </CardHeader>
    <Collapse isOpen={isOpen} id={styleMap.surveyResultsCollapse}>
      {isOpen && (
        <CardBody className={styleMap.responseCard}>
          {renderResponseBody(response, index)}
        </CardBody>
      )}
    </Collapse>
  </Card>
);

export default SurveyResultsIndividualResponseCard;
