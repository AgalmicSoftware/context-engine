import { resolveCanonicalSessionConfig } from '../../utilities/session/canonicalSessionContext.js';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import {
  normalizeSessionSlug,
  resolveSessionAliases,
  resolveSessionSlugFromPathname,
} from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type {
  NetworkLike,
  ResolveSessionConfigBySlug,
  SessionConfigLike,
  SessionResolutionResult,
} from '../shellTypes';

type UnknownRecord = Record<string, unknown>;

type SurveyToolSessionSource = {
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
};

type SurveyToolSessionInput = {
  pathname?: string;
  activeSessionSlug?: string | null;
  sessionSlug?: string | null;
  sessionSlugPinned?: boolean;
};

type SurveyToolNetworkScopedInput = {
  sessionSlug?: string | null;
  network?: NetworkLike;
  networkChainId?: string | number | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
  fallbackSessionSlugs?: string[] | string | null;
};

type SurveyToolScopedContext = SessionResolutionResult & {
  scopedSessionSlugs: string[];
  networkId: number | null;
  networkIdStr: string;
  networkSourceSlug: string;
};

const WORKER_CANONICAL_CACHE_SCOPE_KEY = 'worker';

const hasNonBlankValue = (value: unknown): boolean => toStr(value).trim() !== '';
const isPlainObject = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const readPositiveNumber = (value: unknown): number | null => {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num : null;
};
const normalizeQuestionIdList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((entry) => toStr(entry).trim().toLowerCase()).filter(Boolean)))
    : [];
