import { ethers } from 'ethers';
import type { AppShell } from './AppShell';
import type { MainSiteState } from './MainSiteTypes';
import { chainScanReadsPort } from '../../domains/chain/chainScanReadsPort.js';
import { profileScanPort } from '../../domains/profiles/profileScanPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/sbtMetadataReadsPort.js';
import { surveyReadsPort } from '../../domains/surveys/surveyChainReadsPort.js';
import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from '../../domains/surveys/questionArweaveCacheBranches.js';
import { normalizeSessionSlug } from '../../domains/sessions/sessionConfig.js';
import {
  createInitialProfileScanReport,
  createProfileScanFanoutPlan,
  resolveProfileScanAttemptedCoverageSlugs,
} from '../../utilities/session/profileScanReportHelpers.js';
import { createLogger } from 'utilities/logging.js';
import { updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import { mergeSbtActivityCacheEntryMetadata } from '../../utilities/sbt/sbtActivityCacheEntry.js';
import {
  buildMainSiteProfileQuestionResponseKey,
  buildMainSiteProfileSurveyResponseKey,
  mergeMainSiteProfileRows,
  mergeMainSiteProfileUserCache,
} from './mainSiteProfileCacheMerge.js';

type MainSiteProfileScanHost = AppShell;
type MainSiteMutableMetadata = Record<string, unknown> & {
  id?: string;
  slug?: string;
  sessionSlug?: string;
  surveyID?: string;
};
type MainSiteProfileScanReport = {
  targetAddress: string;
  usedAllSessions: boolean;
  useAllSessionsSbtScan: boolean;
  useAllSessionsSurveyActivityScan: boolean;
  useAllSessionsQuestionActivityScan: boolean;
  useAllSessionsActivityScan: boolean;
  listScopeSbtFanout: boolean;
  listScopeSurveyActivityFanout: boolean;
  listScopeQuestionActivityFanout: boolean;
  attemptedSlugs: string[];
  scannedSlugs: string[];
  skippedSlugs: string[];
  skippedSlugReasons: Record<string, string>;
  failedSlugs: string[];
  failedActivitySlugs: string[];
  allActivityFailed: boolean;
  allSbtFailed: boolean;
  hadRpcErrors: boolean;
  anyNewData: boolean;
  coverageComplete: boolean;
  coverageReason: string;
  registryEntryCount: number;
  hadLoadErrors: boolean;
  rawAllSlugCount: number;
  activeChainSlugCount: number;
  scopedFallbackSlugCount: number;
  relevantSlugs: string[];
  prioritizedGeneralFirst: boolean;
  scanOrdering: string;
  slugFetchTimeoutMs: number;
  sbtFetchTimeoutMs: number;
  activityFetchTimeoutMs: number;
  activityLookbackBlocks: number;
  sbtBurstSize: number;
  totalSbtContractsFound: number;
  totalCreatedSurveysFound: number;
  totalCreatedQuestionsFound: number;
  totalSurveyResponsesFound: number;
  totalQuestionResponsesFound: number;
  sampleSbtAddresses: string[];
  sampleCreatedSurveyIds: string[];
  sampleCreatedQuestionIds: string[];
  sampleSurveyResponseIds: string[];
  sampleQuestionResponseIds: string[];
};
type MainSiteProfileActivityEntry = Record<string, unknown> & {
  id?: string;
  surveyId?: string;
  surveyID?: string;
  questionId?: string;
  questionID?: string;
  responder?: string;
  response?: unknown;
  data?: MainSiteMutableMetadata | null;
  blockNumber?: unknown;
  transactionIndex?: unknown;
  txIndex?: unknown;
  logIndex?: unknown;
  timestamp?: unknown;
  bn?: unknown;
  txi?: unknown;
  li?: unknown;
  ts?: unknown;
};
type MainSiteProfileActivityPayload = {
  createdSurveys: MainSiteProfileActivityEntry[];
  createdQuestions: MainSiteProfileActivityEntry[];
  surveyResponses: MainSiteProfileActivityEntry[];
  questionResponses: MainSiteProfileActivityEntry[];
};
type MainSiteProfileMetaResult<T> = {
  data: T;
  hadError: boolean;
  error?: string;
};
type MainSiteProfileUserChainData = MainSiteProfileActivityPayload & {
  sbts: MainSiteProfileScanSbt[];
};
type MainSiteProfileUserChainEntry = {
  data?: MainSiteProfileUserChainData;
  lastBlockScanned?: number;
  lastScanTimestamp?: number;
  scanIncomplete?: boolean;
  surveyActivityLastBlockScanned?: number;
  surveyActivityScanIncomplete?: boolean;
  questionActivityLastBlockScanned?: number;
  questionActivityScanIncomplete?: boolean;
  sbtLastBlockScanned?: number;
  sbtScanIncomplete?: boolean;
  sbtBackfillComplete?: boolean;
  [key: string]: unknown;
};
type MainSiteProfileUserCache = Record<string, Record<string, MainSiteProfileUserChainEntry>>;
type MainSiteProfileActivityWindow = {
  fromBlock: number;
  shouldForceBackfill: boolean;
};
type MainSiteProfileTimeoutOutcome<T = unknown> = {
  timedOut: boolean;
  value?: T | null;
  error?: unknown;
};
type MainSiteProfileBackfillTimeoutOptions = {
  spanStepBlocks?: unknown;
  floorTimeoutMs?: unknown;
  timeoutCapMs?: unknown;
};
type MainSiteProfileScanSbt = Record<string, unknown> & {
  sbtAddress?: string;
  sbtInfo?: Record<string, unknown>;
};
type MainSiteSbtCacheEntry = MainSiteMutableMetadata & {
  sbtAddress?: string;
  sbtInfo?: Record<string, unknown> | null;
  mintedAddresses?: string[];
  blockNumber?: number | null;
};
type MainSiteSbtMetadataCache = Record<string, MainSiteSbtNetworkCache | undefined>;
type MainSiteSbtNetworkCache = {
  sbtList: Record<string, MainSiteSbtCacheEntry>;
  lastBlock?: number;
  [key: string]: unknown;
};
type MainSiteSurveyMetadataCache = Record<string, MainSiteSurveyNetworkCache | undefined>;
type MainSiteSurveyNetworkCache = {
  surveys: Record<string, MainSiteMutableMetadata>;
  surveyResponses: Record<string, Record<string, Record<string, unknown>>>;
  surveyResponsesLatestBlock?: Record<string, unknown>;
  [key: string]: unknown;
};
type MainSiteQuestionResponseMeta = {
  bn?: number;
  blockNumber?: number;
  txi?: number;
  transactionIndex?: number;
  txIndex?: number;
  li?: number;
  logIndex?: number;
  ts?: number;
  timestamp?: number;
};
type MainSiteQuestionMetadataCache = Record<string, MainSiteQuestionNetworkCache | undefined>;
type MainSiteQuestionNetworkCache = {
  questions: Record<string, MainSiteMutableMetadata>;
  questionResponses: Record<string, Record<string, Record<string, unknown>>>;
  questionResponsesMeta: Record<string, Record<string, MainSiteQuestionResponseMeta>>;
  arweaveTxCache?: Record<string, unknown>;
  arweaveTxFailureCache?: Record<string, unknown>;
  [key: string]: unknown;
};
const mainSiteLog = createLogger('mainSite');

const isMainSitePresent = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const readMainSiteErrorMessage = (error: unknown): unknown => (error instanceof Error ? error.message : error);

const isMainSiteProfilePersistenceFailure = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { cachePersistenceFailed?: unknown }).cachePersistenceFailed === true;

