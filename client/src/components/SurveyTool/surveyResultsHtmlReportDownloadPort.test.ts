import { bindSurveyResultsHtmlReportDownloadPort } from './surveyResultsHtmlReportDownloadPort';

describe('surveyResultsHtmlReportDownloadPort', () => {
  it('routes HTML and PDF report downloads with unchanged arguments', async () => {
    const downloadSessionResultsHtmlReport = jest.fn();
    const downloadSessionResultsPdfReport = jest.fn(async () => undefined);
    const port = bindSurveyResultsHtmlReportDownloadPort({
      sessionResultsExport: () => ({
        downloadSessionResultsHtmlReport,
        downloadSessionResultsPdfReport,
      }),
    });

    port.downloadHtmlReport('<html>Report</html>', 'report.html');
    await port.downloadPdfReport({
      filename: 'report.pdf',
      html: '<html>Report</html>',
    });

    expect(downloadSessionResultsHtmlReport).toHaveBeenCalledWith('<html>Report</html>', 'report.html');
    expect(downloadSessionResultsPdfReport).toHaveBeenCalledWith({
      filename: 'report.pdf',
      html: '<html>Report</html>',
    });
  });

  it('performs call-time utility lookup so Jest module mocks keep intercepting', () => {
    const firstHtmlReport = jest.fn();
    const secondHtmlReport = jest.fn();
    const downloadSessionResultsPdfReport = jest.fn(async () => undefined);
    const sessionResultsExport = {
      downloadSessionResultsHtmlReport: firstHtmlReport,
      downloadSessionResultsPdfReport,
    };
    const port = bindSurveyResultsHtmlReportDownloadPort({
      sessionResultsExport: () => sessionResultsExport,
    });

    port.downloadHtmlReport('<html>First</html>', 'first.html');
    sessionResultsExport.downloadSessionResultsHtmlReport = secondHtmlReport;
    port.downloadHtmlReport('<html>Second</html>', 'second.html');

    expect(firstHtmlReport).toHaveBeenCalledWith('<html>First</html>', 'first.html');
    expect(secondHtmlReport).toHaveBeenCalledWith('<html>Second</html>', 'second.html');
  });
});
