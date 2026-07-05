import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import {
  isPlainAnalysisObject,
  toAnalysisRecord,
  type UserPageUnknownRecord,
} from './userPageCoreHelpers';

type UserPageDeepScanSlugReader = (namespace: string) => unknown[];
type UserPageDeepScanCacheReader = (
  namespace: string,
  slug: string,
  options?: { clone?: boolean }
) => unknown;
type BuildUserPageDeepScanTooltipInputSignatureArgs = {
  latestBlockNumber?: unknown;
  listNamespaceSlugs?: UserPageDeepScanSlugReader;
  network?: unknown;
  peekCache?: UserPageDeepScanCacheReader;
  viewAddress?: unknown;
};
type BuildUserPageDeepScanTooltipDisplayStateArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: string[] | null;
  fallbackLine?: string;
  isDeepScanning?: unknown;
};
type BuildUserPageDeepScanTooltipOutputSignatureArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
};
type BuildUserPageDeepScanProgressStatePatchArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
  now?: unknown;
};
type ResolveUserPageDeepScanProgressStateUpdateArgs = {
  currentDeepScanProgressRows?: unknown;
  currentDeepScanTooltipLines?: unknown;
  nextDeepScanProgressRows?: unknown;
  nextDeepScanTooltipLines?: unknown;
};
type UserPageDeepScanProgressStateUpdate = {
  nextOutputSignature: string;
  shouldUpdate: boolean;
};
type UserPageDeepScanTooltipDisplayState = {
  deepScanTooltipContent: string[] | null;
  deepScanTooltipText: string;
  deepScanTooltipTitle: string;
};
type UserPageSessionScanScopeReader = () => string;
type UserPageSessionScanSlugsReader = () => unknown[];
type UserPageAllowedSessionSlugsReader = (
  scope: string,
  slugs: unknown[],
  activeSlug: string
) => unknown[];
type BuildUserPageDeepScanPrioritySlugsArgs = {
  activeSessionSlug?: unknown;
  getAllowedSessionSlugs?: UserPageAllowedSessionSlugsReader;
  readSessionScanScope?: UserPageSessionScanScopeReader;
  readSessionScanSlugs?: UserPageSessionScanSlugsReader;
};
type UserPageSessionConfigReader = (slug: string) => unknown;
type UserPageDemoSessionConfigReader = (
  slug: string,
  options?: { allowDemoFallback?: boolean }
) => unknown;
type ResolveUserPageDeepScanSessionDisplayConfigArgs = {
  getDemoSessionConfigBySlug?: UserPageDemoSessionConfigReader;
  getSessionConfigBySlug?: UserPageSessionConfigReader;
  getSessionConfigBySlugOrDefault?: UserPageSessionConfigReader;
  slugIn?: unknown;
};
type BuildUserPageDeepScanRefreshCarryPatchArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
  prevState?: unknown;
};
type UserPageDeepScanRefreshCarryPatch = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
};
export type UserPageDeepScanProgressRow = {
  slug: string;
  chainId: number | null;
  lastBlockScanned: number;
  latestBlock: number | null;
  remainingBlocks: number | null;
  percentComplete: number | null;
  isDeterminate: boolean;
  label: string;
  startBlock: number | null;
  displayLastBlock: number;
};

