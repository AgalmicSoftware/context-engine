import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

export type UserPageEffectiveAiConfigRequest = {
  sessionSlug: string;
  thinking: boolean;
  resolveSecrets: boolean;
};

export type UserPageEffectiveAiConfigResult = {
  provider?: unknown;
  model?: unknown;
};

export type UserPageEffectiveAiConfigGetter = (
  request: UserPageEffectiveAiConfigRequest,
) => Promise<UserPageEffectiveAiConfigResult | null | undefined>;

export type UserPageAnalysisAiContextLogger = {
  warn?: (...args: unknown[]) => void;
};

export type ResolveUserPageAnalysisAiContextArgs = {
  getEffectiveAiConfig?: UserPageEffectiveAiConfigGetter;
  logger?: UserPageAnalysisAiContextLogger;
  sessionConfig?: UserPageUnknownRecord;
  sessionSlug?: unknown;
};

type UserPageSessionConfigReader = (slug: string) => unknown;
type UserPageSessionSlugByNameReader = (sessionName: unknown) => unknown;
type UserPageDeepScanSlugReader = (namespace: string) => unknown[];

export type ResolveUserPageAnalysisSessionConfigForSlugArgs = {
  getSessionConfigBySlug?: UserPageSessionConfigReader;
  getSessionConfigBySlugOrDefault?: UserPageSessionConfigReader;
  slugIn?: unknown;
};

export type ResolveUserPageQuestionSourceSessionSlugArgs = {
  fallbackSlug?: unknown;
  getSessionSlugByName?: UserPageSessionSlugByNameReader;
  questionData?: unknown;
};

export type BuildUserPageAiSessionScopeContextArgs = {
  activeSessionSlug?: unknown;
  scanScope?: unknown;
  scanSlugs?: unknown;
};

export type BuildUserPageAiSessionSlugCandidatesArgs = {
  activeSessionSlug?: unknown;
  listNamespaceSlugs?: UserPageDeepScanSlugReader;
  namespaces?: string[];
  sbtList?: unknown;
  scopeContext?: UserPageAiSessionScopeContext | null;
};

export type BuildUserPageAnalysisExcludeSlugSetArgs = {
  excludeSlugs?: unknown;
};

export type UserPageAnalysisCandidateLogRow = {
  slug: unknown;
  status: unknown;
};

export type ResolveUserPageAnalysisSessionFallbackArgs = {
  activeCandidate?: unknown;
  checked?: unknown;
  firstUsable?: unknown;
};

export type UserPageAnalysisSessionFallback = {
  candidate: UserPageUnknownRecord;
  reason: string;
};

export type UserPageAiSessionScopeContext = {
  mode: string;
  strict: boolean;
  allowedSlugs: string[];
};

export const buildUserPageAiSessionScopeContext = ({
  activeSessionSlug = '',
  scanScope = '',
  scanSlugs = [],
}: BuildUserPageAiSessionScopeContextArgs = {}): UserPageAiSessionScopeContext => {
  const mode = String(scanScope || '')
    .trim()
    .toLowerCase();
  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const toList = (raw: unknown): string[] =>
    Array.isArray(raw) ? Array.from(new Set(raw.map((item: unknown) => normalizeSessionSlug(item || '')))) : [];
  if (mode === 'general') {
    return { mode, strict: true, allowedSlugs: [''] };
  }
  if (mode === 'active') {
    return { mode, strict: !!activeSlug, allowedSlugs: activeSlug ? [activeSlug] : [] };
  }
  if (mode === 'list') {
    const list = toList(scanSlugs);
    return { mode, strict: list.length > 0, allowedSlugs: list };
  }
  return { mode: mode || 'all', strict: false, allowedSlugs: [] };
};

export const buildUserPageAiSessionSlugCandidates = ({
  activeSessionSlug = '',
  listNamespaceSlugs = () => [],
  namespaces = ['userCache', 'surveysCache', 'questionsCache', 'sbtCache'],
  sbtList = [],
  scopeContext = null,
}: BuildUserPageAiSessionSlugCandidatesArgs = {}): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (rawSlug: unknown): void => {
    const slug = normalizeSessionSlug(rawSlug || '');
    if (seen.has(slug)) return;
    seen.add(slug);
    ordered.push(slug);
  };

  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const resolvedScopeContext = scopeContext || buildUserPageAiSessionScopeContext({ activeSessionSlug });
  const allowedSlugs = Array.isArray(resolvedScopeContext.allowedSlugs) ? resolvedScopeContext.allowedSlugs : [];

  // Keep the actively viewed session eligible even when strict scan scope is narrower.
  push(activeSlug);
  allowedSlugs.forEach((slug: unknown) => push(slug));
  namespaces.forEach((namespace: string) => {
    listNamespaceSlugs(namespace).forEach((slug: unknown) => push(slug));
  });
  if (Array.isArray(sbtList)) {
    sbtList.forEach((item: unknown) => {
      const record = toAnalysisRecord(item);
      push(record.slug);
    });
  }
  if (!ordered.length) push('');
  if (!resolvedScopeContext.strict) return ordered;

  const allowed = new Set<string>(allowedSlugs);
  if (activeSlug) allowed.add(activeSlug);
  const filtered = ordered.filter((slug: string) => allowed.has(slug));
  return filtered.length > 0 ? filtered : ordered;
};

