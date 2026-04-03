import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import {
  resolveSessionConfigAliases,
  resolveSessionSlugFromPathname,
} from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';

const resolveBySlugReader = (resolveBySlug) => (
  typeof resolveBySlug === 'function'
    ? (slug) => {
        const sessionConfig = resolveBySlug(slug);
        return sessionConfig && !sessionConfig.__unresolved ? sessionConfig : null;
      }
    : null
);

export const resolveContractPageSessionConfig = (slugLike, {
  allowGeneral = false,
  resolveBySlug,
  resolveDemoBySlug,
  getDefaultSessionConfig,
} = {}) => {
  const sessionSlug = canonicalizeSessionSlug(slugLike);
  if (!sessionSlug && !allowGeneral) return null;

  const readDemoBySlug = resolveBySlugReader(resolveDemoBySlug);
  const resolved = resolveSessionConfigAliases(
    { sessionSlug },
    { resolveBySlug: resolveBySlugReader(resolveBySlug) }
  );
  if (resolved.sessionConfig) return resolved.sessionConfig;

  if (!sessionSlug) {
    if (typeof getDefaultSessionConfig === 'function') {
      const defaultSessionConfig = getDefaultSessionConfig();
      if (defaultSessionConfig) return defaultSessionConfig;
    }
    return readDemoBySlug ? readDemoBySlug('') : null;
  }
  return readDemoBySlug ? readDemoBySlug(resolved.sessionSlug || sessionSlug) : null;
};

export const resolveContractPageReferrerSlug = (referrer = '') => {
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
} = {}) => {
  let cachedDefaultSessionConfig;
  const readDefaultSessionConfig = () => {
    if (typeof getDefaultSessionConfig !== 'function') return null;
    if (typeof cachedDefaultSessionConfig === 'undefined') {
      cachedDefaultSessionConfig = getDefaultSessionConfig();
    }
    return cachedDefaultSessionConfig;
  };
  const resolveSessionConfig = (slugLike, options = {}) => resolveContractPageSessionConfig(slugLike, {
    ...options,
    resolveBySlug,
    resolveDemoBySlug,
    getDefaultSessionConfig: readDefaultSessionConfig,
  });

  return (
    (urlSlugLike ? resolveSessionConfig(urlSlugLike) : null) ||
    (querySessionRaw != null
      ? resolveSessionConfig(querySessionRaw, { allowGeneral: true })
      : null) ||
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
