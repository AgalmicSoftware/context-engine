import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark } from '@fortawesome/free-solid-svg-icons';

import { getShortenedQuestionID } from 'utilities/ui/displayHelpers.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import type { SurveyResultsQuestionTableEntry } from './surveyResultsSummaryModels';

type SurveyResultsQuestionTableRowProps = {
  bookmarked?: boolean;
  entry: SurveyResultsQuestionTableEntry;
  fallbackSessionSlug?: string;
  onToggleQuestionBookmark: (questionId: string) => void;
  onViewQuestion: (questionId: string) => void;
  styleMap: Record<string, string>;
};

export const SURVEY_RESULTS_TABLE_CELL_STYLE: React.CSSProperties = {
  textAlign: 'center',
};

export const SURVEY_RESULTS_TABLE_BOOKMARK_STYLE: React.CSSProperties = {
  marginRight: '6px',
  cursor: 'pointer',
};

const SurveyResultsQuestionTableRow = ({
  bookmarked = false,
  entry,
  fallbackSessionSlug = '',
  onToggleQuestionBookmark,
  onViewQuestion,
  styleMap,
}: SurveyResultsQuestionTableRowProps): React.ReactElement => {
  const shortened = getShortenedQuestionID(entry.questionId, false);

  return (
    <tr>
      <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>
        <FontAwesomeIcon
          icon={faBookmark}
          style={SURVEY_RESULTS_TABLE_BOOKMARK_STYLE}
          color={bookmarked ? 'gold' : 'white'}
          onClick={() => onToggleQuestionBookmark(entry.questionId)}
        />
        <a
          href={buildQuestionRoutePath(entry.questionId, {
            sessionSlug: entry.sessionSlug || fallbackSessionSlug,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className={styleMap.clickableQuestionId}
        >
          {shortened}
        </a>
      </td>
      <td className={styleMap.promptColumn}>{entry.prompt || '(No prompt)'}</td>
      <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>{entry.type}</td>
      <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>{entry.responsesCount}</td>
      <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>
        <Button size="sm" onClick={() => onViewQuestion(entry.questionId)} className={styleMap.tableActionButton}>
          View
        </Button>
      </td>
    </tr>
  );
};

export default SurveyResultsQuestionTableRow;