const normalizeSessionSlugList = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const out: string[] = [];
  source.forEach((entry) => {
    const slug = normalizeSessionSlug(entry);
    if (slug == null) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

const resolveCanonicalSessionContext = ({
  source,
  resolveBySlug,
}: {
  source: SurveyToolSessionSource;
  resolveBySlug?: ResolveSessionConfigBySlug;
}): SessionResolutionResult =>
  resolveCanonicalSessionConfig({
    source,
    resolveBySlug,
  }) as SessionResolutionResult;

const readCanonicalExplicitSlug = (value: unknown): string =>
  resolveCanonicalSessionConfig({
    source: { sessionSlug: value },
  }).sessionSlug || '';

const buildSurveyToolSessionSource = ({
  pathname,
  activeSessionSlug,
  sessionSlug,
  sessionSlugPinned = false,
}: SurveyToolSessionInput = {}): SurveyToolSessionSource => {
  if (sessionSlugPinned === true) {
    return {
      sessionSlug: normalizeSessionSlug(sessionSlug ?? activeSessionSlug ?? ''),
    };
  }

  const routeSlug = resolveSessionSlugFromPathname(pathname);
  if (routeSlug !== null) {
    return { sessionSlug: routeSlug };
  }

  if (hasNonBlankValue(activeSessionSlug) || hasNonBlankValue(sessionSlug)) {
    return {
      sessionSlug: resolveSessionAliases({
        activeSessionSlug,
        sessionSlug,
      }).sessionSlug,
    };
  }

  return {};
};

const buildSurveyToolDraftSessionSource = ({
  effectiveDraftSlug,
  ...input
}: SurveyToolSessionInput & { effectiveDraftSlug?: string | null } = {}): SurveyToolSessionSource => {
  const baseSource = buildSurveyToolSessionSource(input);
  if (Object.keys(baseSource).length > 0) return baseSource;

  if (hasNonBlankValue(effectiveDraftSlug)) {
    return {
      sessionSlug: readCanonicalExplicitSlug(effectiveDraftSlug),
    };
  }

  return baseSource;
};

const resolveSurveyToolNetworkScopedSessionContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
  fallbackSessionSlugs,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext => {
  const resolved = resolveSurveyToolExplicitSessionContext({
    sessionSlug,
    resolveBySlug,
  });
  const scopedSessionSlugs = normalizeSessionSlugList([
    resolved.sessionSlug || normalizeSessionSlug(sessionSlug),
    ...(Array.isArray(fallbackSessionSlugs) ? fallbackSessionSlugs : []),
  ]);
  const projection = resolveSessionCapabilityProjection(resolved.sessionConfig);
  const workerCanonical = projection.profileValid && projection.isWorkerCanonical;
  // Concrete sessions get a chain only from their validated capability
  // contract. Wallet/default networks cannot promote a pure Worker, missing,
  // or invalid session into an on-chain response scope.
  let effectiveNetworkId = projection.showNetworkControls ? projection.chainId : null;
  let effectiveNetworkSourceSlug = effectiveNetworkId || workerCanonical ? resolved.sessionSlug : '';

  // Bare multi-session dashboards may adopt a chain from their configured
  // scan list, but only after that candidate proves its own capabilities.
  // Explicit missing/invalid sessions and Worker-canonical sessions remain
  // fail-closed instead of borrowing a wallet or another session's chain.
  if (
    resolved.sessionSlug === '' &&
    effectiveNetworkId == null &&
    !workerCanonical &&
    typeof resolveBySlug === 'function'
  ) {
    for (const fallbackSlug of scopedSessionSlugs) {
      const fallbackResolved =
        fallbackSlug === resolved.sessionSlug
          ? resolved
          : resolveSurveyToolExplicitSessionContext({
              sessionSlug: fallbackSlug,
              resolveBySlug,
            });
      const fallbackProjection = resolveSessionCapabilityProjection(fallbackResolved.sessionConfig);
      const fallbackNetworkId = fallbackProjection.showNetworkControls ? fallbackProjection.chainId : null;
      if (fallbackNetworkId == null) continue;
      effectiveNetworkId = fallbackNetworkId;
      effectiveNetworkSourceSlug = fallbackResolved.sessionSlug || fallbackSlug || '';
      break;
    }
  }

  // The empty-slug "general" record is a standalone tool template rather
  // than a configured session contract, so it may continue to use the
  // operator-selected network. An explicitly invalid profile still fails
  // closed because it projects as invalid_profile rather than missing.
  if (resolved.sessionSlug === '' && projection.source === 'missing' && effectiveNetworkId == null) {
    effectiveNetworkId =
      readPositiveNumber(networkChainId) ?? readPositiveNumber(network?.id) ?? readPositiveNumber(network?.chainId);
  }

  return {
    ...resolved,
    scopedSessionSlugs,
    networkId: effectiveNetworkId,
    networkIdStr: effectiveNetworkId
      ? String(effectiveNetworkId)
      : workerCanonical
        ? WORKER_CANONICAL_CACHE_SCOPE_KEY
        : '',
    networkSourceSlug: effectiveNetworkSourceSlug,
  };
};

const mergeSurveyToolResponseGateSessionConfig = ({
  resolvedSessionConfig,
  providedSessionConfig,
  sessionSlug,
}: {
  resolvedSessionConfig?: SessionConfigLike | null;
  providedSessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
} = {}): SessionConfigLike | null => {
  const canonicalConfig = isPlainObject(resolvedSessionConfig) ? resolvedSessionConfig : null;
  const overlayConfig = isPlainObject(providedSessionConfig) ? providedSessionConfig : null;

  if (!canonicalConfig && !overlayConfig) return null;
  if (!overlayConfig) return canonicalConfig;

  // Some SurveyTool callers pass a display-only subset in props.sessionConfig.
  // Merge it on top of the strictly resolved config without reintroducing
  // default/general fallback for unresolved explicit slugs.
  const merged: SessionConfigLike = { ...(canonicalConfig || {}), ...overlayConfig };

  if (canonicalConfig?.lit || overlayConfig?.lit) {
    merged.lit = { ...(canonicalConfig?.lit || {}), ...(overlayConfig?.lit || {}) };
  }

  if (canonicalConfig?.__registry || overlayConfig?.__registry) {
    merged.__registry = {
      ...(canonicalConfig?.__registry || {}),
      ...(overlayConfig?.__registry || {}),
      gatesByResource: {
        ...((canonicalConfig?.__registry && canonicalConfig.__registry.gatesByResource) || {}),
        ...((overlayConfig?.__registry && overlayConfig.__registry.gatesByResource) || {}),
      },
    };
  }

  const canonicalSponsored = isPlainObject(canonicalConfig?.sponsored) ? canonicalConfig.sponsored : null;
  const overlaySponsored = isPlainObject(overlayConfig?.sponsored) ? overlayConfig.sponsored : null;
  if (canonicalSponsored || overlaySponsored) {
    merged.sponsored = {
      ...(canonicalSponsored || {}),
      ...(overlaySponsored || {}),
      gates: {
        ...((canonicalSponsored && canonicalSponsored.gates) || {}),
        ...((overlaySponsored && overlaySponsored.gates) || {}),
      },
      resources: {
        ...((canonicalSponsored && canonicalSponsored.resources) || {}),
        ...((overlaySponsored && overlaySponsored.resources) || {}),
      },
    };
    if (!merged.sponsored.defaultGateId) {
      merged.sponsored.defaultGateId = canonicalSponsored?.defaultGateId || overlaySponsored?.defaultGateId || '';
    }
  }

  if (!merged.networkChainId) {
    merged.networkChainId = canonicalConfig?.networkChainId || overlayConfig?.networkChainId || null;
  }

  if (!merged.slug && hasNonBlankValue(sessionSlug)) {
    merged.slug = sessionSlug;
  }

  return merged;
};

export const resolveSurveyToolEffectiveSlug = (input: SurveyToolSessionInput = {}): string =>
  resolveCanonicalSessionContext({
    source: buildSurveyToolSessionSource(input),
  }).sessionSlug || '';

export const resolveSurveyToolDraftSessionContext = ({
  resolveBySlug,
  ...input
}: SurveyToolSessionInput & {
  effectiveDraftSlug?: string | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
} = {}): SessionResolutionResult =>
  resolveCanonicalSessionContext({
    source: buildSurveyToolDraftSessionSource(input),
    resolveBySlug,
  });

export const resolveSurveyToolExplicitSessionContext = ({
  sessionSlug,
  resolveBySlug,
}: {
  sessionSlug?: string | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
} = {}): SessionResolutionResult =>
  resolveCanonicalSessionContext({
    source: {
      sessionSlug: normalizeSessionSlug(sessionSlug),
    },
    resolveBySlug,
  });

export const resolveSurveyToolResponseGateSessionContext = ({
  sessionSlug,
  sessionConfig,
  resolveBySlug,
}: {
  sessionSlug?: string | null;
  sessionConfig?: SessionConfigLike | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
} = {}): SessionResolutionResult & {
  effectiveSessionConfig: SessionConfigLike | null;
} => {
  const providedProjection = resolveSessionCapabilityProjection(sessionConfig);
  const providedWorkerBoundary = claimsWorkerCanonicalAuthority(sessionConfig);
  const providedWorkerCanonical =
    providedWorkerBoundary && providedProjection.profileValid && providedProjection.isWorkerCanonical;
  const resolved = resolveCanonicalSessionContext({
    source: {
      sessionSlug: normalizeSessionSlug(sessionSlug),
      ...(providedWorkerBoundary ? { sessionConfig } : {}),
    },
    resolveBySlug: providedWorkerBoundary ? undefined : resolveBySlug,
  });

  return {
    ...resolved,
    effectiveSessionConfig: providedWorkerBoundary
      ? providedWorkerCanonical
        ? resolved.sessionConfig
        : null
      : mergeSurveyToolResponseGateSessionConfig({
          resolvedSessionConfig: resolved.sessionConfig,
          providedSessionConfig: sessionConfig,
          sessionSlug: resolved.sessionSlug,
        }),
  };
};

export const resolveSurveyToolQuestionConfigContext = ({
  sessionSlug,
  resolveBySlug,
}: {
  sessionSlug?: string | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
} = {}): SessionResolutionResult & {
  blockedQuestionIds: string[];
  highlightedQuestionIds: string[];
} => {
  const resolved = resolveSurveyToolExplicitSessionContext({
    sessionSlug,
    resolveBySlug,
  });
  const sessionConfig = isPlainObject(resolved.sessionConfig) ? resolved.sessionConfig : null;

  return {
    ...resolved,
    blockedQuestionIds: normalizeQuestionIdList(sessionConfig?.BLOCKED_QUESTION_IDS),
    highlightedQuestionIds: normalizeQuestionIdList(sessionConfig?.HIGHLIGHTED_QUESTION_IDS),
  };
};

export const resolveSurveyToolLockAudienceSessionNameContext = ({
  sessionSlug,
  resolveBySlug,
}: {
  sessionSlug?: string | null;
  resolveBySlug?: ResolveSessionConfigBySlug;
} = {}): SessionResolutionResult & {
  sessionName: string;
} => {
  const resolved = resolveSurveyToolExplicitSessionContext({
    sessionSlug,
    resolveBySlug,
  });
  const sessionConfig = isPlainObject(resolved.sessionConfig) ? resolved.sessionConfig : null;
  const sessionName = hasNonBlankValue(sessionConfig?.sessionName)
    ? toStr(sessionConfig?.sessionName).trim()
    : hasNonBlankValue(sessionConfig?.slug)
      ? toStr(sessionConfig?.slug).trim()
      : '';

  return {
    ...resolved,
    sessionName,
  };
};

export const resolveSurveyToolDraftStorageContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolResponseHydrationContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolQuestionBootstrapContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolDecryptHydrationContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolResponseJsonContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolQuestionReadCacheContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolQuestionsDashboardLoadContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
  fallbackSessionSlugs,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
    fallbackSessionSlugs,
  });

