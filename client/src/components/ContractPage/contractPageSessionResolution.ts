import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { resolveSessionConfigAliases, resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';

type SessionConfigLike = {
  __unresolved?: boolean;
  slug?: string;
  sessionName?: string;
} & Record<string, unknown>;

type ResolveBySlug = ((slug: string) => SessionConfigLike | null | undefined) | null | undefined;
type GetDefaultSessionConfig = (() => SessionConfigLike | null | undefined) | null | undefined;

type ResolveContractPageSessionConfigOptions = {
  allowGeneral?: boolean;
  resolveBySlug?: ResolveBySlug;
  resolveDemoBySlug?: ResolveBySlug;
  getDefaultSessionConfig?: GetDefaultSessionConfig;
};

type ResolveContractPageActiveSessionOptions = {
  urlSlugLike?: unknown;
  querySessionRaw?: unknown;
  activeSessionSlug?: unknown;
  reduxActiveSessionSlug?: unknown;
  referrerSlug?: unknown;
  resolveBySlug?: ResolveBySlug;
  resolveDemoBySlug?: ResolveBySlug;
  getDefaultSessionConfig?: GetDefaultSessionConfig;
};

const resolveBySlugReader = (resolveBySlug: ResolveBySlug): ResolveBySlug =>
  typeof resolveBySlug === 'function'
    ? (slug: string) => {
        const sessionConfig = resolveBySlug(slug);
        return sessionConfig && !sessionConfig.__unresolved ? sessionConfig : null;
      }
    : null;

export const resolveContractPageSessionConfig = (
  slugLike: unknown,
  {
    allowGeneral = false,
    resolveBySlug,
    resolveDemoBySlug,
    getDefaultSessionConfig,
  }: ResolveContractPageSessionConfigOptions = {},
): SessionConfigLike | null => {
  const sessionSlug = canonicalizeSessionSlug(slugLike);
  if (!sessionSlug && !allowGeneral) return null;

  const readDemoBySlug = resolveBySlugReader(resolveDemoBySlug);
  const resolved = resolveSessionConfigAliases(
    { sessionSlug },
    { resolveBySlug: resolveBySlugReader(resolveBySlug) },
  ) as { sessionConfig: unknown; sessionSlug: string };
  if (resolved.sessionConfig) return resolved.sessionConfig as SessionConfigLike;

  if (!sessionSlug) {
    if (typeof getDefaultSessionConfig === 'function') {
      const defaultSessionConfig = getDefaultSessionConfig();
      if (defaultSessionConfig) return defaultSessionConfig;
    }
    return readDemoBySlug ? (readDemoBySlug('') ?? null) : null;
  }
  return readDemoBySlug ? (readDemoBySlug(resolved.sessionSlug || sessionSlug) ?? null) : null;
};

export const resolveContractPageReferrerSlug = (referrer: unknown = ''): string => {
  const value = toStr(referrer).trim();
  if (!value) return '';

  try {
    return resolveSessionSlugFromPathname(new URL(value).pathname) || '';
  } catch (_) {
    return resolveSessionSlugFromPathname(value) || '';
  }
};

export const resolveContractPageActiveSession = ({
  urlSlugLike,
  querySessionRaw,
  activeSessionSlug,
  reduxActiveSessionSlug,
  referrerSlug,
  resolveBySlug,
  resolveDemoBySlug,
  getDefaultSessionConfig,
}: ResolveContractPageActiveSessionOptions = {}): SessionConfigLike | null => {
  let cachedDefaultSessionConfig: SessionConfigLike | null | undefined;
  const readDefaultSessionConfig = (): SessionConfigLike | null => {
    if (typeof getDefaultSessionConfig !== 'function') return null;
    if (typeof cachedDefaultSessionConfig === 'undefined') {
      cachedDefaultSessionConfig = getDefaultSessionConfig();
    }
    return cachedDefaultSessionConfig ?? null;
  };
  const resolveSessionConfig = (
    slugLike: unknown,
    options: Pick<ResolveContractPageSessionConfigOptions, 'allowGeneral'> = {},
  ): SessionConfigLike | null =>
    resolveContractPageSessionConfig(slugLike, {
      ...options,
      resolveBySlug,
      resolveDemoBySlug,
      getDefaultSessionConfig: readDefaultSessionConfig,
    });

  return (
    (urlSlugLike ? resolveSessionConfig(urlSlugLike) : null) ||
    (querySessionRaw != null ? resolveSessionConfig(querySessionRaw, { allowGeneral: true }) : null) ||
    (activeSessionSlug !== undefined
      ? resolveSessionConfig(activeSessionSlug, { allowGeneral: activeSessionSlug === '' })
      : null) ||
    (reduxActiveSessionSlug !== undefined
      ? resolveSessionConfig(reduxActiveSessionSlug, { allowGeneral: reduxActiveSessionSlug === '' })
      : null) ||
    (referrerSlug ? resolveSessionConfig(referrerSlug) : null) ||
    readDefaultSessionConfig()
  );
};
