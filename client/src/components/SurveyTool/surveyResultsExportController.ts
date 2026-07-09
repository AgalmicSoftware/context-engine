import {
  buildSurveyResultsExportDownloadPlan,
  buildSurveyResultsExportGenerationPlan,
  type SurveyResultsExportDownloadPlan,
  type SurveyResultsExportGenerationPlan,
  type SurveyResultsExportGeneratorKey,
} from './surveyResultsExportPlans.js';
import {
  runSurveyResultsBrowserDownload,
  type SurveyResultsBrowserDownloadRequest,
} from './surveyResultsBrowserDownloadPort.js';

export type SurveyResultsExportDownloadRequest = SurveyResultsBrowserDownloadRequest;

export type SurveyResultsExportDownloadPort = (request: SurveyResultsExportDownloadRequest) => void;

export type SurveyResultsExportContentGenerators = Record<SurveyResultsExportGeneratorKey, () => string>;

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

export { runSurveyResultsBrowserDownload };

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
