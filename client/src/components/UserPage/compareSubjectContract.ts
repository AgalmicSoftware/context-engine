import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

export type CompareSubjectKind = 'wallet' | 'worker' | 'sim';

export type CompareSubject = {
  kind: CompareSubjectKind;
  id: string;
  key: string;
  token: string;
};

type ResolveCompareRouteSubjectsOptions = {
  firstSubject?: unknown;
  pathname?: unknown;
  search?: unknown;
};

type BuildCompareSubjectsRoutePathOptions = {
  search?: unknown;
  sessionSlug?: unknown;
  subjects?: unknown[];
};

const SUBJECT_PREFIX_RE = /^([a-z]+):(.*)$/i;
const WALLET_ID_RE = /^0x[0-9a-fA-F]{40}$/;
const SUBJECT_KINDS = new Set<CompareSubjectKind>(['wallet', 'worker', 'sim']);

const normalizeSubjectId = (kind: CompareSubjectKind, rawId: unknown): string => {
  const id = String(rawId || '').trim();
  const hasControlCharacter = Array.from(id).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!id || id.length > 256 || hasControlCharacter) return '';
  if (kind === 'wallet') {
    if (!WALLET_ID_RE.test(id) && !id.toLowerCase().endsWith('.eth')) return '';
    return id.toLowerCase();
  }
  return id;
};

const parseCompareSubject = (rawToken: unknown, { allowLegacyWallet = true } = {}): CompareSubject | null => {
  const value = String(rawToken || '').trim();
  if (!value) return null;
  const match = value.match(SUBJECT_PREFIX_RE);
  const explicitKind = String(match?.[1] || '').toLowerCase() as CompareSubjectKind;
  const kind = SUBJECT_KINDS.has(explicitKind) ? explicitKind : allowLegacyWallet && !match ? 'wallet' : null;
  if (!kind) return null;
  const id = normalizeSubjectId(kind, match ? match[2] : value);
  if (!id) return null;
  const token = `${kind}:${id}`;
  return {
    kind,
    id,
    key: kind === 'wallet' || kind === 'sim' ? token.toLowerCase() : token,
    token,
  };
};

const normalizeCompareSubjects = (values: unknown[] = []): CompareSubject[] => {
  const seen = new Set<string>();
  const subjects: CompareSubject[] = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const subject = parseCompareSubject(value);
    if (!subject || seen.has(subject.key)) return;
    seen.add(subject.key);
    subjects.push(subject);
  });
  return subjects;
};

const readCompareSubjectsFromSearch = (search: unknown = ''): CompareSubject[] => {
  try {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    return normalizeCompareSubjects(params.getAll('subject'));
  } catch {
    return [];
  }
};

const readLegacyCompareSubjectsFromPath = (pathname: unknown = ''): CompareSubject[] => {
  const path = String(pathname || '').split('?')[0];
  const rawPath = path.replace(/^\/compare\/?/, '');
  if (!rawPath || rawPath === path) return [];
  return normalizeCompareSubjects(
    rawPath.split('&').map((value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }),
  );
};

export const resolveCompareRouteSubjects = ({
  firstSubject,
  pathname = '',
  search = '',
}: ResolveCompareRouteSubjectsOptions = {}): CompareSubject[] => {
  const querySubjects = readCompareSubjectsFromSearch(search);
  if (querySubjects.length > 0) return querySubjects;
  const legacySubjects = readLegacyCompareSubjectsFromPath(pathname);
  if (legacySubjects.length > 0) return legacySubjects;
  return normalizeCompareSubjects([firstSubject]);
};

export const buildCompareSubjectsRoutePath = ({
  search = '',
  sessionSlug = '',
  subjects = [],
}: BuildCompareSubjectsRoutePathOptions = {}): string => {
  const normalizedSubjects = normalizeCompareSubjects(subjects);
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  params.delete('subject');
  params.delete('subjects');
  normalizedSubjects.forEach((subject) => params.append('subject', subject.token));
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  if (normalizedSessionSlug) params.set('session', normalizedSessionSlug);
  const query = params.toString();
  return `/compare${query ? `?${query}` : ''}`;
};
