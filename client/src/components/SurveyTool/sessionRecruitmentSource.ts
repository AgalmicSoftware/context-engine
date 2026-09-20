import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';

const STORAGE_PREFIX = 'ce:session-recruitment-source:v1:';

type StoredRecruitmentSource = {
  version: 1;
  source: string;
};

export const normalizeRecruitmentSource = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 128);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(normalized) ? normalized : '';
};

const storageKeyForSlug = (sessionSlug: unknown): string => {
  const slug = canonicalizeSessionSlug(String(sessionSlug || ''));
  return slug ? `${STORAGE_PREFIX}${slug}` : '';
};

const readSourceFromSearch = (search: string): string =>
  normalizeRecruitmentSource(new URLSearchParams(String(search || '').split('#')[0]).get('src'));

export const readSessionRecruitmentSource = (sessionSlug: unknown): string => {
  if (typeof window === 'undefined') return '';
  const key = storageKeyForSlug(sessionSlug);
  if (!key) return '';
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Partial<StoredRecruitmentSource>;
    return parsed?.version === 1 ? normalizeRecruitmentSource(parsed.source) : '';
  } catch {
    return '';
  }
};

export const captureSessionRecruitmentSource = (
  sessionSlug: unknown,
  search: string = typeof window !== 'undefined' ? window.location.search || '' : '',
): string => {
  if (typeof window === 'undefined') return '';
  const key = storageKeyForSlug(sessionSlug);
  if (!key) return '';
  const existing = readSessionRecruitmentSource(sessionSlug);
  if (existing) return existing;
  const source = readSourceFromSearch(search);
  if (!source) return '';
  const record: StoredRecruitmentSource = {
    version: 1,
    source,
  };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Session-source attribution is best-effort and must not block response submission.
  }
  return source;
};
