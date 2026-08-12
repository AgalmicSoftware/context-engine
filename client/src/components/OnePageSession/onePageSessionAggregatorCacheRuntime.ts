import {
  isQuestionAllowedByAuthoritativePool,
  normalizeAuthoritativeQuestionPoolId,
  resolveAuthoritativeQuestionPoolScope,
} from '../SurveyTool/surveyAuthoritativeQuestionPool';
import {
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  hasSimulatedDemoResponses,
  resolveDemoPolisDataset,
} from '../../utilities/demo/demoPolisDatasets';
import { getDemoFixtureQuestionIdsByIndex } from '../../utilities/session/demoSessionQuestionFixtures.js';
import { buildPolisDemoSurveyResultsAggregatorData } from '../SurveyTool/surveyPolisDemoResultsData';
import {
  buildAggregatorFromLocalCache,
  computeAggregatorDataSignature,
  computeAggregatorQuestionMetadataSignature,
  computeAggregatorSourceSnapshotSignature,
} from './onePageSessionAggregator';
import { normalizeOnePageSessionSlug } from './onePageSessionTelegramController';

type AggregatorResultRow = {
  responder: string;
  questionId: string;
  response: string;
};

type AggregatorResultMap = Record<string, AggregatorResultRow[]>;

type OnePageSessionAggregatorCacheBuildParams = {
  cacheScope: string;
  displaySlug: string;
  isQuestionCacheReady: boolean;
  parseMemo?: Map<string, unknown> | null;
  questionSourceSlug: string;
  readQuestionsCache: (slug: string) => any;
  resolveQuestionPool: (displaySlug: string, questionSourceSlug: string) => Array<Record<string, unknown>>;
  workerCacheIdentity: WorkerCanonicalCacheIdentity | null;
  writeQuestionsCache: (slug: string, cache: unknown) => void;
};

export type OnePageSessionAggregatorCacheBuildResult = {
  map: AggregatorResultMap;
  signature: string;
  sourceSignature: string;
};

const demoFixtureAggregatorRowsBySlug = new Map<string, AggregatorResultMap>();

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
  if (
    normalizedDisplaySlug === 'demo' &&
    (normalizedQuestionSourceSlug === '' || normalizedQuestionSourceSlug === 'demo')
  ) {
    return true;
  }
  return (
    hasSimulatedDemoResponses(normalizedDisplaySlug) &&
    (normalizedQuestionSourceSlug === '' || normalizedQuestionSourceSlug === normalizedDisplaySlug)
  );
};

