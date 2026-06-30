import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  buildSessionResultsHtmlReportFilename,
  buildSessionResultsPdfReportFilename,
  type SessionResultsExportFormat,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  buildSurveyResultsHtmlReportReadinessPlan,
} from './surveyResultsHtmlReportReadiness';
import {
  buildSurveyResultsHtmlReportDownloadAttemptPlan,
} from './surveyResultsHtmlReportDownloadAttempt.js';
import type {
  SurveyResultsHtmlReportReadinessPlan,
} from './surveyResultsHtmlReportReadiness';
import type {
  SurveyResultsHtmlReportDownloadAttemptPlan,
} from './surveyResultsHtmlReportDownloadAttempt.js';

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

type SurveyResultsHtmlReportBlockedDownloadAttemptPlan = Extract<
  SurveyResultsHtmlReportDownloadAttemptPlan,
  { status: 'blocked' }
>;

export type SurveyResultsHtmlReportDownloadExecutionPlan =
  | {
    blockedReason: SurveyResultsHtmlReportBlockedDownloadAttemptPlan['blockedReason'];
    downloadRequest: null;
    readinessPlan: SurveyResultsHtmlReportReadinessPlan;
    statePatch: SurveyResultsHtmlReportBlockedDownloadAttemptPlan['statePatch'];
    status: 'blocked';
  }
  | {
    blockedReason: '';
    downloadRequest: SurveyResultsHtmlReportDownloadRequest;
    readinessPlan: SurveyResultsHtmlReportReadinessPlan;
    statePatch: null;
    status: 'ready';
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

export const buildSurveyResultsHtmlReportDownloadExecutionPlan = ({
  analysisGenerating = false,
  format = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  isAuthorized = false,
  selectedSections,
  snapshot,
}: {
  analysisGenerating?: unknown;
  format?: SessionResultsExportFormat;
  isAuthorized?: boolean;
  selectedSections: Required<SessionResultsSectionSelection>;
  snapshot: SessionResultsHtmlSnapshot;
}): SurveyResultsHtmlReportDownloadExecutionPlan => {
  const readinessPlan = buildSurveyResultsHtmlReportReadinessPlan({
    analysisGenerating,
    isAuthorized,
    selectedSections,
    snapshot,
  });
  const downloadAttemptPlan = buildSurveyResultsHtmlReportDownloadAttemptPlan({
    analysisGenerating,
    isAuthorized,
    readinessPlan,
  });

  if (downloadAttemptPlan.status === 'blocked') {
    return {
      blockedReason: downloadAttemptPlan.blockedReason,
      downloadRequest: null,
      readinessPlan,
      statePatch: downloadAttemptPlan.statePatch,
      status: 'blocked',
    };
  }

  return {
    blockedReason: '',
    downloadRequest: buildSurveyResultsHtmlReportDownloadRequest({
      format,
      selectedSections,
      snapshot,
    }),
    readinessPlan,
    statePatch: null,
    status: 'ready',
  };
};
