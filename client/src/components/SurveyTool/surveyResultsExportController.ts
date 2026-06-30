import {
  buildSurveyResultsExportDownloadPlan,
  buildSurveyResultsExportGenerationPlan,
  type SurveyResultsExportDownloadPlan,
  type SurveyResultsExportGenerationPlan,
  type SurveyResultsExportGeneratorKey,
} from './surveyResultsExportPlans.js';

export type SurveyResultsExportDownloadRequest = {
  fileContent: string;
  filename: string;
  mimeType: string;
};

export type SurveyResultsExportDownloadPort = (
  request: SurveyResultsExportDownloadRequest
) => void;

export type SurveyResultsExportContentGenerators = Record<
  SurveyResultsExportGeneratorKey,
  () => string
>;

export type SurveyResultsExportControllerResult =
  | {
      alertMessage: string;
      downloadPlan: null;
      generationPlan: SurveyResultsExportGenerationPlan;
      status: 'invalid';
    }
  | {
      alertMessage: string;
      downloadPlan: SurveyResultsExportDownloadPlan;
      generationPlan: SurveyResultsExportGenerationPlan;
      status: 'empty';
    }
  | {
      alertMessage: '';
      downloadPlan: SurveyResultsExportDownloadPlan;
      generationPlan: SurveyResultsExportGenerationPlan;
      status: 'download';
    };

export type RunSurveyResultsExportControllerArgs = {
  baseFileName: unknown;
  exportType: unknown;
  generators: SurveyResultsExportContentGenerators;
  getCurrentAlertMessage?: () => unknown;
  onAlertMessage?: (message: string) => void;
  timestamp: unknown;
  downloadFile: SurveyResultsExportDownloadPort;
};

export const runSurveyResultsBrowserDownload = ({
  fileContent,
  filename,
  mimeType,
}: SurveyResultsExportDownloadRequest): void => {
  const blob = new Blob([fileContent], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('hidden', '');
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const runSurveyResultsExportController = ({
  baseFileName,
  downloadFile,
  exportType,
  generators,
  getCurrentAlertMessage = () => '',
  onAlertMessage = () => {},
  timestamp,
}: RunSurveyResultsExportControllerArgs): SurveyResultsExportControllerResult => {
  const generationPlan = buildSurveyResultsExportGenerationPlan({
    baseFileName,
    exportType,
    timestamp,
  });

  if (generationPlan.status === 'invalid') {
    onAlertMessage(generationPlan.alertMessage);
    return {
      alertMessage: generationPlan.alertMessage,
      downloadPlan: null,
      generationPlan,
      status: 'invalid',
    };
  }

  const fileContent = generators[generationPlan.generatorKey]();
  const downloadPlan = buildSurveyResultsExportDownloadPlan({
    fileContent,
    generationPlan,
  });

  if (downloadPlan.status === 'empty') {
    if (!getCurrentAlertMessage()) {
      onAlertMessage(downloadPlan.alertMessage);
    }
    return {
      alertMessage: downloadPlan.alertMessage,
      downloadPlan,
      generationPlan,
      status: 'empty',
    };
  }

  downloadFile({
    fileContent: downloadPlan.fileContent,
    filename: downloadPlan.filename,
    mimeType: downloadPlan.mimeType,
  });

  return {
    alertMessage: '',
    downloadPlan,
    generationPlan,
    status: 'download',
  };
};
