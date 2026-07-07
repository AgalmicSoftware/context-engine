export const DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS = 3 * 60 * 1000;
export const LISTENING_MODE_QUERY_VALUE = 'listening';
export const LISTENING_DRAFT_STORAGE_PREFIX = 'ce:listening-draft:';

export type RollingTranscriptSegmentStatus = 'queued' | 'transcribing' | 'complete' | 'error';

export type RollingTranscriptSegment = {
  id: string;
  index: number;
  status: RollingTranscriptSegmentStatus;
  text: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
};

export type ListeningDraft = {
  version: 1;
  sessionSlug: string;
  transcript: string;
  segments: RollingTranscriptSegment[];
  updatedAt: number;
};

const normalizeDraftSegment = (segment: Partial<RollingTranscriptSegment>): RollingTranscriptSegment => {
  const rawStatus = segment.status;
  const status: RollingTranscriptSegmentStatus =
    rawStatus === 'complete' || rawStatus === 'error' ? rawStatus : 'error';
  const completedAt = Number(segment.completedAt || 0) || Date.now();
  return {
    id: String(segment.id || `segment-${segment.index || 0}`),
    index: Number(segment.index || 0),
    status,
    text: String(segment.text || ''),
    startedAt: Number(segment.startedAt || 0),
    ...(status === 'error' && rawStatus !== 'error'
      ? { error: 'Recording interrupted before transcription completed.', completedAt }
      : {}),
    ...(status === 'error' && segment.error ? { error: String(segment.error), completedAt } : {}),
    ...(status === 'complete' && segment.completedAt ? { completedAt: Number(segment.completedAt || 0) } : {}),
  };
};

const normalizeTranscriptTokens = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const mergeRollingTranscriptText = (previous: string, next: string): string => {
  const a = String(previous || '').trim();
  const b = String(next || '').trim();
  if (!a) return b;
  if (!b) return a;

  const left = normalizeTranscriptTokens(a);
  const right = normalizeTranscriptTokens(b);
  let bestOverlap = 0;
  const maxOverlap = Math.min(left.length, right.length, 80);

  for (let size = maxOverlap; size >= 1; size -= 1) {
    let matches = true;
    for (let i = 0; i < size; i += 1) {
      if (left[left.length - size + i] !== right[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      bestOverlap = size;
      break;
    }
  }

  if (bestOverlap > 0 && right.slice(0, bestOverlap).join(' ').length < 8) {
    bestOverlap = 0;
  }

  let trimmedNext = b;
  if (bestOverlap > 0) {
    const leadingTokenPattern = new RegExp(`^(([\\s\\W]*\\w+[\\s\\W]*){${bestOverlap}})`);
    trimmedNext = b.replace(leadingTokenPattern, '').trim();
  }

  if (!trimmedNext) return a;
  return `${a}${/\s$/.test(a) ? '' : ' '}${trimmedNext}`.trim();
};

export const stitchRollingTranscriptSegments = (segments: RollingTranscriptSegment[] = []): string =>
  [...segments]
    .filter((segment) => segment.status === 'complete' && segment.text.trim())
    .sort((a, b) => a.index - b.index)
    .reduce((merged, segment) => mergeRollingTranscriptText(merged, segment.text), '');

export const buildListeningDraftStorageKey = (sessionSlug: unknown): string => {
  const safeSlug =
    String(sessionSlug || 'default')
      .trim()
      .toLowerCase() || 'default';
  return `${LISTENING_DRAFT_STORAGE_PREFIX}${safeSlug}`;
};

const getLocalStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (_) {
    return null;
  }
};

export const readListeningDraft = (sessionSlug: unknown): ListeningDraft | null => {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(buildListeningDraftStorageKey(sessionSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ListeningDraft>;
    if (!parsed || parsed.version !== 1) return null;
    return {
      version: 1,
      sessionSlug: String(parsed.sessionSlug || sessionSlug || ''),
      transcript: String(parsed.transcript || ''),
      segments: Array.isArray(parsed.segments) ? parsed.segments.map((segment) => normalizeDraftSegment(segment)) : [],
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch (_) {
    return null;
  }
};

export const writeListeningDraft = (
  sessionSlug: unknown,
  draft: Pick<ListeningDraft, 'transcript' | 'segments'>,
): boolean => {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const payload: ListeningDraft = {
      version: 1,
      sessionSlug: String(sessionSlug || ''),
      transcript: String(draft.transcript || ''),
      segments: Array.isArray(draft.segments) ? draft.segments : [],
      updatedAt: Date.now(),
    };
    storage.setItem(buildListeningDraftStorageKey(sessionSlug), JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
};

export const clearListeningDraft = (sessionSlug: unknown): boolean => {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.removeItem(buildListeningDraftStorageKey(sessionSlug));
    return true;
  } catch (_) {
    return false;
  }
};

export const isListeningModeQueryEnabled = (search: unknown): boolean => {
  try {
    const raw = String(search || '').trim();
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
    return params.get('mode') === LISTENING_MODE_QUERY_VALUE;
  } catch (_) {
    return false;
  }
};

export const buildListeningModeSearch = (search: unknown, enabled: boolean): string => {
  const raw = String(search || '').trim();
  const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
  if (enabled) {
    params.set('mode', LISTENING_MODE_QUERY_VALUE);
  } else if (params.get('mode') === LISTENING_MODE_QUERY_VALUE) {
    params.delete('mode');
  }
  const next = params.toString();
  return next ? `?${next}` : '';
};
