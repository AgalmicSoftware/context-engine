import { createLogger } from 'utilities/logging.js';
import { getShortenedSurveyID } from 'utilities/ui/displayHelpers.js';

import { buildSurveyResultsAlertMessagePatch, buildSurveyResultsCsvFileNamePatch } from './surveyResultsHelpers.js';
import {
  runSurveyResultsBrowserDownload,
  runSurveyResultsExportController,
  type SurveyResultsExportDownloadPort,
} from './surveyResultsExportController.js';
import {
  buildSurveyResultsQuestionsCsvExport,
  buildSurveyResultsQuestionsJsonExport,
  buildSurveyResultsExportBaseFileName,
  buildSurveyResultsResponsesCsvExport,
  buildSurveyResultsResponsesJsonExport,
} from './surveyResultsExportPlans.js';
import {
  buildSurveyResultsFilteredQuestionIdsForExport,
  buildSurveyResultsFilteredQuestionsForExport,
  type SurveyResultsQuestionExportRecord,
} from './surveyResultsExportRows.js';
import type { SurveyResultsResponseRecord } from './surveyResultsLockedFieldHelpers';

type SurveyResultsDataExportRecord = Record<string, unknown>;

type SurveyResultsFilteredResponseRow = {
  response?: unknown;
};

type SurveyResultsDataExportQuestionRecord = {
  id?: unknown;
  options?: unknown;
  prompt?: unknown;
  tags?: unknown;
  type?: unknown;
};

export type SurveyResultsDataExportState = SurveyResultsDataExportRecord & {
  alertMessage?: unknown;
  exportType?: unknown;
  filterState?: unknown;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  sbtFilteredAggregatorQuestionResponses?: unknown;
  sbtFilteredResponses?: unknown;
  surveyId?: unknown;
  surveyTitle?: unknown;
  surveyViewMode?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsDataExportProps = SurveyResultsDataExportRecord & {
  sessionName?: unknown;
};

export type SurveyResultsDataExportRuntime = {
  downloadCSV: () => void;
  generateQuestionsCSV: () => string;
  generateQuestionsJSON: () => string;
  generateResponsesCSV: () => string;
  generateResultsJSON: () => string;
  getExportBaseFileName: (exportType?: unknown) => string;
  getFilteredQuestionIdsForExport: () => string[];
  getFilteredQuestionsForExport: () => SurveyResultsQuestionExportRecord[];
};

export type SurveyResultsDataExportRuntimeArgs = {
  applyStatePatch: (patch: SurveyResultsDataExportRecord) => void;
  downloadFile?: SurveyResultsExportDownloadPort;
  getEffectiveSlug: () => string;
  getNetworkQuestionsForCurrentContext: () => unknown;
  getProps: () => SurveyResultsDataExportProps;
  getResponseQuestionId: (response: SurveyResultsResponseRecord | null | undefined) => string;
  getState: () => SurveyResultsDataExportState;
  hasEffectiveNetworkId: () => boolean;
  nowIso?: () => string;
  parseResponse: (response: unknown) => SurveyResultsResponseRecord | null;
  writeCsvFileName: (filename: string) => void;
};

const surveyLog = createLogger('surveys');

const NETWORK_UNAVAILABLE_EXPORT_MESSAGE = 'Network not available for fetching question data.';
const NO_FILTERED_QUESTIONS_EXPORT_MESSAGE = 'No filtered questions to export.';

const toRecord = (value: unknown): SurveyResultsDataExportRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsDataExportRecord) : {};

const toQuestionRecordMap = (value: unknown): Record<string, SurveyResultsDataExportQuestionRecord | undefined> =>
  toRecord(value) as Record<string, SurveyResultsDataExportQuestionRecord | undefined>;

const toFilteredResponseRows = (value: unknown): SurveyResultsFilteredResponseRow[] =>
  Array.isArray(value) ? (value as SurveyResultsFilteredResponseRow[]) : [];

const toAggregatorRecord = (value: unknown): Record<string, unknown> => toRecord(value);

const buildCsvTimestamp = (nowIso: () => string): string => nowIso().replace(/[:.]/g, '_');

const buildDownloadTimestamp = (nowIso: () => string): string => nowIso().replace(/[:.-]/g, '_');