const persistMainSiteProfileCacheAtomic = async <TValue,>(
  namespace: 'sbtCache' | 'userCache',
  slug: string,
  updater: (current: TValue | null) => TValue | Promise<TValue>,
): Promise<TValue> => {
  try {
    const persisted = await updateCacheAtomic<TValue>(namespace, slug, updater);
    if (persisted === null) throw new Error(`managed ${namespace} namespace unavailable`);
    return persisted;
  } catch (error) {
    const failure = new Error(
      `Failed to persist ${namespace} for ${slug}: ${error instanceof Error ? error.message : String(error)}`,
    ) as Error & { cachePersistenceFailed?: boolean };
    failure.cachePersistenceFailed = true;
    throw failure;
  }
};

const getMainSiteRuntimeGlobal = () =>
  globalThis as typeof globalThis & { __CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__?: unknown };

const isMainSiteProfileMetaResult = <T>(value: unknown): value is MainSiteProfileMetaResult<T> =>
  !!value &&
  typeof value === 'object' &&
  (Object.prototype.hasOwnProperty.call(value, 'hadError') || Object.prototype.hasOwnProperty.call(value, 'data'));

export const runMainSiteScanSpecificUserProfile = async (
  host: MainSiteProfileScanHost,
  targetAddress: unknown,
): Promise<MainSiteProfileScanReport | null> => {
  const target = String(targetAddress || '');
  if (!target || !ethers.utils.isAddress(target)) return null;

  const targetLower = target.toLowerCase();
  if (host._scanSpecificUserProfileInFlight.has(targetLower)) {
    return host._scanSpecificUserProfileInFlight.get(targetLower) || null;
  }

  const run = (async () => {
    const allSessionsMode = host.getUserProfileAllSessionsScanMode();
    const scopeContext = host.getProfileScanScopeContext();
    const fanoutPlan = createProfileScanFanoutPlan({
      scopeContext,
      allSessionsMode,
    });
    const {
      isListScope,
      allowListScopeSbtFanout,
      allowListScopeSurveyActivityFanout,
      allowListScopeQuestionActivityFanout,
      useAllSessionsScan,
      shouldHydrateRegistry,
    } = fanoutPlan;
    const registryStatus = shouldHydrateRegistry
      ? await host.ensureRegistryHydratedForProfileScan({
          forceAllChains: isListScope,
        })
      : null;
    const profileScanPlan = host.resolveProfileDeepScanPlan({
      registryStatus,
      useAllSessionsScan,
    });
    const allSlugs = profileScanPlan.slugs;
    const { attemptedCoverageSlugs, attemptedCoverageSlugSet } = resolveProfileScanAttemptedCoverageSlugs({
      fanoutPlan,
      scopeContext,
      allSlugs,
    });
    host.emitProfileScanColdDiag('plan', {
      targetAddress: targetLower,
      scope: scopeContext.scope,
      scopeList: scopeContext.list,
      isListScope,
      allowListScopeSbtFanout,
      allowListScopeSurveyActivityFanout,
      allowListScopeQuestionActivityFanout,
      useAllSessionsScan,
      shouldHydrateRegistry,
      registryStatus,
      slugCount: allSlugs.length,
      slugs: allSlugs.slice(0, 10),
      coverageComplete: profileScanPlan.coverageComplete,
      coverageReason: profileScanPlan.coverageReason,
      scanOrdering: profileScanPlan.scanOrdering,
    });
    const sbtFetchTimeoutMs = host.readProfileScanStepTimeoutMs('sbt');
    const activityFetchTimeoutMs = host.readProfileScanStepTimeoutMs('activity');
    const slugFetchTimeoutMs = Math.max(sbtFetchTimeoutMs, activityFetchTimeoutMs);
    const sbtBurstSize = host.readProfileScanSbtBurstSize();
    const activityLookbackBlocks = host.readProfileScanActivityLookbackBlocks({
      useAllSessions: !!allSessionsMode.useAllSessionsActivityScan,
    });
    const report = createInitialProfileScanReport({
      targetLower,
      profileScanPlan,
      allSessionsMode,
      fanoutPlan,
      attemptedCoverageSlugs,
      slugFetchTimeoutMs,
      sbtFetchTimeoutMs,
      activityFetchTimeoutMs,
      activityLookbackBlocks,
      sbtBurstSize,
    }) as MainSiteProfileScanReport;
    host.emitProfileScanTelemetry('scan-start', {
      targetAddress: targetLower,
      usedAllSessions: report.usedAllSessions,
      useAllSessionsSbtScan: report.useAllSessionsSbtScan,
      useAllSessionsSurveyActivityScan: report.useAllSessionsSurveyActivityScan,
      useAllSessionsQuestionActivityScan: report.useAllSessionsQuestionActivityScan,
      useAllSessionsActivityScan: report.useAllSessionsActivityScan,
      listScopeSbtFanout: report.listScopeSbtFanout,
      listScopeSurveyActivityFanout: report.listScopeSurveyActivityFanout,
      listScopeQuestionActivityFanout: report.listScopeQuestionActivityFanout,
      coverageComplete: report.coverageComplete,
      coverageReason: report.coverageReason,
      hadLoadErrors: report.hadLoadErrors,
      registryStatus: registryStatus || null,
      attemptedSlugs: [...report.attemptedSlugs],
      rawAllSlugCount: report.rawAllSlugCount,
      activeChainSlugCount: report.activeChainSlugCount,
      scopedFallbackSlugCount: report.scopedFallbackSlugCount,
      relevantSlugs: [...report.relevantSlugs],
      prioritizedGeneralFirst: report.prioritizedGeneralFirst,
      scanOrdering: report.scanOrdering,
      slugFetchTimeoutMs: report.slugFetchTimeoutMs,
      sbtFetchTimeoutMs: report.sbtFetchTimeoutMs,
      activityFetchTimeoutMs: report.activityFetchTimeoutMs,
      activityLookbackBlocks: report.activityLookbackBlocks,
      sbtBurstSize: report.sbtBurstSize,
    });
    if (report.coverageComplete === false) {
      host.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
    }

    const pushUnique = (list: string[], value: unknown) => {
      if (!Array.isArray(list)) return;
      const token = String(value || '');
      if (!token) return;
      if (!list.includes(token)) list.push(token);
    };
    const pushUniqueSample = (list: string[], value: unknown, max = 12) => {
      if (!Array.isArray(list)) return;
      const token = String(value || '')
        .trim()
        .toLowerCase();
      if (!token || list.includes(token)) return;
      if (list.length >= Math.max(1, Number(max) || 1)) return;
      list.push(token);
    };
    const normalizeEventIdentifier = (raw: unknown) =>
      String(raw || '')
        .trim()
        .toLowerCase();
    const readCreatedSurveyId = (item: MainSiteProfileActivityEntry = {}) =>
      normalizeEventIdentifier(item?.id || item?.surveyId || item?.surveyID);
    const readCreatedQuestionId = (item: MainSiteProfileActivityEntry = {}) =>
      normalizeEventIdentifier(item?.id || item?.questionId || item?.questionID);
    const readSurveyResponseId = (item: MainSiteProfileActivityEntry = {}) =>
      normalizeEventIdentifier(item?.surveyId || item?.surveyID || item?.id);
    const readQuestionResponseId = (item: MainSiteProfileActivityEntry = {}) =>
      normalizeEventIdentifier(item?.questionId || item?.questionID || item?.id);
    const skippedSlugReasons: Record<string, string> = {};

    const markSlugSkipped = (slug: string, reason: string, extra: Record<string, unknown> = {}) => {
      pushUnique(report.skippedSlugs, slug);
      skippedSlugReasons[String(slug || '')] = String(reason || 'invalid-config');
      report.skippedSlugReasons = { ...skippedSlugReasons };
      host.emitProfileScanTelemetry('slug-skip-invalid-config', {
        targetAddress: targetLower,
        slug,
        reason: String(reason || 'invalid-config'),
        ...(extra && typeof extra === 'object' ? extra : {}),
      });
    };

    const normalizeActivityPayload = (raw: unknown): MainSiteProfileActivityPayload => {
      const payload = raw && typeof raw === 'object' ? raw : {};
      return {
        createdSurveys: Array.isArray((payload as MainSiteProfileActivityPayload).createdSurveys)
          ? (payload as MainSiteProfileActivityPayload).createdSurveys
          : [],
        createdQuestions: Array.isArray((payload as MainSiteProfileActivityPayload).createdQuestions)
          ? (payload as MainSiteProfileActivityPayload).createdQuestions
          : [],
        surveyResponses: Array.isArray((payload as MainSiteProfileActivityPayload).surveyResponses)
          ? (payload as MainSiteProfileActivityPayload).surveyResponses
          : [],
        questionResponses: Array.isArray((payload as MainSiteProfileActivityPayload).questionResponses)
          ? (payload as MainSiteProfileActivityPayload).questionResponses
          : [],
      };
    };

    mainSiteLog.log(`[DeepSearch] Starting cross-group scan for user: ${targetLower}`, {
      usedAllSessions: report.usedAllSessions,
      slugCount: allSlugs.length,
    });

    let newDataWritten = false; // track whether anything new was written to caches
    let hadPersistenceFailure = false;

    const scanOneSlug = async (slug: string) => {
      const slugStartedAt = Date.now();
      try {
        let resolvedRegistrySessionCfg = null;
        let chainId = host.getSessionChainId(slug);
        if (!chainId && isListScope) {
          resolvedRegistrySessionCfg = await host.resolveListScopeSessionConfigFromRegistry(slug, {
            targetAddress: targetLower,
          });
          chainId =
            Number(
              resolvedRegistrySessionCfg?.networkChainId ||
                resolvedRegistrySessionCfg?.contracts?.surveys?.chainId ||
                resolvedRegistrySessionCfg?.contracts?.sbtFactory?.chainId ||
                0,
            ) || 0;
        }
        if (!chainId) {
          markSlugSkipped(slug, 'missing-chain-id', {
            fallbackAttempted: !!isListScope,
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });
          host.emitProfileScanTelemetry('slug-skip-no-chain-id', {
            targetAddress: targetLower,
            slug,
          });
          return;
        }
        const netKey = String(chainId); // e.g. "84532"

        // A. Prepare block range and read user cache
        let sessionCfg = host.getSessionCfg(slug);
        if ((!sessionCfg || typeof sessionCfg !== 'object') && resolvedRegistrySessionCfg) {
          sessionCfg = resolvedRegistrySessionCfg as MainSiteMutableMetadata;
        }
        if (!sessionCfg || typeof sessionCfg !== 'object') {
          markSlugSkipped(slug, 'missing-session-config', {
            fallbackAttempted: !!resolvedRegistrySessionCfg,
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });
          return;
        }
        const currentBlock = await chainScanReadsPort.getLatestBlockNumber('none', slug);
        let startBlockRaw = Number(sessionCfg?.blockLimits?.start);
        if (!Number.isFinite(startBlockRaw) || startBlockRaw <= 0) {
          const windowRef = (() => {
            const baseCfg = { ...sessionCfg };
            if (!baseCfg.slug) baseCfg.slug = slug;
            if (report.usedAllSessions) baseCfg.__ignoreSessionScanScope = true;
            return baseCfg;
          })();
          try {
            const fallbackWindow = await chainScanReadsPort.getRelevantBlockWindowForFilter(windowRef);
            startBlockRaw = Number(fallbackWindow?.fromBlock);
          } catch (fallbackError) {
            mainSiteLog.warn(
              '[DeepSearch] Failed to recover missing blockLimits.start from SessionRegistry fallback.',
              {
                slug,
                error: readMainSiteErrorMessage(fallbackError) || String(fallbackError),
              },
            );
          }
        }
        if (!Number.isFinite(startBlockRaw) || startBlockRaw <= 0) {
          markSlugSkipped(slug, 'missing-start-block', {
            sessionSlug: String(slug || ''),
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });
          return;
        }
        const startBlock = Math.floor(startBlockRaw);

        // Read Cache: dg:userCache:<slug>
        let userCache = (host.DG.read('userCache', slug) || {}) as MainSiteProfileUserCache;

        // Ensure User Node exists
        if (!userCache[targetLower]) {
          userCache[targetLower] = {};
        }

        // Ensure Chain Node exists
        if (!userCache[targetLower][netKey]) {
          userCache[targetLower][netKey] = {
            lastBlockScanned: startBlock - 1,
            lastScanTimestamp: 0,
            scanIncomplete: false,
            surveyActivityLastBlockScanned: startBlock - 1,
            surveyActivityScanIncomplete: false,
            questionActivityLastBlockScanned: startBlock - 1,
            questionActivityScanIncomplete: false,
            sbtLastBlockScanned: startBlock - 1,
            sbtScanIncomplete: false,
            sbtBackfillComplete: false,
            data: {
              sbts: [],
              createdSurveys: [],
              createdQuestions: [],
              surveyResponses: [],
              questionResponses: [],
            },
          };
        }

        let chainEntry: MainSiteProfileUserChainEntry = userCache[targetLower][netKey];
        if (!chainEntry || typeof chainEntry !== 'object') {
          chainEntry = {};
        }
        if (!chainEntry.data || typeof chainEntry.data !== 'object') {
          chainEntry.data = {
            sbts: [],
            createdSurveys: [],
            createdQuestions: [],
            surveyResponses: [],
            questionResponses: [],
          };
        }
        if (!Array.isArray(chainEntry.data.sbts)) chainEntry.data.sbts = [];
        if (!Array.isArray(chainEntry.data.createdSurveys)) chainEntry.data.createdSurveys = [];
        if (!Array.isArray(chainEntry.data.createdQuestions)) chainEntry.data.createdQuestions = [];
        if (!Array.isArray(chainEntry.data.surveyResponses)) chainEntry.data.surveyResponses = [];
        if (!Array.isArray(chainEntry.data.questionResponses)) chainEntry.data.questionResponses = [];
        if (!Number.isFinite(Number(chainEntry.lastBlockScanned))) {
          chainEntry.lastBlockScanned = startBlock - 1;
        }
        if (!Number.isFinite(Number(chainEntry.sbtLastBlockScanned))) {
          chainEntry.sbtLastBlockScanned = Number(chainEntry.lastBlockScanned || startBlock - 1);
        }
        if (typeof chainEntry.scanIncomplete !== 'boolean') chainEntry.scanIncomplete = false;
        if (typeof chainEntry.sbtScanIncomplete !== 'boolean') chainEntry.sbtScanIncomplete = false;
        if (typeof chainEntry.sbtBackfillComplete !== 'boolean') chainEntry.sbtBackfillComplete = false;
        const legacyActivityLastBlock = Number(chainEntry.lastBlockScanned || startBlock - 1);
        if (!Number.isFinite(Number(chainEntry.surveyActivityLastBlockScanned))) {
          chainEntry.surveyActivityLastBlockScanned = legacyActivityLastBlock;
        }
        if (!Number.isFinite(Number(chainEntry.questionActivityLastBlockScanned))) {
          chainEntry.questionActivityLastBlockScanned = legacyActivityLastBlock;
        }
        if (typeof chainEntry.surveyActivityScanIncomplete !== 'boolean') {
          chainEntry.surveyActivityScanIncomplete = chainEntry.scanIncomplete === true;
        }
        if (typeof chainEntry.questionActivityScanIncomplete !== 'boolean') {
          chainEntry.questionActivityScanIncomplete = chainEntry.scanIncomplete === true;
        }

        const normalizedSlug = normalizeSessionSlug(slug || '');
        const inAttemptedCoverage = attemptedCoverageSlugSet.has(normalizedSlug);
        const shouldRunSbtForSlug = inAttemptedCoverage || report.useAllSessionsSbtScan === true;
        const shouldIncludeSurveyActivity = inAttemptedCoverage || report.useAllSessionsSurveyActivityScan === true;
        const shouldIncludeQuestionActivity = inAttemptedCoverage || report.useAllSessionsQuestionActivityScan === true;
        const shouldRunActivityForSlug = shouldIncludeSurveyActivity || shouldIncludeQuestionActivity;
        const ranFullActivityCoverage = shouldIncludeSurveyActivity && shouldIncludeQuestionActivity;

        // Detect whether we've *ever* stored any data for this user+chain.
        const d = chainEntry.data || {};
        const neverHadData =
          (!Array.isArray(d.sbts) || d.sbts.length === 0) &&
          (!Array.isArray(d.createdSurveys) || d.createdSurveys.length === 0) &&
          (!Array.isArray(d.createdQuestions) || d.createdQuestions.length === 0) &&
          (!Array.isArray(d.surveyResponses) || d.surveyResponses.length === 0) &&
          (!Array.isArray(d.questionResponses) || d.questionResponses.length === 0);
        const shouldForceSbtBackfill = chainEntry.sbtScanIncomplete === true || chainEntry.sbtBackfillComplete !== true;

        // Keep an independent SBT watermark so we can backfill SBT history even when
        // activity scans were previously incremental.
        let sbtFromBlock;
        if (shouldForceSbtBackfill) {
          sbtFromBlock = startBlock;
        } else {
          sbtFromBlock = Number(chainEntry.sbtLastBlockScanned || 0) + 1;
        }
        if (sbtFromBlock > currentBlock) sbtFromBlock = currentBlock;

        const resolveActivityWindow = (
          lastBlockValue: unknown,
          incompleteFlag: unknown,
        ): MainSiteProfileActivityWindow => {
          const normalizedLastBlock = Number(lastBlockValue || 0);
          const shouldForceBackfill = incompleteFlag === true || normalizedLastBlock < startBlock;
          if (shouldForceBackfill) {
            return { fromBlock: startBlock, shouldForceBackfill: true };
          }
          return {
            fromBlock: Math.max(startBlock, normalizedLastBlock + 1 - Math.max(0, Number(activityLookbackBlocks || 0))),
            shouldForceBackfill: false,
          };
        };
        const surveyActivityWindow = shouldIncludeSurveyActivity
          ? resolveActivityWindow(chainEntry.surveyActivityLastBlockScanned, chainEntry.surveyActivityScanIncomplete)
          : null;
        const questionActivityWindow = shouldIncludeQuestionActivity
          ? resolveActivityWindow(
              chainEntry.questionActivityLastBlockScanned,
              chainEntry.questionActivityScanIncomplete,
            )
          : null;
        const activityWindows = [surveyActivityWindow, questionActivityWindow].filter(isMainSitePresent);
        const shouldForceActivityBackfill = activityWindows.some((window) => window.shouldForceBackfill);
        let activityFromBlock =
          activityWindows.length > 0 ? Math.min(...activityWindows.map((window) => window.fromBlock)) : currentBlock;
        if (activityFromBlock > currentBlock) activityFromBlock = currentBlock;

        host.emitProfileScanColdDiag('slug-window', {
          targetAddress: targetLower,
          slug,
          chainId,
          netKey,
          currentBlock,
          startBlock,
          sbtFromBlock,
          activityFromBlock,
          neverHadData,
          shouldForceActivityBackfill,
          shouldForceSbtBackfill,
          lastBlockScanned: chainEntry.lastBlockScanned,
          surveyActivityLastBlockScanned: chainEntry.surveyActivityLastBlockScanned,
          questionActivityLastBlockScanned: chainEntry.questionActivityLastBlockScanned,
          sbtLastBlockScanned: chainEntry.sbtLastBlockScanned,
          blockLimitsStart: sessionCfg?.blockLimits?.start,
          sessionCfgSlug: sessionCfg?.slug,
        });

        const resolveBackfillTimeoutMs = (
          baseTimeoutMs: unknown,
          shouldForceBackfill: boolean,
          allowAdaptiveBackfill: boolean,
          opts: MainSiteProfileBackfillTimeoutOptions = {},
        ) => {
          const base = Number.isFinite(Number(baseTimeoutMs))
            ? Math.max(5000, Math.floor(Number(baseTimeoutMs)))
            : 5000;
          if (!allowAdaptiveBackfill || shouldForceBackfill !== true) return base;
          const blockSpan = Math.max(0, Number(currentBlock || 0) - Number(startBlock || 0));
          const spanStepBlocks = Number.isFinite(Number(opts.spanStepBlocks))
            ? Math.max(5000, Math.floor(Number(opts.spanStepBlocks)))
            : 250000;
          const spanMultiplier = 1 + Math.min(6, Math.floor(blockSpan / spanStepBlocks));
          const floorOverride = Number.isFinite(Number(opts.floorTimeoutMs))
            ? Math.max(5000, Math.floor(Number(opts.floorTimeoutMs)))
            : base;
          const floor = Math.max(base, floorOverride);
          const boosted = floor * spanMultiplier;
          const timeoutCapMs = Number.isFinite(Number(opts.timeoutCapMs))
            ? Math.max(5000, Math.floor(Number(opts.timeoutCapMs)))
            : 180000;
          return Math.min(timeoutCapMs, Math.max(floor, boosted));
        };
        const allowAdaptiveSbtTimeout = report.useAllSessionsSbtScan === true || isListScope;
        const allowAdaptiveActivityTimeout = report.useAllSessionsActivityScan === true || isListScope;
        const sbtTimeoutForSlugMs = resolveBackfillTimeoutMs(
          sbtFetchTimeoutMs,
          shouldForceSbtBackfill,
          allowAdaptiveSbtTimeout,
          {
            floorTimeoutMs: sbtFetchTimeoutMs,
            spanStepBlocks: isListScope ? 40000 : 250000,
            timeoutCapMs: 180000,
          },
        );
        const activityTimeoutForSlugMs = resolveBackfillTimeoutMs(
          activityFetchTimeoutMs,
          shouldForceActivityBackfill,
          allowAdaptiveActivityTimeout,
          {
            floorTimeoutMs: activityFetchTimeoutMs,
            spanStepBlocks: isListScope ? 20000 : 250000,
            timeoutCapMs: isListScope ? 120000 : 180000,
          },
        );
        host.emitProfileScanTelemetry('slug-start', {
          targetAddress: targetLower,
          slug,
          chainId: Number(chainId || 0),
          startBlock,
          currentBlock,
          fromBlock: sbtFromBlock,
          sbtFromBlock,
          activityFromBlock,
          shouldForceBackfill: shouldForceSbtBackfill,
          shouldForceSbtBackfill,
          shouldForceActivityBackfill,
          activityLookbackBlocks: Number(activityLookbackBlocks || 0),
          priorScanIncomplete: chainEntry.scanIncomplete === true,
          priorSbtScanIncomplete: chainEntry.sbtScanIncomplete === true,
          priorSbtBackfillComplete: chainEntry.sbtBackfillComplete === true,
          sbtFetchTimeoutMs: Number(sbtTimeoutForSlugMs || 0),
          activityFetchTimeoutMs: Number(activityTimeoutForSlugMs || 0),
        });

        mainSiteLog.log(
          `[DeepSearch] Group '${slug}': Scanning for ${targetLower} ` +
            `(SBT from ${sbtFromBlock}, activity from ${activityFromBlock}) to ${currentBlock}`,
        );

        // B. Fetch incremental data (delta)
        let sbts: MainSiteProfileScanSbt[] = [];
        let activity: MainSiteProfileActivityPayload = {
          createdSurveys: [],
          createdQuestions: [],
          surveyResponses: [],
          questionResponses: [],
        };
        let sbtHadRpcError = false;
        let activityHadRpcError = false;

        const runWithTimeout = async <T>(
          promise: Promise<T> | T,
          kind: string,
          fromBlock: number,
          timeoutMs: unknown,
        ): Promise<MainSiteProfileTimeoutOutcome<T>> => {
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
            ? Math.max(5000, Math.floor(Number(timeoutMs)))
            : Math.max(5000, Math.floor(Number(slugFetchTimeoutMs || 12000)));
          try {
            const outcome = await Promise.race<MainSiteProfileTimeoutOutcome<T>>([
              Promise.resolve(promise)
                .then((value) => ({ timedOut: false, value }))
                .catch((error) => ({ timedOut: false, error })),
              new Promise<MainSiteProfileTimeoutOutcome<T>>((resolve) => {
                timeoutId = setTimeout(() => {
                  resolve({ timedOut: true });
                }, effectiveTimeoutMs);
              }),
            ]);
            if (outcome?.timedOut) {
              host.emitProfileScanTelemetry('slug-timeout', {
                targetAddress: targetLower,
                slug,
                kind,
                fromBlock,
                currentBlock,
                timeoutMs: effectiveTimeoutMs,
              });
            }
            return outcome || { timedOut: false, value: null };
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        };

        if (sbtFromBlock <= currentBlock && shouldRunSbtForSlug) {
          const sbtResult = await runWithTimeout(
            profileScanPort.getSBTsForUser(target, slug, sbtFromBlock, {
              returnMeta: true,
              ignoreScope: report.useAllSessionsSbtScan === true,
            }),
            'sbt',
            sbtFromBlock,
            sbtTimeoutForSlugMs,
          );
          if (sbtResult?.timedOut) {
            sbtHadRpcError = true;
          } else if (sbtResult?.error) {
            sbtHadRpcError = true;
            host.emitProfileScanTelemetry('slug-step-error', {
              targetAddress: targetLower,
              slug,
              kind: 'sbt',
              error: String(readMainSiteErrorMessage(sbtResult.error) || ''),
            });
          } else {
            const sbtRaw = sbtResult?.value;
            const sbtMeta = isMainSiteProfileMetaResult<MainSiteProfileScanSbt[]>(sbtRaw)
              ? sbtRaw
              : { data: sbtRaw, hadError: false };
            sbts = Array.isArray(sbtMeta.data) ? sbtMeta.data : [];
            sbtHadRpcError = !!sbtMeta.hadError;
          }
        } else if (sbtFromBlock <= currentBlock && !shouldRunSbtForSlug) {
          host.emitProfileScanTelemetry('slug-step-skipped', {
            targetAddress: targetLower,
            slug,
            kind: 'sbt',
            reason: 'list-scope-activity-fanout',
          });
        }

        if (activityFromBlock <= currentBlock && shouldRunActivityForSlug) {
          const activityResult = await runWithTimeout(
            profileScanPort.getUserActivity(target, slug, activityFromBlock, {
              returnMeta: true,
              ignoreScope: report.useAllSessionsActivityScan === true,
              includeSurveyActivity: shouldIncludeSurveyActivity,
              includeQuestionActivity: shouldIncludeQuestionActivity,
              forceArweaveFetch: true,
            }),
            'activity',
            activityFromBlock,
            activityTimeoutForSlugMs,
          );
          if (activityResult?.timedOut) {
            activityHadRpcError = true;
          } else if (activityResult?.error) {
            activityHadRpcError = true;
            host.emitProfileScanTelemetry('slug-step-error', {
              targetAddress: targetLower,
              slug,
              kind: 'activity',
              error: String(readMainSiteErrorMessage(activityResult.error) || ''),
            });
          } else {
            const activityRaw = activityResult?.value;
            const activityMeta = isMainSiteProfileMetaResult<MainSiteProfileActivityPayload>(activityRaw)
              ? activityRaw
              : { data: activityRaw, hadError: false };
            activity = normalizeActivityPayload(activityMeta.data);
            activityHadRpcError = !!activityMeta.hadError;
          }
        } else if (activityFromBlock <= currentBlock && !shouldRunActivityForSlug) {
          host.emitProfileScanTelemetry('slug-step-skipped', {
            targetAddress: targetLower,
            slug,
            kind: 'activity',
            reason: 'list-scope-sbt-fanout',
          });
        }

        const slugHadRpcError = !!(sbtHadRpcError || activityHadRpcError);
        const sbtAddressSamples = sbts
          .map((item: MainSiteProfileScanSbt) => normalizeEventIdentifier(item?.sbtAddress || ''))
          .filter(Boolean);
        const createdSurveyIds = activity.createdSurveys
          .map((item: MainSiteProfileActivityEntry) => readCreatedSurveyId(item))
          .filter(Boolean);
        const createdQuestionIds = activity.createdQuestions
          .map((item: MainSiteProfileActivityEntry) => readCreatedQuestionId(item))
          .filter(Boolean);
        const surveyResponseIds = activity.surveyResponses
          .map((item: MainSiteProfileActivityEntry) => readSurveyResponseId(item))
          .filter(Boolean);
        const questionResponseIds = activity.questionResponses
          .map((item: MainSiteProfileActivityEntry) => readQuestionResponseId(item))
          .filter(Boolean);
        report.totalSbtContractsFound += sbtAddressSamples.length;
        report.totalCreatedSurveysFound += createdSurveyIds.length;
        report.totalCreatedQuestionsFound += createdQuestionIds.length;
        report.totalSurveyResponsesFound += surveyResponseIds.length;
        report.totalQuestionResponsesFound += questionResponseIds.length;
        sbtAddressSamples.forEach((value: string) => pushUniqueSample(report.sampleSbtAddresses, value));
        createdSurveyIds.forEach((value: string) => pushUniqueSample(report.sampleCreatedSurveyIds, value));
        createdQuestionIds.forEach((value: string) => pushUniqueSample(report.sampleCreatedQuestionIds, value));
        surveyResponseIds.forEach((value: string) => pushUniqueSample(report.sampleSurveyResponseIds, value));
        questionResponseIds.forEach((value: string) => pushUniqueSample(report.sampleQuestionResponseIds, value));

        host.emitProfileScanTelemetry('slug-result', {
          targetAddress: targetLower,
          slug,
          fromBlock: sbtFromBlock,
          sbtFromBlock,
          activityFromBlock,
          currentBlock,
          sbtCount: sbts.length,
          sbtAddresses: sbts
            .map((item: MainSiteProfileScanSbt) => String(item?.sbtAddress || '').toLowerCase())
            .filter(Boolean)
            .slice(0, 12),
          createdSurveys: activity.createdSurveys.length,
          createdQuestions: activity.createdQuestions.length,
          surveyResponses: activity.surveyResponses.length,
          questionResponses: activity.questionResponses.length,
          slugHadRpcError,
          sbtHadRpcError,
          activityHadRpcError,
          durationMs: Math.max(0, Date.now() - slugStartedAt),
        });
        host.emitProfileScanTelemetry('slug-event-discovery', {
          targetAddress: targetLower,
          slug,
          chainId: Number(chainId || 0),
          sbtCount: sbtAddressSamples.length,
          createdSurveyCount: createdSurveyIds.length,
          createdQuestionCount: createdQuestionIds.length,
          surveyResponseCount: surveyResponseIds.length,
          questionResponseCount: questionResponseIds.length,
          sbtAddresses: sbtAddressSamples.slice(0, 12),
          createdSurveyIds: createdSurveyIds.slice(0, 12),
          createdQuestionIds: createdQuestionIds.slice(0, 12),
          surveyResponseIds: surveyResponseIds.slice(0, 12),
          questionResponseIds: questionResponseIds.slice(0, 12),
          slugHadRpcError,
          durationMs: Math.max(0, Date.now() - slugStartedAt),
        });

        host.emitProfileScanColdDiag('rpc', {
          targetAddress: targetLower,
          slug,
          sbtCount: sbts.length,
          createdSurveys: activity.createdSurveys.length,
          createdQuestions: activity.createdQuestions.length,
          surveyResponses: activity.surveyResponses.length,
          questionResponses: activity.questionResponses.length,
          sbtHadRpcError,
          activityHadRpcError,
          durationMs: Math.max(0, Date.now() - slugStartedAt),
        });

        mainSiteLog.log(
          `[DeepSearch] Group '${slug}': Found ${sbts.length} SBTs, ${activity.createdSurveys.length} Surveys.`,
        );

        const hasNewData =
          sbts.length > 0 ||
          activity.createdSurveys.length > 0 ||
          activity.createdQuestions.length > 0 ||
          activity.surveyResponses.length > 0 ||
          activity.questionResponses.length > 0;

        // C. Update user cache (append delta with dedup)
        if (hasNewData) {
          // Ensure data object exists
          if (!chainEntry.data) {
            chainEntry.data = {
              sbts: [],
              createdSurveys: [],
              createdQuestions: [],
              surveyResponses: [],
              questionResponses: [],
            };
          }

          // Dedup SBTs by address so retries do not duplicate entries.
          const existingSbtMap = new Map<string, MainSiteProfileScanSbt>();
          (chainEntry.data.sbts || []).forEach((item: MainSiteProfileScanSbt) => {
            if (item.sbtAddress) existingSbtMap.set(item.sbtAddress.toLowerCase(), item);
          });

          // Merge new SBTs
          sbts.forEach((newItem) => {
            if (newItem.sbtAddress) {
              // Overwrite or add. If getSBTsForUser returns current state, this keeps it fresh.
              existingSbtMap.set(newItem.sbtAddress.toLowerCase(), newItem);
            }
          });

          chainEntry.data.sbts = Array.from(existingSbtMap.values());

          chainEntry.data.createdSurveys = mergeMainSiteProfileRows(
            chainEntry.data.createdSurveys,
            activity.createdSurveys,
            (item) => String(item.id || JSON.stringify(item)),
          );
          chainEntry.data.createdQuestions = mergeMainSiteProfileRows(
            chainEntry.data.createdQuestions,
            activity.createdQuestions,
            (item) => String(item.id || JSON.stringify(item)),
          );

          chainEntry.data.surveyResponses = mergeMainSiteProfileRows(
            chainEntry.data.surveyResponses,
            activity.surveyResponses,
            buildMainSiteProfileSurveyResponseKey,
            true,
          );
          chainEntry.data.questionResponses = mergeMainSiteProfileRows(
            chainEntry.data.questionResponses,
            activity.questionResponses,
            buildMainSiteProfileQuestionResponseKey,
            true,
          );
        }

        if (sbtHadRpcError || activityHadRpcError) {
          report.hadRpcErrors = true;
        }
        if (sbtHadRpcError && inAttemptedCoverage) {
          pushUnique(report.failedSlugs, slug);
        }
        if (activityHadRpcError && inAttemptedCoverage) {
          pushUnique(report.failedActivitySlugs, slug);
        }

        if (sbtHadRpcError) {
          chainEntry.sbtScanIncomplete = true;
        } else {
          chainEntry.sbtLastBlockScanned = currentBlock;
          chainEntry.sbtScanIncomplete = false;
          if (sbtFromBlock <= startBlock) {
            chainEntry.sbtBackfillComplete = true;
          }
        }

        if (activityHadRpcError) {
          if (shouldIncludeSurveyActivity) chainEntry.surveyActivityScanIncomplete = true;
          if (shouldIncludeQuestionActivity) chainEntry.questionActivityScanIncomplete = true;
          if (ranFullActivityCoverage) {
            chainEntry.scanIncomplete = true;
          }
        } else {
          if (shouldIncludeSurveyActivity) {
            chainEntry.surveyActivityLastBlockScanned = currentBlock;
            chainEntry.surveyActivityScanIncomplete = false;
          }
          if (shouldIncludeQuestionActivity) {
            chainEntry.questionActivityLastBlockScanned = currentBlock;
            chainEntry.questionActivityScanIncomplete = false;
          }
          if (ranFullActivityCoverage) {
            // Regression guard: partial off-list survey/question fanout can append
            // one activity type, but it must not advance the shared full-activity watermark.
            chainEntry.lastBlockScanned = currentBlock;
            chainEntry.lastScanTimestamp = Math.floor(Date.now() / 1000);
            chainEntry.scanIncomplete = false;
          }
        }

        // Persist only this user/chain node so concurrent response writers survive the profile scan.
        await persistMainSiteProfileCacheAtomic<MainSiteProfileUserCache>('userCache', slug, (currentIn) =>
          mergeMainSiteProfileUserCache(currentIn, {
            chainEntry,
            netKey,
            targetLower,
          }) as MainSiteProfileUserCache,
        );

        if (!hasNewData) {
          if (!sbtHadRpcError && !activityHadRpcError && attemptedCoverageSlugSet.has(normalizedSlug)) {
            pushUnique(report.scannedSlugs, slug);
          }
          return;
        }

        // D. Sync global caches (update UI)
        const metadataGroupRef = report.useAllSessionsActivityScan
          ? { ...(sessionCfg || {}), slug, __ignoreSessionScanScope: true }
          : slug;

        // 1. Update SBT Cache
        if (sbts.length > 0) {
          await persistMainSiteProfileCacheAtomic<MainSiteSbtMetadataCache>('sbtCache', slug, (currentIn) => {
            const sbtCache = currentIn && typeof currentIn === 'object' ? { ...currentIn } : {};
            const currentNet = (
              sbtCache[netKey] && typeof sbtCache[netKey] === 'object' ? sbtCache[netKey] : { sbtList: {} }
            ) as MainSiteSbtNetworkCache;
            const sbtNet = {
              ...currentNet,
              sbtList: { ...(currentNet.sbtList || {}) },
            } as MainSiteSbtNetworkCache;
            sbtCache[netKey] = sbtNet;
            sbts.forEach((item) => {
              const addrLower = String(item.sbtAddress || '').toLowerCase();
              if (!addrLower) return;
              const existing = sbtNet.sbtList[addrLower] || {};
              const merged = mergeSbtActivityCacheEntryMetadata(existing, {
                sbtAddress: item.sbtAddress,
                sbtInfo: item.sbtInfo || null,
                slug,
                blockNumber: currentBlock,
              });
              merged.mintedAddresses = [...new Set([...(merged.mintedAddresses || []), targetLower])];
              sbtNet.sbtList[addrLower] = { ...merged };
            });
            return sbtCache;
          });
        }

        // 2. Update Surveys Cache
        if (activity.createdSurveys.length > 0 || activity.surveyResponses.length > 0) {
          let survCache = (host.DG.read('surveysCache', slug) || {}) as MainSiteSurveyMetadataCache;
          if (!survCache[netKey]) {
            survCache[netKey] = {
              surveys: {},
              surveyResponses: {},
              surveyResponsesLatestBlock: {},
            };
          }
          const surveyNet = survCache[netKey] as MainSiteSurveyNetworkCache;
          if (!surveyNet.surveys || typeof surveyNet.surveys !== 'object') {
            surveyNet.surveys = {};
          }
          if (!surveyNet.surveyResponses || typeof surveyNet.surveyResponses !== 'object') {
            surveyNet.surveyResponses = {};
          }

          // Merge Created Surveys
          activity.createdSurveys.forEach(({ id, data }: MainSiteProfileActivityEntry) => {
            const idLower = String(id || '').toLowerCase();
            if (!idLower) return;
            if (data) {
              data.surveyID = idLower;
              surveyNet.surveys[idLower] = data;
            }
          });

          // Merge Responses
          activity.surveyResponses.forEach(({ surveyId, response, responder }: MainSiteProfileActivityEntry) => {
            const sIdLower = String(surveyId || '').toLowerCase();
            const rLower = String(responder || '').toLowerCase();
            if (!sIdLower || !rLower) return;
            if (!surveyNet.surveyResponses[sIdLower]) {
              surveyNet.surveyResponses[sIdLower] = {};
            }
            surveyNet.surveyResponses[sIdLower][rLower] = response as Record<string, unknown>;
          });

          // Backfill response-linked survey metadata for cold user-profile loads.
          const missingSurveyIds = new Set<string>();
          activity.surveyResponses.forEach(({ surveyId }: MainSiteProfileActivityEntry) => {
            const surveyIdLower = String(surveyId || '').toLowerCase();
            if (!surveyIdLower) return;
            if (!surveyNet.surveys[surveyIdLower]) {
              missingSurveyIds.add(surveyIdLower);
            }
          });
          if (missingSurveyIds.size > 0) {
            const rows = await Promise.all(
              Array.from(missingSurveyIds).map(async (surveyIdLower) => {
                try {
                  const surveyData = (await surveyReadsPort.getSurveyDataById('none', surveyIdLower, metadataGroupRef, {
                    skipDecrypt: true,
                  })) as MainSiteMutableMetadata | null;
                  return { surveyIdLower, surveyData };
                } catch (_) {
                  return { surveyIdLower, surveyData: null };
                }
              }),
            );
            rows.forEach(({ surveyIdLower, surveyData }) => {
              if (!surveyData || typeof surveyData !== 'object') return;
              surveyData.id = surveyIdLower;
              surveyData.surveyID = surveyIdLower;
              if (!surveyData.sessionSlug) surveyData.sessionSlug = slug;
              if (!surveyData.slug) surveyData.slug = slug;
              surveyNet.surveys[surveyIdLower] = surveyData;
            });
          }
          host.emitProfileScanColdDiag('survey-backfill', {
            targetAddress: targetLower,
            slug,
            missingSurveyCount: missingSurveyIds.size,
            missingSurveyIds: Array.from(missingSurveyIds).slice(0, 6),
            surveyCacheKeys: Object.keys(surveyNet.surveys || {}).length,
            surveyResponseKeys: Object.keys(surveyNet.surveyResponses || {}).length,
          });
          host.DG.write('surveysCache', slug, survCache);
        }

        // 3. Update Questions Cache
        if (activity.createdQuestions.length > 0 || activity.questionResponses.length > 0) {
          let qCache = (host.DG.read('questionsCache', slug) || {}) as MainSiteQuestionMetadataCache;
          if (!qCache[netKey]) {
            qCache[netKey] = {
              questions: {},
              questionResponses: {},
              questionResponsesMeta: {},
              arweaveTxCache: {},
              arweaveTxFailureCache: {},
            };
          }
          const questionNet = qCache[netKey] as MainSiteQuestionNetworkCache;
          ensureQuestionArweaveCacheBranches(questionNet);
          if (!questionNet.questions || typeof questionNet.questions !== 'object') {
            questionNet.questions = {};
          }
          if (!questionNet.questionResponses || typeof questionNet.questionResponses !== 'object') {
            questionNet.questionResponses = {};
          }
          if (!questionNet.questionResponsesMeta || typeof questionNet.questionResponsesMeta !== 'object') {
            questionNet.questionResponsesMeta = {};
          }

          // Merge Created Questions
          activity.createdQuestions.forEach(({ id, data }: MainSiteProfileActivityEntry) => {
            const idLower = String(id || '').toLowerCase();
            if (!idLower) return;
            if (data) {
              data.id = idLower;
              questionNet.questions[idLower] = data;
            }
          });

          // Merge Responses
          activity.questionResponses.forEach(
            ({
              questionId,
              response,
              responder,
              blockNumber,
              transactionIndex,
              logIndex,
              timestamp,
            }: MainSiteProfileActivityEntry) => {
              const qIdLower = String(questionId || '').toLowerCase();
              const rLower = String(responder || '').toLowerCase();
              if (!qIdLower || !rLower) return;
              if (!questionNet.questionResponses[qIdLower]) {
                questionNet.questionResponses[qIdLower] = {};
              }
              if (!questionNet.questionResponsesMeta[qIdLower]) {
                questionNet.questionResponsesMeta[qIdLower] = {};
              }
              const questionResponseMeta = questionNet.questionResponsesMeta[qIdLower] || {};
              const prevMeta = questionResponseMeta[rLower] || {};
              const incomingMeta = {
                bn: Number(blockNumber ?? currentBlock ?? 0) || 0,
                txi: Number(transactionIndex ?? 0) || 0,
                li: Number(logIndex ?? 0) || 0,
                ts: Number(timestamp ?? 0) || 0,
              };
              const prevRecency = {
                bn: Number(prevMeta.bn ?? prevMeta.blockNumber ?? 0) || 0,
                txi: Number(prevMeta.txi ?? prevMeta.transactionIndex ?? prevMeta.txIndex ?? 0) || 0,
                li: Number(prevMeta.li ?? prevMeta.logIndex ?? 0) || 0,
                ts: Number(prevMeta.ts ?? prevMeta.timestamp ?? 0) || 0,
              };
              const isNewer =
                incomingMeta.bn > prevRecency.bn ||
                (incomingMeta.bn === prevRecency.bn &&
                  (incomingMeta.txi > prevRecency.txi ||
                    (incomingMeta.txi === prevRecency.txi &&
                      (incomingMeta.li > prevRecency.li ||
                        (incomingMeta.li === prevRecency.li && incomingMeta.ts >= prevRecency.ts)))));
              if (!isNewer) return;
              questionNet.questionResponses[qIdLower][rLower] = response as Record<string, unknown>;
              questionResponseMeta[rLower] = incomingMeta;
            },
          );

          // Backfill response-linked question metadata for cold user-profile loads.
          const missingQuestionIds = new Set<string>();
          activity.questionResponses.forEach(({ questionId }: MainSiteProfileActivityEntry) => {
            const questionIdLower = String(questionId || '').toLowerCase();
            if (!questionIdLower) return;
            if (!questionNet.questions[questionIdLower]) {
              missingQuestionIds.add(questionIdLower);
            }
          });
          if (missingQuestionIds.size > 0) {
            const decryptContext = host.buildQuestionDecryptContext(slug);
            const rows = await Promise.all(
              Array.from(missingQuestionIds).map(async (questionIdLower) => {
                try {
                  const questionData = (await surveyReadsPort.getQuestionData(
                    'none',
                    questionIdLower,
                    metadataGroupRef,
                    {
                      decryptContext,
                      skipDecrypt: true,
                    },
                  )) as MainSiteMutableMetadata | null;
                  return { questionIdLower, questionData };
                } catch (_) {
                  return { questionIdLower, questionData: null };
                }
              }),
            );
            rows.forEach(({ questionIdLower, questionData }) => {
              if (!questionData || typeof questionData !== 'object') return;
              questionData.id = questionIdLower;
              questionNet.questions[questionIdLower] = questionData;
            });
          }
          try {
            const freshQuestionsCache = (host.DG.read('questionsCache', slug) || {}) as MainSiteQuestionMetadataCache;
            const freshNet = freshQuestionsCache?.[netKey];
            if (freshNet && typeof freshNet === 'object') {
              mergeQuestionArweaveCacheBranches(questionNet, freshNet);
            }
          } catch (e) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
          host.emitProfileScanColdDiag('question-backfill', {
            targetAddress: targetLower,
            slug,
            missingQuestionCount: missingQuestionIds.size,
            missingQuestionIds: Array.from(missingQuestionIds).slice(0, 6),
            questionCacheKeys: Object.keys(questionNet.questions || {}).length,
            questionResponseKeys: Object.keys(questionNet.questionResponses || {}).length,
          });
          host.DG.write('questionsCache', slug, qCache);
        }

        // Only publish scan success after every cache write for this slug completed.
        // Marking it earlier suppresses retries when persistence fails mid-scan.
        newDataWritten = true;
        if (!sbtHadRpcError && !activityHadRpcError && attemptedCoverageSlugSet.has(normalizedSlug)) {
          pushUnique(report.scannedSlugs, slug);
        }

        // Stream updates into UI as each slug finishes so profile sections can populate incrementally.
        host.queueLocalRevisionUpdate({
          needsSbtRevision: sbts.length > 0,
          needsQuestionResponsesNonce:
            activity.createdSurveys.length > 0 ||
            activity.surveyResponses.length > 0 ||
            activity.createdQuestions.length > 0 ||
            activity.questionResponses.length > 0,
        });
      } catch (err) {
        if (isMainSiteProfilePersistenceFailure(err)) {
          hadPersistenceFailure = true;
        } else {
          report.hadRpcErrors = true;
        }
        pushUnique(report.failedSlugs, slug);
        pushUnique(report.failedActivitySlugs, slug);
        host.emitProfileScanTelemetry('slug-error', {
          targetAddress: targetLower,
          slug,
          error: String(readMainSiteErrorMessage(err) || err),
          durationMs: Math.max(0, Date.now() - slugStartedAt),
        });
        mainSiteLog.warn(`[DeepSearch] Error scanning slug ${slug}:`, err);
        // Continue to next group - do not crash entire scan
      }
    };

    if (report.sbtBurstSize > 1 && allSlugs.length > 1) {
      host.emitProfileScanTelemetry('scan-mode', {
        targetAddress: targetLower,
        mode: 'burst',
        sbtBurstSize: report.sbtBurstSize,
        slugCount: allSlugs.length,
      });
      for (let i = 0; i < allSlugs.length; i += report.sbtBurstSize) {
        const batch = allSlugs.slice(i, i + report.sbtBurstSize);
        await Promise.all(batch.map((slug: string) => scanOneSlug(slug)));
      }
    } else {
      host.emitProfileScanTelemetry('scan-mode', {
        targetAddress: targetLower,
        mode: 'sequential',
        sbtBurstSize: 1,
        slugCount: allSlugs.length,
      });
      for (const slug of allSlugs) {
        await scanOneSlug(slug);
      }
    }

    report.anyNewData = newDataWritten;
    const totalSkippedScan =
      report.attemptedSlugs.length > 0 &&
      report.scannedSlugs.length === 0 &&
      report.skippedSlugs.length >= report.attemptedSlugs.length;
    const totalActivityFailure =
      report.attemptedSlugs.length > 0 &&
      report.scannedSlugs.length === 0 &&
      report.failedActivitySlugs.length >= report.attemptedSlugs.length;
    const totalSbtFailure =
      report.attemptedSlugs.length > 0 &&
      report.scannedSlugs.length === 0 &&
      report.failedSlugs.length >= report.attemptedSlugs.length;
    report.allActivityFailed = totalActivityFailure;
    report.allSbtFailed = totalSbtFailure;
    if (totalActivityFailure || totalSbtFailure) {
      report.coverageComplete = false;
      report.coverageReason =
        totalActivityFailure && totalSbtFailure
          ? 'activity-sbt-failure-all-slugs'
          : totalActivityFailure
            ? 'activity-failure-all-slugs'
            : 'sbt-failure-all-slugs';
      if (!hadPersistenceFailure) {
        report.hadRpcErrors = true;
        host.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
      }
    }
    if (hadPersistenceFailure) {
      report.coverageComplete = false;
      report.coverageReason = 'cache-persistence-failed';
      host.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
    }
    const unresolvedListScopeChainIds =
      isListScope &&
      totalSkippedScan &&
      report.attemptedSlugs.length > 0 &&
      report.attemptedSlugs.every(
        (slug: string) => String(report.skippedSlugReasons[String(slug || '')] || '') === 'missing-chain-id',
      );
    if (unresolvedListScopeChainIds && !hadPersistenceFailure) {
      const registryRecoverableFailure = !!(
        registryStatus?.timedOut ||
        registryStatus?.hadLoadErrors ||
        registryStatus?.hasEntries === false
      );
      if (registryRecoverableFailure) {
        report.coverageComplete = false;
        report.coverageReason = 'list-scope-chain-id-unresolved';
        report.hadRpcErrors = true;
        host.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
      }
    }
    host.emitProfileScanTelemetry('scan-event-discovery-summary', {
      targetAddress: targetLower,
      attemptedSlugs: [...report.attemptedSlugs],
      scannedSlugs: [...report.scannedSlugs],
      totalSbtContractsFound: Number(report.totalSbtContractsFound || 0),
      totalCreatedSurveysFound: Number(report.totalCreatedSurveysFound || 0),
      totalCreatedQuestionsFound: Number(report.totalCreatedQuestionsFound || 0),
      totalSurveyResponsesFound: Number(report.totalSurveyResponsesFound || 0),
      totalQuestionResponsesFound: Number(report.totalQuestionResponsesFound || 0),
      sampleSbtAddresses: Array.isArray(report.sampleSbtAddresses) ? report.sampleSbtAddresses.slice(0, 12) : [],
      sampleCreatedSurveyIds: Array.isArray(report.sampleCreatedSurveyIds)
        ? report.sampleCreatedSurveyIds.slice(0, 12)
        : [],
      sampleCreatedQuestionIds: Array.isArray(report.sampleCreatedQuestionIds)
        ? report.sampleCreatedQuestionIds.slice(0, 12)
        : [],
      sampleSurveyResponseIds: Array.isArray(report.sampleSurveyResponseIds)
        ? report.sampleSurveyResponseIds.slice(0, 12)
        : [],
      sampleQuestionResponseIds: Array.isArray(report.sampleQuestionResponseIds)
        ? report.sampleQuestionResponseIds.slice(0, 12)
        : [],
    });
    try {
      if (typeof globalThis !== 'undefined') {
        getMainSiteRuntimeGlobal().__CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__ = {
          ts: new Date().toISOString(),
          targetAddress: targetLower,
          attemptedSlugs: [...report.attemptedSlugs],
          scannedSlugs: [...report.scannedSlugs],
          totalSbtContractsFound: Number(report.totalSbtContractsFound || 0),
          totalCreatedSurveysFound: Number(report.totalCreatedSurveysFound || 0),
          totalCreatedQuestionsFound: Number(report.totalCreatedQuestionsFound || 0),
          totalSurveyResponsesFound: Number(report.totalSurveyResponsesFound || 0),
          totalQuestionResponsesFound: Number(report.totalQuestionResponsesFound || 0),
          sampleSbtAddresses: Array.isArray(report.sampleSbtAddresses) ? report.sampleSbtAddresses.slice(0, 12) : [],
          sampleCreatedSurveyIds: Array.isArray(report.sampleCreatedSurveyIds)
            ? report.sampleCreatedSurveyIds.slice(0, 12)
            : [],
          sampleCreatedQuestionIds: Array.isArray(report.sampleCreatedQuestionIds)
            ? report.sampleCreatedQuestionIds.slice(0, 12)
            : [],
          sampleSurveyResponseIds: Array.isArray(report.sampleSurveyResponseIds)
            ? report.sampleSurveyResponseIds.slice(0, 12)
            : [],
          sampleQuestionResponseIds: Array.isArray(report.sampleQuestionResponseIds)
            ? report.sampleQuestionResponseIds.slice(0, 12)
            : [],
        };
      }
    } catch (e) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    host.emitProfileScanTelemetry('scan-complete', {
      ...report,
    });
    mainSiteLog.log(`[DeepSearch] Completed. Triggering UI update.`, report);

    // Force UI update by bumping revisions ONLY if something actually changed
    if (host._mounted && !hadPersistenceFailure) {
      host.setState((prev: MainSiteState) => ({
        sbtCacheRevision: newDataWritten ? prev.sbtCacheRevision + 1 : prev.sbtCacheRevision,
        questionResponsesNonce: newDataWritten ? prev.questionResponsesNonce + 1 : prev.questionResponsesNonce,
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      }));
    }
    return report;
  })();

  host._scanSpecificUserProfileInFlight.set(targetLower, run);
  try {
    return await run;
  } finally {
    if (host._scanSpecificUserProfileInFlight.get(targetLower) === run) {
      host._scanSpecificUserProfileInFlight.delete(targetLower);
    }
  }
};