export const buildDemoFixtureAggregatorRows = (
  displaySlugIn: unknown = '',
  questionSourceSlugIn: unknown = displaySlugIn,
): AggregatorResultMap | null => {
  const displaySlug = normalizeOnePageSessionSlug(displaySlugIn);
  const questionSourceSlug = normalizeOnePageSessionSlug(questionSourceSlugIn);
  if (
    !hasSimulatedDemoResponses(displaySlug) ||
    (questionSourceSlug !== '' && questionSourceSlug !== displaySlug)
  ) {
    return null;
  }

  if (!demoFixtureAggregatorRowsBySlug.has(displaySlug)) {
    demoFixtureAggregatorRowsBySlug.set(
      displaySlug,
      buildPolisDemoSurveyResultsAggregatorData(resolveDemoPolisDataset(displaySlug), {
        sessionSlug: displaySlug,
        questionIdsByIndex: getDemoFixtureQuestionIdsByIndex(displaySlug),
      }),
    );
  }
  return demoFixtureAggregatorRowsBySlug.get(displaySlug) || null;
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

export const mergeAggregatorResultRows = (
  target: AggregatorResultMap = {},
  source: AggregatorResultMap = {},
  { sourceWinsResponderCollisions = false }: { sourceWinsResponderCollisions?: boolean } = {},
) => {
  const nextTarget = target && typeof target === 'object' ? target : {};
  if (!source || typeof source !== 'object') return nextTarget;

  Object.keys(source).forEach((qid) => {
    const rows = Array.isArray(source[qid]) ? source[qid] : [];
    if (rows.length === 0) {
      if (!nextTarget[qid]) nextTarget[qid] = [];
      return;
    }
    nextTarget[qid] = Array.isArray(nextTarget[qid]) ? nextTarget[qid] : [];
    if (sourceWinsResponderCollisions) {
      const sourceResponders = new Set(
        rows
          .map((row) => String(row?.responder || '').trim().toLowerCase())
          .filter(Boolean),
      );
      nextTarget[qid] = nextTarget[qid].filter(
        (row) => !sourceResponders.has(String(row?.responder || '').trim().toLowerCase()),
      );
    }
    const seenRows = new Set(nextTarget[qid].map((row) => `${row?.responder || ''}|${row?.response || ''}`));
    rows.forEach((row) => {
      const key = `${row?.responder || ''}|${row?.response || ''}`;
      if (seenRows.has(key)) return;
      seenRows.add(key);
      nextTarget[qid].push(row);
    });
  });

  return nextTarget;
};

export const buildOnePageSessionAggregatorCacheResult = ({
  cacheScope,
  displaySlug,
  isQuestionCacheReady,
  parseMemo = null,
  questionSourceSlug,
  readQuestionsCache,
  resolveQuestionPool,
  workerCacheIdentity,
  writeQuestionsCache,
}: OnePageSessionAggregatorCacheBuildParams): OnePageSessionAggregatorCacheBuildResult => {
  const useDemoFallback = shouldUseBuiltInDemoAggregatorFallback(displaySlug, questionSourceSlug);
  const fixtureRows = useDemoFallback ? buildDemoFixtureAggregatorRows(displaySlug, questionSourceSlug) : null;
  const fixtureSignature = fixtureRows ? computeAggregatorDataSignature(fixtureRows) : '';
  const sourcePrefix = `${displaySlug}|${questionSourceSlug}|${cacheScope}|${workerCacheIdentity?.key || ''}`;
  const emptyResult = (reason: string): OnePageSessionAggregatorCacheBuildResult => ({
    map: {},
    signature: '0:0:0',
    sourceSignature: `${sourcePrefix}|${reason}`,
  });

  if (!cacheScope || (!isQuestionCacheReady && !useDemoFallback)) {
    return fixtureRows
      ? { map: fixtureRows, signature: fixtureSignature, sourceSignature: `${sourcePrefix}|fixture:${fixtureSignature}` }
      : emptyResult('not-ready');
  }
  if (cacheScope === 'worker' && !workerCacheIdentity) return emptyResult('invalid-worker-identity');

  const aggregateMap: AggregatorResultMap = {};
  const sourceSigParts: string[] = [];
  const questionPool = useDemoFallback ? resolveQuestionPool(displaySlug, questionSourceSlug) : [];
  const authoritativePool =
    questionPool.length > 0 ? questionPool : Object.keys(fixtureRows || {}).map((id) => ({ id }));
  let sawCandidateCache = false;
  let sawNetworkCache = false;

  if (fixtureRows) {
    mergeAggregatorResultRows(aggregateMap, fixtureRows);
    sourceSigParts.push(`fixture:${fixtureSignature}`);
  }

  for (const slug of useDemoFallback
    ? getUniqueAggregatorCandidateSlugs(displaySlug)
    : [normalizeOnePageSessionSlug(questionSourceSlug)]) {
    let questionsCache = readQuestionsCache(slug) || {};
    if (!questionsCache || typeof questionsCache !== 'object') questionsCache = {};
    if (Object.keys(questionsCache).length === 0) {
      sourceSigParts.push(`${slug || '__general__'}:empty-cache`);
      continue;
    }
    sawCandidateCache = true;

    const networkNode = questionsCache[cacheScope];
    if (!networkNode) {
      sourceSigParts.push(`${slug || '__general__'}:missing-net`);
      continue;
    }
    if (workerCacheIdentity && !workerCanonicalCacheIdentityMatches(networkNode, workerCacheIdentity)) {
      sourceSigParts.push(`${slug || '__general__'}:worker-identity-mismatch`);
      continue;
    }
    sawNetworkCache = true;

    const fallbackQuestions = buildAggregatorFallbackQuestions(authoritativePool, slug);
    const networkNodeForAggregation = useDemoFallback
      ? scopeAggregatorNetworkNodeToQuestionPool(networkNode, fallbackQuestions, slug)
      : networkNode;
    sourceSigParts.push(
      [
        slug || '__general__',
        computeAggregatorSourceSnapshotSignature(networkNodeForAggregation.questionResponses || {}),
        computeAggregatorQuestionMetadataSignature(networkNodeForAggregation.questions || {}),
      ].join(':'),
    );

    const { map, dirty } = buildAggregatorFromLocalCache(networkNodeForAggregation, {
      parseMemo,
      sessionSlug: slug,
    });
    // Regression guard: fixture rows are display-only; live rows must win same-responder collisions without persistence.
    mergeAggregatorResultRows(aggregateMap, map, { sourceWinsResponderCollisions: !!fixtureRows });
    if (dirty) {
      if (workerCacheIdentity) {
        questionsCache[cacheScope] = withWorkerCanonicalCacheIdentity(networkNode, workerCacheIdentity);
      }
      writeQuestionsCache(slug, questionsCache);
    }
  }

  if (!sawCandidateCache && !fixtureRows) return emptyResult('empty-cache');
  if (!sawNetworkCache && !fixtureRows) {
    return emptyResult(sourceSigParts.join('|') || 'missing-net');
  }
  return {
    map: aggregateMap,
    signature: computeAggregatorDataSignature(aggregateMap),
    sourceSignature: `${sourcePrefix}|${sourceSigParts.join('|')}`,
  };
};
