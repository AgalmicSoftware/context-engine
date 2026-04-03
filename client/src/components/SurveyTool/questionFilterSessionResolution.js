import { resolveCanonicalSessionConfig } from '../../utilities/session/canonicalSessionContext.js';
import { resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';

const readPrioritizedPropSlug = (rawSlug) => {
  const value = toStr(rawSlug).trim();
  if (!value) return '';
  const resolved = resolveCanonicalSessionConfig({
    source: { sessionSlug: value },
  });
  return resolved.sessionSlug || '';
};

const buildQuestionFilterSessionSource = ({
  pathname,
  activeSessionSlug,
  sessionSlug,
} = {}) => {
  const routeSlug = resolveSessionSlugFromPathname(pathname);
  if (routeSlug !== null) {
    return { sessionSlug: routeSlug };
  }

  const prioritizedActiveSlug = readPrioritizedPropSlug(activeSessionSlug);
  if (prioritizedActiveSlug) {
    return { activeSessionSlug: prioritizedActiveSlug };
  }

  const prioritizedSessionSlug = readPrioritizedPropSlug(sessionSlug);
  if (prioritizedSessionSlug) {
    return { sessionSlug: prioritizedSessionSlug };
  }

  return {};
};

export const resolveQuestionFilterEffectiveSlug = (input = {}) => (
  resolveCanonicalSessionConfig({
    source: buildQuestionFilterSessionSource(input),
  }).sessionSlug || ''
);

export const resolveQuestionFilterSessionContext = ({
  resolveBySlug,
  ...input
} = {}) => resolveCanonicalSessionConfig({
  source: buildQuestionFilterSessionSource(input),
  resolveBySlug,
});
