export type AuthoritativeQuestionPoolScope = {
  ids: Set<string>;
  byId: Map<string, any>;
  sessionSlug: string;
};

export const normalizeAuthoritativeQuestionPoolSlug = (value: unknown = ''): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const normalizeAuthoritativeQuestionPoolId = (value: unknown = ''): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const resolveAuthoritativeQuestionPoolScope = (
  questionPool: unknown = [],
  sessionSlug: unknown = '',
): AuthoritativeQuestionPoolScope | null => {
  if (!Array.isArray(questionPool) || questionPool.length === 0) return null;
  const normalizedSessionSlug = normalizeAuthoritativeQuestionPoolSlug(sessionSlug);
  const ids = new Set<string>();
  const byId = new Map<string, any>();

  for (const entry of questionPool as any[]) {
    const questionId = normalizeAuthoritativeQuestionPoolId(entry?.id);
    if (!questionId) continue;
    if (entry?.sessionSlugExplicit !== true) return null;
    if (normalizeAuthoritativeQuestionPoolSlug(entry?.sessionSlug) !== normalizedSessionSlug) return null;
    ids.add(questionId);
    if (!byId.has(questionId)) byId.set(questionId, entry);
  }

  if (ids.size === 0) return null;
  return { ids, byId, sessionSlug: normalizedSessionSlug };
};

export const isQuestionAllowedByAuthoritativePool = (
  question: any = null,
  fallbackQuestionId: unknown = '',
  scope: AuthoritativeQuestionPoolScope | null = null,
): boolean => {
  if (!scope) return true;
  const questionId = normalizeAuthoritativeQuestionPoolId(question?.id || fallbackQuestionId);
  if (questionId && scope.ids.has(questionId)) return true;
  if (question?.sessionSlugExplicit !== true) return false;
  return normalizeAuthoritativeQuestionPoolSlug(question?.sessionSlug) === scope.sessionSlug;
};

export const filterQuestionsByAuthoritativePool = <T extends any>(
  questions: T[] = [],
  scope: AuthoritativeQuestionPoolScope | null = null,
): T[] => {
  if (!scope) return Array.isArray(questions) ? questions : [];
  return (Array.isArray(questions) ? questions : []).filter((question: any) =>
    isQuestionAllowedByAuthoritativePool(question, question?.id, scope),
  );
};

export const appendMissingAuthoritativePoolQuestions = <T extends any>(
  questions: T[] = [],
  scope: AuthoritativeQuestionPoolScope | null = null,
  blockedQuestionIds: Set<string> | null = null,
): T[] => {
  const base = Array.isArray(questions) ? [...questions] : [];
  if (!scope) return base;
  const seen = new Set(base.map((question: any) => normalizeAuthoritativeQuestionPoolId(question?.id)).filter(Boolean));
  scope.byId.forEach((entry, questionId) => {
    if (!questionId || seen.has(questionId)) return;
    if (blockedQuestionIds?.has(questionId)) return;
    seen.add(questionId);
    base.push(entry);
  });
  return base;
};
