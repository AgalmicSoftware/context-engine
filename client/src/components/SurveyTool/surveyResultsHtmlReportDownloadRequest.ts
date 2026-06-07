import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  buildSessionResultsHtmlReportFilename,
  buildSessionResultsPdfReportFilename,
  type SessionResultsExportFormat,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';

export type SurveyResultsHtmlReportDownloadKind = 'html' | 'pdf';

export type SurveyResultsHtmlReportFilenameIdentity = {
  exportedAt: string;
  name: string;
  slug: string;
};

export type SurveyResultsHtmlReportDownloadRequest = {
  filename: string;
  filenameIdentity: SurveyResultsHtmlReportFilenameIdentity;
  kind: SurveyResultsHtmlReportDownloadKind;
  renderOptions: {
    format: SessionResultsExportFormat;
    sections: Required<SessionResultsSectionSelection>;
  };
};

export const buildSurveyResultsHtmlReportDownloadRequest = ({
  format = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  selectedSections,
  snapshot,
}: {
  format?: SessionResultsExportFormat;
  selectedSections: Required<SessionResultsSectionSelection>;
  snapshot: SessionResultsHtmlSnapshot;
}): SurveyResultsHtmlReportDownloadRequest => {
  const filenameIdentity = {
    exportedAt: snapshot.exportedAt,
    name: snapshot.session.name,
    slug: snapshot.session.slug,
  };
  const isPdf = format === SESSION_RESULTS_EXPORT_FORMAT_PDF;

  return {
    filename: isPdf
      ? buildSessionResultsPdfReportFilename(filenameIdentity)
      : buildSessionResultsHtmlReportFilename(filenameIdentity),
    filenameIdentity,
    kind: isPdf ? 'pdf' : 'html',
    renderOptions: {
      format,
      sections: selectedSections,
    },
  };
};