type UserPageDeepScanProgressSortableRow = UserPageDeepScanProgressRow & {
  __sourceIndex: number;
};
type BuildUserPageDeepScanProgressRowArgs = {
  chainId?: number | null;
  lastBlock?: unknown;
  latestBlock?: number | null;
  sessionConfig?: unknown;
  slug?: unknown;
  slugHasMultipleNetworks?: unknown;
  startBlock?: number | null;
};
type BuildUserPageDeepScanProgressRowDisplayStateArgs = {
  formatBlockCount?: (value: unknown) => string;
  index?: unknown;
  row?: Partial<UserPageDeepScanProgressRow> | null;
  showScannedText?: unknown;
};
type UserPageDeepScanProgressRowDisplayState = {
  indeterminateText: string;
  progressFillStyle: Record<string, string>;
  progressWidth: string;
  remainingText: string;
  rowKey: string;
  scannedText: string;
  shouldRenderScannedText: boolean;
};
type BuildUserPageDeepScanReportSignatureArgs = {
  report?: unknown;
  reportTargetLower?: unknown;
};
type BuildUserPageDeepScanReportStatusArgs = {
  report?: unknown;
};
type BuildUserPageDeepScanReportTelemetryPayloadsArgs = {
  report?: unknown;
  status?: Partial<UserPageDeepScanReportStatus> | null;
  viewAddress?: unknown;
};
type BuildUserPageDeepScanReportStatePatchArgs = {
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
};
type ShouldApplyUserPageDeepScanResponseArgs = {
  activeRequestSeq?: unknown;
  currentViewAddress?: unknown;
  isMounted?: unknown;
  requestSeq?: unknown;
  targetLower?: unknown;
};
type BuildUserPageDeepScanReportSamplesArgs = {
  limit?: unknown;
  report?: unknown;
};
type UserPageDeepScanReportSamples = {
  sampleCreatedQuestionIds: unknown[];
  sampleCreatedSurveyIds: unknown[];
  sampleQuestionResponseIds: unknown[];
  sampleSbtAddresses: unknown[];
  sampleSurveyResponseIds: unknown[];
};
type UserPageDeepScanReportStatus = {
  attemptedSlugs: unknown[];
  failedActivitySlugs: unknown[];
  failedSlugs: unknown[];
  hasCoverageGap: boolean;
  hasUncertainSbtData: boolean;
  hasUncertainUserData: boolean;
  rawHadRpcErrors: boolean;
  scannedSlugs: unknown[];
  skippedSlugs: unknown[];
  totalActivityFailure: boolean;
  totalSbtFailure: boolean;
  totalSkippedScan: boolean;
};
type UserPageDeepScanReportTelemetryPayloads = {
  coldDiagPayload: UserPageUnknownRecord;
  telemetryPayload: UserPageUnknownRecord;
};
type UserPageDeepScanProgressEntry = {
  slug: string;
  chainId: number | null;
  lastBlock: number;
  latestBlock: number | null;
  startBlock: number | null;
  sessionConfig: unknown | null;
};
type DeriveUserPageDeepScanProgressRowsArgs = {
  currentChainId?: unknown;
  getSessionDisplayConfig?: ((slug: string) => unknown) | null;
  latestBlockNum?: unknown;
  prioritySlugs?: unknown;
  userCaches?: unknown;
  viewLower?: unknown;
};

export const buildUserPageDeepScanTooltipInputSignature = ({
  latestBlockNumber,
  listNamespaceSlugs = () => [],
  network = null,
  peekCache = () => null,
  viewAddress = '',
}: BuildUserPageDeepScanTooltipInputSignatureArgs = {}): string => {
  const viewLower = String(viewAddress || '').toLowerCase();
  if (!viewLower) return '';
  const latestBlockNum = Number.isFinite(Number(latestBlockNumber))
    ? Number(latestBlockNumber)
    : '';
  const networkRecord = toAnalysisRecord(network);
  const currentChainId = networkRecord.id != null
    ? Number(networkRecord.id)
    : '';
  const slugs = listNamespaceSlugs('userCache')
    .map((slug: unknown) => String(slug || '').trim())
    .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
  const slugProgress = slugs
    .map((slug) => {
      const cacheEntry = peekCache('userCache', slug, { clone: false });
      const userNode = toAnalysisRecord(toAnalysisRecord(cacheEntry)[viewLower]);
      if (!Object.keys(userNode).length) return `${slug}:`;
      const netParts = Object.keys(userNode)
        .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0))
        .map((netKey) => {
          const entry = toAnalysisRecord(userNode?.[netKey]);
          const lastBlock = Number(entry?.lastBlockScanned);
          const blockToken = Number.isFinite(lastBlock) ? String(lastBlock) : '';
          const lastScanTimestamp = Number(entry?.lastScanTimestamp);
          const timestampToken = Number.isFinite(lastScanTimestamp) ? String(lastScanTimestamp) : '';
          return `${netKey}:${blockToken}:${timestampToken}`;
        })
        .join(',');
      return `${slug}:${netParts}`;
    })
    .join(';');
  return [
    viewLower,
    String(currentChainId),
    String(latestBlockNum),
    slugProgress,
  ].join('|');
};

