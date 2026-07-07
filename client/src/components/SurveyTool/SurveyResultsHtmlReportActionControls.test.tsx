import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsHtmlReportActionControls from './SurveyResultsHtmlReportActionControls';

const styleMap = {
  htmlReportCancelButton: 'htmlReportCancelButton',
  htmlReportDownloadButton: 'htmlReportDownloadButton',
  htmlReportModalFooter: 'htmlReportModalFooter',
};

describe('SurveyResultsHtmlReportActionControls', () => {
  it('routes enabled close and download actions through explicit callbacks', () => {
    const onClose = jest.fn();
    const onDownload = jest.fn();

    render(
      <SurveyResultsHtmlReportActionControls
        canDownload
        downloadLabel="Download PDF"
        onClose={onClose}
        onDownload={onDownload}
        styleMap={styleMap}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps download inert when report readiness blocks execution', () => {
    const onClose = jest.fn();
    const onDownload = jest.fn();

    render(
      <SurveyResultsHtmlReportActionControls
        canDownload={false}
        downloadLabel="Download HTML Viewer"
        onClose={onClose}
        onDownload={onDownload}
        styleMap={styleMap}
      />,
    );

    const downloadButton = screen.getByTestId('ce-surveyresults-html-report-download');
    expect(downloadButton).toBeDisabled();

    fireEvent.click(downloadButton);

    expect(onDownload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
