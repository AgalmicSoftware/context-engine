import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { toStr } from '../../utilities/shared/primitives.js';

type ResolveSbtSelectorSelectedSessionOptions = {
  sessionName?: unknown;
  sessionSlug?: unknown;
  activeSessionSlug?: unknown;
  resolveSessionSlugByName?: ((sessionName: string) => unknown) | null;
};

type ResolvedSbtSelectorSelectedSessionContext = {
  sessionName: string | null;
  sessionSlug: string;
};

export const resolveSbtSelectorSelectedSessionSlug = ({
  sessionName,
  sessionSlug,
  activeSessionSlug,
  resolveSessionSlugByName,
}: ResolveSbtSelectorSelectedSessionOptions = {}): string => {
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
}: ResolveSbtSelectorSelectedSessionOptions = {}): ResolvedSbtSelectorSelectedSessionContext => ({
  sessionName: toStr(sessionName).trim() || null,
  sessionSlug: resolveSbtSelectorSelectedSessionSlug({
    sessionName,
    sessionSlug,
    activeSessionSlug,
    resolveSessionSlugByName,
  }),
});
