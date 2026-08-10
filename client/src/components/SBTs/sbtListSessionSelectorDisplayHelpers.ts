import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  buildSbtListChipProgressDisplayPlan,
  type SbtListChipProgressDisplayPlan,
  type SbtListChipProgressStatus,
  type SbtListChipProgressStyle,
} from './sbtListChipProgressVisibilityHelpers';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListSessionSelectorChipState = {
  isLoaded?: unknown;
};

export type SbtListSessionSelectorRouteConfig = {
  __registry?: {
    sessionId?: unknown;
    sessionIdHex?: unknown;
  };
  sessionId?: unknown;
  sessionIdHex?: unknown;
};

export type SbtListSessionSelectorOption = {
  active: boolean;
  checkTestId: string;
  chipTestId: string;
  general: boolean;
  href: string;
  indeterminate: boolean;
  key: string;
  label: string;
  loaded: boolean;
  openTestId: string;
  openTitle: string;
  progressFillTestId: string;
  progressText: string;
  progressTextTestId: string;
  progressTrackTestId: string;
  progressWrapTestId: string;
  rowTestId: string;
  selected: boolean;
  showOpen: boolean;
  showProgress: boolean;
  slug: string;
  style?: SbtListChipProgressStyle;
};

type BuildSbtListSessionRouteHrefArgs = {
  getSessionConfig?: ((slug: string) => SbtListSessionSelectorRouteConfig | null | undefined) | null;
  publicBasePath?: unknown;
  slug?: unknown;
};

type BuildSbtListSessionSelectorOptionsArgs = {
  activeSessionSlug?: unknown;
  buildChipProgressDisplayPlan?:
    | ((args: { isLoading?: unknown; status?: SbtListChipProgressStatus | null }) => SbtListChipProgressDisplayPlan)
    | null;
  buildSessionRouteHref?: ((slug: string) => string) | null;
  chipLoadingStatusBySlug?: Record<string, SbtListChipProgressStatus | null | undefined> | null;
  chipProgressVisibilityBySlug?: Record<string, unknown> | null;
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  labelForSessionSlug?: ((slug: string) => unknown) | null;
  selectedSessionUniverseSlugs?: Set<unknown> | unknown[];
  sessionChipStateBySlug?: Record<string, SbtListSessionSelectorChipState | undefined> | null;
};

type ResolveSbtListSessionSelectorSummarySlugsArgs = {
  isListModeScopeEnabled?: unknown;
  listSlug?: unknown;
  selectedSessionUniverseSlugs?: unknown;
};

const asRecord = <TValue = unknown>(value: unknown): Record<string, TValue> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, TValue>) : {};

const normalizeSlugSet = (value: Set<unknown> | unknown[] | undefined): Set<string> => {
  if (value instanceof Set) {
    return new Set(Array.from(value).map((slug) => normalizeSessionSlug(slug || '')));
  }
  if (Array.isArray(value)) {
    return new Set(value.map((slug) => normalizeSessionSlug(slug || '')));
  }
  return new Set();
};

const appendPublicBasePath = (publicBasePath: unknown, pathIn: unknown): string => {
  const basePath = String(publicBasePath || '');
  const normalizedPath = String(pathIn || '').trim();
  if (!normalizedPath) return basePath || '/';
  return `${basePath}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}` || normalizedPath;
};

export const buildSbtListSessionRouteHref = ({
  getSessionConfig = null,
  publicBasePath = '',
  slug = '',
}: BuildSbtListSessionRouteHrefArgs = {}): string => {
  const normalized = normalizeSessionSlug(slug || '');
  if (isSbtListSyntheticNoSessionSlug(normalized)) return '';
  const cfg = typeof getSessionConfig === 'function' ? getSessionConfig(normalized) : null;
  const routeToken = String(
    cfg?.__registry?.sessionId || cfg?.__registry?.sessionIdHex || cfg?.sessionId || cfg?.sessionIdHex || '',
  ).trim();

  if (routeToken) {
    return appendPublicBasePath(publicBasePath, `/session/${encodeURIComponent(routeToken)}`);
  }
  if (!normalized) return appendPublicBasePath(publicBasePath, '/session');
  return appendPublicBasePath(publicBasePath, `/session/${encodeURIComponent(normalized)}`);
};

