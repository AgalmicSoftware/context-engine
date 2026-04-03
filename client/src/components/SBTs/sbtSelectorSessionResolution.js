import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const resolveSbtSelectorSelectedSessionSlug = ({
  sessionName,
  sessionSlug,
  activeSessionSlug,
  resolveSessionSlugByName,
} = {}) => {
  const trimmedSessionName = toStr(sessionName).trim();
  if (trimmedSessionName && typeof resolveSessionSlugByName === 'function') {
    const resolvedByName = resolveSessionSlugByName(trimmedSessionName);
    if (resolvedByName != null) return canonicalizeSessionSlug(resolvedByName);
  }

  const explicitSessionSlug = canonicalizeSessionSlug(sessionSlug);
  if (explicitSessionSlug) return explicitSessionSlug;

  return canonicalizeSessionSlug(activeSessionSlug);
};

export const resolveSbtSelectorSelectedSessionContext = ({
  sessionName,
  sessionSlug,
  activeSessionSlug,
  resolveSessionSlugByName,
} = {}) => ({
  sessionName: toStr(sessionName).trim() || null,
  sessionSlug: resolveSbtSelectorSelectedSessionSlug({
    sessionName,
    sessionSlug,
    activeSessionSlug,
    resolveSessionSlugByName,
  }),
});
