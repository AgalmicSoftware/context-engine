import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListChipProgressBooleanBySlug = Record<string, boolean | undefined>;

export type SbtListChipProgressChipState = {
  isLoading?: boolean;
};

export type SbtListChipProgressVisibilityMeta = {
  lastModeChangeAtMs?: number;
  pendingVisible?: boolean;
  timerId?: ReturnType<typeof setTimeout> | null;
  visible?: boolean;
};

export type SbtListChipProgressStatus = {
  chipRemainingText?: string;
  hasLatest?: boolean;
  progressPct?: number;
};

export type SbtListChipProgressStyle = Record<string, string | number | undefined> & {
  background?: string;
};

export type SbtListChipProgressDisplayPlan = {
  indeterminate: boolean;
  progressText: string;
  progressWidth: string;
  showProgress: boolean;
  style?: SbtListChipProgressStyle;
};

export type SbtListChipProgressVisibilityAction =
  | { type: 'remove'; slug: string }
  | { type: 'initialize'; slug: string; visible: boolean }
  | { type: 'sync-pending'; slug: string; visible: boolean }
  | { type: 'commit'; slug: string; visible: boolean }
  | { type: 'keep-timer'; slug: string; visible: boolean }
  | { type: 'schedule'; delayMs: number; slug: string; visible: boolean };

export type SbtListChipProgressVisibilityPlan = {
  actions: SbtListChipProgressVisibilityAction[];
};

type BuildSbtListChipProgressDesiredVisibilityBySlugArgs = {
  allSessionsMode?: unknown;
  chipLoadingStatusBySlug?: Record<string, unknown> | null;
  sessionChipStateBySlug?: Record<string, SbtListChipProgressChipState | undefined> | null;
};

type ResolveSbtListChipProgressVisibilityPlanArgs = {
  desiredVisibilityBySlug?: SbtListChipProgressBooleanBySlug | null;
  metaBySlug?: Record<string, SbtListChipProgressVisibilityMeta | undefined> | null;
  minVisibleMs?: unknown;
  nowMs?: unknown;
};

type BuildSbtListChipProgressDisplayPlanArgs = {
  isLoading?: unknown;
  status?: SbtListChipProgressStatus | null;
};

const asRecord = <TValue = unknown>(value: unknown): Record<string, TValue> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, TValue>) : {};

const normalizePositiveInteger = (value: unknown): number => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const normalizeBooleanMap = (
  source: SbtListChipProgressBooleanBySlug | null | undefined,
): SbtListChipProgressBooleanBySlug => {
  const out: SbtListChipProgressBooleanBySlug = {};
  Object.entries(asRecord<boolean | undefined>(source)).forEach(([slugRaw, visible]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;
    out[slug] = !!visible;
  });
  return out;
};

const normalizeMetaMap = (
  source: Record<string, SbtListChipProgressVisibilityMeta | undefined> | null | undefined,
): Record<string, SbtListChipProgressVisibilityMeta | undefined> => {
  const out: Record<string, SbtListChipProgressVisibilityMeta | undefined> = {};
  Object.entries(asRecord<SbtListChipProgressVisibilityMeta | undefined>(source)).forEach(([slugRaw, meta]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;
    out[slug] = meta;
  });
  return out;
};

export const buildSbtListChipProgressDesiredVisibilityBySlug = ({
  allSessionsMode = false,
  chipLoadingStatusBySlug = {},
  sessionChipStateBySlug = {},
}: BuildSbtListChipProgressDesiredVisibilityBySlugArgs = {}): SbtListChipProgressBooleanBySlug => {
  if (!allSessionsMode) return {};
  const chipStates = asRecord<SbtListChipProgressChipState | undefined>(sessionChipStateBySlug);
  const out: SbtListChipProgressBooleanBySlug = {};

  Object.entries(asRecord(chipLoadingStatusBySlug)).forEach(([slugRaw, status]) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug) || !status) return;
    const chipState = chipStates[slug];
    out[slug] = !!chipState?.isLoading;
  });

  return out;
};

export const buildSbtListChipProgressDisplayPlan = ({
  isLoading = false,
  status = null,
}: BuildSbtListChipProgressDisplayPlanArgs = {}): SbtListChipProgressDisplayPlan => {
  const hasStatus = !!status;
  const hasLatest = !!status?.hasLatest;
  const showProgress = hasStatus && !!isLoading;
  const progressWidth = showProgress ? (hasLatest ? `${Math.max(6, Number(status?.progressPct || 0))}%` : '35%') : '0%';
  const style = showProgress
    ? {
        '--ce-chip-progress-width': progressWidth,
        background: `linear-gradient(90deg, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) 0%, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) ${progressWidth}, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) ${progressWidth}, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) 100%)`,
      }
    : undefined;

  return {
    indeterminate: !hasLatest,
    progressText: String(status?.chipRemainingText || ''),
    progressWidth,
    showProgress,
    style,
  };
};

export const resolveSbtListChipProgressVisibilityPlan = ({
  desiredVisibilityBySlug = {},
  metaBySlug = {},
  minVisibleMs = 0,
  nowMs = 0,
}: ResolveSbtListChipProgressVisibilityPlanArgs = {}): SbtListChipProgressVisibilityPlan => {
  const desired = normalizeBooleanMap(desiredVisibilityBySlug);
  const meta = normalizeMetaMap(metaBySlug);
  const desiredSlugs = new Set(Object.keys(desired));
  const knownSlugs = new Set([...Object.keys(meta), ...Object.keys(desired)]);
  const normalizedNowMs = normalizePositiveInteger(nowMs);
  const normalizedMinVisibleMs = normalizePositiveInteger(minVisibleMs);
  const actions: SbtListChipProgressVisibilityAction[] = [];

  knownSlugs.forEach((slugRaw) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;

    if (!desiredSlugs.has(slug)) {
      actions.push({ type: 'remove', slug });
      return;
    }

    const desiredVisible = !!desired[slug];
    const existingMeta = meta[slug];
    if (!existingMeta) {
      actions.push({ type: 'initialize', slug, visible: desiredVisible });
      return;
    }

    if (!!existingMeta.visible === desiredVisible) {
      actions.push({ type: 'sync-pending', slug, visible: desiredVisible });
      return;
    }

    const elapsedMs = normalizedNowMs - Number(existingMeta.lastModeChangeAtMs || 0);
    if (elapsedMs >= normalizedMinVisibleMs) {
      actions.push({ type: 'commit', slug, visible: desiredVisible });
      return;
    }

    if (existingMeta.timerId && existingMeta.pendingVisible === desiredVisible) {
      actions.push({ type: 'keep-timer', slug, visible: desiredVisible });
      return;
    }

    actions.push({
      type: 'schedule',
      delayMs: Math.max(0, normalizedMinVisibleMs - elapsedMs),
      slug,
      visible: desiredVisible,
    });
  });

  return { actions };
};
