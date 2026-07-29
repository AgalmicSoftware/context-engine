import {
  isQuestionAllowedByAuthoritativePool,
  normalizeAuthoritativeQuestionPoolId,
  resolveAuthoritativeQuestionPoolScope,
} from '../SurveyTool/surveyAuthoritativeQuestionPool';
import {
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import { normalizeOnePageSessionSlug } from './onePageSessionTelegramController';

const hasOwn = (value: unknown, key: string) =>
  !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);

export const resolveOnePageSessionSurveySlug = (props: Record<string, unknown> | string = '') => {
  const propsRecord = props && typeof props === 'object' ? props : {};
  const sessionConfig =
    propsRecord.sessionConfig && typeof propsRecord.sessionConfig === 'object'
      ? (propsRecord.sessionConfig as Record<string, unknown>)
      : {};
  if (hasOwn(propsRecord, 'questionSessionSlug')) {
    return normalizeOnePageSessionSlug(propsRecord.questionSessionSlug);
  }
  if (hasOwn(sessionConfig, 'slug')) {
    return normalizeOnePageSessionSlug(sessionConfig.slug);
  }
  return normalizeOnePageSessionSlug(propsRecord.slug || '');
};

export const resolveOnePageSessionWorkerCacheIdentity = (
  props: Record<string, unknown> = {},
  cacheScope: unknown = '',
): WorkerCanonicalCacheIdentity | null => {
  if (String(cacheScope || '') !== 'worker') return null;
  try {
    return resolveWorkerCanonicalCacheIdentity({
      sessionConfig: props.sessionConfig,
      sessionSlug: resolveOnePageSessionSurveySlug(props),
    });
  } catch {
    return null;
  }
};

export const getUniqueAggregatorCandidateSlugs = (...slugs: unknown[]) => {
  const seen = new Set<string>();
  return slugs
    .map((value) => normalizeOnePageSessionSlug(value))
    .filter((value) => {
      const key = value || '__general__';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const shouldUseBuiltInDemoAggregatorFallback = (displaySlug: unknown = '', questionSourceSlug: unknown = '') => {
  const normalizedDisplaySlug = normalizeOnePageSessionSlug(displaySlug);
  const normalizedQuestionSourceSlug = normalizeOnePageSessionSlug(questionSourceSlug);
  return (
    normalizedDisplaySlug === 'demo' && (normalizedQuestionSourceSlug === '' || normalizedQuestionSourceSlug === 'demo')
  );
};

export const buildAggregatorFallbackQuestions = (
  questionPool: Array<Record<string, unknown>> = [],
  sessionSlug: unknown = '',
) => {
  const out: Record<string, Record<string, unknown>> = {};
  const normalizedSessionSlug = normalizeOnePageSessionSlug(sessionSlug);
  (Array.isArray(questionPool) ? questionPool : []).forEach((entry) => {
    const questionId = String(entry?.id || '').trim();
    if (!questionId) return;
    out[questionId.toLowerCase()] = {
      creator: '',
      tags: [],
      ...entry,
      id: questionId,
      sessionSlug: normalizedSessionSlug,
      sessionSlugExplicit: true,
    };
  });
  return out;
};

export const scopeAggregatorNetworkNodeToQuestionPool = (
  networkNode: any = {},
  fallbackQuestions: Record<string, any> = {},
  sessionSlug: any = '',
) => {
  const fallbackQuestionPool = Object.values(fallbackQuestions || {});
  const scope = resolveAuthoritativeQuestionPoolScope(fallbackQuestionPool, sessionSlug);
  if (!scope) return networkNode;

  const nextQuestions: Record<string, any> = {};
  const sourceQuestions = networkNode?.questions || {};
  Object.keys(sourceQuestions).forEach((qid) => {
    const question = sourceQuestions[qid];
    if (!isQuestionAllowedByAuthoritativePool(question, qid, scope)) return;
    const questionId = String(question?.id || qid || '').trim();
    if (!questionId) return;
    nextQuestions[questionId.toLowerCase()] = {
      ...question,
      id: questionId,
    };
  });
  Object.keys(fallbackQuestions || {}).forEach((qid) => {
    const questionId = normalizeAuthoritativeQuestionPoolId(qid);
    if (!questionId || nextQuestions[questionId]) return;
    nextQuestions[questionId] = fallbackQuestions[qid];
  });

  const nextQuestionResponses: Record<string, any> = {};
  const sourceQuestionResponses = networkNode?.questionResponses || {};
  Object.keys(sourceQuestionResponses).forEach((qid) => {
    const questionId = normalizeAuthoritativeQuestionPoolId(qid);
    if (!questionId || !nextQuestions[questionId]) return;
    nextQuestionResponses[qid] = sourceQuestionResponses[qid];
  });

  return {
    ...networkNode,
    questions: nextQuestions,
    questionResponses: nextQuestionResponses,
  };
};

export const mergeAggregatorResultRows = (target: Record<string, any[]> = {}, source: any = {}) => {
  const nextTarget = target && typeof target === 'object' ? target : {};
  if (!source || typeof source !== 'object') return nextTarget;

  Object.keys(source).forEach((qid) => {
    const rows = Array.isArray(source[qid]) ? source[qid] : [];
    if (rows.length === 0) {
      if (!nextTarget[qid]) nextTarget[qid] = [];
      return;
    }
    nextTarget[qid] = Array.isArray(nextTarget[qid]) ? nextTarget[qid] : [];
    const seenRows = new Set(nextTarget[qid].map((row: any) => `${row?.responder || ''}|${row?.response || ''}`));
    rows.forEach((row: any) => {
      const key = `${row?.responder || ''}|${row?.response || ''}`;
      if (seenRows.has(key)) return;
      seenRows.add(key);
      nextTarget[qid].push(row);
    });
  });

  return nextTarget;
};