export const buildUserPageDeepScanPrioritySlugs = ({
  activeSessionSlug = '',
  getAllowedSessionSlugs: readAllowedSessionSlugs = () => [],
  readSessionScanScope: readScope = () => '',
  readSessionScanSlugs: readScopeSlugs = () => [],
}: BuildUserPageDeepScanPrioritySlugsArgs = {}): string[] => {
  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const scope = readScope();
  const shouldUseScopedOrder = (
    scope === 'list' ||
    scope === 'general' ||
    (scope === 'active' && !!activeSlug)
  );
  const scopedSlugs = shouldUseScopedOrder
    ? readAllowedSessionSlugs(scope, readScopeSlugs(), activeSlug)
    : [];
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (rawSlug: unknown) => {
    const slug = normalizeSessionSlug(rawSlug || '');
    if (seen.has(slug)) return;
    seen.add(slug);
    ordered.push(slug);
  };

  if (scope === 'list') {
    const normalizedScopeSlugs = scopedSlugs.map((slug: unknown) => normalizeSessionSlug(slug || ''));
    const activeInScope = !!(activeSlug && normalizedScopeSlugs.includes(activeSlug));
    if (activeSlug && !activeInScope) {
      push(activeSlug);
    }
    normalizedScopeSlugs.forEach((slug) => push(slug));
    return ordered;
  }

  if (activeSlug) {
    push(activeSlug);
  }
  scopedSlugs.forEach((slug: unknown) => push(slug));
  return ordered;
};

export const resolveUserPageDeepScanSessionDisplayConfig = ({
  getDemoSessionConfigBySlug: readDemoSessionConfig = () => null,
  getSessionConfigBySlug: readSessionConfig = () => null,
  getSessionConfigBySlugOrDefault: readDefaultSessionConfig = () => null,
  slugIn = '',
}: ResolveUserPageDeepScanSessionDisplayConfigArgs = {}): UserPageUnknownRecord | null => {
  const slug = normalizeSessionSlug(slugIn || '');
  if (!slug) {
    const cfg = readDefaultSessionConfig('')
      || readDemoSessionConfig('', { allowDemoFallback: true });
    return isPlainAnalysisObject(cfg) ? cfg : null;
  }
  const cfg = readSessionConfig(slug)
    || readDemoSessionConfig(slug, { allowDemoFallback: true });
  return isPlainAnalysisObject(cfg) ? cfg : null;
};

export const formatUserPageDeepScanBlockCount = (value: unknown): string => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Math.max(0, Math.floor(numericValue)).toLocaleString();
};

export const buildUserPageDeepScanProgressRowDisplayState = ({
  formatBlockCount = formatUserPageDeepScanBlockCount,
  index = 0,
  row = null,
  showScannedText = true,
}: BuildUserPageDeepScanProgressRowDisplayStateArgs = {}): UserPageDeepScanProgressRowDisplayState => {
  const rowValue = row || {};
  const progressWidth = Number.isFinite(Number(rowValue.percentComplete))
    ? `${Math.max(0, Math.min(100, Number(rowValue.percentComplete)))}%`
    : '0%';
  const remainingText = Number(rowValue.remainingBlocks || 0) <= 0
    ? 'Up to date'
    : `${formatBlockCount(rowValue.remainingBlocks)} blocks remaining`;
  const scannedText = rowValue.latestBlock != null
    ? `${formatBlockCount(rowValue.displayLastBlock)} / ${formatBlockCount(rowValue.latestBlock)} scanned`
    : '';
  const indeterminateText = showScannedText !== false
    ? `${formatBlockCount(rowValue.lastBlockScanned)} scanned`
    : 'Syncing... latest block pending';

  return {
    indeterminateText,
    progressFillStyle: { width: progressWidth },
    progressWidth,
    remainingText,
    rowKey: `${rowValue.slug || 'general'}_${rowValue.chainId || 'na'}_${index}`,
    scannedText,
    shouldRenderScannedText: showScannedText !== false && !!scannedText,
  };
};

