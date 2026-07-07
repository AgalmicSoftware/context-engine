import * as sessionResultsExportModule from '../../utilities/sessionResultsExport';

export type SurveyResultsHtmlReportDownloadPort = {
  downloadHtmlReport: (html: string, filename: string) => void;
  downloadPdfReport: typeof sessionResultsExportModule.downloadSessionResultsPdfReport;
};

export type BindSurveyResultsHtmlReportDownloadPortArgs = {
  sessionResultsExport: () => Pick<
    typeof sessionResultsExportModule,
    'downloadSessionResultsHtmlReport' | 'downloadSessionResultsPdfReport'
  >;
};

export const bindSurveyResultsHtmlReportDownloadPort = ({
  sessionResultsExport,
}: BindSurveyResultsHtmlReportDownloadPortArgs): SurveyResultsHtmlReportDownloadPort => ({
  downloadHtmlReport: (html, filename) => sessionResultsExport().downloadSessionResultsHtmlReport(html, filename),
  downloadPdfReport: (request) => sessionResultsExport().downloadSessionResultsPdfReport(request),
});

export const surveyResultsHtmlReportDownloadPort = bindSurveyResultsHtmlReportDownloadPort({
  sessionResultsExport: () => sessionResultsExportModule,
});