export const resolveSbtListSessionSelectorSummarySlugs = ({
  isListModeScopeEnabled = false,
  listSlug = '',
  selectedSessionUniverseSlugs = [],
}: ResolveSbtListSessionSelectorSummarySlugsArgs = {}): string[] =>
  isListModeScopeEnabled
    ? Array.isArray(selectedSessionUniverseSlugs)
      ? selectedSessionUniverseSlugs.map((slug) => normalizeSessionSlug(slug || ''))
      : Array.from(normalizeSlugSet(selectedSessionUniverseSlugs as Set<unknown>))
    : [normalizeSessionSlug(listSlug || '')];

export const buildSbtListSessionSelectorOptions = ({
  activeSessionSlug = '',
  buildChipProgressDisplayPlan = buildSbtListChipProgressDisplayPlan,
  buildSessionRouteHref = null,
  chipLoadingStatusBySlug = {},
  chipProgressVisibilityBySlug = {},
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  labelForSessionSlug = (slug: string) => slug || 'General',
  selectedSessionUniverseSlugs = [],
  sessionChipStateBySlug = {},
}: BuildSbtListSessionSelectorOptionsArgs = {}): SbtListSessionSelectorOption[] => {
  const selectedSet = normalizeSlugSet(selectedSessionUniverseSlugs);
  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const chipStates = asRecord<SbtListSessionSelectorChipState | undefined>(sessionChipStateBySlug);
  const progressVisibility = asRecord(chipProgressVisibilityBySlug);
  const loadingStatuses = asRecord<SbtListChipProgressStatus | null | undefined>(chipLoadingStatusBySlug);
  const slugs = Array.isArray(displayedSessionUniverseSlugs) ? displayedSessionUniverseSlugs : [];

  return slugs.map((slugRaw) => {
    const normalized = normalizeSessionSlug(slugRaw || '');
    const isSelected = isListModeScopeEnabled ? selectedSet.has(normalized) : normalized === activeSlug;
    const chipState = chipStates[normalized];
    const isLoading = !!progressVisibility[normalized];
    const chipLoadingStatus = loadingStatuses[normalized] || null;
    const chipProgressPlan = (buildChipProgressDisplayPlan || buildSbtListChipProgressDisplayPlan)({
      isLoading,
      status: chipLoadingStatus,
    });
    const sessionRouteHref = typeof buildSessionRouteHref === 'function' ? buildSessionRouteHref(normalized) : '';
    const label = String(labelForSessionSlug ? labelForSessionSlug(normalized) : normalized || 'General');
    const testSlug = normalized || 'general';

    return {
      active: !isListModeScopeEnabled && isSelected,
      checkTestId: `session-chip-check-${testSlug}`,
      chipTestId: `session-chip-${testSlug}`,
      general: normalized === '',
      href: sessionRouteHref,
      indeterminate: chipProgressPlan.indeterminate,
      key: String(slugRaw || 'general'),
      label,
      loaded: !!chipState?.isLoaded,
      openTestId: `session-chip-open-${testSlug}`,
      openTitle: `Open session ${label} in new tab`,
      progressFillTestId: `session-chip-progress-fill-${testSlug}`,
      progressText: chipProgressPlan.progressText,
      progressTextTestId: `session-chip-progress-text-${testSlug}`,
      progressTrackTestId: `session-chip-progress-track-${testSlug}`,
      progressWrapTestId: `session-chip-progress-wrap-${testSlug}`,
      rowTestId: `session-chip-row-${testSlug}`,
      selected: isSelected,
      showOpen: !!sessionRouteHref,
      showProgress: chipProgressPlan.showProgress,
      slug: normalized,
      style: chipProgressPlan.style,
    };
  });
};