export const buildUserPageDeepScanProgressRow = ({
  chainId = null,
  lastBlock = 0,
  latestBlock = null,
  sessionConfig = null,
  slug = 'general',
  slugHasMultipleNetworks = false,
  startBlock = null,
}: BuildUserPageDeepScanProgressRowArgs = {}): UserPageDeepScanProgressRow => {
  const slugValue = String(slug || 'general');
  const slugLabel = normalizeSessionSlug(slugValue || '') || 'general';
  const sessionRecord = toAnalysisRecord(sessionConfig);
  const sessionName = String(sessionRecord.sessionName || '').trim();
  const baseLabel = sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
    ? `${sessionName} (${slugLabel})`
    : (sessionName || slugValue || 'General');
  const label = slugHasMultipleNetworks && chainId != null
    ? `${baseLabel} (chain ${chainId})`
    : baseLabel;
  const normalizedLatestBlock = latestBlock != null
    ? Math.max(0, Math.floor(Number(latestBlock)))
    : null;
  const lastBlockScanned = Math.max(0, Math.floor(Number(lastBlock)));
  const displayLastBlock = startBlock != null
    ? Math.max(startBlock, lastBlockScanned)
    : lastBlockScanned;
  const remainingBlocks = normalizedLatestBlock != null
    ? Math.max(0, normalizedLatestBlock - displayLastBlock)
    : null;
  let percentComplete: number | null = null;
  let isDeterminate = false;

  if (normalizedLatestBlock != null && startBlock != null) {
    const totalSpan = Math.max(0, normalizedLatestBlock - startBlock);
    const completedSpan = Math.max(0, displayLastBlock - startBlock);
    percentComplete = totalSpan <= 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((completedSpan / totalSpan) * 100)));
    isDeterminate = true;
  }

  return {
    slug: slugValue,
    chainId,
    lastBlockScanned,
    latestBlock: normalizedLatestBlock,
    remainingBlocks,
    percentComplete,
    isDeterminate,
    label,
    startBlock,
    displayLastBlock,
  };
};

export const buildUserPageDeepScanReportSignature = ({
  report = {},
  reportTargetLower = '',
}: BuildUserPageDeepScanReportSignatureArgs = {}): string => {
  const scanReport = toAnalysisRecord(report);
  const readSlugList = (key: string): string => (
    Array.isArray(scanReport[key]) ? (scanReport[key] as unknown[]).join(',') : ''
  );
  const coverageComplete = Object.prototype.hasOwnProperty.call(scanReport, 'coverageComplete')
    ? String(scanReport.coverageComplete === true ? 1 : 0)
    : '';
  return [
    String(reportTargetLower || ''),
    String(scanReport.hadRpcErrors ? 1 : 0),
    String(scanReport.coverageReason || ''),
    coverageComplete,
    readSlugList('attemptedSlugs'),
    readSlugList('scannedSlugs'),
    readSlugList('skippedSlugs'),
    readSlugList('failedSlugs'),
    readSlugList('failedActivitySlugs'),
  ].join('|');
};

export const buildUserPageDeepScanReportStatus = ({
  report = {},
}: BuildUserPageDeepScanReportStatusArgs = {}): UserPageDeepScanReportStatus => {
  const reportRecord = toAnalysisRecord(report);
  const attemptedSlugs = Array.isArray(reportRecord.attemptedSlugs) ? [...reportRecord.attemptedSlugs] : [];
  const scannedSlugs = Array.isArray(reportRecord.scannedSlugs) ? [...reportRecord.scannedSlugs] : [];
  const skippedSlugs = Array.isArray(reportRecord.skippedSlugs) ? [...reportRecord.skippedSlugs] : [];
  const failedSlugs = Array.isArray(reportRecord.failedSlugs) ? [...reportRecord.failedSlugs] : [];
  const failedActivitySlugs = Array.isArray(reportRecord.failedActivitySlugs) ? [...reportRecord.failedActivitySlugs] : [];
  const rawHadRpcErrors = !!reportRecord.hadRpcErrors;
  const totalActivityFailure = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    failedActivitySlugs.length >= attemptedSlugs.length
  );
  const totalSbtFailure = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    failedSlugs.length >= attemptedSlugs.length
  );
  const totalSkippedScan = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    skippedSlugs.length >= attemptedSlugs.length
  );
  const hasCoverageGap = Object.prototype.hasOwnProperty.call(reportRecord, 'coverageComplete')
    ? reportRecord.coverageComplete === false
    : false;
  const hasPartialRpcFailureEvidence = !!(
    rawHadRpcErrors &&
    !totalActivityFailure &&
    !totalSbtFailure &&
    !totalSkippedScan &&
    (
      failedSlugs.length > 0 ||
      failedActivitySlugs.length > 0 ||
      (attemptedSlugs.length > 0 && scannedSlugs.length < attemptedSlugs.length)
    )
  );
  const hasPartialSbtFailureEvidence = !!(
    rawHadRpcErrors &&
    failedSlugs.length > 0 &&
    !totalSbtFailure &&
    !totalSkippedScan
  );
  const hasUncertainUserData = !!(
    hasCoverageGap ||
    totalActivityFailure ||
    totalSbtFailure ||
    totalSkippedScan ||
    hasPartialRpcFailureEvidence
  );
  const hasUncertainSbtData = !!(
    totalSbtFailure ||
    totalSkippedScan ||
    hasPartialSbtFailureEvidence ||
    (hasCoverageGap && !totalActivityFailure && !totalSbtFailure && !totalSkippedScan)
  );

  return {
    attemptedSlugs,
    scannedSlugs,
    skippedSlugs,
    failedSlugs,
    failedActivitySlugs,
    rawHadRpcErrors,
    totalActivityFailure,
    totalSbtFailure,
    totalSkippedScan,
    hasCoverageGap,
    hasUncertainUserData,
    hasUncertainSbtData,
  };
};

