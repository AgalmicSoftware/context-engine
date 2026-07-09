import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListRealtimeProgressRecord = Record<string, unknown> & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  updatedAtMs?: unknown;
};

export type SbtListRealtimeProgressBySlug = Record<string, SbtListRealtimeProgressRecord | undefined>;

export type SbtListRealtimeProgressInputPlan = {
  propSlugs: string[];
  updatesBySlug: SbtListRealtimeProgressBySlug;
  validSlugs: string[];
};

export type SbtListRealtimeProgressRetentionPlan = {
  changed: boolean;
  nextProgressBySlug: SbtListRealtimeProgressBySlug;
  nextPruneAtMs: number | null;
  prunedSlugs: string[];
};

type BuildSbtListRealtimeProgressInputPlanArgs = {
  nowMs?: unknown;
  progressBySlug?: unknown;
};

type ResolveSbtListRealtimeProgressRetentionPlanArgs = {
  activeSlugs?: unknown;
  bridgeMs?: unknown;
  nowMs?: unknown;
  progressBySlug?: SbtListRealtimeProgressBySlug | null;
};

const isRealtimeProgressRecord = (value: unknown): value is SbtListRealtimeProgressRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeProgressNowMs = (value: unknown): number => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const normalizeBridgeMs = (value: unknown): number => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const normalizeSlugSet = (slugs: unknown): Set<string> => {
  const source = Array.isArray(slugs) ? slugs : [];
  return new Set(
    source
      .map((slugRaw) => normalizeSessionSlug(slugRaw || ''))
      .filter((slug) => !isSbtListSyntheticNoSessionSlug(slug)),
  );
};

export const buildSbtListRealtimeProgressInputPlan = ({
  nowMs = 0,
  progressBySlug = {},
}: BuildSbtListRealtimeProgressInputPlanArgs = {}): SbtListRealtimeProgressInputPlan => {
  const progressRecord = isRealtimeProgressRecord(progressBySlug) ? progressBySlug : {};
  const normalizedNowMs = normalizeProgressNowMs(nowMs);
  const propSlugSet = new Set<string>();
  const validSlugSet = new Set<string>();
  const updatesBySlug: SbtListRealtimeProgressBySlug = {};

  Object.entries(progressRecord).forEach(([slugRaw, progressRaw]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;
    if (slug) propSlugSet.add(slug);
    const progress = isRealtimeProgressRecord(progressRaw) ? progressRaw : null;
    if (!progress) return;

    const currentBlock = Number(progress.currentBlock || 0);
    const latestBlock = Number(progress.latestBlock || 0);
    if ((!Number.isFinite(currentBlock) || currentBlock <= 0) && (!Number.isFinite(latestBlock) || latestBlock <= 0)) {
      return;
    }

    validSlugSet.add(slug);
    updatesBySlug[slug] = {
      ...progress,
      currentBlock: Number.isFinite(currentBlock) ? Math.floor(currentBlock) : 0,
      latestBlock: Number.isFinite(latestBlock) ? Math.floor(latestBlock) : 0,
      updatedAtMs: normalizedNowMs,
    };
  });

  return {
    propSlugs: Array.from(propSlugSet),
    updatesBySlug,
    validSlugs: Array.from(validSlugSet),
  };
};

export const resolveSbtListRealtimeProgressRetentionPlan = ({
  activeSlugs = [],
  bridgeMs = 0,
  nowMs = 0,
  progressBySlug = {},
}: ResolveSbtListRealtimeProgressRetentionPlanArgs = {}): SbtListRealtimeProgressRetentionPlan => {
  const normalizedNowMs = normalizeProgressNowMs(nowMs);
  const normalizedBridgeMs = normalizeBridgeMs(bridgeMs);
  const activeSlugSet = normalizeSlugSet(activeSlugs);
  const source = isRealtimeProgressRecord(progressBySlug) ? progressBySlug : {};
  const nextProgressBySlug: SbtListRealtimeProgressBySlug = {};
  const prunedSlugs: string[] = [];
  let nextPruneAtMs: number | null = null;

  Object.entries(source).forEach(([slugRaw, progressRaw]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;
    const progress = isRealtimeProgressRecord(progressRaw) ? progressRaw : null;
    if (!progress) return;

    if (activeSlugSet.has(slug)) {
      nextProgressBySlug[slug] = progress;
      return;
    }

    const updatedAtMs = Number(progress.updatedAtMs || 0);
    const ageMs = normalizedNowMs - updatedAtMs;
    if (ageMs > normalizedBridgeMs) {
      prunedSlugs.push(slug);
      return;
    }

    nextProgressBySlug[slug] = progress;
    if (updatedAtMs > 0) {
      const expiryAtMs = updatedAtMs + normalizedBridgeMs;
      if (expiryAtMs > normalizedNowMs) {
        nextPruneAtMs = nextPruneAtMs == null ? expiryAtMs : Math.min(nextPruneAtMs, expiryAtMs);
      }
    }
  });

  return {
    changed: prunedSlugs.length > 0,
    nextProgressBySlug,
    nextPruneAtMs,
    prunedSlugs,
  };
};
