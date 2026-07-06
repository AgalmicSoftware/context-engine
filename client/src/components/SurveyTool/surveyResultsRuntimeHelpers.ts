import { createLogger } from 'utilities/logging.js';

import {
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import {
  stableSerializeSignatureValue,
} from './surveyResultsHelpers.js';
import type {
  SurveyResultsResponseRecord,
} from './surveyResultsLockedFieldHelpers';

type SurveyResultsRuntimeRecord = Record<string, unknown>;

const surveyLog = createLogger('surveys');

export function unifyAggregatorWithAllQuestionIDs(
  baseAggregator: Record<string, unknown[]> = {},
  allKnownQuestionIds: string[] = []
): Record<string, unknown[]> {
  const loweredMap: Record<string, unknown[]> = {};
  for (const key of Object.keys(baseAggregator)) {
    const lowerKey = key.toLowerCase();
    if (!loweredMap[lowerKey]) {
      loweredMap[lowerKey] = baseAggregator[key];
    } else {
      loweredMap[lowerKey] = loweredMap[lowerKey].concat(baseAggregator[key]);
    }
  }
  for (const qId of allKnownQuestionIds) {
    const qLower = qId.toLowerCase();
    if (!loweredMap[qLower]) {
      loweredMap[qLower] = [];
    }
  }
  return loweredMap;
}

export const readPathSearch = (path: unknown = ''): string => {
  const value = String(path || '');
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(queryIndex) : '';
};

export const hasExplicitSessionQueryPinInPath = (path: unknown = ''): boolean => {
  const search = readPathSearch(path);
  return (
    parseQuestionSessionSlugFromSearch(search) !== null ||
    parseQuestionSessionIdFromSearch(search) !== null
  );
};

export function applyExistingGroupPrefix(newPath: string): string {
  try {
    if (hasExplicitSessionQueryPinInPath(newPath)) return newPath;
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const pathOnly = p.split('?')[0].split('#')[0];
    const segs = pathOnly.split('/').filter(Boolean);
    const RESERVED: Set<string> = new Set(['questions','question','survey','surveys']);
    if (segs.length >= 2 && !RESERVED.has(segs[0])) {
      const base = `/${segs[0]}/${segs[1]}`;
      if (!newPath.startsWith(base)) {
        return `${base}${newPath.startsWith('/') ? '' : '/'}${newPath}`;
      }
    }
  } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
  return newPath;
}

export function resolveNetBucketReadOnly(
  cacheObj: unknown,
  netIdStr: unknown,
  fallbackValue: unknown
): unknown {
  const fallback = fallbackValue === undefined ? {} : fallbackValue;
  if (!cacheObj || typeof cacheObj !== 'object' || !netIdStr) return fallback;
  const bucket = (cacheObj as SurveyResultsRuntimeRecord)[String(netIdStr)];
  return (bucket && typeof bucket === 'object') ? bucket : fallback;
}

export const normalizeNonceKey = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getFilterStateSignature = (
  filterState: unknown
): string => serializeFilterState(filterState as SurveyResultsRuntimeRecord | null | undefined) || '';

export const areValuesEquivalentBySignature = (currentValue: unknown, nextValue: unknown): boolean => {
  if (currentValue === nextValue) return true;
  if (currentValue == null || nextValue == null) return currentValue === nextValue;
  if (typeof currentValue !== 'object' && typeof nextValue !== 'object') {
    return currentValue === nextValue;
  }
  return stableSerializeSignatureValue(currentValue) === stableSerializeSignatureValue(nextValue);
};

export const getResponseQuestionId = (obj: SurveyResultsResponseRecord | null | undefined): string => (
  String(obj?.questionID || obj?.questionId || '').trim()
);

export const getResponseQuestionPrompt = (
  obj: SurveyResultsResponseRecord | null | undefined,
  questionData: SurveyResultsRuntimeRecord | null = null
): unknown => (
  obj?.prompt || questionData?.prompt || ''
);

export const getResponseQuestionType = (
  obj: SurveyResultsResponseRecord | null | undefined,
  questionData: SurveyResultsRuntimeRecord | null = null
): unknown => (
  obj?.type || questionData?.type || ''
);