export const buildUserPageDeepScanReportTelemetryPayloads = ({
  report = {},
  status = null,
  viewAddress = '',
}: BuildUserPageDeepScanReportTelemetryPayloadsArgs = {}): UserPageDeepScanReportTelemetryPayloads => {
  const reportRecord = toAnalysisRecord(report);
  const reportStatus = (status && typeof status === 'object')
    ? status as Partial<UserPageDeepScanReportStatus>
    : buildUserPageDeepScanReportStatus({ report: reportRecord });
  const attemptedSlugs = Array.isArray(reportStatus.attemptedSlugs) ? reportStatus.attemptedSlugs : [];
  const scannedSlugs = Array.isArray(reportStatus.scannedSlugs) ? reportStatus.scannedSlugs : [];
  const skippedSlugs = Array.isArray(reportStatus.skippedSlugs) ? reportStatus.skippedSlugs : [];
  const failedSlugs = Array.isArray(reportStatus.failedSlugs) ? reportStatus.failedSlugs : [];
  const failedActivitySlugs = Array.isArray(reportStatus.failedActivitySlugs)
    ? reportStatus.failedActivitySlugs
    : [];
  const rawHadRpcErrors = !!reportStatus.rawHadRpcErrors;
  const totalActivityFailure = !!reportStatus.totalActivityFailure;
  const totalSbtFailure = !!reportStatus.totalSbtFailure;
  const totalSkippedScan = !!reportStatus.totalSkippedScan;
  const hasCoverageGap = !!reportStatus.hasCoverageGap;
  const hasUncertainUserData = !!reportStatus.hasUncertainUserData;
  const hasUncertainSbtData = !!reportStatus.hasUncertainSbtData;
  const viewAddressLower = String(viewAddress || '').toLowerCase();

  return {
    coldDiagPayload: {
      viewAddress: viewAddressLower,
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
      anyNewData: !!reportRecord.anyNewData,
      coverageComplete: reportRecord.coverageComplete,
      coverageReason: reportRecord.coverageReason,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure,
      totalSbtFailure,
      totalSkippedScan,
      hasCoverageGap,
      totalSbtContractsFound: reportRecord.totalSbtContractsFound,
      totalCreatedSurveysFound: reportRecord.totalCreatedSurveysFound,
      totalCreatedQuestionsFound: reportRecord.totalCreatedQuestionsFound,
      totalSurveyResponsesFound: reportRecord.totalSurveyResponsesFound,
      totalQuestionResponsesFound: reportRecord.totalQuestionResponsesFound,
    },
    telemetryPayload: {
      viewAddress: viewAddressLower,
      hadRpcErrors: rawHadRpcErrors,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure,
      totalSbtFailure,
      totalSkippedScan,
      usedAllSessions: !!reportRecord.usedAllSessions,
      coverageComplete: Object.prototype.hasOwnProperty.call(reportRecord, 'coverageComplete')
        ? !!reportRecord.coverageComplete
        : null,
      coverageReason: String(reportRecord.coverageReason || ''),
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
      registryEntryCount: Number(reportRecord.registryEntryCount || 0),
      anyNewData: !!reportRecord.anyNewData,
      totalSbtContractsFound: Number(reportRecord.totalSbtContractsFound || 0),
      totalCreatedSurveysFound: Number(reportRecord.totalCreatedSurveysFound || 0),
      totalCreatedQuestionsFound: Number(reportRecord.totalCreatedQuestionsFound || 0),
      totalSurveyResponsesFound: Number(reportRecord.totalSurveyResponsesFound || 0),
      totalQuestionResponsesFound: Number(reportRecord.totalQuestionResponsesFound || 0),
      ...buildUserPageDeepScanReportSamples({ report: reportRecord }),
    },
  };
};

