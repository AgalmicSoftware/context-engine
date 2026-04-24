import {
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { createLogger } from 'utilities/logging.js';

const surveyLog = createLogger('surveys');

export const readPathSearch = (path = ''): string => {
  const value = String(path || '');
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(queryIndex) : '';
};

export const hasExplicitSessionQueryPinInPath = (path = ''): boolean => {
  const search = readPathSearch(path);
  return (
    parseQuestionSessionSlugFromSearch(search) !== null ||
    parseQuestionSessionIdFromSearch(search) !== null
  );
};

export const appendExplicitSessionHintToPath = (pathIn = '', sessionSlugIn = ''): string => {
  const path = String(pathIn || '');
  const sessionSlug = normalizeSessionSlug(sessionSlugIn);
  if (!path || !sessionSlug || hasExplicitSessionQueryPinInPath(path)) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}session=${encodeURIComponent(sessionSlug)}`;
};

export function applyExistingGroupPrefix(newPath: string): string {
  try {
    if (hasExplicitSessionQueryPinInPath(newPath)) return newPath;
    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const pathOnly = pathname.split('?')[0].split('#')[0];
    const segs = pathOnly.split('/').filter(Boolean);
    const RESERVED = new Set(['questions', 'question', 'survey', 'surveys']);
    if (segs.length >= 2 && !RESERVED.has(segs[0])) {
      const base = `/${segs[0]}/${segs[1]}`;
      if (!newPath.startsWith(base)) {
        return `${base}${newPath.startsWith('/') ? '' : '/'}${newPath}`;
      }
    }
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
    return newPath;
  }
  return newPath;
}
