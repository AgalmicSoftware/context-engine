type CacheRecord = Record<string, unknown>;

export interface SurveyResponseItem {
  responder: string;
  response: unknown;
}

export interface NormalizedSurveyResponseBatchResult {
  responses: SurveyResponseItem[];
  hadPartialFailure: boolean;
  lowestFailedBlock: number | null;
}

interface ResolveSurveyResponseWatermarkArgs {
  startBlock: number;
  latestBlock: number;
  hadPartialFailure: boolean;
  lowestFailedBlock: number | null;
}

export const normalizeSurveyResponseBatchResult = (batchResult: unknown): NormalizedSurveyResponseBatchResult => {
  if (Array.isArray(batchResult)) {
    return {
      responses: batchResult as SurveyResponseItem[],
      hadPartialFailure: false,
      lowestFailedBlock: null,
    };
  }
  const batchRecord = (batchResult && typeof batchResult === 'object' ? batchResult : {}) as CacheRecord;
  const responses = Array.isArray(batchRecord.responses) ? (batchRecord.responses as SurveyResponseItem[]) : [];
  const lowestFailedBlock = Number(batchRecord.lowestFailedBlock);
  return {
    responses,
    hadPartialFailure: !!batchRecord.hadPartialFailure,
    lowestFailedBlock: Number.isFinite(lowestFailedBlock) ? lowestFailedBlock : null,
  };
};

export const resolveSurveyResponseWatermark = ({
  startBlock,
  latestBlock,
  hadPartialFailure,
  lowestFailedBlock,
}: ResolveSurveyResponseWatermarkArgs): number => {
  if (!hadPartialFailure) return latestBlock;
  const failedBlock = Number(lowestFailedBlock);
  if (!Number.isFinite(failedBlock)) return latestBlock;
  return Math.max(Math.max(0, Number(startBlock) - 1), Math.min(Number(latestBlock) || 0, failedBlock - 1));
};
