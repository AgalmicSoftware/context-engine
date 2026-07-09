import React from 'react';
import { Table } from 'reactstrap';

import type { SurveyResultsQuestionTableEntry } from './surveyResultsSummaryModels';
import SurveyResultsQuestionTableRow, {
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
} from './SurveyResultsQuestionTableRow';

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

export const SURVEY_RESULTS_SORTABLE_HEADER_STYLE: React.CSSProperties = {
  textAlign: 'center',
  cursor: 'pointer',
};

export { SURVEY_RESULTS_TABLE_BOOKMARK_STYLE, SURVEY_RESULTS_TABLE_CELL_STYLE };

const getSortIndicator = (column: string, sortBy = '', sortAsc = true): string =>
  sortBy === column ? (sortAsc ? '▲' : '▼') : '▲▼';

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
          <th style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE} onClick={() => onSort('prompt')}>
            Prompt {getSortIndicator('prompt', sortBy, sortAsc)}
          </th>
          <th style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE} onClick={() => onSort('type')}>
            Type {getSortIndicator('type', sortBy, sortAsc)}
          </th>
          <th style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE} onClick={() => onSort('responses')}>
            Responses {getSortIndicator('responses', sortBy, sortAsc)}
          </th>
          <th style={SURVEY_RESULTS_TABLE_CELL_STYLE}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const bookmarked = bookmarkedQuestionIDs.includes(entry.questionId);
          return (
            <SurveyResultsQuestionTableRow
              key={entry.questionId}
              bookmarked={bookmarked}
              entry={entry}
              fallbackSessionSlug={fallbackSessionSlug}
              onToggleQuestionBookmark={onToggleQuestionBookmark}
              onViewQuestion={onViewQuestion}
              styleMap={styleMap}
            />
          );
        })}
      </tbody>
    </Table>
  </div>
);

export default SurveyResultsQuestionTable;
