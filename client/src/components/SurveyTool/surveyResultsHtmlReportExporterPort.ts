import { renderSessionResultsHtmlReport, type SessionResultsHtmlSnapshot } from '../../utilities/sessionResultsExport';
import type { SurveyResultsHtmlReportDownloadRequest } from './surveyResultsHtmlReportDownloadRequest';
import {
  surveyResultsHtmlReportDownloadPort,
  type SurveyResultsHtmlReportDownloadPort,
} from './surveyResultsHtmlReportDownloadPort';

export type SurveyResultsHtmlReportExportRequest = {
  downloadRequest: SurveyResultsHtmlReportDownloadRequest;
  snapshot: SessionResultsHtmlSnapshot;
};

export type SurveyResultsHtmlReportExportResult = {
  filename: string;
  html: string;
  kind: SurveyResultsHtmlReportDownloadRequest['kind'];
};

export type SurveyResultsHtmlReportRenderPort = typeof renderSessionResultsHtmlReport;

export type SurveyResultsHtmlReportExporterPort = {
  exportReport: (request: SurveyResultsHtmlReportExportRequest) => Promise<SurveyResultsHtmlReportExportResult>;
};

export type BindSurveyResultsHtmlReportExporterPortArgs = {
  downloadPort: () => SurveyResultsHtmlReportDownloadPort;
  renderHtmlReport: () => SurveyResultsHtmlReportRenderPort;
};

export const bindSurveyResultsHtmlReportExporterPort = ({
  downloadPort,
  renderHtmlReport,
}: BindSurveyResultsHtmlReportExporterPortArgs): SurveyResultsHtmlReportExporterPort => ({
  exportReport: async ({ downloadRequest, snapshot }) => {
    const html = renderHtmlReport()(snapshot, downloadRequest.renderOptions);
    if (downloadRequest.kind === 'pdf') {
      await downloadPort().downloadPdfReport({
        filename: downloadRequest.filename,
        html,
      });
    } else {
      downloadPort().downloadHtmlReport(html, downloadRequest.filename);
    }

    return {
      filename: downloadRequest.filename,
      html,
      kind: downloadRequest.kind,
    };
  },
});

export const surveyResultsHtmlReportExporterPort = bindSurveyResultsHtmlReportExporterPort({
  downloadPort: () => surveyResultsHtmlReportDownloadPort,
  renderHtmlReport: () => renderSessionResultsHtmlReport,
});
