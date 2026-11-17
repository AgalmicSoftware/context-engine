import { parseWorkerGroupReadInvite, WORKER_GROUP_READ_INVITE_HEADER } from '@ce-shared/workerGroupJoin.mjs';

// A private session's read proof, kept per session in this browser so new tabs, reloads and the app's own links
// keep reading without carrying the invite. It is a signature, never the password, and it grants reading only.
const STORAGE_KEY = 'ce:group-read-proof:v1';
type Stored = Record<string, { sessionId: string; header: string }>;

const sessionKey = (workerUrl: unknown, sessionSlug: unknown): string => {
  try {
    const slug = String(sessionSlug || '').trim();
    return slug ? `${new URL(String(workerUrl || '')).origin} ${slug}` : '';
  } catch {
    return '';
  }
};

const readStored = (): Stored => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const writeStored = (stored: Stored) => {
  try {
    if (Object.keys(stored).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Without storage the proof lasts as long as the page. */
  }
};

// Kept in memory too, for a browser that refuses storage.
let inMemory: Stored = {};

/** The read header this browser holds for the session, '' without one. */
export const readGroupReadHeader = (workerUrl: unknown, sessionSlug: unknown): string => {
  const key = sessionKey(workerUrl, sessionSlug);
  if (!key) return '';
  const entry = readStored()[key] || inMemory[key];
  return entry && parseWorkerGroupReadInvite(entry.header) ? entry.header : '';
};

/** The session id the held proof was made for, '' without one. */
export const readGroupReadProofSessionId = (workerUrl: unknown, sessionSlug: unknown): string => {
  const key = sessionKey(workerUrl, sessionSlug);
  return (key && (readStored()[key] || inMemory[key])?.sessionId) || '';
};

export const saveGroupReadHeader = ({
  workerUrl,
  sessionSlug,
  sessionId,
  header,
}: {
  workerUrl: string;
  sessionSlug: string;
  sessionId: string;
  header: string;
}) => {
  const key = sessionKey(workerUrl, sessionSlug);
  if (!key || !parseWorkerGroupReadInvite(header)) throw new Error('That invite could not be kept.');
  const entry = { sessionId: sessionId.toLowerCase(), header };
  inMemory = { ...inMemory, [key]: entry };
  writeStored({ ...readStored(), [key]: entry });
};

/** Forgets the session's proof, as when the Worker says it no longer works. */
export const forgetGroupReadHeader = (workerUrl: unknown, sessionSlug: unknown) => {
  const key = sessionKey(workerUrl, sessionSlug);
  if (!key) return;
  const { [key]: _memory, ...memoryRest } = inMemory;
  inMemory = memoryRest;
  const { [key]: _stored, ...rest } = readStored();
  writeStored(rest);
};

// Sessions whose Worker answered this page with a private shell. Only a Worker new enough to keep a session
// private does, so only these, and sessions this browser holds a proof for, are sent what older Workers refuse.
let privateSessions = new Set<string>();

/** The Worker answered with a private session's shell: it reads sign-ins on routes older Workers keep signed out. */
export const notePrivateSession = (workerUrl: unknown, sessionSlug: unknown) => {
  const key = sessionKey(workerUrl, sessionSlug);
  if (key) privateSessions = new Set(privateSessions).add(key);
};

/** Whether this page knows the session is private: its Worker said so, or this browser holds its read proof. */
export const isKnownPrivateSession = (workerUrl: unknown, sessionSlug: unknown): boolean =>
  privateSessions.has(sessionKey(workerUrl, sessionSlug)) || !!readGroupReadHeader(workerUrl, sessionSlug);

/** The session's read-proof header, to spread into a request's headers; empty when this browser holds none. */
export const groupReadHeaders = (workerUrl: unknown, sessionSlug: unknown): Record<string, string> => {
  const header = readGroupReadHeader(workerUrl, sessionSlug);
  return header ? { [WORKER_GROUP_READ_INVITE_HEADER]: header } : {};
};

/** The headers with the session's read proof added, when this browser holds one. */
export const withGroupReadHeader = (headers: Headers, workerUrl: unknown, sessionSlug: unknown): Headers => {
  const header = readGroupReadHeader(workerUrl, sessionSlug);
  if (header && !headers.has(WORKER_GROUP_READ_INVITE_HEADER)) headers.set(WORKER_GROUP_READ_INVITE_HEADER, header);
  return headers;
};
