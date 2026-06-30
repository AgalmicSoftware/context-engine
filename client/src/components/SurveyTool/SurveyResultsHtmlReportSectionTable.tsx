import React from 'react';
import {
  Input,
  Table,
} from 'reactstrap';

import type {
  SurveyResultsHtmlReportSectionKey,
  SurveyResultsHtmlReportSectionRow,
} from './surveyResultsHtmlReportReadiness';

export type { SurveyResultsHtmlReportSectionRow };

export type SurveyResultsHtmlReportSelectedSections =
  Partial<Record<SurveyResultsHtmlReportSectionKey, unknown>>;

export type SurveyResultsHtmlReportSectionTableProps = {
  onToggleSection: (key: SurveyResultsHtmlReportSectionKey) => void;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: SurveyResultsHtmlReportSelectedSections;
  styleMap: Record<string, string>;
};

const SurveyResultsHtmlReportSectionTable = ({
  onToggleSection,
  sectionRows,
  selectedSections,
  styleMap,
}: SurveyResultsHtmlReportSectionTableProps): React.ReactElement => (
  <Table size="sm" responsive className={styleMap.htmlReportSectionTable}>
    <thead>
      <tr>
        <th scope="col">Include</th>
        <th scope="col">Section</th>
        <th scope="col">Availability</th>
        <th scope="col">Why</th>
      </tr>
    </thead>
    <tbody>
      {sectionRows.map((row) => (
        <tr key={row.key}>
          <td>
            <Input
              aria-label={`Include ${row.label}`}
              checked={!!selectedSections[row.key]}
              type="checkbox"
              onChange={() => onToggleSection(row.key)}
            />
          </td>
          <td>{row.label}</td>
          <td>{row.available ? 'Available' : 'Unavailable'}</td>
          <td>{row.reason}</td>
        </tr>
      ))}
    </tbody>
  </Table>
);

export default SurveyResultsHtmlReportSectionTable;