export const buildUserPageDeepScanRequestStatePatch = (): UserPageUnknownRecord => ({
  isDeepScanning: true,
  hasUncertainUserData: false,
  hasUncertainSbtData: false,
  hasUncertainGateAccess: false,
});

export const buildUserPageDeepScanReportStatePatch = ({
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
}: BuildUserPageDeepScanReportStatePatchArgs = {}): UserPageUnknownRecord => ({
  isDeepScanning: false,
  hasUncertainUserData: !!hasUncertainUserData,
  hasUncertainSbtData: !!hasUncertainSbtData,
  hasUncertainGateAccess: false,
});

export const shouldApplyUserPageDeepScanResponse = ({
  activeRequestSeq = null,
  currentViewAddress = '',
  isMounted = false,
  requestSeq = null,
  targetLower = '',
}: ShouldApplyUserPageDeepScanResponseArgs = {}): boolean => {
  if (!isMounted || requestSeq !== activeRequestSeq) return false;
  const currentViewLower = String(currentViewAddress || '').toLowerCase();
  if (!currentViewLower || currentViewLower !== String(targetLower || '')) return false;
  return true;
};

export const buildUserPageDeepScanReportSamples = ({
  limit = 12,
  report = {},
}: BuildUserPageDeepScanReportSamplesArgs = {}): UserPageDeepScanReportSamples => {
  const reportRecord = toAnalysisRecord(report);
  const sampleLimit = Math.max(0, Math.floor(Number(limit || 0)) || 0);
  const readSample = (key: string): unknown[] => (
    Array.isArray(reportRecord[key])
      ? (reportRecord[key] as unknown[]).slice(0, sampleLimit)
      : []
  );
  return {
    sampleSbtAddresses: readSample('sampleSbtAddresses'),
    sampleCreatedSurveyIds: readSample('sampleCreatedSurveyIds'),
    sampleCreatedQuestionIds: readSample('sampleCreatedQuestionIds'),
    sampleSurveyResponseIds: readSample('sampleSurveyResponseIds'),
    sampleQuestionResponseIds: readSample('sampleQuestionResponseIds'),
  };
};

export const sortUserPageDeepScanProgressRows = (
  rows: UserPageDeepScanProgressRow[] | null | undefined,
  prioritySlugs: unknown = []
): UserPageDeepScanProgressRow[] | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const priorityBySlug = new Map<string, number>();
  (Array.isArray(prioritySlugs) ? prioritySlugs : []).forEach((slug, index) => {
    priorityBySlug.set(normalizeSessionSlug(slug || ''), index);
  });

  return rows
    .map<UserPageDeepScanProgressSortableRow>((row, index) => ({ ...row, __sourceIndex: index }))
    .sort((left, right) => {
      const leftSlug = normalizeSessionSlug(left?.slug || '');
      const rightSlug = normalizeSessionSlug(right?.slug || '');
      const leftPriority = priorityBySlug.get(leftSlug) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityBySlug.get(rightSlug) ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftNeedsAttention = left?.latestBlock == null || Number(left?.remainingBlocks || 0) > 0;
      const rightNeedsAttention = right?.latestBlock == null || Number(right?.remainingBlocks || 0) > 0;
      if (leftNeedsAttention !== rightNeedsAttention) {
        return leftNeedsAttention ? -1 : 1;
      }

      const leftLastBlock = Number(left?.lastBlockScanned || 0);
      const rightLastBlock = Number(right?.lastBlockScanned || 0);
      if (rightLastBlock !== leftLastBlock) return rightLastBlock - leftLastBlock;

      const leftLabel = String(left?.label || leftSlug || '');
      const rightLabel = String(right?.label || rightSlug || '');
      const labelCmp = leftLabel.localeCompare(rightLabel);
      if (labelCmp !== 0) return labelCmp;

      const leftChain = Number(left?.chainId || 0);
      const rightChain = Number(right?.chainId || 0);
      if (leftChain !== rightChain) return leftChain - rightChain;

      return Number(left.__sourceIndex || 0) - Number(right.__sourceIndex || 0);
    })
    .map(({ __sourceIndex, ...row }) => row);
};

