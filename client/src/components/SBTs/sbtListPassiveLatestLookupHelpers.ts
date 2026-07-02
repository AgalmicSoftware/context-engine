import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtPassiveLatestLookupState = {
  lastRequestedAtBlock?: unknown;
};

export type SbtPassiveLatestLookupStateBySlug = Record<string, SbtPassiveLatestLookupState | undefined>;
export type SbtPassiveLatestLookupInFlightBySlug = Record<string, boolean | undefined>;

export type SbtPassiveLatestLookupProgressSnapshot = {
  displayCurrentBlock?: unknown;
  lastBlock?: unknown;
  liveCurrentBlock?: unknown;
  liveLatestBlock?: unknown;
};

export type SbtPassiveLatestLookupRequest = {
  currentWatermark: number;
  slug: string;
};

export type SbtPassiveLatestLookupPlan = {
  requests: SbtPassiveLatestLookupRequest[];
  staleSlugs: string[];
};

type SbtPassiveLatestLookupChipState = {
  isLoading?: unknown;
};

type BuildSbtListPassiveLatestLookupPlanArgs = {
  chipLoadingStatusBySlug?: Record<string, unknown> | null;
  getSessionProgressSnapshot?: (slug: string) => SbtPassiveLatestLookupProgressSnapshot | null | undefined;
  lookupInFlightBySlug?: SbtPassiveLatestLookupInFlightBySlug | null;
  lookupStateBySlug?: SbtPassiveLatestLookupStateBySlug | null;
  researchStep?: unknown;
  sbtRealtimeCoverageBySlug?: Record<string, unknown> | null;
  sessionChipStateBySlug?: Record<string, SbtPassiveLatestLookupChipState | undefined> | null;
};

const normalizeResearchStep = (value: unknown): number => {
  const numeric = Number(value || 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.floor(numeric));
  }
  return 50;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

export const buildSbtListPassiveLatestLookupPlan = ({
  chipLoadingStatusBySlug = {},
  getSessionProgressSnapshot = () => null,
  lookupInFlightBySlug = {},
  lookupStateBySlug = {},
  researchStep = 50,
  sbtRealtimeCoverageBySlug = {},
  sessionChipStateBySlug = {},
}: BuildSbtListPassiveLatestLookupPlanArgs = {}): SbtPassiveLatestLookupPlan => {
  const normalizedResearchStep = normalizeResearchStep(researchStep);
  const lookupState = asRecord(lookupStateBySlug);
  const lookupInFlight = asRecord(lookupInFlightBySlug);
  const realtimeCoverage = asRecord(sbtRealtimeCoverageBySlug);
  const chipStates = asRecord(sessionChipStateBySlug);
  const loadingTargets: Record<string, number> = {};

  Object.entries(asRecord(chipLoadingStatusBySlug)).forEach(([slugRaw, status]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;
    if (!status) return;
    const chipState = chipStates[slug] as SbtPassiveLatestLookupChipState | undefined;
    if (!chipState?.isLoading) return;
    const snapshot = getSessionProgressSnapshot(slug);
    if (!snapshot) return;
    if (Number(snapshot.liveLatestBlock || 0) > 0) return;
    if (realtimeCoverage[slug]) return;

    loadingTargets[slug] = Math.max(
      0,
      Number(snapshot.displayCurrentBlock || 0),
      Number(snapshot.liveCurrentBlock || 0),
      Number(snapshot.lastBlock || 0)
    );
  });

  const loadingSlugs = new Set(Object.keys(loadingTargets));
  const staleSlugs = Object.keys(lookupState).filter((slugRaw) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    return !loadingSlugs.has(slug);
  });
  const requests = Object.entries(loadingTargets).reduce<SbtPassiveLatestLookupRequest[]>(
    (acc, [slug, currentWatermark]) => {
      const existingState = lookupState[slug] as SbtPassiveLatestLookupState | undefined;
      const lastRequestedAtBlock = Number(existingState?.lastRequestedAtBlock || 0);
      const needsInitialLookup = existingState == null;
      const crossedResearchThreshold = (
        existingState != null &&
        Number(currentWatermark || 0) >= (lastRequestedAtBlock + normalizedResearchStep)
      );
      if (!needsInitialLookup && !crossedResearchThreshold) return acc;
      if (lookupInFlight[slug]) return acc;
      acc.push({ slug, currentWatermark: Number(currentWatermark || 0) });
      return acc;
    },
    []
  );

  return { requests, staleSlugs };
};