export const createSurveyResultsDataExportRuntime = ({
  applyStatePatch,
  downloadFile = runSurveyResultsBrowserDownload,
  getEffectiveSlug,
  getNetworkQuestionsForCurrentContext,
  getProps,
  getResponseQuestionId,
  getState,
  hasEffectiveNetworkId,
  nowIso = () => new Date().toISOString(),
  parseResponse,
  writeCsvFileName,
}: SurveyResultsDataExportRuntimeArgs): SurveyResultsDataExportRuntime => {
  const setAlertMessage = (message: string): void => {
    applyStatePatch(buildSurveyResultsAlertMessagePatch(message));
  };

  const commitCsvFileName = (filename: string): void => {
    writeCsvFileName(filename);
    applyStatePatch(buildSurveyResultsCsvFileNamePatch(filename));
  };

  const getFilteredQuestionIdsForExport = (): string[] => {
    const state = getState();
    return buildSurveyResultsFilteredQuestionIdsForExport({
      aggregatorQuestionResponses: toAggregatorRecord(state.sbtFilteredAggregatorQuestionResponses),
      filteredResponses: toFilteredResponseRows(state.sbtFilteredResponses),
      getResponseQuestionId,
      parseResponse,
    });
  };

  const getFilteredQuestionsForExport = (): SurveyResultsQuestionExportRecord[] =>
    buildSurveyResultsFilteredQuestionsForExport({
      networkQuestions: toQuestionRecordMap(getNetworkQuestionsForCurrentContext()),
      questionIds: getFilteredQuestionIdsForExport(),
    });

  const generateResponsesCSV = (): string => {
    const state = getState();
    const props = getProps();

    if (!hasEffectiveNetworkId()) {
      setAlertMessage(NETWORK_UNAVAILABLE_EXPORT_MESSAGE);
      return '';
    }

    const tsName = buildCsvTimestamp(nowIso);
    try {
      const isSurveyIndividuals = state.viewMode === 'survey' && state.surveyViewMode === 'individuals';
      const prefix = isSurveyIndividuals ? 'contextEngine_surveyResponses' : 'contextEngine_questionResponses';

      let cleanSession = '';
      const sessionName = props.sessionName;
      try {
        if (typeof sessionName === 'string' && sessionName.trim().length > 0) {
          cleanSession = sessionName.replace(/[^A-Za-z0-9_-]+/g, '');
        } else if (sessionName !== undefined) {
          surveyLog.error(
            '[SurveyResults.generateResponsesCSV] sessionName provided but not a non-empty string:',
            sessionName,
          );
        }
      } catch (orgErr) {
        surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to sanitize sessionName:', orgErr);
      }

      const suggested = `${prefix}_${tsName}${cleanSession ? '_' + cleanSession : ''}.csv`;
      commitCsvFileName(suggested);
    } catch (err) {
      surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set CSV filename:', err);
      const fallback = `contextEngine_questionResponses_${tsName}.csv`;
      try {
        commitCsvFileName(fallback);
      } catch (innerErr) {
        surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set fallback CSV filename:', innerErr);
      }
    }

    return buildSurveyResultsResponsesCsvExport({
      aggregatorQuestionResponses: state.sbtFilteredAggregatorQuestionResponses,
      filteredResponses: state.sbtFilteredResponses,
      networkQuestions: getNetworkQuestionsForCurrentContext(),
      parseResponse,
      surveyViewMode: state.surveyViewMode,
      viewMode: state.viewMode,
    });
  };

  const generateResultsJSON = (): string => {
    const state = getState();
    return buildSurveyResultsResponsesJsonExport({
      counts: {
        totalQuestions: state.totalQuestionsCount,
        filteredQuestions: state.filteredQuestionsCount,
        totalResponses: state.totalResponsesCount,
        filteredResponses: state.filteredResponsesCount,
      },
      exportedAt: nowIso(),
      filteredQuestionResponses: state.sbtFilteredAggregatorQuestionResponses || {},
      filteredQuestions: getFilteredQuestionsForExport(),
      filteredResponses: state.sbtFilteredResponses || [],
      filterState: state.filterState || {},
      sessionSlug: getEffectiveSlug() || '',
      surveyId: state.surveyId || null,
      surveyTitle: state.surveyTitle || '',
      surveyViewMode: state.surveyViewMode,
      viewMode: state.viewMode,
    });
  };

  const generateQuestionsJSON = (): string => {
    const state = getState();
    return buildSurveyResultsQuestionsJsonExport({
      counts: {
        totalQuestions: state.totalQuestionsCount,
        filteredQuestions: state.filteredQuestionsCount,
        totalResponses: state.totalResponsesCount,
        filteredResponses: state.filteredResponsesCount,
      },
      exportedAt: nowIso(),
      filteredQuestions: getFilteredQuestionsForExport(),
      filterState: state.filterState || {},
      sessionSlug: getEffectiveSlug() || '',
      surveyId: state.surveyId || null,
      surveyTitle: state.surveyTitle || '',
      surveyViewMode: state.surveyViewMode,
      viewMode: state.viewMode,
    });
  };

  const generateQuestionsCSV = (): string => {
    if (!hasEffectiveNetworkId()) {
      setAlertMessage(NETWORK_UNAVAILABLE_EXPORT_MESSAGE);
      return '';
    }

    const filteredQuestions = getFilteredQuestionsForExport();
    if (!filteredQuestions.length) {
      setAlertMessage(NO_FILTERED_QUESTIONS_EXPORT_MESSAGE);
      return '';
    }

    return buildSurveyResultsQuestionsCsvExport(filteredQuestions);
  };

  const getExportBaseFileName = (exportType: unknown = getState().exportType): string => {
    const state = getState();
    const surveyId = String(state.surveyId || '');
    const surveyIdShort = surveyId ? getShortenedSurveyID(surveyId, false, null, true) : 'all';
    return buildSurveyResultsExportBaseFileName({
      exportType,
      surveyIdShort,
      viewMode: state.viewMode,
    });
  };

  const downloadCSV = (): void => {
    const state = getState();
    const exportType = state.exportType;
    const timestamp = buildDownloadTimestamp(nowIso);
    const baseFileName = getExportBaseFileName(exportType);
    runSurveyResultsExportController({
      baseFileName,
      downloadFile,
      exportType,
      generators: {
        'questions-csv': generateQuestionsCSV,
        'questions-json': generateQuestionsJSON,
        'questions-responses-csv': generateResponsesCSV,
        'questions-responses-json': generateResultsJSON,
      },
      getCurrentAlertMessage: () => getState().alertMessage,
      onAlertMessage: setAlertMessage,
      timestamp,
    });
  };

  return {
    downloadCSV,
    generateQuestionsCSV,
    generateQuestionsJSON,
    generateResponsesCSV,
    generateResultsJSON,
    getExportBaseFileName,
    getFilteredQuestionIdsForExport,
    getFilteredQuestionsForExport,
  };
};