export const resolveUserPageQuestionSourceSessionSlug = ({
  questionData = null,
  fallbackSlug = '',
  getSessionSlugByName = () => null,
}: ResolveUserPageQuestionSourceSessionSlugArgs = {}): string => {
  const record = toAnalysisRecord(questionData);
  const explicitSlug = normalizeSessionSlug(
    record.sessionSlug ?? record._sessionSlug ?? record.groupSlug ?? record.session ?? '',
  );
  if (explicitSlug) return explicitSlug;

  const mappedNameSlug = getSessionSlugByName(record.sessionName);
  if (mappedNameSlug != null) return normalizeSessionSlug(mappedNameSlug);

  const nameSlug = normalizeSessionSlug(record.sessionName);
  if (nameSlug && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(nameSlug)) return nameSlug;

  return normalizeSessionSlug(fallbackSlug);
};

export const resolveUserPageAnalysisSessionConfigForSlug = ({
  getSessionConfigBySlug: readSessionConfig = () => null,
  getSessionConfigBySlugOrDefault: readDefaultSessionConfig = () => null,
  slugIn = '',
}: ResolveUserPageAnalysisSessionConfigForSlugArgs = {}): UserPageUnknownRecord | null => {
  const slug = normalizeSessionSlug(slugIn || '');
  const cfg = slug ? readSessionConfig(slug) : readDefaultSessionConfig('');
  return isPlainAnalysisObject(cfg) ? cfg : null;
};

export const buildUserPageAnalysisExcludeSlugSet = ({
  excludeSlugs = [],
}: BuildUserPageAnalysisExcludeSlugSetArgs = {}): Set<string> => {
  const list = Array.isArray(excludeSlugs) ? excludeSlugs.filter((slug: unknown) => slug != null) : [];
  return new Set<string>(list.map((slug: unknown) => normalizeSessionSlug(slug || '')));
};

export const resolveUserPageAnalysisSessionFallback = ({
  activeCandidate = null,
  checked = [],
  firstUsable = null,
}: ResolveUserPageAnalysisSessionFallbackArgs = {}): UserPageAnalysisSessionFallback | null => {
  const active = isPlainAnalysisObject(activeCandidate) ? activeCandidate : null;
  const usable = isPlainAnalysisObject(firstUsable) ? firstUsable : null;
  const checkedList = Array.isArray(checked)
    ? checked.filter((entry): entry is UserPageUnknownRecord => isPlainAnalysisObject(entry))
    : [];
  const fallback = active || usable || checkedList[0] || null;
  if (!fallback) return null;
  const reason =
    fallback === active
      ? 'fallback-active-session'
      : fallback === usable
        ? 'fallback-first-usable-session'
        : 'fallback-first-checked-session';
  return { candidate: fallback, reason };
};

export const buildUserPageAnalysisCandidateLogRows = (checked: unknown = []): UserPageAnalysisCandidateLogRow[] =>
  (Array.isArray(checked) ? checked : []).map((entry: unknown) => {
    const record = toAnalysisRecord(entry);
    return {
      slug: record.slug || 'general',
      status: record.status,
    };
  });

export const deriveAnalysisAiContextFromSessionConfig = (
  sessionSlug: unknown,
  sessionConfig: UserPageUnknownRecord = {},
) => {
  const ai = toAnalysisRecord(sessionConfig.ai);
  const models = toAnalysisRecord(ai.models);
  const modelProviders = toAnalysisRecord(ai.modelProviders);
  const thinkingModel = models.thinking || models.reasoning || models.default;
  const thinkingModelRecord = toAnalysisRecord(thinkingModel);
  const fallbackProvider =
    String(ai.mode || ai.provider || 'openai')
      .trim()
      .toLowerCase() || 'openai';
  const provider =
    String(
      (isPlainAnalysisObject(thinkingModel) ? thinkingModelRecord.provider : '') ||
        modelProviders.thinking ||
        modelProviders.reasoning ||
        modelProviders.default ||
        fallbackProvider,
    )
      .trim()
      .toLowerCase() || 'openai';
  const model =
    String(
      (isPlainAnalysisObject(thinkingModel)
        ? thinkingModelRecord.model || thinkingModelRecord.name || thinkingModelRecord.value
        : thinkingModel) || 'gpt-5',
    ).trim() || 'gpt-5';
  return {
    sessionSlug: String(sessionSlug || ''),
    provider,
    model,
  };
};

export const resolveUserPageAnalysisAiContext = async ({
  getEffectiveAiConfig,
  logger,
  sessionConfig = {},
  sessionSlug,
}: ResolveUserPageAnalysisAiContextArgs = {}) => {
  const fallback = deriveAnalysisAiContextFromSessionConfig(sessionSlug, sessionConfig);
  try {
    if (typeof getEffectiveAiConfig !== 'function') return fallback;
    const effective = await getEffectiveAiConfig({
      sessionSlug: String(sessionSlug || ''),
      thinking: true,
      resolveSecrets: false,
    });
    return {
      sessionSlug: String(sessionSlug || ''),
      provider:
        String(effective?.provider || fallback.provider || 'openai')
          .trim()
          .toLowerCase() || 'openai',
      model: String(effective?.model || fallback.model || 'gpt-5').trim() || 'gpt-5',
    };
  } catch (error) {
    logger?.warn?.('[UserPage] analysis AI context fallback:', error);
    return fallback;
  }
};
