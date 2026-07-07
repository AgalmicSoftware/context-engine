import type { SessionResultsGeneratedAnalysisArtifact } from '../../utilities/sessionResultsExport';
import {
  selectSurveyResultsAnalysisArtifactFromCache,
  type SurveyResultsAnalysisArtifactCacheReadPort,
  type SurveyResultsAnalysisArtifactCacheReadRequest,
  type SurveyResultsAnalysisArtifactCacheTarget,
  type SurveyResultsAnalysisArtifactSelectionArgs,
} from './surveyResultsAnalysisArtifactCachePorts';

export type SurveyResultsAnalysisArtifactReadSelector = (
  args: SurveyResultsAnalysisArtifactSelectionArgs,
) => SessionResultsGeneratedAnalysisArtifact | null;

export type SurveyResultsAnalysisArtifactReadControllerPorts = {
  readAnalysisArtifactCache?: SurveyResultsAnalysisArtifactCacheReadPort;
  selectAnalysisArtifact?: SurveyResultsAnalysisArtifactReadSelector;
};

export type SurveyResultsAnalysisArtifactReadControllerArgs = {
  ports?: SurveyResultsAnalysisArtifactReadControllerPorts;
  readRequest?: SurveyResultsAnalysisArtifactCacheReadRequest | null;
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

export type SurveyResultsAnalysisArtifactReadControllerResult = {
  artifact: SessionResultsGeneratedAnalysisArtifact | null;
  error: unknown;
  ok: boolean;
  readRequest: SurveyResultsAnalysisArtifactCacheReadRequest | null;
  skipReason: '' | 'missing-read-request' | 'missing-read-port';
  status: 'read' | 'skipped' | 'failed';
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

export const runSurveyResultsAnalysisArtifactReadController = ({
  ports = {},
  readRequest = null,
  target,
}: SurveyResultsAnalysisArtifactReadControllerArgs): SurveyResultsAnalysisArtifactReadControllerResult => {
  if (!readRequest) {
    return {
      artifact: null,
      error: null,
      ok: true,
      readRequest: null,
      skipReason: 'missing-read-request',
      status: 'skipped',
      target,
    };
  }

  if (!ports.readAnalysisArtifactCache) {
    return {
      artifact: null,
      error: null,
      ok: true,
      readRequest,
      skipReason: 'missing-read-port',
      status: 'skipped',
      target,
    };
  }

  try {
    const cacheValue = ports.readAnalysisArtifactCache(readRequest.namespace, readRequest.slug, readRequest.options);
    const selectAnalysisArtifact = ports.selectAnalysisArtifact || selectSurveyResultsAnalysisArtifactFromCache;
    return {
      artifact: selectAnalysisArtifact({
        cacheValue,
        target,
      }),
      error: null,
      ok: true,
      readRequest,
      skipReason: '',
      status: 'read',
      target,
    };
  } catch (error) {
    return {
      artifact: null,
      error,
      ok: false,
      readRequest,
      skipReason: '',
      status: 'failed',
      target,
    };
  }
};