export const resolveSurveyToolQuestionPayloadCacheWriteContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolEnsureQuestionCachedContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolQuestionCountContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
  fallbackSessionSlugs,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
    fallbackSessionSlugs,
  });

export const resolveSurveyToolIdLookupContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolSurveyReadContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolUpdateCacheContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolSubmittedCacheWriteContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolPileWarmSeedContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolPileLoadContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolPileResponseReadContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext =>
  resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });

export const resolveSurveyToolPileFilterContext = ({
  sessionSlug,
  network,
  networkChainId,
  resolveBySlug,
}: SurveyToolNetworkScopedInput = {}): SurveyToolScopedContext & {
  blockedQuestionIds: string[];
  highlightedQuestionIds: string[];
} => {
  const resolved = resolveSurveyToolNetworkScopedSessionContext({
    sessionSlug,
    network,
    networkChainId,
    resolveBySlug,
  });
  const sessionConfig = isPlainObject(resolved.sessionConfig) ? resolved.sessionConfig : null;

  return {
    ...resolved,
    blockedQuestionIds: normalizeQuestionIdList(sessionConfig?.BLOCKED_QUESTION_IDS),
    highlightedQuestionIds: normalizeQuestionIdList(sessionConfig?.HIGHLIGHTED_QUESTION_IDS),
  };
};
