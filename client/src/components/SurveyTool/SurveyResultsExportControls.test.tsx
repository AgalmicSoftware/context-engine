import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsExportControls from './SurveyResultsExportControls';

const styleMap = {
  downloadButton: 'downloadButton',
  exportAreaExpanded: 'exportAreaExpanded',
  exportAreaHeader: 'exportAreaHeader',
  exportCollapseButton: 'exportCollapseButton',
  exportDataBox: 'exportDataBox',
  exportDropdown: 'exportDropdown',
  exportDropdownBox: 'exportDropdownBox',
  exportLabel: 'exportLabel',
  exportOptions: 'exportOptions',
  exportToggleButton: 'exportToggleButton',
};

const exportOptions = [
  { value: 'csv-questions', label: 'CSV: Questions' },
  { value: 'json-questions', label: 'JSON: Questions' },
];

describe('SurveyResultsExportControls', () => {
  it('renders the collapsed export button and toggle wiring', () => {
    const onToggleExportArea = jest.fn();
    render(
      <SurveyResultsExportControls
        exportAreaOpen={false}
        exportOptions={exportOptions}
        exportTypeLabel="CSV: Questions"
        onDownload={jest.fn()}
        onExportTypeChange={jest.fn()}
        onToggleExportArea={onToggleExportArea}
        styleMap={styleMap}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Export Data' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'surveyResultsExportArea');
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(screen.queryByText('JSON: Questions')).toBeNull();

    fireEvent.click(toggle);
    expect(onToggleExportArea).toHaveBeenCalledTimes(1);
  });

  it('renders expanded options, collapse action, and download wiring', () => {
    const onDownload = jest.fn();
    const onExportHtmlReport = jest.fn();
    const onExportTypeChange = jest.fn();
    const onToggleExportArea = jest.fn();
    render(
      <SurveyResultsExportControls
        exportAreaOpen={true}
        exportOptions={exportOptions}
        exportTypeLabel="CSV: Questions"
        onDownload={onDownload}
        onExportHtmlReport={onExportHtmlReport}
        onExportTypeChange={onExportTypeChange}
        onToggleExportArea={onToggleExportArea}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('Export Data:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV: Questions' })).toBeInTheDocument();
    expect(screen.getByText('JSON: Questions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('JSON: Questions'));
    expect(onExportTypeChange).toHaveBeenCalledWith('json-questions');

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('ce-surveyresults-export-html-report'));
    expect(onExportHtmlReport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Collapse export area'));
    expect(onToggleExportArea).toHaveBeenCalledTimes(1);
  });
});
