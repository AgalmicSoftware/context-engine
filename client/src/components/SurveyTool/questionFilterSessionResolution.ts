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
  sessionSlugPinned?: boolean;
};

type ResolveQuestionFilterSessionContextInput = QuestionFilterSessionInput & {
  resolveBySlug?: ResolveSessionConfigBySlug;
  sessionConfig?: unknown;
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
  sessionSlugPinned,
}: QuestionFilterSessionInput = {}): QuestionFilterSessionSource => {
  // A route alias may differ from the canonical Worker slug supplied by the session shell.
  if (sessionSlugPinned === true) {
    return { sessionSlug: readPrioritizedPropSlug(sessionSlug ?? activeSessionSlug ?? '') };
  }

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
  sessionConfig,
  ...input
}: ResolveQuestionFilterSessionContextInput = {}): SessionResolutionResult => {
  const source = buildQuestionFilterSessionSource(input);
  const requestedSlug = resolveCanonicalSessionConfig({ source }).sessionSlug;
  const config =
    sessionConfig && typeof sessionConfig === 'object' && !Array.isArray(sessionConfig)
      ? (sessionConfig as Record<string, unknown>)
      : null;
  const configSlug = resolveCanonicalSessionConfig({
    source: { sessionSlug: config?.slug ?? config?.sessionSlug ?? '' },
  }).sessionSlug;
  // Worker bootstrap configs arrive through props, outside the registry cache.
  // Only reuse them for the selected session; stale props must not route AI elsewhere.
  return resolveCanonicalSessionConfig({
    source: { ...source, ...(config && configSlug === requestedSlug ? { sessionConfig: config } : {}) },
    resolveBySlug,
  }) as SessionResolutionResult;
};
