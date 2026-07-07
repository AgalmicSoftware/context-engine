import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsHtmlReportSectionTable from './SurveyResultsHtmlReportSectionTable';

const styleMap = {
  htmlReportSectionTable: 'htmlReportSectionTable',
};

describe('SurveyResultsHtmlReportSectionTable', () => {
  it('renders report section availability and toggles sections through explicit callbacks', () => {
    const onToggleSection = jest.fn();

    render(
      <SurveyResultsHtmlReportSectionTable
        onToggleSection={onToggleSection}
        sectionRows={[
          {
            available: true,
            key: 'report',
            label: 'Report',
            reason: 'Ready',
          },
          {
            available: false,
            key: 'argumentMap',
            label: 'Argument Map',
            reason: 'Needs analysis',
          },
        ]}
        selectedSections={{
          argumentMap: false,
          report: true,
        }}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('Report')).toBeInTheDocument();
    expect(screen.getByText('Argument Map')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Needs analysis')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Report')).toBeChecked();
    expect(screen.getByLabelText('Include Argument Map')).not.toBeChecked();

    fireEvent.click(screen.getByLabelText('Include Argument Map'));

    expect(onToggleSection).toHaveBeenCalledWith('argumentMap');
  });
});
