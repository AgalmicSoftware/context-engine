import React from 'react';
import { Button, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark } from '@fortawesome/free-solid-svg-icons';

import { getShortenedQuestionID } from 'utilities/ui/displayHelpers.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import type { SurveyResultsQuestionTableEntry } from './surveyResultsSummaryModels';

type SurveyResultsQuestionTableProps = {
  bookmarkedQuestionIDs?: string[];
  entries?: SurveyResultsQuestionTableEntry[];
  fallbackSessionSlug?: string;
  onSort: (sortBy: string) => void;
  onToggleQuestionBookmark: (questionId: string) => void;
  onViewQuestion: (questionId: string) => void;
  sortAsc?: boolean;
  sortBy?: string;
  styleMap: Record<string, string>;
};

export const SURVEY_RESULTS_TABLE_CELL_STYLE: React.CSSProperties = {
  textAlign: 'center',
};

export const SURVEY_RESULTS_SORTABLE_HEADER_STYLE: React.CSSProperties = {
  textAlign: 'center',
  cursor: 'pointer',
};

export const SURVEY_RESULTS_TABLE_BOOKMARK_STYLE: React.CSSProperties = {
  marginRight: '6px',
  cursor: 'pointer',
};

const getSortIndicator = (column: string, sortBy = '', sortAsc = true): string => (
  sortBy === column ? (sortAsc ? '▲' : '▼') : '▲▼'
);

const SurveyResultsQuestionTable = ({
  bookmarkedQuestionIDs = [],
  entries = [],
  fallbackSessionSlug = '',
  onSort,
  onToggleQuestionBookmark,
  onViewQuestion,
  sortAsc = true,
  sortBy = '',
  styleMap,
}: SurveyResultsQuestionTableProps): React.ReactElement => (
  <div className={styleMap.questionIdTableWrapper}>
    <Table striped bordered hover size="sm" className={styleMap.questionIdTable}>
      <thead>
        <tr>
          <th style={SURVEY_RESULTS_TABLE_CELL_STYLE}>Question ID</th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => onSort('prompt')}
          >
            Prompt {getSortIndicator('prompt', sortBy, sortAsc)}
          </th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => onSort('type')}
          >
            Type {getSortIndicator('type', sortBy, sortAsc)}
          </th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => onSort('responses')}
          >
            Responses {getSortIndicator('responses', sortBy, sortAsc)}
          </th>
          <th style={SURVEY_RESULTS_TABLE_CELL_STYLE}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const shortened = getShortenedQuestionID(entry.questionId, false);
          const bookmarked = bookmarkedQuestionIDs.includes(entry.questionId);
          return (
            <tr key={entry.questionId}>
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
                <Button
                  size="sm"
                  onClick={() => onViewQuestion(entry.questionId)}
                  className={styleMap.tableActionButton}
                >
                  View
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  </div>
);

export default SurveyResultsQuestionTable;
