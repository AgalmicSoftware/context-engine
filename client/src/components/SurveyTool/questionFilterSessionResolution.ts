import { resolveCanonicalSessionConfig } from '../../utilities/session/canonicalSessionContext.js';
import { resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { ResolveSessionConfigBySlug, SessionResolutionResult } from '../shellTypes';

type QuestionFilterSessionSource = {
  sessionSlug?: string;
  activeSessionSlug?: string;
};

type QuestionFilterSessionInput = {
  pathname?: unknown;
  activeSessionSlug?: unknown;
  sessionSlug?: unknown;
};

type ResolveQuestionFilterSessionContextInput = QuestionFilterSessionInput & {
  resolveBySlug?: ResolveSessionConfigBySlug;
};

const readPrioritizedPropSlug = (rawSlug: unknown): string => {
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
}: QuestionFilterSessionInput = {}): QuestionFilterSessionSource => {
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

export const resolveQuestionFilterEffectiveSlug = (input: QuestionFilterSessionInput = {}): string =>
  resolveCanonicalSessionConfig({
    source: buildQuestionFilterSessionSource(input),
  }).sessionSlug || '';

export const resolveQuestionFilterSessionContext = ({
  resolveBySlug,
  ...input
}: ResolveQuestionFilterSessionContextInput = {}): SessionResolutionResult =>
  resolveCanonicalSessionConfig({
    source: buildQuestionFilterSessionSource(input),
    resolveBySlug,
  }) as SessionResolutionResult;
