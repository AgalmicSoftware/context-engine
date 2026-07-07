import { toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

type UserPageLengthLike = {
  length: number;
};

export type BuildUserPageDeriveTelemetrySnapshotArgs = {
  aggregate?: unknown;
  questionSection?: unknown;
  sbtSection?: unknown;
  surveySection?: unknown;
};

export type BuildUserPageNoSbtVisibleTelemetryStateArgs = {
  hasUncertainGateAccess?: unknown;
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
  isDeepScanning?: unknown;
  isSBTReady?: unknown;
  latestRefreshTelemetry?: unknown;
  loadingSBTs?: unknown;
  networkID?: unknown;
  sbtList?: unknown;
  viewAddress?: unknown;
};

export type UserPageNoSbtVisibleTelemetryState = {
  payload: UserPageUnknownRecord | null;
  shouldEmit: boolean;
  signature: string;
};

export type BuildUserPageRefreshTelemetrySnapshotArgs = {
  aggregate?: unknown;
  bypassSignature?: unknown;
  deepScanTooltipLines?: unknown;
  force?: unknown;
  hasSbtSources?: unknown;
  hasUncertainGateAccess?: unknown;
  hasUncertainUserData?: unknown;
  holdSbtLoading?: unknown;
  isDeepScanning?: unknown;
  markLoading?: unknown;
  networkID?: unknown;
  sbtReady?: unknown;
  sbtSection?: unknown;
  sourcePresence?: unknown;
  viewAddressLower?: unknown;
};

export const readBoolishUserPageTelemetryFlag = (raw: unknown, fallback: unknown = false): boolean => {
  if (typeof raw === 'boolean') return raw;
  const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
  if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
  if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
  return !!fallback;
};

export const buildUserPageDeriveTelemetrySnapshot = ({
  aggregate = null,
  questionSection = null,
  sbtSection = null,
  surveySection = null,
}: BuildUserPageDeriveTelemetrySnapshotArgs = {}): UserPageUnknownRecord => {
  const aggregateRecord = aggregate as UserPageUnknownRecord | null | undefined;
  const questionRecord = questionSection as UserPageUnknownRecord | null | undefined;
  const sbtRecord = sbtSection as UserPageUnknownRecord | null | undefined;
  const surveyRecord = surveySection as UserPageUnknownRecord | null | undefined;
  return {
    aggregateBuilt: !!aggregate,
    combinedSurveys: aggregate ? Object.keys((aggregateRecord?.combinedSurveys || {}) as object).length : 0,
    combinedQuestions: aggregate ? Object.keys((aggregateRecord?.combinedQuestions || {}) as object).length : 0,
    combinedSurveyResponses: aggregate
      ? Object.keys((aggregateRecord?.combinedSurveyResponses || {}) as object).length
      : 0,
    combinedQuestionResponses: aggregate
      ? Object.keys((aggregateRecord?.combinedQuestionResponses || {}) as object).length
      : 0,
    sbtAggregateKeys: aggregate ? Object.keys((aggregateRecord?.sbtAggregate || {}) as object).length : 0,
    surveySection: surveySection
      ? {
          responseCount: (surveyRecord?.surveyResponseInfo as UserPageLengthLike | null | undefined)?.length,
          createdCount: (surveyRecord?.surveyCreationInfo as UserPageLengthLike | null | undefined)?.length,
        }
      : null,
    questionSection: questionSection
      ? {
          responseCount: (questionRecord?.questionResponseInfo as UserPageLengthLike | null | undefined)?.length,
          createdCount: (questionRecord?.questionCreationInfo as UserPageLengthLike | null | undefined)?.length,
        }
      : null,
    sbtSection: sbtSection
      ? {
          sbtCount: (sbtRecord?.sbtList as UserPageLengthLike | null | undefined)?.length,
        }
      : null,
  };
};

export const buildUserPageNoSbtVisibleTelemetryState = ({
  hasUncertainGateAccess = false,
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
  isDeepScanning = false,
  isSBTReady = false,
  latestRefreshTelemetry = null,
  loadingSBTs = false,
  networkID = '',
  sbtList = [],
  viewAddress = '',
}: BuildUserPageNoSbtVisibleTelemetryStateArgs = {}): UserPageNoSbtVisibleTelemetryState => {
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const resolvedIsSBTReady = !!isSBTReady;
  const resolvedLoadingSBTs = !!loadingSBTs;
  const resolvedIsDeepScanning = !!isDeepScanning;
  const isSbtLoadingAny = !!(resolvedLoadingSBTs || !resolvedIsSBTReady || resolvedIsDeepScanning);
  const sbtListCount = Array.isArray(sbtList) ? sbtList.length : 0;
  if (isSbtLoadingAny || sbtListCount > 0) {
    return {
      payload: null,
      shouldEmit: false,
      signature: '',
    };
  }

  const latestRefresh = toAnalysisRecord(latestRefreshTelemetry);
  const signature = [
    viewAddressLower,
    String(networkID || ''),
    String(resolvedLoadingSBTs ? 1 : 0),
    String(resolvedIsSBTReady ? 1 : 0),
    String(resolvedIsDeepScanning ? 1 : 0),
    String(hasUncertainUserData ? 1 : 0),
    String(hasUncertainSbtData ? 1 : 0),
    String(hasUncertainGateAccess ? 1 : 0),
    String(sbtListCount),
    String(latestRefresh.aggregateSbtAddresses || 0),
    String(latestRefresh.heldAggregateSbtCount || 0),
    String(latestRefresh.derivedSbtCount ?? ''),
  ].join('|');

  return {
    payload: {
      viewAddress: viewAddressLower,
      networkID: String(networkID || ''),
      loadingSBTs: resolvedLoadingSBTs,
      isSBTReady: resolvedIsSBTReady,
      isDeepScanning: resolvedIsDeepScanning,
      hasUncertainUserData: !!hasUncertainUserData,
      hasUncertainSbtData: !!hasUncertainSbtData,
      hasUncertainGateAccess: !!hasUncertainGateAccess,
      sbtListCount,
      refreshSnapshot: latestRefresh,
    },
    shouldEmit: true,
    signature,
  };
};

export const buildUserPageRefreshTelemetrySnapshot = ({
  aggregate = null,
  bypassSignature = false,
  deepScanTooltipLines = null,
  force = false,
  hasSbtSources = false,
  hasUncertainGateAccess = false,
  hasUncertainUserData = false,
  holdSbtLoading = false,
  isDeepScanning = false,
  markLoading = false,
  networkID = '',
  sbtReady = false,
  sbtSection = null,
  sourcePresence = {},
  viewAddressLower = '',
}: BuildUserPageRefreshTelemetrySnapshotArgs = {}): UserPageUnknownRecord => {
  const aggregateRecord = aggregate as UserPageUnknownRecord | null | undefined;
  const sbtSectionRecord = sbtSection as UserPageUnknownRecord | null | undefined;
  const aggregateSbt = aggregateRecord?.sbtAggregate || {};
  const aggregateSbtKeys = Object.keys(aggregateSbt as object);
  const heldAggregateSbtKeys = aggregateSbtKeys.filter((key: string) => {
    const entry = (aggregateSbt as UserPageUnknownRecord)[key] as UserPageUnknownRecord | null | undefined;
    return !!(
      entry &&
      (entry.mintedSet as { has?: (value: unknown) => boolean } | null | undefined)?.has?.(viewAddressLower) &&
      !(entry.burnedSet as { has?: (value: unknown) => boolean } | null | undefined)?.has?.(viewAddressLower)
    );
  });
  const aggregateSurveyMap = aggregateRecord?.combinedSurveys || {};
  const aggregateQuestionMap = aggregateRecord?.combinedQuestions || {};
  const aggregateSurveyResponseMap = aggregateRecord?.combinedSurveyResponses || {};
  const aggregateQuestionResponseMap = aggregateRecord?.combinedQuestionResponses || {};
  const aggregateSurveyResponseIds = Object.keys(aggregateSurveyResponseMap as object).filter((sidRaw: string) => {
    const sid = String(sidRaw || '').toLowerCase();
    if (!sid) return false;
    const row =
      (aggregateSurveyResponseMap as UserPageUnknownRecord)[sidRaw] ||
      (aggregateSurveyResponseMap as UserPageUnknownRecord)[sid] ||
      {};
    return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower as PropertyKey));
  });
  const aggregateQuestionResponseIds = Object.keys(aggregateQuestionResponseMap as object).filter((qidRaw: string) => {
    const qid = String(qidRaw || '').toLowerCase();
    if (!qid) return false;
    const row =
      (aggregateQuestionResponseMap as UserPageUnknownRecord)[qidRaw] ||
      (aggregateQuestionResponseMap as UserPageUnknownRecord)[qid] ||
      {};
    return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower as PropertyKey));
  });

  return {
    viewAddress: viewAddressLower,
    networkID: String(networkID || ''),
    force: !!force,
    markLoading: !!markLoading,
    bypassSignature: !!bypassSignature,
    isDeepScanning: !!isDeepScanning,
    hasUncertainUserData: !!hasUncertainUserData,
    hasUncertainGateAccess: !!hasUncertainGateAccess,
    sbtReady: !!sbtReady,
    holdSbtLoading: !!holdSbtLoading,
    hasSbtSources: !!hasSbtSources,
    aggregateSbtAddresses: aggregateSbtKeys.length,
    heldAggregateSbtCount: heldAggregateSbtKeys.length,
    heldAggregateSbtSample: heldAggregateSbtKeys.slice(0, 12),
    aggregateSurveyCount: Object.keys(aggregateSurveyMap as object).length,
    aggregateQuestionCount: Object.keys(aggregateQuestionMap as object).length,
    aggregateSurveyResponseCount: aggregateSurveyResponseIds.length,
    aggregateQuestionResponseCount: aggregateQuestionResponseIds.length,
    aggregateSurveyResponseSample: aggregateSurveyResponseIds.slice(0, 12),
    aggregateQuestionResponseSample: aggregateQuestionResponseIds.slice(0, 12),
    derivedSbtCount: Array.isArray(sbtSectionRecord?.sbtList) ? sbtSectionRecord.sbtList.length : null,
    sourcePresence,
    deepScanTooltipLines: Array.isArray(deepScanTooltipLines) ? deepScanTooltipLines.slice(0, 8) : [],
  };
};

export const buildUserPageRefreshTelemetrySignature = (refreshTelemetry: unknown = {}): string => {
  const telemetry = refreshTelemetry as UserPageUnknownRecord;
  const deepScanTooltipLines = Array.isArray(telemetry.deepScanTooltipLines) ? telemetry.deepScanTooltipLines : [];
  return [
    telemetry.viewAddress,
    telemetry.networkID,
    String(telemetry.isDeepScanning ? 1 : 0),
    String(telemetry.hasUncertainUserData ? 1 : 0),
    String(telemetry.sbtReady ? 1 : 0),
    String(telemetry.holdSbtLoading ? 1 : 0),
    String(telemetry.hasSbtSources ? 1 : 0),
    String(telemetry.aggregateSbtAddresses),
    String(telemetry.heldAggregateSbtCount),
    String(telemetry.aggregateSurveyCount || 0),
    String(telemetry.aggregateQuestionCount || 0),
    String(telemetry.aggregateSurveyResponseCount || 0),
    String(telemetry.aggregateQuestionResponseCount || 0),
    String(telemetry.derivedSbtCount ?? ''),
    deepScanTooltipLines.join('|'),
  ].join('|');
};