export const deriveUserPageDeepScanProgressRows = ({
  currentChainId = null,
  getSessionDisplayConfig = null,
  latestBlockNum = null,
  prioritySlugs = [],
  userCaches = [],
  viewLower = '',
}: DeriveUserPageDeepScanProgressRowsArgs = {}): UserPageDeepScanProgressRow[] | null => {
  const viewAddressLower = String(viewLower || '').toLowerCase();
  if (!Array.isArray(userCaches) || userCaches.length === 0 || !viewAddressLower) return null;

  const currentChainNumeric = currentChainId != null && Number.isFinite(Number(currentChainId))
    ? Number(currentChainId)
    : null;
  const latestBlockNumeric = latestBlockNum != null && Number.isFinite(Number(latestBlockNum))
    ? Number(latestBlockNum)
    : null;
  const readSessionDisplayConfig = typeof getSessionDisplayConfig === 'function'
    ? getSessionDisplayConfig
    : (() => null);
  const entries: UserPageDeepScanProgressEntry[] = [];
  const sessionConfigMemo = new Map<string, unknown | null>();

  userCaches.forEach((entry: unknown) => {
    const source = toAnalysisRecord(entry);
    const slug = source.slug;
    const data = toAnalysisRecord(source.data);
    const userNode = toAnalysisRecord(data[viewAddressLower]);
    if (!Object.keys(userNode).length) return;
    Object.keys(userNode).forEach((netKey) => {
      const chainEntry = toAnalysisRecord(userNode?.[netKey]);
      const lastBlock = Number(chainEntry?.lastBlockScanned);
      if (!Number.isFinite(lastBlock) || lastBlock <= 0) return;

      let latestForPct: number | null = null;
      if (
        latestBlockNumeric != null &&
        currentChainNumeric != null &&
        Number(netKey) === Number(currentChainNumeric) &&
        latestBlockNumeric > 0
      ) {
        latestForPct = latestBlockNumeric;
      }

      const normalizedSlug = normalizeSessionSlug(slug || '');
      const sessionMemoKey = normalizedSlug || '__general__';
      let sessionConfig: unknown | null = null;
      if (sessionConfigMemo.has(sessionMemoKey)) {
        sessionConfig = sessionConfigMemo.get(sessionMemoKey) || null;
      } else {
        sessionConfig = readSessionDisplayConfig(normalizedSlug);
        sessionConfigMemo.set(sessionMemoKey, sessionConfig);
      }

      const blockLimits = toAnalysisRecord(toAnalysisRecord(sessionConfig).blockLimits);
      const startRaw = Number(blockLimits.start);
      const startBlock = Number.isFinite(startRaw) && startRaw > 0
        ? Math.floor(startRaw)
        : null;

      entries.push({
        slug: String(slug || 'general'),
        chainId: Number.isFinite(Number(netKey)) ? Number(netKey) : null,
        lastBlock,
        latestBlock: latestForPct,
        startBlock,
        sessionConfig,
      });
    });
  });

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.lastBlock - a.lastBlock);
  const slugCounts = entries.reduce<Map<string, number>>((counts, entry) => {
    counts.set(entry.slug, (counts.get(entry.slug) || 0) + 1);
    return counts;
  }, new Map());
  const rows = entries.map<UserPageDeepScanProgressRow>((entry) => {
    const slugHasMultipleNetworks = (slugCounts.get(entry.slug) || 0) > 1;
    return buildUserPageDeepScanProgressRow({
      slug: entry.slug,
      chainId: entry.chainId,
      lastBlock: entry.lastBlock,
      latestBlock: entry.latestBlock,
      sessionConfig: entry.sessionConfig,
      slugHasMultipleNetworks,
      startBlock: entry.startBlock,
    });
  });
  return sortUserPageDeepScanProgressRows(rows, prioritySlugs);
};

export const formatUserPageDeepScanTooltipLinesFromRows = (
  rows: UserPageDeepScanProgressRow[] | null | undefined,
  formatBlockCount: (value: unknown) => string = formatUserPageDeepScanBlockCount
): string[] | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const lines: string[] = [];
  rows.forEach((row, index) => {
    lines.push(`Session: ${row.label}`);
    if (row.latestBlock != null) {
      if (Number(row.remainingBlocks || 0) <= 100) {
        lines.push('Up to date');
      } else {
        lines.push(`${formatBlockCount(row.remainingBlocks)} blocks remaining`);
      }
    } else {
      lines.push(`${formatBlockCount(row.lastBlockScanned)} scanned`);
    }
    if (index < rows.length - 1) lines.push('');
  });
  return lines;
};

export const buildUserPageDeepScanTooltipDisplayState = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  fallbackLine = 'Deep scan in progress...',
  isDeepScanning = false,
}: BuildUserPageDeepScanTooltipDisplayStateArgs = {}): UserPageDeepScanTooltipDisplayState => {
  const deepScanTooltipContent =
    isDeepScanning ||
    (Array.isArray(deepScanTooltipLines) && deepScanTooltipLines.length > 0) ||
    (Array.isArray(deepScanProgressRows) && deepScanProgressRows.length > 0)
      ? (deepScanTooltipLines || [fallbackLine])
      : null;
  const deepScanTooltipText = Array.isArray(deepScanTooltipContent)
    ? deepScanTooltipContent
      .filter((line: string) => line && line.trim().length > 0)
      .join(' | ')
    : '';
  const deepScanTooltipTitle = deepScanTooltipText
    ? `Deep scan: ${deepScanTooltipText}`
    : '';

  return {
    deepScanTooltipContent,
    deepScanTooltipText,
    deepScanTooltipTitle,
  };
};

export const buildUserPageDeepScanRefreshCarryPatch = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  prevState = null,
}: BuildUserPageDeepScanRefreshCarryPatchArgs = {}): UserPageDeepScanRefreshCarryPatch => {
  const prev = isPlainAnalysisObject(prevState) ? prevState : {};
  const patch: UserPageDeepScanRefreshCarryPatch = {};
  if (
    deepScanTooltipLines != null ||
    (Array.isArray(prev.deepScanTooltipLines) && prev.deepScanTooltipLines.length > 0)
  ) {
    patch.deepScanTooltipLines = deepScanTooltipLines;
  }
  if (
    deepScanProgressRows != null ||
    (Array.isArray(prev.deepScanProgressRows) && prev.deepScanProgressRows.length > 0)
  ) {
    patch.deepScanProgressRows = deepScanProgressRows;
  }
  return patch;
};

export const buildUserPageDeepScanProgressRowsSignature = (
  rows: UserPageDeepScanProgressRow[] | null | undefined
): string => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .map((row) => [
      String(row?.slug || ''),
      String(row?.chainId ?? ''),
      String(row?.lastBlockScanned ?? ''),
      String(row?.latestBlock ?? ''),
      String(row?.remainingBlocks ?? ''),
      String(row?.percentComplete ?? ''),
      row?.isDeterminate ? '1' : '0',
      String(row?.label || ''),
    ].join(':'))
    .join('|');
};

export const buildUserPageDeepScanTooltipOutputSignature = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
}: BuildUserPageDeepScanTooltipOutputSignatureArgs = {}): string => (
  [
    Array.isArray(deepScanTooltipLines)
      ? deepScanTooltipLines.join('|')
      : '',
    buildUserPageDeepScanProgressRowsSignature(
      Array.isArray(deepScanProgressRows)
        ? deepScanProgressRows as UserPageDeepScanProgressRow[]
        : null
    ),
  ].join('||')
);

export const resolveUserPageDeepScanProgressStateUpdate = ({
  currentDeepScanProgressRows = null,
  currentDeepScanTooltipLines = null,
  nextDeepScanProgressRows = null,
  nextDeepScanTooltipLines = null,
}: ResolveUserPageDeepScanProgressStateUpdateArgs = {}): UserPageDeepScanProgressStateUpdate => {
  const previousSignature = buildUserPageDeepScanTooltipOutputSignature({
    deepScanProgressRows: currentDeepScanProgressRows,
    deepScanTooltipLines: currentDeepScanTooltipLines,
  });
  const nextOutputSignature = buildUserPageDeepScanTooltipOutputSignature({
    deepScanProgressRows: nextDeepScanProgressRows,
    deepScanTooltipLines: nextDeepScanTooltipLines,
  });
  return {
    nextOutputSignature,
    shouldUpdate: previousSignature !== nextOutputSignature,
  };
};

export const buildUserPageDeepScanProgressStatePatch = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  now = Date.now(),
}: BuildUserPageDeepScanProgressStatePatchArgs = {}): UserPageUnknownRecord => ({
  deepScanProgressTick: Number(now || 0),
  deepScanTooltipLines: deepScanTooltipLines || null,
  deepScanProgressRows: deepScanProgressRows || null,
});

export const normalizeUserPageDeepScanTooltipLines = (lines: unknown): string[] | null => {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return lines.map((line: unknown) => String(line));
};

export const normalizeUserPageDeepScanProgressRows = (
  rows: unknown
): UserPageDeepScanProgressRow[] | null => (
  Array.isArray(rows) && rows.length > 0
    ? rows as UserPageDeepScanProgressRow[]
    : null
);
